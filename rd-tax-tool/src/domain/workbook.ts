/**
 * Excel export: the whole case as a workbook the tax team can check with
 * their own tools. The "Levezetés" sheet uses live Excel formulas
 * (base × rate) next to the engine's own figure and the difference, so any
 * deviation between the formula and the program is visible at a glance.
 *
 * Pure data – the browser download lives in the UI layer. Formulas are
 * passed without a leading '=': the library writes them verbatim into <f>,
 * as the xlsx format expects.
 */
import type { CellObject, Row, SheetData } from 'write-excel-file/browser';
import { COMPANY_SIZE_LABELS, FRASCATI_CRITERIA, INDUSTRY_LABELS, isInnovationContributionLiable, redFlagsFor, RISK_LABELS, TAX_RATES } from './constants';
import type { Exposure } from './exposure';
import { RULE_STATUS_LABELS, RULEBOOK, RULEBOOK_VERSION } from './rulebook';
import type { ScenarioRow } from './scenarios';
import type { Assessment, AuditResult, SavingsResult } from './types';

export interface WorkbookSheet {
  sheet: string;
  data: SheetData;
  columns: { width: number }[];
  stickyRowsCount?: number;
}

const HUF = '#,##0 "Ft"';
const PCT = '0.0%';
const NAVY = '#0B1F3F';

const money = (value: number, extra: Partial<CellObject> = {}): CellObject => ({ value: Math.round(value), type: Number, format: HUF, ...extra });
const percent = (value: number): CellObject => ({ value, type: Number, format: PCT });
const text = (value: string, extra: Partial<CellObject> = {}): CellObject => ({ value, type: String, ...extra });
const bold = (value: string): CellObject => text(value, { fontWeight: 'bold' });
const header = (labels: string[]): Row => labels.map((l) => text(l, { fontWeight: 'bold', textColor: '#FFFFFF', backgroundColor: NAVY }));
const title = (value: string): Row => [text(value, { fontWeight: 'bold', fontSize: 14, textColor: NAVY })];
const blank: Row = [];

const QUALIFICATION = { FULL: 'Teljesül', PARTIAL: 'Részben teljesül', NONE: 'Nem teljesül' } as const;
const DEADLINE = {
  NO_DATE: 'Dátum hiányzik',
  OPEN: 'Folyamatban',
  MISSED: 'Lejárt',
  REPORTED_ON_TIME: 'Határidőben bejelentve',
  REPORTED_LATE: 'Késve bejelentve',
} as const;

function summarySheet(a: Assessment, s: SavingsResult, audit: AuditResult): WorkbookSheet {
  const c = a.client;
  const rows: [string, number, string][] = [
    ['Tao – K+F kétszeres levonás', s.corporateTax.nominalSaving, 'Tao. tv. 7. § (1) t)'],
    ['Szocho – kutatói kedvezmény', s.szocho.totalSaving, 'Szocho tv. 15–16. §'],
    ['HIPA – K+F adóalap-csökkentés', s.hipaSaving, 'Htv. 39. § (1)'],
    ['Innovációs járulék', s.innovationContributionSaving, 'Inno. tv. 17. §'],
  ];
  if (s.ipBox.enabled) rows.push(['Szoftver (IP-box) – jogdíjkedvezmény', s.ipBox.annualSaving, 'Tao. tv. 7. § (1) s), Htv. 39. §']);

  const first = 13; // first data row of the savings table (1-based, see layout below)
  const data: SheetData = [
    title('K+F adódiagnosztika – vezetői összesítő'),
    [text('Ügyfél'), bold(c.companyName || '—')],
    [text('Adószám'), text(c.taxNumber || '—')],
    [text('Projekt'), text(c.projectName || '—')],
    [text('Iparág'), text(INDUSTRY_LABELS[c.industry])],
    [text('Vizsgált adóév'), { value: c.taxYear, type: Number }],
    [text('Cégméret'), text(COMPANY_SIZE_LABELS[c.companySize])],
    [text('Árbevétel'), money(c.annualRevenue)],
    [text('Adózás előtti eredmény'), money(c.profitBeforeTax)],
    [text('SZTNH-készültség'), text(`${audit.score} pont – ${RISK_LABELS[audit.level].title}`)],
    blank,
    header(['Jogcím', 'Megtakarítás / év', 'Jogszabály']),
    ...rows.map(([label, value, ref]) => [text(label), money(value), text(ref)]),
    [
      bold('Összesített tiszta adómegtakarítás / év'),
      { value: `SUM(B${first}:B${first + rows.length - 1})`, type: 'Formula', format: HUF, fontWeight: 'bold' },
    ],
    [text('Tao-hatással korrigált nettó'), money(s.netAfterCitEffect)],
    [text('Ebből tárgyévben elhatárolt Tao'), money(s.corporateTax.deferredSaving)],
    [text(`Többéves potenciál (${a.params.selfRevisionYears + 1} év)`), money(s.multiYearPotential)],
    blank,
    [text(`Szabálykönyv v${RULEBOOK_VERSION}`, { textColor: '#64748B' })],
    [text(a.seal ? `Lezárva: ${a.seal.sealedAt} · ${a.seal.sealedBy} · SHA-256 ${a.seal.hash}` : 'Nem lezárt munkaváltozat', { textColor: '#64748B' })],
  ];
  return { sheet: 'Összesítő', data, columns: [{ width: 44 }, { width: 22 }, { width: 34 }] };
}

