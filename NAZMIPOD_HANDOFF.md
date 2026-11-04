# NazmiPOD — Manus handoff

**Updated:** 2026-11-04
**Repository:** https://github.com/ahmednazmi014-design/nazmipodtest
**Live app:** https://nazmipodtest.onrender.com/
**Release branch:** `feature/dashboard-sections-pod-pdf` (based on `main` commit `e902343`; this branch contains the latest dashboard/PDF polish)

## Current production state

The app is reachable. `/api/health` reports `storage: "supabase"`; production state is using the private Supabase store, not the local JSON fallback. Render watches `main`. The Owner bootstrap is configured server-side; never print, commit, or ask the user to resend its credential values. There are no sample operational records.

## Current product features

The authenticated app includes a bilingual English/Urdu dispatch workspace; calendar scheduling and previewed bulk CSV imports; driver/vehicle overlap checks, recurring deliveries and linked partial-delivery follow-ups; offline POD queueing with idempotent sync; barcode scan with manual fallback; multiple compressed photos with capture time/GPS/note; rider start/arrival/completion timings; in-app POD review notifications; and an expiring, revocable, token-only customer tracking page. Public tracking links expose limited delivery status and in-transit location, not contact information or driver identity.

The Owner dashboard now has a local-time seven-day schedule forecast, a dispatch attention list for late/unassigned/failed/partial/POD-review records, and last-30-day per-rider delivery/trip/stop-time summaries. Averages exclude missing or invalid timestamps, and new dashboard sections have English and Urdu labels with empty states.

The invoice/POD PDF has a branded customer/delivery summary, carton/rate/amount table, optional price/tax calculations with grouped currency values, local-time handover milestones, elapsed/stop durations, proof/GPS notes, photo evidence captions, page numbers, and no required customer signature. Long item names are conservatively wrapped to fit the fixed item column; oversized photo notes continue on separate pages, with photos kept below their captions.

## Validation

- `pnpm check` — passed.
- `pnpm test` — passed, **26 tests across 5 files**, including regressions for tall-photo placement, long item names, note continuation, pricing, timing, and tracking/scheduling routes.
- `pnpm build` — passed.
- `git diff --check` — passed.
- A synthetic, non-customer invoice/POD PDF was rendered and visually inspected. The build still emits a non-blocking external-script notice for `/api/platform/config.js` and a main-chunk-size warning (>500 kB).

## Release and follow-up

The user approved a quick release of the dashboard/PDF polish. Render watches `main`; after a fast-forward push, confirm the live homepage and `/api/health`. Do not change environment variables or database resources as part of this release. Maps proxy configuration and a real Karachi route have not yet been verified.

## Security notes

Never put passwords, service-role keys, session cookies, private delivery contents, customer tracking tokens, or proof-photo payloads in commits/logs. Customer tracking tokens are bearer links: share only with the intended customer and revoke/regenerate if exposed. The public customer route is no-index and read-only.
