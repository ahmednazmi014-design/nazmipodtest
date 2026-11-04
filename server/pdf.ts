import type { StoredDelivery, StoredUser, Store } from "./store";

const MAX_PHOTOS = 3;
const MAX_PHOTO_BYTES = 1024 * 1024;
const JPEG_DATA_URI = /^data:image\/jpeg;base64,([A-Za-z0-9+/]+={0,2})$/i;
const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 44;
type PdfObject = { id: number; body: Buffer };
type Page = {
  commands: string[];
  image?: { bytes: Buffer; width: number; height: number };
};
const C = {
  navy: "0.06 0.17 0.23",
  green: "0.04 0.36 0.27",
  muted: "0.36 0.43 0.45",
  pale: "0.93 0.96 0.94",
  line: "0.82 0.87 0.85",
  ink: "0.12 0.17 0.18",
  white: "1 1 1",
  gold: "0.91 0.72 0.34",
};

function escapePdfText(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/[^\x20-\x7e]/g, "?");
}
function wrap(value: string, width = 76) {
  const words = String(value).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    if (word.length > width) {
      if (line) lines.push(line);
      line = "";
      for (let i = 0; i < word.length; i += width)
        lines.push(word.slice(i, i + width));
    } else if ((line ? line.length + 1 : 0) + word.length > width) {
      lines.push(line);
      line = word;
    } else line += (line ? " " : "") + word;
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}
function wrapToWidth(value: string, width: number, fontSize: number) {
  // Helvetica glyphs fit within one em; this conservative bound prevents
  // wide runs of W/M characters from overrunning a fixed PDF column.
  return wrap(value, Math.max(1, Math.floor(width / fontSize)));
}
function safeJpegBytes(value: unknown): Buffer | undefined {
  if (typeof value !== "string") return undefined;
  const match = JPEG_DATA_URI.exec(value);
  if (!match) return undefined;
  const base64 = match[1];
  if (base64.length > Math.ceil(MAX_PHOTO_BYTES / 3) * 4) return undefined;
  try {
    const bytes = Buffer.from(base64, "base64");
    if (
      !bytes.length ||
      bytes.length > MAX_PHOTO_BYTES ||
      bytes.toString("base64") !== base64
    )
      return undefined;
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
      const height = bytes.readUInt16BE(offset + 3),
        width = bytes.readUInt16BE(offset + 5);
      return width && height ? { width, height } : undefined;
    }
    offset += length;
  }
  return undefined;
}
function validDate(value?: string | null) {
  if (!value) return undefined;
  const n = Date.parse(value);
  return Number.isFinite(n) ? n : undefined;
}
function duration(from?: string | null, to?: string | null) {
  const a = validDate(from),
    b = validDate(to);
  if (a == null || b == null || b < a) return undefined;
  const mins = Math.round((b - a) / 60000);
  return mins < 60
    ? `${mins} min`
    : `${Math.floor(mins / 60)} hr ${mins % 60} min`;
}
function formatNumber(value: number) {
  return new Intl.NumberFormat("en-PK", { maximumFractionDigits: 0 }).format(
    value
  );
}
function formatMoney(currency: string, value: number) {
  const amount = new Intl.NumberFormat("en-PK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
  return `${currency} ${amount}`;
}
function stamp(value?: string | null, timeZone = "Asia/Karachi") {
  if (!value) return "Not recorded";
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const date = new Date(dateOnly ? `${value}T00:00:00Z` : value);
  if (!Number.isFinite(date.getTime())) return value;
  const options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "short",
    day: "numeric",
    ...(dateOnly ? {} : { hour: "numeric", minute: "2-digit" }),
    timeZone: dateOnly ? "UTC" : timeZone || "Asia/Karachi",
  };
  try {
    return new Intl.DateTimeFormat("en-PK", options).format(date);
  } catch {
    return new Intl.DateTimeFormat("en-PK", {
      ...options,
      timeZone: "UTC",
    }).format(date);
  }
}

