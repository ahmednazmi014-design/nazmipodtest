# NAZMI POD — Implementation & Design Plan

## Product intent

NAZMI POD is a secure, full-stack delivery operations system for Nazmi Packaging Company (Pvt.) Ltd. It gives the Owner a clear operational cockpit, gives riders a simple bilingual mobile workflow, and creates an accountable digital proof of carton handover with timestamps, optional photos, GPS, audit history, and downloadable PDF evidence. Customer signature is not required.

## Delivered implementation

The application starts with an empty operational store. The first person creates the Owner account with a password; the Owner then creates staff accounts and adds the company’s real delivery data. Nothing is seeded, hardcoded, or labelled as a sample record. The current server store is an atomic JSON file so the app works immediately on Render without another service; `NAZMI_DATA_FILE` or `NAZMI_DATA_DIR` controls its location. A Render persistent disk or managed database should be configured before scaling beyond one service instance.

The frontend is React, TypeScript, Wouter, Lucide, and responsive CSS. The backend is Express and tRPC with Zod validation, password hashing, httpOnly session cookies, server-side permission checks, atomic writes, immutable audit entries, PDF generation, and protected tracker endpoints. The existing Drizzle schema remains available for a future managed relational migration, while the delivered runtime path is intentionally self-contained.

## Core workflow

An Owner or authorized dispatch user creates a delivery with customer, destination, address, contact, challan, reference, product, carton quantity, scheduled time, driver, vehicle, route, and notes. Every record receives a unique `NAZ-POD-YYYY-####` ID and duplicate challans are blocked. The lifecycle is Scheduled or Assigned → Out for Delivery → Arrived → Delivered or Partially Delivered, with Failed and Cancelled exceptions. The Owner and supervisors can review records and status history; riders can only see their own assignments.

A rider can start the delivery, request fresh high-accuracy browser GPS, record delivered and rejected cartons, choose camera photos, add a note, and end the delivery by submitting POD. The server stores the evidence, timestamp, location trail, and delivery status. Supervisors can verify or flag POD. Authorized users can download a one-page PDF, and the live tracker endpoint returns the latest location and trail.

## Design direction

The chosen style is **Quiet Industrial Ledger**: a restrained enterprise workspace with warm paper-white surfaces, a deep emerald operational signal, compact tables, and evidence-first status chips. The interface uses a persistent desktop rail, responsive mobile cards, crisp uppercase micro-labels, strong numeric hierarchy, and minimal motion. Amber and coral are reserved for attention and exceptions. Urdu mode uses a true RTL layout, not just translated labels.

## Project structure

- `client/src/App.tsx`: application shell and auth gate.
- `client/src/pages/Home.tsx`: sign-in/setup, dashboard, deliveries, staff, POD, tracker, settings, audit, and rider workspace.
- `client/src/index.css`: responsive Quiet Industrial Ledger visual system.
- `server/store.ts`: password hashing, session store, JSON persistence, delivery/staff/GPS/POD/audit types and atomic writes.
- `server/routers.ts`: typed auth, staff, deliveries, dashboard, settings, tracker, and audit procedures.
- `server/pdf.ts`: authenticated one-page POD PDF creation.
- `server/_core/context.ts`: request session resolution and cookie options.
- `server/_core/index.ts`: Express, tRPC, health, PDF, and tracker endpoints.
- `drizzle/`: relational schema retained for a future managed database migration.
- `public/manus-routes.json`: synchronized page route manifest.

## Material constraints

The official logo and full company contact details were not provided, so the current mark is an editable NAZMI POD wordmark and blank contact fields remain blank until the Owner enters them. Email, SMS, WhatsApp, customer portal, offline sync, and managed database migration remain future extensions because credentials and operational policy were not provided. Browser GPS remains permission-based. Rider evidence is carton counts, optional photos, notes, timestamp, rider/vehicle context, and optional location.
