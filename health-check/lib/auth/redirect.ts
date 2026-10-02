/**
 * Belépés utáni visszairányítás célja: csak saját oldalra. A szöveges
 * ellenőrzés (`/`-rel kezdődik, nem `//`) nem elég: a böngésző a `/\evil.com`
 * és a `/<tab>/evil.com` alakot idegen oldalként értelmezi. Ezért a célt
 * ténylegesen feloldjuk, és a származási helyet (origin) hasonlítjuk.
 */
export function safeRedirectPath(next: string | null, origin: string): string {
  if (!next || !next.startsWith('/')) return '/';
  try {
    const target = new URL(next, origin);
    if (target.origin !== origin) return '/';
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return '/';
  }
}

/**
 * Engedélyezett e-mail-domainek (`ALLOWED_EMAIL_DOMAINS`, vesszővel elválasztva,
 * pl. „ict.hu,ict-europa.hu”). Üres beállításnál csak a meghívás számít.
 */
export function emailDomainAllowed(email: string, env: Record<string, string | undefined> = process.env): boolean {
  const list = (env.ALLOWED_EMAIL_DOMAINS ?? '')
    .split(',')
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
  if (!list.length) return true;
  const domain = email.toLowerCase().split('@')[1] ?? '';
  return list.includes(domain);
}
