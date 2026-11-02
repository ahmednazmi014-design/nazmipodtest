# NAZMI POD

NAZMI POD is a password-protected delivery operations workspace for Nazmi Packaging Company (Pvt.) Ltd. It is intentionally blank of operational records. There is no public Owner signup: a server-side bootstrap provisions the requested Owner account, whose temporary password must be changed at first sign-in.

## What is implemented

- Private Owner bootstrap and username-or-email sign-in with salted password hashes, httpOnly sessions, and a server-enforced first-login password change.
- Role-based staff accounts for Owner, Director, Dispatch, Supervisor, Driver, Accounts, and Custom roles; staff can sign in with username and password, with email optional.
- Server-side delivery records with unique `NAZ-POD-YYYY-####` IDs, duplicate challan protection, assignment, Start delivery, Arrived, End delivery, partial delivery, failure, and cancellation states.
- Rider mobile workflow in English and Urdu with RTL layout, camera photo uploads, carton quantities, remarks, no-signature handover, and high-accuracy browser GPS tracking.
- Supervisor POD review, audit entries, live OpenStreetMap rider location, Karachi driving-route optimization/assignment through the Maps proxy, and authenticated PDFs with embedded proof photos.
- Empty-state dashboard and CSV export. No sample customers, drivers, vehicles, or deliveries are seeded.

## Development

- `pnpm dev`: development server; honors `PORT` (default 3000).
- `pnpm build` / `pnpm start`: build and serve `dist/index.js` and `dist/public/`.
- `pnpm check`: TypeScript diagnostics.
- `pnpm test`: application tests.

## Runtime data

The current backend uses an atomic JSON server store so the application works immediately without a database service. Set `NAZMI_DATA_FILE` or `NAZMI_DATA_DIR` to control its location. The runtime data file is ignored by Git and contains password hashes, sessions, deliveries, GPS, POD photos, settings, and audit history. Render's current Free service has no persistent disk; local JSON data can be lost when the service is rebuilt or restarted. Do not enter real delivery records until durable storage is configured.

For long-term Render production durability, mount a persistent disk at the configured data directory or replace the store with a managed database before scaling beyond one service instance. The bootstrap uses `NAZMI_BOOTSTRAP_USERNAME`, `NAZMI_BOOTSTRAP_OWNER_NAME`, and `NAZMI_BOOTSTRAP_PASSWORD`; set these only as server-side environment variables. The Maps proxy also requires its server-side configuration. Never commit runtime data, password values, or map credentials.

## Render

The existing Render service `nazmipodtest` tracks the `main` branch and auto-deploys on commit. Its build is `pnpm install && pnpm build`, and its start command is `pnpm start`. Health is available at `/api/health`; the route manifest is `/manus-routes.json`.
