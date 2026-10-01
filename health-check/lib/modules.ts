import type { PageId } from '@/lib/guide';

/**
 * Modulkapcsolók: egy-egy modul passzívra tehető, ekkor kimarad a
 * felületről és a kalauz lépései közül. A Red Flag mátrix (a kockázatok
 * és a riport) mindig bekapcsolt: minden más ebbe dolgozik.
 * A prototípus a böngészőben tárolja; élesben projektenként az
 * `engagements.disabled_modules` oszlop (0009-es migráció).
 */

export type ModuleId =
  | 'CASE'
  | 'REGISTRY'
  | 'FINANCIALS'
  | 'CHECKLIST'
  | 'TABLES'
  | 'DOCUMENTS'
  | 'OVERVIEW'
  | 'INTERVIEWS'
  | 'WHATIF'
  | 'BUYER_QUESTIONS'
  | 'FOLLOWUP'
  | 'TIMESHEET'
  | 'KNOWLEDGE';

export type ModuleArea = 'Adatgyűjtés' | 'Interjúk' | 'Red Flag mátrix' | 'Projekt';

export interface ModuleInfo {
  id: ModuleId;
  area: ModuleArea;
  label: string;
  description: string;
  ai: boolean;
}

export const MODULES: ModuleInfo[] = [
  { id: 'CASE', area: 'Adatgyűjtés', label: 'Tényállás és iratbekérés', description: 'Ágazat, létszám, jellemzők; ebből az iratbekérési lista.', ai: false },
  { id: 'REGISTRY', area: 'Adatgyűjtés', label: 'Cégkivonat', description: 'Nyilvános cégadatok kiolvasása a cégkivonatból, figyelmeztető jelek.', ai: true },
  {
    id: 'FINANCIALS',
    area: 'Adatgyűjtés',
    label: 'Pénzügyi alapadatok',
    description: 'Beszámoló, melléklet, könyvvizsgálói jelentés kulcsszámai és beírható tények, szabályokkal.',
    ai: false,
  },
  { id: 'CHECKLIST', area: 'Adatgyűjtés', label: 'Ügyfélkérdőív', description: 'Igen/nem kérdések, szabályalapú előjelölés.', ai: false },
  { id: 'TABLES', area: 'Adatgyűjtés', label: 'Adattáblák', description: 'Vevő-, szállító-, bér- és szerződéslista mutatói.', ai: false },
  { id: 'DOCUMENTS', area: 'Adatgyűjtés', label: 'Dokumentumelemzés', description: 'Szerződések, szabályzatok AI-elemzése idézettel.', ai: true },
  { id: 'OVERVIEW', area: 'Adatgyűjtés', label: 'Összkép', description: 'Keresztellenőrzés, ellentmondások, AI-szintézis.', ai: true },
  { id: 'INTERVIEWS', area: 'Interjúk', label: 'Interjúk', description: 'Interjúterv, hangfelvétel-leirat, AI-elemzés.', ai: true },
  { id: 'WHATIF', area: 'Red Flag mátrix', label: 'Mi lenne, ha…', description: 'Javítások hatásának szimulációja.', ai: false },
  { id: 'BUYER_QUESTIONS', area: 'Red Flag mátrix', label: 'Vevői kérdéslista', description: 'Várható vevői kérdések, válaszvázlat, iratok.', ai: false },
  { id: 'FOLLOWUP', area: 'Red Flag mátrix', label: 'Utókövetés', description: 'Javítások állapota, pillanatkép és összevetés.', ai: false },
  { id: 'TIMESHEET', area: 'Projekt', label: 'Időkeret', description: 'Órarögzítés, keretfigyelés, költség és fedezet.', ai: false },
  { id: 'KNOWLEDGE', area: 'Projekt', label: 'Tudástár', description: 'Anonim tapasztalatok a lezárt projektekből.', ai: false },
];

export const INTAKE_MODULES: ModuleId[] = ['CASE', 'FINANCIALS', 'CHECKLIST', 'TABLES', 'DOCUMENTS', 'OVERVIEW'];
export const PROJECT_MODULES: ModuleId[] = ['TIMESHEET', 'KNOWLEDGE'];

/** Melyik oldal mely modulokból áll; null = mindig látszik (Red Flag mátrix). */
export const PAGE_MODULES: Record<PageId, ModuleId[] | null> = {
  adatok: INTAKE_MODULES,
  interjuk: ['INTERVIEWS'],
  matrix: null,
  projekt: PROJECT_MODULES,
};

/** Az oldal akkor látszik a menüben, ha legalább egy modulja be van kapcsolva. */
export function pageVisible(page: PageId, isOn: (id: ModuleId) => boolean): boolean {
  const mods = PAGE_MODULES[page];
  return !mods || mods.some(isOn);
}

const KEY = 'ict-hc:modules:v1';
const EVENT = 'ict-hc:modules';

export function loadDisabled(): ModuleId[] {
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    const known = new Set(MODULES.map((m) => m.id));
    return Array.isArray(list) ? list.filter((x): x is ModuleId => known.has(x as ModuleId)) : [];
  } catch {
    return [];
  }
}

export function saveDisabled(list: ModuleId[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify([...new Set(list)]));
  } catch {
    /* privát mód */
  }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(EVENT));
}

export function toggleModule(list: ModuleId[], id: ModuleId): ModuleId[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

/** Feliratkozás a változásra (másik lapon vagy ugyanitt átkapcsolva). */
export function subscribeModules(cb: () => void): () => void {
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) cb();
  };
  window.addEventListener(EVENT, cb);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener('storage', onStorage);
  };
}
