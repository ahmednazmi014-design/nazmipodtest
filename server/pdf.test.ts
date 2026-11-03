import { describe, expect, it } from "vitest";
import { createPodPdf } from "./pdf";
import type { StoredDelivery, Store } from "./store";

// A small baseline JPEG used only as test data (SOI/EOI plus a valid frame and scan).
const JPEG = Buffer.from(
  "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAH/AP/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAQUCcf/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQMBAT8B/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAgEBPwH/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAY/Ag//xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAE/IT//2gAMAwEAAgADAAAAEP8A/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAwEBPxB//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAgEBPxB//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxB//9k=",
  "base64"
);
const PHOTO = `data:image/jpeg;base64,${JPEG.toString("base64")}`;

const delivery = (photos: string[]): StoredDelivery => ({
  id: "DEL-123",
  customer: "Example Customer",
  address: "12 Example Road",
  contact: "555-0100",
  challan: "CH-42",
  reference: "REF-7",
  product: "Cartons",
  cartons: 12,
  deliveredCartons: 11,
  rejectedCartons: 1,
  scheduledAt: "2026-11-02",
  assignedDriverId: null,
  vehicle: "Truck 1",
  route: "North",
  status: "Delivered",
  notes: "",
  proofStatus: "Ready",
  proofNotes: "Received by customer",
  photos,
  gps: null,
  gpsTrail: [],
  createdAt: "2026-11-01",
  updatedAt: "2026-11-02",
  completedAt: "2026-11-02",
  verifiedAt: null,
});
const store = {
  settings: { companyName: "Test Company", currency: "PKR" },
} as Store;

function pdfFor(photos: string[]) {
  return createPodPdf(delivery(photos), undefined, store);
}

describe("createPodPdf photos", () => {
  it("returns a readable PDF with delivery details and an embedded JPEG image stream", () => {
    const pdf = pdfFor([PHOTO]);
    const text = pdf.toString("latin1");
    expect(text.startsWith("%PDF-1.4")).toBe(true);
    expect(text).toContain("%%EOF");
    expect(text).toContain("/Subtype /Image");
    expect(text).toContain("/Filter /DCTDecode");
    expect(text).toContain("PROOF OF DELIVERY / CARTON HANDOVER");
    expect(text).toContain("Example Customer");
    expect(text).toContain("Received by customer");
    expect(pdf.indexOf(JPEG)).toBeGreaterThan(-1);
  });

  it("ignores filenames, malformed data URIs and oversized JPEG payloads without leaking them", () => {
    const oversized = `data:image/jpeg;base64,${Buffer.alloc(1024 * 1024 + 1, 65).toString("base64")}`;
    const pdf = pdfFor([
      "photo.jpg",
      "data:image/png;base64,AAAA",
      "data:image/jpeg;base64,not-base64",
      oversized,
    ]);
    const text = pdf.toString("latin1");
    expect(text).not.toContain("/Subtype /Image");
    expect(text).not.toContain("photo.jpg");
    expect(text).not.toContain("not-base64");
    expect(text).toContain("Example Customer");
  });

  it("limits embedded images to three and paginates their output", () => {
    const pdf = pdfFor([PHOTO, PHOTO, PHOTO, PHOTO]);
    const text = pdf.toString("latin1");
    expect((text.match(/\/Subtype \/Image/g) ?? []).length).toBe(3);
    expect((text.match(/\/Type \/Page\b/g) ?? []).length).toBe(4);
  });
});

describe("invoice and photo metadata", () => {
  it("prints a transparent unit-price, subtotal, tax and total breakdown", () => {
    const priced = {
      ...delivery([]),
      unitPrice: 125,
      taxPercent: 5,
    };
    const pdf = createPodPdf(priced, undefined, store);
    const text = pdf.toString("latin1");
    expect(text).toContain("Unit rate: PKR 125.00 per carton");
    expect(text).toContain("Subtotal: PKR 1500.00");
    expect(text).toContain("Tax \\(5%\\): PKR 75.00");
    expect(text).toContain("Total: PKR 1575.00");
  });

  it("prints capture time, GPS and note alongside embedded photo evidence", () => {
    const proof = {
      ...delivery([PHOTO]),
      photoMetadata: [
        {
          capturedAt: "2026-11-02T14:35:00.000Z",
          lat: 24.86,
          lng: 67.001,
          note: "Gate handover",
        },
      ],
    };
    const text = createPodPdf(proof, undefined, store).toString("latin1");
    expect(text).toContain("Captured: 2026-11-02T14:35:00.000Z");
    expect(text).toContain("24.860000, 67.001000");
    expect(text).toContain("Note: Gate handover");
  });
});
