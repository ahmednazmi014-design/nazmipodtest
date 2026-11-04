import type { StoredDelivery, StoredUser, Store } from "./store";

const MAX_PHOTOS = 3;
const MAX_PHOTO_BYTES = 1024 * 1024;
const JPEG_DATA_URI = /^data:image\/jpeg;base64,([A-Za-z0-9+/]+={0,2})$/i;
const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 50;

type PdfObject = { id: number; body: Buffer };

function escapePdfText(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/[^\x20-\x7e]/g, "?");
}

function wrap(value: string, width = 92) {
  const words = value.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    if ((line + " " + word).trim().length > width && line) {
      lines.push(line);
      line = word;
    } else {
      line = (line + " " + word).trim();
    }
  }
  if (line) lines.push(line);
  return lines;
}

function safeJpegBytes(value: unknown): Buffer | undefined {
  if (typeof value !== "string") return undefined;
  const match = JPEG_DATA_URI.exec(value);
  if (!match) return undefined;
  const base64 = match[1];
  if (base64.length > Math.ceil(MAX_PHOTO_BYTES / 3) * 4) return undefined;
  try {
    const bytes = Buffer.from(base64, "base64");
    if (!bytes.length || bytes.length > MAX_PHOTO_BYTES) return undefined;
    if (bytes.toString("base64") !== base64) return undefined;
    if (
      bytes[0] !== 0xff ||
      bytes[1] !== 0xd8 ||
      bytes.at(-2) !== 0xff ||
      bytes.at(-1) !== 0xd9
    )
      return undefined;
    return bytes;
  } catch {
    return undefined;
  }
}

function jpegDimensions(
  bytes: Buffer
): { width: number; height: number } | undefined {
  // Read dimensions from a JPEG SOF marker, without decoding or trusting payload data.
  let offset = 2;
  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) return undefined;
    const marker = bytes[offset + 1];
    offset += 2;
    if (marker === 0xd9 || marker === 0xda) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 2 > bytes.length) return undefined;
    const length = bytes.readUInt16BE(offset);
    if (length < 2 || offset + length > bytes.length) return undefined;
    if (
      [
        0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce,
        0xcf,
      ].includes(marker)
    ) {
      if (length < 7) return undefined;
      const height = bytes.readUInt16BE(offset + 3);
      const width = bytes.readUInt16BE(offset + 5);
      return width && height ? { width, height } : undefined;
    }
    offset += length;
  }
  return undefined;
}

