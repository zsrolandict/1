/**
 * Az ICT Health Check jele: kék négyzetben pulzusvonal, amely pipában végződik
 * (állapotfelmérés → rendben). A szövegrész opcionális (összecsukott nézet, favicon).
 */
export function BrandMark({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <defs>
        <linearGradient id="ict-hc-mark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#4d74f4" />
          <stop offset="1" stopColor="#1f43c4" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill="url(#ict-hc-mark)" />
      <path d="M5 17h4.5l2.2-5.5 3.6 11 2.6-7.2 2.1 3.6L26.5 10" fill="none" stroke="#fff" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function BrandLogo({ tone = 'dark' }: { tone?: 'dark' | 'light' }) {
  const main = tone === 'dark' ? 'text-white' : 'text-slate-900';
  const sub = tone === 'dark' ? 'text-slate-400' : 'text-slate-500';
  return (
    <span className="flex items-center gap-2.5">
      <BrandMark className="h-9 w-9 shrink-0" />
      <span className="leading-tight">
        <span className={`block text-[15px] font-bold tracking-tight ${main}`}>
          ICT <span className="font-semibold text-brand-400">Health</span> Check
        </span>
        <span className={`block text-[11px] font-semibold uppercase tracking-[0.12em] ${sub}`}>Átvilágítás · DD</span>
      </span>
    </span>
  );
}
