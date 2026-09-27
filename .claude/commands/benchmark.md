---
description: Score the new site against the old one on every measurable dimension. The site launches only when it wins or ties on all of them.
---

# /benchmark — better than the old site, provably

The directive (CLAUDE.md): the new site must be better in every way that can
be measured and worse in none. This command produces the evidence.

Inputs: OLD = `https://www.helixtrain.com` (until launch; afterwards the
archived copy if one exists), NEW = the `.workers.dev` URL (or
`https://helixtrain.com` after launch). If the new URL isn't in
`docs/PROGRESS.md`, ask for it.

## Dimensions and how to measure each (same method for both sites)

1. **Speed** — PageSpeed Insights API, no key:
   `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=<url>&strategy=mobile`
   (and `desktop`). Record performance score, LCP, CLS, INP/TBT, total bytes.
   Do the home page and one program page. Run twice; keep the better.
2. **Search hygiene** — for the home page, programs, pricing, schedule,
   contact, blog index, one article: unique `<title>` 40–60 (short page names
   OK), unique meta description 120–160, exactly one H1, canonical present,
   `lang`, viewport, no `noindex` on public pages, sitemap present and listing
   only 200 pages, robots.txt present. Count passes per page.
3. **Duplicate URLs** — pages that answer the same intent at two addresses
   (the old site has blog/blog-…, about/about-…, etc.). Count them.
4. **Structured data** — JSON-LD types on each page above; whether
   Organization/LocalBusiness carries NAP; Article on articles; FAQPage where
   FAQs render; BreadcrumbList. Count present types and missing fields.
5. **Citability (GEO)** — `npm run competitors -- <url>` on both; homepage
   `geoScore` from `data/competitors/adhoc-*.json`. For articles, score with
   `check:geo`.
6. **Content depth** — number of indexable pages, words on home page, number
   of blog posts with ≥ 600 words and a References section, FAQ count.
7. **Conversion path** — clicks from home to a booking action; whether the
   primary CTA is above the fold on mobile (viewport meta + first section);
   whether the contact form works (`npm run test:contact` on NEW; on OLD, just
   note that it's a third-party embed); dead links and `#` links counted.
8. **Accessibility** — alt text on all images, form labels present, one H1,
   skip link, color contrast of body text and buttons (compute from the CSS
   tokens for NEW; sample from computed styles you can read in HTML for OLD),
   focus styles present, reduced-motion respected.
9. **Honesty** — copy claims that can't be sourced (invented stats, fake
   urgency like an expired "Summer Special", stale copyright year). Count.
10. **Local** — NAP matches the Google Business Profile exactly; phone is a
    `tel:` link; map present; hours published (only if confirmed).

## Output

`data/benchmark/scorecard-<date>.md` and `data/benchmark/latest.json`:

| Dimension | Old | New | Verdict |
|---|---|---|---|

Verdict is **win / tie / behind**. Any **behind** blocks `/launch`. Below the
table: the three biggest wins in plain words (she can quote these), and a
fix list for anything behind or tied that could be a win.

In chat: the table, then one sentence. Keep every scorecard; the trend matters.