/** Formula rows: base × rate, next to the engine's figure and the difference. */
function derivationSheet(a: Assessment, s: SavingsResult): WorkbookSheet {
  const c = a.costs;
  const liable = isInnovationContributionLiable(a.client.companySize);
  const hipaRate = Math.min(a.params.hipaRate, TAX_RATES.HIPA_MAX);
  const hipaBase = Math.min(s.hipaDeductibleBase, Math.max(0, a.client.annualRevenue));
  const ip = s.ipBox;
  const ipHipaBase = ip.enabled && hipaRate > 0 ? ip.hipaSaving / hipaRate : 0;

  const lines: [string, number, number, number, string][] = [
    ['Szocho – PhD (15. §)', c.phdGrossWages - s.szocho.phdWagesOverCap, TAX_RATES.SZOCHO * TAX_RATES.SZOCHO_RELIEF_PHD, s.szocho.phdSaving, 'bér a havi plafonig × 13%'],
    [
      'Szocho – doktorandusz (15. §)',
      c.doctoralGrossWages - s.szocho.doctoralWagesOverCap,
      TAX_RATES.SZOCHO * TAX_RATES.SZOCHO_RELIEF_DOCTORAL,
      s.szocho.doctoralSaving,
      'bér a havi plafonig × 6,5%',
    ],
    [
      'Szocho – mérnökök (16. §)',
      a.params.engineerRelief === 'SZOCHO_16' ? c.engineerGrossWages : 0,
      TAX_RATES.SZOCHO * TAX_RATES.SZOCHO_RELIEF_16,
      s.szocho.engineerSaving,
      a.params.engineerRelief === 'SZOCHO_16' ? 'mérnöki bér × 6,5%' : 'nem választott – a bér a Tao-alapban',
    ],
    ['Tao – K+F levonás', s.corporateTax.deductibleBase, TAX_RATES.CIT, s.corporateTax.nominalSaving, 'tárgyévi levonás (egyetemi többlettel) × 9%'],
    ['HIPA – K+F', hipaBase, hipaRate, s.hipaSaving, 'egyszer levonható K+F költség × helyi kulcs'],
    ['Innovációs járulék – K+F', liable ? hipaBase : 0, TAX_RATES.INNOVATION_CONTRIBUTION, s.innovationContributionSaving, liable ? 'HIPA-alap × 0,3%' : 'mikro- / kisvállalkozás – mentes'],
  ];
  if (ip.enabled) {
    lines.push(
      ['Szoftver – jogdíj (Tao)', ip.royaltyDeduction, TAX_RATES.CIT, ip.royaltyCitSaving, 'jogdíjnyereség × 50% × nexus (max. AEE 50%) × 9%'],
      ['Szoftver – jogdíj (HIPA)', ipHipaBase, hipaRate, ip.hipaSaving, 'jogdíjbevétel × helyi kulcs, nexus nélkül'],
      ['Szoftver – jogdíj (innovációs járulék)', liable ? ipHipaBase : 0, TAX_RATES.INNOVATION_CONTRIBUTION, ip.innovationContributionSaving, 'jogdíjbevétel × 0,3%'],
    );
  }

  const start = 3;
  const data: SheetData = [
    title('Számítás levezetése – képletekkel'),
    header(['Jogcím', 'Alap', 'Kulcs', 'Képlet szerint', 'Program szerint', 'Eltérés', 'Megjegyzés']),
    ...lines.map(([label, base, rate, engine, note], i): Row => {
      const r = start + i;
      return [
        text(label),
        money(base),
        percent(rate),
        { value: `ROUND(B${r}*C${r},0)`, type: 'Formula', format: HUF },
        money(engine),
        { value: `D${r}-E${r}`, type: 'Formula', format: HUF },
        text(note, { textColor: '#64748B' }),
      ];
    }),
  ];
  const end = start + lines.length - 1;
  data.push([
    bold('Összesen'),
    null,
    null,
    { value: `SUM(D${start}:D${end})`, type: 'Formula', format: HUF, fontWeight: 'bold' },
    { value: `SUM(E${start}:E${end})`, type: 'Formula', format: HUF, fontWeight: 'bold' },
    { value: `D${end + 1}-E${end + 1}`, type: 'Formula', format: HUF },
  ]);
  data.push(blank, [text('Kerekítés miatt soronként ±1 Ft eltérés előfordulhat.', { textColor: '#64748B' })]);
  return {
    sheet: 'Levezetés',
    data,
    columns: [{ width: 38 }, { width: 18 }, { width: 9 }, { width: 18 }, { width: 18 }, { width: 11 }, { width: 50 }],
    stickyRowsCount: 2,
  };
}

