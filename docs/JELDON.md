# Jeldon in this repo

Jeldon (github.com/dryoung1029/jeldon) is the content engine. It was extracted
from the Body of Health site so a second site could reuse the proven parts. This
repo is Jeldon's first "local business" consumer.

## What's used, what isn't

| Package | Used for | Needs a key? |
|---|---|---|
| `@jeldon/config` | Loads and validates `jeldon.config.ts` (the Domain Pack) | no |
| `@jeldon/core-scoring` | SEO + GEO (AI-citability) + reading-level scoring | no |
| `@jeldon/content-model` | Article frontmatter schema, draft/ready/scheduled/live rules | no |
| `@jeldon/schema-graph` | JSON-LD: Organization/LocalBusiness, WebSite, Person, Article, FAQPage, breadcrumbs; sitemap exclusion; llms.txt | no |
| `@jeldon/verify` | Citation lint | no |
| `@jeldon/competitive-intel` | Competitor site scanner + gap comparison (`npm run competitors`) | no (PageSpeed key optional) |
| `@jeldon/cli` | `jeldon validate`, `jeldon doctor`, `jeldon check-geo-floor` | no |
| `@jeldon/drafting` | API-driven drafting pipeline | **not used** — Claude Code drafts (`/article`) |
| `@jeldon/aeo-audit` | Asks Perplexity/Claude whether we get cited | not used yet (needs API keys; Jason can run it) |
| `@jeldon/amplify`, `media`, `crawler-analytics`, `entity-presence` | newsletter, audio, edge analytics | not used |

## How the packages got here

`@jeldon/*` isn't on npm yet, so the built `dist/` of each package was copied
into `vendor/@jeldon/` from commit `54fee58` (2026-07-05) with `file:`
dependencies in `package.json`. To update: build Jeldon (`pnpm install && pnpm
build`), copy each package's `dist/` and `package.json` over, and change any
`"workspace:*"` dependency to `"file:../<name>"`. Once Jason publishes the
packages, replace the seven `file:` lines with `"^0.1.0"` and delete `vendor/`;
Renovate will then keep them current.

## The Domain Pack (`jeldon.config.ts`) — fields that matter here

- `brand` — name, canonical URL, tagline, NAP (address/phone), logo, colors.
  Feeds the LocalBusiness JSON-LD on every page.
- `authors[0]` — Kathy. `schemaId` is the `@id` every article links to; her
  `profile` (jobTitle, credential, knowsAbout, alumniOf, memberOf, sameAs)
  becomes the Person node on `/coaches/`. This is the E-E-A-T signal.
- `voice` — persona, banned topics/phrasings, rules, reading band. `/article`
  injects this. `voiceAnchorUrls`: add 1–2 published articles she says sound
  like her.
- `content` — categories (`guide`, `evidence`, `training`, `nutrition`,
  `community`), per-category GEO targets, curated tag vocabulary.
- `scoring` — defaults from Body of Health with two overrides: the citation
  regex points at fitness/rehab sources (PubMed, DOI, ACSM, NSCA, CDC, APTA…)
  and the first-person markers are a coach's ("when I coach", "in our gym").
- `citation.policy: 'direct-source-urls'` — references are real links; the
  lint stays quiet; Claude Code verifies each link by opening it.
- `aeo.querySet` — the eight questions we want to be the answer to. Used by
  `/reddit-ideas` and `/article` for topic selection; used by `aeo-audit` if
  Jason ever runs it.
- `competitors` — roster, target keywords, template fingerprints.
- `schema` — `orgType` includes `LocalBusiness` and `HealthClub`;
  `emitLlmsTxt: true` with a curated `llmsTxt` block.
- `capabilities` — only `competitiveIntel` on. `drafting: false` is
  deliberate (see above).
- `services.store: 'fs'` — no GitHub-as-database; the repo is the database.

Validation invariants (doctor checks them): floor ≤ every category target;
`defaultAuthorSlug` matches an author; query set non-empty.

## Score one file by hand

```
node -e "
import('@jeldon/config').then(async ({loadDomainPack})=>{
 const {calculateGeo,calculateSeo,fleschKincaidGrade}=await import('@jeldon/core-scoring');
 const {parse}=await import('@jeldon/content-model'); const fs=await import('fs');
 const f=process.argv[1]; const pack=await loadDomainPack();
 const {frontmatter,body}=parse(fs.readFileSync(f,'utf8'));
 const input={title:frontmatter.title,excerpt:frontmatter.excerpt,tags:frontmatter.tags,body,slug:f.split('/').pop().replace('.md',''),heroImage:frontmatter.heroImage,heroImageAlt:frontmatter.heroImageAlt};
 console.log(JSON.stringify({geo:calculateGeo(input,pack.scoring.geo),seo:calculateSeo(input,pack.scoring.seo),grade:fleschKincaidGrade(body)},null,1));
})" src/content/articles/<slug>.md
```

`npm run check:geo -- <file>` scores a draft too (drafts are skipped only when
no file is named).

## Notes for the engine (things this build found — for the Jeldon spawn-engine work)

1. **Packages aren't published.** `npm view @jeldon/config` → 404. The
   template's `pnpm install` fails on a fresh clone. Publishing (or `jeldon
   init` vendoring) is step one of any spawn engine.
2. **`jeldon init` is a stub.** It prints a degit hint.
3. **Article URL prefix is hardcoded** to `/articles/` in
   `schema-graph` (`articleGraph`, `sitemapExcludedArticleUrls`) and the author
   fallback URL to `/team/`. This site uses `/blog/` and works around it with a
   string rebase in `src/lib/seo.ts` and `astro.config.mjs`. Suggest
   `content.articlePathPrefix` and `authors[].urlPrefix` in the Domain Pack.
4. **Template has no site kit.** `BaseLayout` is header/footer/JSON-LD only; no
   design tokens, no page set, no forms. Everything under `src/`, `public/`,
   `site.config.ts`, `scripts/{check-site,scan-competitors,traffic-report,
   test-contact}.mjs`, `.claude/`, and `docs/` here is the "local-business kit"
   worth extracting.
5. **Drafting assumes an API key.** For a novice owner, Claude Code is the
   drafter. An "agent mode" that exports the prompt builders + voice block (so
   `/article` calls the same prompts) would keep one source of truth.
6. **`wrangler.toml` in the template uses `pages_build_output_dir`** (a Pages
   setting) while targeting the Workers adapter. This repo uses
   `wrangler.jsonc` with `main` + `assets`, which `wrangler deploy` accepts.
7. **Template uses legacy content collections** (`type: 'content'`, `.slug`,
   `entry.render()`). Astro 5's content layer (`glob` loader, `id`, `render()`)
   is what this repo uses.
8. **`@astrojs/cloudflare` + `@jeldon/config` in a server route** pulls jiti
   and `node:fs` into the Worker bundle. Keep server routes free of the Domain
   Pack loader (this repo keeps `site.config.ts` import-free for that reason).
9. **Competitive-intel scanner** reported "Meta description: MISSING" on a page
   that has one, and didn't identify the PushPress/Webflow vendor despite
   `templateVendors` fingerprints. Worth a test case.
10. **A doctor for the site kit** (`npm run check:site`) had to be written
    alongside `jeldon doctor`; the engine's doctor only knows the Domain Pack.
