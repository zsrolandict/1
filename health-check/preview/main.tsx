import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import RedFlagMatrix from '@/components/risk/RedFlagMatrix';
import InterviewWorkspace from '@/components/interview/InterviewWorkspace';
import type { SaveFile } from '@/components/report/ExportPdfButton';
import './styles.css';

/**
 * Kattintható előnézet (claude.ai Artifact): a Next.js alkalmazás kliens-
 * komponensei szerver nélkül. Az AI-végpontok itt nem érhetők el; a PDF-et
 * a nézőnek a `downloads` képesség adja át.
 */

type Tab = 'matrix' | 'interjuk';

interface DownloadsNs {
  save(req: { filename: string; data: Blob }): Promise<{ status: string }>;
}
declare global {
  interface Window {
    claude?: { use(name: 'downloads'): Promise<DownloadsNs | null> };
  }
}

const savePdf: SaveFile = async (blob, filename) => {
  const downloads = (await window.claude?.use('downloads')) ?? null;
  if (!downloads) throw new Error('A mentés ebben a nézetben nem érhető el.');
  try {
    await downloads.save({ filename, data: blob });
  } catch (e) {
    const code = (e as { code?: string })?.code;
    if (code === 'declined') return; // a néző meggondolta magát
    throw new Error(code === 'rate_limited' ? 'Egy mentési kérdés már nyitva van.' : 'A PDF mentése nem sikerült.');
  }
};

const fontBase = new URL('fonts', document.baseURI).href;

function tabFromHash(): Tab {
  return window.location.hash === '#interjuk' ? 'interjuk' : 'matrix';
}

function App() {
  const [tab, setTab] = useState<Tab>(tabFromHash);
  useEffect(() => {
    const onHash = () => setTab(tabFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const go = (t: Tab) => {
    setTab(t);
    try {
      history.replaceState(null, '', t === 'interjuk' ? '#interjuk' : '#matrix');
    } catch {
      /* keretben tiltott lehet – a fül állapota így is megmarad */
    }
  };

  return (
    <>
      <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-xs text-amber-900">
        <b>Prototípus, kitalált mintaadatokkal.</b> Az AI-elemzés és a hangfeldolgozás itt ki van kapcsolva; a minta-interjú
        és a minta-elemzés kipróbálható. A módosítások csak ebben a böngészőben maradnak meg.
      </div>
      <nav className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-6 px-4 sm:px-6 lg:px-8">
          <span className="py-3 text-sm font-semibold tracking-tight text-slate-900">ICT Health Check</span>
          {(
            [
              ['matrix', 'Red Flag mátrix'],
              ['interjuk', 'Interjúk'],
            ] as const
          ).map(([t, label]) => (
            <button
              key={t}
              onClick={() => go(t)}
              aria-current={tab === t ? 'page' : undefined}
              className={`-mb-px border-b-2 py-3 text-sm ${
                tab === t ? 'border-slate-900 font-medium text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </nav>
      <main>
        {tab === 'matrix' ? (
          <RedFlagMatrix savePdf={savePdf} fontBase={fontBase} showPrint={false} />
        ) : (
          <InterviewWorkspace showPrint={false} />
        )}
      </main>
    </>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
