# NAZMI POD

NAZMI POD is a password-protected delivery operations workspace for Nazmi Packaging Company (Pvt.) Ltd. It supports dispatch staff, riders, supervisors, accounts, and customer-facing delivery tracking. The application starts without seeded operational records; the Owner account is provisioned server-side through bootstrap environment variables.

## Delivered operations

- Username-or-email sign-in with salted password hashes, httpOnly sessions, optional password change, active-session listing, and per-session revocation. A first sign-in is not blocked by a forced password-change screen.
- Role-based staff accounts for Owner, Director, Dispatch Manager, Dispatch Staff, Delivery Supervisor, Driver, Accounts, and Custom roles.
- Delivery lifecycle with unique challans, assignment, schedule conflict checks, recurrence, bulk CSV import/export, partial-delivery follow-ups, failure/cancellation states, live status history, and audit events.
- Rider workflow in English and Urdu with RTL support, destination map/directions, high-accuracy browser GPS, live trail, trip and dwell timing, carton scanning, camera barcode support where available, manual/USB scanner fallback, multiple POD photos, offline proof queue, and retry on reconnect.
- Customer tracking links that are tokenized, expiring, revocable, noindex, and passwordless for the customer. The page includes status, schedule, carton progress, timeline, estimated arrival, rider map while in transit, destination, receipt confirmation, and issue reporting.
- Supervisor POD review, staff notifications, live OpenStreetMap rider location, route optimization through the Maps proxy, branded invoice/POD PDFs with GPS/timing/photo evidence, and Urdu rider copy.

## Supabase production storage

The application uses a private Supabase row as its durable application store when both of these server-only variables are configured:

```text
SUPABASE_URL=https://oknmpelsuyhemaextbso.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<Supabase server-side service role key>
```

The `public.nazmi_pod_store` table has already been created in the connected Supabase project with RLS enabled and no anon/authenticated access policies. The server uses the service-role key only; never place it in client code, commit it, or expose it in logs. The app loads the state once at startup and queues writes to Supabase. A local atomic JSON file remains available for development and tests when the Supabase key is absent.

Before the first production release using Supabase, set the two variables in Render, deploy the feature branch in a safe environment, create one test record, restart/redeploy, and verify that the record remains. Do not remove the bootstrap variables until the Owner signs in successfully and sets an optional permanent password.

## Bootstrap variables

Set these only as server-side environment variables:

```text
NAZMI_BOOTSTRAP_USERNAME=<owner username>
NAZMI_BOOTSTRAP_OWNER_NAME=<owner display name>
NAZMI_BOOTSTRAP_PASSWORD=<initial owner password>
```

Bootstrap is idempotent and will not overwrite an existing Owner. Rotate or remove the bootstrap password after the first successful production sign-in. Never commit runtime data, passwords, service keys, map credentials, tracking tokens, or POD photos.

## Development

- `pnpm dev`: development server; honors `PORT` (default 3000).
- `pnpm build` / `pnpm start`: build and serve `dist/index.js` and `dist/public/`.
- `pnpm check`: TypeScript diagnostics.
- `pnpm test`: application tests.

## Render

The Render service `nazmipodtest` currently tracks `main`; this feature work is on `feature/nazmipod-ops-suite` and is not deployed by this branch. Its build is `pnpm install && pnpm build`, and its start command is `pnpm start`. Health is available at `/api/health`; it reports `storage: "supabase"` only when the server-side Supabase key is configured. The route manifest is `/manus-routes.json`.

For release, merge or deploy the feature branch only after configuring Supabase in Render and completing the restart-retention check. Do not create a paid disk or change billing as part of this code change.
