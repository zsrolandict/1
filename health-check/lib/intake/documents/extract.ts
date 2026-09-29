import { strFromU8 } from 'fflate';
import { safeUnzip, ZipTooLargeError } from '../safeUnzip';
import { decodeText } from '../tables/parse';
import type { DocumentPage, ExtractedDocument } from './types';

/**
 * Szövegkinyerés Wordből és szövegfájlból (böngészőben és szerveren is fut).
 * A PDF a szerveren megy (extract.server.ts).
 */

const SECTION_CHARS = 3500;

/** Oldalszám nélküli szöveg → kb. oldalnyi szakaszok, bekezdéshatáron vágva. */
export function chunkText(text: string, size = SECTION_CHARS): DocumentPage[] {
  const paragraphs = text.split(/\n\s*\n|\n/).map((p) => p.trim()).filter(Boolean);
  const pages: DocumentPage[] = [];
  let buf = '';
  for (const p of paragraphs) {
    if (buf && buf.length + p.length > size) {
      pages.push({ label: `${pages.length + 1}. szakasz`, text: buf });
      buf = '';
    }
    buf = buf ? `${buf}\n${p}` : p;
  }
  if (buf) pages.push({ label: `${pages.length + 1}. szakasz`, text: buf });
  return pages;
}

const ENT: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const unescape = (s: string) =>
  s.replace(/&(#x?[0-9a-fA-F]+|amp|lt|gt|quot|apos);/g, (_, e: string) =>
    e[0] === '#' ? String.fromCodePoint(e[1] === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : ENT[e],
  );

export function docxToText(bytes: Uint8Array): string {
  let files: Record<string, Uint8Array>;
  try {
    files = safeUnzip(bytes, (name) => name === 'word/document.xml');
  } catch (e) {
    if (e instanceof ZipTooLargeError) throw e;
    throw new Error('A fájl nem érvényes Word (.docx) dokumentum.');
  }
  const xml = files['word/document.xml'];
  if (!xml) throw new Error('A Word-dokumentum tartalma nem olvasható.');
  return [...strFromU8(xml).matchAll(/<w:p\b[^>]*>([\s\S]*?)<\/w:p>/g)]
    .map((p) =>
      [...p[1].matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\/>|<w:br\/>/g)]
        .map((m) => (m[1] != null ? unescape(m[1]) : m[0] === '<w:tab/>' ? '\t' : '\n'))
        .join(''),
    )
    .join('\n');
}

export function extractPlain(fileName: string, bytes: Uint8Array): ExtractedDocument {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.docx')) return { fileName, format: 'DOCX', pages: chunkText(docxToText(bytes)) };
  if (lower.endsWith('.txt') || lower.endsWith('.md')) return { fileName, format: 'TXT', pages: chunkText(decodeText(bytes)) };
  if (lower.endsWith('.doc')) throw new Error('A régi .doc formátumot mentse el .docx-ként vagy PDF-ként.');
  throw new Error('Támogatott formátum: PDF, DOCX, TXT.');
}

export const SUPPORTED_DOCUMENTS = '.pdf,.docx,.txt';

export function documentChars(pages: DocumentPage[]): number {
  return pages.reduce((n, p) => n + p.text.length, 0);
}
