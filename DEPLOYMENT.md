# Deployment status

Source: https://github.com/oMrJCo/leeplus-film-stock
Admin: https://omrjco.github.io/leeplus-film-stock/
Staff: https://omrjco.github.io/leeplus-film-stock/staff/

GitHub Pages activated and the film-stock workflow successfully rerun on 2026-10-21. It publishes public/, replacing the temporary README page. A live browser verified the application phone-login screen and successful initial API response. Registered-phone authentication and full workflows still need acceptance on real staff devices; camera/label printer tests require actual hardware.

Worker and isolated film_stock_* Supabase tables are deployed. The build and adapter integration tests passed, including FIFO, scanning, final admin stock deduction, CORS and independent sessions. Prior live API checks compared migrated business resources against the source snapshot exactly.

Snapshot: 2026-10-20 23:30:36 Bangkok, source revision 83. Reconcile any work in the original Site since then before cutover. Do not overwrite either database blindly. The two deployments do not synchronize.

Original fallback remains https://leeplus-warehouse.beigetide16.chatgpt.site .
