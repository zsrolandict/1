import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import { formatHuf, formatHufShort, DIVISIONS, PILLARS } from '@/lib/risk/engine';
import { DIVISION_LABEL, PILLAR_LABEL, RAG_LABEL, WINDOW_LABEL } from '@/lib/risk/catalog';
import { EXPERT_PARAMETERS } from '@/lib/risk/parameters';
import type { Rag, ScoredRisk } from '@/lib/risk/types';
import { BRAND } from './brand';
import { formatAdjustment, KIND_ADJUSTMENTS_STATUS } from '@/lib/engagement/adjustments';
import { firstSentence, formatDateHu, WINDOW_ORDER, type ReportModel } from './model';
import { hasRevenue } from '@/lib/risk/valuation';

const C = BRAND.colors;

const RAG_COLOR: Record<Rag, { fg: string; bg: string }> = {
  RED: { fg: C.red, bg: C.redBg },
  AMBER: { fg: C.amber, bg: C.amberBg },
  GREEN: { fg: C.green, bg: C.greenBg },
};

const s = StyleSheet.create({
  page: { fontFamily: BRAND.fontFamily, fontSize: 9.5, color: C.ink, paddingTop: 56, paddingBottom: 48, paddingHorizontal: 44, lineHeight: 1.4 },
  header: {
    position: 'absolute',
    top: 20,
    left: 44,
    right: 44,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 7.5,
    color: C.faint,
    borderBottomWidth: 0.5,
    borderBottomColor: C.rule,
    paddingBottom: 6,
  },
  footer: { position: 'absolute', bottom: 20, left: 44, right: 44, flexDirection: 'row', justifyContent: 'space-between', fontSize: 7.5, color: C.faint },
  h1: { fontSize: 22, fontWeight: 700, color: C.primary, lineHeight: 1.2 },
  h2: { fontSize: 14, fontWeight: 700, color: C.primary, marginBottom: 10, lineHeight: 1.25 },
  h3: { fontSize: 10.5, fontWeight: 600, marginBottom: 4 },
  muted: { color: C.muted },
  small: { fontSize: 8, color: C.muted },
  row: { flexDirection: 'row' },
  card: { borderWidth: 0.75, borderColor: C.rule, borderRadius: 4, padding: 10 },
  pill: { borderRadius: 3, paddingHorizontal: 5, paddingVertical: 1.5, fontSize: 7.5, fontWeight: 600 },
  th: { fontSize: 7.5, fontWeight: 600, color: C.muted, textTransform: 'uppercase', paddingVertical: 4 },
  td: { paddingVertical: 5, borderTopWidth: 0.5, borderTopColor: C.rule },
});

export function ReportDocument({ model }: { model: ReportModel }) {
  return (
    <Document title={`Red Flag összefoglaló – ${model.companyName}`} author={BRAND.firmName} subject={model.kindLabel} language="hu">
      <CoverPage m={model} />
      <ScorecardPage m={model} />
      <DetailPages m={model} />
      <ActionPlanPage m={model} />
      <OfferPage m={model} />
    </Document>
  );
}

// ── Közös elemek ───────────────────────────────────────────────────

function Chrome({ m }: { m: ReportModel }) {
  return (
    <>
      <View style={s.header} fixed>
        <Text>
          {BRAND.firmName} · {m.kindLabel}
          {m.unapprovedParameterRisks.length > 0 ? '  ·  TERVEZET – nem kiadható' : ''}
        </Text>
        <Text>{m.companyName}</Text>
      </View>
      <View style={s.footer} fixed>
        <Text>Bizalmas – kizárólag a címzett részére · {formatDateHu(m.generatedAt)}</Text>
        <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
      </View>
    </>
  );
}

function RagPill({ rag, label }: { rag: Rag; label?: string }) {
  return <Text style={[s.pill, { color: RAG_COLOR[rag].fg, backgroundColor: RAG_COLOR[rag].bg }]}>{label ?? RAG_LABEL[rag]}</Text>;
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <View style={[s.card, { flex: 1, marginRight: 8 }]}>
      <Text style={s.small}>{label}</Text>
      <Text style={{ fontSize: 15, fontWeight: 700, marginTop: 3, lineHeight: 1.2 }}>{value}</Text>
      {sub && <Text style={[s.small, { marginTop: 2 }]}>{sub}</Text>}
    </View>
  );
}

