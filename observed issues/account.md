# Account

Profile, sharing, and account settings. Routes: `/account`, `/account/profile`, `/account/sharing`.

## Issues

- **Share preferences: ambiguous revoke UX for 1:many planner→links** — when the same planner is shared with multiple people, each recipient appears as a row with the same planner name. No way to tell which row corresponds to which recipient, so revoking a specific person is guesswork. Needs design pass: show recipient identifier (email/name/label), maybe group by planner with per-recipient revoke, decide whether links are per-recipient or shared across recipients.
