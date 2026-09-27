#!/usr/bin/env node
/**
 * Site-kit doctor. Complements `jeldon doctor` (which checks the content
 * engine) by checking everything the /setup wizard is supposed to fill in.
 * Exit 0 = ready to launch. Warnings are listed but don't fail.
 */
import { readFile, readdir } from 'node:fs/promises';

const ok = (m) => console.log(`✔ ${m}`);
const warn = (m) => (warnings++, console.log(`⚠ ${m}`));
const bad = (m) => (errors++, console.log(`✖ ${m}`));
let errors = 0;
let warnings = 0;

const siteSrc = await readFile('site.config.ts', 'utf8');
const packSrc = await readFile('jeldon.config.ts', 'utf8');

// 1. SETUP markers left behind
const count = (s) => (s.match(/SETUP:/g) || []).length;
const openMarkers = count(siteSrc) + count(packSrc);
let contentMarkers = 0;
async function walk(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = `${dir}/${e.name}`;
    if (e.isDirectory()) out.push(...(await walk(p)));
    else if (/\.(md|astro|json)$/.test(e.name)) out.push(p);
  }
  return out;
}
for (const dir of ['src/content', 'src/pages']) {
  for (const f of await walk(dir)) contentMarkers += count(await readFile(f, 'utf8'));
}
if (openMarkers === 0) ok('no SETUP markers left in site.config.ts / jeldon.config.ts');
else warn(`${openMarkers} SETUP marker(s) still in site.config.ts / jeldon.config.ts (run /setup to fill them)`);
if (contentMarkers === 0) ok('no SETUP markers left in programs, coaches, pages');
else warn(`${contentMarkers} SETUP marker(s) still in content or pages`);

// 2. Things the owner must confirm before launch
if (/hoursConfirmed:\s*true/.test(siteSrc)) ok('hours confirmed'); else warn('hours not confirmed (footer shows a generic line until they are)');
if (!/planKey: 'membership12'[^\n]*\n[\s\S]*?membership12: ''/.test(siteSrc) && !/membership12: ''/.test(siteSrc)) ok('membership sign-up links set'); else warn('membership plan links are blank — pricing buttons fall back to the contact form');
if (/cloudflareToken: '[^']+'/.test(siteSrc)) ok('Cloudflare Web Analytics token set'); else warn('no Cloudflare Web Analytics token — no traffic data will be collected');
if (/placeId: ''/.test(packSrc)) warn('Google place ID blank (needed for local-rank tracking later; not needed to launch)'); else ok('Google place ID set');

// 3. Secrets for the live site (checked as env here; on Cloudflare they live in the dashboard)
const env = process.env;
const secretsDoc = 'set in Cloudflare → Workers & Pages → helix-training-site → Settings → Variables and Secrets';
for (const k of ['PUSHPRESS_API_KEY', 'PUSHPRESS_COMPANY_ID']) if (!env[k]) warn(`${k} not set in this environment (${secretsDoc}); contact form will skip PushPress`);
if (!env.BREVO_API_KEY) warn(`BREVO_API_KEY not set in this environment (${secretsDoc}); contact form will skip email`);
if (!env.PUSHPRESS_API_KEY && !env.BREVO_API_KEY) warn('no contact-form destination in THIS environment. Secrets live in Cloudflare, so the real check is `npm run test:contact -- <live url>` — /launch requires it to pass.');
else ok('at least one contact-form destination configured');

// 4. Content sanity
const articles = (await readdir('src/content/articles')).filter((f) => f.endsWith('.md'));
let live = 0;
for (const f of articles) if (!/^draft:\s*true/m.test(await readFile(`src/content/articles/${f}`, 'utf8'))) live++;
if (live > 0) ok(`${live} published article(s)`); else warn('no published articles yet (the seed article is a draft until the owner approves it)');

console.log(`\n${errors ? '✖' : '✔'} check:site — ${errors} error(s), ${warnings} warning(s)`);
process.exit(errors ? 1 : 0);
