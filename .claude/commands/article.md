---
description: Write a new blog article in the owner's voice — researched, sourced, scored by the content engine, saved as a draft for her review.
---

# /article — draft a blog post

Read `CLAUDE.md`, `jeldon.config.ts` (voice, content, scoring, citation), and
`docs/VOICE-SAMPLES.md` if it exists. The output is a Markdown file in
`src/content/articles/` with `draft: true`. Only `/publish` makes it live.

## 1. Pick the topic (with her, briefly)

If she gave a topic in the command (`/article knee pain and squats`), use it.
Otherwise offer three from `data/reddit/ideas-*.md` (newest) or, if none, three
you propose from the `aeo.querySet` and `content.tags` in `jeldon.config.ts`.
One message, three bullets, "which one, or something else?"

Then ask exactly two questions:
1. "What do you actually tell people about this in the gym?" (her real take —
   this is what makes it hers)
2. "Anything you want to make sure is in it, or kept out?"

## 2. Research (you, silently)

- WebSearch the topic. Prefer primary sources: PubMed, Cochrane, ACSM, NSCA,
  CDC, APTA, university pages. Aim for 3–5 references.
- Open each source with WebFetch and note the specific finding you'll cite,
  with numbers where they exist. If a source doesn't say it, don't cite it.
- Check what the top three ranking pages for the query do, so the article can
  be clearly better: more specific, more local, more honest, more useful.

## 3. Write it

Follow `voice.persona` and `voice.rules` exactly. Structure that scores well
**and** reads well (both matter; voice wins ties):

- Title 40–60 characters that contains the question people search.
- `excerpt` 120–160 characters that answers the question in one line.
- Open by answering the question in the first two sentences.
- 800–1,500 words. Reading level grade 6–9 (short sentences, common words).
- 3–6 H2s written as questions where natural ("How often should…?").
- First person from the gym floor: "when I coach", "in our gym", "our members".
- Real numbers from the sources, stated plainly. One short attributed quote
  from a source is good; a fake quote is a firing offense.
- Two internal links (`/programs/...`, `/free-class/`, `/faq/`, another `/blog/...`).
- One plain next step at the end.
- A `## References` section: `Author or org, year. Description. [link](URL)`.
- Frontmatter: `category` from `content.categories`, 3–6 `tags` from
  `content.tags`, `author`/`authorSlug` = Kathy, `draft: true`,
  `publishDate` = today, `docNotes: "Drafted by /article on <date>; sources verified <date>"`.
- General education framing. No diagnosis, no "cure", no supplement pitches.

## 4. Verify and score (you)

```
npm run check:frontmatter -- src/content/articles/<slug>.md
npm run check:citations   -- src/content/articles/<slug>.md
npm run check:geo         -- src/content/articles/<slug>.md
```
Also run the SEO scorer directly (see `docs/JELDON.md` → "Score one file") and
look at the `meh`/`bad` checks. If GEO is below the category target, improve
the weak check **without** flattening the voice — add a real statistic, a
question heading, a first-person line. If a fix would make it sound like a
textbook, leave the score where it is and say so.

Re-open every reference link one more time. Confirm each says what the
article says it says.

## 5. Hand it to her

Commit the draft ("Draft: <title>"). Then, in chat:

- The title and excerpt.
- The full article text (so she can read it right here — she may be on her phone).
- A three-line scorecard in plain words: "Search readiness: good. AI-citation
  readiness: 86 (target 85). Reading level: grade 7."
- "Read it like a member would. Tell me anything that doesn't sound like you
  and I'll change it. When it's right, type `/publish <slug>`."

Apply her edits as conversation ("make the second section shorter", "I'd never
say 'optimize'"). Each round: edit, re-score, show the changed part only.

## Never

- Never publish. Never set `draft: false` here.
- Never cite a source you haven't opened.
- Never invent a member story. General framing only, unless she gives you a
  real one and says it's okay to use.
- Never name a competitor gym critically.
