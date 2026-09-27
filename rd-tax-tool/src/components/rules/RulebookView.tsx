/** Rulebook page: every rule the engine applies, for the tax team's sign-off. */
import { BookCheck } from 'lucide-react';
import { RULE_STATUS_LABELS, RULEBOOK, RULEBOOK_CONFIRMED_ON, RULEBOOK_VERSION, rulebookSummary, type RuleStatus } from '../../domain/rulebook';

const COUNT_KEY = { CONFIRMED: 'confirmed', SOURCE: 'source', VERIFY: 'verify', METHOD: 'method' } as const;

const STATUS_CLS: Record<RuleStatus, string> = {
  CONFIRMED: 'bg-risk-green-soft text-risk-green',
  SOURCE: 'bg-navy-50 text-navy-700',
  VERIFY: 'bg-risk-yellow-soft text-risk-yellow',
  METHOD: 'bg-slate-100 text-slate-600',
};

export function RulebookView() {
  const sum = rulebookSummary();
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 font-serif text-2xl font-bold text-navy-900">
            <BookCheck className="size-6 text-navy-700" aria-hidden />
            Szabálykönyv
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">
            A számítási motor minden kulcsa és szabálya, közvetlenül a programkódból. Ami itt szerepel, pontosan azzal számol a program. A
            verziószám minden vezetői riportra és lezárt ügyre rákerül.
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm">
          <p className="font-semibold text-navy-900">v{RULEBOOK_VERSION}</p>
          <p className="text-xs text-slate-500">Adócsapat jóváhagyása: {RULEBOOK_CONFIRMED_ON}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        {(['CONFIRMED', 'SOURCE', 'VERIFY', 'METHOD'] as const).map((s) => (
          <span key={s} className={`rounded-md px-2.5 py-1 font-semibold ${STATUS_CLS[s]}`}>
            {RULE_STATUS_LABELS[s]}: {sum[COUNT_KEY[s]]}
          </span>
        ))}
        <span className="rounded-md px-2.5 py-1 text-slate-500">Összesen {sum.total} szabály</span>
      </div>

      {RULEBOOK.map((group) => (
        <section key={group.title} className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <h2 className="border-b border-slate-100 px-6 py-3 text-[15px] font-semibold text-navy-900">{group.title}</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="text-left text-xs tracking-wide text-slate-500 uppercase">
                  <th className="px-6 py-2 font-medium">Szabály</th>
                  <th className="px-3 py-2 text-right font-medium">Érték</th>
                  <th className="px-3 py-2 font-medium">Jogszabály</th>
                  <th className="px-6 py-2 font-medium">Státusz</th>
                </tr>
              </thead>
              <tbody>
                {group.rules.map((r) => (
                  <tr key={r.id} className="border-t border-slate-100 align-top">
                    <td className="px-6 py-2.5">
                      <span className="text-slate-800">{r.rule}</span>
                      {r.note && <span className="mt-0.5 block text-xs text-slate-500">{r.note}</span>}
                    </td>
                    <td className="tabular px-3 py-2.5 text-right font-semibold whitespace-nowrap text-navy-900">{r.value}</td>
                    <td className="px-3 py-2.5 font-mono text-xs whitespace-nowrap text-slate-500">{r.reference}</td>
                    <td className="px-6 py-2.5">
                      <span className={`rounded px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap ${STATUS_CLS[r.status]}`}>
                        {RULE_STATUS_LABELS[r.status]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}
