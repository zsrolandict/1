import { afterEach, describe, expect, it, vi } from 'vitest';
import { errorResponse } from '@/app/api/_errors';
import { UserFacingError } from './errors';
import { ZipTooLargeError } from './intake/safeUnzip';

describe('API hibaválasz', () => {
  afterEach(() => vi.restoreAllMocks());

  it('szándékos, felhasználónak szóló üzenet átmegy', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = errorResponse(new UserFacingError('A PDF nem olvasható.'));
    expect(res.status).toBe(422);
    expect((await res.json()).error).toBe('A PDF nem olvasható.');
    expect((await errorResponse(new ZipTooLargeError()).json()).error).toContain('túl nagy');
  });

  it('belső hiba részlete nem szivárog ki', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = errorResponse(new Error('ENOENT: /srv/app/secret/path.json'));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).not.toContain('ENOENT');
    expect(body.error).toContain('Váratlan hiba');
  });
});
