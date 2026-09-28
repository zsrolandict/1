import { extractText, getDocumentProxy } from 'unpdf';
import { chunkText, extractPlain } from './extract';
import type { ExtractedDocument } from './types';

// PDF-szöveg kinyerése a szerveren (pdf.js). Szkennelt, szövegréteg nélküli
// PDF-ből nem jön szöveg: azt OCR nélkül nem elemezzük, mert az idézetek
// nem lennének ellenőrizhetők.

export async function extractDocument(fileName: string, bytes: Uint8Array): Promise<ExtractedDocument> {
  if (!fileName.toLowerCase().endsWith('.pdf')) return extractPlain(fileName, bytes);
  let pages: string[];
  try {
    const pdf = await getDocumentProxy(bytes);
    const res = await extractText(pdf, { mergePages: false });
    pages = res.text;
  } catch {
    throw new Error('A PDF nem olvasható (sérült vagy jelszóval védett).');
  }
  const doc: ExtractedDocument = {
    fileName,
    format: 'PDF',
    pages: pages.map((text, i) => ({ label: `${i + 1}. oldal`, text: text.trim() })),
  };
  if (doc.pages.every((p) => p.text.length < 20)) {
    throw new Error('A PDF-ben nincs szövegréteg (szkennelt kép). OCR után vagy Word-változatban töltse fel.');
  }
  return doc;
}

export { chunkText };
