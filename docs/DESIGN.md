# Design rules

So new pages look like they belong. Tokens live in `src/styles/global.css`.

- **Logo and icons** are the owner's image files, never redrawn: header and
  footer use `public/brand/logo-horizontal.webp`; the favicon and touch icon
  are cropped from it. Don't recreate the mark in SVG or CSS.
- **Colors.** Blue `#008abd` does the work (links, structure, secondary
  buttons). Red `#ec222d` is spent once per page: the free-class button. Charcoal text on white; dark mode is automatic and there's a
  toggle in the header.
- **Type.** One family, Nunito (matches the logo's rounded letterforms).
  Weights: 400 body, 700 emphasis and nav, 800 headings. Size scale is fluid
  (`--step-*`). Line length capped at 66 characters (`--measure`).
- **Layout.** Left-aligned. `.container` (max 72rem) and `.section` spacing.
  `.split` for two-column content on wide screens. Cards only where a thing is
  genuinely a card (pricing plans, member links); programs are a list with
  rules, not cards.
- **Buttons.** `.btn--primary` (red) = the one action we want. `.btn--blue` =
  secondary actions (sign up for a plan). `.btn--ghost` = everything else.
- **FAQ** uses native `<details>`; every FAQ block also emits FAQPage JSON-LD.
- **No motion** except things the user opens. Reduced-motion is respected.
- **Every page** sets a unique title (aim for 40–60 chars; short page names are fine) and description (120–160),
  passes breadcrumb JSON-LD, and has exactly one H1.
- **Images**: WebP, sized, lazy below the fold, descriptive alt text. Photos of
  real people in the real gym beat stock every time; no stock photos.
- **Copy**: sentence case, plain verbs, no ALL-CAPS labels, no "→" on links.
  The site talks the way Kathy talks on the floor.
