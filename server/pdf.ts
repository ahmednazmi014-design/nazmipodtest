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
    store.settings.companyName || "Nazmi Packaging Company (Pvt.) Ltd.",
    "PROOF OF DELIVERY / CARTON HANDOVER",
    "",
    `Delivery ID: ${delivery.id}`,
    `Customer: ${delivery.customer}`,
    `Address: ${delivery.address}`,
    `Contact: ${delivery.contact || "Not provided"}`,
    `Challan: ${delivery.challan}`,
    `Order / reference: ${delivery.reference || "Not provided"}`,
    `Product: ${delivery.product || "Not provided"}`,
    "",
    `Dispatched cartons: ${delivery.cartons}`,
    `Delivered cartons: ${delivery.deliveredCartons}`,
    `Rejected / damaged cartons: ${delivery.rejectedCartons}`,
    `Status: ${delivery.status}`,
    `Proof status: ${delivery.proofStatus}`,
    `Driver: ${driver?.name || "Unassigned"}`,
    `Vehicle: ${delivery.vehicle || "Not provided"}`,
    `Scheduled: ${delivery.scheduledAt}`,
    `Completed: ${delivery.completedAt || "Not completed"}`,
    `GPS: ${delivery.gps ? `${delivery.gps.lat.toFixed(6)}, ${delivery.gps.lng.toFixed(6)} (accuracy ${delivery.gps.accuracy ?? "n/a"}m)` : "Not captured"}`,
    `Verification code: ${delivery.id}-${delivery.updatedAt.slice(0, 10)}`,
    "",
    "Remarks:",
    ...wrap(delivery.proofNotes || delivery.notes || "No remarks recorded."),
    "",
    "This digital record confirms carton handover. Customer signature is not required.",
  ];

  const pages: {
    commands: string[];
    image?: { bytes: Buffer; width: number; height: number };
  }[] = [{ commands: [] }];
  let y = PAGE_HEIGHT - MARGIN;
  const addPage = () => {
    pages.push({ commands: [] });
    y = PAGE_HEIGHT - MARGIN;
  };
  lines.forEach((line, index) => {
    const isTitle = index === 0;
    const isHeading = index === 1;
    const size = isTitle ? 18 : isHeading ? 14 : 11;
    const gap = line ? size + 7 : 3;
    if (y - gap < MARGIN) addPage();
    if (line) {
      const font = isTitle || isHeading ? "F2" : "F1";
      pages
        .at(-1)!
        .commands.push(
          `BT /${font} ${size} Tf ${MARGIN} ${y - size} Td (${escapePdfText(line)}) Tj ET`
        );
    }
    y -= gap;
  });

  const photos: { bytes: Buffer; width: number; height: number }[] = [];
  for (const value of Array.isArray(delivery.photos) ? delivery.photos : []) {
    if (photos.length >= MAX_PHOTOS) break;
    const bytes = safeJpegBytes(value);
    if (!bytes) continue;
    const dimensions = jpegDimensions(bytes);
    if (dimensions) photos.push({ bytes, ...dimensions });
  }
  for (const image of photos) {
    const scale = Math.min(
      (PAGE_WIDTH - MARGIN * 2) / image.width,
      (PAGE_HEIGHT - MARGIN * 2) / image.height,
      1
    );
    const width = image.width * scale;
    const height = image.height * scale;
    // Give each image its own page so every page has a single unambiguous XObject.
    addPage();
    y -= height;
    const page = pages.at(-1)!;
    page.image = image;
    page.commands.push(
      `q ${width.toFixed(2)} 0 0 ${height.toFixed(2)} ${((PAGE_WIDTH - width) / 2).toFixed(2)} ${y.toFixed(2)} cm /Im${pages.length} Do Q`
    );
    y -= 20;
  }

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
