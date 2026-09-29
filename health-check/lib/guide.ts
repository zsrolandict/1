import { checklistProgress } from '@/lib/intake/checklist';
import type { IntakeState } from '@/lib/intake/state';
import type { InterviewRecords } from '@/lib/interview/records';
import type { ModuleId } from '@/lib/modules';

/**
 * Kalauz: a projekt állapotából kiszámolja, melyik lépés kész, és mi a
 * következő. Nem dönt és nem módosít semmit, csak mutatja az utat.
 */

export type PageId = 'adatok' | 'interjuk' | 'matrix' | 'projekt';
export type IntakeTab = 'case' | 'checklist' | 'tables' | 'documents' | 'overview';

export interface GuideStep {
  id: string;
  module: ModuleId | null;
  title: string;
  done: boolean;
  detail: string;
  how: string;
  target: { page: PageId; tab?: IntakeTab };
}

export interface GuideInput {
  intake: IntakeState;
  interviews: InterviewRecords;
  identified: number;
  snapshots: number;
  hoursLogged: number;
  benchmarked: boolean;
  disabled: ModuleId[];
}

export function guideSteps(g: GuideInput): GuideStep[] {
  const { intake } = g;
  const p = checklistProgress(intake.answers, intake.profile.sectors);
  const tables = Object.keys(intake.tables).length;
  const analyzed = Object.values(g.interviews).filter((r) => r?.analysis).length;
  const profileDone = intake.profile.sectors.length > 0 || intake.profile.narrative.trim().length > 0;
  const steps: GuideStep[] = [
    {
      id: 'case', module: 'CASE', title: 'Tényállás rögzítése', done: profileDone,
      detail: profileDone ? 'Ágazat / leírás megadva.' : 'Még nincs ágazat és leírás.',
      how: 'Add meg az ágazatot, a létszámot és a jellemzőket (pl. generációváltás). Ebből áll össze az iratbekérési lista, és bekerülnek az ágazati kockázatok.',
      target: { page: 'adatok', tab: 'case' },
    },
    {
      id: 'registry', module: 'REGISTRY', title: 'Cégkivonat beolvasása', done: Boolean(intake.registry),
      detail: intake.registry ? 'Kiolvasva.' : 'Nincs beolvasva.',
      how: 'Másold be az e-cégjegyzék ingyenes cégkivonatát a Tényállás fülön: tulajdonosok, vezetők, eljárások, változások.',
      target: { page: 'adatok', tab: 'case' },
    },
    {
      id: 'checklist', module: 'CHECKLIST', title: 'Ügyfélkérdőív', done: p.total > 0 && p.answered >= Math.ceil(p.total * 0.8),
      detail: `${p.answered}/${p.total} kérdés megválaszolva.`,
      how: 'Töltsd ki az ügyféllel együtt vagy a visszaküldött válaszokból. A jelző válaszokból kockázati javaslat lesz.',
      target: { page: 'adatok', tab: 'checklist' },
    },
    {
      id: 'tables', module: 'TABLES', title: 'Adattáblák betöltése', done: tables >= 2,
      detail: `${tables}/4 tábla betöltve.`,
      how: 'Vevő- és szállítói folyószámla, bérlista, szerződéslista Excelben vagy CSV-ben. A mutatókból (koncentráció, lejárt tételek) javaslat lesz.',
      target: { page: 'adatok', tab: 'tables' },
    },
    {
      id: 'documents', module: 'DOCUMENTS', title: 'Dokumentumok elemzése', done: intake.documents.length > 0,
      detail: `${intake.documents.length} dokumentum elemezve.`,
      how: 'Töltsd fel a kulcsszerződéseket, szabályzatokat. Az AI csak szó szerinti idézettel igazolt találatot ad; te döntesz.',
      target: { page: 'adatok', tab: 'documents' },
    },
    {
      id: 'overview', module: 'OVERVIEW', title: 'Összkép és ellentmondások', done: Boolean(intake.synthesis),
      detail: intake.synthesis ? 'Összkép elkészült.' : 'Még nincs összkép.',
      how: 'Nézd át a források közötti ellentmondásokat, és kérj AI-összképet: ebből egyedi, a cégre szabott kockázatok jönnek.',
      target: { page: 'adatok', tab: 'overview' },
    },
    {
      id: 'interviews', module: 'INTERVIEWS', title: 'Interjúk', done: analyzed > 0,
      detail: `${analyzed} interjú elemezve.`,
      how: 'Az interjútervből kérdezz; a hangfelvételből leirat, abból AI-elemzés készül. Az ellentmondásokra külön figyelmeztet.',
      target: { page: 'interjuk' },
    },
    {
      id: 'matrix', module: null, title: 'Kockázatok véglegesítése', done: g.identified > 0,
      detail: `${g.identified} azonosított tétel.`,
      how: 'A mátrixban nézd át a javasolt tételeket, állítsd a valószínűséget és a hatást, majd exportáld a riportot (PDF, Excel).',
      target: { page: 'matrix' },
    },
    {
      id: 'timesheet', module: 'TIMESHEET', title: 'Órák rögzítése', done: g.hoursLogged > 0,
      detail: `${g.hoursLogged} óra rögzítve.`,
      how: 'Rögzítsd a ráfordított órákat pillérenként; a program jelez 80%-os keretfelhasználásnál.',
      target: { page: 'projekt' },
    },
    {
      id: 'followup', module: 'FOLLOWUP', title: 'Záró pillanatkép', done: g.snapshots > 0,
      detail: g.snapshots ? `${g.snapshots} pillanatkép.` : 'Nincs pillanatkép.',
      how: 'Zárásnál ments pillanatképet a mátrix alján: a visszanéző Health Checknél ehhez méri a javulást.',
      target: { page: 'matrix' },
    },
    {
      id: 'knowledge', module: 'KNOWLEDGE', title: 'Felvétel a tudástárba', done: g.benchmarked,
      detail: g.benchmarked ? 'Felvéve.' : 'Még nincs felvéve.',
      how: 'A lezárt projektet vedd fel anonimizálva: a következő hasonló projektnél jelzi, mi szokott előfordulni.',
      target: { page: 'projekt' },
    },
  ];
  return steps.filter((s) => !s.module || !g.disabled.includes(s.module));
}

