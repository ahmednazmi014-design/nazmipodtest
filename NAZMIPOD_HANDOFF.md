# NazmiPOD — Manus handoff

**Updated:** 2026-11-03
**Repository:** https://github.com/ahmednazmi014-design/nazmipodtest
**Live URL:** https://nazmipodtest.onrender.com/
**Working branch:** `feature/nazmipod-ops-suite` (feature work only; not deployed to production)
**Production base:** `main` at `b33a2f4` — “Improve NazmiPOD auth, routing, GPS and POD evidence”

## Copy/paste prompt for the next Manus session

Continue work on the NazmiPOD app in `ahmednazmi014-design/nazmipodtest`. Fetch/check out `feature/nazmipod-ops-suite` before inspecting changes. The feature branch contains the current local work and this handoff. Render auto-deploys `main` only. The user explicitly approved continuing on the feature branch only. Do not merge or deploy until Supabase server credentials are configured and restart retention is verified. Do not expose, copy, or ask the user to resend the temporary Owner password. Never log passwords, photos, tracking tokens, or private delivery contents.

The user asked for an improved invoice/POD PDF, delivery calendar, bulk delivery import, multiple delivery photos, rider elapsed/dwell timing, availability checks, recurring schedules, partial-delivery follow-ups, staff POD notifications, offline driver sync, barcode scanning, a customer tracking page, a rider destination map, customer ETA/timeline/confirmation/issues, session controls, and a handoff file. Use in-app notifications (no SMS/email credentials configured), a manual barcode entry fallback, and tokenized public tracking. The current feature branch has passed TypeScript, all unit tests, production build, and `git diff --check` in this workspace. Run the same checks again before release.

**Storage status:** the connected Supabase project is active and now has a private `public.nazmi_pod_store` JSONB table with RLS enabled and no anon/authenticated policies. The server uses it when `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are configured; otherwise it retains the local JSON fallback for development/tests. Do not merge or deploy until the Render service has the server-only service key, a test record survives a restart/redeploy, and the current production data migration plan is confirmed. Do not create a paid disk or change billing without explicit approval.

## Changes on the feature branch

- **Operations:** added a delivery calendar with local-time day matching, month navigation, delivery details, a downloadable CSV template, validated import preview/confirmation (up to 200 rows), username-based optional driver assignment, and CSV export.
- **Scheduling:** added optional unit price, tax rate, and expected duration; added weekly/monthly repeated deliveries (up to 12) with explicit unique challan suffixes such as `-R02`; server-side checks reject overlapping bookings for the same Driver or vehicle across create, bulk import, recurrence, and follow-up operations.
- **Partial deliveries:** added a dispatch follow-up form that carries forward only the remaining undelivered cartons and requires a new challan and schedule.
- **Invoice/POD PDF:** added a branded structured invoice/POD with dispatched quantity, optional rate/tax/subtotal/total (no invented price), rider/start/arrival/completion/GPS details, remarks, and up to three embedded JPEG photos with capture time/GPS/note captions.
- **Driver workflow:** multiple photo selection (up to three, compressed), per-photo capture timestamp/current GPS/note, start/arrival/completion timestamps, live trip and at-stop timers, and a challan/carton scan panel. Camera scanning uses the browser `BarcodeDetector` when supported; manual/USB scanner entry remains available. The server prevents duplicate scans and limits scans to dispatched carton quantity.
- **Offline POD:** added a user-scoped IndexedDB outbox with idempotent submission IDs, automatic retry on reconnect, and retained evidence plus a visible warning when server data changed and a manual review is needed.
- **Notifications:** added in-app alerts when a POD is submitted, verified, or sent back for correction; authorized dispatch staff and the assigned rider receive relevant events.
- **Customer tracking:** added an expiring/revocable token link and a passwordless `/track/:token` page with status, carton count, schedule, destination, ETA, timeline, receipt confirmation, issue reporting, and live rider location only while in transit. The route is registered in the SPA and the public page is marked `noindex`.
- **Supabase durability:** added the private Supabase state adapter, startup load, queued writes, health storage reporting, and the `create_nazmi_pod_store` migration in the connected project.
- **Account security:** removed forced first-login password blocking and added optional password change plus active-session listing/revocation.
- **Tests:** added schedule conflict/month-end recurrence tests and PDF invoice/photo-caption tests.

## Validation recorded

- `pnpm check` — passed.
- `pnpm test` — passed, **19 tests** across 5 files.
- `pnpm build` — passed. Existing warnings remain for `/api/platform/config.js` (external script) and the ~524 kB main client chunk.
- `git diff --check` — passed.

## Release checklist

1. Add `SUPABASE_SERVICE_ROLE_KEY` and, optionally, `SUPABASE_URL=https://ahqisqsadtgifuzpygim.supabase.co` to Render server environment variables; never add the key to the repository or client.
2. Run the feature branch in a safe environment, create one test delivery, restart/redeploy, and confirm `/api/health` reports `storage: "supabase"` and the record remains.
3. Decide how any existing JSON production records should be imported before the first Supabase-backed release; do not silently discard them.
4. Test the public `/track/:token` route, revoke/expiry behavior, ETA/timeline, customer confirmation/issues, rider destination map, PDF download, photo metadata, camera scan on a supported mobile browser, offline sync, and delivery time calculations.
5. Only then merge/release to `main`; check `/api/health` and confirm existing data remains.
6. After the Owner signs in successfully, rotate/remove bootstrap variables if desired. Password change is optional and is not forced by the application.

## Security notes

- The repository is public; the feature branch contains application code only. No temporary password value is written in this file or the code.
- Production bootstrap environment-variable **names** are `NAZMI_BOOTSTRAP_USERNAME`, `NAZMI_BOOTSTRAP_OWNER_NAME`, and `NAZMI_BOOTSTRAP_PASSWORD`; do not print or copy their values.
- Public tracking tokens are bearer links. Share only with the intended customer and revoke/regenerate if a link is exposed.
