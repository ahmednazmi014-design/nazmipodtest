# NAZMI POD

NAZMI POD is a password-protected delivery operations workspace for Nazmi Packaging Company (Pvt.) Ltd. It is intentionally blank on first launch: the Owner creates the first account, then adds staff, deliveries, and company settings.

## What is implemented

- First-run Owner setup and password sign-in with encrypted password hashes and httpOnly sessions.
- Role-based staff accounts for Owner, Director, Dispatch, Supervisor, Driver, Accounts, and Custom roles.
- Server-side delivery records with unique `NAZ-POD-YYYY-####` IDs, duplicate challan protection, assignment, Start delivery, Arrived, End delivery, partial delivery, failure, and cancellation states.
- Rider mobile workflow in English and Urdu with RTL layout, optional camera photo selection, carton quantities, remarks, no-signature handover, and high-accuracy browser GPS tracking.
- Supervisor POD review, immutable audit entries, live tracker data, and authenticated one-page PDF downloads.
- Empty-state dashboard and CSV export. No sample customers, drivers, vehicles, or deliveries are seeded.

## Development

- `pnpm dev`: development server; honors `PORT` (default 3000).
- `pnpm build` / `pnpm start`: build and serve `dist/index.js` and `dist/public/`.
- `pnpm check`: TypeScript diagnostics.
- `pnpm test`: application tests.

## Runtime data

The current backend uses an atomic JSON server store so the application works immediately without a database service. Set `NAZMI_DATA_FILE` or `NAZMI_DATA_DIR` to control its location. The runtime data file is ignored by Git and contains password hashes, sessions, deliveries, GPS, POD metadata, settings, and audit history.

For long-term Render production durability, mount a persistent disk at the configured data directory or replace the store with a managed database before scaling beyond one service instance. Never commit the runtime data file or password values.

## Render

The existing Render service `nazmipodtest` tracks the `main` branch and auto-deploys on commit. Its build is `pnpm install && pnpm build`, and its start command is `pnpm start`. Health is available at `/api/health`; the route manifest is `/manus-routes.json`.
