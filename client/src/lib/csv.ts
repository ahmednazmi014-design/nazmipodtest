export function parseCsv(text: string): string[][] {
  const source = text.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (quoted) {
      if (character === '"' && source[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        cell += character;
      }
      continue;
    }
    if (character === '"' && cell.length === 0) {
      quoted = true;
    } else if (character === ",") {
      row.push(cell.trim());
      cell = "";
    } else if (character === "\n" || character === "\r") {
      if (character === "\r" && source[index + 1] === "\n") index += 1;
      row.push(cell.trim());
      cell = "";
      if (row.some(value => value.length > 0)) rows.push(row);
      row = [];
    } else {
      cell += character;
    }
  }
  if (quoted) throw new Error("CSV contains an unterminated quoted field.");
  row.push(cell.trim());
  if (row.some(value => value.length > 0)) rows.push(row);
  if (!rows.length) return [];
  const width = rows[0].length;
  const malformed = rows.findIndex(candidate => candidate.length !== width);
  if (malformed > -1)
    throw new Error(
      `CSV row ${malformed + 1} has a different number of columns.`
    );
  return rows;
}

export function csvEscape(value: unknown): string {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}
