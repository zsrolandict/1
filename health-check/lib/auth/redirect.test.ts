import { describe, expect, it } from 'vitest';
import { safeRedirectPath } from './redirect';

const origin = 'https://hc.example';

describe('belépés utáni visszairányítás', () => {
  it('saját útvonal marad', () => {
    expect(safeRedirectPath('/adatok?projekt=p-1#x', origin)).toBe('/adatok?projekt=p-1#x');
    expect(safeRedirectPath(null, origin)).toBe('/');
  });

  it('idegen oldalra mutató trükkök a főoldalra esnek vissza', () => {
    for (const bad of ['//evil.com', '/\\evil.com', '/\t/evil.com', 'https://evil.com', '/%09/evil.com/..', 'javascript:alert(1)']) {
      const path = safeRedirectPath(bad, origin);
      expect(new URL(path, origin).origin).toBe(origin);
    }
    expect(safeRedirectPath('/\\evil.com', origin)).toBe('/');
  });
});
