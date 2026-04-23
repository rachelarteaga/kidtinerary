# Status indicators

## Ideas

- **Abbreviation or symbol for camp statuses.** Design a compact representation for *registered*, *waitlisted*, and *considering* — letter badge, icon, or color dot. Use in planner simple view and anywhere else space is tight. Full label stays in detail views.
  - **Icon direction picked 2026-04-23** (not yet wired):
    - *Registered* — `✓` check (either bare glyph or in a circle like V2 from the design preview)
    - *Waitlisted* — custom composite icon: **clipboard with list lines + clock badge bottom-right** (V2 style from the earlier icon preview: medium clock size, bottom-right, not overlapping — see git history for `src/app/design/status-picker/page.tsx` for reference SVG if needed)
    - *Considering* — `?` question mark
  - When we build the simple-view / compact status display, extract these into a shared `src/components/planner/status-icon.tsx` component.
