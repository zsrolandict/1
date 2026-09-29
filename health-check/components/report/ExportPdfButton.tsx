'use client';

import { useState } from 'react';
import { FileDown, Loader2 } from 'lucide-react';
import type { ReportInput } from '@/lib/report/model';

/** Fájl átadása a felhasználónak. Alapból böngészős letöltés; az előnézet mást adhat. */
export type SaveFile = (blob: Blob, filename: string) => Promise<void>;

export const browserDownload: SaveFile = async (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
};

/**
 * Egykattintásos PDF-riport. A PDF-motort csak kattintáskor töltjük be
 * (nagy csomag), a generálás teljesen a böngészőben történik – az adatok
 * nem hagyják el a gépet.
 */
export default function ExportPdfButton({
  input,
  saveFile = browserDownload,
  fontBase,
  beforeExport,
}: {
  input: ReportInput;
  /** Opcionális kérdés a generálás előtt (pl. üres értékelésnél); false esetén nem készül PDF. */
  beforeExport?: () => Promise<boolean>;
  saveFile?: SaveFile;
  /** A betűkészletek mappája (alapból: <origin>/fonts). */
  fontBase?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ kind: 'error' | 'warn'; text: string } | null>(null);

  const generate = async () => {
    if (beforeExport && !(await beforeExport())) return;
    setBusy(true);
    setNote(null);
    try {
      const [{ pdf }, { ReportDocument }, { buildReportModel }, { registerReportFonts }] = await Promise.all([
        import('@react-pdf/renderer'),
        import('@/lib/report/ReportDocument'),
        import('@/lib/report/model'),
        import('@/lib/report/fonts'),
      ]);
      registerReportFonts(fontBase ?? `${window.location.origin}/fonts`);
      const model = buildReportModel(input);
      const blob = await pdf(<ReportDocument model={model} />).toBlob();
      await saveFile(blob, `red-flag-riport-${slug(input.companyName)}-${model.generatedAt.slice(0, 10)}.pdf`);
      if (model.unapprovedParameterRisks.length > 0) {
        setNote({ kind: 'warn', text: 'TERVEZET: nem jóváhagyott szakértői paramétert tartalmaz.' });
      }
    } catch (e) {
      console.error(e);
      setNote({ kind: 'error', text: e instanceof Error && e.message ? e.message : 'A PDF előállítása nem sikerült.' });
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
      {note && (
        <span role={note.kind === 'error' ? 'alert' : 'status'} className={`mt-1 text-xs ${note.kind === 'error' ? 'text-red-600' : 'text-amber-700'}`}>
          {note.text}
        </span>
      )}
    </span>
  );
}

export function slug(s: string): string {
  return (
    s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'ceg'
  );
}
