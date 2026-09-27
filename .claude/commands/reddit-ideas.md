---
description: Mine Reddit and similar forums for the real questions people ask about gyms, strength training, and Corvallis, and turn them into an article idea list.
---

# /reddit-ideas — what people are actually asking

No Reddit account or API needed. Use WebSearch with queries like:

- "reddit corvallis gym", "reddit corvallis strength training", "reddit
  corvallis personal trainer"
- "reddit beginner strength training over 50", "reddit scared first gym class",
  "reddit crossfit vs personal training beginner", "reddit how many days a
  week strength training beginner", "reddit women strength training menopause
  bone density", "reddit knee pain squats beginner", "reddit gym anxiety"
- Subreddits that matter: r/Corvallis, r/fitness (the beginner questions),
  r/xxfitness, r/fitness30plus, r/AdvancedFitness (rarely), r/Strongman (no).

Open the promising threads with WebFetch. You're looking for the **question
underneath the post** and the phrases people use (those are the search terms).
Ignore anything medical-diagnostic or anything you couldn't answer as a coach.

Write `data/reddit/ideas-<date>.md`:

| # | Working title (a question) | Search phrase(s) people use | Category | Tags | Why it fits Helix | Evidence angle (what source you'd cite) |

Ten rows, best first. "Best" = lots of people ask it + we can answer it
honestly + it's close to what Helix sells. Mark any that are Corvallis-specific
(those rank fastest). Note thread URLs at the bottom so the reasoning can be
checked.

Then in chat: the top three as one line each, and "Type `/article <number>`
to write one." (`/article` reads this file.)

Rules: quote nothing from Reddit in an article. Never use a real person's
story from a thread. The list is inspiration, not content.
