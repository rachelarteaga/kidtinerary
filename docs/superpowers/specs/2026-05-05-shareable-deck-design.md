# Shareable Kidtinerary Deck

A scrollable PDF deliverable Rachel can share with friends and other interested parties. Tells the story of what Kidtinerary is, the bets it makes, what's shipped, and what's coming.

## Goal

A single hosted PDF (linkable via URL, scrollable on phone) that conveys:

1. The product's value prop and the bets it makes
2. The current state, with screenshots and short explanations
3. Future feature ideas being pursued, and why

Tone: warm, founder-y, "look what I'm building." Polished enough for any interested party — friends, potential collaborators, investors — but not corporate.

## Format

- **Portrait PDF**, ~Letter aspect, **10 pages max**.
- Built as a styled HTML page in the repo (route `/deck` or a static `public/deck.html`), then printed to PDF.
- **Hosted** at `/public/kidtinerary-deck.pdf` so the share URL is `https://kidtinerary-sable.vercel.app/kidtinerary-deck.pdf`.
- **Visual system** comes from `src/app/globals.css` (palette + Outfit/Figtree fonts). The deck should feel like the product, not a generic pitch deck.
- One vertically-scrolled page per "slide" — reads cleanly on a phone.

## Framing — year-round, not summer-only

Kidtinerary is **a planner for everything in a kid's life** — camps, classes, after-school, weekends, school breaks. Summer camps are the **most-built example** today, not the whole product. The deck must avoid framing that boxes the product into one season.

## Page outline (10 pages)

| # | Section | Beat |
|---|---------|------|
| 1 | Cover | "Kidtinerary" wordmark + one-line tagline + Rachel as builder |
| 2 | The problem | Coordinating a kid's year is fragmented across emails, group chats, and tabs. One sentence per pain point. |
| 3 | What it is | Plain-English value prop. Year-round framing. Summer camp as the most-built example so far. |
| 4 | The bets | 3 product beliefs (e.g., AI-forward / agent-friendly; planning is a shared social act; structure beats chaos) |
| 5 | Planner | Hero screenshot + walk-through of how the planner works (drag-from-rail, week grid, statuses, share) |
| 6 | Catalog + Help-me-find | Screenshot + walk-through of personal master library + the AI help-me-find drawer (what you type, what it returns, how it lands in your catalog) |
| 7 | Kids + onboarding | Screenshot + walk-through of how a parent gets from signup → first kid profile → first planner entry |
| 8 | Sharing / Schedule | Screenshot + walk-through of the public schedule view (read-only link, anyone with the URL, anon-friendly) |
| 9 | What's next | **Curated future-feature roadmap** sourced from `feature ideas/`: collections (catalog → collections → planner), agent-friendly write API ("bring your agent"), planning with friends / linked planners, calendar view, predictive address search everywhere, rich link previews when shared via text. One line each, with the "why" preserved from the source notes. |
| 10 | Closing | Bigger vision (year-round) + product URL + Rachel contact (TBD per open question). |

Final ordering may shift slightly as the build comes together. 10 pages is the cap, not a target — fewer is fine if a section doesn't earn its keep.

### Per-screenshot pages (5–8): keep it tight

Hero screenshot dominates the page. Caption underneath — short and concrete, not narrated paragraphs:

- One line naming the surface and the core action it supports.
- Optionally one line on the design choice if it's surprising.

Target ~25–40 words total per page. The screenshot does most of the talking.

## Visual style

- **Palette** (from globals.css): cream/white background, ink/ink-2 text, hero yellow used sparingly (only for cover accent or one CTA), camp pastels for tag dots.
- **Fonts**: Figtree for display/headers, Outfit for body. Caps + tracking preserved where the product uses it (per Rachel's preference memory).
- **No left/side colored borders.** Carry color identity via dots/avatars/pills (per Rachel's preference memory).
- **Screenshots framed cleanly** — soft shadow, rounded corners, no fake browser chrome.
- **Generous whitespace.** Each page should feel breathable, not crammed.

## Screenshot strategy — dummy data

Rachel does **not** want her real account exposed in a sharable doc. Approach:

1. **Create one fake account on prod** via the existing signup flow. Email: a throwaway Rachel controls. Realistic-but-fake parent name (e.g., "Sam Rivera").
2. **Seed dummy data through the UI** (or via a one-off script that targets that user's `auth.uid()` only — to be decided in the plan):
   - 2 kids: **Nico** and **Luca** (Rachel's chosen names; everything else dummy — birthdays, photos, etc.).
   - 1 planner with 4–6 weeks filled across statuses (considering, waitlisted, registered).
   - 5–10 sample activities representative of year-round life: a summer camp, an after-school class, a weekend sports league, a school break program, a one-off event.
3. **Capture screenshots** by driving prod via Playwright on Rachel's controlled session — only after she's logged in once on the dummy account.
4. **Cleanup**: keep the dummy account around for future deck refreshes; no need to delete.

If seeding through the UI becomes painful, fall back to a small `scripts/seed-deck-account.ts` Node script that uses the Supabase service role key to insert rows scoped to the dummy account's `auth.uid()`. Service-role usage stays local — never committed in CI or run against another user's data.

## Build approach

1. Add a `public/deck/` directory or a Next.js route at `app/deck/page.tsx` that renders the deck as a single tall HTML page styled with the product's design tokens.
2. Capture the screenshots into `public/deck/screenshots/` via Playwright.
3. Print the rendered page to PDF (Chrome's `--print-to-pdf` headless command, or Playwright's `page.pdf()` API). Output to `public/kidtinerary-deck.pdf`.
4. Add a one-line npm script (`npm run build:deck`) so refreshing the deck later is trivial.

The HTML page can stay in the repo and remain linkable too (`/deck`) — but the **PDF is the deliverable** Rachel shares.

## Out of scope

- Slide animations / interactive web version beyond the static HTML.
- Investor-pitch artifacts (financials, TAM, market sizing). This is a story-of-the-product deck, not a fundraising deck.
- Testimonials, case studies, press logos.
- A custom logo. The current text-based wordmark is what's there; the deck won't manufacture a logo.
- Translations / localization.

## Open questions

- **Rachel's contact info on page 10**: which email/handle goes there? (Default: `rachelressner@gmail.com`, but check if she wants a different public-facing one.)
- **Tagline copy**: needs Rachel's voice. Draft will go in the implementation plan; she approves before paint dries.
