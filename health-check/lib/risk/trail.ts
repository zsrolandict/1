import type { IntakeTab, PageId } from '@/lib/guide';
import { formatHufShort } from './engine';
import type { RiskItem, RiskSource } from './types';

/**
 * Bizonyíték-lánc és változásnapló egy kockázati tételhez.
 *
 * Minden forrás, amely a tételt javasolta vagy megerősítette, külön bejegyzés:
 * pontos hely, szó szerinti idézet, indoklás, hatás a pontszámra, és ki fogadta
 * el mikor. A szakértő módosításai a változásnaplóba kerülnek; ha csökkenti a
 * súlyosságot, indoklást kell írnia (a riport jelzi, ha hiányzik).
 */

export type TrailKind = RiskSource | 'REGISTRY' | 'FINANCIALS' | 'SUGGESTED';
export type TrailActor = 'RULE' | 'AI' | 'EXPERT';

/** Hová ugorjon a „Megnyitás”: oldal, adatgyűjtési fül, elem azonosítója. */
export interface SourceLink {
  page: PageId;
  tab?: IntakeTab;
  anchor?: string;
}

export interface EvidenceEntry {
  id: string;
  kind: TrailKind;
  actor: TrailActor;
  /** Pontos hely: „Keretszerződés.pdf, 7. oldal”, „Q09 kérdés – Igen”. */
  ref: string;
  /** Szó szerinti idézet a forrásból (ha van). */
  quote?: string;
  /** Miért kockázat: a szabály szövege vagy az AI indoklása. */
  rationale?: string;
  /** Hatás a tételre: „V 3→4 · H 4→5 · kitettség-becslés 120 M Ft”. */
  effect?: string;
  /** 0–1, csak AI-forrásnál. */
  confidence?: number;
  /** Ki fogadta el (név); null = nem ismert. */
  acceptedBy?: string | null;
  at: string;
  link?: SourceLink;
}

export type ChangeField = 'identified' | 'likelihood' | 'impact' | 'exposure';

export interface ChangeEntry {
  at: string;
  by: string | null;
  field: ChangeField;
  from: string;
  to: string;
  /** Csökkenti-e a súlyosságot (kivétel, alacsonyabb pont vagy összeg). */
  reduces: boolean;
  /** Kötelező, ha `reduces`. */
  reason?: string;
}

export const TRAIL_KIND_LABEL: Record<TrailKind, string> = {
  MANUAL: 'Szakértői döntés',
  CHECKLIST: 'Ügyfélkérdőív',
  DATA_TABLE: 'Adattábla',
  CROSS_CHECK: 'Keresztellenőrzés',
  AI_DOCUMENT: 'Dokumentum (AI)',
  AI_INTERVIEW: 'Interjú (AI)',
  AI_SYNTHESIS: 'Összkép (AI)',
  REGISTRY: 'Cégkivonat',
  FINANCIALS: 'Pénzügyi alapadatok',
  SUGGESTED: 'Javasolt tétel',
};

export const ACTOR_LABEL: Record<TrailActor, string> = {
  RULE: 'Rögzített szabály',
  AI: 'AI-javaslat',
  EXPERT: 'Szakértő',
};

export const CHANGE_FIELD_LABEL: Record<ChangeField, string> = {
  identified: 'Azonosítva',
  likelihood: 'Valószínűség',
  impact: 'Hatás',
  exposure: 'Kitettség',
};

let seq = 0;
export const entryId = () => `ev-${Date.now().toString(36)}-${(seq++).toString(36)}`;

/** A tétel bizonyíték-lánca; régi mentésnél a szöveges bizonyítékból egy bejegyzés. */
export function trailOf(r: RiskItem): EvidenceEntry[] {
  const list = Array.isArray(r.trail) ? r.trail.filter((e) => e && typeof e.ref === 'string') : [];
  if (list.length || !r.evidence) return list;
  return [
    {
      id: `legacy-${r.id}`,
      kind: r.source ?? 'MANUAL',
      actor: r.source && r.source.startsWith('AI_') ? 'AI' : r.source && r.source !== 'MANUAL' ? 'RULE' : 'EXPERT',
      ref: r.evidence,
      at: '',
    },
  ];
}

/** Hány független forrás erősíti meg (a szakértői döntés nem forrás). */
export function sourceCount(r: RiskItem): number {
  return new Set(
    trailOf(r)
      .filter((e) => e.kind !== 'MANUAL' && e.kind !== 'SUGGESTED')
      .map((e) => `${e.kind}:${e.link?.anchor ?? e.ref}`),
  ).size;
}

export function historyOf(r: RiskItem): ChangeEntry[] {
  return Array.isArray(r.history) ? r.history.filter((h) => h && typeof h.field === 'string') : [];
}

/** Indoklás nélküli csökkentések (a sorban jelezzük, a riport felsorolja). */
export function missingReasons(r: RiskItem): ChangeEntry[] {
  return historyOf(r).filter((h) => h.reduces && !h.reason?.trim());
}

