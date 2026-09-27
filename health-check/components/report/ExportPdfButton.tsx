'use client';

import { useState } from 'react';
import { FileDown, Loader2 } from 'lucide-react';
import type { ReportInput } from '@/lib/report/model';

/**
 * Egykattintásos PDF-riport. A PDF-motort csak kattintáskor töltjük be
 * (nagy csomag), a generálás teljesen a böngészőben történik – az adatok
 * nem hagyják el a gépet.
 */
export default function ExportPdfButton({ input }: { input: ReportInput }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    setBusy(true);
    setError(null);
    try {
      const [{ pdf }, { ReportDocument }, { buildReportModel }, { registerReportFonts }] = await Promise.all([
        import('@react-pdf/renderer'),
        import('@/lib/report/ReportDocument'),
        import('@/lib/report/model'),
        import('@/lib/report/fonts'),
      ]);
      registerReportFonts(`${window.location.origin}/fonts`);
      const model = buildReportModel(input);
      if (
        model.unapprovedParameterRisks.length > 0 &&
        !window.confirm(
          'A riport nem jóváhagyott szakértői paraméterre épülő becslést tartalmaz, ezért TERVEZET jelölést kap. Folytatja?',
        )
      ) {
        return;
      }
      const blob = await pdf(<ReportDocument model={model} />).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const date = model.generatedAt.slice(0, 10);
      a.download = `red-flag-riport-${slug(input.companyName)}-${date}.pdf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (e) {
      console.error(e);
      setError('A PDF előállítása nem sikerült.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <span className="inline-flex flex-col items-end">
      <button
        onClick={generate}
        disabled={busy}
        className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
        PDF riport
      </button>
      {error && <span role="alert" className="mt-1 text-xs text-red-600">{error}</span>}
    </span>
  );
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'ceg';
}
