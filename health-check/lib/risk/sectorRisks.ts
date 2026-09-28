import type { Sector } from '@/lib/intake/requests';
import type { RiskItem } from './types';

/**
 * Ágazati kockázati katalógus. Ha a tényállásban az ágazat ki van választva,
 * ezek a tételek pipálható (nem azonosított) sorként megjelennek a mátrixban.
 * Általános megfogalmazás; a mintacégekben ugyanezek a kódok az esethez
 * igazított leírással szerepelnek. Élesben: `risk_templates` + ágazat-címke.
 * TERVEZET: szakértői jóváhagyásra vár, mint az alapkatalógus.
 */

type Def = Omit<RiskItem, 'id' | 'identified'>;
const item = (d: Def): RiskItem => ({ ...d, id: d.code, identified: false });

export const SECTOR_RISKS: Record<Sector, RiskItem[]> = {
  CONSTRUCTION: [
    item({
      code: 'EPI-01', pillar: 'LEGAL', title: 'Plafon nélküli késedelmi kötbér futó projektekben',
      description: 'Kivitelezési szerződésekben felső korlát nélküli késedelmi kötbér.',
      likelihood: 3, impact: 4, exposureHuf: 50_000_000, remediationDays: 10,
      remediation: 'Kötbérplafon és vis maior-rendelkezés újratárgyalása; szerződésminta egységesítése.',
      division: 'LEGAL', serviceFeeHuf: 1_200_000,
      reasoning: 'A futó projektek szerződései felső korlát nélküli késedelmi kötbért írnak elő. Csúszás esetén a kötbér rövid idő alatt meghaladhatja a projekt fedezetét, és a bank vagy a vevő függő kötelezettségként veszi figyelembe.',
    }),
    item({
      code: 'EPI-02', pillar: 'OPERATIONS', title: 'Egyetlen közszférás megrendelőtől való függés',
      description: 'Az árbevétel jelentős része egy közszférás megrendelőtől származik.',
      likelihood: 3, impact: 4, exposureHuf: 0, remediationDays: 60,
      remediation: 'Megrendelői portfólió bővítése magánszektorbeli keretszerződésekkel; tenderstratégia.',
      division: 'ADVISORY', serviceFeeHuf: 1_000_000,
      reasoning: 'A közszférás megrendelő beruházási üteme költségvetési és politikai döntésektől függ. Egy elmaradó ütem a kapacitás jelentős részét hagyja kihasználatlanul, a lassú fizetés pedig forgótőkét köt le.',
      valuation: { formula: { type: 'REVENUE_SHARE', share: 0.3, marginBased: true, label: 'közszférás megrendelő árbevétel-aránya' }, overrideHuf: null },
    }),
    item({
      code: 'EPI-03', pillar: 'FINANCE', title: 'Készültségi fok szerinti bevétel-elszámolás hiányosságai',
      description: 'A projektek bevétele számlázás szerint, nem készültségi fok alapján kerül elszámolásra.',
      likelihood: 3, impact: 3, exposureHuf: 25_000_000, remediationDays: 15,
      remediation: 'Projektkontrolling, készültségi fok szerinti elszámolás és időbeli elhatárolás.',
      division: 'ACCOUNTING', serviceFeeHuf: 800_000,
      reasoning: 'A bevétel számlázáskor jelenik meg, függetlenül a tényleges készültségtől. Az évek közötti eredmény torzul, a veszteséges projektek későn láthatók.',
    }),
    item({
      code: 'EPI-04', pillar: 'HR', title: 'Hiányos munkavédelmi dokumentáció',
      description: 'Nem naprakész kockázatértékelés; alvállalkozói oktatás nincs dokumentálva.',
      likelihood: 2, impact: 4, exposureHuf: 15_000_000, remediationDays: 5,
      remediation: 'Kockázatértékelés aktualizálása, alvállalkozói munkavédelmi oktatás dokumentálása.',
      division: 'HR', serviceFeeHuf: 400_000,
      reasoning: 'Munkabaleset esetén a dokumentáció hiánya a társaság felelősségét és a hatósági bírság kockázatát jelentősen növeli.',
    }),
  ],
  IT: [
    item({
      code: 'ITF-01', pillar: 'LEGAL', title: 'Copyleft licencű komponensek az értékesített termékben',
      description: 'GPL/AGPL licencű nyílt forráskódú komponens lehet a terjesztett szoftverben.',
      likelihood: 3, impact: 4, exposureHuf: 40_000_000, remediationDays: 20,
      remediation: 'Licencszkennelés, érintett komponensek cseréje, nyílt forráskódú szabályzat.',
      division: 'LEGAL', serviceFeeHuf: 900_000,
      reasoning: 'A copyleft licencek a terjesztett termék forráskódjának közzétételét írhatják elő. Befektetői átvilágításon ez a termék értékét és az ügyfélszerződések teljesíthetőségét kérdőjelezi meg.',
    }),
    item({
      code: 'ITF-02', pillar: 'LEGAL', title: 'Korlátlan felelősség és SLA-kötbér az ügyfélszerződésekben',
      description: 'Felelősségkorlátozás és kötbérplafon nélküli ügyfélszerződések.',
      likelihood: 3, impact: 4, exposureHuf: 50_000_000, remediationDays: 15,
      remediation: 'Felelősségkorlátozás és SLA-kötbérplafon újratárgyalása; szerződésminta.',
      division: 'LEGAL', serviceFeeHuf: 700_000,
      reasoning: 'Korlátlan kártérítési felelősség és plafon nélküli SLA-kötbér mellett egy nagyobb üzemzavar a szerződés éves díjának többszörösébe kerülhet.',
    }),
    item({
      code: 'ITF-03', pillar: 'OPERATIONS', title: 'Információbiztonsági megfelelés hiányai',
      description: 'Nincs információbiztonsági szabályzat, rendszeres sérülékenységvizsgálat vagy tanúsítás.',
      likelihood: 3, impact: 3, exposureHuf: 20_000_000, remediationDays: 30,
      remediation: 'ISMS-alapok, sérülékenységvizsgálat, NIS2-megfelelés felmérése.',
      division: 'ADVISORY', serviceFeeHuf: 1_000_000,
      reasoning: 'Pénzügyi és nagyvállalati ügyfelek egyre inkább tanúsított információbiztonságot várnak el; ennek hiánya ügyfélvesztéshez és incidens esetén jelentős kárhoz vezethet.',
    }),
    item({
      code: 'ITF-04', pillar: 'OPERATIONS', title: 'Hiányzó rendszerdokumentáció és forráskód-letét',
      description: 'Az architektúra nincs dokumentálva, forráskód-letét nincs.',
      likelihood: 3, impact: 3, exposureHuf: 15_000_000, remediationDays: 20,
      remediation: 'Architektúra-dokumentáció, forráskód-letéti megállapodás a kulcsügyfelekkel.',
      division: 'ADVISORY', serviceFeeHuf: 600_000,
      reasoning: 'Dokumentáció nélkül a tudás néhány fejlesztőnél van; az ügyfelek és a befektetők ezt folytonossági kockázatként értékelik.',
    }),
  ],
  ACCOUNTING: [
    item({
      code: 'KON-01', pillar: 'LEGAL', title: 'Alulbiztosított szakmai felelősség',
      description: 'A szakmai felelősségbiztosítás limitje alacsony az ügyfélkörhöz képest.',
      likelihood: 3, impact: 4, exposureHuf: 30_000_000, remediationDays: 5,
      remediation: 'Fedezet felülvizsgálata és emelése; ügyfélszerződésekben felelősségkorlátozás.',
      division: 'LEGAL', serviceFeeHuf: 300_000,
      reasoning: 'Egy bevallási vagy bérszámfejtési hiba az ügyfélnél bírságot és pótlékot okozhat, amelynek megtérítését az irodától követelik; alacsony limit mellett a különbözet a társaságot terheli.',
    }),
    item({
      code: 'KON-02', pillar: 'LEGAL', title: 'Hiányos pénzmosás elleni belső szabályzat és ügyfél-átvilágítás',
      description: 'A pénzmosás elleni szabályzat nem naprakész, az ügyfél-átvilágítás hiányos.',
      likelihood: 3, impact: 3, exposureHuf: 10_000_000, remediationDays: 10,
      remediation: 'Szabályzat aktualizálása, ügyfél-átvilágítások pótlása, képzés.',
      division: 'LEGAL', serviceFeeHuf: 500_000,
      reasoning: 'A könyvelők a pénzmosás elleni törvény kötelezettjei; a felügyeleti ellenőrzés hiányosság esetén bírságot szab ki.',
    }),
    item({
      code: 'KON-03', pillar: 'FINANCE', title: 'Indexálás nélküli fix havidíjas szerződések',
      description: 'Az ügyfélszerződések jelentős része díjemelési záradék nélküli.',
      likelihood: 4, impact: 3, exposureHuf: 20_000_000, remediationDays: 20,
      remediation: 'Díjszabás felülvizsgálata, indexálási záradék, ügyfélkommunikációs terv.',
      division: 'ADVISORY', serviceFeeHuf: 600_000,
      reasoning: 'Indexálás nélkül a bérköltség növekedése közvetlenül a fedezetet csökkenti.',
    }),
    item({
      code: 'KON-04', pillar: 'LEGAL', title: 'Rendezetlen tulajdonosi utódlás',
      description: 'Az üzletrész és a vezetés átadásának rendje nincs rögzítve.',
      likelihood: 3, impact: 4, exposureHuf: 0, remediationDays: 30,
      remediation: 'Tulajdonosi megállapodás, üzletrész-átadási és vezetési terv.',
      division: 'LEGAL', serviceFeeHuf: 900_000,
      reasoning: 'Rendezetlen utódlás esetén az alapító kiesése vitát és döntésképtelenséget okozhat, ami az ügyfélkör elvesztéséhez vezet.',
    }),
  ],
  MANUFACTURING: [
    item({
      code: 'GYA-01', pillar: 'OPERATIONS', title: 'Telephelyi és környezetvédelmi engedélyek hiányosságai',
      description: 'Lejárt, hiányzó vagy a tényleges kapacitást nem fedő engedély.',
      likelihood: 2, impact: 4, exposureHuf: 20_000_000, remediationDays: 30,
      remediation: 'Engedély-felülvizsgálat, hiányzó engedélyek pótlása, megújítási naptár.',
      division: 'LEGAL', serviceFeeHuf: 600_000,
      reasoning: 'Engedély nélküli vagy azt meghaladó termelés esetén a hatóság a tevékenységet korlátozhatja, és bírságot szabhat ki.',
    }),
    item({
      code: 'GYA-02', pillar: 'OPERATIONS', title: 'Elöregedett gépállomány, halasztott karbantartás',
      description: 'A gépek jelentős része 10 évnél idősebb, a karbantartás elmaradt.',
      likelihood: 3, impact: 3, exposureHuf: 40_000_000, remediationDays: 60,
      remediation: 'Eszközállapot-felmérés, beruházási és karbantartási terv.',
      division: 'ADVISORY', serviceFeeHuf: 700_000,
      reasoning: 'Az elhalasztott beruházás rejtett kötelezettség: a vevő vagy a bank a normalizált EBITDA-ból levonja, és a géphiba termeléskiesést okoz.',
    }),
    item({
      code: 'GYA-03', pillar: 'OPERATIONS', title: 'Minőségügyi tanúsítvány és vevői audit-megfelelés',
      description: 'Lejáró tanúsítvány vagy nyitott vevői audit-eltérések.',
      likelihood: 2, impact: 4, exposureHuf: 30_000_000, remediationDays: 30,
      remediation: 'Eltérések lezárása, tanúsítás megújítása, felelős kijelölése.',
      division: 'ADVISORY', serviceFeeHuf: 500_000,
      reasoning: 'A kulcsvevők (pl. autóipar) beszállítói státusza tanúsítványhoz kötött; ennek elvesztése azonnali árbevétel-kiesés.',
    }),
    item({
      code: 'GYA-04', pillar: 'FINANCE', title: 'Alapanyag- és energiaár-kitettség fix áras vevői szerződésekben',
      description: 'A vevői árak rögzítettek, árkorrekciós záradék nélkül.',
      likelihood: 3, impact: 4, exposureHuf: 30_000_000, remediationDays: 20,
      remediation: 'Árkorrekciós záradékok, beszerzési fedezeti stratégia.',
      division: 'ADVISORY', serviceFeeHuf: 800_000,
      reasoning: 'Alapanyag- vagy energiaár-emelkedés esetén a fedezet közvetlenül csökken, mert a költség nem hárítható tovább.',
    }),
  ],
  CONSULTING: [
    item({
      code: 'TAN-01', pillar: 'LEGAL', title: 'Szakmai felelősség korlátozásának és fedezetének hiánya',
      description: 'Az ügyfélszerződésekben nincs felelősségkorlátozás, a biztosítási limit alacsony.',
      likelihood: 3, impact: 4, exposureHuf: 30_000_000, remediationDays: 10,
      remediation: 'Ügyfélszerződés-minta felelősségkorlátozással, biztosítási limit felülvizsgálata.',
      division: 'LEGAL', serviceFeeHuf: 500_000,
      reasoning: 'Egy hibás tanácsból eredő ügyféligény korlátozás és megfelelő fedezet nélkül a társaság teljes vagyonát veszélyezteti.',
    }),
    item({
      code: 'TAN-02', pillar: 'HR', title: 'Ügyfélkör és tudás néhány partnerhez kötve',
      description: 'A kulcsügyfelek személyesen egy-két partnerhez kötődnek, ügyfélcsábítási tilalom nélkül.',
      likelihood: 3, impact: 5, exposureHuf: 0, remediationDays: 30,
      remediation: 'Ügyfélcsábítási és versenytilalmi megállapodás, ügyfélkapcsolatok megosztása, tudásmegosztás.',
      division: 'HR', serviceFeeHuf: 800_000,
      reasoning: 'Tanácsadó cégnél az érték az ügyfélkapcsolatokban és a tudásban van; egy partner távozása az ügyfelek elvitelével járhat.',
      valuation: { formula: { type: 'REVENUE_SHARE', share: 0.3, marginBased: true, label: 'partnerekhez kötött ügyfelek árbevétele' }, overrideHuf: null },
    }),
    item({
      code: 'TAN-03', pillar: 'OPERATIONS', title: 'Alacsony díjazható kihasználtság, alulárazott projektek',
      description: 'A szakmai munkatársak díjazható kihasználtsága alacsony, a projektek fedezete nem ismert.',
      likelihood: 3, impact: 3, exposureHuf: 20_000_000, remediationDays: 20,
      remediation: 'Projektszintű időrögzítés és fedezetszámítás, árazási irányelv.',
      division: 'ADVISORY', serviceFeeHuf: 700_000,
      reasoning: 'Kihasználtsági és projektfedezeti adat nélkül a veszteséges munkák rejtve maradnak, és a cég értékelése bizonytalan.',
    }),
    item({
      code: 'TAN-04', pillar: 'LEGAL', title: 'Módszertanok és szellemi termékek jogai nem a cégnél',
      description: 'A sablonok, módszertanok vagyoni jogai munkatársaknál vagy alvállalkozóknál maradtak.',
      likelihood: 2, impact: 3, exposureHuf: 10_000_000, remediationDays: 10,
      remediation: 'Munkaszerződések és megbízások kiegészítése vagyoni jogi rendelkezésekkel.',
      division: 'LEGAL', serviceFeeHuf: 400_000,
      reasoning: 'Ha a módszertan nem a cégé, a távozó munkatárs magával viheti, és a vevő a cég fő eszközének jogcímét hiányolja.',
    }),
  ],
  TRADE: [
    item({
      code: 'KER-01', pillar: 'FINANCE', title: 'Elfekvő, értékvesztés nélküli készlet',
      description: 'A készlet jelentős része 180 napnál régebbi, értékvesztés nélkül.',
      likelihood: 3, impact: 3, exposureHuf: 25_000_000, remediationDays: 10,
      remediation: 'Készletkorosítás, értékvesztés elszámolása, kiárusítási terv.',
      division: 'ACCOUNTING', serviceFeeHuf: 500_000,
      reasoning: 'Az elfekvő készlet túlértékeli a mérleget és az eredményt; a vevő vagy a bank ezt korrigálja.',
    }),
    item({
      code: 'KER-02', pillar: 'LEGAL', title: 'Forgalmazói vagy kizárólagossági jog megszűnésének kockázata',
      description: 'A fő termékek forgalmazási joga rövid felmondással megszüntethető.',
      likelihood: 2, impact: 5, exposureHuf: 0, remediationDays: 20,
      remediation: 'Forgalmazói szerződés újratárgyalása, portfólió diverzifikálása.',
      division: 'LEGAL', serviceFeeHuf: 700_000,
      reasoning: 'Ha a forgalmazási jog egy gyártói döntéssel megszűnhet, az árbevétel jelentős része bizonytalan.',
    }),
    item({
      code: 'KER-03', pillar: 'FINANCE', title: 'Vevői hitelkockázat hitelbiztosítás és hitelkeret-kezelés nélkül',
      description: 'Nincs hitelbiztosítás és írásos vevői hitelkeret-szabályzat.',
      likelihood: 3, impact: 3, exposureHuf: 20_000_000, remediationDays: 10,
      remediation: 'Hitelkeret-szabályzat, hitelbiztosítás vagy faktoring.',
      division: 'ACCOUNTING', serviceFeeHuf: 400_000,
      reasoning: 'Egy nagyobb vevő csődje fedezet nélkül közvetlen veszteség; kereskedelemben kis árrés mellett ez több havi eredményt vihet el.',
    }),
    item({
      code: 'KER-04', pillar: 'FINANCE', title: 'Fedezetlen devizakitettség importbeszerzésnél',
      description: 'A beszerzés devizában, az értékesítés forintban, fedezeti ügylet nélkül.',
      likelihood: 3, impact: 3, exposureHuf: 20_000_000, remediationDays: 10,
      remediation: 'Devizakitettség-kimutatás, fedezeti politika, árazási mechanizmus.',
      division: 'ADVISORY', serviceFeeHuf: 500_000,
      reasoning: 'Az árfolyam gyengülése a forintban rögzített eladási árak mellett közvetlenül az árrést csökkenti.',
    }),
  ],
  OTHER: [],
};

const BY_CODE = new Map(Object.values(SECTOR_RISKS).flat().map((r) => [r.code, r] as const));

export function sectorRiskTemplate(code: string): RiskItem | undefined {
  return BY_CODE.get(code);
}

/** A kiválasztott ágazatok tételei, amelyek még nincsenek a listában. */
export function missingSectorRisks(sectors: Sector[], items: RiskItem[]): RiskItem[] {
  const have = new Set(items.map((r) => r.code));
  return sectors.flatMap((s) => SECTOR_RISKS[s]).filter((r) => !have.has(r.code));
}
