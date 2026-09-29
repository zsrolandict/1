import { describe, expect, it } from 'vitest';
import { dataPolicy, limitFor, RateLimiter } from './policy';

describe('AI adatkezelési szabály', () => {
  it('fejlesztői gépen szabad, éles módban DPA-megerősítés kell', () => {
    expect(dataPolicy({ NODE_ENV: 'development' }).ok).toBe(true);
    const locked = dataPolicy({ NODE_ENV: 'production' });
    expect(locked.ok).toBe(false);
    if (!locked.ok) expect(locked.error).toContain('AI_DPA_CONFIRMED=1');
    expect(dataPolicy({ NODE_ENV: 'production', AI_DPA_CONFIRMED: '1' }).ok).toBe(true);
    expect(dataPolicy({ NODE_ENV: 'production', AI_DPA_CONFIRMED: 'true' }).ok).toBe(false);
  });
});

describe('hívásszám-korlát', () => {
  it('az órás keret után 429, az ablak lejártával újra enged', () => {
    const l = new RateLimiter(3_600_000);
    const t0 = 1_000_000;
    for (let i = 0; i < 3; i++) expect(l.hit('ai:u1', 3, t0 + i).ok).toBe(true);
    const blocked = l.hit('ai:u1', 3, t0 + 10);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.retryAfterSec).toBeGreaterThan(3500);
    expect(l.hit('ai:u2', 3, t0 + 10).ok).toBe(true); // másik felhasználó
    expect(l.hit('ai:u1', 3, t0 + 3_600_001).ok).toBe(true);
  });

  it('alapértékek és felülírás környezeti változóval', () => {
    expect(limitFor('ai', {})).toBe(40);
    expect(limitFor('transcribe', {})).toBe(10);
    expect(limitFor('ai', { AI_RATE_LIMIT_PER_HOUR: '5' })).toBe(5);
    expect(limitFor('ai', { AI_RATE_LIMIT_PER_HOUR: 'x' })).toBe(40);
  });
});
