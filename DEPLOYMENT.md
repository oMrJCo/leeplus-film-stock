# Deployment status

Source is published at https://github.com/oMrJCo/leeplus-film-stock (2026-10-21).

- Worker and isolated film_stock_* Supabase tables: deployed and snapshot imported.
- Build and adapter integration tests: passed, including FIFO, scanning, admin final deduction, CORS and independent sessions.
- GitHub Pages: NOT LIVE YET. First workflow failed at configure-pages: Resource not accessible by integration. Repository administrator must set Settings > Pages > Build and deployment > Source to GitHub Actions once, then rerun the workflow.
- After activation, verify admin and staff routes and phone login on real browsers before cutover.
- Current environment HTTP probe to workers.dev returned Cloudflare 1010; prior authenticated API checks passed. Browser access must be verified before acceptance.

Snapshot: 2026-10-20 23:30:36 Bangkok, source revision 83. Reconcile changes in the old Site since that time before cutover. Do not overwrite either database blindly. The two deployments do not synchronize.

Original fallback remains https://leeplus-warehouse.beigetide16.chatgpt.site .
