import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { authMode, isStaffRole } from './mode';

describe('authMode', () => {
  it('Supabase beállítva → SUPABASE', () => {
    expect(authMode({ NEXT_PUBLIC_SUPABASE_URL: 'u', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'k' })).toBe('SUPABASE');
  });
  it('demó csak fejlesztésben és kifejezett engedéllyel', () => {
    expect(authMode({ ALLOW_DEMO_API: '1', NODE_ENV: 'development' })).toBe('DEMO');
    expect(authMode({ ALLOW_DEMO_API: '1', NODE_ENV: 'production' })).toBe('LOCKED');
    expect(authMode({ NODE_ENV: 'development' })).toBe('LOCKED');
  });
  it('ügyfél nem belső szerepkör', () => {
    expect(isStaffRole('partner')).toBe(true);
    expect(isStaffRole('client')).toBe(false);
    expect(isStaffRole(undefined)).toBe(false);
  });
});

// ── requireStaff: a Supabase-klienst és a sütiket mockoljuk ──────────

const state = {
  user: null as null | { id: string },
  role: null as null | string,
};

vi.mock('next/headers', () => ({
  cookies: async () => ({ getAll: () => [], set: () => {} }),
}));

vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({
    auth: { getUser: async () => ({ data: { user: state.user }, error: state.user ? null : new Error('no session') }) },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: state.role ? { role: state.role } : null }) }) }),
    }),
  }),
}));

describe('requireStaff', () => {
  const saved = { ...process.env };
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://x.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon';
    state.user = null;
    state.role = null;
  });
  afterEach(() => {
    process.env = { ...saved };
  });

  it('bejelentkezés nélkül 401', async () => {
    const { requireStaff } = await import('./guard.server');
    const r = await requireStaff();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.response.status).toBe(401);
  });

  it('ügyfél-felhasználó 403', async () => {
    const { requireStaff } = await import('./guard.server');
    state.user = { id: 'u1' };
    state.role = 'client';
    const r = await requireStaff();
    if (r.ok) throw new Error('should be denied');
    expect(r.response.status).toBe(403);
  });

  it('tanácsadó beléphet', async () => {
    const { requireStaff } = await import('./guard.server');
    state.user = { id: 'u2' };
    state.role = 'consultant';
    expect(await requireStaff()).toMatchObject({ ok: true, userId: 'u2', role: 'consultant' });
  });

  it('beállítás nélkül zárva (503)', async () => {
    const { requireStaff } = await import('./guard.server');
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    const r = await requireStaff();
    if (r.ok) throw new Error('should be locked');
    expect(r.response.status).toBe(503);
  });
});