export function createPodPdf(
  delivery: StoredDelivery,
  driver: StoredUser | undefined,
  store: Store
): Buffer {
  const pages: Page[] = [{ commands: [] }];
  let y = PAGE_HEIGHT - MARGIN;
  const txt = (
    text: string,
    x: number,
    top: number,
    size = 9,
    bold = false,
    color = C.ink
  ) => {
    pages
      .at(-1)!
      .commands.push(
        `${color} rg BT /${bold ? "F2" : "F1"} ${size} Tf ${x.toFixed(2)} ${(top - size).toFixed(2)} Td (${escapePdfText(text)}) Tj ET`
      );
  };
  const rect = (
    x: number,
    top: number,
    w: number,
    h: number,
    color: string,
    stroke?: string
  ) => {
    const cmd = stroke
      ? `q ${color} rg ${stroke} RG 0.7 w ${x} ${top - h} ${w} ${h} re B Q`
      : `q ${color} rg ${x} ${top - h} ${w} ${h} re f Q`;
    pages.at(-1)!.commands.push(cmd);
  };
  const rule = (x1: number, x2: number, yy: number, color = C.line) =>
    pages
      .at(-1)!
      .commands.push(`q ${color} RG 0.7 w ${x1} ${yy} m ${x2} ${yy} l S Q`);
  const section = (title: string, top = y) => {
    txt(title.toUpperCase(), MARGIN, top, 9, true, C.green);
    rule(MARGIN, PAGE_WIDTH - MARGIN, top - 7);
    return top - 19;
  };
  const card = (
    x: number,
    top: number,
    w: number,
    title: string,
    entries: [string, string][]
  ) => {
    const rows = entries.map(([label, value]) => ({
      label,
      lines: wrap(
        value || "Not provided",
        Math.max(16, Math.floor((w - 24) / 5.3))
      ),
    }));
    const height =
      32 + rows.reduce((total, row) => total + 22 + row.lines.length * 10, 0);
    rect(x, top, w, height, C.pale, C.line);
    txt(title.toUpperCase(), x + 12, top - 12, 8, true, C.green);
    let cy = top - 30;
    for (const row of rows) {
      txt(row.label.toUpperCase(), x + 12, cy, 6.5, true, C.muted);
      const valueTop = cy - 9;
      row.lines.forEach((line, i) =>
        txt(line, x + 12, valueTop - i * 10, 8.5, false, C.ink)
      );
      cy -= 22 + row.lines.length * 10;
    }
    return height;
  };
  const ensure = (height: number) => {
    if (y - height < MARGIN + 20) {
      pages.push({ commands: [] });
      y = PAGE_HEIGHT - MARGIN;
      rect(0, PAGE_HEIGHT, PAGE_WIDTH, 42, C.navy);
      txt(
        store.settings.companyName || "Nazmi Packaging Company (Pvt.) Ltd.",
        MARGIN,
        PAGE_HEIGHT - 14,
        9,
        true,
        C.white
      );
      txt(
        `DELIVERY ${delivery.id}  /  CONTINUED`,
        PAGE_WIDTH - 210,
        PAGE_HEIGHT - 14,
        7,
        false,
        C.white
      );
      y = PAGE_HEIGHT - 58;
    }
  };
  const company =
    store.settings.companyName || "Nazmi Packaging Company (Pvt.) Ltd.";
  // Masthead and document identity.
  rect(0, PAGE_HEIGHT, PAGE_WIDTH, 118, C.navy);
  rect(MARGIN, PAGE_HEIGHT - 31, 4, 38, C.gold);
  txt(company, MARGIN + 14, PAGE_HEIGHT - 34, 19, true, C.white);
  txt(
    "INVOICE / PROOF OF DELIVERY / CARTON HANDOVER",
    MARGIN + 14,
    PAGE_HEIGHT - 59,
    9,
    true,
    "0.78 0.88 0.84"
  );
  txt(
    "CARTON HANDOVER RECORD",
    MARGIN + 14,
    PAGE_HEIGHT - 75,
    8,
    false,
    C.white
  );
  const companyContact = [store.settings.phone, store.settings.website]
    .filter(Boolean)
    .join("  |  ");
  if (companyContact)
    txt(companyContact, MARGIN + 14, PAGE_HEIGHT - 95, 7, false, C.white);
  txt(
    delivery.status.toUpperCase(),
    PAGE_WIDTH - 150,
    PAGE_HEIGHT - 42,
    9,
    true,
    C.white
  );
  txt(
    `DELIVERY  ${delivery.id}`,
    PAGE_WIDTH - 210,
    PAGE_HEIGHT - 62,
    8,
    false,
    C.white
  );
  txt(
    `CHALLAN  ${delivery.challan || "Not provided"}`,
    PAGE_WIDTH - 210,
    PAGE_HEIGHT - 78,
    8,
    false,
    C.white
  );
  txt(
    `ISSUED  ${stamp(delivery.createdAt, store.settings.timezone)}`,
    PAGE_WIDTH - 210,
    PAGE_HEIGHT - 95,
    7,
    false,
    C.white
  );
  y = PAGE_HEIGHT - 140;
  const gap = 12,
    cardW = (PAGE_WIDTH - 2 * MARGIN - gap) / 2;
  const customerCardHeight = card(MARGIN, y, cardW, "Customer", [
    ["Customer", delivery.customer],
    ["Delivery address", delivery.address],
    ["Contact", delivery.contact || "Not provided"],
  ]);
  const routeCardHeight = card(
    MARGIN + cardW + gap,
    y,
    cardW,
    "Route & delivery",
    [
      [
        "Route / vehicle",
        `${delivery.route || "Not provided"}  /  ${delivery.vehicle || "Not provided"}`,
      ],
      ["Driver", driver?.name || "Unassigned"],
      ["Reference", delivery.reference || "Not provided"],
    ]
  );
  y -= Math.max(customerCardHeight, routeCardHeight) + 20;
  ensure(100);
  y = section("Handover timeline", y);
  const milestones: [string, string][] = [
    ["SCHEDULED", delivery.scheduledAt],
    ["STARTED", delivery.startedAt || ""],
    ["ARRIVED", delivery.arrivedAt || ""],
    ["COMPLETED", delivery.completedAt || ""],
  ];
  const cellW = (PAGE_WIDTH - 2 * MARGIN) / 4;
  milestones.forEach(([label, value], i) => {
    const x = MARGIN + i * cellW;
    rect(x, y, cellW - 6, 40, C.pale);
    rect(x, y, 3, 40, C.green);
    txt(label, x + 10, y - 7, 7, true, C.muted);
    wrap(stamp(value, store.settings.timezone), 24)
      .slice(0, 2)
      .forEach((v, j) => txt(v, x + 10, y - 20 - j * 10, 7.5, false, C.ink));
  });
  const segments = [
    duration(delivery.startedAt, delivery.arrivedAt),
    duration(delivery.arrivedAt, delivery.completedAt),
  ].filter(Boolean);
  y -= 53;
  if (segments.length) {
    txt(`Elapsed: ${segments.join("  |  ")}`, MARGIN, y, 8, false, C.muted);
    y -= 17;
  }
  ensure(140);
  y = section("Carton & rate summary", y);
  const cols = [MARGIN, MARGIN + 246, MARGIN + 320, MARGIN + 420];
  rect(MARGIN, y, PAGE_WIDTH - 2 * MARGIN, 22, C.navy);
  [
    ["ITEM / DESCRIPTION", cols[0] + 9],
    ["QTY", cols[1] + 8],
    ["RATE", cols[2] + 8],
    ["AMOUNT", cols[3] + 8],
  ].forEach(([s, x]) => txt(String(s), Number(x), y - 7, 7, true, C.white));
  const rowY = y - 22;
  const productLines = wrapToWidth(
    delivery.product || "Cartons",
    cols[1] - (cols[0] + 9) - 6,
    9
  );
  const rowHeight = Math.max(31, productLines.length * 10 + 14);
  rect(MARGIN, rowY, PAGE_WIDTH - 2 * MARGIN, rowHeight, C.pale);
  productLines.forEach((line, index) =>
    txt(line, cols[0] + 9, rowY - 9 - index * 10, 9, true, C.ink)
  );
  const valueTop = rowY - rowHeight / 2 + 5;
  txt(formatNumber(delivery.cartons), cols[1] + 8, valueTop, 9, false, C.ink);
  const currency = store.settings.currency || "PKR";
  if (delivery.unitPrice != null) {
    txt(
      formatMoney(currency, delivery.unitPrice),
      cols[2] + 8,
      valueTop,
      8,
      false,
      C.ink
    );
    txt(
      formatMoney(currency, delivery.unitPrice * delivery.cartons),
      cols[3] + 8,
      valueTop,
      8,
      false,
      C.ink
    );
  } else {
    txt("Not entered", cols[2] + 8, valueTop, 8, false, C.muted);
    txt("Not calculated", cols[3] + 8, valueTop, 8, false, C.muted);
  }
  y = rowY - rowHeight - 12;
  txt(
    `Delivered: ${formatNumber(delivery.deliveredCartons)} cartons`,
    MARGIN,
    y,
    8,
    true,
    C.green
  );
  txt(
    `Rejected / damaged: ${formatNumber(delivery.rejectedCartons)} cartons`,
    MARGIN + 180,
    y,
    8,
    false,
    C.muted
  );
  if (delivery.unitPrice != null) {
    const subtotal = delivery.unitPrice * delivery.cartons;
    txt(
      `Subtotal  ${formatMoney(currency, subtotal)}`,
      PAGE_WIDTH - 230,
      y,
      8,
      false,
      C.ink
    );
    y -= 14;
    if (delivery.taxPercent != null) {
      const tax = (subtotal * delivery.taxPercent) / 100;
      txt(
        `Tax (${delivery.taxPercent}%)  ${formatMoney(currency, tax)}`,
        PAGE_WIDTH - 230,
        y,
        8,
        false,
        C.ink
      );
      y -= 16;
    }
    rect(PAGE_WIDTH - 248, y + 4, 204, 24, C.green);
    txt(
      `TOTAL  ${formatMoney(currency, subtotal * (1 + (delivery.taxPercent ?? 0) / 100))}`,
      PAGE_WIDTH - 238,
      y - 2,
      9,
      true,
      C.white
    );
    y -= 16;
  } else {
    txt(
      "Pricing not entered; no financial total calculated.",
      PAGE_WIDTH - 275,
      y,
      8,
      false,
      C.muted
    );
    y -= 12;
  }
  y -= 22;
  ensure(85);
  y = section("Proof of delivery", y);
  const notes = delivery.proofNotes || delivery.notes || "No remarks recorded.";
  const gps = delivery.gps
    ? `${delivery.gps.lat.toFixed(6)}, ${delivery.gps.lng.toFixed(6)}${delivery.gps.accuracy != null ? `  (accuracy ${delivery.gps.accuracy}m)` : ""}`
    : "Not captured";
  const evidence = [
    `Proof status: ${delivery.proofStatus}`,
    `GPS: ${gps}`,
    `POD note: ${notes}`,
  ];
  for (const line of evidence.flatMap(v => wrap(v, 92))) {
    ensure(14);
    txt(line, MARGIN, y, 8.5, false, C.ink);
    y -= 13;
  }
  txt(
    "Digital delivery record. Customer signature is not required.",
    MARGIN,
    y - 1,
    7.5,
    false,
    C.muted
  );
  // Photo evidence pages, at most three validated JPEGs.
  const photos: {
    bytes: Buffer;
    width: number;
    height: number;
    metadata?: StoredDelivery["photoMetadata"] extends (infer T)[] | undefined
      ? T
      : never;
  }[] = [];
  for (const [index, value] of (Array.isArray(delivery.photos)
    ? delivery.photos
    : []
  ).entries()) {
    if (photos.length >= MAX_PHOTOS) break;
    const bytes = safeJpegBytes(value);
    if (!bytes) continue;
    const dim = jpegDimensions(bytes);
    if (dim)
      photos.push({ bytes, ...dim, metadata: delivery.photoMetadata?.[index] });
  }
  photos.forEach((image, index) => {
    pages.push({ commands: [], image });
    y = PAGE_HEIGHT - MARGIN;
    rect(0, PAGE_HEIGHT, PAGE_WIDTH, 78, C.navy);
    txt(company, MARGIN, PAGE_HEIGHT - 24, 12, true, C.white);
    txt(
      "POD PHOTO EVIDENCE",
      MARGIN,
      PAGE_HEIGHT - 47,
      10,
      true,
      "0.78 0.88 0.84"
    );
    txt(
      `DELIVERY ${delivery.id}  /  PHOTO ${index + 1} OF ${photos.length}`,
      MARGIN,
      PAGE_HEIGHT - 64,
      8,
      false,
      C.white
    );
    const meta = image.metadata;
    const noteLines = meta?.note
      ? wrapToWidth(`Note: ${meta.note}`, PAGE_WIDTH - 2 * MARGIN, 8.5)
      : [];
    const inlineNote = noteLines.slice(0, 14);
    const continuedNote = noteLines.slice(14);
    let my = PAGE_HEIGHT - 98;
    txt(
      `Captured: ${stamp(meta?.capturedAt, store.settings.timezone)}`,
      MARGIN,
      my,
      8.5,
      false,
      C.ink
    );
    my -= 14;
    txt(
      `GPS: ${meta?.lat != null && meta?.lng != null ? `${meta.lat.toFixed(6)}, ${meta.lng.toFixed(6)}` : "Not captured"}`,
      MARGIN,
      my,
      8.5,
      false,
      C.ink
    );
    my -= 14;
    inlineNote.forEach(line => {
      txt(line, MARGIN, my, 8.5, false, C.ink);
      my -= 12;
    });
    if (continuedNote.length) {
      txt(
        "POD note continues on the following page.",
        MARGIN,
        my,
        8.5,
        false,
        C.muted
      );
      my -= 12;
    }
    const imageTop = my - 20;
    const maxW = PAGE_WIDTH - 2 * MARGIN,
      maxH = Math.max(1, imageTop - MARGIN);
    const scale = Math.min(maxW / image.width, maxH / image.height, 1),
      w = image.width * scale,
      h = image.height * scale;
    const imageY = Math.max(MARGIN, imageTop - h);
    pages
      .at(-1)!
      .commands.push(
        `q ${w.toFixed(2)} 0 0 ${h.toFixed(2)} ${((PAGE_WIDTH - w) / 2).toFixed(2)} ${imageY.toFixed(2)} cm /Im${pages.length} Do Q`
      );
    for (let offset = 0; offset < continuedNote.length; offset += 44) {
      pages.push({ commands: [] });
      rect(0, PAGE_HEIGHT, PAGE_WIDTH, 78, C.navy);
      txt(company, MARGIN, PAGE_HEIGHT - 24, 12, true, C.white);
      txt(
        "POD NOTE CONTINUATION",
        MARGIN,
        PAGE_HEIGHT - 47,
        10,
        true,
        "0.78 0.88 0.84"
      );
      txt(
        `DELIVERY ${delivery.id}  /  PHOTO ${index + 1}`,
        MARGIN,
        PAGE_HEIGHT - 64,
        8,
        false,
        C.white
      );
      let noteY = PAGE_HEIGHT - 100;
      continuedNote.slice(offset, offset + 44).forEach(line => {
        txt(line, MARGIN, noteY, 8.5, false, C.ink);
        noteY -= 12;
      });
    }
  });
  // Discreet folio on every page; photos and first page share consistent numbering.
  pages.forEach((page, index) => {
    page.commands.push(
      `q ${C.line} RG 0.6 w ${MARGIN} 31 m ${PAGE_WIDTH - MARGIN} 31 l S Q`
    );
    txt(`NAZMI  |  DELIVERY ${delivery.id}`, MARGIN, 23, 7, false, C.muted);
    txt(
      `PAGE ${index + 1} OF ${pages.length}`,
      PAGE_WIDTH - MARGIN - 76,
      23,
      7,
      false,
      C.muted
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
  const catalogId = addObject(""),
    pagesId = addObject("");
  const fontId = addObject(
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"
    ),
    boldId = addObject(
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
    const content = Buffer.from(page.commands.join("\n"), "ascii"),
      contentId = addObject(
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
    ],
    offsets = [0];
  let position = chunks[0].length;
  for (const object of objects) {
    offsets.push(position);
    const prefix = Buffer.from(`${object.id} 0 obj\n`, "ascii"),
      suffix = Buffer.from("\nendobj\n", "ascii");
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
