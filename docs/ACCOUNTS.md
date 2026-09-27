# Account setup — click by click

These are the screens `/setup` walks the owner through. Written for the owner
to read too. Menus move around; if a screen doesn't match, describe what you
see and Claude adapts. **Rule for every account: API keys and passwords never
go in the chat.** They go straight into Cloudflare's secrets page.

---

## Cloudflare (hosting — free)

**Create the account**
1. cloudflare.com → **Sign up** → your business email + a password. No card.
2. Confirm the email.

**Connect the website**
1. Left menu → **Workers & Pages** → **Create** (blue button).
2. Choose **Import a repository** (under the Workers tab).
3. **Connect GitHub** → GitHub asks what Cloudflare may see → choose
   **Only select repositories** → pick `helix-training-site` → **Install & Authorize**.
4. Back in Cloudflare, click `helix-training-site`.
5. On the setup screen:
   - Project name: `helix-training-site`
   - Build command: `npm run build`
   - Deploy command: `npm run deploy:cf`
   - Leave the rest alone.
6. Click **Save and Deploy**. A log scrolls for a minute or two. When it says
   **Success**, there's a link ending in `.workers.dev`. That's the practice
   address of the new site. Copy it into the chat.

From now on, every change Claude makes appears at that address about a minute
later.

**Web Analytics (see how many people visit — no cookies, free)**
1. Left menu → **Analytics & Logs** → **Web Analytics** → **Add a site**.
2. Hostname: `helixtrain.com` → **Done**.
3. It shows a code snippet. Inside it is `"token":"...."`. Copy the long code
   between the quotes and paste it in the chat. (This one isn't secret.)

**Secrets (where API keys go)**
1. **Workers & Pages** → `helix-training-site` → **Settings** tab.
2. Find **Variables and Secrets** → **Add**.
3. Type the name exactly as Claude tells you (for example `BREVO_API_KEY`),
   choose **Secret** for keys and **Text** for plain values, paste the value,
   click **Deploy**.
4. Two of the names (`PUSHPRESS_API_KEY`, `PUSHPRESS_COMPANY_ID`) also need to
   go under **Settings → Build → Variables and secrets** so the schedule page
   can read your classes while the site is being built.

---

## Brevo (sends you an email when someone uses the contact form — free)

1. brevo.com → **Sign up free** → business email.
2. Confirm email. Skip the tour. If it asks about a company website, use
   helixtrain.com.
3. **Senders & IP** (under your name, top right, or Settings) → **Add a sender**
   → name `Helix Training`, email `website@helixtrain.com` (or any address on
   your domain you can receive at). Brevo emails a confirmation link to that
   address; click it. (If you can't receive at your domain yet, use your
   regular business email as the sender for now.)
4. Top right, your name → **SMTP & API** → **API Keys** tab → **Generate a new
   API key** → name it `helix-website` → **Generate**. Copy it.
5. Go put it in Cloudflare (see Secrets above) as `BREVO_API_KEY`. Then add two
   Text variables: `LEAD_NOTIFY_TO` = the inbox that should get messages, and
   `LEAD_NOTIFY_FROM` = the sender email you verified in step 3.

---

## PushPress API (puts website inquiries into your PushPress leads)

1. Go to **developer.pushpress.com** and sign in with your normal PushPress login.
2. Find **API Keys** → **Create key** (or **New API key**) → name it `website`.
3. PushPress shows you the key **once**, plus your **Company ID** (sometimes
   called location ID — a short code).
4. In Cloudflare secrets: `PUSHPRESS_API_KEY` = the key (Secret),
   `PUSHPRESS_COMPANY_ID` = the ID (Text). Add both in **both** places
   (Variables and Secrets, and Build → Variables and secrets).
5. If the developer portal asks you to "enable the Platform API" first, do
   that; if it says the API isn't available on your plan, tell Claude — the
   contact form works with Brevo alone, and the schedule page uses the
   PushPress calendar embed instead.

**Plan links (for the sign-up buttons)**
PushPress Control Panel → **Plans** → click a plan → **Landing page** / **Share**
→ copy the link (starts with `https://helixtraining.pushpress.com/landing/plans/`).
Paste each one in chat when Claude asks.

---

## Google Search Console (Google's report card for the site — free)

1. search.google.com/search-console → sign in with the Google account that
   owns the gym's Google Business Profile.
2. If `helixtrain.com` is already listed, you're done for now.
3. If not: **Add property** → **URL prefix** → `https://helixtrain.com` →
   **HTML tag** method → copy the `content="..."` code → paste it in the chat
   (not secret). Claude puts it in the site; after launch, click **Verify**.
4. After launch, Claude will ask you to submit the sitemap
   (`https://helixtrain.com/sitemap-index.xml`) under **Sitemaps**.

---

## Cloudflare Turnstile (optional spam shield on the contact form)

Only if spam becomes a problem. Cloudflare → **Turnstile** → **Add widget** →
hostname `helixtrain.com` → copy the **Site key** (paste in chat; not secret)
and put the **Secret key** in Cloudflare secrets as `TURNSTILE_SECRET_KEY`.
Both must be set together: the site key goes in `site.config.ts →
contactForm.turnstileSiteKey`; a secret key alone makes every submission fail.

---

## Domain registrar (only during /launch, with Jason)

Where `helixtrain.com` was bought. Jason finds it with a WHOIS lookup. The
owner logs in; Jason reads which records to change; Claude checks the result.
Email records are never touched.
