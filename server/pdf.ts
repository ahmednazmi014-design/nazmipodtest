import type { StoredDelivery, StoredUser, Store } from "./store";

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

export function createPodPdf(
  delivery: StoredDelivery,
  driver: StoredUser | undefined,
  store: Store
) {
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

  const streamLines = [
    "BT",
    "/F1 18 Tf",
    "50 760 Td",
    `(${escapePdfText(lines[0])}) Tj`,
    "/F1 11 Tf",
    "0 -28 Td",
  ];
  lines.slice(1).forEach((line, index) => {
    if (index === 1) streamLines.push("/F1 14 Tf");
    if (index === 2) streamLines.push("/F1 11 Tf");
    streamLines.push(`(${escapePdfText(line)}) Tj`, "0 -17 Td");
  });
  streamLines.push("ET");
  const stream = streamLines.join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(stream, "ascii")} >>\nstream\n${stream}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf, "ascii"));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf, "ascii");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let index = 1; index <= objects.length; index++)
    pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, "ascii");
}
