import { Font } from '@react-pdf/renderer';
import { BRAND } from './brand';

let registeredBase: string | null = null;

/**
 * Az alap PDF-betűkészletekből hiányzik az ő/ű, ezért saját TTF-et
 * regisztrálunk (Inter, SIL OFL – public/fonts/OFL-Inter.txt).
 * `base`: böngészőben '/fonts', Node-ban (teszt, szerver) abszolút mappa.
 */
export function registerReportFonts(base: string): void {
  if (registeredBase === base) return;
  Font.register({
    family: BRAND.fontFamily,
    fonts: [
      { src: `${base}/Inter_400Regular.ttf`, fontWeight: 400 },
      { src: `${base}/Inter_400Regular_Italic.ttf`, fontWeight: 400, fontStyle: 'italic' },
      { src: `${base}/Inter_600SemiBold.ttf`, fontWeight: 600 },
      { src: `${base}/Inter_700Bold.ttf`, fontWeight: 700 },
    ],
  });
  // Magyar szavak ne törjenek angol elválasztási szabályok szerint.
  Font.registerHyphenationCallback((word) => [word]);
  registeredBase = base;
}