// ── 1. Címlap + vezetői összefoglaló ───────────────────────────────

function CoverPage({ m }: { m: ReportModel }) {
  const t = m.assessment.totals;
  return (
    <Page size="A4" style={[s.page, { paddingTop: 0 }]}>
      <View style={{ backgroundColor: C.primary, marginHorizontal: -44, paddingHorizontal: 44, paddingTop: 44, paddingBottom: 28 }}>
        <Text style={{ color: '#cbd5e1', fontSize: 9, letterSpacing: 1 }}>
          {BRAND.firmName.toUpperCase()} · {BRAND.tagline}
        </Text>
        <Text style={{ color: '#ffffff', fontSize: 26, fontWeight: 700, marginTop: 18, lineHeight: 1.2 }}>Red Flag összefoglaló</Text>
        <Text style={{ color: '#e2e8f0', fontSize: 13, marginTop: 4, lineHeight: 1.3 }}>{m.companyName}</Text>
        <Text style={{ color: '#94a3b8', fontSize: 9, marginTop: 10 }}>
          {m.kindLabel} · Címzett: {m.audience} · {formatDateHu(m.generatedAt)}
        </Text>
      </View>

      <View style={[s.row, { marginTop: 22, alignItems: 'center' }]}>
        <Text style={[s.h2, { marginBottom: 0, marginRight: 10 }]}>Összesített minősítés</Text>
        <RagPill rag={t.rag} label={`${RAG_LABEL[t.rag]} · Health Score ${t.healthScore}/100`} />
      </View>

      <View style={[s.row, { marginTop: 12, marginRight: -8 }]}>
        <Stat label="Bruttó kitettség" value={formatHufShort(t.grossExposureHuf)} sub="azonosított kockázatok összesen" />
        <Stat label="Várható veszteség" value={formatHufShort(t.expectedLossHuf)} sub="kitettség × valószínűség" />
        <Stat label="Azonosított tételek" value={String(t.identified)} sub={`${t.red} piros · ${t.amber} sárga · ${t.green} zöld`} />
      </View>

      <View style={[s.card, { marginTop: 14, borderLeftWidth: 3, borderLeftColor: C.primary }]}>
        <Text style={[s.small, { marginBottom: 2 }]}>Szempont · {m.kindLabel}</Text>
        <Text>{m.reportLens}</Text>
      </View>

      <Text style={[s.h2, { marginTop: 18 }]}>A három legfontosabb megállapítás</Text>
      {m.topFindings.length === 0 && <Text style={s.muted}>Nincs sárga vagy piros besorolású tétel.</Text>}
      {m.topFindings.map((r, i) => (
        <View key={r.id} style={[s.card, { marginBottom: 8, borderLeftWidth: 3, borderLeftColor: RAG_COLOR[r.rag].fg }]} wrap={false}>
          <View style={[s.row, { justifyContent: 'space-between' }]}>
            <Text style={{ fontSize: 11, fontWeight: 600, flex: 1, paddingRight: 8 }}>
              {i + 1}. {r.title}
            </Text>
            <Text style={{ fontSize: 11, fontWeight: 700 }}>{formatHufShort(r.exposureHuf)}</Text>
          </View>
          <Text style={[s.muted, { marginTop: 3 }]}>{firstSentence(r.reasoning) || r.description}</Text>
          <Text style={[s.small, { marginTop: 4 }]}>
            {PILLAR_LABEL[r.pillar]} · Javasolt: {r.remediation || '—'}
          </Text>
        </View>
      ))}

      <View style={[s.card, { marginTop: 14, backgroundColor: C.panel }]}>
        <Text style={s.h3}>Mit javaslunk?</Text>
        <Text style={s.muted}>
          {m.assessment.actionPlan.D0_30.length} gyorsan javítható tétel az első 30 napban, {m.assessment.actionPlan.D31_60.length} kritikus javítás 31–60 nap
          között és {m.assessment.actionPlan.D61_90.length} strukturális lépés a 90. napig. A részletes akcióterv a 4. fejezetben, a javítás költsége és a{' '}
          {formatHufShort(m.assessment.pipeline.creditHuf)} beszámítás az 5. fejezetben található.
        </Text>
      </View>
      <Chrome m={m} />
    </Page>
  );
}

