---
description: Find the weak spots on our own site — speed, SEO, structured data, links, accessibility, copy — and fix the easy ones.
---

# /audit — weak-spot check of our site

Two modes. Ask which, or do both if she says "everything".

## A. Live site audit (needs the `.workers.dev` or `helixtrain.com` URL)

1. `npm run competitors -- <our live url>` — reuses the competitor scanner on
   us: citability score, headings, schema types, sitemap, robots, page sample.
2. WebFetch the home page, one program page, the schedule, pricing, contact,
   blog index, and the newest article. For each check:
   - Title 40–60 chars, unique; meta description 120–160 chars, unique.
   - Exactly one H1; H2s in order; no empty headings.
   - JSON-LD present and valid-looking (Organization/LocalBusiness on every
     page; Service on programs; Article + FAQPage on posts; FAQPage where FAQs
     show). Paste each into the Schema Markup Validator via WebFetch of
     `https://validator.schema.org/` only if it can be automated; otherwise
     eyeball the JSON for missing fields.
   - Every link resolves (HEAD/GET, no 404s). Every image has alt text.
   - No `SETUP:` markers or placeholder text visible to a visitor.
   - Old Webflow URLs still redirect (`/membership-pricing-request` → `/pricing/`).
3. Speed: run Google PageSpeed Insights via WebFetch of
   `https://pagespeed.web.dev/analysis?url=<url>` is not reliable; instead call
   the API with no key: `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=<url>&strategy=mobile`
   and read `lighthouseResult.categories.performance.score` and the Core Web
   Vitals fields. Anything under 90 on mobile gets a line in the report.
4. Search Console, if she has exported CSVs: `npm run traffic` and read
   `data/search-console/report.md` for pages with impressions but no clicks
   (weak titles/descriptions) and queries at positions 8–20 (one good article
   or a stronger page could move them).

## B. Repo audit (no URL needed)

`npm run build`, `npm run check`, `npm run doctor`, `npm run check:site`,
`npm run check:frontmatter`, `npm run check:geo`, `npm run check:citations`.
Grep for `TODO`, `SETUP:`, `lorem`, `example.com`. Check `public/_redirects`
covers every old URL in `docs/OLD-URLS.md`.

## Report and fix

Write `data/audit-<date>.md`: a table of findings with **Severity** (blocks
launch / hurts ranking / cosmetic), **Page**, **What**, **Fix**, **Who**
(me now / owner decision / Jason). Then fix everything in the "me now" column,
build, commit "Audit fixes <date>", push, and re-check the fixed items live.

In chat: how many issues found, how many already fixed, and the one decision
she needs to make (if any). Keep it to five sentences.
