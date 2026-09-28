import type { KnownFact } from '@/lib/interview/types';
import { formatHufShort } from '@/lib/risk/engine';
import type { Scale5 } from '@/lib/risk/types';
import type { CompanyProfile } from '@/lib/risk/valuation';
import { templateFor } from '../apply';
import type { CompanySuggestion, IntakeResult, IntakeSuggestion, ValuationPatch } from '../types';
import { dayToIso, parseBool, parseDay, parseNumber, type Grid } from './parse';
import { TABLE_SPECS, type ColumnMapping, type TableKind } from './spec';

/**
 * Táblázat → mutatók → javaslatok. Tisztán számolás, AI nélkül:
 * ugyanarra a táblára mindig ugyanaz az eredmény, és minden szám
 * visszavezethető a sorokra.
 */

export interface TableInput {
  kind: TableKind;
  fileName: string;
  grid: Grid;
  headerRow: number;
  mapping: ColumnMapping;
  /** Fordulónap (napsorszám) a korosításhoz. */
  refDay?: number | null;
}

export interface TableContext {
  company: CompanyProfile;
  /** Ha a vevőnkénti árbevétel is be van töltve, a DSO abból számol. */
  salesTotalHuf?: number | null;
}

export interface Metric {
  label: string;
  value: string;
  /** Küszöb feletti érték kiemeléshez. */
  alert?: boolean;
}

export interface TableAnalysis {
  kind: TableKind;
  fileName: string;
  rows: number;
  skipped: number;
  /** Az összeg oszlop összege (pl. árbevétel a DSO-hoz). */
  totalHuf: number;
  metrics: Metric[];
  /** Legnagyobb partnerek (a felületre; a riportba nem kerül név). */
  topPartners: { name: string; amountHuf: number; share: number }[];
  /** Partnerenkénti összeg (legfeljebb 200) – a táblák közötti keresztellenőrzéshez. */
  partners: { name: string; amountHuf: number }[];
  /** Gépi mutatók a keresztellenőrzéshez (arányok 0–1). */
  values: Record<string, number>;
  warnings: string[];
  result: IntakeResult;
  /** Vevői korosítás: a legnagyobb 180 napon túli tartozó. */
  over180Top?: { name: string; amountHuf: number } | null;
}

const TOTAL_ROW = /^(osszesen|mindosszesen|total|sum|osszeg)\b/i;
const pct = (x: number) => `${(x * 100).toLocaleString('hu-HU', { maximumFractionDigits: 1 })}%`;
const plain = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

interface Row { partner: string; amount: number; cells: Grid[number] }

function readRows(input: TableInput): { rows: Row[]; skipped: number } {
  const { grid, headerRow, mapping } = input;
  const rows: Row[] = [];
  let skipped = 0;
  for (const cells of grid.slice(headerRow + 1)) {
    const partner = String(cells[mapping.partner ?? -1] ?? '').trim();
    const amount = parseNumber(cells[mapping.amount ?? -1] ?? null);
    if (!partner || TOTAL_ROW.test(plain(partner)) || amount == null) {
      skipped++;
      continue;
    }
    rows.push({ partner, amount, cells });
  }
  return { rows, skipped };
}

function byPartner(rows: Row[]): { name: string; amountHuf: number }[] {
  const m = new Map<string, { name: string; amountHuf: number }>();
  for (const r of rows) {
    const k = plain(r.partner);
    const cur = m.get(k) ?? { name: r.partner, amountHuf: 0 };
    cur.amountHuf += r.amount;
    m.set(k, cur);
  }
  return [...m.values()].sort((a, b) => b.amountHuf - a.amountHuf);
}

function suggestion(
  kind: TableKind,
  code: string,
  likelihood: Scale5,
  impact: Scale5,
  rationale: string,
  evidence: string,
  valuationPatch?: ValuationPatch,
): IntakeSuggestion {
  const t = templateFor(code)!;
  const patchKey = valuationPatch ? (valuationPatch.type === 'REVENUE_SHARE' ? valuationPatch.share : valuationPatch.count) : '';
  return {
    key: `TBL:${kind}:${code}:${likelihood}${impact}:${patchKey}`,
    origin: 'DATA_TABLE',
    code,
    pillar: t.pillar,
    title: t.title,
    rationale,
    evidence,
    likelihood,
    impact,
    valuationPatch,
  };
}

