/**
 * POST /api/contact — the one server route on the site. Runs on Cloudflare
 * Workers. It:
 *   1. validates the form and drops obvious spam (honeypot, optional Turnstile)
 *   2. creates a lead in PushPress (if configured)
 *   3. emails the owner through Brevo (if configured)
 *   4. never stores anything itself
 *
 * If BOTH PushPress and Brevo are unconfigured it still returns ok:false with a
 * clear message so the visitor is told to call — a silent black hole is the
 * worst outcome for a gym.
 */
import type { APIRoute } from 'astro';
import { createLead } from '../../lib/pushpress';
import { site } from '../../../site.config';

export const prerender = false;

interface Env {
  PUSHPRESS_API_KEY?: string;
  PUSHPRESS_COMPANY_ID?: string;
  BREVO_API_KEY?: string;
  LEAD_NOTIFY_TO?: string;
  LEAD_NOTIFY_FROM?: string;
  TURNSTILE_SECRET_KEY?: string;
}

function clean(v: FormDataEntryValue | null, max: number): string {
  return String(v ?? '').replace(/[\u0000-\u001f]+/g, ' ').trim().slice(0, max);
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
}

async function verifyTurnstile(secret: string, token: string, ip: string | null): Promise<boolean> {
  const body = new URLSearchParams({ secret, response: token });
  if (ip) body.set('remoteip', ip);
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body });
  const json = (await res.json().catch(() => ({}))) as { success?: boolean };
  return Boolean(json.success);
}

async function sendBrevo(env: Env, subject: string, html: string, replyTo: { email: string; name: string }): Promise<{ ok: boolean; error?: string }> {
  if (!env.BREVO_API_KEY) return { ok: false, error: 'Brevo not configured' };
  // Never guess a recipient: both addresses must be set in Cloudflare.
  if (!env.LEAD_NOTIFY_TO || !env.LEAD_NOTIFY_FROM) return { ok: false, error: 'LEAD_NOTIFY_TO / LEAD_NOTIFY_FROM not set' };
  const to = env.LEAD_NOTIFY_TO;
  const from = env.LEAD_NOTIFY_FROM;
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': env.BREVO_API_KEY, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      sender: { email: from, name: `${site.name} website` },
      to: [{ email: to }],
      replyTo,
      subject,
      htmlContent: html,
    }),
  });
  if (!res.ok) return { ok: false, error: `brevo ${res.status}: ${(await res.text()).slice(0, 200)}` };
  return { ok: true };
}

export const POST: APIRoute = async ({ request, locals, redirect }) => {
  const env = ((locals as { runtime?: { env?: Env } }).runtime?.env ?? {}) as Env;
  const wantsJson = (request.headers.get('accept') || '').includes('application/json');
  const respond = (status: number, body: { ok: boolean; error?: string }) =>
    wantsJson
      ? new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
      : body.ok
        ? redirect('/thanks/', 303)
        : redirect(`/contact/?error=${encodeURIComponent(body.error ?? 'Something went wrong')}`, 303);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return respond(400, { ok: false, error: 'Bad request.' });
  }

  // Honeypot: bots fill every field.
  if (clean(form.get('website'), 10)) return respond(200, { ok: true });

  const name = clean(form.get('name'), 120);
  const email = clean(form.get('email'), 200);
  const phone = clean(form.get('phone'), 40);
  const rawSubject = clean(form.get('subject'), 80);
  const subject = (site.contactForm.subjects as readonly string[]).includes(rawSubject) ? rawSubject : 'Website message';
  const message = clean(form.get('message'), 3000);
  const page = clean(form.get('page'), 200).replace(/^(?!\/[a-z0-9\-\/]*$).*/i, '/');

  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !message) {
    return respond(400, { ok: false, error: 'Please add your name, a valid email, and a message.' });
  }

  const ip = request.headers.get('cf-connecting-ip');
  if (env.TURNSTILE_SECRET_KEY) {
    const token = clean(form.get('cf-turnstile-response'), 4000);
    if (!token || !(await verifyTurnstile(env.TURNSTILE_SECRET_KEY, token, ip))) {
      return respond(400, { ok: false, error: 'Spam check failed. Please try again or call us.' });
    }
  }

  const [firstName, ...rest] = name.split(/\s+/);
  const lead = await createLead(env, {
    firstName,
    lastName: rest.join(' '),
    email,
    phone,
    campaign: `website-${subject.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    pageUrl: page ? new URL(page, site.url).toString() : undefined,
    referer: request.headers.get('referer') ?? undefined,
  });

  const html = `
    <h2>New website message — ${escapeHtml(subject)}</h2>
    <p><strong>${escapeHtml(name)}</strong><br>
    <a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a>${phone ? `<br>${escapeHtml(phone)}` : ''}</p>
    <p style="white-space:pre-wrap">${escapeHtml(message)}</p>
    <hr>
    <p style="color:#666;font-size:12px">${lead.ok ? 'Added to PushPress as a lead.' : `Not added to PushPress (${escapeHtml(lead.error ?? 'not configured')}).`}</p>
  `;
  const mail = await sendBrevo(env, `[Helix website] ${subject} — ${name}`, html, { email, name });

  if (!lead.ok && !mail.ok) {
    console.error('[contact] lead failed:', lead.error, '| mail failed:', mail.error);
    return respond(503, { ok: false, error: `We couldn't send that just now. Please call ${site.phoneDisplay} or email ${site.email}.` });
  }
  if (!mail.ok) console.warn('[contact] mail failed:', mail.error);
  if (!lead.ok) console.warn('[contact] lead failed:', lead.error);
  return respond(200, { ok: true });
};

export const GET: APIRoute = () =>
  new Response('Use the contact form.', { status: 405, headers: { Allow: 'POST' } });
