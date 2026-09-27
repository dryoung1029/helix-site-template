/**
 * PushPress Platform API (https://api.pushpress.com/v3).
 *
 * Two jobs:
 *   1. `fetchUpcomingClasses()` — read the next week of classes at build time so
 *      the /schedule page renders real class names and times as plain HTML
 *      (fast, crawlable). If the API key isn't set, the page falls back to the
 *      PushPress calendar embed.
 *   2. `createLead()` — used by /api/contact to drop a website inquiry into
 *      PushPress as a lead, with attribution so the owner can see it came from
 *      the website.
 *
 * Auth: `API-KEY` header + `company-id` header (both from the PushPress
 * developer portal). Never call this from the browser.
 */

const BASE = 'https://api.pushpress.com/v3';

export interface PushPressEnv {
  PUSHPRESS_API_KEY?: string;
  PUSHPRESS_COMPANY_ID?: string;
}

export interface UpcomingClass {
  id: string;
  title: string;
  typeName: string | null;
  start: Date;
  end: Date;
  spotsLeft: number | null;
}

function headers(env: PushPressEnv): HeadersInit {
  return {
    'API-KEY': env.PUSHPRESS_API_KEY ?? '',
    'company-id': env.PUSHPRESS_COMPANY_ID ?? '',
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
}

export function isConfigured(env: PushPressEnv): boolean {
  return Boolean(env.PUSHPRESS_API_KEY && env.PUSHPRESS_COMPANY_ID);
}

/** PushPress returns epoch times; some fields are seconds, some milliseconds. */
function toDate(n: number): Date {
  return new Date(n < 1e12 ? n * 1000 : n);
}

/**
 * Next `days` days of classes, sorted by start time. Returns [] when the API is
 * not configured or the call fails — the page handles both by showing the
 * calendar embed instead. Never throws during a build.
 */
export async function fetchUpcomingClasses(env: PushPressEnv, days = 7): Promise<UpcomingClass[]> {
  if (!isConfigured(env)) return [];
  const startsAfter = Math.floor(Date.now() / 1000);
  const horizon = Date.now() + days * 86_400_000;
  const out: UpcomingClass[] = [];
  try {
    for (let page = 1; page <= 5; page++) {
      const url = `${BASE}/classes?startsAfter=${startsAfter}&limit=100&page=${page}&order=ascending`;
      const res = await fetch(url, { headers: headers(env) });
      if (!res.ok) {
        console.warn(`[pushpress] classes request failed: ${res.status}`);
        break;
      }
      const json = (await res.json()) as { data?: { resultArray?: unknown[] } };
      const rows = json.data?.resultArray ?? [];
      if (rows.length === 0) break;
      let pastHorizon = false;
      for (const raw of rows) {
        const r = raw as Record<string, unknown>;
        const start = toDate(Number(r.start));
        if (start.getTime() > horizon) {
          pastHorizon = true;
          break;
        }
        const reservations = Array.isArray(r.reservations) ? r.reservations.length : null;
        const capacity = typeof r.capacity === 'number' ? r.capacity : null;
        out.push({
          id: String(r.id),
          title: String(r.title || r.name || r.classTypeName || 'Class'),
          typeName: (r.classTypeName as string) ?? null,
          start,
          end: toDate(Number(r.end)),
          spotsLeft: capacity !== null && reservations !== null ? Math.max(0, capacity - reservations) : null,
        });
      }
      if (pastHorizon || rows.length < 100) break;
    }
  } catch (err) {
    console.warn('[pushpress] classes fetch error:', err instanceof Error ? err.message : err);
    return [];
  }
  return out.sort((a, b) => a.start.getTime() - b.start.getTime());
}

export interface LeadInput {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  /** Free-text context for the attribution record. */
  campaign?: string;
  pageUrl?: string;
  referer?: string;
  utm?: { source?: string; medium?: string; campaign?: string; content?: string; term?: string };
}

export interface LeadResult {
  ok: boolean;
  customerId?: string;
  error?: string;
}

/**
 * Create the person as a PushPress customer (a lead) and attach a website
 * attribution. Returns ok:false with a message on any failure so the caller
 * can still email the owner — a lost lead is worse than a missing CRM row.
 */
export async function createLead(env: PushPressEnv, lead: LeadInput): Promise<LeadResult> {
  if (!isConfigured(env)) return { ok: false, error: 'PushPress not configured' };
  try {
    const res = await fetch(`${BASE}/customers`, {
      method: 'POST',
      headers: headers(env),
      body: JSON.stringify({
        name: { first: lead.firstName, last: lead.lastName || '-', nickname: null },
        email: lead.email,
        phone: lead.phone || null,
        source: 'PLATFORM',
      }),
    });
    const text = await res.text();
    if (!res.ok) {
      // A repeat inquiry from someone already in PushPress is not a failure.
      if (res.status === 409 || /exist|duplicate|already/i.test(text)) return { ok: true, error: 'existing customer' };
      return { ok: false, error: `customers ${res.status}: ${text.slice(0, 200)}` };
    }
    let customerId: string | undefined;
    try {
      const json = JSON.parse(text) as Record<string, unknown>;
      customerId = (json.id as string) ?? ((json.data as Record<string, unknown>)?.id as string);
    } catch {
      /* ignore */
    }
    if (customerId) {
      await fetch(`${BASE}/attributions/attributions`, {
        method: 'POST',
        headers: headers(env),
        body: JSON.stringify({
          customerId,
          event: 'signup',
          utmSource: lead.utm?.source ?? 'website',
          utmMedium: lead.utm?.medium ?? 'contact-form',
          utmCampaign: lead.utm?.campaign ?? lead.campaign ?? 'website-contact',
          utmContent: lead.utm?.content ?? null,
          utmTerm: lead.utm?.term ?? null,
          url: lead.pageUrl ?? null,
          referer: lead.referer ?? null,
        }),
      }).catch(() => undefined);
    }
    return { ok: true, customerId };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
