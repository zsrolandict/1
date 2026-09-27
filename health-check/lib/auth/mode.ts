/**
 * Hitelesítési mód:
 *  - SUPABASE: be van állítva a Supabase → minden API-hívás bejelentkezett,
 *    belső (nem ügyfél) felhasználót követel.
 *  - DEMO: csak fejlesztői gépen, kifejezett engedéllyel (ALLOW_DEMO_API=1).
 *    Éles buildben (NODE_ENV=production) soha nem kapcsol be.
 *  - LOCKED: minden más esetben az API-végpontok zárva vannak.
 */
export type AuthMode = 'SUPABASE' | 'DEMO' | 'LOCKED';

type Env = Record<string, string | undefined>;

export function authMode(env: Env = process.env): AuthMode {
  if (env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return 'SUPABASE';
  if (env.ALLOW_DEMO_API === '1' && env.NODE_ENV !== 'production') return 'DEMO';
  return 'LOCKED';
}

/** Belső szerepkörök, amelyek az AI-végpontokat használhatják. */
export const STAFF_ROLES = ['partner', 'manager', 'consultant'] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export function isStaffRole(role: unknown): role is StaffRole {
  return typeof role === 'string' && (STAFF_ROLES as readonly string[]).includes(role);
}
