'use client';

import { DiscardedList } from '@/components/DiscardedList';
import { useState } from 'react';
import { AlertTriangle, Building, Loader2, Upload } from 'lucide-react';
import { extractPlain } from '@/lib/intake/documents/extract';
import { registryFindings, type RegistryRecord } from '@/lib/intake/registry';
import { SECTOR_LABEL, type Sector } from '@/lib/intake/requests';
import { sampleRegistryRecord, SAMPLE_REGISTRY } from '@/lib/intake/samples/registry';
import type { IntakeState } from '@/lib/intake/state';
import { formatHufShort } from '@/lib/risk/engine';
import { useAiBackend } from '@/components/AiBackendContext';

/**
 * Nyilvános cégadatok: az e-cégjegyzék ingyenes cégkivonata bemásolva vagy
 * feltöltve → AI-kiolvasás idézet-ellenőrzéssel → figyelmeztető jelek és
 * összevetés a kérdőívvel / tényállással.
 */
export default function RegistryCard({
  intake,
  update,
  scenarioId,
  aiReady,
  onAddSector,
}: {
  intake: IntakeState;
  update: (patch: Partial<IntakeState>) => void;
  scenarioId: string;
  aiReady: boolean | null;
  onAddSector: (s: Sector) => void;
}) {
  const backend = useAiBackend();
  const [text, setText] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rec = intake.registry;
  const f = rec ? registryFindings(rec, intake) : null;

  const readFile = async (file: File) => {
    setError(null);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const doc = file.name.toLowerCase().endsWith('.pdf')
        ? await (await import('@/lib/intake/documents/extract.server')).extractDocument(file.name, bytes)
        : extractPlain(file.name, bytes);
      setText(doc.pages.map((p) => p.text).join('\n'));
      setFileName(file.name);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'A fájl nem olvasható.');
    }
  };

  const extract = async () => {
    setBusy(true);
    setError(null);
    try {
      const data = await backend.extractRegistry(text);
      const record: RegistryRecord = { data, fileName, at: new Date().toISOString(), isSample: false };
      update({ registry: record });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'A kiolvasás nem sikerült.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div id="registry" className="scroll-mt-32 rounded-xl border border-slate-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2.5 text-base font-bold tracking-tight text-slate-900">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600" aria-hidden>
            <Building className="h-4 w-4" />
          </span>{' '}
          Cégkivonat (nyilvános cégadatok)
        </h2>
        {SAMPLE_REGISTRY[scenarioId] && (
          <button
            onClick={() => update({ registry: sampleRegistryRecord(scenarioId) })}
            className="rounded-lg border border-brand-200 bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700 hover:bg-brand-100"
          >
            Minta cégkivonat
          </button>
        )}
      </div>
      <p className="mt-1 text-xs text-slate-500">
        Az e-cégjegyzék (e-cegjegyzek.hu) ingyenes cégkivonatát másold be vagy töltsd fel. Az AI kiolvassa, a rendszer minden adatot idézettel ellenőriz.
        Automatikus lekéréshez adatszolgáltatói szerződés kell (pl. Opten).
      </p>
      {!rec && (
        <>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            placeholder="Cégkivonat szövege…"
            className="mt-2 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-50">
              <Upload className="h-3.5 w-3.5" /> Fájl (PDF/TXT/DOCX)
              <input
                type="file"
                accept=".pdf,.txt,.docx"
                className="sr-only"
                onChange={(e) => {
                  const x = e.target.files?.[0];
                  if (x) readFile(x);
                  e.target.value = '';
                }}
              />
            </label>
            <button
              onClick={extract}
              disabled={!aiReady || busy || text.trim().length < 50}
              title={aiReady ? undefined : 'Az AI ebben a környezetben nem érhető el'}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Kiolvasás
            </button>
          </div>
        </>
      )}
      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}

      {rec && f && (
        <div className="mt-3 space-y-2 text-xs">
          <dl className="grid grid-cols-[110px_1fr] gap-x-2 gap-y-1">
            <dt className="text-slate-500">Cégnév</dt>
            <dd className="text-slate-900">{rec.data.name?.value ?? '—'}</dd>
            <dt className="text-slate-500">Cégjegyzékszám</dt>
            <dd>{rec.data.registrationNumber?.value ?? '—'}</dd>
            <dt className="text-slate-500">Adószám</dt>
            <dd>{rec.data.taxNumber?.value ?? '—'}</dd>
            <dt className="text-slate-500">Székhely</dt>
            <dd>
              {rec.data.seat?.value ?? '—'}
              {rec.data.seatService ? ' (székhelyszolgáltató)' : ''}
            </dd>
            <dt className="text-slate-500">Főtevékenység</dt>
            <dd>
              {rec.data.mainActivity?.value ?? '—'}
              {f.sector && <span className="ml-1 text-brand-700">→ {SECTOR_LABEL[f.sector]}</span>}
            </dd>
            <dt className="text-slate-500">Jegyzett tőke</dt>
            <dd>{rec.data.capitalHuf != null ? formatHufShort(rec.data.capitalHuf) : '—'}</dd>
            <dt className="text-slate-500">Tulajdonosok</dt>
            <dd>{rec.data.owners.map((o) => `${o.name}${o.sharePct != null ? ` (${o.sharePct}%)` : ''}`).join(', ') || '—'}</dd>
            <dt className="text-slate-500">Vezető</dt>
            <dd>{rec.data.executives.map((e) => `${e.name}, ${e.role}${e.since ? ` (${e.since}-tól)` : ''}`).join('; ') || '—'}</dd>
          </dl>
          {rec.data.proceedings.map((p) => (
            <p key={p.quote} className="flex items-start gap-1.5 rounded bg-red-50 p-2 text-red-800">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Eljárás: {p.type} – „{p.quote}”
            </p>
          ))}
          {rec.data.changes.length > 0 && (
            <div>
              <p className="font-medium text-slate-600">Változások</p>
              <ul className="mt-0.5 list-inside list-disc text-slate-600">
                {rec.data.changes.map((c) => (
                  <li key={c.quote}>
                    {c.date}: {c.what}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {[...f.notes, ...f.conflicts.map((c) => c.explanation), ...f.suggestions.map((s) => `Kockázati javaslat: ${s.title}`)].map((n) => (
            <p key={n} className="rounded bg-amber-50 p-2 text-amber-900">
              {n}
            </p>
          ))}
          <div className="flex flex-wrap gap-2">
            {f.sector && !intake.profile.sectors.includes(f.sector) && (
              <button onClick={() => onAddSector(f.sector!)} className="rounded-lg bg-brand-600 px-2.5 py-1 font-medium text-white">
                Ágazat hozzáadása: {SECTOR_LABEL[f.sector]}
              </button>
            )}
            {f.multipleOwners && !intake.profile.flags.includes('MULTIPLE_OWNERS') && (
              <button
                onClick={() => update({ profile: { ...intake.profile, flags: [...intake.profile.flags, 'MULTIPLE_OWNERS'] } })}
                className="rounded-lg bg-brand-600 px-2.5 py-1 font-medium text-white"
              >
                „Több tulajdonos” bejelölése
              </button>
            )}
            <button onClick={() => update({ registry: null })} className="rounded-lg border border-slate-200 px-2.5 py-1 text-slate-600">
              Másik cégkivonat
            </button>
          </div>
          <p className="text-slate-500">{rec.isSample ? 'Kitalált minta. ' : ''}A figyelmeztetések és ellentmondások az Összkép fülön is megjelennek.</p>
          <DiscardedList count={rec.data.discardedUnverified} items={rec.data.discarded} noun="adatot" />
        </div>
      )}
    </div>
  );
}
