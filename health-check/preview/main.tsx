import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import RedFlagMatrix from '@/components/risk/RedFlagMatrix';
import InterviewWorkspace from '@/components/interview/InterviewWorkspace';
import IntakeWorkspace from '@/components/intake/IntakeWorkspace';
import ProjectWorkspace from '@/components/project/ProjectWorkspace';
import type { SaveFile } from '@/components/report/ExportPdfButton';
import { AiBackendProvider } from '@/components/AiBackendContext';
import Guide from '@/components/guide/Guide';
import ProjectBar from '@/components/project/ProjectBar';
import ProjectScope from '@/components/project/ProjectScope';
import { NavProvider } from '@/components/Nav';
import { activeProjectId, lastPageOf } from '@/lib/risk/store';
import { useModules } from '@/components/useModules';
import { pageVisible } from '@/lib/modules';
import { isPageId, PAGE_IDS, PAGE_LABEL, type PageId } from '@/lib/guide';
import { sampleBackend } from './sampleBackend';
import './styles.css';

/**
 * Kattintható előnézet (claude.ai Artifact): a Next.js alkalmazás kliens-
 * komponensei szerver nélkül. Az AI a claude.ai beépített képessége (`sample`,
 * a néző fiókján); a PDF-et a nézőnek a `downloads` képesség adja át.
 */

type Tab = PageId;

interface DownloadsNs {
  save(req: { filename: string; data: Blob }): Promise<{ status: string }>;
}

const savePdf: SaveFile = async (blob, filename) => {
  const downloads = ((await window.claude?.use('downloads')) as DownloadsNs | null | undefined) ?? null;
  if (!downloads) throw new Error('A mentés ebben a nézetben nem érhető el.');
  try {
    await downloads.save({ filename, data: blob });
  } catch (e) {
    const code = (e as { code?: string })?.code;
    if (code === 'declined') return; // a néző meggondolta magát
    throw new Error(code === 'rate_limited' ? 'Egy mentési kérdés már nyitva van.' : 'A fájl mentése nem sikerült.');
  }
};

const fontBase = new URL('fonts', document.baseURI).href;

function tabFromHash(): Tab {
  const h = window.location.hash.slice(1);
  if (isPageId(h)) return h;
  // Cím nélkül: ahol a projektet legutóbb abbahagytad.
  try {
    return lastPageOf(activeProjectId());
  } catch {
    return 'matrix';
  }
}

function App() {
  const [tab, setTab] = useState<Tab>(tabFromHash);
  const { isOn } = useModules();
  useEffect(() => {
    const onHash = () => setTab(tabFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const go = (t: Tab) => {
    setTab(t);
    try {
      history.replaceState(null, '', `#${t}`);
    } catch {
      /* keretben tiltott lehet – a fül állapota így is megmarad */
    }
  };

  return (
    <NavProvider value={{ page: tab, go }}>
      <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-xs text-amber-900">
        <b>Prototípus, csak kitalált tesztanyaggal.</b> Az AI-elemzés élő (interjú-jegyzet, saját Word/PDF/szöveg dokumentum): a claude.ai AI-ja fut a te
        fiókodon, első használatkor engedélyt kér. Hangfájl itt nem dolgozható fel, azt a saját gépes változat tudja. A módosítások csak ebben a böngészőben
        maradnak meg; a projektet a jobb felső sarokban fájlba mentheted.
      </div>
      <nav className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-6 px-4 sm:px-6 lg:px-8">
          <span className="py-3 text-sm font-semibold tracking-tight text-slate-900">ICT Health Check</span>
          {PAGE_IDS.filter((t) => pageVisible(t, isOn)).map((t) => (
            <button
              key={t}
              onClick={() => go(t)}
              aria-current={tab === t ? 'page' : undefined}
              className={`-mb-px border-b-2 py-3 text-sm ${
                tab === t ? 'border-slate-900 font-medium text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              {PAGE_LABEL[t]}
            </button>
          ))}
          <div className="ml-auto py-2">
            <ProjectBar saveFile={savePdf} allowNewTab={false} />
          </div>
        </div>
      </nav>
      <main>
        <ProjectScope>
          {tab === 'matrix' && <RedFlagMatrix savePdf={savePdf} fontBase={fontBase} showPrint={false} />}
          {tab === 'adatok' && <IntakeWorkspace onOpenMatrix={() => go('matrix')} />}
          {tab === 'interjuk' && <InterviewWorkspace showPrint={false} />}
          {tab === 'projekt' && <ProjectWorkspace />}
        </ProjectScope>
        {/* Hely a lebegő Kalauz gombnak, hogy ne takarja a lap alját. */}
        <div className="h-20" aria-hidden />
      </main>
      <Guide />
    </NavProvider>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AiBackendProvider value={sampleBackend}>
      <App />
    </AiBackendProvider>
  </StrictMode>,
);
