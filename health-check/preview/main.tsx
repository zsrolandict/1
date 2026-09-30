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
import AppShell from '@/components/shell/AppShell';
import { isPageId, type PageId } from '@/lib/guide';
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

// A felület betűje (Inter) a közzétett oldal melletti fonts/ mappából; a Next-alkalmazásban a globals.css adja.
const fontFaces: [string, string, string][] = [
  ['Inter_400Regular.ttf', '400', 'normal'],
  ['Inter_400Regular_Italic.ttf', '400', 'italic'],
  ['Inter_600SemiBold.ttf', '500 600', 'normal'],
  ['Inter_700Bold.ttf', '700 900', 'normal'],
];
const fontStyle = document.createElement('style');
fontStyle.textContent = fontFaces
  .map(
    ([file, weight, style]) =>
      `@font-face{font-family:'Inter';src:url('${fontBase}/${file}') format('truetype');font-weight:${weight};font-style:${style};font-display:swap}`,
  )
  .join('\n');
document.head.appendChild(fontStyle);

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
      <AppShell
        project={<ProjectBar saveFile={savePdf} allowNewTab={false} />}
        banner={
          <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-xs text-amber-900 print:hidden">
            <b>Prototípus, csak kitalált tesztanyaggal.</b> Az AI-elemzés élő (interjú-jegyzet, saját Word/PDF/szöveg dokumentum): a claude.ai AI-ja fut a te
            fiókodon, első használatkor engedélyt kér. Hangfájl itt nem dolgozható fel, azt a saját gépes változat tudja. A módosítások csak ebben a böngészőben
            maradnak meg; a projektet a jobb felső sarokban fájlba mentheted.
          </div>
        }
      >
        <ProjectScope>
          {tab === 'matrix' && <RedFlagMatrix savePdf={savePdf} fontBase={fontBase} showPrint={false} />}
          {tab === 'adatok' && <IntakeWorkspace onOpenMatrix={() => go('matrix')} />}
          {tab === 'interjuk' && <InterviewWorkspace showPrint={false} />}
          {tab === 'projekt' && <ProjectWorkspace />}
        </ProjectScope>
        {/* Hely a lebegő Kalauz gombnak, hogy ne takarja a lap alját. */}
        <div className="h-20" aria-hidden />
      </AppShell>
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
