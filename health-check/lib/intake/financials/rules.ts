import type { EngagementKind } from '@/lib/engagement/kinds';
import type { KnownFact } from '@/lib/interview/types';
import { formatHufShort } from '@/lib/risk/engine';
import { financialRiskTemplate } from '@/lib/risk/financialRisks';
import type { Pillar, Scale5 } from '@/lib/risk/types';
import type { CompanyProfile } from '@/lib/risk/valuation';
import type { TableAnalysis } from '../tables/metrics';
import type { TableKind } from '../tables/spec';
import type { CompanySuggestion, IntakeResult, IntakeSuggestion } from '../types';
import { AUDIT_OPINION_LABEL, FACT_SPEC, FIN_FIELD_LABEL, type FactKey, type FinancialProfile, type FinField, type FinSource, yearRatios } from './model';
import { FIN_THRESHOLDS as T } from './thresholds';

/**
 * Pénzügyi alapadatok → javaslatok a mátrixba, cégadat-pontosítás, tények az
 * interjúkhoz. Rögzített szabályok, AI nélkül; a küszöböket a szakértő hagyja
 * jóvá (thresholds.ts). Minden javaslat megnevezi a forrást: melyik év melyik
 * sora, honnan (irat oldallal és idézettel, vagy kézi bevitel).
 */

const TRANSACTION: EngagementKind[] = ['VENDOR_DD', 'BUY_SIDE_DD', 'SUCCESSION', 'POST_MERGER'];
const pct = (n: number) => `${Math.round(n * 100)}%`;
const num = (n: number, d = 1) => n.toLocaleString('hu-HU', { maximumFractionDigits: d });

export interface FinancialContext {
  kind: EngagementKind;
  company: CompanyProfile;
  materialityHuf: number;
  tables?: Partial<Record<TableKind, TableAnalysis>>;
  headcount?: number | null;
  litigationFlag?: boolean;
  refDate?: Date;
}

