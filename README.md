# LEEPLUS คลังฟิล์มกันรอย

Independent film inventory deployment. The original ChatGPT Site remains available.

- Frontend: GitHub Pages at `/leeplus-film-stock/`; mobile route `/leeplus-film-stock/staff/`.
- API: `https://leeplus-film-stock-api.athiwatjc.workers.dev`.
- Database: Supabase project `leeplus-production`, only `film_stock_*` tables and functions.
- Database transport: `film-stock-bridge` Edge Function; authenticates a random Worker-only secret before calling service-role-only database functions. No shared LEEPLUS service key in frontend or Cloudflare source.
- Auth: registered phone only, as requested. Phone knowledge does not prove ownership. Sessions use separate per-tab bearer storage for admin/staff. Disabling a user revokes sessions.

## Build and test

`node scripts/build-film.mjs`

`node scripts/test-film-adapter.mjs`

Run the retained domain/count/stock test scripts for stock logic. Older Sites-specific cookie and bootstrap test scripts apply to the preserved original deployment, not this external host.

## Configuration

Cloudflare non-secret configuration is in `wrangler.jsonc`. Store `FILM_BRIDGE_KEY` as an encrypted Worker secret. Deploy the Edge template with the corresponding SHA-256 digest, never the raw credential, in `EXPECTED_HASH`. The bridge uses Supabase's server-managed `SUPABASE_SERVICE_ROLE_KEY` environment value. Never expose that key in Pages or GitHub.

## Data safety and cutover

The initial copy was exported from the original Site at 2026-10-20T16:30:36.452Z (23:30 Bangkok), source revision 83. Business arrays were compared with the imported snapshot and matched exactly. Login sessions were cleared for the new host. The original Site has independent storage; later transactions on either deployment are not automatically synchronized. Choose one deployment for real work after acceptance. Before final cutover, reconcile changes since the snapshot; do not overwrite either deployment blindly.

Database writes use an optimistic revision lease and one PostgreSQL transaction. Related product/carton/order/count/audit records are committed together. RLS is enabled on every film table; anon/authenticated roles have no table or function access. Existing non-film LEEPLUS tables are not modified.

For a full backup, use an authenticated backend transport to call `film_stock_read` and retain the result privately. Import only into a confirmed empty destination; the migration helper refuses overwrites. Do not commit inventory exports, phone numbers, or session tokens.

## Owner correction changes (prepared, not yet deployed)

The existing owner identity alone can delete mistaken records through the owner data menu. Admin and staff permissions remain unchanged. Deletions require a reason and exact record confirmation; the original record and actor remain archived. Stock-affecting records use compensating quantities, with dependent and later transactions requiring removal first. Historical audit is preserved. Carton, lot, order and count identifiers are not reused. No live records were deleted while developing this feature.

Run `npm test` for owner authorization, rollback and retained workflow checks. Deploy the matching Worker before publishing the new Pages frontend. Cloudflare connector currently returns Internal error; deployment is blocked pending restoration or an authorized browser fallback.
