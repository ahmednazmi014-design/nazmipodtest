# NAZMI POD — Implementation & Design Plan

## Product intent
NAZMI POD is a secure, full-stack delivery operations system for Nazmi Packaging Company (Pvt.) Ltd. It prioritises three outcomes: an Owner-level operational cockpit with drill-down analytics, a very simple bilingual mobile rider workflow, and immutable digital proof of carton handover with photos, timestamps and downloadable PDF evidence. Customer signature is not required.

## Delivery approach
The first implementation pass establishes a coherent production-shaped application around the core delivery lifecycle, then layers in supporting administration and reporting. The website stays usable in demo mode while its relational schema and server procedures are prepared for managed MySQL. Demo records are clearly labelled and analytics are computed from the record set rather than hardcoded card values.

- **Frontend:** React + TypeScript + Wouter, Tailwind utilities, Lucide icons, Recharts, responsive layout with desktop rail and mobile bottom navigation.
- **Backend:** Express + tRPC, server-side validation and permission checks, Drizzle ORM over the managed MySQL-compatible database.
- **Data model:** users, roles, permissions, branches, customers, addresses, vehicles, deliveries, route stops, status history, proof documents/versions, media evidence, notifications, expenses and audit logs.
- **Evidence:** durable object-storage keys and immutable proof versions; rider proof is carton quantities, optional photos, notes, timestamp, rider/vehicle and optional GPS; UI preview/download contracts are prepared for server-side PDF generation.
- **Authentication:** secure first-time Owner setup for Ahsan, password-based application session flow, password reset/session-management boundaries, plus preservation of platform OAuth compatibility for managed Preview.
- **Configuration:** Owner-editable company profile, timezone Asia/Karachi, PKR, DD/MM/YYYY, 24-hour clock, configurable duplicate handling, optional expense capture and configurable retention.

## Core workflow
Dispatch creates a delivery → Ready for Dispatch → Assigned → Out for Delivery → Arrived → Delivered / Partially Delivered / Failed → Pending Verification → Supervisor verified or flagged. Drivers only receive their own assigned records. After start, customer/address/challan/dispatched quantity are locked for drivers. Partial delivery keeps the original record and supports a linked follow-up delivery. Failed delivery requires a reason code and does not become completed.

## Design direction

### Style options considered
- **Quiet Industrial Ledger** (0.04): restrained enterprise operations software with strong table rhythm, paper-white surfaces and precise emerald accents.
- **Emerald Control Room** (0.06): high-contrast command center with compact monitoring panels and status-first navigation.
- **Modern Dispatch Office** (0.08): lighter editorial operations workspace with calendar-led scheduling and human-readable activity streams.

**Chosen style: Quiet Industrial Ledger.**

- **Design movement:** contemporary industrial Swiss editorial; disciplined, information-dense, calm under pressure.
- **Core principles:** operational clarity over decoration; evidence before opinion; progressive disclosure; touch-friendly actions at the point of work.
- **Color philosophy:** warm paper-white and charcoal create trust and legibility, while an ownable deep emerald signals verified movement and successful handover. Amber and coral are reserved for attention and exceptions.
- **Layout paradigm:** a persistent slim left rail for desktop, a compact mobile bottom bar, and an editorial content column that alternates between a metric strip, chart/table split and action queue rather than a wall of equal cards.
- **Signature elements:** emerald vertical status rail, numbered delivery IDs, compact audit timeline, and evidence chips for photo/PDF/carton-handover completeness.
- **Interaction philosophy:** every action confirms its operational consequence; row clicks open detail, filters are reversible, and irreversible actions require a reason.
- **Animation:** 120–180ms opacity/translate transitions only; no decorative motion. Status updates use a subtle emerald pulse and charts animate on first entry.
- **Typography:** Inter/system sans for interface clarity, with condensed uppercase micro-labels for navigation and IDs. Strong numeric hierarchy, generous line-height for mobile Urdu/English labels.
- **Brand essence:** the trusted handover record for a manufacturing company that cannot afford delivery ambiguity. Personality: precise, steady, accountable.
- **Brand voice:** direct, calm and operational. Example lines: “Today’s route is under control.” / “Evidence is ready for verification.”
- **Wordmark & logo:** temporary wordmark built as an emerald square seal containing a simple white route/check monogram beside the NAZMI POD name; Owner Settings will replace it with the official logo.
- **Signature brand color:** Nazmi Emerald `#0A7B61`.

## Project structure
- `client/src/App.tsx`: route shell, auth gate, navigation and page composition.
- `client/src/pages/`: dashboard, deliveries, scheduling, POD, drivers, vehicles, customers, reports, users, notifications, settings and audit views.
- `client/src/components/`: reusable metric strips, status badges, evidence chips, responsive tables, dialogs and mobile action cards.
- `client/src/lib/`: date/number formatting, translation strings, demo record helpers and API client utilities.
- `server/routers.ts`: typed delivery, dashboard, user, POD, notification and audit procedures.
- `server/db.ts`: database accessors and aggregate queries.
- `drizzle/schema.ts`: relational tables and enums for future branch-safe records.
- `drizzle/`: additive migrations and seed/readiness scripts.
- `public/manus-routes.json`: complete page route manifest for Preview tooling.

## Material constraints
No official logo or contact details were provided, so the interface uses an editable temporary identity and leaves missing contact fields blank. Demo records must remain visibly labelled DEMO. Email/SMS/WhatsApp and customer portal remain disabled until credentials and policy are configured. GPS is optional and permission-based. The rider must not be asked for a customer signature; photos, carton counts, notes and location are the handover evidence.
