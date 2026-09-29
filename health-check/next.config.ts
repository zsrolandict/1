import type { NextConfig } from 'next';

const dev = process.env.NODE_ENV !== 'production';

/**
 * Biztonsági fejlécek minden oldalra.
 * - CSP: csak saját forrás + Supabase (bejelentkezés, adatbázis). A Next
 *   saját beágyazott szkriptjei miatt a script-src 'unsafe-inline';
 *   fejlesztői módban a gyors újratöltéshez 'unsafe-eval' is kell.
 * - Beágyazás (clickjacking) tiltva, a mikrofon csak a saját oldalon.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self' https://*.supabase.co wss://*.supabase.co${dev ? ' ws:' : ''}`,
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), geolocation=(), microphone=(self)' },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
