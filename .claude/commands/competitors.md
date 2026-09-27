---
description: Scan local competitor gyms (CrossFit boxes, Burn Boot Camp, boutique studios) and report where Helix can win.
---

# /competitors — the competitive picture

Read `jeldon.config.ts → competitors`. The roster starts with three known
Corvallis competitors; grow it.

## 1. Discover (WebSearch)

Search for gyms and studios that compete for the same person in Corvallis and
nearby (Albany, Philomath): "CrossFit Corvallis", "Burn Boot Camp Corvallis",
"Orangetheory Corvallis", "F45 Corvallis", "personal trainer Corvallis",
"strength training Corvallis", "gym Corvallis Oregon", "group fitness classes
Corvallis". Also check Google Maps results via WebSearch snippets. Skip big-box
gyms (24 Hour Fitness, Planet Fitness) unless she asks — different buyer.

For each real competitor with a website: add to `competitors.roster`
(`id`, `name`, `url`). Ask the owner to confirm the list once ("Anyone I'm
missing? Anyone to leave out?"). Commit.

## 2. Measure (deterministic)

Run `npm run competitors`. It writes `data/competitors/summary.md` and a JSON
per site: homepage citability (GEO) score, word count, headings, schema.org
types, sitemap/robots, template vendor, and a gap table against our site.
Read every summary. Also WebFetch each competitor's pricing page, schedule
page, and one blog post if they have one; note prices, free-trial offers,
class sizes, and any claims about credentials.

## 3. Interpret (you)

Write `data/competitors/report-<date>.md` with these sections, plain English:

- **Where we already win** (e.g. only gym owned by a DPT; small classes; a
  real blog with sources).
- **Where they beat us today** (illustrative examples only — use real
  findings: review counts, schedules published as text, clearer pricing).
- **Five moves, ranked by payoff ÷ effort.** Each: what, why, how long, which
  command does it (`/article`, `/audit`, a config change).
- **Article ideas the competitors aren't covering** — feed these to
  `data/reddit/ideas-<date>.md` too.
- **Local pack notes**: who shows in the Google map results for the target
  keywords (from search snippets) and what their listings have that ours
  doesn't (photos, posts, Q&A, categories).

Never write anything that disparages a competitor by name in public content.
This report is internal.

## 4. Tell her

Three sentences in chat: the single biggest thing we have that they don't, the
single biggest thing they have that we don't, and the first move. Link the
report file. Ask if she wants to start on move #1 now.

Re-run quarterly. Keep old reports; they show the trend.