function softwareSheet(a: Assessment, s: SavingsResult, exposure: Exposure): WorkbookSheet | null {
  const ip = s.ipBox;
  if (!ip.enabled) return null;
  const sw = a.software;
  const data: SheetData = [
    title(`Szoftver (IP-box) – ${sw.name || 'névtelen'}`),
    [text('Minősítés'), bold(QUALIFICATION[ip.qualification.level])],
    ...ip.qualification.issues.map((i): Row => [null, text(i)]),
    blank,
    header(['Fejlesztési elem', 'Típus', 'Aktiválás', 'Bejelentés', 'Határidő', 'Státusz', 'Érték', 'Saját', 'Kapcsolt', 'Vásárolt']),
    ...sw.components.map((c, i): Row => {
      const r = ip.components[i];
      return [
        text(r?.name ?? c.name),
        text(c.kind === 'ORIGINAL' ? 'Eredeti' : 'Továbbfejlesztés'),
        text(c.capitalizedOn),
        text(c.reportedOn || '—'),
        text(r?.deadline.dueDate ?? ''),
        text(r ? DEADLINE[r.deadline.status] : ''),
        money(c.capitalizedValue),
        money(c.ownCosts),
        money(c.relatedPartyCosts),
        money(c.acquisitionCosts),
      ];
    }),
    blank,
    header(['Év', 'Nexus (kumulatív)', 'Jogdíjnyereség', 'Tao-levonás', 'Tao-megtakarítás', 'HIPA', 'Innovációs járulék', 'Összesen']),
    ...ip.years.map((y): Row => [
      { value: y.year, type: Number },
      percent(y.nexusRatio),
      money(y.royaltyProfit),
      money(y.deduction),
      money(y.citSaving),
      money(y.hipaSaving),
      money(y.innovationContributionSaving),
      money(y.total),
    ]),
    blank,
    [bold('Eladás'), text(sw.saleDate || '—')],
    [text('Árfolyamnyereség'), money(ip.sale.gain)],
    [text('Bejelentett rész aránya'), percent(ip.sale.exemptShare)],
    [text('Adóalap-csökkentés'), money(ip.sale.deduction)],
    [text('Adóköteles rész'), money(ip.sale.taxablePart)],
    [text('Egyszeri Tao-megtakarítás'), money(ip.sale.citSaving, { fontWeight: 'bold' })],
  ];
  if (exposure.items.length > 0) {
    data.push(blank, header(['Pénzben kifejezett kockázat', 'Összeg', 'Magyarázat']));
    const kind = { LOST: 'Elveszett', AT_RISK: 'Veszélyben', FOREGONE: 'Évente elmarad' } as const;
    for (const e of exposure.items) data.push([text(`${kind[e.kind]}: ${e.label}`), money(e.amount), text(e.detail)]);
  }
  return {
    sheet: 'Szoftver',
    data,
    columns: [{ width: 34 }, { width: 16 }, { width: 14 }, { width: 14 }, { width: 14 }, { width: 22 }, { width: 16 }, { width: 16 }, { width: 16 }, { width: 16 }],
  };
}

