import { GraduationCap, Package, Scale, TriangleAlert } from 'lucide-react';
import { LEGAL_REFERENCES, TAX_RATES } from '../../domain/constants';
import { formatHuf, formatPercent } from '../../domain/format';
import type { RdCostInputs, SavingsResult, TaxParameters } from '../../domain/types';
import { Card, LegalBadge } from '../ui/Card';
import { CurrencyInput, Toggle } from '../ui/fields';

interface CostStepProps {
  costs: RdCostInputs;
  params: TaxParameters;
  savings: SavingsResult;
  onCostsChange: (patch: Partial<RdCostInputs>) => void;
  onParamsChange: (patch: Partial<TaxParameters>) => void;
}

/** Inline "→ saving" line under an input. */
function SavingNote({ label, value }: { label: string; value: number }) {
  return (
    <p className="text-xs text-slate-500">
      {label}: <span className="tabular font-semibold text-navy-800">{formatHuf(value)}</span>
    </p>
  );
}

export function CostStep({ costs, params, savings, onCostsChange, onParamsChange }: CostStepProps) {
  const standardRate = TAX_RATES.SZOCHO * TAX_RATES.SZOCHO_RELIEF_STANDARD;
  const phdRate = TAX_RATES.SZOCHO * TAX_RATES.SZOCHO_RELIEF_PHD;

  return (
    <div className="flex flex-col gap-6">
      <Card
        title="Kutatói / mérnöki bérköltség"
        subtitle="K+F munkakörben foglalkoztatottak éves bruttó bére"
        icon={GraduationCap}
        aside={<LegalBadge>{LEGAL_REFERENCES.SZOCHO}</LegalBadge>}
      >
        <div className="grid gap-6 sm:grid-cols-2">
          <CurrencyInput
            label="Fejlesztő mérnökök (fokozat nélkül)"
            value={costs.engineerGrossWages}
            onChange={(engineerGrossWages) => onCostsChange({ engineerGrossWages })}
            sliderMax={300_000_000}
            sliderStep={1_000_000}
            hint={`Szocho-mentesség: 50% → ${formatPercent(standardRate)} a bruttó bérre`}
            annotation={<SavingNote label="Szocho-megtakarítás" value={savings.szocho.engineerSaving} />}
          />
          <CurrencyInput
            label="PhD / tudományos fokozatú kutatók"
            value={costs.phdGrossWages}
            onChange={(phdGrossWages) => onCostsChange({ phdGrossWages })}
            sliderMax={150_000_000}
            sliderStep={1_000_000}
            hint={`Szocho-mentesség: 100% → ${formatPercent(phdRate, 0)} a bruttó bérre`}
            annotation={<SavingNote label="Szocho-megtakarítás" value={savings.szocho.phdSaving} />}
          />
        </div>
      </Card>

      <Card
        title="Közvetlen K+F költségek"
        subtitle="Anyag, prototípus és külső K+F szolgáltatás"
        icon={Package}
        aside={<LegalBadge>{LEGAL_REFERENCES.CIT}</LegalBadge>}
      >
        <div className="grid gap-6 sm:grid-cols-3">
          <CurrencyInput
            label="Közvetlen anyagköltség"
            value={costs.materialCosts}
            onChange={(materialCosts) => onCostsChange({ materialCosts })}
            sliderMax={200_000_000}
          />
          <CurrencyInput
            label="Tesztelés és prototípus"
            value={costs.prototypeCosts}
            onChange={(prototypeCosts) => onCostsChange({ prototypeCosts })}
            sliderMax={200_000_000}
          />
          <CurrencyInput
            label="Független K+F alvállalkozó"
            value={costs.subcontractorCosts}
            onChange={(subcontractorCosts) => onCostsChange({ subcontractorCosts })}
            sliderMax={200_000_000}
          />
        </div>
      </Card>

      <Card title="Adóparaméterek" subtitle="Önkormányzati kulcs és számítási feltevések" icon={Scale} aside={<LegalBadge>{LEGAL_REFERENCES.HIPA}</LegalBadge>}>
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between">
              <label htmlFor="hipa-rate" className="text-[13px] font-medium text-slate-700">
                Helyi iparűzési adó kulcsa
              </label>
              <span className="tabular text-sm font-semibold text-navy-900">{formatPercent(params.hipaRate)}</span>
            </div>
            <input
              id="hipa-rate"
              type="range"
              min={0}
              max={TAX_RATES.HIPA_MAX}
              step={0.001}
              value={params.hipaRate}
              onChange={(e) => onParamsChange({ hipaRate: Number(e.target.value) })}
            />
            <p className="text-xs text-slate-500">A székhely/telephely szerinti önkormányzati rendelet alapján (max. 2%)</p>
          </div>
          <Toggle
            label="Fizetendő szocho beszámítása a bérköltségbe"
            description="A kedvezmény utáni munkáltatói szocho a közvetlen személyi költség része. Alapértelmezetten ki (konzervatív)."
            checked={params.includeEmployerContribution}
            onChange={(includeEmployerContribution) => onParamsChange({ includeEmployerContribution })}
          />
        </div>
      </Card>

      <Card title="Számítás levezetése" subtitle="Auditálható, tételes formula – minden sor a törvényi kulcsból számolva">
        <DerivationTable savings={savings} hipaRate={params.hipaRate} />
      </Card>

      {savings.warnings.length > 0 && <Warnings warnings={savings.warnings} />}
    </div>
  );
}

