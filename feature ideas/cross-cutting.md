# Cross-cutting

Ideas that span multiple product areas (navigation, auth, notifications, design system, etc.).

## Ideas

- **Logo, branding, and visual interest — sweep the whole product.** Kidtinerary needs (1) a real logo, (2) a signature brand moment (splash/loading/first-run — TBD), and (3) a pass on visual interest across every screen so the product feels owned and alive, not generic. Think: illustration, texture, motion, thoughtful empty states, micro-delight — surfaces that currently read as scaffolding should get identity.
- **Predictive address search everywhere.** Any input that accepts an address (kid home address, camp location, organization address, etc.) should use autocomplete/predictive search — not free-text. One shared component, consistent UX.
- **Stay AI-forward — design for agents, not just humans.** Kidtinerary should be a place where a user's AI agent can act on their behalf. Concrete examples:
  - Agent reads a registration confirmation email and flips the matching camp's status to *registered* (with dates, confirmation #, etc.).
  - Agent reads a "camp reg opens Jan 1" email and pins that date on the right camp in Kidtinerary.
  - Agent reads a waitlist/rejection/cancellation email and updates status accordingly.
  - **Implications:** stable identifiers for camps/sessions/user-camps, an API or MCP server exposing write actions (add camp, update status, set registration dates), authenticated agent access tokens, and a data model that's ergonomic for LLMs to parse emails into.
  - Product positioning: "bring your agent" — Kidtinerary is the structured scaffold, agents do the busywork.