function fact(kind: TableKind, pillar: KnownFact['pillar'], statement: string, source: string): KnownFact {
  return { id: `TBL-${kind}`, pillar, statement, source, askInInterview: false };
}

export function analyzeTable(input: TableInput, ctx: TableContext): TableAnalysis {
  const spec = TABLE_SPECS[input.kind];
  const { rows, skipped } = readRows(input);
  const total = rows.reduce((s, r) => s + r.amount, 0);
  const partners = byPartner(rows);
  const topPartners = partners.slice(0, 5).map((p) => ({ ...p, share: total > 0 ? p.amountHuf / total : 0 }));
  const source = `${spec.label} (${input.fileName})`;
  const base = { kind: input.kind, fileName: input.fileName, rows: rows.length, skipped, totalHuf: total, topPartners, partners: partners.slice(0, 200), values: {} as Record<string, number> };
  const warnings: string[] = [];
  if (!rows.length) {
    return { ...base, metrics: [], warnings: ['Egyetlen feldolgozható sor sincs. Ellenőrizze az oszlopokat.'], result: { suggestions: [], companySuggestions: [], facts: [] } };
  }
  if (total <= 0) warnings.push('Az összegek összege nem pozitív – ellenőrizze az összeg oszlopot.');

  switch (input.kind) {
    case 'AR_AGING': {
      const { mapping } = input;
      const refDay = input.refDay ?? null;
      let unknownDays = 0;
      const overdue = rows.map((r) => {
        if (mapping.daysOverdue !== undefined) return parseNumber(r.cells[mapping.daysOverdue] ?? null);
        const due = parseDay(r.cells[mapping.dueDate ?? -1] ?? null);
        return due != null && refDay != null ? refDay - due : null;
      });
      if (mapping.daysOverdue === undefined && refDay == null) warnings.push('Adja meg a fordulónapot a korosításhoz.');
      const over90Rows = rows.filter((_, i) => {
        const d = overdue[i];
        if (d == null) unknownDays++;
        return d != null && d > 90;
      });
      if (unknownDays) warnings.push(`${unknownDays} sornál nem állapítható meg a késés.`);
      const over90 = over90Rows.reduce((s, r) => s + r.amount, 0);
      const over180Rows = rows.filter((_, i) => (overdue[i] ?? 0) > 180);
      const over180 = over180Rows.reduce((s, r) => s + r.amount, 0);
      const topOver180 = byPartner(over180Rows)[0];
      const share90 = total > 0 ? over90 / total : 0;
      const topOver90 = byPartner(over90Rows)[0];
      const topOver90Share = topOver90 && over90 > 0 ? topOver90.amountHuf / over90 : 0;
      const revenue = ctx.salesTotalHuf && ctx.salesTotalHuf > 0 ? ctx.salesTotalHuf : ctx.company.revenueHuf;
      const dso = revenue > 0 ? Math.round((total / revenue) * 365) : 0;
      const gap = dso - ctx.company.industryDsoDays;
      const when = refDay != null ? `, fordulónap ${dayToIso(refDay)}` : '';

      const companySuggestions: CompanySuggestion[] =
        dso > 0 && dso !== ctx.company.actualDsoDays
          ? [{
              key: `TBL:AR_AGING:DSO:${dso}`,
              origin: 'DATA_TABLE',
              field: 'actualDsoDays',
              value: dso,
              label: `Tényleges DSO: ${ctx.company.actualDsoDays} → ${dso} nap`,
              evidence: `${source}: nyitott állomány ${formatHufShort(total)} / árbevétel ${formatHufShort(revenue)} × 365`,
            }]
          : [];

      const suggestions: IntakeSuggestion[] = [];
      if (share90 >= 0.15 || gap >= 15) {
        const L: Scale5 = share90 >= 0.3 ? 4 : share90 >= 0.15 ? 3 : 2;
        const I: Scale5 = gap >= 30 ? 4 : gap >= 15 ? 3 : 2;
        const conc = topOver90Share >= 0.5 ? ` A 90 napon túli állomány ${pct(topOver90Share)}-a egyetlen vevőnél van.` : '';
        suggestions.push(suggestion(
          'AR_AGING', 'FIN-03', L, I,
          `A 90 napon túl lejárt állomány ${pct(share90)}, a DSO ${dso} nap az iparági ${ctx.company.industryDsoDays} nappal szemben.${conc}`,
          `${source}${when}: 90 napon túl ${formatHufShort(over90)} (${pct(share90)}), DSO ${dso} nap`,
        ));
      }
      return {
        ...base,
        values: { share90, over90, over180, dso, topOver90Share },
        over180Top: topOver180 ?? null,
        warnings,
        metrics: [
          { label: 'Nyitott vevőállomány', value: formatHufShort(total) },
          { label: '90 napon túl lejárt', value: `${formatHufShort(over90)} (${pct(share90)})`, alert: share90 >= 0.15 },
          { label: 'Legnagyobb késedelmes vevő aránya', value: over90 > 0 ? pct(topOver90Share) : '—', alert: topOver90Share >= 0.5 },
          { label: '180 napon túl lejárt', value: formatHufShort(over180), alert: over180 > 0 },
          { label: 'DSO (vevőállomány / árbevétel × 365)', value: `${dso} nap`, alert: gap >= 15 },
          { label: 'Iparági DSO', value: `${ctx.company.industryDsoDays} nap` },
        ],
        result: {
          suggestions,
          companySuggestions,
          facts: [fact('AR_AGING', 'FINANCE', `Nyitott vevőállomány ${formatHufShort(total)}, ebből 90 napon túl lejárt ${formatHufShort(over90)} (${pct(share90)}); DSO ${dso} nap`, `${source}${when}`)],
        },
      };
    }

    case 'SALES_BY_CUSTOMER': {
      const top1 = topPartners[0]?.share ?? 0;
      const top5 = topPartners.reduce((s, p) => s + p.share, 0);
      const hhi = Math.round(partners.reduce((s, p) => s + (total > 0 ? ((p.amountHuf / total) * 100) ** 2 : 0), 0));
      const companySuggestions: CompanySuggestion[] =
        total > 0 && Math.abs(total - ctx.company.revenueHuf) / Math.max(1, ctx.company.revenueHuf) > 0.02
          ? [{
              key: `TBL:SALES:REVENUE:${Math.round(total)}`,
              origin: 'DATA_TABLE',
              field: 'revenueHuf',
              value: Math.round(total),
              label: `Árbevétel: ${formatHufShort(ctx.company.revenueHuf)} → ${formatHufShort(total)}`,
              evidence: `${source}: ${rows.length} sor összege`,
            }]
          : [];
      const suggestions: IntakeSuggestion[] = [];
      if (top1 >= 0.25) {
        const L: Scale5 = hhi >= 2500 ? 4 : 3;
        const I: Scale5 = top1 >= 0.4 ? 5 : 4;
        suggestions.push(suggestion(
          'SALES_BY_CUSTOMER', 'OPS-05', L, I,
          `A legnagyobb vevő az árbevétel ${pct(top1)}-át adja (top 5: ${pct(top5)}, HHI ${hhi}).`,
          `${source}: legnagyobb vevő ${pct(top1)}, top 5 ${pct(top5)}, HHI ${hhi}`,
          { type: 'REVENUE_SHARE', share: Math.round(top1 * 1000) / 1000 },
        ));
      }
      return {
        ...base,
        values: { top1, top5, hhi },
        warnings,
        metrics: [
          { label: 'Árbevétel összesen', value: formatHufShort(total) },
          { label: 'Vevők száma', value: String(partners.length) },
          { label: 'Legnagyobb vevő aránya', value: pct(top1), alert: top1 >= 0.25 },
          { label: 'Top 5 vevő aránya', value: pct(top5), alert: top5 >= 0.6 },
          { label: 'Koncentráció (HHI, 0–10 000)', value: hhi.toLocaleString('hu-HU'), alert: hhi >= 1500 },
        ],
        result: {
          suggestions,
          companySuggestions,
          facts: [fact('SALES_BY_CUSTOMER', 'OPERATIONS', `A legnagyobb vevő az árbevétel ${pct(top1)}-át, a top 5 vevő ${pct(top5)}-át adja`, source)],
        },
      };
    }

    case 'PURCHASES_BY_SUPPLIER': {
      const top1 = topPartners[0]?.share ?? 0;
      const top3 = topPartners.slice(0, 3).reduce((s, p) => s + p.share, 0);
      const suggestions: IntakeSuggestion[] = [];
      if (top1 >= 0.4) {
        suggestions.push(suggestion(
          'PURCHASES_BY_SUPPLIER', 'OPS-01', top1 >= 0.6 ? 4 : 3, 4,
          `A legnagyobb beszállító a beszerzés ${pct(top1)}-át adja.`,
          `${source}: legnagyobb szállító ${pct(top1)}, top 3 ${pct(top3)}`,
        ));
      }
      return {
        ...base,
        values: { top1, top3 },
        warnings,
        metrics: [
          { label: 'Beszerzés összesen', value: formatHufShort(total) },
          { label: 'Szállítók száma', value: String(partners.length) },
          { label: 'Legnagyobb szállító aránya', value: pct(top1), alert: top1 >= 0.4 },
          { label: 'Top 3 szállító aránya', value: pct(top3) },
        ],
        result: {
          suggestions,
          companySuggestions: [],
          facts: [fact('PURCHASES_BY_SUPPLIER', 'OPERATIONS', `A legnagyobb beszállító a beszerzés ${pct(top1)}-át adja`, source)],
        },
      };
    }

    case 'RELATED_PARTY': {
      const THRESHOLD = 50_000_000;
      const col = input.mapping.hasDoc ?? -1;
      const docs = rows.map((r) => parseBool(r.cells[col] ?? null));
      const unknown = docs.filter((d) => d == null).length;
      if (unknown) warnings.push(`${unknown} sornál nem egyértelmű, van-e nyilvántartás (igen/nem).`);
      const missing = rows.filter((r, i) => r.amount >= THRESHOLD && docs[i] === false);
      const missingSum = missing.reduce((s, r) => s + r.amount, 0);
      const above = rows.filter((r) => r.amount >= THRESHOLD).length;
      const suggestions: IntakeSuggestion[] = [];
      if (missing.length) {
        suggestions.push(suggestion(
          'RELATED_PARTY', 'FIN-01', 4, missing.length >= 3 ? 4 : 3,
          `${above} db 50 M Ft feletti kapcsolt ügyletből ${missing.length} db-hoz nincs transzferár-nyilvántartás.`,
          `${source}: ${missing.length} db nyilvántartás nélküli ügylet, összesen ${formatHufShort(missingSum)}`,
          { type: 'PER_ITEM', count: missing.length },
        ));
      }
      return {
        ...base,
        values: { above, missing: missing.length, missingSum },
        warnings,
        metrics: [
          { label: 'Kapcsolt ügyletek', value: `${rows.length} db, ${formatHufShort(total)}` },
          { label: '50 M Ft feletti ügyletek', value: `${above} db` },
          { label: 'Ebből nyilvántartás nélkül', value: `${missing.length} db (${formatHufShort(missingSum)})`, alert: missing.length > 0 },
        ],
        result: {
          suggestions,
          companySuggestions: [],
          facts: [fact('RELATED_PARTY', 'FINANCE', `${above} db 50 M Ft feletti kapcsolt ügylet, ebből ${missing.length} db transzferár-nyilvántartás nélkül`, source)],
        },
      };
    }
  }
}
