'use client';

import Link from 'next/link';
import AccountLink from './AccountLink';
import { usePathname } from 'next/navigation';
import { PAGE_IDS, PAGE_LABEL } from '@/lib/guide';
import { pageVisible } from '@/lib/modules';
import { PAGE_PATH } from './Nav';
import { useModules } from './useModules';
import ProjectBar from './project/ProjectBar';

export default function AppNav() {
  const path = usePathname();
  const { isOn } = useModules();
  const links = PAGE_IDS.filter((p) => pageVisible(p, isOn)).map((p) => ({ href: PAGE_PATH[p], label: PAGE_LABEL[p] }));
  return (
    <nav className="border-b border-slate-200 bg-white print:hidden">
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-6 px-4 sm:px-6 lg:px-8">
        <span className="py-3 text-sm font-semibold tracking-tight text-slate-900">ICT Health Check</span>
        {links.map((l) => (
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
        <div className="ml-auto py-2">
          <ProjectBar />
        </div>
        <AccountLink />
      </div>
    </nav>
  );
}
