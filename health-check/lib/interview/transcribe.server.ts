import type { Transcript } from './types';

/**
 * Hang → szöveg. Szolgáltató-független interfész; az alapértelmezett
 * implementáció az Azure AI Speech „fast transcription” REST API-ja
 * (EU régióban futtatható, magyar nyelv + beszélő-szétválasztás).
 *
 * Környezeti változók: AZURE_SPEECH_KEY, AZURE_SPEECH_REGION (pl. westeurope).
 * A hangfájlt nem tároljuk: memóriában továbbítjuk, csak a leirat marad meg.
 */
export interface TranscriptionProvider {
  name: string;
  transcribe(audio: Blob, fileName: string, opts: { maxSpeakers: number }): Promise<Transcript>;
}

export function isTranscriptionConfigured(): boolean {
  return Boolean(process.env.AZURE_SPEECH_KEY && process.env.AZURE_SPEECH_REGION);
}

interface AzurePhrase {
  offsetMilliseconds: number;
  durationMilliseconds: number;
  text: string;
  speaker?: number;
}

interface AzureFastTranscriptionResponse {
  durationMilliseconds?: number;
  phrases?: AzurePhrase[];
}

export const azureSpeech: TranscriptionProvider = {
  name: 'Azure AI Speech',
  async transcribe(audio, fileName, { maxSpeakers }) {
    const region = process.env.AZURE_SPEECH_REGION;
    const key = process.env.AZURE_SPEECH_KEY;
    if (!region || !key) throw new Error('A leiratkészítő szolgáltatás nincs beállítva.');

    const form = new FormData();
    form.append('audio', audio, fileName);
    form.append(
      'definition',
      JSON.stringify({
        locales: ['hu-HU'],
        diarization: { enabled: true, maxSpeakers },
        profanityFilterMode: 'None',
      }),
    );

    const res = await fetch(
      `https://${region}.api.cognitive.microsoft.com/speechtotext/transcriptions:transcribe?api-version=2024-11-15`,
      { method: 'POST', headers: { 'Ocp-Apim-Subscription-Key': key }, body: form },
    );
    if (!res.ok) {
      throw new Error(`Leiratkészítés sikertelen (${res.status}).`);
    }
    return azureToTranscript((await res.json()) as AzureFastTranscriptionResponse);
  },
};

/** Az Azure-válasz átalakítása; az egymást követő azonos beszélős mondatokat összevonjuk. */
export function azureToTranscript(body: AzureFastTranscriptionResponse): Transcript {
  const segments: Transcript['segments'] = [];
  for (const p of body.phrases ?? []) {
    const speaker = p.speaker != null ? `Beszélő ${p.speaker}` : 'Beszélő';
    const end = p.offsetMilliseconds + p.durationMilliseconds;
    const prev = segments.at(-1);
    if (prev && prev.speaker === speaker && p.offsetMilliseconds - prev.endMs < 1500) {
      prev.text += ` ${p.text}`;
      prev.endMs = end;
    } else {
      segments.push({ speaker, startMs: p.offsetMilliseconds, endMs: end, text: p.text });
    }
  }
  return {
    language: 'hu-HU',
    durationMs: body.durationMilliseconds ?? segments.at(-1)?.endMs ?? 0,
    segments,
    origin: 'AUDIO',
    timed: true,
  };
}
