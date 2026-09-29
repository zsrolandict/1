import path from 'node:path';
import { renderToBuffer } from '@react-pdf/renderer';
import { describe, expect, it } from 'vitest';
import { buildInterviewGuide } from '@/lib/interview/guide';
import { notesToTranscript, verifyAnalysis } from '@/lib/interview/transcript';
import { registerReportFonts } from '@/lib/report/fonts';
import { buildReportModel } from '@/lib/report/model';
import { ReportDocument } from '@/lib/report/ReportDocument';
import { assess } from '@/lib/risk/engine';
import { applySuggestion } from '@/lib/risk/store';
import { SCENARIOS } from './index';

registerReportFonts(path.resolve(import.meta.dirname, '../../public/fonts'));

describe.each(SCENARIOS.filter((s) => s.id !== 'gyarto'))('mintaeset: $label', (sc) => {
  const transcript = notesToTranscript(sc.interview!.notes);

  it('az interjú időbélyeges, minden elemzési idézet szó szerint megvan', () => {
    expect(transcript.timed).toBe(true);
    const res = verifyAnalysis(sc.interview!.analysis, transcript, sc.facts);
    expect(res.discardedUnverified).toBe(0);
    expect(res.contradictions.length).toBeGreaterThanOrEqual(2);
    expect(res.contradictions.every((c) => c.startMs != null)).toBe(true);
  });

  it('a javaslatok létező tételekre hivatkoznak, és beolvaszthatók', () => {
    const codes = new Set(sc.items.map((r) => r.code));
    expect(new Set(sc.items.map((r) => r.id)).size).toBe(sc.items.length);
    let items = sc.items;
    for (const f of sc.interview!.analysis.suggestedRedFlags) {
      expect(f.templateCode && codes.has(f.templateCode)).toBe(true);
      items = applySuggestion(items, f, f.quote, sc.company);
    }
    expect(items).toHaveLength(sc.items.length);
  });

  it('értelmes kockázati kép: van piros tétel, és minden azonosított tételnek van indoklása vagy leírása', () => {
    const res = assess(sc.items, { company: sc.company, materialityHuf: sc.materialityHuf });
    expect(res.totals.red).toBeGreaterThan(0);
    expect(res.risks.every((r) => (r.reasoning ?? r.description).length > 20)).toBe(true);
  });

  it('a kérdéslista a dokumentum-tényekre és a hiányzó dokumentumokra is kérdez', () => {
    const qs = buildInterviewGuide({
      kind: sc.kind, role: sc.interview!.role, risks: sc.items, missingDocuments: sc.missingDocuments, facts: sc.facts,
    });
    expect(qs.some((q) => q.source.type === 'DOCUMENT_FINDING')).toBe(true);
    expect(qs.some((q) => q.source.type === 'MISSING_DOCUMENT')).toBe(true);
  });

  it('a PDF-riport elkészül', async () => {
    const assessment = assess(sc.items, { company: sc.company, materialityHuf: sc.materialityHuf });
    const buf = await renderToBuffer(
      <ReportDocument
        model={buildReportModel({ companyName: sc.companyName, kind: sc.kind, company: sc.company, materialityHuf: sc.materialityHuf, assessment })}
      />,
    );
    expect(buf.subarray(0, 5).toString()).toBe('%PDF-');
  }, 30_000);
});
