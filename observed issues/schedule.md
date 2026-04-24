# Schedule

Shared/public schedule view.

## Issues

- **Live share link returns 404 for recipient** — Rachel sent a live dashboard/schedule link to a friend; friend clicked and got a 404 page. Reproduce and root-cause: check share-token generation, recipient-facing route resolution, whether the token is being persisted correctly, auth/middleware redirect, and whether revoked/expired links render 404 vs. a friendlier "link unavailable" page.
