'use client';

import { useState } from 'react';
import { ClipboardList, RotateCcw } from 'lucide-react';
import { DIVISION_LABEL } from '@/lib/risk/catalog';
import { formatHuf, formatHufShort } from '@/lib/risk/engine';
import type { RiskItem } from '@/lib/risk/types';
import { estimateRemediation } from '@/lib/remediation/estimate';
import { ROLE_SHORT } from '@/lib/remediation/rates';
import type { FeeSource, PlanOverride } from '@/lib/remediation/types';
import { Badge, type Tone } from '../ui/primitives';

const SOURCE: Record<FeeSource, { label: string; tone: Tone }> = {
  TEMPLATE: { label: 'Tételre szabott sablon', tone: 'brand' },
  GENERIC: { label: 'Általános sablon – pontosítsd', tone: 'amber' },
  MANUAL: { label: 'Kézi díj', tone: 'violet' },
};

const num = (x: number) => x.toLocaleString('hu-HU', { maximumFractionDigits: 2 });

/**
 * Javítási terv: mit csinálunk, ki, hány órában, milyen óradíjjal – és ebből
 * a díj sávosan. A szakértő a terjedelmet és a lépések óráit pontosíthatja,
 * vagy kézi díjat adhat meg indoklással.
 */
export default function RemediationPlanCard({ risk, onChange }: { risk: RiskItem; onChange: (patch: Partial<RiskItem>) => void }) {
  const est = estimateRemediation(risk);
  const plan = risk.plan ?? {};
  const setPlan = (patch: Partial<PlanOverride>) => onChange({ plan: { ...plan, ...patch } });
  const setHours = (i: number, v: string) => {
    const hours = { ...(plan.hours ?? {}) };
    if (v.trim() === '') delete hours[String(i)];
    else hours[String(i)] = Math.max(0, Number(v.replace(',', '.')) || 0);
    setPlan({ hours });
  };
  const manual = est.source === 'MANUAL';
  const [lo, hi] = est.spread;

  return (
    <section aria-label="Javítási terv" className="mt-4 rounded-lg border border-slate-200 bg-white p-3 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
            <ClipboardList className="h-3.5 w-3.5" /> Javítási terv · indikatív díjbecslés, nem ajánlat
          </h4>
          <p className="mt-1 max-w-3xl text-slate-800">{est.goal}</p>
        </div>
        <div className="text-right">
          <p className="text-lg font-semibold tabular-nums text-slate-900">{formatHufShort(est.fee.base)}</p>
          {!manual && (
            <p className="text-xs tabular-nums text-slate-500">
              sáv: {formatHufShort(est.fee.low)} – {formatHufShort(est.fee.high)} · {num(est.hours)} óra
            </p>
          )}
          <div className="mt-1 flex flex-wrap justify-end gap-1">
            <Badge tone={SOURCE[est.source].tone}>{SOURCE[est.source].label}</Badge>
            {est.unapprovedRates && (
              <Badge tone="amber" title="Az óradíjak és a sablon-órák kezdő javaslatok; az üzletág hagyja jóvá.">
                óradíj: nem jóváhagyott
              </Badge>
            )}
          </div>
        </div>
      </div>

      {est.driver && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-md bg-slate-50 px-2.5 py-2 text-xs text-slate-700">
          <span className="font-medium">Terjedelem – {est.driver.label}:</span>
          <input
            type="number"
            min={0}
            aria-label={`Terjedelem: ${est.driver.label}`}
            value={est.driver.value}
            onChange={(e) => setPlan({ driver: e.target.value === '' ? null : Math.max(0, Number(e.target.value) || 0) })}
            className="w-20 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-center tabular-nums"
          />
          <span>{est.driver.unit}</span>
          <span className="text-slate-500">
            (
            {est.driver.origin === 'ITEM'
              ? 'a szakértő adta meg'
              : est.driver.origin === 'VALUATION'
                ? 'a kitettség-képlet darabszámából'
                : 'a sablon alapértéke – pontosítsd a cég adatai alapján'}
            )
          </span>
          {plan.driver != null && (
            <button onClick={() => setPlan({ driver: null })} className="inline-flex items-center gap-1 text-brand-700 hover:underline">
              <RotateCcw className="h-3 w-3" /> alapérték
            </button>
          )}
        </div>
      )}

      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[640px] text-xs">
          <thead className="text-left text-[11px] uppercase tracking-wide text-slate-500">
            <tr className="border-b border-slate-200">
              <th className="py-1.5 pr-2">Lépés</th>
              <th className="px-2 py-1.5">Ki</th>
              <th className="px-2 py-1.5 text-right">Óra</th>
              <th className="px-2 py-1.5 text-right">Óradíj</th>
              <th className="py-1.5 pl-2 text-right">Díj</th>
            </tr>
          </thead>
          <tbody>
            {est.steps.map((s) => (
              <tr key={s.index} className="border-b border-slate-100 align-top">
                <td className="py-1.5 pr-2">
                  <p className="font-medium text-slate-800">
                    {s.index + 1}. {s.label}
                  </p>
                  <p className="text-slate-500">{s.detail}</p>
                </td>
                <td className="whitespace-nowrap px-2 py-1.5 text-slate-600">
                  {DIVISION_LABEL[s.division]}, {ROLE_SHORT[s.role]}
                </td>
                <td className="px-2 py-1.5 text-right">
                  <input
                    inputMode="decimal"
                    aria-label={`${s.label}: óra`}
                    title={s.overridden ? 'Kézzel átírva (töröld a sablon értékéhez)' : `Sablon: ${s.hoursFormula} óra`}
                    value={s.overridden ? String(plan.hours?.[String(s.index)] ?? '') : num(s.hours)}
                    onChange={(e) => setHours(s.index, e.target.value)}
                    className={`w-16 rounded border px-1 py-0.5 text-right tabular-nums ${s.overridden ? 'border-violet-300 bg-violet-50' : 'border-slate-200'}`}
                  />
                  {!s.overridden && s.perUnit > 0 && <p className="mt-0.5 text-[10px] text-slate-400">{s.hoursFormula}</p>}
                </td>
                <td className="whitespace-nowrap px-2 py-1.5 text-right tabular-nums text-slate-600">{formatHuf(s.rate)}</td>
                <td className="whitespace-nowrap py-1.5 pl-2 text-right font-medium tabular-nums text-slate-800">{formatHuf(s.feeHuf)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="text-slate-800">
              <td className="py-1.5 pr-2 font-semibold">Terv szerint (várható)</td>
              <td />
              <td className="px-2 py-1.5 text-right font-semibold tabular-nums">{num(est.hours)}</td>
              <td />
              <td className="py-1.5 pl-2 text-right font-semibold tabular-nums">{formatHuf(est.planFeeHuf)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="mt-3 grid gap-3 text-xs text-slate-600 md:grid-cols-2">
        <div className="space-y-1.5">
          <p>
            <span className="font-medium text-slate-800">Sáv:</span> a várható díj × {num(lo)} – × {num(hi)}. {est.uncertainty}
          </p>
          <p>
            <span className="font-medium text-slate-800">Átfutás:</span> {risk.remediationDays} munkanap (ügyfél és ICT együtt; a quick win ebből számol).
          </p>
          <p>
            <span className="font-medium text-slate-800">Az ügyfél ráfordítása (nincs a díjban):</span> kb. {num(est.client.days)} nap – {est.client.who}.
          </p>
        </div>
        <div className="space-y-1.5">
          {est.external.length > 0 && (
            <p>
              <span className="font-medium text-slate-800">Külső költség (nincs a díjban):</span> {est.external.join('; ')}.
            </p>
          )}
          {est.assumptions.length > 0 && (
            <p>
              <span className="font-medium text-slate-800">Feltételezés:</span> {est.assumptions.join('; ')}.
            </p>
          )}
        </div>
      </div>

      <ManualFee risk={risk} plan={plan} planFeeHuf={est.planFeeHuf} onChange={onChange} />
    </section>
  );
}

function ManualFee({
  risk,
  plan,
  planFeeHuf,
  onChange,
}: {
  risk: RiskItem;
  plan: PlanOverride;
  planFeeHuf: number;
  onChange: (patch: Partial<RiskItem>) => void;
}) {
  // A régi egyösszegű díjat (serviceFeeHuf) is törölni kell, különben visszajönne.
  const set = (fee: number | null, note?: string) =>
    onChange({ plan: { ...plan, feeOverrideHuf: fee, note: fee == null ? undefined : (note ?? plan.note) }, ...(fee == null ? { serviceFeeHuf: 0 } : {}) });
  const legacy = plan.feeOverrideHuf == null && risk.serviceFeeHuf > 0 && estimateRemediation(risk).source === 'MANUAL';
  const value = plan.feeOverrideHuf ?? (legacy ? risk.serviceFeeHuf : null);
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <div className="mt-3 flex flex-wrap items-end gap-3 border-t border-slate-100 pt-3 text-xs">
      <label className="block">
        <span className="font-medium text-slate-700">Kézi díj (felülírja a tervet)</span>
        <input
          inputMode="numeric"
          aria-label="Kézi díj (Ft)"
          placeholder="nincs – a terv érvényes"
          value={draft ?? (value != null ? value.toLocaleString('hu-HU') : '')}
          onFocus={() => setDraft(value != null ? String(value) : '')}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            const v = (draft ?? '').replace(/\D/g, '');
            setDraft(null);
            set(v ? Number(v) : null);
          }}
          className="mt-1 block w-40 rounded border border-slate-200 px-2 py-1 text-right tabular-nums"
        />
      </label>
      {value != null && (
        <>
          <label className="block min-w-[240px] flex-1">
            <span className="font-medium text-slate-700">Miért tér el a tervtől ({formatHufShort(planFeeHuf)})?</span>
            <input
              value={plan.note ?? ''}
              onChange={(e) => onChange({ plan: { ...plan, feeOverrideHuf: value, note: e.target.value } })}
              placeholder={legacy ? 'Korábban beírt egyösszegű díj – írd le, min alapul.' : 'Pl. az ügyféllel egyeztetett fix díj.'}
              className="mt-1 block w-full rounded border border-slate-200 px-2 py-1"
            />
          </label>
          <button onClick={() => set(null)} className="inline-flex items-center gap-1 pb-1 text-brand-700 hover:underline">
            <RotateCcw className="h-3 w-3" /> vissza a tervhez
          </button>
        </>
      )}
    </div>
  );
}
