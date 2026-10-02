/**
 * A munkamenet-sütik (audit K10): HttpOnly – JavaScript nem olvashatja, így egy
 * esetleges XSS sem viheti el a tokent; Secure – élesben csak HTTPS-en;
 * SameSite=Lax – más oldalról indított POST nem viszi a sütit, de a belépési
 * link / Microsoft-visszairányítás (felső szintű GET) működik.
 * A böngésző ezért nem éri el a munkamenetet: a felhasználó adatai a
 * /api/me végpontról, a kilépés a /auth/signout végponton megy.
 */
export const AUTH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
};
