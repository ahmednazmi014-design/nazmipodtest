# NAZMI POD — Outcome Checklist

## Core delivery operations
- [ ] Dispatch can create a delivery with customer, destination, full address, contact, challan, order/reference, product, carton/package quantities, scheduled date/time, assigned driver/vehicle, instructions and notes; each record receives a unique `NAZ-POD-YYYY-####` ID.
- [ ] Delivery status lifecycle is represented as Scheduled/Ready for Dispatch/Assigned/Out for Delivery/Arrived/Delivered/Partially Delivered/Failed/Cancelled/Rescheduled with timestamped history, unassigned visibility, duplicate checks and configurable warn/block behavior.
- [ ] Scheduling supports table and calendar views, route sequencing for multiple deliveries, rescheduling, cancellation reasons, driver/vehicle availability checks and linked follow-up deliveries for partial quantities.

## Proof of delivery
- [ ] Driver workflow stays simple: open the assigned delivery, see customer/address/challan/cartons, enter delivered cartons, optionally enter rejected/damaged cartons and a short note, optionally take proof photos, and tap Complete Delivery. No customer signature is required.
- [ ] Successful/partial submissions automatically create the carton handover POD and enter Pending Verification; supervisors can verify or flag correction; Owner override creates an audit record.
- [ ] Generated POD documents contain branded delivery details, quantities, scheduled/arrival/completion timestamps, driver/vehicle, rider confirmation, optional GPS, photos and remarks plus a QR verification code; originals are immutable and amendments are versioned with reason/user/time.

## Driver experience
- [ ] Driver sees only own assignments, active delivery, today/next-seven-day work, history, instructions and clear action buttons.
- [ ] Driver workflow supports English and Urdu, proper RTL layout, mobile camera-first upload, Android Chrome and iPhone Safari; GPS requests a fresh high-accuracy reading with `enableHighAccuracy`, `maximumAge: 0`, timeout handling, and stores/display accuracy in meters.
- [ ] Offline evidence shows Saved Offline/Waiting to Sync/Syncing/Synced/Sync Failed, never discards evidence, caches active plus next-seven-day work, and flags conflicts for supervisor review.

## Identity, permissions and administration
- [ ] First-time Owner setup creates Ahsan securely without hardcoded credentials; Owner can create/invite/approve staff, assign multiple roles and custom permissions, activate/deactivate accounts and manage sessions/password reset.
- [ ] Roles include Owner, Director, Dispatch Manager, Dispatch Staff, Delivery Supervisor, Driver, Accounts and Custom Roles; permission enforcement is server-side and drivers cannot access other assignments.
- [ ] Owner Settings edit company name/address/phone/email/website/logo, timezone, currency, duplicate policy, expenses and retention. Missing contact details remain blank.

## Analytics, reports and audit
- [ ] Owner Dashboard computes company-wide delivery, driver, customer, operational and optional financial analytics from records; filters include today, yesterday, last 7 days, last 30 days, this month, previous month and custom range; cards/charts drill into records.
- [ ] Reports support POD PDF, daily delivery Excel, driver performance Excel, failed delivery, customer history and monthly management exports with date/customer/driver/vehicle/status/branch filters.
- [ ] Audit logs capture login, creation/edit, assignment, status, proof submission, PDF generation, amendment, cancellation and permission changes with actor/time/related record/details; ordinary users cannot alter logs.

## Data, demo and release readiness
- [ ] Relational schema supports future branches and includes users, roles, permissions, branches, drivers, vehicles, customers/addresses, deliveries/routes/status history, POD versions/media, notifications, expenses and audits.
- [ ] Demo Mode contains clearly labelled demo drivers, vehicles, customers, scheduled/completed/partial/failed deliveries and POD examples; reset cannot affect production data.
- [ ] Public route manifest is complete; runtime diagnostics, build, checks and local Preview are healthy before checkpoint. Production publication remains off until the managed project is verified.
