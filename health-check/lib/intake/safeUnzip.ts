import { unzipSync, type UnzipFileInfo } from 'fflate';
import { UserFacingError } from '@/lib/errors';

/**
 * Kicsomagolás mérethatárral („tömörítési bomba” ellen): egy kis méretű,
 * de gigabájtokra kitömörödő DOCX/XLSX kimerítené a memóriát. A kért
 * fájlokat csak akkor bontjuk ki, ha a kicsomagolt méretük a határ alatt van.
 */
export const MAX_UNZIPPED_BYTES = 80 * 1024 * 1024;
/** Ennél nagyobb tömörítési arány gyanús (normál Office-fájlnál ~10–30×). */
export const MAX_RATIO = 200;

export class ZipTooLargeError extends UserFacingError {
  constructor() {
    super('A fájl kicsomagolva túl nagy vagy gyanúsan tömörített; bontsa részekre, vagy mentse újra.');
  }
}

export function safeUnzip(bytes: Uint8Array, want: (name: string) => boolean, maxBytes = MAX_UNZIPPED_BYTES): Record<string, Uint8Array> {
  let total = 0;
  const filter = (f: UnzipFileInfo) => {
    if (!want(f.name)) return false;
    total += f.originalSize;
    // Azonnal megállunk (kivétel a szűrőből), mielőtt bármit kibontanánk.
    if (total > maxBytes || (f.size > 0 && f.originalSize / f.size > MAX_RATIO && f.originalSize > 1024 * 1024)) throw new ZipTooLargeError();
    return true;
  };
  const files = unzipSync(bytes, { filter });
  // A fejlécben megadott méret hazudhat: a ténylegesen kibontott méretet is ellenőrizzük.
  if (Object.values(files).reduce((n, f) => n + f.length, 0) > maxBytes) throw new ZipTooLargeError();
  return files;
}
