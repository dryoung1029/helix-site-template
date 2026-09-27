# Your website, in plain English

A map of what's where, so you can ask Claude for changes in your own words.
You never need to open these files yourself.

## The pages

| Page | Address | What's on it |
|---|---|---|
| Home | `/` | The big pitch, the three reasons, the program list, how to start, reviews, FAQ, map |
| Programs | `/programs/` | The five programs. Each has its own page under `/programs/...` |
| Schedule | `/schedule/` | This week's classes (from PushPress) and the booking calendar |
| Pricing | `/pricing/` | Memberships, punch cards, drop-in, with Sign up buttons |
| Coaches | `/coaches/` | Everyone on the team with a bio and photo |
| Blog | `/blog/` | Articles. Only published ones show |
| Free class | `/free-class/` | The page everything points to. How the free class works + the booking button |
| Contact | `/contact/` | The form, phone, email, map |
| FAQ, About, Members | `/faq/`, `/about/`, `/members/` | Questions, the story, links for current members |

## Where the facts live

- **Hours, phone, email, prices, sign-up links, social links** → one file,
  `site.config.ts`. Say "change Saturday hours to 8–11" and Claude edits it.
- **Program descriptions** → one file per program in `src/content/programs/`.
- **Coach bios** → one file per coach in `src/content/coaches/`.
- **FAQ questions** → `src/content/faqs.json`.
- **Blog articles** → one file per article in `src/content/articles/`.
  An article with `draft: true` is invisible to visitors.
- **Photos** → type `/photos`. Claude gives you one link; you pick photos from
  your phone or computer, tap Commit, say "done". Claude shrinks them, writes
  the descriptions, and puts them on the right pages.
- **Who you are, how you write, what the articles should sound like** →
  `jeldon.config.ts`. Claude fills this in during `/setup`.

## How a change goes live

1. You ask Claude for the change.
2. Claude edits the file, checks that the site still builds, and saves ("commits") it.
3. Cloudflare notices and rebuilds the site. About a minute.
4. You refresh the page.

Nothing you ask for can break the live site without Claude noticing first,
because the site is rebuilt from scratch every time and a broken build doesn't
go out.

## What the "scores" mean

When Claude writes an article it reports two numbers:

- **Search readiness** — title length, description, headings, links, reading
  level. Google basics.
- **AI-citation readiness (GEO)** — does the article have the things AI
  answer engines (ChatGPT, Perplexity, Google's AI answers) tend to quote:
  real statistics, a source you can click, a coach's first-person experience,
  headings phrased as questions. Each article has a target (70–85 depending on the
  type). Below target, Claude improves it; but your voice always wins over the number.

## Things that need you

- Approving every article before it goes live (`/publish`).
- Confirming any business fact (hours, prices, dates).
- Clicking around in Cloudflare, Brevo, PushPress when Claude asks.
- The domain switch, with Jason.

## Things you never have to do

- Use a terminal. Run commands. Edit code. Fix a broken build. Remember file names.
