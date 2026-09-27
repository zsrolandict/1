import { CircleX, ClipboardCheck, ShieldAlert } from 'lucide-react';
import {
  FRASCATI_CRITERIA,
  INDUSTRY_LABELS,
  INDUSTRY_RED_FLAGS,
  RED_FLAGS,
  type RedFlagDefinition,
} from '../../domain/constants';
import type { AuditAnswers, AuditResult, CriterionRating, Industry } from '../../domain/types';
import { Card } from '../ui/Card';

interface AuditStepProps {
  answers: AuditAnswers;
  industry: Industry;
  result: AuditResult;
  onChange: (patch: Partial<AuditAnswers>) => void;
}

const RATINGS: CriterionRating[] = [0, 1, 2, 3, 4];

export function AuditStep({ answers, industry, result, onChange }: AuditStepProps) {
  const industryFlags = INDUSTRY_RED_FLAGS[industry];
  const toggleFlag = (id: RedFlagDefinition['id'], checked: boolean) =>
    onChange({ redFlags: { ...answers.redFlags, [id]: checked } });

  return (
    <div className="flex flex-col gap-6">
      <Card
        title="Frascati-kritériumok – 5 kérdéses hatósági audit"
        subtitle="Mind az öt feltételnek együttesen teljesülnie kell; a 0 értékelés kizáró ok."
        icon={ClipboardCheck}
      >
        <ol className="flex flex-col divide-y divide-slate-100">
          {FRASCATI_CRITERIA.map((criterion, index) => {
            const rating = answers.ratings[criterion.id];
            return (
              <li key={criterion.id} className="py-5 first:pt-0 last:pb-0">
                <div className="mb-3 flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-navy-900">
                      {index + 1}. {criterion.label}
                      <span className="ml-2 text-xs font-normal text-slate-400">{criterion.englishLabel}</span>
                    </p>
                    <p className="mt-1 text-sm text-slate-600">{criterion.question}</p>
                  </div>
                  <span className="shrink-0 rounded-md bg-slate-50 px-2 py-1 text-xs text-slate-500">súly: {criterion.weight}</span>
                </div>
                <div className="grid grid-cols-5 gap-1.5" role="radiogroup" aria-label={criterion.label}>
                  {RATINGS.map((value) => {
                    const active = value === rating;
                    return (
                      <button
                        key={value}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        title={criterion.anchors[value]}
                        onClick={() => onChange({ ratings: { ...answers.ratings, [criterion.id]: value } })}
                        className={`rounded-md border py-2 text-sm font-semibold transition-colors ${
                          active
                            ? value === 0
                              ? 'border-risk-red bg-risk-red text-white'
                              : 'border-navy-800 bg-navy-800 text-white'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-400'
                        }`}
                      >
                        {value}
                      </button>
                    );
                  })}
                </div>
                <p className={`mt-2 text-xs ${rating === 0 ? 'text-risk-red' : 'text-slate-500'}`}>
                  <span className="font-medium">{rating}/4:</span> {criterion.anchors[rating]}
                </p>
              </li>
            );
          })}
        </ol>
      </Card>

      <Card
        title="NAV-kockázati csekklista"
        subtitle="Jelölje, ha a projektben az alábbi – jellemzően átminősített – tevékenység előfordul"
        icon={ShieldAlert}
      >
        <div className="flex flex-col gap-2">
          {RED_FLAGS.map((flag) => (
            <FlagRow key={flag.id} flag={flag} checked={Boolean(answers.redFlags[flag.id])} onToggle={toggleFlag} />
          ))}
        </div>
        {industryFlags.length > 0 && (
          <div className="mt-5">
            <p className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">
              Iparági kockázatok – {INDUSTRY_LABELS[industry]}
            </p>
            <div className="flex flex-col gap-2">
              {industryFlags.map((flag) => (
                <FlagRow key={flag.id} flag={flag} checked={Boolean(answers.redFlags[flag.id])} onToggle={toggleFlag} />
              ))}
            </div>
          </div>
        )}
      </Card>

      {result.knockOuts.length > 0 && (
        <div className="rounded-xl border border-risk-red/30 bg-risk-red-soft px-5 py-4" role="alert">
          <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-risk-red">
            <CircleX className="size-4" aria-hidden /> Kizáró tényezők – a pontszám a piros sávra korlátozva
          </p>
          <ul className="list-disc space-y-1 pl-6 text-sm text-slate-700">
            {result.knockOuts.map((k) => (
              <li key={k}>{k}</li>
            ))}
          </ul>
        </div>
      )}

      <Card title="Szakértői megjegyzés" subtitle="Megjelenik a vezetői riportban">
        <textarea
          className="min-h-24 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-navy-600 focus:ring-2 focus:ring-navy-100 focus:outline-none"
          value={answers.notes}
          placeholder="pl. Az interjú alapján a 2. mérföldkő utáni tevékenység már sorozatgyártás-előkészítés…"
          onChange={(e) => onChange({ notes: e.target.value })}
        />
      </Card>
    </div>
  );
}

interface FlagRowProps {
  flag: RedFlagDefinition;
  checked: boolean;
  onToggle: (id: RedFlagDefinition['id'], checked: boolean) => void;
}

function FlagRow({ flag, checked, onToggle }: FlagRowProps) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-3 rounded-lg border px-4 py-3 transition-colors ${
        checked ? 'border-risk-red/40 bg-risk-red-soft' : 'border-slate-200 hover:bg-slate-50'
      }`}
    >
      <input
        type="checkbox"
        className="mt-0.5 size-4 accent-[var(--color-risk-red)]"
        checked={checked}
        onChange={(e) => onToggle(flag.id, e.target.checked)}
      />
      <span className="flex-1">
        <span className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-800">
          {flag.label}
          {flag.critical && (
            <span className="rounded bg-risk-red px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-white uppercase">
              Kizáró
            </span>
          )}
        </span>
        <span className="block text-xs text-slate-500">{flag.description}</span>
      </span>
      <span className="tabular shrink-0 text-xs font-medium text-slate-500">−{flag.penalty} pont</span>
    </label>
  );
}
