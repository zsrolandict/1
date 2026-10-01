'use client';

import { ArrowUpRight } from 'lucide-react';
import { openSource } from '@/lib/focus';
import { itemsFromAnchor } from '@/lib/risk/trail';
import type { RiskItem } from '@/lib/risk/types';
import { useNav } from '../Nav';

/** Forrásnézet: „Ebből a mátrixban:” – a forrásra hivatkozó tételek, kattintásra a sorra ugrik. */
export default function UsedBy({ items, anchor }: { items: RiskItem[]; anchor: string }) {
  const nav = useNav();
  const used = itemsFromAnchor(items, anchor);
  if (!used.length) return null;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-2.5 text-xs">
      <span className="font-semibold text-slate-600">Ebből a mátrixban:</span>
      {used.map((r) => (
        <button
          key={r.id}
          onClick={() => nav && openSource({ page: 'matrix', anchor: `risk-${r.id}` }, nav.go, nav.page)}
          title={r.title}
          className="inline-flex max-w-[16rem] items-center gap-1 rounded-full border border-brand-200 bg-white px-2 py-0.5 font-medium text-brand-700 hover:bg-brand-50"
        >
          <span className="font-mono text-[10.5px] text-slate-500">{r.code}</span>
          <span className="truncate">{r.title}</span>
          <ArrowUpRight className="h-3 w-3 shrink-0" />
        </button>
      ))}
    </div>
  );
}
