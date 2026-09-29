import { afterEach, describe, expect, it } from 'vitest';
import { logEvent, setMonitoringSink, timedAiCall } from './monitoring';

const lines: string[] = [];
setMonitoringSink((l) => lines.push(l));
afterEach(() => (lines.length = 0));

describe('strukturált napló', () => {
  it('egy esemény egy JSON-sor, időbélyeggel', () => {
    logEvent({ event: 'ai_rate_limited', kind: 'ai' }, new Date('2026-01-01T00:00:00Z'));
    expect(JSON.parse(lines[0])).toEqual({ ts: '2026-01-01T00:00:00.000Z', app: 'ict-health-check', event: 'ai_rate_limited', kind: 'ai' });
  });

  it('AI-hívás: siker és hiba időzítve; a hibaüzenet (tartalom) nem kerül a naplóba', async () => {
    await timedAiCall('gemini', async () => 1);
    await expect(
      timedAiCall('gemini', async () => {
        throw new TypeError('Titkos Kft. szerződése: …');
      }),
    ).rejects.toThrow();
    const [ok, bad] = lines.map((l) => JSON.parse(l));
    expect(ok).toMatchObject({ event: 'ai_call', provider: 'gemini', ok: true });
    expect(bad).toMatchObject({ event: 'ai_call', ok: false, error: 'TypeError' });
    expect(lines.join('')).not.toContain('Titkos');
  });
});
