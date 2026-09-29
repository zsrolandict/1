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
