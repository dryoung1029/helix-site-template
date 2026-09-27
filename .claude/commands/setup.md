---
description: Guided setup wizard — interviews the owner in plain language, fills in the site, and walks her through each account one screen at a time.
---

# /setup — the guided setup wizard

You are running the setup wizard for the Helix Training website. Read
`CLAUDE.md` first if you haven't this session. Follow the rules there about
talking to the owner: one step at a time, exact clicks, plain words, wait for
confirmation, never a terminal, never a secret in chat.

The wizard has **stages**. Each stage ends with a short "Done with X — next is
Y. Ready, or want a break?" The owner can say skip / later / stop at any point.

## Stage 0 — Find out where we are

1. Run `npm install` if `node_modules` is missing, then `npm run check:site`
   and read `docs/PROGRESS.md` if it exists. That file is the wizard's memory:
   which stages are done, what she skipped, open questions.
2. Count `SETUP:` markers in `site.config.ts`, `jeldon.config.ts`,
   `src/content/**`, `src/pages/**`.
3. If this is the first run, say roughly this (in your own words, warmly):

   > Hi Kathy — I'm going to set up your new website with you. I'll ask
   > questions one at a time, and for the few places where you need to click
   > around in a website (like Cloudflare), I'll tell you exactly what to click
   > and wait for you. Nothing goes live until you say so. You can say "skip"
   > or "stop" any time and we'll pick up where we left off. Should take a few
   > sessions, not one. Ready for the first questions?

   If resuming, summarize what's done in two sentences and offer the next stage.
4. Create or update `docs/PROGRESS.md` as you go (a simple checklist with
   dates and notes). Commit it with each stage.

## Stage 1 — The basics (10 minutes)

Ask, one question per message, and write answers into `site.config.ts`
and `jeldon.config.ts`. Confirm what's already there rather than re-asking:

- Business name and the exact way she wants it written.
- Address and phone (already in — confirm).
- **Lead email**: which inbox should get website messages? (`site.email`,
  `LEAD_NOTIFY_TO` later in Cloudflare).
- **Hours**: ask day by day, or "same every weekday?" Write them as
  `'5:30 AM – 7:00 PM'` per day in `site.config.ts → hours`, then set
  `hoursConfirmed: true`. The footer and the LocalBusiness structured data
  both read from there.
- Social links: Facebook and Instagram are in; ask about TikTok, YouTube.
- Members app links (App Store / Google Play) if she has them.
- Google Business Profile: ask her to open Google Maps, search "Helix
  Training", and paste the share link. From the link you can usually find the
  place ID (or use WebSearch "Helix Training Corvallis place id"); if not, leave
  `placeId` blank — it only matters for rank tracking later.

Run `npm run build`, commit "Setup: basics".

## Stage 2 — Programs and prices (15 minutes)

For each file in `src/content/programs/`:
1. Show her the current page text in chat (the body, not the frontmatter) and
   ask: "Is this right? What would you change?" Apply her edits in her words.
2. Confirm price, length, format.
3. **Sign-up links.** Every program can link straight to PushPress checkout.
   Walk her through finding each link:
   > In PushPress: open your Control Panel → **Plans** (left menu) → click the
   > plan → look for **Landing page** or a **Share** button → copy the link.
   > It starts with `https://helixtraining.pushpress.com/landing/plans/`.
   > Paste it here.
   The seven links in `site.config.ts → pushpress.plans` were copied from her
   old site; confirm each opens (WebFetch; a 200 is enough) and ask her if any
   plan has changed. Only ask her to find a link when one is missing or dead.
4. Strong Foundations: next session dates and price → update the program page
   and remove the SETUP marker.
5. Pricing table in `site.config.ts → pricing`: confirm every number.

Build, commit "Setup: programs and pricing".

## Stage 3 — Coaches (15 minutes)

For each coach: name spelling, role, credentials (as she wants them shown), a
3–5 sentence bio. Ask her to tell you about each coach in her own words and
write the bio from that — don't invent details. Photos: see Stage 5.
Mark `draft: true` on any coach who has left.

Her own bio goes on the coaches page **and** in `jeldon.config.ts → authors[0]`
(`profile.jobTitle`, `alumniOf` (her DPT program), `memberOf` (e.g. APTA),
`knowsAbout`). This is what tells Google and AI engines who wrote the articles.

Build, commit "Setup: coaches".

## Stage 4 — Her voice (10 minutes)

This is what makes the articles sound like her instead of like a robot.
Ask these, one at a time, and listen:

1. "Describe the gym to a friend in two sentences."
2. "What do you say to someone who is nervous about their first class?"
3. "What's a phrase or word you'd never want on your website?"
4. "Paste two Instagram captions or emails you've written that sound like you."
5. "Who is the reader you picture when you write — age, situation?"

Then rewrite `jeldon.config.ts → voice.persona`, add to `bannedPhrasings` and
`rules` from her answers, and save her two samples verbatim in
`docs/VOICE-SAMPLES.md` (this file is what `/article` reads to match her
voice). Read the result back to her in one paragraph: "Here's how I'll try to
sound." Adjust until she says yes.

Commit "Setup: voice".

## Stage 5 — Photos and logo (10 minutes)

