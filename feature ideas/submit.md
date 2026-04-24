# Submit

Operator-facing submit flow. Route: `/submit`.

## Ideas

- **A million ways to save a camp/activity.** Core principle: meet users wherever they encounter a camp in the wild and make capture one-tap. Brainstorm list — any/all of these could become input routes:
  - **Photo** (pic of a printed flyer, school handout, sign at a rec center) → OCR + LLM extract
  - **URL / link** (existing)
  - **Raw text paste** (from a newsletter, doc, or message)
  - **Digital receipt / confirmation email** (PDF, image, or raw email)
  - **Forward-to-email** (e.g., `save@kidtinerary.com` — user forwards any reg/promo email, we parse and add)
  - **Friend share via Kidtinerary** (someone in your network shared a camp → one tap to add to your planner)
  - **Screenshot** (from IG, FB group, text thread)
  - **Social share sheet** (iOS/Android "Share to Kidtinerary")
  - **Browser extension** (one-click add from any camp website)
  - **SMS / iMessage** (text a link or image to a Kidtinerary number)
  - **Voice capture** ("Add dinosaur camp at the Children's Museum July 14")
  - **QR code** on printed materials
  - **Agent-driven** (see cross-cutting: an agent parses email/docs and adds on your behalf)
  - **Calendar invite** (forward a Google/ICS invite to save the underlying camp)
  - Same destination (a created camp), different source material — all roads lead to structured data.

- **Browser extension: Pinterest-style pinning.** Expand on the extension idea above — not just "add to my planner" but pin any activity/event from any site into a personal catalog. Hover → pin button appears on camp/activity cards. Saved items land in a board-like view (possibly filterable by kid, season, or custom collections like "birthday ideas", "summer 2027", "rainy-day backups"). Feeds the same underlying camp data, but the *catalog* framing is a distinct mental model from the planner — more like a mood board / save-for-later.
