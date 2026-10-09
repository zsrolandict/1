import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextResponse } from 'next/server';

/**
 * API-végpontok integrációs tesztje: a teljes lánc (őr → validálás →
 * hibaválasz) route-szinten. Az őrt és az AI-hívást mockoljuk; élő
 * szolgáltató nem kell.
 */

const guard = vi.hoisted(() => ({
  mode: 'deny' as 'deny' | 'allow',
  requireAi: vi.fn(),
  requireStaff: vi.fn(),
}));
const ai = vi.hoisted(() => ({ calls: 0 }));

vi.mock('@/lib/auth/guard.server', () => ({
  requireAi: guard.requireAi,
  requireStaff: guard.requireStaff,
}));
vi.mock('@/lib/ai/client.server', async (orig) => {
  const real = await orig<typeof import('@/lib/ai/client.server')>();
  return {
    ...real,
    isAiConfigured: () => true,
    aiProvider: () => 'anthropic',
    parseStructured: async () => {
      ai.calls++;
      throw new Error('az AI-t ebben a tesztben nem szabadna elérni');
    },
  };
});
vi.mock('@/lib/interview/ai.server', async (orig) => {
  const real = await orig<typeof import('@/lib/interview/ai.server')>();
  return {
    ...real,
    isAiConfigured: () => true,
    analyzeInterview: async () => {
      ai.calls++;
      throw new Error('nem érhető el');
    },
  };
});

const denied = () => ({ ok: false, response: NextResponse.json({ error: 'Bejelentkezés szükséges.' }, { status: 401 }) });
const allowed = () => ({ ok: true, mode: 'SUPABASE', userId: 'u1', role: 'consultant' });

beforeEach(() => {
  ai.calls = 0;
  guard.requireAi.mockImplementation(async () => (guard.mode === 'deny' ? denied() : allowed()));
  guard.requireStaff.mockImplementation(async () => (guard.mode === 'deny' ? denied() : allowed()));
});

const ROUTES = [
  'documents/analyze',
  'intake/case',
  'intake/registry',
  'intake/synthesis',
  'interviews/analyze',
  'interviews/guide',
  'interviews/transcribe',
  'risk/review',
];
const post = (body: BodyInit | null, type = 'application/json') =>
  new Request('http://localhost/api/x', { method: 'POST', body, headers: body instanceof FormData ? undefined : { 'content-type': type } });

describe('API-végpontok', () => {
  it('minden POST-végpont az AI-őrrel kezdődik (új végpontból se maradhasson ki)', () => {
    const root = path.resolve(import.meta.dirname, '..', 'app', 'api');
    const files: string[] = [];
    const walk = (d: string) => {
      for (const f of readdirSync(d)) {
        const p = path.join(d, f);
        if (statSync(p).isDirectory()) walk(p);
        else if (f === 'route.ts') files.push(p);
      }
    };
    walk(root);
    // Nem AI-végpont, de saját őre van: a projekt mentése csak belső, bejelentkezett felhasználónak.
    const STAFF_ONLY = [path.join('engagements', '[id]', 'save', 'route.ts'), path.join('engagements', 'route.ts')];
    const posts = files.filter((f) => /export async function POST/.test(readFileSync(f, 'utf8')) && !STAFF_ONLY.some((x) => f.endsWith(x)));
    expect(posts.length).toBe(ROUTES.length);
    for (const x of STAFF_ONLY) {
      const src = readFileSync(path.join(root, x), 'utf8');
      const body = src.slice(src.indexOf('export async function POST'));
      expect(body.split('\n').slice(1, 3).join('\n'), x).toMatch(/await requireStaff\(\)/);
    }
    for (const f of posts) {
      const src = readFileSync(f, 'utf8');
      const body = src.slice(src.indexOf('export async function POST'));
      expect(body.split('\n').slice(1, 3).join('\n'), f).toMatch(/await requireAi\(req/);
    }
  });

  for (const r of ROUTES) {
    it(`${r}: bejelentkezés nélkül 401, és az AI-t nem hívja`, async () => {
      guard.mode = 'deny';
      const { POST } = await import(`@/app/api/${r}/route`);
      const res: Response = await POST(post('{}'));
      expect(res.status).toBe(401);
      expect(ai.calls).toBe(0);
    });

    // 503: a leiratkészítő nincs beállítva a tesztkörnyezetben – az is a feldolgozás előtt áll meg.
    it(`${r}: hibás kérés 400 (413, 503), az AI-t nem hívja`, async () => {
      guard.mode = 'allow';
      const { POST } = await import(`@/app/api/${r}/route`);
      const form = new FormData();
      const res: Response = await POST(r === 'documents/analyze' || r === 'interviews/transcribe' ? post(form) : post('{"hibás": true}'));
      expect([400, 413, 503]).toContain(res.status);
      expect((await res.json()).error).toBeTruthy();
      expect(ai.calls).toBe(0);
    });
  }

  it('státusz: bejelentkezés nélkül nem árul el részletet', async () => {
    guard.mode = 'deny';
    const { GET } = await import('@/app/api/interviews/status/route');
    const body = await (await GET()).json();
    expect(body).toEqual({ ai: false, documents: false, transcription: false });
  });
});
