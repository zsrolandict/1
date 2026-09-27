'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/', label: 'Red Flag mátrix' },
  { href: '/interjuk', label: 'Interjúk' },
];

export default function AppNav() {
  const path = usePathname();
  return (
    <nav className="border-b border-slate-200 bg-white print:hidden">
      <div className="mx-auto flex max-w-[1400px] items-center gap-6 px-4 sm:px-6 lg:px-8">
        <span className="py-3 text-sm font-semibold tracking-tight text-slate-900">ICT Health Check</span>
        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={`-mb-px border-b-2 py-3 text-sm ${
              path === l.href ? 'border-slate-900 font-medium text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            {l.label}
          </Link>
        ))}
        <Link href="/login" className="ml-auto py-3 text-sm text-slate-500 hover:text-slate-800">
          Belépés
        </Link>
      </div>
    </nav>
  );
}
