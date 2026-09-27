/**
 * Standalone software royalty calculator (demo mode): one tax year, annual
 * royalty income less what can be deducted, and the resulting savings.
 * Uses the same engine and data as the full assessment.
 */
import { Code } from 'lucide-react';
import { COMPANY_SIZE_OPTIONS, IP_RULES, REVENUE_MODEL_LABELS, TAX_RATES } from '../../domain/constants';
import { formatHuf, formatPercent } from '../../domain/format';
import type { ClientProfile, RoyaltyYear, SoftwareAssetInputs, SoftwareResult, TaxParameters } from '../../domain/types';
import { Card } from '../ui/Card';
import { CurrencyInput, Segmented, Toggle } from '../ui/fields';

interface RoyaltyCalculatorProps {
  client: ClientProfile;
  params: TaxParameters;
  sw: SoftwareAssetInputs;
  result: SoftwareResult;
  onClient: (patch: Partial<ClientProfile>) => void;
  onParams: (patch: Partial<TaxParameters>) => void;
  onSoftware: (patch: Partial<SoftwareAssetInputs>) => void;
}

export function RoyaltyCalculator({ client, params, sw, result, onClient, onParams, onSoftware }: RoyaltyCalculatorProps) {
  const year = client.taxYear;
  const row: RoyaltyYear = sw.royaltyYears.find((y) => y.year === year) ?? {
    year,
    royaltyIncome: 0,
    relatedCosts: 0,
    profitBeforeTax: client.profitBeforeTax,
  };
  const setRow = (patch: Partial<RoyaltyYear>) => {
    const next = { ...row, ...patch };
    const others = sw.royaltyYears.filter((y) => y.year !== year);
    onSoftware({ enabled: true, royaltyYears: [...others, next] });
    if (patch.profitBeforeTax !== undefined) onClient({ profitBeforeTax: patch.profitBeforeTax });
  };

  // The quick view edits the nexus inputs of the original component only.
  const single = sw.components.length === 1 ? sw.components[0] : undefined;
  const setNexus = (patch: Partial<Pick<NonNullable<typeof single>, 'ownCosts' | 'relatedPartyCosts' | 'acquisitionCosts'>>) => {
    if (!single) return;
    onSoftware({ enabled: true, components: [{ ...single, ...patch }] });
  };

  const profit = result.royaltyProfit;
  const taxWithout = profit * TAX_RATES.CIT;
  const taxWith = taxWithout - result.royaltyCitSaving;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="flex min-w-0 flex-col gap-6">
        <Card
          title="Szoftverjogdíj-kalkulátor"
          subtitle={`${year}. adóév · éves jogdíjbevétel, csökkentve a levonható tételekkel`}
          icon={Code}
        >
          <div className="flex flex-col gap-5">
            <Segmented
              label="Bevételi modell"
              value={sw.revenueModel}
              onChange={(revenueModel) => onSoftware({ enabled: true, revenueModel })}
              options={(Object.keys(REVENUE_MODEL_LABELS) as SoftwareAssetInputs['revenueModel'][]).map((value) => ({
                value,
                label: REVENUE_MODEL_LABELS[value],
              }))}
            />
            {sw.revenueModel !== 'LICENSE' && (
              <Toggle
                label="Elkülönített szerzői jogi licencdíj az ÁSZF-ben és a számlán?"
                description="Enélkül a SaaS-bevétel szolgáltatás, és nem jár jogdíjkedvezmény."
                checked={sw.saasLicenceSeparated}
                onChange={(saasLicenceSeparated) => onSoftware({ saasLicenceSeparated })}
              />
            )}
            <div className="grid gap-5 sm:grid-cols-2">
              <CurrencyInput label="Éves jogdíjbevétel" value={row.royaltyIncome} onChange={(royaltyIncome) => setRow({ royaltyIncome })} sliderMax={1_000_000_000} sliderStep={5_000_000} />
              <CurrencyInput
                label="Levonható, kapcsolódó ráfordítás"
                value={row.relatedCosts}
                onChange={(relatedCosts) => setRow({ relatedCosts })}
                hint="Jogdíjnyereség = bevétel − ráfordítás"
              />
              <CurrencyInput
                label="Adózás előtti eredmény"
                value={row.profitBeforeTax}
                onChange={(profitBeforeTax) => setRow({ profitBeforeTax })}
                allowNegative
                hint="A levonás legfeljebb ennek 50%-a"
              />
              <CurrencyInput
                label="Éves nettó árbevétel"
                value={client.annualRevenue}
                onChange={(annualRevenue) => onClient({ annualRevenue })}
                hint="A HIPA-levonás felső korlátja"
              />
            </div>
          </div>
        </Card>

        <Card title="Nexus-arány" subtitle="Mennyit fejlesztett a cég saját maga?" aside={<span className="rounded-md bg-navy-50 px-2.5 py-1 text-sm font-semibold text-navy-900 tabular">{formatPercent(result.nexusRatio)}</span>}>
          {single ? (
            <div className="grid gap-5 sm:grid-cols-3">
              <CurrencyInput label="Saját fejlesztés" value={single.ownCosts} onChange={(ownCosts) => setNexus({ ownCosts })} />
              <CurrencyInput label="Kapcsolttól vett" value={single.relatedPartyCosts} onChange={(relatedPartyCosts) => setNexus({ relatedPartyCosts })} />
              <CurrencyInput label="Megvásárolt" value={single.acquisitionCosts} onChange={(acquisitionCosts) => setNexus({ acquisitionCosts })} />
            </div>
          ) : (
            <p className="text-sm text-slate-600">
              A szoftvernek {sw.components.length} fejlesztési eleme van; a kumulatív nexust a teljes átvilágítás „Szoftver” lépésében lehet szerkeszteni.
            </p>
          )}
          <p className="mt-3 font-mono text-xs text-slate-500">
            nexus = min(1; saját × {IP_RULES.NEXUS_UPLIFT.toLocaleString('hu-HU')} / (saját + kapcsolt + vásárolt))
          </p>
        </Card>

        <Card title="Helyi paraméterek">
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between">
                <label htmlFor="rc-hipa" className="text-[13px] font-medium text-slate-700">
                  HIPA-kulcs
                </label>
                <span className="tabular text-sm font-semibold text-navy-900">{formatPercent(params.hipaRate)}</span>
              </div>
              <input
                id="rc-hipa"
                type="range"
                min={0}
                max={TAX_RATES.HIPA_MAX}
                step={0.001}
                value={params.hipaRate}
                onChange={(e) => onParams({ hipaRate: Number(e.target.value) })}
              />
            </div>
            <Toggle
              label="Jogdíj levonása a HIPA-alapból (100%)"
              checked={sw.hipaRoyaltyDeduction}
              onChange={(hipaRoyaltyDeduction) => onSoftware({ hipaRoyaltyDeduction })}
            />
          </div>
          <div className="mt-5">
            <Segmented
              label="Vállalkozási méret (innovációs járulék)"
              value={client.companySize}
              onChange={(companySize) => onClient({ companySize })}
              options={COMPANY_SIZE_OPTIONS.map(({ value, label }) => ({ value, label }))}
            />
          </div>
        </Card>
      </div>

      <aside className="flex flex-col gap-4 lg:sticky lg:top-6 lg:self-start">
        <div className="overflow-hidden rounded-xl bg-navy-900 text-white shadow-lg shadow-navy-900/20">
          <div className="px-6 pt-5 pb-4">
            <p className="text-[11px] font-medium tracking-[0.14em] text-navy-100/70 uppercase">Jogdíj-megtakarítás / év</p>
            <p className="tabular mt-2 font-serif text-3xl font-bold" aria-live="polite">
              {formatHuf(result.annualSaving)}
            </p>
            <p className="mt-1 text-xs text-navy-100/70">
              Tényleges Tao a jogdíjnyereségen: <span className="text-white">{formatPercent(result.effectiveRoyaltyCitRate, 2)}</span>
            </p>
          </div>
          <dl className="grid gap-2 border-t border-white/10 bg-white px-6 py-4 text-sm text-slate-800">
            <Line label="Jogdíjnyereség" value={formatHuf(profit)} />
            <Line label="Tao-levonás (50% × nexus)" value={formatHuf(result.royaltyDeduction)} />
            <Line label="Tao kedvezmény nélkül" value={formatHuf(taxWithout)} muted />
            <Line label="Tao kedvezménnyel" value={formatHuf(taxWith)} />
            <Line label="Tao-megtakarítás" value={formatHuf(result.royaltyCitSaving)} strong />
            <Line label="HIPA-megtakarítás" value={formatHuf(result.hipaSaving)} strong />
            <Line label="Innovációs járulék" value={formatHuf(result.innovationContributionSaving)} strong />
          </dl>
        </div>
        {result.warnings.length > 0 && (
          <ul className="rounded-xl border border-risk-yellow/30 bg-risk-yellow-soft px-5 py-3 text-xs text-slate-700">
            {result.warnings.map((w) => (
              <li key={w} className="py-0.5">
                {w}
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-slate-500">
          Demó-kalkulátor: a bejelentési határidőket, továbbfejlesztéseket és az eladást a teljes átvilágítás „Szoftver” lépése kezeli.
        </p>
      </aside>
    </div>
  );
}

function Line({ label, value, strong = false, muted = false }: { label: string; value: string; strong?: boolean; muted?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className={muted ? 'text-slate-400' : 'text-slate-600'}>{label}</dt>
      <dd className={`tabular ${strong ? 'font-bold text-navy-900' : muted ? 'text-slate-400 line-through' : 'font-medium'}`}>{value}</dd>
    </div>
  );
}
