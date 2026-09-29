import type { z } from 'zod';
import { verifyRegistry, type RegistryRecord, type RegistrySchema } from '../registry';

/**
 * KITALÁLT cégkivonatok (e-cégjegyzék szerkezetet utánozva) és előre
 * elkészített kiolvasásuk. Valós céget, személyt nem ábrázolnak.
 */
interface SampleRegistry {
  fileName: string;
  text: string;
  raw: z.infer<typeof RegistrySchema>;
}

const GYARTO_TEXT = `CÉGKIVONAT – hatályos adatok
Cégjegyzékszám: 08-09-000000
1. A cég elnevezése: Minta Gyártó Korlátolt Felelősségű Társaság
2. A cég rövidített elnevezése: Minta Gyártó Kft.
5. A cég székhelye: 9000 Győr, Példa utca 12.
8. A cég tevékenységi köre: 2562 Fémmegmunkálás (Főtevékenység)
11. A cég jegyzett tőkéje: 30 000 000 HUF
12. A cég tagja(i): Példa Holding Kft. (üzletrész: 90%) Bejegyzés kelte: 2025.03.14.
12. A cég tagja(i): Minta János (üzletrész: 10%) Bejegyzés kelte: 2025.03.14.
13. Vezető tisztségviselő: Minta János ügyvezető, Kezdete: 2024.11.02. Bejegyzés kelte: 2024.11.10.
13. Vezető tisztségviselő: Példa Péter ügyvezető (törölve), Hatály vége: 2024.11.01.
13. Vezető tisztségviselő: Mintás Mária ügyvezető, Kezdete: 2026.02.01. Bejegyzés kelte: 2026.02.10.
20. A cég adószáma: 12345678-2-08`;

const KONYVELO_TEXT = `CÉGKIVONAT – hatályos adatok
Cégjegyzékszám: 01-09-000000
1. A cég elnevezése: Példa Könyvelő Iroda Korlátolt Felelősségű Társaság
5. A cég székhelye: 1111 Budapest, Minta tér 3.
8. A cég tevékenységi köre: 6920 Számviteli, könyvvizsgálói, adószakértői tevékenység (Főtevékenység)
11. A cég jegyzett tőkéje: 3 000 000 HUF
12. A cég tagja(i): Példa Erzsébet (üzletrész: 80%)
12. A cég tagja(i): Példa Anna (üzletrész: 20%) Bejegyzés kelte: 2025.06.20.
13. Vezető tisztségviselő: Példa Erzsébet ügyvezető, Kezdete: 1996.04.01.
20. A cég adószáma: 87654321-2-41`;

export const SAMPLE_REGISTRY: Record<string, SampleRegistry> = {
  gyarto: {
    fileName: 'Cegkivonat_Minta_Gyarto.txt',
    text: GYARTO_TEXT,
    raw: {
      name: { value: 'Minta Gyártó Kft.', quote: 'Minta Gyártó Korlátolt Felelősségű Társaság' },
      registrationNumber: { value: '08-09-000000', quote: 'Cégjegyzékszám: 08-09-000000' },
      taxNumber: { value: '12345678-2-08', quote: 'A cég adószáma: 12345678-2-08' },
      seat: { value: '9000 Győr, Példa utca 12.', quote: '9000 Győr, Példa utca 12.' },
      foundedYear: null,
      capitalHuf: 30_000_000,
      mainActivity: { value: '2562 Fémmegmunkálás', quote: '2562 Fémmegmunkálás (Főtevékenység)' },
      owners: [
        { name: 'Példa Holding Kft.', sharePct: 90, quote: 'Példa Holding Kft. (üzletrész: 90%)' },
        { name: 'Minta János', sharePct: 10, quote: 'Minta János (üzletrész: 10%)' },
      ],
      executives: [{ name: 'Mintás Mária', role: 'ügyvezető', since: '2026-02-01', quote: 'Mintás Mária ügyvezető, Kezdete: 2026.02.01.' }],
      proceedings: [],
      seatService: false,
      changes: [
        { date: '2024-11-02', what: 'Ügyvezetőváltás: Példa Péter helyett Minta János', quote: 'Minta János ügyvezető, Kezdete: 2024.11.02.' },
        { date: '2025-03-14', what: 'Új tag: Példa Holding Kft. (90% üzletrész)', quote: 'Példa Holding Kft. (üzletrész: 90%) Bejegyzés kelte: 2025.03.14.' },
        { date: '2026-02-01', what: 'Új ügyvezető: Mintás Mária', quote: 'Mintás Mária ügyvezető, Kezdete: 2026.02.01.' },
      ],
    },
  },
  konyvelo: {
    fileName: 'Cegkivonat_Pelda_Konyvelo.txt',
    text: KONYVELO_TEXT,
    raw: {
      name: { value: 'Példa Könyvelő Iroda Kft.', quote: 'Példa Könyvelő Iroda Korlátolt Felelősségű Társaság' },
      registrationNumber: { value: '01-09-000000', quote: 'Cégjegyzékszám: 01-09-000000' },
      taxNumber: { value: '87654321-2-41', quote: 'A cég adószáma: 87654321-2-41' },
      seat: { value: '1111 Budapest, Minta tér 3.', quote: '1111 Budapest, Minta tér 3.' },
      foundedYear: 1996,
      capitalHuf: 3_000_000,
      mainActivity: { value: '6920 Számviteli, könyvvizsgálói, adószakértői tevékenység', quote: '6920 Számviteli, könyvvizsgálói, adószakértői tevékenység' },
      owners: [
        { name: 'Példa Erzsébet', sharePct: 80, quote: 'Példa Erzsébet (üzletrész: 80%)' },
        { name: 'Példa Anna', sharePct: 20, quote: 'Példa Anna (üzletrész: 20%)' },
      ],
      executives: [{ name: 'Példa Erzsébet', role: 'ügyvezető', since: '1996-04-01', quote: 'Példa Erzsébet ügyvezető, Kezdete: 1996.04.01.' }],
      proceedings: [],
      seatService: false,
      changes: [{ date: '2025-06-20', what: 'Új tag: Példa Anna (20% üzletrész)', quote: 'Példa Anna (üzletrész: 20%) Bejegyzés kelte: 2025.06.20.' }],
    },
  },
};

export function sampleRegistryRecord(id: string): RegistryRecord | null {
  const s = SAMPLE_REGISTRY[id];
  if (!s) return null;
  return { data: verifyRegistry(s.raw, s.text), fileName: s.fileName, at: new Date().toISOString(), isSample: true };
}