export function financialFindings(f: FinancialProfile, ctx: FinancialContext): IntakeResult {
  const suggestions: IntakeSuggestion[] = [];
  const companySuggestions: CompanySuggestion[] = [];
  const facts: KnownFact[] = [];
  const ref = ctx.refDate ?? new Date();

  const where = (src: FinSource | undefined) => (src ? `${src.ref}${src.kind === 'DOCUMENT' ? '' : ` (${sourceWord(src)})`}` : 'Pénzügyi alapadatok');
  const fieldRef = (year: number, field: FinField) => {
    const src = f.years.find((y) => y.year === year)?.sources[field];
    return { text: `${year}. év, ${FIN_FIELD_LABEL[field]}: ${where(src)}`, quote: src?.quote };
  };
  const factRef = (key: FactKey) => {
    const src = f.factSources[key];
    return { text: `${FACT_SPEC[key].label}: ${where(src)}`, quote: src?.quote };
  };

  const sug = (
    code: string,
    L: Scale5,
    I: Scale5,
    rationale: string,
    refs: { text: string; quote?: string }[],
    anchor: string,
    exposure?: number | null,
    title?: string,
  ) => {
    const t = financialRiskTemplate(code);
    const pillar: Pillar = t?.pillar ?? 'FINANCE';
    const refText = refs.map((r) => r.text).join('; ');
    const quote =
      refs
        .map((r) => r.quote)
        .filter(Boolean)
        .join(' · ') || undefined;
    suggestions.push({
      key: `FIN:${code}:${anchor}:${L}${I}:${exposure ?? ''}`,
      origin: 'FINANCIALS',
      code: t ? code : null,
      pillar,
      title: title ?? t?.title ?? code,
      rationale,
      evidence: `Pénzügyi alapadatok – ${refText}`,
      ref: refText,
      quote,
      link: { page: 'adatok', tab: 'financials', anchor },
      likelihood: L,
      impact: I,
      exposureHufEstimate: exposure ?? null,
    });
  };

  const ratios = yearRatios(f);
  const latest = f.years[0];
  const lr = ratios[0];
  const prev = f.years[1];
  const pr = ratios[1];
  const v = latest?.values ?? {};
  const fx = f.facts;

  // ── Könyvvizsgálat ───────────────────────────────────────────
  if (fx.auditOpinion && fx.auditOpinion !== 'UNQUALIFIED' && fx.auditOpinion !== 'NOT_AUDITED') {
    const severe = fx.auditOpinion === 'ADVERSE' || fx.auditOpinion === 'DISCLAIMER';
    sug(
      'PA-01',
      5,
      severe ? 5 : 4,
      `A könyvvizsgálói jelentés: ${AUDIT_OPINION_LABEL[fx.auditOpinion].toLowerCase()}. A beszámoló számai ennek okai tisztázásáig nem tekinthetők megbízhatónak.`,
      [factRef('auditOpinion')],
      'fin-audit',
    );
  }
  if (fx.goingConcern) {
    sug('PA-02', 5, 5, 'A könyvvizsgáló lényeges bizonytalanságot jelzett a vállalkozás folytatására vonatkozóan.', [factRef('goingConcern')], 'fin-audit');
  }
  if (fx.managementLetterIssues && fx.managementLetterIssues > 0) {
    sug(
      'PA-18',
      3,
      fx.managementLetterIssues >= 3 ? 4 : 3,
      `A vezetői levél ${fx.managementLetterIssues} belső kontroll hiányosságot jelez.`,
      [factRef('managementLetterIssues')],
      'fin-audit',
    );
  }
  if (fx.filingDate && latest) {
    const deadline = new Date(Date.UTC(latest.year + 1, 4, 31));
    const filed = new Date(fx.filingDate);
    if (!Number.isNaN(filed.getTime()) && filed > deadline) {
      sug(
        'PA-16',
        3,
        2,
        `A ${latest.year}. évi beszámolót ${fx.filingDate} napon helyezték letétbe, a május 31-i határidő után.`,
        [factRef('filingDate')],
        'fin-audit',
      );
    }
  }

  // ── Tőkehelyzet ──────────────────────────────────────────────
  if (latest && v.equity != null && v.shareCapital != null && v.equity < v.shareCapital) {
    const negative = v.equity < 0;
    const twoYears = prev?.values.equity != null && prev.values.shareCapital != null && prev.values.equity < prev.values.shareCapital;
    sug(
      'PA-03',
      negative || twoYears ? 5 : 4,
      5,
      `${latest.year} végén a saját tőke ${formatHufShort(v.equity)}, a jegyzett tőke ${formatHufShort(v.shareCapital)}${negative ? ' (negatív saját tőke)' : ''}${
        twoYears ? `; ${prev!.year}-ben is a jegyzett tőke alatt volt` : ''
      }. A Ptk. tőkevédelmi szabályai intézkedést írhatnak elő; a pontos feltételt jogász ellenőrzi.`,
      [fieldRef(latest.year, 'equity'), fieldRef(latest.year, 'shareCapital')],
      'fin-figures',
    );
    if (fx.dividendHuf && fx.dividendHuf > 0) {
      sug(
        'PA-17',
        3,
        4,
        `Osztalék (${formatHufShort(fx.dividendHuf)}) a jegyzett tőke alatti saját tőke mellett.`,
        [factRef('dividendHuf'), fieldRef(latest.year, 'equity')],
        'fin-figures',
        fx.dividendHuf,
      );
    }
  }

  // ── Trendek és mutatók ───────────────────────────────────────
  if (latest && lr?.revenueChange != null && lr.revenueChange <= -T.REVENUE_DROP.value) {
    sug(
      'PA-04',
      4,
      lr.revenueChange <= -2 * T.REVENUE_DROP.value ? 5 : 4,
      `Az árbevétel ${prev!.year} → ${latest.year}: ${formatHufShort(prev!.values.revenue!)} → ${formatHufShort(v.revenue!)} (${pct(lr.revenueChange)}). Küszöb: −${pct(T.REVENUE_DROP.value)}.`,
      [fieldRef(latest.year, 'revenue'), fieldRef(prev!.year, 'revenue')],
      'fin-ratios',
    );
  }
  if (latest && lr?.ebitda != null) {
    const drop = pr?.ebitdaMargin != null && lr.ebitdaMargin != null ? pr.ebitdaMargin - lr.ebitdaMargin : null;
    if (lr.ebitda < 0 || (drop != null && drop >= T.EBITDA_MARGIN_DROP.value)) {
      sug(
        'PA-05',
        4,
        lr.ebitda < 0 ? 5 : 4,
        lr.ebitda < 0
          ? `Az EBITDA ${latest.year}-ben negatív: ${formatHufShort(lr.ebitda)} (üzemi eredmény + értékcsökkenés).`
          : `Az EBITDA-ráta ${pct(pr!.ebitdaMargin!)} → ${pct(lr.ebitdaMargin!)} (${prev!.year} → ${latest.year}); küszöb: ${num(T.EBITDA_MARGIN_DROP.value * 100, 0)} százalékpont romlás.`,
        [fieldRef(latest.year, 'operatingProfit'), fieldRef(latest.year, 'depreciation')],
        'fin-ratios',
      );
    }
  }
  if (latest && lr?.netDebtToEbitda != null && lr.netDebtToEbitda > T.NET_DEBT_EBITDA.value) {
    sug(
      'PA-06',
      3,
      lr.netDebtToEbitda > 2 * T.NET_DEBT_EBITDA.value ? 5 : 4,
      `Nettó adósság / EBITDA ${latest.year}-ben ${num(lr.netDebtToEbitda)}× (küszöb: ${num(T.NET_DEBT_EBITDA.value)}×).`,
      [fieldRef(latest.year, 'longTermLiabilities'), fieldRef(latest.year, 'shortTermLiabilities'), fieldRef(latest.year, 'cash')],
      'fin-ratios',
    );
  }
  if (latest && lr?.currentRatio != null && lr.currentRatio < T.CURRENT_RATIO.value) {
    sug(
      'PA-07',
      4,
      lr.currentRatio < 0.7 ? 5 : 4,
      `Likviditási ráta ${latest.year}-ben ${num(lr.currentRatio, 2)} (forgóeszköz / rövid lejáratú kötelezettség; küszöb: ${num(T.CURRENT_RATIO.value)}).`,
      [fieldRef(latest.year, 'currentAssets'), fieldRef(latest.year, 'shortTermLiabilities')],
      'fin-ratios',
    );
  }

  // ── Adó és hatóság ──────────────────────────────────────────
  if ((fx.taxDebtHuf ?? 0) > 0 || fx.taxClean === false) {
    sug(
      'PA-08',
      4,
      (fx.taxDebtHuf ?? 0) >= ctx.materialityHuf ? 4 : 3,
      [fx.taxDebtHuf ? `NAV-tartozás: ${formatHufShort(fx.taxDebtHuf)}.` : '', fx.taxClean === false ? 'Nem szerepel a köztartozásmentes adatbázisban.' : '']
        .filter(Boolean)
        .join(' '),
      [fx.taxDebtHuf ? factRef('taxDebtHuf') : factRef('taxClean')],
      'fin-tax',
      fx.taxDebtHuf ?? null,
    );
  }
  if (fx.lastTaxAuditFinding || (fx.selfRevisions ?? 0) >= 3) {
    sug(
      'PA-09',
      3,
      3,
      [
        fx.lastTaxAuditFinding ? `Az utolsó NAV-ellenőrzés${fx.lastTaxAuditYear ? ` (${fx.lastTaxAuditYear})` : ''} megállapítással zárult.` : '',
        (fx.selfRevisions ?? 0) >= 3 ? `${fx.selfRevisions} önellenőrzés két év alatt.` : '',
      ]
        .filter(Boolean)
        .join(' '),
      [fx.lastTaxAuditFinding ? factRef('lastTaxAuditFinding') : factRef('selfRevisions')],
      'fin-tax',
    );
  }

  // ── Függő kötelezettségek, perek ─────────────────────────────
  if ((fx.contingentHuf ?? 0) > 0) {
    const big = fx.contingentHuf! >= ctx.materialityHuf;
    sug(
      'PA-10',
      big ? 3 : 2,
      big ? 4 : 3,
      `Függő kötelezettség (kezesség, garancia): ${formatHufShort(fx.contingentHuf!)}; a lényegességi küszöb ${formatHufShort(ctx.materialityHuf)}.`,
      [factRef('contingentHuf')],
      'fin-legal',
      fx.contingentHuf,
    );
  }
  if ((fx.litigationCount ?? 0) > 0 || (fx.litigationHuf ?? 0) > 0) {
    sug(
      'PA-11',
      3,
      (fx.litigationHuf ?? 0) >= ctx.materialityHuf ? 4 : 3,
      `Folyamatban lévő perek: ${fx.litigationCount ?? '?'} db${fx.litigationHuf ? `, összesen ${formatHufShort(fx.litigationHuf)} perértékkel` : ''}.`,
      [fx.litigationHuf ? factRef('litigationHuf') : factRef('litigationCount')],
      'fin-legal',
      fx.litigationHuf ?? null,
    );
  }

  // ── Finanszírozás és támogatás ───────────────────────────────
  if (fx.covenantsOk === false || (fx.loanChangeOfControl && TRANSACTION.includes(ctx.kind))) {
    sug(
      'PA-13',
      fx.covenantsOk === false ? 4 : 3,
      4,
      [
        fx.covenantsOk === false ? 'A hitelkovenánsok nem teljesülnek.' : '',
        fx.loanChangeOfControl ? 'A hitelszerződés tulajdonosváltáskor felmondható; a tervezett tranzakció ezt kiválthatja.' : '',
      ]
        .filter(Boolean)
        .join(' '),
      [fx.covenantsOk === false ? factRef('covenantsOk') : factRef('loanChangeOfControl')],
      'fin-funding',
      fx.loanHuf ?? null,
    );
  }
  if (fx.loanMaturity && (fx.loanHuf ?? 0) > 0) {
    const m = new Date(fx.loanMaturity);
    const months = (m.getTime() - ref.getTime()) / (30.44 * 86_400_000);
    if (!Number.isNaN(months) && months >= 0 && months <= T.LOAN_MATURITY_MONTHS.value) {
      sug(
        'PA-14',
        3,
        3,
        `${formatHufShort(fx.loanHuf!)} hitel ${fx.loanMaturity} napon lejár (${Math.round(months)} hónap múlva).`,
        [factRef('loanMaturity'), factRef('loanHuf')],
        'fin-funding',
      );
    }
  }
  if ((fx.ownerLoansHuf ?? 0) > 0) {
    sug(
      'PA-15',
      3,
      TRANSACTION.includes(ctx.kind) ? 4 : 3,
      `Tagi / tulajdonosi kölcsön egyenlege: ${formatHufShort(fx.ownerLoansHuf!)}.`,
      [factRef('ownerLoansHuf')],
      'fin-funding',
      fx.ownerLoansHuf,
    );
  }
  if ((fx.grantHuf ?? 0) > 0 && fx.grantSustainUntil && new Date(fx.grantSustainUntil) > ref) {
    const consent = fx.grantOwnerChangeConsent && TRANSACTION.includes(ctx.kind);
    sug(
      'PA-12',
      consent ? 4 : 3,
      4,
      `Támogatás: ${formatHufShort(fx.grantHuf!)}, fenntartási kötelezettség ${fx.grantSustainUntil}-ig.${
        consent ? ' A tulajdonosváltáshoz a támogató hozzájárulása kell.' : ''
      }`,
      [factRef('grantHuf'), factRef('grantSustainUntil')],
      'fin-funding',
      fx.grantHuf,
    );
  }

  // ── Létszám, biztosítás ─────────────────────────────────────
  if (fx.liabilityInsurance === false) {
    sug('PA-19', 3, 3, 'A társaságnak nincs felelősségbiztosítása.', [factRef('liabilityInsurance')], 'fin-other');
  }
  if (fx.turnoverPct != null && fx.turnoverPct > T.TURNOVER.value) {
    suggestions.push({
      key: `FIN:HR-04:turnover:${Math.round(fx.turnoverPct * 100)}`,
      origin: 'FINANCIALS',
      code: 'HR-04',
      pillar: 'HR',
      title: 'Nem versenyképes javadalmazás / magas fluktuáció',
      rationale: `Éves fluktuáció ${pct(fx.turnoverPct)} (küszöb: ${pct(T.TURNOVER.value)}).`,
      evidence: `Pénzügyi alapadatok – ${factRef('turnoverPct').text}`,
      ref: factRef('turnoverPct').text,
      link: { page: 'adatok', tab: 'financials', anchor: 'fin-other' },
      likelihood: 4,
      impact: 3,
    });
  }

  // ── Keresztellenőrzés a táblákkal és a tényállással ───────────
  const tol = T.RECONCILE_TOLERANCE.value;
  const sales = ctx.tables?.SALES_BY_CUSTOMER;
  if (latest && v.revenue && sales && sales.totalHuf > 0) {
    const diff = Math.abs(sales.totalHuf - v.revenue) / v.revenue;
    if (diff > tol) {
      sug(
        'PA-20',
        3,
        3,
        `A beszámoló árbevétele (${latest.year}: ${formatHufShort(v.revenue)}) ${pct(diff)}-kal eltér a vevőnkénti árbevétel tábla összegétől (${formatHufShort(sales.totalHuf)}). Tűrés: ${pct(tol)}.`,
        [fieldRef(latest.year, 'revenue'), { text: `Adattábla: ${sales.fileName}` }],
        'fin-ratios',
      );
    }
  }
  const aging = ctx.tables?.AR_AGING;
  if (latest && v.receivables && aging && aging.totalHuf > 0) {
    const diff = Math.abs(aging.totalHuf - v.receivables) / v.receivables;
    if (diff > tol) {
      sug(
        'PA-20',
        3,
        3,
        `A mérleg vevőállománya (${formatHufShort(v.receivables)}) ${pct(diff)}-kal eltér a vevői korosítás összegétől (${formatHufShort(aging.totalHuf)}). Tűrés: ${pct(tol)}.`,
        [fieldRef(latest.year, 'receivables'), { text: `Adattábla: ${aging.fileName}` }],
        'fin-ratios',
      );
    }
  }
  if (fx.relatedPartyInNotes && !ctx.tables?.RELATED_PARTY) {
    suggestions.push({
      key: 'FIN:FIN-01:related-missing',
      origin: 'FINANCIALS',
      code: 'FIN-01',
      pillar: 'FINANCE',
      title: 'Transzferár-dokumentáció hiánya',
      rationale: 'A kiegészítő melléklet kapcsolt ügyletet mutat be, de a kapcsolt ügyletek táblája és a transzferár-nyilvántartás nem érkezett meg.',
      evidence: `Pénzügyi alapadatok – ${factRef('relatedPartyInNotes').text}`,
      ref: factRef('relatedPartyInNotes').text,
      quote: f.factSources.relatedPartyInNotes?.quote,
      link: { page: 'adatok', tab: 'financials', anchor: 'fin-legal' },
      likelihood: 3,
      impact: 3,
    });
  }
  if (fx.avgHeadcount && ctx.headcount && Math.abs(fx.avgHeadcount - ctx.headcount) / ctx.headcount > T.HEADCOUNT_TOLERANCE.value) {
    facts.push({
      id: 'FIN-headcount',
      pillar: 'HR',
      statement: `A melléklet átlagos létszáma (${fx.avgHeadcount} fő) eltér a tényállásban megadottól (${ctx.headcount} fő): érdemes rákérdezni a megbízási és vállalkozói jogviszonyokra.`,
      source: factRef('avgHeadcount').text,
      askInInterview: true,
    });
  }
  if ((fx.litigationCount ?? 0) > 0 && ctx.litigationFlag === false) {
    facts.push({
      id: 'FIN-litigation',
      pillar: 'LEGAL',
      statement: `A pénzügyi adatok szerint ${fx.litigationCount} per van folyamatban, a tényállásban jogvita nincs jelölve.`,
      source: factRef('litigationCount').text,
      askInInterview: true,
    });
  }

  // ── Cégadatok pontosítása a beszámolóból ─────────────────────
  if (latest && v.revenue && Math.abs(v.revenue - ctx.company.revenueHuf) / Math.max(1, ctx.company.revenueHuf) > 0.02) {
    companySuggestions.push({
      key: `FIN:revenue:${latest.year}:${Math.round(v.revenue)}`,
      origin: 'FINANCIALS',
      field: 'revenueHuf',
      value: Math.round(v.revenue),
      label: `Árbevétel: ${formatHufShort(ctx.company.revenueHuf)} → ${formatHufShort(v.revenue)} (${latest.year}. évi beszámoló)`,
      evidence: fieldRef(latest.year, 'revenue').text,
    });
  }
  if (latest && lr?.grossMargin != null && lr.grossMargin > 0 && Math.abs(lr.grossMargin - ctx.company.grossMarginPct) > 0.02) {
    companySuggestions.push({
      key: `FIN:margin:${latest.year}:${Math.round(lr.grossMargin * 1000)}`,
      origin: 'FINANCIALS',
      field: 'grossMarginPct',
      value: Math.round(lr.grossMargin * 1000) / 1000,
      label: `Fedezeti hányad: ${pct(ctx.company.grossMarginPct)} → ${pct(lr.grossMargin)} (árbevétel − anyag- és személyi jellegű ráfordítás, ${latest.year})`,
      evidence: `${fieldRef(latest.year, 'revenue').text}; ${fieldRef(latest.year, 'materialCosts').text}; ${fieldRef(latest.year, 'personnelCosts').text}`,
    });
  }
  if (latest && lr?.dso != null && Math.abs(lr.dso - ctx.company.actualDsoDays) >= 5) {
    companySuggestions.push({
      key: `FIN:dso:${latest.year}:${Math.round(lr.dso)}`,
      origin: 'FINANCIALS',
      field: 'actualDsoDays',
      value: Math.round(lr.dso),
      label: `Tényleges fizetési idő: ${ctx.company.actualDsoDays} → ${Math.round(lr.dso)} nap (mérleg szerinti vevők / árbevétel × 365, ${latest.year})`,
      evidence: `${fieldRef(latest.year, 'receivables').text}; ${fieldRef(latest.year, 'revenue').text}`,
    });
  }
  if (pr?.dso != null && lr?.dso != null && lr.dso - pr.dso >= T.DSO_WORSENING.value) {
    facts.push({
      id: 'FIN-dso',
      pillar: 'FINANCE',
      statement: `A vevői fizetési idő ${Math.round(pr.dso)} → ${Math.round(lr.dso)} napra romlott (${prev!.year} → ${latest!.year}).`,
      source: `${fieldRef(latest!.year, 'receivables').text}`,
      askInInterview: true,
    });
  }

  // Tények az interjúkhoz (a legfontosabb számok)
  if (latest && v.revenue != null) {
    facts.push({
      id: 'FIN-revenue',
      pillar: 'FINANCE',
      statement: `${latest.year}. évi árbevétel ${formatHufShort(v.revenue)}${lr?.ebitda != null ? `, EBITDA ${formatHufShort(lr.ebitda)}` : ''}.`,
      source: fieldRef(latest.year, 'revenue').text,
      askInInterview: false,
    });
  }

  return { suggestions, companySuggestions, facts };
}

function sourceWord(src: FinSource): string {
  switch (src.kind) {
    case 'MANUAL':
      return `kézi bevitel${src.by ? `, ${src.by}` : ''}`;
    case 'CLIENT_ORAL':
      return 'az ügyfél szóbeli közlése';
    case 'INTERVIEW':
      return 'interjú';
    case 'PUBLIC':
      return 'nyilvános adat';
    default:
      return 'irat';
  }
}
