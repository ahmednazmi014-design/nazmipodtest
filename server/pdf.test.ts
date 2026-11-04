import { describe, expect, it } from "vitest";
import { createPodPdf } from "./pdf";
import type { StoredDelivery, Store } from "./store";

// A small baseline JPEG used only as test data (SOI/EOI plus a valid frame and scan).
const JPEG = Buffer.from(
  "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAH/AP/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAQUCcf/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQMBAT8B/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAgEBPwH/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAY/Ag//xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAE/IT//2gAMAwEAAgADAAAAEP8A/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAwEBPxB//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAgEBPxB//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxB//9k=",
  "base64"
);
const PHOTO = `data:image/jpeg;base64,${JPEG.toString("base64")}`;
function tallPhoto() {
  const bytes = Buffer.from(JPEG);
  const sof = bytes.indexOf(Buffer.from([0xff, 0xc0]));
  if (sof < 0) throw new Error("Test JPEG has no baseline frame marker");
  bytes.writeUInt16BE(2400, sof + 5);
  bytes.writeUInt16BE(320, sof + 7);
  return `data:image/jpeg;base64,${bytes.toString("base64")}`;
}

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
    expect(text).toContain("PKR 125.00");
    expect(text).toContain("Subtotal  PKR 1,500.00");
    expect(text).toContain("Tax \\(5%\\)  PKR 75.00");
    expect(text).toContain("TOTAL  PKR 1,575.00");
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
    expect(text).toContain("Captured: 2 Nov 2026, 7:35 pm");
    expect(text).toContain("24.860000, 67.001000");
    expect(text).toContain("Note: Gate handover");
  });

  it("keeps a tall photo below its capture, GPS, and note captions", () => {
    const proof = {
      ...delivery([tallPhoto()]),
      photoMetadata: [
        {
          capturedAt: "2026-11-02T14:35:00.000Z",
          lat: 24.86,
          lng: 67.001,
          note: "Tall box evidence",
        },
      ],
    };
    const text = createPodPdf(proof, undefined, store).toString("latin1");
    const image = text.match(
      /q [\d.]+ 0 0 ([\d.]+) [\d.]+ ([\d.]+) cm \/Im\d+ Do Q/
    );
    const note = text.match(
      /\/F1 8\.5 Tf 44\.00 ([\d.]+) Td \(Note: Tall box evidence\) Tj/
    );
    expect(image).not.toBeNull();
    expect(note).not.toBeNull();
    expect(Number(image![2]) + Number(image![1])).toBeLessThan(
      Number(note![1]) - 8
    );
  });

  it("wraps long item descriptions without losing invoice amounts", () => {
    const product = "W".repeat(160);
    const text = createPodPdf(
      { ...delivery([]), product, unitPrice: 175 },
      undefined,
      store
    ).toString("latin1");
    const productLines = [
      ...text.matchAll(/BT \/F2 9 Tf 53\.00 [\d.]+ Td \((.*?)\) Tj ET/g),
    ].map(match => match[1]);
    expect(productLines.length).toBeGreaterThan(1);
    expect(productLines.every(line => line.length <= 25)).toBe(true);
    expect(text).toContain("TOTAL  PKR 2,100.00");
  });

  it("continues very long photo notes on a separate page", () => {
    const longNote = `${"Evidence detail ".repeat(100)}ENDNOTE`;
    const proof = {
      ...delivery([tallPhoto()]),
      photoMetadata: [
        { capturedAt: "2026-11-02T14:35:00.000Z", note: longNote },
      ],
    };
    const text = createPodPdf(proof, undefined, store).toString("latin1");
    expect(text).toContain("POD note continues on the following page.");
    expect(text).toContain("POD NOTE CONTINUATION");
    expect(text).toContain("ENDNOTE");
    expect((text.match(/\/Type \/Page\b/g) ?? []).length).toBe(3);
  });

  it("places customer values after their labels and formats milestone dates", () => {
    const text = createPodPdf(delivery([]), undefined, store).toString(
      "latin1"
    );
    expect(text.indexOf("(Example Customer)")).toBeLessThan(
      text.indexOf("(DELIVERY ADDRESS)")
    );
    expect(text).toContain("2 Nov 2026");
  });

  it("does not fabricate a financial total when pricing is absent", () => {
    const text = createPodPdf(delivery([]), undefined, store).toString(
      "latin1"
    );
    expect(text).toContain(
      "Pricing not entered; no financial total calculated."
    );
    expect(text).not.toContain("TOTAL  PKR");
  });

  it("shows elapsed durations only when both milestone timestamps exist", () => {
    const base = delivery([]);
    const partial = createPodPdf(
      { ...base, startedAt: "2026-11-02T10:00:00Z" },
      undefined,
      store
    ).toString("latin1");
    expect(partial).not.toContain("Elapsed:");
    const complete = createPodPdf(
      {
        ...base,
        startedAt: "2026-11-02T10:00:00Z",
        arrivedAt: "2026-11-02T10:25:00Z",
        completedAt: "2026-11-02T10:40:00Z",
      },
      undefined,
      store
    ).toString("latin1");
    expect(complete).toContain("Elapsed: 25 min  |  15 min");
  });

  it("flows long POD notes onto additional pages and does not require a signature", () => {
    const longNote = Array.from(
      { length: 150 },
      (_, i) => `handover-detail-${i}`
    ).join(" ");
    const text = createPodPdf(
      { ...delivery([]), proofNotes: longNote },
      undefined,
      store
    ).toString("latin1");
    expect((text.match(/\/Type \/Page\b/g) ?? []).length).toBeGreaterThan(1);
    expect(text).toContain(
      "Digital delivery record. Customer signature is not required."
    );
    expect(text).toContain("handover-detail-149");
  });
});
