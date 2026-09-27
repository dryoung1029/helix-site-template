#!/usr/bin/env node
/**
 * Traffic report from Google Search Console CSV exports.
 *
 * How the owner gets the files (no API, no service account):
 *   Search Console → Performance → Search results → Export (top right) →
 *   Download CSV. That gives a zip with Queries.csv, Pages.csv, Countries.csv,
 *   Devices.csv, Dates.csv. Unzip and drop the CSVs into data/search-console/.
 *   Use a folder per export if you want history: data/search-console/2026-10/.
 *
 * This script reads every Queries.csv / Pages.csv / Dates.csv it finds, prints
 * the essentials, and writes data/search-console/report.md for Claude Code
 * (/traffic) to reason about.
 */
import { readdir, readFile, writeFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

const ROOT = 'data/search-console';

async function walk(dir) {
  const out = [];
  for (const name of await readdir(dir).catch(() => [])) {
    const p = join(dir, name);
    const s = await stat(p);
    if (s.isDirectory()) out.push(...(await walk(p)));
    else if (name.toLowerCase().endsWith('.csv')) out.push(p);
  }
  return out;
}

function parseCsv(text) {
  const rows = [];
  let row = [], field = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') (field += '"'), i++;
      else if (c === '"') q = false;
      else field += c;
    } else if (c === '"') q = true;
    else if (c === ',') row.push(field), (field = '');
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += c;
  }
  if (field || row.length) row.push(field), rows.push(row);
  const [head, ...body] = rows.filter((r) => r.length > 1);
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h.trim(), (r[i] ?? '').trim()])));
}

const num = (v) => Number(String(v).replace(/[%,]/g, '')) || 0;
const files = await walk(ROOT);
if (!files.length) {
  console.log(`No CSVs found in ${ROOT}/. Export from Search Console (Performance → Export → Download CSV) and drop the files there.`);
  process.exit(0);
}

const lines = [`# Search Console report — generated ${new Date().toISOString().slice(0, 10)}`, ''];
for (const f of files.sort()) {
  const base = f.split('/').pop().toLowerCase();
  const rows = parseCsv(await readFile(f, 'utf8'));
  if (!rows.length) continue;
  const key = Object.keys(rows[0])[0];
  const withClicks = rows.map((r) => ({ ...r, _clicks: num(r.Clicks), _imp: num(r.Impressions), _ctr: num(r.CTR), _pos: num(r.Position) }));
  const totalClicks = withClicks.reduce((a, r) => a + r._clicks, 0);
  const totalImp = withClicks.reduce((a, r) => a + r._imp, 0);
  lines.push(`## ${f}`, `- Rows: ${rows.length} · Clicks: ${totalClicks} · Impressions: ${totalImp}`);

  if (base.startsWith('quer') || base.startsWith('page')) {
    const top = [...withClicks].sort((a, b) => b._clicks - a._clicks || b._imp - a._imp).slice(0, 15);
    lines.push('', `| ${key} | Clicks | Impr. | CTR | Pos. |`, '|---|---|---|---|---|');
    for (const r of top) lines.push(`| ${r[key]} | ${r._clicks} | ${r._imp} | ${r.CTR} | ${r.Position} |`);
    // Opportunities: lots of impressions, weak position or CTR
    const opp = withClicks.filter((r) => r._imp >= 20 && (r._pos > 8 || r._ctr < 2)).sort((a, b) => b._imp - a._imp).slice(0, 10);
    if (opp.length) {
      lines.push('', `**Opportunities (high impressions, weak position/CTR):**`);
      for (const r of opp) lines.push(`- ${r[key]} — ${r._imp} impressions, position ${r.Position}, CTR ${r.CTR}`);
    }
  }
  if (base.startsWith('date')) {
    const sorted = [...withClicks].sort((a, b) => (a[key] < b[key] ? -1 : 1));
    const first = sorted.slice(0, 7), last = sorted.slice(-7);
    const sum = (arr) => arr.reduce((a, r) => a + r._clicks, 0);
    lines.push(`- First 7 days clicks: ${sum(first)} · Last 7 days clicks: ${sum(last)}`);
  }
  lines.push('');
}
await writeFile(join(ROOT, 'report.md'), lines.join('\n'));
console.log(lines.join('\n'));
console.log(`\nWrote ${ROOT}/report.md`);
