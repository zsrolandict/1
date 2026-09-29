import { z } from 'zod';
import { ENGAGEMENT_KINDS, type EngagementKind } from './kinds';

/** Az átvilágítás-típus sémája az API-khoz – egy forrásból (ENGAGEMENT_KINDS), kézi lista nélkül. */
export const ENGAGEMENT_KIND_IDS = Object.keys(ENGAGEMENT_KINDS) as [EngagementKind, ...EngagementKind[]];

export const EngagementKindSchema = z.enum(ENGAGEMENT_KIND_IDS);