export function nextStep(steps: GuideStep[]): GuideStep | null {
  return steps.find((s) => !s.done) ?? null;
}

export const PAGE_TIPS: Record<PageId, string[]> = {
  adatok: [
    'Balról jobbra haladj: tényállás → kérdőív → táblák → dokumentumok → összkép.',
    'A jobb oldali panelen a javaslatok csak akkor kerülnek a mátrixba, ha elfogadod őket.',
    'Valós ügyféladatot csak az EU-s, adatfeldolgozói szerződéssel rendelkező beállítással tölts fel.',
  ],
  interjuk: [
    'Az interjúterv a típushoz és az ismert tényekhez igazodik; a hiányzó iratokra is rákérdez.',
    'Ha az átvilágítás típusát menet közben átállítod, az elemzést futtasd újra (a program jelzi).',
    'Kettőnél több beszélő is lehet; a leiratban nevezd el a beszélőket.',
  ],
  matrix: [
    'Piros: pontszám ≥ 15, vagy a várható veszteség eléri a lényegességi küszöböt.',
    'A „Mi lenne, ha…” panelen megnézheted, mennyit javít egy-egy intézkedés.',
    'Eladói átvilágításnál a vevői kérdéslista az Excel-exportba is bekerül.',
  ],
  projekt: [
    'Az időkeret a típus óraszámából jön (pillérenként + projektvezetés).',
    'A tudástárba csak anonim adat kerül: cégnév, összeg, bizonyíték nem.',
  ],
};

const TAB_KEY = 'ict-hc:intake-tab';
export const INTAKE_TAB_EVENT = 'ict-hc:intake-tab';

/** Kalauzból érkező kérés egy adatgyűjtési fül megnyitására (oldalváltáson át is). */
export function requestIntakeTab(tab: IntakeTab): void {
  try {
    sessionStorage.setItem(TAB_KEY, tab);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent(INTAKE_TAB_EVENT, { detail: tab }));
}

export function takeRequestedIntakeTab(): IntakeTab | null {
  try {
    const t = sessionStorage.getItem(TAB_KEY) as IntakeTab | null;
    sessionStorage.removeItem(TAB_KEY);
    return t;
  } catch {
    return null;
  }
}
