import { describe, expect, it } from 'vitest';
import { ENGAGEMENT_KINDS } from './kinds';
import { EngagementKindSchema } from './kindSchema';

describe('átvilágítás-típus séma', () => {
  it('pontosan a definiált típusokat fogadja el', () => {
    for (const k of Object.keys(ENGAGEMENT_KINDS)) expect(EngagementKindSchema.safeParse(k).success).toBe(true);
    expect(EngagementKindSchema.safeParse('ISMERETLEN').success).toBe(false);
  });
});
