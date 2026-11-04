# NAZMI POD — Outcome Checklist

## Core delivery operations

- [x] Dispatch can create a delivery with customer, destination, address, contact, challan, order/reference, product, carton quantity, scheduled date/time, assigned driver, vehicle, route, instructions and notes; each record receives a unique `NAZ-POD-YYYY-####` ID.
- [x] Delivery lifecycle is server-enforced as Scheduled, Assigned, Out for Delivery, Arrived, Delivered, Partially Delivered, Failed, and Cancelled, with duplicate challan blocking, timestamped audit history, unassigned visibility, and start/end actions.
- [x] Dispatch can optimize 1–23 selected Karachi stops for a driving loop, assign the suggested order to an active Driver, and open the route in Google Maps.
- [x] The delivery register provides month/day scheduling and validated bulk CSV import; the server rejects overlapping driver/vehicle bookings, supports weekly/monthly repeats with distinct challans, and creates linked follow-ups for undelivered quantities.
- [ ] Capture a specific reason whenever dispatch reschedules an existing delivery.

## Proof of delivery

- [x] Driver workflow stays simple: open the assigned delivery, see customer/address/challan/cartons, enter delivered cartons, optionally enter rejected/damaged cartons and a short note, optionally select proof photos, request GPS, and tap End delivery & submit POD. No customer signature is required.
- [x] Successful and partial submissions store carton handover evidence and enter POD review; authorized supervisors can verify or flag correction, with an audit record.
- [x] Authenticated POD PDFs contain delivery details, quantities, timestamps, driver context, GPS when available, remarks, and up to three uploaded JPEG photos with capture-time/GPS/note captions.
- [x] Redesigned the invoice/POD PDF with clear hierarchy, customer and delivery summary cards, a carton/rate/amount table, timestamped milestones and durations, proof/GPS notes, photo captions, page numbers, and optional pricing/tax totals only when entered. Customer signature remains optional/not required.

## Driver experience

- [x] Driver sees only assigned records, an active delivery, next work, route details, and clear Start delivery, GPS, and End delivery actions.
- [x] Driver workflow supports English and Urdu with RTL layout, mobile camera selection, Android Chrome/iPhone Safari browser controls, fresh high-accuracy GPS (`enableHighAccuracy`, `maximumAge: 0`, timeout), and stored accuracy in meters.
- [x] Driver proof can be queued in user-scoped IndexedDB with idempotent retries and retained evidence for manual resolution when server data changed; barcode scanning uses camera support where available and manual/USB fallback.
- [x] Multiple compressed POD photos can include capture time, GPS, and notes; rider start, arrival, and completion timestamps support trip and stop-duration calculations.

## Identity, permissions and administration

- [x] Public Owner signup is disabled. A private deployment bootstrap provisions the Ahmed / Ahsan Ahmed Owner account; staff sign in by username and password with email optional. Password change is optional.
- [x] Roles include Owner, Director, Dispatch, Supervisor, Driver, Accounts, and Custom; permission enforcement is server-side and drivers cannot access other assignments.
- [x] Owner Settings stores company name, address, phone, email, website, timezone, currency, and duplicate policy fields.
- [x] In-app alerts notify authorized staff when POD is submitted, verified, or returned for correction.

## Customer tracking

- [x] The public customer page uses expiring/revocable tokens and limits returned data to approved delivery status, schedule, carton progress, ETA/timeline, receipt confirmation/issue reporting, and live rider location only while in transit.

## Dashboard, analytics and audit

- [x] Owner Dashboard computes delivery, carton, pending verification, active, partial, failed, and staff metrics from actual server records and starts at zero.
- [x] Current overview includes the operations pulse, priority deliveries, workflow progress, and quick links; Owner Operations Center includes rider/assignment KPIs, dispatch readiness, and staff access.
- [x] Added a local-time seven-day schedule forecast, actionable attention list for late/unassigned/failed/partial/POD-review records, and per-rider delivered/trip/stop-time summaries based only on valid recorded timestamps, with honest empty states and English/Urdu labels.
- [x] Delivery table supports search, status filter, server-backed records, and CSV export; completed deliveries leave active tracking and route-planning choices but remain in POD/history.
- [x] Audit entries capture login, staff changes, delivery creation, status changes, GPS updates, proof submission, POD verification, PDF generation, settings updates, password resets, and session events.

## Data and release readiness

- [x] First launch is empty: no customers, drivers, vehicles, deliveries, or sample POD records are seeded. All operational data is added by the Owner.
- [x] Production `/api/health` reports `storage: "supabase"`; the application uses the private Supabase store when its server-only key is configured, with local atomic JSON retained as development/test fallback.
- [x] This dashboard/PDF branch passes TypeScript, all 26 tests, production build, whitespace checks, and a rendered sample invoice/POD preview; latest production health is Supabase-backed.
- [ ] Verify production Maps proxy configuration and test a real Karachi route before relying on optimized routes.
- [ ] Replace the temporary wordmark with the official company logo and enter confirmed company contact details in Settings.
