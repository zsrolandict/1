'use client';

import { MODULES, type ModuleId } from '@/lib/modules';
import { useModules } from './useModules';

/** Kikapcsolt modul helyén: rövid jelzés és visszakapcsolás. */
export default function ModuleOff({ ids }: { ids: ModuleId[] }) {
  const { toggle } = useModules();
  const names = MODULES.filter((m) => ids.includes(m.id));
  return (
    <div className="mx-auto my-8 max-w-xl rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-600">
      <p>{names.length === 1 ? `A(z) „${names[0].label}” modul` : 'Az oldal moduljai'} ebben a projektben ki van kapcsolva. Az adatai megmaradtak.</p>
      <div className="mt-3 flex flex-wrap justify-center gap-2">
        {names.map((m) => (
          <button key={m.id} onClick={() => toggle(m.id)} className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700">
            {m.label} bekapcsolása
          </button>
        ))}
      </div>
    </div>
  );
}