The site works without photos, but photos of real people in her gym are the
single biggest trust signal. Run the `/photos` command here (read
`.claude/commands/photos.md`): it gives her one GitHub upload link that works
from her phone, and you do the resizing, alt text, and placement after she
says "done".

Ask if the logo file in `public/brand/logo-horizontal.webp` is current; if she
has a better one (SVG or PNG on transparent background), same upload steps.

Build, commit "Setup: photos".

## Stage 6 — Cloudflare (the one that makes it live) (20 minutes)

Follow `docs/ACCOUNTS.md` → **Cloudflare**, screen by screen. Dashboards
change; if what she sees doesn't match, ask her to read the menu names to you
and find the equivalent. Summary:

1. Create a free Cloudflare account (email + password; no card).
2. **Workers & Pages** → **Create** → **Import a repository** → Connect
   GitHub → pick `helix-training-site`.
3. Settings on that screen: Project name `helix-training-site`; Build command
   `npm run build`; Deploy command `npm run deploy:cf`. Click **Save and Deploy**.
4. Wait for the green check. She'll get a URL ending in `.workers.dev`.
   Ask her to paste it. Open it with WebFetch to confirm it's the site.
   Write it in `docs/PROGRESS.md`.
5. **Web Analytics**: Cloudflare left menu → **Analytics & Logs** → **Web
   Analytics** → **Add a site** → hostname `helixtrain.com` → copy the token
   from the snippet (the part after `"token":"`) → paste it here. It is not a
   secret; put it in `site.config.ts → analytics.cloudflareToken`.

From now on every commit you push deploys in about a minute. Tell her that.

## Stage 7 — Contact form plumbing (20 minutes)

The form needs at least one destination. Do Brevo first (email is what she'll
notice), then PushPress.

**Brevo** (`docs/ACCOUNTS.md` → Brevo): free account → verify her sender email
→ **SMTP & API** → **API Keys** → **Generate a new API key** → name it
`helix-website`.

> Important: don't paste the key here. Open Cloudflare in another tab →
> Workers & Pages → helix-training-site → **Settings** → **Variables and
> Secrets** → **Add** → type `BREVO_API_KEY`, choose **Secret**, paste the key
> → **Deploy**. Then add two plain variables: `LEAD_NOTIFY_TO` (her inbox) and
> `LEAD_NOTIFY_FROM` (the sender she verified in Brevo).

**PushPress API** (`docs/ACCOUNTS.md` → PushPress): developer.pushpress.com →
sign in with her PushPress login → **API Keys** → create one named
`website` → she'll see the key and a **company ID**. Same routine: add
`PUSHPRESS_API_KEY` (secret) and `PUSHPRESS_COMPANY_ID` (variable) in
Cloudflare. **Also** add both under **Settings → Build → Variables and
secrets** so the schedule page can read classes at build time.

Then test, together:
1. Trigger a redeploy (push an empty commit "Redeploy for secrets").
2. Run `npm run test:contact -- https://<her>.workers.dev`. Expect `{"ok":true}`.
3. Ask her to check the inbox, then PushPress → **People** (search "Website
   Test"). Both should show the test. If the email arrives but PushPress has
   nothing, the key or company ID is wrong; if neither, the redeploy hasn't
   finished — wait a minute and re-run. Each test creates a contact in
   PushPress; tell her she can delete it.
4. Optional, only if the schedule page should refresh itself nightly: in
   Cloudflare → the project → Settings → Build → **Deploy hooks** → create one
   → copy the URL → GitHub repo → Settings → Secrets and variables → Actions →
   New repository secret `CF_DEPLOY_HOOK`. The workflow in
   `.github/workflows/nightly-rebuild.yml` then rebuilds at 3 AM Pacific so
   "This week" on `/schedule/` never shows stale days.

## Stage 8 — Search Console and the schedule (10 minutes)

- The old site already has a Google Search Console verification tag (it's in
  `site.config.ts`). Ask her to open search.google.com/search-console and
  confirm she sees `helixtrain.com`. If she doesn't own it, note it for
  `/launch` (Jason can help transfer or re-verify).
- Open `https://<her>.workers.dev/schedule/` with WebFetch. If it shows a "This
  week" list, the PushPress key works at build time. If only the calendar
  embed shows, that's fine too — say so, note it.

## Stage 9 — Review together, then plan the launch

1. Run `npm run check:site`, `npm run doctor`, `npm run build`. Fix anything red.
2. Send her the `.workers.dev` link and ask her to click through every page on
   her phone. Collect changes; make them; push.
3. Offer the first article: "Want to write the first blog post now? Type
   `/article` and I'll ask you what you want to write about." The seed
   article `is-strength-training-safe-after-50.md` is a draft she can adopt,
   edit, or delete.
4. When she's happy: "The last step is pointing helixtrain.com at the new
   site. That one we do with Jason on the phone — type `/launch` when you've
   set a time." Update `docs/PROGRESS.md`.

## Things to never do in this wizard

- Never invent hours, prices, credentials, bios, or reviews.
- Never ask for or accept an API key, password, or card number in chat.
- Never touch DNS or the domain registrar.
- Never publish an article (`draft: false`) — that's `/publish`, after she reads it.
- Never push a build that fails.
