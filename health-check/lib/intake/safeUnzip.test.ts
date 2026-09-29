import { describe, expect, it } from 'vitest';
import { strToU8, zipSync } from 'fflate';
import { docxToText } from './documents/extract';
import { safeUnzip, ZipTooLargeError } from './safeUnzip';

describe('kicsomagolás mérethatárral', () => {
  it('normál fájlt kibont', () => {
    const zip = zipSync({ 'a.xml': strToU8('<x>szia</x>'), 'b.xml': strToU8('más') });
    expect(Object.keys(safeUnzip(zip, (n) => n === 'a.xml'))).toEqual(['a.xml']);
  });

  it('a gyanúsan jól tömörödő (bomba) fájlt visszautasítja', () => {
    const bomb = zipSync({ 'word/document.xml': new Uint8Array(20 * 1024 * 1024) }, { level: 9 });
    expect(bomb.length).toBeLessThan(100_000);
    expect(() => safeUnzip(bomb, () => true)).toThrow(ZipTooLargeError);
    expect(() => docxToText(bomb)).toThrow('túl nagy');
  });

  it('a méretkorlát felett visszautasít', () => {
    const zip = zipSync({ 'a.xml': strToU8('x'.repeat(5000)) }, { level: 0 });
    expect(() => safeUnzip(zip, () => true, 1000)).toThrow(ZipTooLargeError);
  });
});
