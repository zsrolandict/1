import { GraduationCap, Package, Scale, TriangleAlert, Wrench } from 'lucide-react';
import { LEGAL_REFERENCES, TAX_RATES } from '../../domain/constants';
import { formatHuf, formatPercent } from '../../domain/format';
import type { RdCostInputs, SavingsResult, TaxParameters } from '../../domain/types';
import { Card, LegalBadge } from '../ui/Card';
import { CurrencyInput, NumberInput, Segmented, Toggle } from '../ui/fields';

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
  const routes = savings.engineerRoutes;
  const huf0 = (n: number) => formatHuf(n);

  return (
    <div className="flex flex-col gap-6">
      <Card
        title="Tudományos fokozatú kutatók"
        subtitle="Szocho-kedvezmény havi bérplafonnal, fejenként"
        icon={GraduationCap}
        aside={<LegalBadge>{LEGAL_REFERENCES.SZOCHO_15}</LegalBadge>}
      >
        <div className="grid gap-6">
          <div className="grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <CurrencyInput
              label="PhD / tudományos fokozatú kutatók éves bruttó bére"
              value={costs.phdGrossWages}
              onChange={(phdGrossWages) => onCostsChange({ phdGrossWages })}
              sliderMax={150_000_000}
              sliderStep={1_000_000}
              hint={`100% mentesség (${formatPercent(TAX_RATES.SZOCHO, 0)}), legfeljebb havi ${huf0(TAX_RATES.SZOCHO_PHD_MONTHLY_CAP)} bér után fejenként`}
              annotation={<SavingNote label="Szocho-megtakarítás" value={savings.szocho.phdSaving} />}
            />
            <NumberInput label="Létszám" value={costs.phdHeadcount} onChange={(phdHeadcount) => onCostsChange({ phdHeadcount })} suffix="fő" />
          </div>
          <div className="grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <CurrencyInput
              label="Doktoranduszok / doktorjelöltek éves bruttó bére"
              value={costs.doctoralGrossWages}
              onChange={(doctoralGrossWages) => onCostsChange({ doctoralGrossWages })}
              sliderMax={50_000_000}
              sliderStep={200_000}
              hint={`50% mentesség (${formatPercent(TAX_RATES.SZOCHO * TAX_RATES.SZOCHO_RELIEF_DOCTORAL)}), legfeljebb havi ${huf0(TAX_RATES.SZOCHO_DOCTORAL_MONTHLY_CAP)} bér után fejenként`}
              annotation={<SavingNote label="Szocho-megtakarítás" value={savings.szocho.doctoralSaving} />}
            />
            <NumberInput
              label="Létszám"
              value={costs.doctoralHeadcount}
              onChange={(doctoralHeadcount) => onCostsChange({ doctoralHeadcount })}
              suffix="fő"
            />
          </div>
          <div className="max-w-xs">
            <NumberInput
              label="Foglalkoztatási hónapok a tárgyévben"
              value={costs.researcherMonths}
              onChange={(researcherMonths) => onCostsChange({ researcherMonths })}
              min={1}
              max={12}
              suffix="hó"
              hint="A havi plafon ennyi hónapra számolódik"
            />
          </div>
        </div>
      </Card>

      <Card
        title="Fokozat nélküli K+F mérnökök, fejlesztők"
        subtitle="A bér vagy a Tao-levonásba, vagy a 16. § szerinti szocho-kedvezménybe kerül – a kettő együtt nem"
        icon={Wrench}
        aside={<LegalBadge>{LEGAL_REFERENCES.SZOCHO_16}</LegalBadge>}
      >
        <div className="grid gap-6">
          <CurrencyInput
            label="Fejlesztő mérnökök éves bruttó bére"
            value={costs.engineerGrossWages}
            onChange={(engineerGrossWages) => onCostsChange({ engineerGrossWages })}
            sliderMax={300_000_000}
            sliderStep={1_000_000}
            hint="A HIPA- és innovációsjárulék-alapot mindkét esetben csökkenti"
          />
          <Segmented
            label="Kedvezmény útja"
            value={params.engineerRelief}
            onChange={(engineerRelief) => onParamsChange({ engineerRelief })}
            options={[
              {
                value: 'CIT',
                label: `Tao-levonás (9%)${routes.recommended === 'CIT' ? ' · javasolt' : ''}`,
                description: `${huf0(routes.citNominal)} névleges, ebből tárgyévben ${huf0(routes.citImmediate)} realizálható`,
              },
              {
                value: 'SZOCHO_16',
                label: `Szocho 16. § (6,5%)${routes.recommended === 'SZOCHO_16' ? ' · javasolt' : ''}`,
                description: `${huf0(routes.szocho16)} havonta, a bérszámfejtésben – ekkor ez a bér nem vonható le a Tao-ban`,
              },
            ]}
          />
          <p className="text-xs text-slate-500">
            Nyereséges cégnél a Tao-út ér többet; veszteséges évben a szocho-kedvezmény azonnal pénzt hoz, míg a Tao-hatás
            csak elhatárolt veszteség lesz. A javaslat a tárgyévben realizálható összeget hasonlítja össze.
          </p>
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
        <div className="mt-6 grid gap-6 border-t border-slate-100 pt-5 sm:grid-cols-2">
          <CurrencyInput
            label="Ebből: vissza nem térítendő támogatásból fedezett rész"
            value={costs.grantFundedCosts}
            onChange={(grantFundedCosts) => onCostsChange({ grantFundedCosts })}
            hint="Kimarad a Tao- és a HIPA-kedvezmény alapjából (konzervatív, a támogatási szerződés szerint ellenőrizendő)"
          />
          <CurrencyInput
            label="Ebből: egyetemmel / kutatóintézettel kötött szerződés keretében"
            value={costs.universityJointCosts}
            onChange={(universityJointCosts) => onCostsChange({ universityJointCosts })}
            hint={`Tao: a költség háromszorosa vonható le, legfeljebb ${formatHuf(TAX_RATES.UNIVERSITY_CAP)} (de minimis)`}
            annotation={
              savings.universityUplift > 0 ? (
                <SavingNote label="Többletlevonás" value={savings.universityUplift} />
              ) : undefined
            }
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
          <div className="flex flex-col gap-3 sm:col-span-2">
            <Segmented
              label="Aktivált fejlesztés Tao-levonása (Tao. tv. 7. § (1) t))"
              value={params.citDeductionTiming}
              onChange={(citDeductionTiming) => onParamsChange({ citDeductionTiming })}
              options={[
                { value: 'IMMEDIATE', label: 'Felmerülés évében, egy összegben', description: 'Aktiválástól függetlenül az idei adóalapot csökkenti' },
                { value: 'AMORTIZATION', label: 'Értékcsökkenéssel arányosan', description: 'A levonás az amortizációs évekre oszlik' },
              ]}
            />
            {params.citDeductionTiming === 'AMORTIZATION' && (
              <div className="max-w-xs">
                <NumberInput
                  label="Amortizációs idő"
                  value={params.amortizationYears}
                  onChange={(amortizationYears) => onParamsChange({ amortizationYears })}
                  min={1}
                  max={20}
                  suffix="év"
                  hint="Lineáris, terv szerinti leírás; kettős levonás tilos"
                />
              </div>
            )}
          </div>
          <Toggle
            label="HIPA: az anyagköltséget az általános soron már levonják"
            description="Egy költség a HIPA-alapot csak egyszer csökkentheti. Bekapcsolva a K+F anyagköltség nem kerül be még egyszer K+F-levonásként (NAV-gyakorlat)."
            checked={params.hipaMaterialAlreadyDeducted}
            onChange={(hipaMaterialAlreadyDeducted) => onParamsChange({ hipaMaterialAlreadyDeducted })}
          />
          <Toggle
            label="HIPA: a K+F alvállalkozói díj alvállalkozói teljesítésként levonva"
            description="Ha a díjat a HIPA-bevallásban alvállalkozói teljesítésként már levonják, K+F költségként nem vonható le újra."
            checked={params.hipaSubcontractorAlreadyDeducted}
            onChange={(hipaSubcontractorAlreadyDeducted) => onParamsChange({ hipaSubcontractorAlreadyDeducted })}
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
  const base = formatHuf(savings.hipaDeductibleBase);
  const rows = [
    {
      label: 'Szocho – PhD (15. §)',
      formula: 'min(bér; fő × hó × 500 000) × 13%',
      value: savings.szocho.phdSaving,
    },
    {
      label: 'Szocho – doktorandusz (15. §)',
      formula: 'min(bér; fő × hó × 200 000) × 6,5%',
      value: savings.szocho.doctoralSaving,
    },
    {
      label: 'Szocho – mérnökök (16. §)',
      formula: savings.szocho.engineerSaving > 0 ? 'mérnöki bér × 6,5%' : 'nem választott – a bér a Tao-alapban',
      value: savings.szocho.engineerSaving,
    },
    {
      label: 'Tao – kétszeres levonás',
      formula:
        savings.universityUplift > 0
          ? `(${formatHuf(savings.citDeductibleBase)} + ${formatHuf(savings.universityUplift)} egyetemi többlet) × ${formatPercent(TAX_RATES.CIT, 0)}`
          : `${formatHuf(savings.citDeductibleBase)} × ${formatPercent(TAX_RATES.CIT, 0)}`,
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
          : 'mikro- / kisvállalkozás – mentes',
      value: savings.innovationContributionSaving,
    },
    ...(savings.ipBox.enabled
      ? [
          {
            label: 'IP-box – jogdíj (Tao)',
            formula: `${formatHuf(savings.ipBox.royaltyProfit)} × 50% × nexus ${formatPercent(savings.ipBox.nexusRatio)} × 9%`,
            value: savings.ipBox.royaltyCitSaving,
          },
          ...(savings.ipBox.hipaSaving + savings.ipBox.innovationContributionSaving > 0
            ? [
                {
                  label: 'IP-box – HIPA / innovációs járulék',
                  formula: 'jogdíjbevétel × HIPA-kulcs (+ 0,3%), nexus nélkül',
                  value: savings.ipBox.hipaSaving + savings.ipBox.innovationContributionSaving,
                },
              ]
            : []),
        ]
      : []),
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
          {savings.netAfterCitEffect !== savings.totalAnnualSaving && (
            <tr>
              <td className="pt-1 text-xs text-slate-500" colSpan={2}>
                Tao-hatással korrigált nettó megtakarítás (a kisebb szocho-, HIPA- és járulékköltség 9%-kal növeli a Tao-alapot)
              </td>
              <td className="tabular pt-1 text-right text-xs font-medium text-slate-600">{formatHuf(savings.netAfterCitEffect)}</td>
            </tr>
          )}
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
