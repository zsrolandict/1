import { createClient } from '@supabase/supabase-js';

/**
 * Service role kliens – KIZÁRÓLAG szerveren, és csak olyan írásra, amit a
 * felhasználó maga nem végezhet (pl. az AI-felülvizsgálat rögzítése, audit K8).
 * A kulcs (`SUPABASE_SERVICE_ROLE_KEY`) soha nem NEXT_PUBLIC_, a böngészőbe nem kerül.
 * Előtte a hívó mindig a felhasználó saját (RLS-es) kapcsolatán ellenőrzi a jogosultságot.
 */
export function supabaseServiceRole() {
  if (typeof window !== 'undefined') throw new Error('A service role kliens csak szerveren használható.');
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