export function createPodPdf(
  delivery: StoredDelivery,
  driver: StoredUser | undefined,
  store: Store
): Buffer {
  const lines = [
    "BILL TO",
    `Delivery ID: ${delivery.id}`,
    `Customer: ${delivery.customer}`,
    `Address: ${delivery.address}`,
    `Contact: ${delivery.contact || "Not provided"}`,
    "DELIVERY DETAILS",
    `Invoice / challan: ${delivery.challan}`,
    `Invoice date: ${delivery.createdAt}`,
    `Order / reference: ${delivery.reference || "Not provided"}`,
    `Scheduled: ${delivery.scheduledAt}`,
    `Product: ${delivery.product || "Not provided"}`,
    "CARTON SUMMARY",
    `Dispatched cartons: ${delivery.cartons}`,
    `Delivered cartons: ${delivery.deliveredCartons}`,
    `Rejected / damaged cartons: ${delivery.rejectedCartons}`,
    "INVOICE TOTALS",
    ...(delivery.unitPrice != null
      ? [
          `Unit rate: ${store.settings.currency} ${delivery.unitPrice.toFixed(2)} per carton`,
          `Subtotal: ${store.settings.currency} ${(delivery.unitPrice * delivery.cartons).toFixed(2)}`,
          ...(delivery.taxPercent != null
            ? [
                `Tax (${delivery.taxPercent}%): ${store.settings.currency} ${((delivery.unitPrice * delivery.cartons * delivery.taxPercent) / 100).toFixed(2)}`,
              ]
            : []),
          `Total: ${store.settings.currency} ${(delivery.unitPrice * delivery.cartons * (1 + (delivery.taxPercent ?? 0) / 100)).toFixed(2)}`,
        ]
      : ["Pricing not entered; no financial total calculated."]),
    "DELIVERY EVIDENCE",
    `Status: ${delivery.status}`,
    `Proof status: ${delivery.proofStatus}`,
    `Driver: ${driver?.name || "Unassigned"}`,
    `Vehicle: ${delivery.vehicle || "Not provided"}`,
    `Started: ${delivery.startedAt || "Not recorded"}`,
    `Arrived: ${delivery.arrivedAt || "Not recorded"}`,
    `Completed: ${delivery.completedAt || "Not completed"}`,
    `Last GPS: ${delivery.gps ? `${delivery.gps.lat.toFixed(6)}, ${delivery.gps.lng.toFixed(6)} (accuracy ${delivery.gps.accuracy ?? "n/a"}m)` : "Not captured"}`,
    `GPS trail points: ${delivery.gpsTrail.length}`,
    "HANDOVER RESULT",
    `Completion: ${delivery.cartons ? Math.round((delivery.deliveredCartons / delivery.cartons) * 100) : 0}% (${delivery.deliveredCartons} of ${delivery.cartons} cartons)`,
    `Customer acknowledgement: ${delivery.deliveredCartons > 0 ? "Recorded through POD submission" : "Not recorded"}`,
    `Verification code: ${delivery.id}-${delivery.updatedAt.slice(0, 10)}`,
    `Verified at: ${delivery.verifiedAt || "Pending supervisor verification"}`,
    "REMARKS",
    ...wrap(delivery.proofNotes || delivery.notes || "No remarks recorded."),
    "This digital record confirms carton handover. Customer signature is not required.",
  ];

  const pages: {
    commands: string[];
    image?: { bytes: Buffer; width: number; height: number };
  }[] = [
    {
      commands: [
        `q 0.035 0.20 0.15 rg 0 ${PAGE_HEIGHT - 82} ${PAGE_WIDTH} 82 re f Q`,
        `1 1 1 rg BT /F2 18 Tf ${MARGIN} ${PAGE_HEIGHT - 34} Td (${escapePdfText(store.settings.companyName || "Nazmi Packaging Company (Pvt.) Ltd.")}) Tj ET`,
        `1 1 1 rg BT /F1 10 Tf ${MARGIN} ${PAGE_HEIGHT - 56} Td (INVOICE / PROOF OF DELIVERY / CARTON HANDOVER) Tj ET`,
        `1 1 1 rg BT /F2 9 Tf ${PAGE_WIDTH - MARGIN - 88} ${PAGE_HEIGHT - 34} Td (NAZMI POD) Tj ET`,
      ],
    },
  ];
  let y = PAGE_HEIGHT - MARGIN - 96;
  const addPage = () => {
    pages.push({ commands: [] });
    y = PAGE_HEIGHT - MARGIN;
  };
  const sectionTitles = new Set([
    "BILL TO",
    "DELIVERY DETAILS",
    "CARTON SUMMARY",
    "INVOICE TOTALS",
    "DELIVERY EVIDENCE",
    "HANDOVER RESULT",
    "REMARKS",
  ]);
  lines
    .flatMap(line => (line ? wrap(line, 88) : [""]))
    .forEach(line => {
      const isSection = sectionTitles.has(line);
      const size = isSection ? 10 : 10;
      const gap = line ? (isSection ? 23 : 16) : 5;
      if (y - gap < MARGIN) addPage();
      if (line) {
        const page = pages.at(-1)!;
        if (isSection)
          page.commands.push(
            `q 0.89 0.95 0.92 rg ${MARGIN - 5} ${y - 16} ${PAGE_WIDTH - MARGIN * 2 + 10} 18 re f Q`
          );
        page.commands.push(
          `${isSection ? "0.04 0.32 0.23 rg" : "0.10 0.15 0.14 rg"} BT /${isSection ? "F2" : "F1"} ${size} Tf ${MARGIN} ${y - size} Td (${escapePdfText(line)}) Tj ET`
        );
      }
      y -= gap;
    });

  const photos: {
    bytes: Buffer;
    width: number;
    height: number;
    metadata?: {
      capturedAt: string;
      lat?: number | null;
      lng?: number | null;
      note?: string;
    };
  }[] = [];
  for (const [index, value] of (Array.isArray(delivery.photos)
    ? delivery.photos
    : []
  ).entries()) {
    if (photos.length >= MAX_PHOTOS) break;
    const bytes = safeJpegBytes(value);
    if (!bytes) continue;
    const dimensions = jpegDimensions(bytes);
    if (dimensions)
      photos.push({
        bytes,
        ...dimensions,
        metadata: delivery.photoMetadata?.[index],
      });
  }
  for (const [index, image] of photos.entries()) {
    addPage();
    const meta = image.metadata;
    const metaLines = [
      `Photo ${index + 1} of ${photos.length} · Captured: ${meta?.capturedAt || "Not recorded"}`,
      `GPS: ${meta?.lat != null && meta?.lng != null ? `${meta.lat.toFixed(6)}, ${meta.lng.toFixed(6)}` : "Not captured"}`,
      ...(meta?.note ? wrap(`Note: ${meta.note}`, 88).slice(0, 2) : []),
    ];
    pages
      .at(-1)!
      .commands.push(
        `0.035 0.20 0.15 rg BT /F2 14 Tf ${MARGIN} ${PAGE_HEIGHT - MARGIN} Td (POD PHOTO EVIDENCE) Tj ET`,
        `0.10 0.15 0.14 rg BT /F1 9 Tf ${MARGIN} ${PAGE_HEIGHT - MARGIN - 20} Td (${escapePdfText(metaLines[0])}) Tj ET`,
        `0.10 0.15 0.14 rg BT /F1 9 Tf ${MARGIN} ${PAGE_HEIGHT - MARGIN - 34} Td (${escapePdfText(metaLines[1])}) Tj ET`
      );
    if (metaLines[2])
      pages
        .at(-1)!
        .commands.push(
          `0.10 0.15 0.14 rg BT /F1 9 Tf ${MARGIN} ${PAGE_HEIGHT - MARGIN - 48} Td (${escapePdfText(metaLines[2])}) Tj ET`
        );
    const captionHeight = metaLines.length > 2 ? 60 : 46;
    const scale = Math.min(
      (PAGE_WIDTH - MARGIN * 2) / image.width,
      (PAGE_HEIGHT - MARGIN * 2 - captionHeight) / image.height,
      1
    );
    const width = image.width * scale;
    const height = image.height * scale;
    const page = pages.at(-1)!;
    page.image = image;
    page.commands.push(
      `q ${width.toFixed(2)} 0 0 ${height.toFixed(2)} ${((PAGE_WIDTH - width) / 2).toFixed(2)} ${MARGIN.toFixed(2)} cm /Im${pages.length} Do Q`
    );
  }

  pages.forEach((page, index) => {
    page.commands.push(
      `0.82 0.89 0.85 RG 1 w ${MARGIN} 34 m ${PAGE_WIDTH - MARGIN} 34 l S`,
      `0.35 0.43 0.39 rg BT /F1 8 Tf ${MARGIN} 20 Td (${escapePdfText(store.settings.companyName || "Nazmi Packaging")}) Tj ET`,
      `0.35 0.43 0.39 rg BT /F1 8 Tf ${PAGE_WIDTH - MARGIN - 72} 20 Td (Page ${index + 1} of ${pages.length}) Tj ET`
    );
  });

  const objects: PdfObject[] = [];
  const addObject = (body: Buffer | string) => {
    const id = objects.length + 1;
    objects.push({
      id,
      body: Buffer.isBuffer(body) ? body : Buffer.from(body, "binary"),
    });
    return id;
  };
  const catalogId = addObject("");
  const pagesId = addObject("");
  const fontId = addObject(
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"
  );
  const boldId = addObject(
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>"
  );
  const pageIds: number[] = [];
  pages.forEach((page, index) => {
    const imageId = page.image
      ? addObject(
          Buffer.concat([
            Buffer.from(
              `<< /Type /XObject /Subtype /Image /Width ${page.image.width} /Height ${page.image.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.image.bytes.length} >>\nstream\n`,
              "binary"
            ),
            page.image.bytes,
            Buffer.from("\nendstream", "binary"),
          ])
        )
      : undefined;
    const content = Buffer.from(page.commands.join("\n"), "ascii");
    const contentId = addObject(
      Buffer.concat([
        Buffer.from(`<< /Length ${content.length} >>\nstream\n`, "ascii"),
        content,
        Buffer.from("\nendstream", "ascii"),
      ])
    );
    const imageResource = imageId
      ? ` /XObject << /Im${index + 1} ${imageId} 0 R >>`
      : "";
    pageIds.push(
      addObject(
        `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 ${fontId} 0 R /F2 ${boldId} 0 R >>${imageResource} >> /Contents ${contentId} 0 R >>`
      )
    );
  });
  objects[catalogId - 1].body = Buffer.from(
    `<< /Type /Catalog /Pages ${pagesId} 0 R >>`,
    "ascii"
  );
  objects[pagesId - 1].body = Buffer.from(
    `<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`,
    "ascii"
  );

  const chunks: Buffer[] = [
    Buffer.from("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n", "binary"),
  ];
  const offsets = [0];
  let position = chunks[0].length;
  for (const object of objects) {
    offsets.push(position);
    const prefix = Buffer.from(`${object.id} 0 obj\n`, "ascii");
    const suffix = Buffer.from("\nendobj\n", "ascii");
    chunks.push(prefix, object.body, suffix);
    position += prefix.length + object.body.length + suffix.length;
  }
  const xrefOffset = position;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let id = 1; id <= objects.length; id++)
    xref += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  xref += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  chunks.push(Buffer.from(xref, "ascii"));
  return Buffer.concat(chunks);
}
