# Schedule

Shared/public schedule view. Routes: `/schedule`, `/schedule/[token]`.

## Ideas

- **Anon "Add to my activities" CTA on shared links.** When an anonymous user lands on a shared live link and selects a camp, show an "Add to my activities" CTA. Tapping it prompts log-in or sign-up; after auth the selected camp is already in their list (no re-entry). Converts share traffic into accounts and captures intent at the peak moment. Need to pass the pending camp through the auth flow (query param, session storage, or server-side "pending add" record) so it persists across signup.
- **Rich link preview when shared via text (mobile).** When a user shares a schedule/planner link via the native share sheet (iMessage, SMS, WhatsApp, etc.), the preview should render with a branded image and personalized text: *"Rachel Arteaga shared {planner name} with you"*. Requires proper OG / Twitter Card tags on the share URL route — dynamic `og:title` using the sharer's name + planner name, and a default `og:image` (branded card, possibly generated per-planner). Big lift for trust + virality: a bare URL preview reads as spam; a branded preview reads as a real invitation.