function auditSheet(a: Assessment, audit: AuditResult): WorkbookSheet {
  const flags = redFlagsFor(a.client.industry).filter((f) => a.audit.redFlags[f.id]);
  const data: SheetData = [
    title('SZTNH / Frascati kockázati audit'),
    [text('Pontszám'), bold(`${audit.score} / 100 – ${RISK_LABELS[audit.level].title}`)],
    blank,
    header(['Kritérium', 'Értékelés (0–4)', 'Súly', 'Pont']),
    ...FRASCATI_CRITERIA.map((c): Row => {
      const sc = audit.criterionScores.find((x) => x.id === c.id);
      return [text(c.label), { value: sc?.rating ?? 0, type: Number }, { value: c.weight, type: Number }, { value: sc?.points ?? 0, type: Number, format: '0.0' }];
    }),
    blank,
    header(['Kockázati jelző', 'Levonás']),
    ...(flags.length > 0 ? flags.map((f): Row => [text(f.label), { value: -f.penalty, type: Number }]) : [[text('Nincs bejelölt jelző')] as Row]),
    blank,
    header(['Javaslat']),
    ...[...audit.knockOuts, ...audit.recommendations].map((r): Row => [text(r, { wrap: true })]),
  ];
  if (a.audit.notes.trim()) data.push(blank, [bold('Szakértői megjegyzés')], [text(a.audit.notes, { wrap: true })]);
  return { sheet: 'Audit', data, columns: [{ width: 70 }, { width: 16 }, { width: 8 }, { width: 8 }] };
}

function scenarioSheet(rows: ScenarioRow[]): WorkbookSheet {
  const data: SheetData = [
    title('Mi lenne, ha… – forgatókönyvek'),
    header(['Forgatókönyv', 'Éves megtakarítás', 'Éves eltérés', 'Idén pénzben', 'Eladáskor (egyszeri)', 'Átvehető']),
    ...rows.map((r): Row => [
      text(r.title),
      money(r.annual),
      money(r.annualDelta),
      money(r.thisYearDelta),
      money(r.saleDelta),
      text(r.applicable ? 'igen' : 'csak összevetés'),
    ]),
  ];
  if (rows.length === 0) data.push([text('Ehhez az ügyhöz nincs releváns forgatókönyv.')]);
  return { sheet: 'Forgatókönyvek', data, columns: [{ width: 58 }, { width: 18 }, { width: 16 }, { width: 16 }, { width: 20 }, { width: 16 }] };
}

function rulebookSheet(): WorkbookSheet {
  const data: SheetData = [title(`Szabálykönyv v${RULEBOOK_VERSION}`), header(['Terület', 'Szabály', 'Érték', 'Jogszabály', 'Státusz', 'Megjegyzés'])];
  for (const group of RULEBOOK) {
    for (const r of group.rules) {
      data.push([text(group.title), text(r.rule, { wrap: true }), text(r.value), text(r.reference), text(RULE_STATUS_LABELS[r.status]), text(r.note ?? '', { wrap: true })]);
    }
  }
  return { sheet: 'Szabálykönyv', data, columns: [{ width: 28 }, { width: 60 }, { width: 22 }, { width: 22 }, { width: 24 }, { width: 50 }], stickyRowsCount: 2 };
}

export function buildWorkbook(input: {
  assessment: Assessment;
  savings: SavingsResult;
  audit: AuditResult;
  exposure: Exposure;
  scenarios: ScenarioRow[];
}): WorkbookSheet[] {
  const { assessment: a, savings: s, audit, exposure, scenarios } = input;
  return [
    summarySheet(a, s, audit),
    derivationSheet(a, s),
    softwareSheet(a, s, exposure),
    auditSheet(a, audit),
    scenarioSheet(scenarios),
    rulebookSheet(),
  ].filter((x): x is WorkbookSheet => x !== null);
}

/** kf-diagnosztika-pelda-kft-2025.xlsx */
export function workbookFileName(a: Assessment): string {
  const slug = (a.client.companyName || 'ugyfel')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  return `kf-diagnosztika-${slug}-${a.client.taxYear}.xlsx`;
}

