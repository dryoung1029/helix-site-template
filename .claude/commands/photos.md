---
description: Add photos to the site — the owner uploads from her phone or computer through one GitHub link; Claude resizes, writes alt text, and places them.
---

# /photos — get real photos onto the site

Photos of the real gym are the biggest trust signal on the site. The owner
does the uploading herself through GitHub's upload page; you do everything
after that. She never needs a terminal or a file manager.

## 1. Find her repo address (once)

Run `git remote get-url origin` and turn it into the upload link:
`https://github.com/<owner>/<repo>/upload/main/public/photos`
(for example `https://github.com/kathylynch/helix-training-site/upload/main/public/photos`).
Save it in `docs/PROGRESS.md` under "Photo upload link" so next time is faster.

## 2. Tell her exactly this (adjust the link)

> Here's how to add photos. Works from your phone or computer:
>
> 1. Open this link (you may need to sign in to GitHub):
>    **<upload link>**
> 2. Tap **choose your files** (on a computer you can also drag photos onto
>    the page). Pick 5–10 photos: the gym floor, a class in progress, a
>    coach working with someone, the front door, the sign.
> 3. Wait for the little progress bars to finish.
> 4. Scroll down and tap the green **Commit changes** button.
> 5. Come back here and say **done**.
>
> Phone photos are fine; I'll shrink them so the site stays fast.

If she says the link asks her to create a fork or shows "You don't have
permission", she's signed into the wrong GitHub account — the one that owns
the repo is the one she created in START-HERE.

## 3. When she says done

1. `git pull`. Confirm new files landed in `public/photos/`. If nothing new,
   ask her whether the green Commit button was pressed (the most common miss).
2. `npm run photos` — resizes to ≤1600px wide, converts to WebP, keeps the
   originals in `public/photos/originals/`.
3. For each photo, look at it (Read the file) and ask her one short question
   only if you can't tell what it is: "Is this the Strength+ class?" Write
   descriptive alt text (what's in the picture, who, doing what — no keyword
   stuffing).
4. Place them — propose, don't ask about each:
   - Home hero: the best wide shot of the floor with people in it →
     `site.config.ts → heroPhoto` (src `/photos/<name>.webp`, alt).
   - Program pages (`heroImage` / `heroImageAlt` in each program file):
     the photo that matches the program.
   - Coaches (`photo` / `photoAlt` in each coach file): headshots or
     "coach working with a member" shots. Crop to square if needed
     (`sharp` is available; add a `--square` option to
     `scripts/optimize-photos.mjs` if you need it).
   - About page and the free-class page: one each.
   - `public/brand/og-default.jpg`: replace the logo-only social image with
     the hero photo plus the logo, if she likes it.
5. `npm run build`, commit "Add photos", push. Show her the practice URL and
   list where each photo went in one line each. Ask if any should move.

## Rules

- Only photos she uploaded or explicitly sent. Never stock images, never
  images pulled from her social accounts or Google without her saying so.
- If a photo shows a member's face, ask once: "Is everyone in this photo okay
  being on the website?" Skip any she's unsure about.
- Keep originals; never delete her uploads.
- The logo is always her image file. If she sends a new logo, replace
  `public/brand/logo-horizontal.webp` and regenerate `favicon.png` and
  `apple-touch-icon.png` from it (`npm run icons`). Never redraw it.
