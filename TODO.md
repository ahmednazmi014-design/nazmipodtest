# NAZMI POD — Outcome Checklist

## Core delivery operations

- [x] Dispatch can create a delivery with customer, destination, address, contact, challan, order/reference, product, carton quantity, scheduled date/time, assigned driver, vehicle, route, instructions and notes; each record receives a unique `NAZ-POD-YYYY-####` ID.
- [x] Delivery lifecycle is server-enforced as Scheduled, Assigned, Out for Delivery, Arrived, Delivered, Partially Delivered, Failed, and Cancelled, with duplicate challan blocking, timestamped audit history, unassigned visibility, and start/end actions.
- [ ] Add calendar scheduling, route sequencing, vehicle availability checks, rescheduling reasons, and linked follow-up deliveries for partial quantities.

## Proof of delivery

- [x] Driver workflow stays simple: open the assigned delivery, see customer/address/challan/cartons, enter delivered cartons, optionally enter rejected/damaged cartons and a short note, optionally select proof photos, request GPS, and tap End delivery & submit POD. No customer signature is required.
- [x] Successful and partial submissions store carton handover evidence and enter POD review; authorized supervisors can verify or flag correction, with an audit record.
- [x] Authenticated one-page POD PDFs contain delivery details, quantities, timestamps, driver context, GPS when available, photos metadata, and remarks.

## Driver experience

- [x] Driver sees only assigned records, an active delivery, next work, route details, and clear Start delivery, GPS, and End delivery actions.
- [x] Driver workflow supports English and Urdu with RTL layout, mobile camera selection, Android Chrome/iPhone Safari browser controls, fresh high-accuracy GPS (`enableHighAccuracy`, `maximumAge: 0`, timeout), and stored accuracy in meters.
- [ ] Add durable offline evidence states and conflict-aware sync once an offline storage and sync policy is approved.

## Identity, permissions and administration

- [x] First-run Owner setup creates an Owner password account without hardcoded credentials; Owner can create staff, reset passwords, activate/deactivate access, and manage sessions.
- [x] Roles include Owner, Director, Dispatch, Supervisor, Driver, Accounts, and Custom; permission enforcement is server-side and drivers cannot access other assignments.
- [x] Owner Settings stores company name, address, phone, email, website, timezone, currency, and duplicate policy fields.

## Analytics, reports and audit

- [x] Owner Dashboard computes delivery, carton, pending verification, active, partial, failed, and staff metrics from the actual server record set and starts at zero.
- [x] Delivery table supports search, status filter, server-backed records, and CSV export; POD PDF and live tracker endpoints are protected.
- [x] Audit entries capture login, staff changes, delivery creation, status changes, GPS updates, proof submission, POD verification, PDF generation, settings updates, password resets, and session events.

## Data and release readiness

- [x] First launch is empty: no customers, drivers, vehicles, deliveries, or sample POD records are seeded. All operational data is added by the Owner.
- [x] Public route manifest, health endpoint, production build, TypeScript checks, automated tests, local end-to-end API smoke test, GPS tracker response, and PDF validity check are healthy.
- [ ] Configure a Render persistent disk or managed database before relying on the service for long-term production data across rebuilds or multiple instances.
- [ ] Replace the temporary wordmark with the official company logo and enter confirmed company contact details in Settings.
