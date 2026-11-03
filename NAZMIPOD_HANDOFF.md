# NazmiPOD — Manus handoff

**Updated:** 2026-11-03
**Repository:** https://github.com/ahmednazmi014-design/nazmipodtest
**Live URL:** https://nazmipodtest.onrender.com/
**Working branch:** `feature/nazmipod-ops-suite` (feature work only; not deployed to production)
**Production base:** `main` at `b33a2f4` — “Improve NazmiPOD auth, routing, GPS and POD evidence”

## Copy/paste prompt for the next Manus session

Continue work on the NazmiPOD app in `ahmednazmi014-design/nazmipodtest`. Fetch/check out `feature/nazmipod-ops-suite` before inspecting changes. The feature branch contains the current local work and this handoff. The Render production service is configured to auto-deploy commits to `main` only; do not merge or push to `main` until the storage issue below is resolved or the user explicitly accepts losing the app's current file-backed data. Do not expose, copy, or ask the user to resend the temporary Owner password. Never log passwords, photos, tracking tokens, or private delivery contents.

The user asked for an improved invoice/POD PDF, delivery calendar, bulk delivery import, multiple delivery photos, rider elapsed/dwell timing, availability checks, recurring schedules, partial-delivery follow-ups, staff POD notifications, offline driver sync, barcode scanning, a customer tracking page, and a handoff file. Use in-app notifications (no SMS/email credentials configured), a manual barcode entry fallback, and tokenized public tracking. The current feature branch has passed TypeScript, all unit tests, production build, and `git diff --check` in this workspace. Run the same checks again before release.

**Critical storage issue:** the app stores its records in a local JSON file via `server/store.ts`. Render confirmed the production web service is on the Free plan, has no attached persistent disk, and there is no Postgres instance in the confirmed workspace. The JSON filesystem is ephemeral; a redeploy/restart has already reset production state once. A deploy to `main` now can erase users and delivery records and can provision the Owner again from the still-configured bootstrap environment. The user has not explicitly accepted that data reset. Do not create a paid disk/database or change billing without explicit approval. Safest next step: obtain approval for a durable storage option, implement/configure and verify it, preserve/migrate any current data, then deploy and verify that records survive a restart. If the user instead explicitly accepts a reset, explain the consequence and get that exact confirmation before deploying.

## Changes on the feature branch

- **Operations:** added a delivery calendar with local-time day matching, month navigation, delivery details, a downloadable CSV template, validated import preview/confirmation (up to 200 rows), username-based optional driver assignment, and CSV export.
- **Scheduling:** added optional unit price, tax rate, and expected duration; added weekly/monthly repeated deliveries (up to 12) with explicit unique challan suffixes such as `-R02`; server-side checks reject overlapping bookings for the same Driver or vehicle across create, bulk import, recurrence, and follow-up operations.
- **Partial deliveries:** added a dispatch follow-up form that carries forward only the remaining undelivered cartons and requires a new challan and schedule.
- **Invoice/POD PDF:** added a branded structured invoice/POD with dispatched quantity, optional rate/tax/subtotal/total (no invented price), rider/start/arrival/completion/GPS details, remarks, and up to three embedded JPEG photos with capture time/GPS/note captions.
- **Driver workflow:** multiple photo selection (up to three, compressed), per-photo capture timestamp/current GPS/note, start/arrival/completion timestamps, live trip and at-stop timers, and a challan/carton scan panel. Camera scanning uses the browser `BarcodeDetector` when supported; manual/USB scanner entry remains available. The server prevents duplicate scans and limits scans to dispatched carton quantity.
- **Offline POD:** added a user-scoped IndexedDB outbox with idempotent submission IDs, automatic retry on reconnect, and retained evidence plus a visible warning when server data changed and a manual review is needed.
- **Notifications:** added in-app alerts when a POD is submitted, verified, or sent back for correction; authorized dispatch staff and the assigned rider receive relevant events.
- **Customer tracking:** added an expiring/revocable token link and a read-only `/track/:token` page with limited status, carton count, schedule, last update, and live rider location only while in transit. The route is registered in the SPA and the public page is marked `noindex`.
- **Tests:** added schedule conflict/month-end recurrence tests and PDF invoice/photo-caption tests.

## Validation recorded

- `pnpm check` — passed.
- `pnpm test` — passed, **19 tests** across 5 files.
- `pnpm build` — passed. Existing warnings remain for `/api/platform/config.js` (external script) and the ~524 kB main client chunk.
- `git diff --check` — passed.

## Release checklist

1. Inspect Render's exact current service and storage state; verify a durable store exists before deploying.
2. Decide and approve any recurring cost for a persistent disk or database. There is currently no database to migrate into.
3. Test migration/backup and a restart/redeploy retention check in a safe environment.
4. Test the public `/track/:token` route, revoke/expiry behavior, PDF download, photo metadata, camera scan on a supported mobile browser, offline sync, and delivery time calculations.
5. Only then merge/release to `main`; check `/api/health` and confirm existing data remains.
6. After durable storage is active, have Ahmed change the temporary password, then remove/rotate the bootstrap variables safely without resetting the store.

## Security notes

- The repository is public; the feature branch contains application code only. No temporary password value is written in this file or the code.
- Production bootstrap environment-variable **names** are `NAZMI_BOOTSTRAP_USERNAME`, `NAZMI_BOOTSTRAP_OWNER_NAME`, and `NAZMI_BOOTSTRAP_PASSWORD`; do not print or copy their values.
- Public tracking tokens are bearer links. Share only with the intended customer and revoke/regenerate if a link is exposed.
