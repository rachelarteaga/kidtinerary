# Camp detail

Individual camp page (activity + sessions + locations).

## Ideas

- **Registration open/close alerts.** Notify users when a camp's registration window opens or closes. Requires new fields: `registration_start_date` and `registration_end_date`. Note: returning campers / membership holders often get an earlier start date, so the model needs to support *multiple* registration windows per camp (e.g., early + general), not a single pair of dates.

- **Per-camp share link** (deferred from account-menu MVP, April 2026). Share a specific camp with someone via a copyable link. The link should open a public camp detail page showing: org, camp name, location, registration link, description. Optional recommender note field on the share modal (e.g., "Rachel recommends: great for 5yo artists") that renders as a quote at the top of the camp page. Infrastructure already in place in `shared_schedules`: `scope='camp'`, `camp_id`, `recommender_note` columns; `createCampShare` server action; `/schedule/[token]` resolver already redirects camp-scoped tokens to `/camps/[campId]?share={token}`. **Blocker:** no public `/camps/[activityId]` route exists today. Building that page is the unlock — per-camp share then becomes a small UI task (modal + drawer trigger).
