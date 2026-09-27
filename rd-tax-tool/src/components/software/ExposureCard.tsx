/** Money at risk from notification status and SaaS set-up, in forints. */
import { Banknote } from 'lucide-react';
import type { Exposure, ExposureKind } from '../../domain/exposure';
import { formatHuf } from '../../domain/format';

const KIND: Record<ExposureKind, { title: string; cls: string; tile: string }> = {
  LOST: { title: 'Elveszett', cls: 'text-risk-red', tile: 'border-risk-red/30 bg-risk-red-soft' },
  AT_RISK: { title: 'Veszélyben', cls: 'text-risk-yellow', tile: 'border-risk-yellow/40 bg-risk-yellow-soft' },
  FOREGONE: { title: 'Évente elmarad', cls: 'text-navy-700', tile: 'border-navy-100 bg-navy-50' },
};

export function ExposureCard({ exposure, compact = false }: { exposure: Exposure; compact?: boolean }) {
  if (exposure.items.length === 0) return null;
  const tiles: { kind: ExposureKind; amount: number; hint: string }[] = [
    { kind: 'LOST', amount: exposure.lost, hint: 'elmulasztott bejelentés – nem pótolható' },
    { kind: 'AT_RISK', amount: exposure.atRisk, hint: 'folyamatban lévő határidő' },
    { kind: 'FOREGONE', amount: exposure.foregoneAnnual, hint: 'SaaS licencdíj-elkülönítéssel elérhető' },
  ];
  const shown = tiles.filter((t) => t.amount > 0 || exposure.items.some((i) => i.kind === t.kind));

  return (
    <section className="rounded-xl border border-slate-200 bg-white px-6 py-5 shadow-sm" aria-label="Pénzben kifejezett kockázat">
      <p className="mb-3 flex items-center gap-2 text-[15px] font-semibold text-navy-900">
        <Banknote className="size-4 text-navy-700" aria-hidden />
        Mennyi pénz van veszélyben?
      </p>
      <div className={`grid gap-3 ${compact ? '' : 'sm:grid-cols-3'}`}>
        {shown.map((t) => (
          <div key={t.kind} className={`rounded-lg border px-4 py-3 ${KIND[t.kind].tile}`}>
            <p className={`text-[11px] font-semibold tracking-wider uppercase ${KIND[t.kind].cls}`}>{KIND[t.kind].title}</p>
            <p className="tabular mt-1 font-serif text-xl font-bold text-navy-900">
              {formatHuf(t.amount)}
              {t.kind === 'FOREGONE' && <span className="text-sm font-normal text-slate-500"> / év</span>}
            </p>
            <p className="text-xs text-slate-600">{t.hint}</p>
          </div>
        ))}
      </div>
      {!compact && (
        <ul className="mt-4 space-y-2 text-sm">
          {exposure.items.map((item) => (
            <li key={`${item.kind}-${item.label}`} className="flex flex-wrap justify-between gap-x-4 gap-y-0.5 border-b border-slate-100 pb-2 last:border-0">
              <span className="min-w-0 flex-1">
                <span className={`mr-2 text-[11px] font-semibold uppercase ${KIND[item.kind].cls}`}>{KIND[item.kind].title}</span>
                <span className="font-medium text-slate-800">{item.label}</span>
                <span className="block text-xs text-slate-500">{item.detail}</span>
              </span>
              <span className="tabular shrink-0 font-semibold text-navy-900">
                {formatHuf(item.amount)}
                {item.annual ? ' / év' : ''}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
