import { adjustmentsFor } from '@/lib/engagement/adjustments';
import { ENGAGEMENT_KINDS } from '@/lib/engagement/kinds';
import { PILLAR_LABEL, RAG_LABEL, WINDOW_LABEL } from '@/lib/risk/catalog';
import { DEFAULT_OPTIONS, PILLARS, PROBABILITY, scoreRisk } from '@/lib/risk/engine';
import { ASSUMPTION_STATUS_LABEL, ASSUMPTIONS, REMAINING_JUDGEMENT } from '@/lib/risk/assumptions';
import { describeProposal, discussionOf, VERDICT_LABEL } from '@/lib/risk/review';
import { missingReasons, sourceCount, trailOf, TRAIL_KIND_LABEL } from '@/lib/risk/trail';
import type { RiskItem, Scale5 } from '@/lib/risk/types';
import { resolveExposure } from '@/lib/risk/valuation';
import { buildWorkbook } from './excelExport';
import type { ReportInput } from './model';
import { writeXlsx, type CellValue, type Sheet } from './xlsx';

/**
 * Levezetés-munkafüzet a tanácsadónak: ugyanaz a számítás, mint a programban,
 * de élő Excel-képletekkel. A sárga cellák (bemenetek és paraméterek) átírhatók,
 * és látszik, mi változik tőlük. A tárolt értékek a program számításai, így a
 * fájl képletek újraszámolása nélkül is a képernyővel egyező számokat mutat.
 */

const PAR = "'Paraméterek'";
const LEV = "'Levezetés'";
const p = (row: number) => `${PAR}!$B$${row}`;

// A Paraméterek munkalap sorai (a képletek ezekre hivatkoznak).
const ROW = {
  prob1: 2, // 2–6: az 1–5 valószínűséghez tartozó esély
  red: 7,
  amber: 8,
  materiality: 9,
  healthFactor: 10,
  quickWin: 11,
  revenue: 12,
  margin: 13,
  dsoActual: 14,
  dsoIndustry: 15,
  weight0: 16, // 16–19: pillér-súlyok PILLARS sorrendben
} as const;

