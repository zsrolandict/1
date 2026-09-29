import type { Contradiction, InterviewAnalysis, InterviewStatement, KnownFact, SuggestedRedFlag, Transcript, TranscriptSegment } from './types';

/** Összehasonlításhoz: kisbetű, ékezet- és írásjel-független, egyszeres szóköz. */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

export interface QuoteMatch {
  segment: TranscriptSegment;
  startMs: number | null;
}

/**
 * Megkeresi az idézetet a leiratban (akár szegmenshatáron átnyúlva).
 * Ez a hallucináció elleni fő védelem: amit az AI nem tud szó szerint
 * alátámasztani, az nem kerül a tanácsadó elé.
 */
export function findQuote(transcript: Transcript, quote: string): QuoteMatch | null {
  const needle = normalize(quote);
  if (needle.length < 8) return null; // túl rövid idézet nem bizonyíték
  let full = '';
  const starts: { offset: number; seg: TranscriptSegment }[] = [];
  for (const seg of transcript.segments) {
    starts.push({ offset: full.length, seg });
    full += normalize(seg.text) + ' ';
  }
  const at = full.indexOf(needle);
  if (at < 0) return null;
  let hit = starts[0];
  for (const s of starts) {
    if (s.offset <= at) hit = s;
    else break;
  }
  return { segment: hit.seg, startMs: transcript.timed ? hit.seg.startMs : null };
}

/**
 * Az AI-elemzés utólagos ellenőrzése:
 *  - csak a leiratban szó szerint megtalálható idézetű tételek maradnak,
 *  - az időbélyeget és a beszélőt a leiratból vesszük, nem a modelltől,
 *  - ellentmondás csak létező ismert tényre hivatkozhat.
 */
export function verifyAnalysis(raw: Omit<InterviewAnalysis, 'discardedUnverified'>, transcript: Transcript, facts: KnownFact[]): InterviewAnalysis {
  let discarded = 0;
  const factById = new Map(facts.map((f) => [f.id, f]));

  const statements: InterviewStatement[] = [];
  for (const s of raw.statements) {
    const m = findQuote(transcript, s.quote);
    if (!m) {
      discarded++;
      continue;
    }
    statements.push({ ...s, speaker: m.segment.speaker, startMs: m.startMs });
  }

  const suggestedRedFlags: SuggestedRedFlag[] = [];
  for (const f of raw.suggestedRedFlags) {
    const m = findQuote(transcript, f.quote);
    if (!m) {
      discarded++;
      continue;
    }
    suggestedRedFlags.push({
      ...f,
      startMs: m.startMs,
      confidence: Math.min(1, Math.max(0, f.confidence)),
    });
  }

  const contradictions: Contradiction[] = [];
  for (const c of raw.contradictions) {
    const m = findQuote(transcript, c.quote);
    const fact = factById.get(c.conflictingFactId);
    if (!m || !fact) {
      discarded++;
      continue;
    }
    contradictions.push({ ...c, startMs: m.startMs, conflictingSource: fact.source });
  }

  return {
    summary: raw.summary,
    statements,
    suggestedRedFlags: suggestedRedFlags.sort((a, b) => b.confidence - a.confidence),
    contradictions: contradictions.sort((a, b) => SEVERITY[b.severity] - SEVERITY[a.severity]),
    followUpQuestions: raw.followUpQuestions,
    discardedUnverified: discarded,
  };
}

const SEVERITY = { LOW: 0, MEDIUM: 1, HIGH: 2 } as const;

const TIMED_LINE = /^\s*\[(?:(\d{1,2}):)?(\d{1,2}):(\d{2})\]\s*(?:([^:]{1,40}):\s*)?(.*)$/;
const SPEAKER_LINE = /^\s*([^:\n]{1,40}):\s+(.+)$/;

/**
 * Kézi jegyzet → leirat. Támogatott sorok:
 *   [00:12:30] Ügyvezető: szöveg      (időbélyeggel)
 *   Kérdező: szöveg                   (beszélővel)
 *   szabad szöveg                     (bekezdésenként egy szegmens)
 */
export function notesToTranscript(text: string): Transcript {
  const segments: TranscriptSegment[] = [];
  let timed = false;
  let buffer: string[] = [];
  let lastSpeaker = 'Jegyzet';

  const flush = () => {
    const t = buffer.join(' ').trim();
    if (t) segments.push({ speaker: lastSpeaker, startMs: segments.length, endMs: segments.length, text: t });
    buffer = [];
  };

  for (const line of text.split(/\r?\n/)) {
    const tm = TIMED_LINE.exec(line);
    if (tm) {
      flush();
      const ms = ((Number(tm[1] ?? 0) * 60 + Number(tm[2])) * 60 + Number(tm[3])) * 1000;
      timed = true;
      lastSpeaker = tm[4]?.trim() || lastSpeaker;
      segments.push({ speaker: lastSpeaker, startMs: ms, endMs: ms, text: tm[5].trim() });
      continue;
    }
    const sm = SPEAKER_LINE.exec(line);
    if (sm) {
      flush();
      lastSpeaker = sm[1].trim();
      buffer.push(sm[2]);
      flush();
      continue;
    }
    if (!line.trim()) flush();
    else buffer.push(line.trim());
  }
  flush();

  // Időbélyeg nélküli szegmensek nem kaphatnak „valós” időt.
  const hasAllTimes = timed && segments.every((s, i) => i === 0 || s.startMs >= segments[i - 1].startMs);
  const last = segments.at(-1);
  return {
    language: 'hu-HU',
    durationMs: hasAllTimes && last ? last.endMs : 0,
    segments,
    origin: 'NOTES',
    timed: hasAllTimes,
  };
}

export function formatMs(ms: number | null): string {
  if (ms == null) return '';
  const s = Math.floor(ms / 1000);
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return hh ? `${hh}:${pad(mm)}:${pad(ss)}` : `${pad(mm)}:${pad(ss)}`;
}

/** Leirat → tömör szöveg a modellnek (beszélő + időbélyeg soronként). */
export function transcriptToPrompt(t: Transcript): string {
  return t.segments.map((s) => `${t.timed ? `[${formatMs(s.startMs)}] ` : ''}${s.speaker}: ${s.text}`).join('\n');
}
