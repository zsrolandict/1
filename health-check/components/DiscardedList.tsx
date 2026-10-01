'use client';

import type { DiscardedItem } from '@/lib/ai/discarded';

/**
 * A program által kiszűrt AI-elemek lenyitható listája: mit javasolt az AI,
 * milyen idézettel, és miért esett ki. Régi mentésnél csak a darabszám van meg.
 */
export function DiscardedList({ count, items, noun = 'tételt' }: { count: number; items?: DiscardedItem[]; noun?: string }) {
  if (!count) return null;
  if (!items?.length)
    return (
      <p className="mt-1 text-xs text-amber-700">{`${count} nem igazolható ${noun} a rendszer kiszűrt (a részletek ebben a régebbi elemzésben nincsenek meg).`}</p>
    );
  return (
    <details className="mt-2 rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2 text-xs text-slate-700">
      <summary className="cursor-pointer font-medium text-amber-800">
        {count} nem igazolható {noun} a rendszer kiszűrt – mi esett ki és miért?
      </summary>
      <ul className="mt-2 space-y-2">
        {items.map((d, i) => (
          <li key={i} className="border-t border-amber-100 pt-2 first:border-0 first:pt-0">
            <p>
              <span className="font-semibold text-slate-800">{d.what}:</span> {d.text}
            </p>
            {d.quote && <p className="italic text-slate-500">Az AI idézete: „{d.quote}”</p>}
            <p className="text-amber-800">{d.reason}</p>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[11px] text-slate-500">
        Ha valamelyik mégis helytálló, a forrás alapján kézzel felveheted; a kiszűrt elem magától nem kerül sehova.
      </p>
    </details>
  );
}
