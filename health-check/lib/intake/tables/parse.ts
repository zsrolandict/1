import { strFromU8, unzipSync } from 'fflate';

/**
 * Táblázatok beolvasása a böngészőben: CSV (magyar Excel-exporttal is) és XLSX.
 * A fájl nem hagyja el a gépet; csak a számolt mutatók kerülnek a munkaállapotba.
 */

export type Cell = string | number | null;
export type Grid = Cell[][];

/** UTF-8, ha érvényes; különben Windows-1250 (a magyar Excel CSV-mentése). */
export function decodeText(bytes: Uint8Array): string {
  const bom = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bom ? bytes.subarray(3) : bytes);
  } catch {
    return new TextDecoder('windows-1250').decode(bytes);
  }
}

/** Elválasztó: az első nem üres sorban leggyakoribb a ; , és a tab közül. */
function detectDelimiter(text: string): string {
  const line = text.split(/\r?\n/).find((l) => l.trim()) ?? '';
  const counts = [';', ',', '\t'].map((d) => [d, line.split(d).length - 1] as const);
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0][1] > 0 ? counts[0][0] : ';';
}

export function parseCsv(text: string): Grid {
  const delim = detectDelimiter(text);
  const rows: Grid = [];
  let row: Cell[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else quoted = false;
      } else field += ch;
      continue;
    }
    if (ch === '"' && field === '') quoted = true;
    else if (ch === delim) { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some((c) => String(c).trim())) rows.push(row);
      row = [];
    } else field += ch;
  }
  row.push(field);
  if (row.some((c) => String(c).trim())) rows.push(row);
  return rows.map((r) => r.map((c) => (typeof c === 'string' ? c.trim() : c)));
}

const XML_ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
function unescapeXml(s: string): string {
  return s.replace(/&(#x?[0-9a-fA-F]+|amp|lt|gt|quot|apos);/g, (_, e: string) => {
    if (e[0] === '#') return String.fromCodePoint(e[1] === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
    return XML_ENTITIES[e];
  });
}

function textOf(xml: string): string {
  return [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => unescapeXml(m[1])).join('');
}

function colIndex(ref: string): number {
  const letters = /^[A-Z]+/.exec(ref)?.[0] ?? 'A';
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

/** Az első munkalap beolvasása. Dátumcellák Excel-sorszámként (szám) jönnek. */
export function parseXlsx(bytes: Uint8Array): Grid {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes, { filter: (f) => f.name.startsWith('xl/') });
  } catch {
    throw new Error('A fájl nem érvényes XLSX.');
  }
  const shared = files['xl/sharedStrings.xml']
    ? [...strFromU8(files['xl/sharedStrings.xml']).matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => textOf(m[1]))
    : [];
  const sheetName = Object.keys(files)
    .filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n))
    .sort((a, b) => Number(/\d+/.exec(a)![0]) - Number(/\d+/.exec(b)![0]))[0];
  if (!sheetName) throw new Error('Az XLSX-ben nincs munkalap.');
  const xml = strFromU8(files[sheetName]);
  const grid: Grid = [];
  for (const rm of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const row: Cell[] = [];
    for (const cm of rm[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = cm[1];
      const body = cm[2] ?? '';
      const ref = /\br="([A-Z]+\d+)"/.exec(attrs)?.[1];
      const type = /\bt="(\w+)"/.exec(attrs)?.[1];
      const v = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1];
      let value: Cell = null;
      if (type === 's' && v != null) value = shared[Number(v)] ?? '';
      else if (type === 'inlineStr') value = textOf(body);
      else if (type === 'str' || type === 'e') value = v != null ? unescapeXml(v) : '';
      else if (type === 'b') value = v === '1' ? 'igen' : 'nem';
      else if (v != null) value = Number(v);
      const idx = ref ? colIndex(ref) : row.length;
      while (row.length < idx) row.push(null);
      row[idx] = value;
    }
    if (row.some((c) => c != null && String(c).trim() !== '')) grid.push(row);
  }
  return grid;
}

export function parseTableFile(name: string, bytes: Uint8Array): Grid {
  const lower = name.toLowerCase();
  if (lower.endsWith('.xlsx')) return parseXlsx(bytes);
  if (lower.endsWith('.xls')) throw new Error('A régi .xls formátumot mentse el .xlsx-ként vagy CSV-ként.');
  return parseCsv(decodeText(bytes));
}

/**
 * Magyar és angol számformátum: „1 234 567,89”, „1.234.567”, „1,234,567.89”,
 * „12,5%”, „-3 000 Ft”, „(3 000)”. Nem szám → null.
 */
export function parseNumber(cell: Cell): number | null {
  if (cell == null) return null;
  if (typeof cell === 'number') return Number.isFinite(cell) ? cell : null;
  let s = cell.replace(/[\s  ]/g, '').replace(/(HUF|Ft|%)$/i, '').replace(/^(HUF|Ft)/i, '');
  let neg = false;
  if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
  if (s.startsWith('-')) { neg = !neg; s = s.slice(1); }
  if (!/^[\d.,]+$/.test(s) || !/\d/.test(s)) return null;
  const hasComma = s.includes(',');
  const hasDot = s.includes('.');
  if (hasComma && hasDot) {
    // az utolsó elválasztó a tizedesjel
    s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  } else if (hasComma) {
    s = /^\d{1,3}(,\d{3})+$/.test(s) && s.split(',').length > 2 ? s.replace(/,/g, '') : s.replace(',', '.');
  } else if (hasDot) {
    if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  }
  const n = Number(s);
  return Number.isFinite(n) ? (neg ? -n : n) : null;
}

const DAY_MS = 86_400_000;
/** Excel-sorszám (1900-as rendszer) → UTC nap. */
const EXCEL_EPOCH = Date.UTC(1899, 11, 30);

/**
 * Dátum → napsorszám (UTC napok 1970 óta). Elfogad: 2026.03.15., 2026-03-15,
 * 2026/03/15, 15.03.2026, valamint Excel-dátumsorszámot.
 */
export function parseDay(cell: Cell): number | null {
  if (cell == null) return null;
  if (typeof cell === 'number') {
    if (cell > 20_000 && cell < 80_000) return Math.round((EXCEL_EPOCH + cell * DAY_MS) / DAY_MS);
    return null;
  }
  const s = cell.trim();
  let m = /^(\d{4})[.\-/ ]\s*(\d{1,2})[.\-/ ]\s*(\d{1,2})\.?/.exec(s);
  if (m) return utcDay(+m[1], +m[2], +m[3]);
  m = /^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})/.exec(s);
  if (m) return utcDay(+m[3], +m[2], +m[1]);
  const n = parseNumber(s);
  return n != null ? parseDay(n) : null;
}

function utcDay(y: number, mo: number, d: number): number | null {
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return Date.UTC(y, mo - 1, d) / DAY_MS;
}

export function dayToIso(day: number): string {
  return new Date(day * DAY_MS).toISOString().slice(0, 10);
}

export function isoToDay(iso: string): number | null {
  return parseDay(iso);
}

/** Igen/nem jellegű cella. */
export function parseBool(cell: Cell): boolean | null {
  if (cell == null) return null;
  const s = String(cell).trim().toLowerCase();
  if (['igen', 'i', 'van', 'yes', 'y', 'true', '1', 'x', 'kész', 'kesz', 'elkészült'].includes(s)) return true;
  if (['nem', 'n', 'nincs', 'no', 'false', '0', '-', 'hiányzik', 'hianyzik'].includes(s)) return false;
  return null;
}
