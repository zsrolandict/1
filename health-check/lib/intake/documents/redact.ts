import type { DocumentPage } from './types';

/**
 * Személyes adatok maszkolása, MIELŐTT a szöveg az AI-hoz kerül.
 * A mintázatok a jól felismerhető azonosítókat fedik (e-mail, telefon,
 * bankszámla, adóazonosító jel, TAJ, igazolványszám). Személyneveket
 * szabály nem tud megbízhatóan felismerni: azokat a szerződéses
 * adatfeldolgozás (EU-régió, adatmegőrzés nélkül) védi.
 */

const PATTERNS: { label: string; tag: string; re: RegExp }[] = [
  { label: 'e-mail', tag: '[e-mail]', re: /[\w.+-]+@[\w-]+(\.[\w-]+)+/g },
  { label: 'IBAN', tag: '[bankszámla]', re: /\bHU\d{2}(?:[ ]?\d{4}){6}\b/g },
  { label: 'bankszámla', tag: '[bankszámla]', re: /\b\d{8}-\d{8}(?:-\d{8})?\b/g },
  { label: 'adóazonosító jel', tag: '[adóazonosító]', re: /\b8\d{9}\b/g },
  { label: 'TAJ', tag: '[TAJ]', re: /\b\d{3}[ -]\d{3}[ -]\d{3}\b/g },
  { label: 'telefon', tag: '[telefon]', re: /(?:\+36|\b06)[ /-]?\(?\d{1,2}\)?[ /-]?\d{3}[ -]?\d{3,4}\b/g },
  { label: 'igazolványszám', tag: '[igazolvány]', re: /\b\d{6}[A-Z]{2}\b/g },
];

export function redactText(text: string, counts: Record<string, number> = {}): string {
  let out = text;
  for (const p of PATTERNS) {
    out = out.replace(p.re, () => {
      counts[p.label] = (counts[p.label] ?? 0) + 1;
      return p.tag;
    });
  }
  return out;
}

export function redactPages(pages: DocumentPage[]): { pages: DocumentPage[]; counts: Record<string, number> } {
  const counts: Record<string, number> = {};
  return { pages: pages.map((p) => ({ ...p, text: redactText(p.text, counts) })), counts };
}