export function Warnings({ warnings }: { warnings: string[] }) {
  return (
    <div className="rounded-xl border border-risk-yellow/30 bg-risk-yellow-soft px-5 py-4" role="note">
      <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-risk-yellow">
        <TriangleAlert className="size-4" aria-hidden /> Szakértői figyelmeztetések
      </p>
      <ul className="list-disc space-y-1 pl-6 text-sm text-slate-700">
        {warnings.map((w) => (
          <li key={w}>{w}</li>
        ))}
      </ul>
    </div>
  );
}

export function DerivationTable({ savings, hipaRate }: { savings: SavingsResult; hipaRate: number }) {
  const base = formatHuf(savings.directRdCost);
  const rows = [
    {
      label: 'Szocho-kedvezmény',
      formula: 'mérnöki bér × 6,5% + PhD bér × 13%',
      value: savings.szocho.totalSaving,
    },
    {
      label: 'Tao – kétszeres levonás',
      formula: `${base} × ${formatPercent(TAX_RATES.CIT, 0)}`,
      value: savings.corporateTax.nominalSaving,
    },
    {
      label: 'HIPA-csökkentés',
      formula: `${base} × ${formatPercent(Math.min(hipaRate, TAX_RATES.HIPA_MAX))}`,
      value: savings.hipaSaving,
    },
    {
      label: 'Innovációs járulék',
      formula:
        savings.innovationContributionSaving > 0
          ? `${base} × ${formatPercent(TAX_RATES.INNOVATION_CONTRIBUTION)}`
          : 'kkv – nem kötelezett',
      value: savings.innovationContributionSaving,
    },
  ];

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs tracking-wide text-slate-500 uppercase">
            <th className="py-2 pr-4 font-medium">Jogcím</th>
            <th className="py-2 pr-4 font-medium">Képlet</th>
            <th className="py-2 text-right font-medium">Megtakarítás</th>
          </tr>
        </thead>
        <tbody className="tabular">
          {rows.map((r) => (
            <tr key={r.label} className="border-b border-slate-100">
              <td className="py-2.5 pr-4 text-slate-700">{r.label}</td>
              <td className="py-2.5 pr-4 font-mono text-xs text-slate-500">{r.formula}</td>
              <td className="py-2.5 text-right font-medium text-navy-900">{formatHuf(r.value)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td className="pt-3 font-semibold text-navy-900" colSpan={2}>
              Összesített tiszta adómegtakarítás
            </td>
            <td className="tabular pt-3 text-right text-base font-bold text-navy-900">{formatHuf(savings.totalAnnualSaving)}</td>
          </tr>
          {savings.corporateTax.deferredSaving > 0 && (
            <tr>
              <td className="pt-1 text-xs text-slate-500" colSpan={2}>
                ebből a Tao-hatás tárgyévben realizálható / elhatárolt része
              </td>
              <td className="tabular pt-1 text-right text-xs text-slate-500">
                {formatHuf(savings.corporateTax.immediateSaving)} / {formatHuf(savings.corporateTax.deferredSaving)}
              </td>
            </tr>
          )}
        </tfoot>
      </table>
    </div>
  );
}