// ── 2. Pillér-scorecard + mátrix ────────────────────────────────────

function ScorecardPage({ m }: { m: ReportModel }) {
  const p = m.assessment.pillars;
  const byCell = new Map<string, number>();
  for (const r of m.assessment.risks) byCell.set(`${r.likelihood}-${r.impact}`, (byCell.get(`${r.likelihood}-${r.impact}`) ?? 0) + 1);
  const cellRag = (l: number, i: number): Rag => (l * i >= 15 ? 'RED' : l * i >= 8 ? 'AMBER' : 'GREEN');

  return (
    <Page size="A4" style={s.page}>
      <Chrome m={m} />
      <Text style={s.h2}>1. Pillér-scorecard</Text>
      <View style={[s.row, { flexWrap: 'wrap', justifyContent: 'space-between' }]}>
        {PILLARS.map((pl) => {
          const x = p[pl];
          return (
            <View key={pl} style={[s.card, { width: '49%', marginBottom: 8 }]} wrap={false}>
              <View style={[s.row, { justifyContent: 'space-between', alignItems: 'center' }]}>
                <Text style={{ fontSize: 11, fontWeight: 600 }}>
                  {PILLAR_LABEL[pl]} <Text style={{ fontSize: 8, fontWeight: 400, color: C.muted }}>· súly {Math.round(m.weights[pl] * 100)}%</Text>
                </Text>
                <RagPill rag={x.rag} />
              </View>
              <Text style={{ fontSize: 24, fontWeight: 700, marginTop: 4, lineHeight: 1.2 }}>
                {x.healthScore}
                <Text style={{ fontSize: 9, fontWeight: 400, color: C.muted }}> / 100</Text>
              </Text>
              <View style={{ height: 4, backgroundColor: C.rule, borderRadius: 2, marginTop: 4 }}>
                <View style={{ height: 4, width: `${x.healthScore}%`, backgroundColor: RAG_COLOR[x.rag].fg, borderRadius: 2 }} />
              </View>
              <View style={[s.row, { justifyContent: 'space-between', marginTop: 8 }]}>
                <Text style={s.small}>
                  {x.identified} tétel ({x.red} piros, {x.amber} sárga)
                </Text>
                <Text style={s.small}>{formatHufShort(x.grossExposureHuf)}</Text>
              </View>
            </View>
          );
        })}
      </View>

      <Text style={[s.h2, { marginTop: 16 }]}>2. Kockázati mátrix</Text>
      <View style={s.row}>
        <View style={{ width: 250 }}>
          {[5, 4, 3, 2, 1].map((l) => (
            <View key={l} style={[s.row, { alignItems: 'center' }]}>
              <Text style={[s.small, { width: 14 }]}>{l}</Text>
              {[1, 2, 3, 4, 5].map((i) => {
                const n = byCell.get(`${l}-${i}`) ?? 0;
                const rag = cellRag(l, i);
                return (
                  <View
                    key={i}
                    style={{
                      width: 44,
                      height: 34,
                      margin: 1.5,
                      borderRadius: 3,
                      backgroundColor: RAG_COLOR[rag].bg,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {n > 0 && <Text style={{ fontSize: 11, fontWeight: 700, lineHeight: 1.2, color: RAG_COLOR[rag].fg }}>{n}</Text>}
                  </View>
                );
              })}
            </View>
          ))}
          <View style={[s.row, { marginLeft: 14 }]}>
            {[1, 2, 3, 4, 5].map((i) => (
              <Text key={i} style={[s.small, { width: 47, textAlign: 'center' }]}>
                {i}
              </Text>
            ))}
          </View>
          <Text style={[s.small, { textAlign: 'center', marginTop: 2 }]}>Hatás → (függőleges: valószínűség)</Text>
        </View>
        <View style={{ flex: 1, marginLeft: 16 }}>
          <Text style={s.h3}>Hogyan olvassuk?</Text>
          <Text style={[s.muted, { marginBottom: 6 }]}>
            Minden azonosított kockázatot 1–5 skálán értékeltünk a bekövetkezés valószínűsége és a hatás súlyossága szerint. A cellában a tételek száma látható.
          </Text>
          <Text style={s.muted}>
            • Piros: pontszám ≥ 15, vagy a várható veszteség (kitettség × valószínűség) eléri a {formatHufShort(m.materialityHuf)} lényegességi küszöböt.
          </Text>
          <Text style={s.muted}>• Sárga: pontszám 8–14.</Text>
          <Text style={s.muted}>• Zöld: pontszám 8 alatt – figyelemmel kísérendő.</Text>
          <Text style={[s.muted, { marginTop: 6 }]}>A várható veszteség a bruttó kitettség és a valószínűség szorzata (5% / 20% / 40% / 65% / 90%).</Text>
          <Text style={[s.muted, { marginTop: 6 }]}>
            Az összesített Health Score a pillérek súlyozott átlaga; a súlyokat az átvilágítás típusa ({m.kindLabel}) adja.
          </Text>
        </View>
      </View>
    </Page>
  );
}

// ── 3. Red Flag részletező (szükség szerint több oldal) ─────────────

function DetailPages({ m }: { m: ReportModel }) {
  return (
    <Page size="A4" style={s.page} wrap>
      <Chrome m={m} />
      <Text style={s.h2}>3. Red Flag részletező</Text>
      {m.detailed.length === 0 && <Text style={s.muted}>Nincs sárga vagy piros besorolású tétel.</Text>}
      {m.detailed.map((r) => (
        <FindingCard key={r.id} r={r} />
      ))}
      {m.greenCount > 0 && (
        <Text style={[s.small, { marginTop: 6 }]}>
          További {m.greenCount} zöld besorolású tétel azonosítva; ezek monitorozását javasoljuk, részletezésük a munkaanyagban.
        </Text>
      )}
    </Page>
  );
}

function FindingCard({ r }: { r: ScoredRisk }) {
  return (
    <View style={[s.card, { marginBottom: 8, borderLeftWidth: 3, borderLeftColor: RAG_COLOR[r.rag].fg }]} wrap={false}>
      <View style={[s.row, { justifyContent: 'space-between', alignItems: 'center' }]}>
        <Text style={s.small}>
          {r.code} · {PILLAR_LABEL[r.pillar]} · V{r.likelihood} × H{r.impact} = {r.score}
        </Text>
        <RagPill rag={r.rag} />
      </View>
      <Text style={{ fontSize: 11, fontWeight: 600, marginTop: 3 }}>{r.title}</Text>
      {r.reasoning ? <Text style={{ marginTop: 3 }}>{r.reasoning}</Text> : <Text style={[s.muted, { marginTop: 3 }]}>{r.description}</Text>}
      {r.evidence && <Text style={[s.small, { fontStyle: 'italic', marginTop: 3 }]}>Bizonyíték: {r.evidence}</Text>}
      {r.adjustment && (
        <Text style={[s.small, { marginTop: 3 }]}>
          Típus-korrekció ({formatAdjustment(r.adjustment)}; szakértői érték V{r.baseLikelihood} × H{r.baseImpact}): {r.adjustment.reason}
        </Text>
      )}
      <View style={[s.row, { marginTop: 6, backgroundColor: C.panel, padding: 6, borderRadius: 3 }]}>
        <View style={{ flex: 1.4 }}>
          <Text style={s.small}>Kitettség</Text>
          <Text style={{ fontWeight: 600 }}>{formatHuf(r.exposureHuf)}</Text>
          <Text style={[s.small, { fontSize: 7 }]}>{r.exposureExplanation}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.small}>Várható veszteség</Text>
          <Text style={{ fontWeight: 600 }}>{formatHuf(r.expectedLossHuf)}</Text>
        </View>
        <View style={{ flex: 1.6 }}>
          <Text style={s.small}>Javasolt intézkedés · {DIVISION_LABEL[r.division]}</Text>
          <Text>{r.remediation || '—'}</Text>
        </View>
      </View>
    </View>
  );
}

// ── 4. 90 napos akcióterv ──────────────────────────────────────────

function ActionPlanPage({ m }: { m: ReportModel }) {
  const plan = m.assessment.actionPlan;
  return (
    <Page size="A4" style={s.page} wrap>
      <Chrome m={m} />
      <Text style={s.h2}>4. 90 napos prioritási akcióterv</Text>
      {WINDOW_ORDER.filter((w) => w !== 'BACKLOG').map((w) => (
        <View key={w} style={{ marginBottom: 12 }}>
          <Text style={[s.h3, { color: C.primary }]}>{WINDOW_LABEL[w]}</Text>
          <View style={s.row}>
            <Text style={[s.th, { width: 18 }]}>#</Text>
            <Text style={[s.th, { flex: 2.2 }]}>Intézkedés</Text>
            <Text style={[s.th, { flex: 1 }]}>Terület</Text>
            <Text style={[s.th, { flex: 1 }]}>Felelős divízió</Text>
            <Text style={[s.th, { width: 44, textAlign: 'right' }]}>Munkanap</Text>
          </View>
          {plan[w].length === 0 && <Text style={[s.small, s.td]}>Nincs tétel ebben az időablakban.</Text>}
          {plan[w].map((r, i) => (
            <View key={r.id} style={[s.row, s.td]} wrap={false}>
              <Text style={{ width: 18 }}>{i + 1}.</Text>
              <View style={{ flex: 2.2, paddingRight: 6 }}>
                <Text style={{ fontWeight: 600 }}>{r.remediation || r.title}</Text>
                <Text style={s.small}>
                  {r.title}
                  {r.quickWin ? ' · Quick win' : ''}
                </Text>
              </View>
              <Text style={{ flex: 1 }}>{PILLAR_LABEL[r.pillar]}</Text>
              <Text style={{ flex: 1 }}>{DIVISION_LABEL[r.division]}</Text>
              <Text style={{ width: 44, textAlign: 'right' }}>{r.remediationDays}</Text>
            </View>
          ))}
        </View>
      ))}
      {plan.BACKLOG.length > 0 && <Text style={s.small}>Monitorozandó (90 napon túl): {plan.BACKLOG.map((r) => r.title).join('; ')}.</Text>}
    </Page>
  );
}

// ── 5. Következő lépések, ajánlat, módszertan ───────────────────────

function OfferPage({ m }: { m: ReportModel }) {
  const p = m.assessment.pipeline;
  return (
    <Page size="A4" style={s.page} wrap>
      <Chrome m={m} />
      <Text style={s.h2}>5. Következő lépések és ajánlat</Text>
      <Text style={[s.muted, { marginBottom: 8 }]}>
        {m.reportLens} A sárga és piros tételek javításában az ICT Európa divíziói közvetlenül tudnak támogatni. Az átvilágítás díja 100%-ban beszámít a
        javítási megbízásokba.
      </Text>
      <View style={s.row}>
        <Text style={[s.th, { flex: 2 }]}>Divízió</Text>
        <Text style={[s.th, { flex: 1, textAlign: 'right' }]}>Tételek</Text>
        <Text style={[s.th, { flex: 1.4, textAlign: 'right' }]}>Becsült díj (nettó)</Text>
      </View>
      {DIVISIONS.filter((d) => p.byDivision[d].count > 0).map((d) => (
        <View key={d} style={[s.row, s.td]}>
          <Text style={{ flex: 2 }}>{DIVISION_LABEL[d]}</Text>
          <Text style={{ flex: 1, textAlign: 'right' }}>{p.byDivision[d].count}</Text>
          <Text style={{ flex: 1.4, textAlign: 'right' }}>{formatHuf(p.byDivision[d].feeHuf)}</Text>
        </View>
      ))}
      <View style={[s.card, { marginTop: 10, backgroundColor: C.primary, borderColor: C.primary }]}>
        <View style={[s.row, { justifyContent: 'space-between' }]}>
          <Text style={{ color: '#cbd5e1' }}>Javasolt javítási munkák összesen</Text>
          <Text style={{ color: '#ffffff' }}>{formatHuf(p.totalFeeHuf)}</Text>
        </View>
        <View style={[s.row, { justifyContent: 'space-between', marginTop: 3 }]}>
          <Text style={{ color: '#cbd5e1' }}>Átvilágítási díj beszámítása (100%)</Text>
          <Text style={{ color: '#86efac' }}>− {formatHuf(p.creditHuf)}</Text>
        </View>
        <View style={[s.row, { justifyContent: 'space-between', marginTop: 6, borderTopWidth: 0.5, borderTopColor: '#334155', paddingTop: 6 }]}>
          <Text style={{ color: '#ffffff', fontWeight: 700 }}>Fizetendő (nettó)</Text>
          <Text style={{ color: '#ffffff', fontWeight: 700, fontSize: 12 }}>{formatHuf(p.netAfterCreditHuf)}</Text>
        </View>
      </View>

      <Text style={[s.h2, { marginTop: 20 }]}>Módszertan és korlátozások</Text>
      <Text style={[s.muted, { marginBottom: 4 }]}>
        • Az átvilágítás a rendelkezésre bocsátott dokumentumokon, az ügyfél által kitöltött kérdőíven és a vezetői interjúkon alapul; nem minősül
        könyvvizsgálatnak vagy teljes körű jogi átvilágításnak.
      </Text>
      <Text style={[s.muted, { marginBottom: 4 }]}>
        • A forintosított értékek kiinduló becslések (árbevétel-arány, tételszám × egységösszeg, forgótőke-különbség), amelyeket a szakértők tételenként
        felülvizsgáltak; nem jelentenek jogi vagy adóhatósági döntést.
      </Text>
      {m.adjustedRisks.length > 0 && (
        <Text style={[s.muted, { marginBottom: 4 }]}>
          • Az átvilágítás típusa ({m.kindLabel}) {m.adjustedRisks.length} tételnél módosította a valószínűséget vagy a hatást, mert ugyanannak a ténynek a
          vizsgálat céljától függően más a súlya. A korrekciót és az okát tételenként jelöljük.
          {KIND_ADJUSTMENTS_STATUS.approved ? '' : ' (A korrekciós táblázat kezdő javaslat, szakértői jóváhagyásra vár.)'}
        </Text>
      )}
      {m.aiSourcedCount > 0 && (
        <Text style={[s.muted, { marginBottom: 4 }]}>
          • {m.aiSourcedCount} megállapítás AI-alapú előszűrésből (interjú- vagy dokumentumelemzés) származik; mindegyiket szakértő ellenőrizte és hagyta jóvá,
          szó szerinti forrásidézettel.
        </Text>
      )}
      {m.unapprovedParameterRisks.length > 0 && (
        <View style={[s.card, { marginTop: 6, borderColor: C.amber, backgroundColor: C.amberBg }]}>
          <Text style={[s.h3, { color: C.amber }]}>Belső jelzés – kiadás előtt rendezendő</Text>
          {m.unapprovedParameterRisks.map((r) => {
            const f = r.valuation?.formula;
            const key = f?.type === 'PER_ITEM' ? f.paramKey : undefined;
            return (
              <Text key={r.id} style={s.small}>
                {r.code} {r.title}: nem jóváhagyott szakértői paraméter
                {key ? ` (${EXPERT_PARAMETERS[key].label}, felelős: ${EXPERT_PARAMETERS[key].owner})` : ''}.
              </Text>
            );
          })}
        </View>
      )}
      <Text style={[s.small, { marginTop: 16 }]}>
        Készítette: {m.preparedBy ?? BRAND.firmName} · Lényegességi küszöb: {formatHuf(m.materialityHuf)} · Árbevétel-alap:{' '}
        {hasRevenue(m.company) ? formatHufShort(m.company.revenueHuf) : 'nincs megadva (a forintosított összegek 0 Ft-ot mutatnak)'}
      </Text>
    </Page>
  );
}