/** Hatás szövege: mi változott a tételen a forrás elfogadásakor. */
export function describeEffect(before: Pick<RiskItem, 'identified' | 'likelihood' | 'impact'>, after: RiskItem, exposureEstimate?: number | null): string {
  const parts: string[] = [];
  if (!before.identified) parts.push('azonosítva');
  const lv = before.identified && before.likelihood !== after.likelihood ? `${before.likelihood}→${after.likelihood}` : `${after.likelihood}`;
  const iv = before.identified && before.impact !== after.impact ? `${before.impact}→${after.impact}` : `${after.impact}`;
  parts.push(`valószínűség ${lv}`, `hatás ${iv}`);
  if (exposureEstimate) parts.push(`kitettség-becslés ${formatHufShort(exposureEstimate)}`);
  return parts.join(' · ');
}

/**
 * Új forrás hozzáfűzése (ugyanabból a forrásból ugyanarra a helyre csak egyszer).
 * `prior`: a módosítás előtti lánc – a beolvasztáskor az új szöveges bizonyíték
 * még ne váljon „régi” bejegyzéssé.
 */
export function addEntry(r: RiskItem, e: Omit<EvidenceEntry, 'id' | 'at'> & { at?: string }, prior: EvidenceEntry[] = trailOf(r)): RiskItem {
  const trail = prior;
  const dup = trail.some((x) => x.kind === e.kind && x.ref === e.ref && (x.quote ?? '') === (e.quote ?? ''));
  if (dup) return r;
  return { ...r, trail: [...trail, { ...e, id: entryId(), at: e.at ?? new Date().toISOString() }] };
}

const COALESCE_MS = 2 * 60 * 1000;

/**
 * A szakértő módosításának naplózása. Csak azonosított tételnél (és magánál a
 * pipálásnál) naplózunk; a gyors egymás utáni gépelést egy bejegyzésbe vonjuk.
 * A kézi bepipálás forrásként is bekerül a láncba.
 */
export function recordChange(prev: RiskItem, next: RiskItem, by: string | null, exposure: (r: RiskItem) => number, now = new Date()): RiskItem {
  const changes: Omit<ChangeEntry, 'at' | 'by'>[] = [];
  if (prev.identified !== next.identified) {
    changes.push({ field: 'identified', from: prev.identified ? 'igen' : 'nem', to: next.identified ? 'igen' : 'nem', reduces: !next.identified });
  } else if (next.identified) {
    if (prev.likelihood !== next.likelihood)
      changes.push({ field: 'likelihood', from: String(prev.likelihood), to: String(next.likelihood), reduces: next.likelihood < prev.likelihood });
    if (prev.impact !== next.impact) changes.push({ field: 'impact', from: String(prev.impact), to: String(next.impact), reduces: next.impact < prev.impact });
    const a = exposure(prev);
    const b = exposure(next);
    if (a !== b) changes.push({ field: 'exposure', from: String(a), to: String(b), reduces: b < a });
  }
  if (!changes.length) return next;

  const history = [...historyOf(prev)];
  for (const c of changes) {
    const last = history[history.length - 1];
    const recent = last && last.field === c.field && last.by === by && !last.reason && now.getTime() - new Date(last.at).getTime() < COALESCE_MS;
    if (recent) {
      // Egy szerkesztés: az eredeti kiinduló érték marad, a cél frissül.
      const merged: ChangeEntry = { ...last, to: c.to, at: now.toISOString(), reduces: isReduction(c.field, last.from, c.to) };
      if (merged.from === merged.to) history.pop();
      else history[history.length - 1] = merged;
    } else {
      history.push({ ...c, at: now.toISOString(), by });
    }
  }
  let out: RiskItem = { ...next, history };
  if (!prev.identified && next.identified) {
    out = addEntry(out, {
      kind: 'MANUAL',
      actor: 'EXPERT',
      ref: 'Kézi azonosítás a Red Flag mátrixban',
      acceptedBy: by,
      at: now.toISOString(),
    });
  }
  return out;
}

function isReduction(field: ChangeField, from: string, to: string): boolean {
  if (field === 'identified') return to === 'nem';
  return Number(to) < Number(from);
}

/** Indoklás rögzítése egy naplóbejegyzéshez (index a `history` tömbben). */
export function setReason(r: RiskItem, index: number, reason: string): RiskItem {
  const history = historyOf(r).map((h, i) => (i === index ? { ...h, reason } : h));
  return { ...r, history };
}

export function formatChange(h: ChangeEntry): string {
  const f = (v: string) => (h.field === 'exposure' ? formatHufShort(Number(v)) : v);
  return `${CHANGE_FIELD_LABEL[h.field]}: ${f(h.from)} → ${f(h.to)}`;
}

export function formatWhen(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('hu-HU', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

/** Forrásnézet: mely azonosított tételek hivatkoznak erre a forrásra (horgony szerint). */
export function itemsFromAnchor(items: RiskItem[], anchor: string): RiskItem[] {
  return items.filter((r) => r.identified && trailOf(r).some((e) => e.link?.anchor === anchor));
}