export function buildDerivationWorkbook(input: ReportInput, items: RiskItem[]): Sheet[] {
  const kind = ENGAGEMENT_KINDS[input.kind];
  const opts = {
    ...DEFAULT_OPTIONS,
    materialityHuf: input.materialityHuf,
    company: input.company,
    pillarWeights: kind.weights,
    adjustments: adjustmentsFor(input.kind),
  };
  const a = input.assessment;
  const byId = new Map(a.risks.map((r) => [r.id, r]));
  const c = input.company;

  // ── Paraméterek ─────────────────────────────────────────────────
  const params: Sheet = {
    name: 'Paraméterek',
    columns: [
      { header: 'Paraméter', width: 44 },
      { header: 'Érték', width: 18 },
      { header: 'Megjegyzés', width: 70, format: 'wrap' },
    ],
    rows: [
      ...([1, 2, 3, 4, 5] as Scale5[]).map((n) => [
        `${n}-es valószínűség esélye`,
        { v: PROBABILITY[n], fmt: 'inputPct' as const },
        n === 1 ? 'A várható veszteség = kitettség × esély. Kezdő szakmai becslés.' : '',
      ]),
      ['Piros sáv alsó határa (pont)', { v: 15, fmt: 'input' as const }, 'Pont = valószínűség × hatás (1–25).'],
      ['Sárga sáv alsó határa (pont)', { v: 8, fmt: 'input' as const }, 'Ez alatt zöld.'],
      ['Lényegességi küszöb', { v: input.materialityHuf, fmt: 'inputHuf' as const }, 'Ha a várható veszteség eléri, a tétel a pontszámtól függetlenül piros.'],
      ['Health Score levonási szorzó', { v: 0.6, fmt: 'inputDec' as const }, 'Tételenként a pillér maradékát 1 − (pont/25) × szorzó arányban csökkenti.'],
      [
        'Gyors javítás felső határa (munkanap)',
        { v: opts.quickWinMaxDays, fmt: 'input' as const },
        'Nem zöld és legfeljebb ennyi munkanap → 0–30 napos időablak.',
      ],
      ['Éves árbevétel', { v: c.revenueHuf, fmt: 'inputHuf' as const }, 'A képletes kitettségek alapja.'],
      ['Fedezeti hányad', { v: c.grossMarginPct, fmt: 'inputPct' as const }, ''],
      ['Tényleges vevői fizetési idő (nap)', { v: c.actualDsoDays, fmt: 'input' as const }, ''],
      ['Iparági vevői fizetési idő (nap)', { v: c.industryDsoDays, fmt: 'input' as const }, ''],
      ...PILLARS.map((pl) => [
        `Súly: ${PILLAR_LABEL[pl]}`,
        { v: kind.weights[pl], fmt: 'inputPct' as const },
        pl === 'FINANCE' ? `Az átvilágítás típusa (${kind.label}) adja.` : '',
      ]),
    ],
  };

  // ── Levezetés ───────────────────────────────────────────────────
  const n = items.length + 1; // utolsó adatsor
  const rng = (col: string) => `${LEV}!$${col}$2:$${col}$${n}`;
  const rows: CellValue[][] = items.map((item, i) => {
    const r = i + 2;
    const eff = scoreRisk(item, opts);
    const scored = byId.get(item.id);
    const adj = item.ignoreKindAdjustment ? undefined : opts.adjustments?.[item.code];
    const ex = resolveExposure(item, c);
    const f = item.valuation?.formula;
    let mode = 'Kézi becslés';
    let p1: CellValue = '';
    let p2: CellValue = '';
    let exposure: CellValue = { v: ex.valueHuf, fmt: 'inputHuf' };
    if (ex.source === 'OVERRIDE') mode = 'Szakértői felülírás';
    else if (ex.source === 'FORMULA' && f?.type === 'REVENUE_SHARE') {
      mode = `Árbevétel-arány (${f.label})`;
      p1 = { v: f.share, fmt: 'inputPct' };
      p2 = { v: f.marginBased ? 1 : 0, fmt: 'input' };
      exposure = { f: `ROUND(${p(ROW.revenue)}*N${r}*IF(O${r}=1,${p(ROW.margin)},1),0)`, v: ex.valueHuf };
    } else if (ex.source === 'FORMULA' && f?.type === 'PER_ITEM') {
      mode = `Darab × tételösszeg (${f.label})`;
      p1 = { v: f.count, fmt: 'input' };
      p2 = { v: f.unitAmountHuf, fmt: 'inputHuf' };
      exposure = { f: `ROUND(N${r},0)*O${r}`, v: ex.valueHuf };
    } else if (ex.source === 'FORMULA' && f?.type === 'DSO_GAP') {
      mode = 'Fizetési idő különbsége';
      exposure = { f: `ROUND(${p(ROW.revenue)}/365*MAX(0,${p(ROW.dsoActual)}-${p(ROW.dsoIndustry)}),0)`, v: ex.valueHuf };
    }
    const scoreBand = RAG_LABEL[eff.score >= 15 ? 'RED' : eff.score >= 8 ? 'AMBER' : 'GREEN'];
    const trail = trailOf(item).filter((e) => e.kind !== 'MANUAL' && e.kind !== 'SUGGESTED');
    const reasons = missingReasons(item);
    return [
      item.code,
      item.title,
      PILLAR_LABEL[item.pillar],
      { v: item.identified ? 1 : 0, fmt: 'input' },
      { v: item.likelihood, fmt: 'input' },
      { v: item.impact, fmt: 'input' },
      { v: adj?.dL ?? 0, fmt: 'input' },
      { v: adj?.dI ?? 0, fmt: 'input' },
      { f: `MIN(5,MAX(1,E${r}+G${r}))`, v: eff.likelihood },
      { f: `MIN(5,MAX(1,F${r}+H${r}))`, v: eff.impact },
      { f: `I${r}*J${r}`, v: eff.score },
      { f: `IF(K${r}>=${p(ROW.red)},"Piros",IF(K${r}>=${p(ROW.amber)},"Sárga","Zöld"))`, v: scoreBand },
      mode,
      p1,
      p2,
      exposure,
      { f: `INDEX(${PAR}!$B$${ROW.prob1}:$B$${ROW.prob1 + 4},I${r})`, v: eff.probability },
      { f: `ROUND(P${r}*Q${r},0)`, v: eff.expectedLossHuf },
      { f: `IF(R${r}>=${p(ROW.materiality)},"igen","")`, v: eff.expectedLossHuf >= input.materialityHuf ? 'igen' : '' },
      { f: `IF(OR(L${r}="Piros",S${r}="igen"),"Piros",L${r})`, v: RAG_LABEL[eff.rag] },
      { v: item.remediationDays, fmt: 'input' },
      { f: `IF(AND(T${r}<>"Zöld",U${r}<=${p(ROW.quickWin)}),"igen","")`, v: eff.quickWin ? 'igen' : '' },
      {
        f: `IF(V${r}="igen","${WINDOW_LABEL.D0_30}",IF(T${r}="Piros","${WINDOW_LABEL.D31_60}",IF(T${r}="Sárga","${WINDOW_LABEL.D61_90}","${WINDOW_LABEL.BACKLOG}")))`,
        v: WINDOW_LABEL[eff.window],
      },
      {
        f: `IF(D${r}=1,K${r}/25*0.5+R${r}/MAX(1,MAXIFS(${rng('R')},${rng('D')},1))*0.5+IF(V${r}="igen",0.15,0),"")`,
        v: scored ? Math.round(scored.priority * 10000) / 10000 : '',
        fmt: 'dec',
      },
      { f: `IF(D${r}=1,1-K${r}/25*${p(ROW.healthFactor)},1)`, v: item.identified ? 1 - (eff.score / 25) * 0.6 : 1, fmt: 'dec' },
      sourceCount(item),
      trail.map((e) => `${TRAIL_KIND_LABEL[e.kind]}: ${e.ref}${e.quote ? ` – „${e.quote}”` : ''}`).join('\n'),
      eff.exposureExplanation,
      reasons.length ? 'igen' : '',
    ];
  });

  const derivation: Sheet = {
    name: 'Levezetés',
    columns: [
      { header: 'Kód', width: 9 },
      { header: 'Tétel', width: 40, format: 'wrap' },
      { header: 'Pillér', width: 14 },
      { header: 'Azonosítva (1/0)', width: 11 },
      { header: 'Megadott valószínűség', width: 12 },
      { header: 'Megadott hatás', width: 10 },
      { header: 'Típus-korrekció V', width: 11 },
      { header: 'Típus-korrekció H', width: 11 },
      { header: 'Valószínűség (korrigált)', width: 12, format: 'int' },
      { header: 'Hatás (korrigált)', width: 10, format: 'int' },
      { header: 'Pont', width: 7, format: 'int' },
      { header: 'Pont szerinti sáv', width: 10 },
      { header: 'Kitettség módja', width: 28, format: 'wrap' },
      { header: 'Paraméter 1 (arány / darab)', width: 13 },
      { header: 'Paraméter 2 (fedezet 1/0 / tételösszeg)', width: 16 },
      { header: 'Kitettség', width: 16, format: 'huf' },
      { header: 'Esély', width: 8, format: 'pct' },
      { header: 'Várható veszteség', width: 16, format: 'huf' },
      { header: 'Lényegességi küszöb felett', width: 11 },
      { header: 'Végső besorolás', width: 10 },
      { header: 'Munkanap', width: 9 },
      { header: 'Gyors javítás', width: 9 },
      { header: 'Időablak', width: 24 },
      { header: 'Prioritás', width: 10 },
      { header: 'Health-szorzó', width: 10 },
      { header: 'Források száma', width: 9, format: 'int' },
      { header: 'Források', width: 60, format: 'wrap' },
      { header: 'Kitettség a programban', width: 44, format: 'wrap' },
      { header: 'Indoklás nélküli csökkentés', width: 12 },
    ],
    rows,
  };

  // ── Pillérek és Health Score ────────────────────────────────────
  const pillarRows: CellValue[][] = PILLARS.map((pl, i) => {
    const r = i + 2;
    const s = a.pillars[pl];
    const cond = (extra = '') => `${rng('C')},A${r},${rng('D')},1${extra}`;
    return [
      PILLAR_LABEL[pl],
      { f: `${PAR}!$B$${ROW.weight0 + i}`, v: kind.weights[pl], fmt: 'pct' },
      { f: `COUNTIFS(${cond()})`, v: s.identified },
      { f: `COUNTIFS(${cond(`,${rng('T')},"Piros"`)})`, v: s.red },
      { f: `COUNTIFS(${cond(`,${rng('T')},"Sárga"`)})`, v: s.amber },
      { f: `ROUND(100*EXP(SUMPRODUCT((${rng('C')}=A${r})*LN(${rng('Y')}))),0)`, v: s.healthScore },
      { f: `IF(OR(D${r}>0,F${r}<40),"Piros",IF(OR(E${r}>0,F${r}<70),"Sárga","Zöld"))`, v: RAG_LABEL[s.rag] },
      { f: `SUMIFS(${rng('P')},${cond()})`, v: s.grossExposureHuf, fmt: 'huf' },
      { f: `SUMIFS(${rng('R')},${cond()})`, v: s.expectedLossHuf, fmt: 'huf' },
    ];
  });
  const last = PILLARS.length + 1;
  pillarRows.push([
    'Összesen',
    { f: `SUM(B2:B${last})`, v: PILLARS.reduce((x, pl) => x + kind.weights[pl], 0), fmt: 'pct' },
    { f: `SUM(C2:C${last})`, v: a.totals.identified },
    { f: `SUM(D2:D${last})`, v: a.totals.red },
    { f: `SUM(E2:E${last})`, v: a.totals.amber },
    { f: `ROUND(SUMPRODUCT(F2:F${last},B2:B${last})/SUM(B2:B${last}),0)`, v: a.totals.healthScore },
    {
      f: `IF(COUNTIF(G2:G${last},"Piros")>0,"Piros",IF(COUNTIF(G2:G${last},"Sárga")>0,"Sárga","Zöld"))`,
      v: RAG_LABEL[a.totals.rag],
    },
    { f: `SUM(H2:H${last})`, v: a.totals.grossExposureHuf, fmt: 'huf' },
    { f: `SUM(I2:I${last})`, v: a.totals.expectedLossHuf, fmt: 'huf' },
  ]);
  const pillars: Sheet = {
    name: 'Pillérek',
    columns: [
      { header: 'Pillér', width: 16 },
      { header: 'Súly', width: 8 },
      { header: 'Azonosított tételek', width: 11, format: 'int' },
      { header: 'Piros', width: 7, format: 'int' },
      { header: 'Sárga', width: 7, format: 'int' },
      { header: 'Pillér-egészség (0–100)', width: 12, format: 'int' },
      { header: 'Besorolás', width: 10 },
      { header: 'Bruttó kitettség', width: 16 },
      { header: 'Várható veszteség', width: 16 },
    ],
    rows: pillarRows,
  };

  const guide: Sheet = {
    name: 'Útmutató',
    columns: [{ header: `Levezetés – ${input.companyName} (${kind.label})`, width: 120, format: 'wrap' }],
    rows: [
      ['A munkafüzet ugyanazt számolja, mint a program, élő képletekkel. A megnyitáskor látható számok a program eredményei.'],
      ['Sárga cella = bemenet vagy paraméter: átírható. A fehér cellák képletek: mutatják, mi következik a bemenetekből.'],
      [
        'Levezetés munkalap, soronként: megadott valószínűség és hatás → típus-korrekció → pont → sáv → kitettség (képlettel vagy kézzel) → esély → várható veszteség → lényegességi küszöb → végső besorolás → időablak, prioritás.',
      ],
      ['Pillérek munkalap: azonosított tételek, pillér-egészség (100 × a tételek Health-szorzóinak szorzata), besorolás, és a súlyozott Health Score.'],
      ['Próba: írd át egy tétel valószínűségét, az „Azonosítva” oszlopot, az árbevételt vagy egy küszöböt a Paraméterek lapon, és nézd meg, mi változik.'],
      ['A munkafüzetben végzett módosítás nem kerül vissza a programba: ott a változásnaplóval és indoklással kell átvezetni.'],
      [
        'Források: a bizonyíték-lánc tételenként (hely, idézet, ki fogadta el); Változásnapló: a szakértői módosítások; Vélemények: a tanácsadói vélemények, az AI-felülvizsgálat és a döntés.',
      ],
    ],
  };

  const opinionRows: CellValue[][] = items.flatMap((r) =>
    discussionOf(r).map((d) => {
      const rv = d.review;
      const decision = d.decision
        ? `${d.decision.kind === 'APPLIED' ? 'Átvéve' : 'Elvetve'} (${d.decision.by ?? 'név nélkül'}, ${d.decision.at.slice(0, 16).replace('T', ' ')})`
        : '';
      return [
        r.code,
        d.at.slice(0, 16).replace('T', ' '),
        d.role === 'AI' ? 'AI-felülvizsgálat' : (d.by ?? 'név nélkül'),
        rv ? VERDICT_LABEL[rv.verdict] : 'Vélemény',
        [
          d.text,
          ...(rv?.counterpoints.length ? [`Ellenérvek: ${rv.counterpoints.join('; ')}`] : []),
          ...(rv?.evidenceNeeded.length ? [`Bizonyíték kellene: ${rv.evidenceNeeded.join('; ')}`] : []),
        ].join('\n'),
        rv?.discarded.join('\n') ?? '',
        rv?.proposal && rv.basis ? describeProposal(rv.proposal, rv.basis) : '',
        decision,
      ];
    }),
  );
  const opinions: Sheet = {
    name: 'Vélemények',
    columns: [
      { header: 'Kód', width: 9 },
      { header: 'Időpont', width: 17 },
      { header: 'Ki', width: 18 },
      { header: 'Ítélet', width: 16 },
      { header: 'Szöveg', width: 70, format: 'wrap' },
      { header: 'A program által elvetett elemek', width: 50, format: 'wrap' },
      { header: 'Javaslat', width: 30, format: 'wrap' },
      { header: 'Döntés', width: 30 },
    ],
    rows: opinionRows,
  };

  const assumptions: Sheet = {
    name: 'Feltevések',
    columns: [
      { header: 'Feltevés', width: 44, format: 'wrap' },
      { header: 'Érték', width: 40, format: 'wrap' },
      { header: 'Mire hat', width: 50, format: 'wrap' },
      { header: 'Honnan jön', width: 50, format: 'wrap' },
      { header: 'Állapot', width: 16 },
      { header: 'Felelős', width: 22 },
      { header: 'Kód', width: 36 },
    ],
    rows: [
      ...ASSUMPTIONS.map((a): CellValue[] => [a.label, a.value, a.effect, a.basis, ASSUMPTION_STATUS_LABEL[a.status], a.owner, a.code]),
      [],
      ['Ítélet, amely nem számolható ki (dokumentálva, de nem levezethető):'],
      ...REMAINING_JUDGEMENT.map((j): CellValue[] => [j.label, '', j.mitigation]),
    ],
  };

  const extra = buildWorkbook(input).filter((s) => s.name === 'Bizonyítéktár' || s.name === 'Változásnapló');
  return [guide, derivation, pillars, params, assumptions, ...(opinionRows.length ? [opinions] : []), ...extra];
}

export function exportDerivation(input: ReportInput, items: RiskItem[]): Uint8Array {
  return writeXlsx(buildDerivationWorkbook(input, items));
}
