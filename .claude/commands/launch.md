---
description: Cutover checklist — point helixtrain.com at the new site, with Jason on the call, and verify everything after.
---

# /launch — go live on helixtrain.com

Follow `docs/LAUNCH.md`. This is a two-person step: the owner and Jason
(Dr. Jason Young) on a call, you driving. Do not start until she confirms
Jason is with her.

## Before the call (you, alone)

- Run `/benchmark`. Every dimension must be "new ≥ old". If any is behind,
  fix it first; launch waits. Attach the scorecard to `docs/PROGRESS.md`.

- `npm run check:site` — no errors. `npm run build` green. `/audit` mode B clean.
- Confirm the contact form works on the `.workers.dev` URL (`npm run test:contact`).
- Confirm `public/_redirects` covers every URL in `docs/OLD-URLS.md`.
- WebFetch the old site's sitemap (`https://www.helixtrain.com/sitemap.xml`)
  and make sure each URL there has a matching new page or a redirect.
- Write the plan into `docs/PROGRESS.md` and tell her what will happen.

## On the call

1. **Where is the domain?** Ask Jason to run a WHOIS (lookup.icann.org) for
   `helixtrain.com` and read the registrar. The owner logs in there.
2. **Add the domain to the Cloudflare project**: Cloudflare → Workers & Pages →
   helix-training-site → **Settings** → **Domains & Routes** → **Add** →
   **Custom domain** → `helixtrain.com`, then again for `www.helixtrain.com`.
   Cloudflare shows the DNS records it needs.
3. **Two paths, Jason picks:**
   - **Easiest long-term:** move DNS to Cloudflare (Cloudflare → Add a site →
     `helixtrain.com` → free plan → it lists existing records → at the
     registrar, change nameservers to the two Cloudflare gives). Takes minutes
     to hours. Then the custom domain step above just works.
   - **Minimal change:** keep the current DNS host and add the records
     Cloudflare showed (a CNAME for `www` and the root record it specifies).
   Either way: **keep every MX and email-related record exactly as it is.**
   Email must keep working. Read them back before saving.
4. Lower TTLs first if the DNS host allows it; wait; then change records.
5. Watch: WebFetch `https://helixtrain.com/` every few minutes until the new
   site answers (the old Webflow footer says "Site by PushPress"; the new one
   doesn't). Both `www` and root must work and redirect to one canonical
   (root, per `jeldon.config.ts → brand.siteUrl`).

## Right after

- WebFetch 10 old URLs from `docs/OLD-URLS.md` — each must 301 to the right page.
- Search Console: **Sitemaps** → submit `https://helixtrain.com/sitemap-index.xml`.
  URL Inspection on the home page → **Request indexing**.
- Google Business Profile: website field → `https://helixtrain.com/`; add the
  free-class link as the "Appointment" link.
- PushPress: any "website" links in emails/automations → new URLs.
- Instagram/Facebook bio links → `https://helixtrain.com/free-class/`.
- Cloudflare Web Analytics: confirm data is arriving (visits > 0 next day).
- Old Webflow site: ask her to leave it up but unpublished for 30 days if
  PushPress allows; if it's bundled in her PushPress plan, ask PushPress to
  turn off the Webflow site only after redirects are confirmed.

## The next day

`npm run test:contact -- https://helixtrain.com`, check the email and the lead
landed. WebFetch the home page and one article. Search "Helix Training
Corvallis" and confirm the new site appears. Update `docs/PROGRESS.md`:
**Launched <date>**. Then say congratulations, and mean it.
