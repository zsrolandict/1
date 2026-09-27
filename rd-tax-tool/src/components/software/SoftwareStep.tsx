/**
 * Software IP-box step: the asset's development history (original +
 * enhancements, each with its own 75-day NAV notification), cumulative
 * nexus, yearly royalty income and a planned sale.
 */
import { Code, GitBranchPlus, Plus, ReceiptText, Scale, Trash2, TriangleAlert } from 'lucide-react';
import { IP_RULES, LEGAL_REFERENCES, REVENUE_MODEL_LABELS, TAX_RATES } from '../../domain/constants';
import { newComponent } from '../../domain/defaults';
import { formatHuf, formatPercent } from '../../domain/format';
import type { Exposure } from '../../domain/exposure';
import type { RoyaltyYear, SoftwareAssetInputs, SoftwareComponent, SoftwareResult } from '../../domain/types';
import { Button } from '../ui/Button';
import { Card, LegalBadge } from '../ui/Card';
import { CurrencyInput, Segmented, TextInput, Toggle } from '../ui/fields';
import { ExposureCard } from './ExposureCard';
import { DateField, DeadlineBadge, MoneyCell, QualificationBanner } from './shared';

interface SoftwareStepProps {
  sw: SoftwareAssetInputs;
  result: SoftwareResult;
  exposure?: Exposure;
  taxYear: number;
  profitBeforeTax: number;
  onChange: (patch: Partial<SoftwareAssetInputs>) => void;
}

export function SoftwareStep({ sw, result, exposure, taxYear, profitBeforeTax, onChange }: SoftwareStepProps) {
  const updateComponent = (id: string, patch: Partial<SoftwareComponent>) =>
    onChange({ components: sw.components.map((c) => (c.id === id ? { ...c, ...patch } : c)) });
  const removeComponent = (id: string) => onChange({ components: sw.components.filter((c) => c.id !== id) });
  const addEnhancement = () =>
    onChange({ components: [...sw.components, { ...newComponent('ENHANCEMENT'), name: `Továbbfejlesztés ${sw.components.length}` }] });

  return (
    <div className="flex flex-col gap-6">
      <Card title="Szoftver (IP-box)" subtitle="A szoftver teljes életútja: fejlesztés, bejelentés, jogdíj, eladás" icon={Code}>
        <div className="flex flex-col gap-5">
          <Toggle
            label="A cégnek van saját fejlesztésű, hasznosított szoftvere"
            description="Kikapcsolva ez a modul nem szerepel az összesítőben és a riportban."
            checked={sw.enabled}
            onChange={(enabled) => onChange({ enabled })}
          />
          {sw.enabled && (
            <>
              <TextInput label="Szoftver megnevezése" value={sw.name} onChange={(name) => onChange({ name })} placeholder="pl. Gyártásütemező platform" />
              <Segmented
                label="Bevételi modell"
                value={sw.revenueModel}
                onChange={(revenueModel) => onChange({ revenueModel })}
                options={(Object.keys(REVENUE_MODEL_LABELS) as SoftwareAssetInputs['revenueModel'][]).map((value) => ({
                  value,
                  label: REVENUE_MODEL_LABELS[value],
                }))}
              />
              {sw.revenueModel !== 'LICENSE' && (
                <div className={`rounded-lg border px-4 py-3 ${result.royaltyQualifies ? 'border-slate-200' : 'border-risk-red/40 bg-risk-red-soft'}`}>
                  <Toggle
                    label="A SaaS-bevétel tartalmaz tiszta szerzői jogi licencdíjat az ÁSZF / szerződések szerint?"
                    description="Igen, ha a szerződés licencet ad (letölthető kliens, SDK vagy dedikált tenant), és a számla elkülöníti a licencdíjat a tárhely-, üzemeltetési és SLA-díjtól."
                    checked={sw.saasLicenceSeparated}
                    onChange={(saasLicenceSeparated) => onChange({ saasLicenceSeparated })}
                  />
                  {!result.royaltyQualifies && (
                    <p className="mt-2 text-sm text-risk-red">
                      Nem: a SaaS-bevétel szolgáltatás, nem jogdíj. Jogdíjkedvezményt nem számolunk, csak a K+F-költségkedvezmények érvényesek.
                    </p>
                  )}
                  {sw.revenueModel === 'MIXED' && result.royaltyQualifies && (
                    <p className="mt-2 text-xs text-slate-600">Vegyes modellnél a jogdíjsorokba csak az elkülönített licencdíj-részt írja.</p>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </Card>

      {sw.enabled && (
        <>
          <QualificationBanner qualification={result.qualification} />
          {exposure && <ExposureCard exposure={exposure} />}

          <Card
            title="Fejlesztés és NAV-bejelentések"
            subtitle={`Az eredeti fejlesztést és minden aktivált továbbfejlesztést külön, ${IP_RULES.NOTIFICATION_DAYS} napon belül kell bejelenteni – jogvesztő határidő`}
            icon={GitBranchPlus}
            aside={<LegalBadge>{LEGAL_REFERENCES.IP_NOTIFY}</LegalBadge>}
          >
            <div className="flex flex-col gap-4">
              {sw.components.map((c) => {
                const r = result.components.find((x) => x.id === c.id);
                return (
                  <div key={c.id} className="rounded-lg border border-slate-200 p-4">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase ${
                            c.kind === 'ORIGINAL' ? 'bg-navy-800 text-white' : 'bg-navy-100 text-navy-800'
                          }`}
                        >
                          {c.kind === 'ORIGINAL' ? 'Eredeti' : 'Továbbfejlesztés'}
                        </span>
                        {r && <DeadlineBadge deadline={r.deadline} />}
                      </div>
                      {c.kind === 'ENHANCEMENT' && (
                        <Button variant="ghost" icon={Trash2} onClick={() => removeComponent(c.id)} aria-label={`${c.name} törlése`}>
                          Törlés
                        </Button>
                      )}
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      <div className="sm:col-span-2 lg:col-span-1">
                        <TextInput label="Megnevezés / verzió" value={c.name} onChange={(name) => updateComponent(c.id, { name })} />
                      </div>
                      <DateField
                        id={`cap-${c.id}`}
                        label="Aktiválás / befejezés napja"
                        value={c.capitalizedOn}
                        onChange={(capitalizedOn) => updateComponent(c.id, { capitalizedOn })}
                      />
                      <DateField
                        id={`rep-${c.id}`}
                        label="NAV-bejelentés napja"
                        value={c.reportedOn}
                        onChange={(reportedOn) => updateComponent(c.id, { reportedOn })}
                        hint="Üres: még nincs bejelentve"
                      />
                      <CurrencyInput
                        label={c.kind === 'ORIGINAL' ? 'Bekerülési érték' : 'Értéknövekmény'}
                        value={c.capitalizedValue}
                        onChange={(capitalizedValue) => updateComponent(c.id, { capitalizedValue })}
                      />
                    </div>
                    <div className="mt-4 grid gap-4 border-t border-slate-100 pt-4 sm:grid-cols-3">
                      <CurrencyInput
                        label="Saját fejlesztési költség"
                        value={c.ownCosts}
                        onChange={(ownCosts) => updateComponent(c.id, { ownCosts })}
                        hint="Független alvállalkozóval együtt"
                      />
                      <CurrencyInput
                        label="Kapcsolttól vett fejlesztés"
                        value={c.relatedPartyCosts}
                        onChange={(relatedPartyCosts) => updateComponent(c.id, { relatedPartyCosts })}
                      />
                      <CurrencyInput
                        label="Megvásárolt komponens / kód"
                        value={c.acquisitionCosts}
                        onChange={(acquisitionCosts) => updateComponent(c.id, { acquisitionCosts })}
                      />
                    </div>
                  </div>
                );
              })}
              <div>
                <Button icon={Plus} onClick={addEnhancement}>
                  Továbbfejlesztés hozzáadása
                </Button>
              </div>
            </div>
          </Card>

          <RoyaltyYearsCard sw={sw} result={result} taxYear={taxYear} profitBeforeTax={profitBeforeTax} onChange={onChange} />

          <Card title="HIPA és innovációs járulék" icon={Scale} aside={<LegalBadge>{LEGAL_REFERENCES.IP_HIPA}</LegalBadge>}>
            <Toggle
              label="A jogdíjbevétel levonható a HIPA-alapból (100%, nexus nélkül)"
              description="A Htv. nem vette át a nexus-formulát: a Htv. szerinti jogdíjfogalomnak megfelelő bevétel teljes összege levonható. Az innovációs járulék alapja ugyanez."
              checked={sw.hipaRoyaltyDeduction}
              onChange={(hipaRoyaltyDeduction) => onChange({ hipaRoyaltyDeduction })}
            />
          </Card>

          <SaleCard sw={sw} result={result} onChange={onChange} />
        </>
      )}
    </div>
  );
}

/** Yearly royalty income with the per-year result next to each row. */
function RoyaltyYearsCard({ sw, result, taxYear, profitBeforeTax, onChange }: SoftwareStepProps) {
  const update = (year: number, patch: Partial<RoyaltyYear>) =>
    onChange({ royaltyYears: sw.royaltyYears.map((y) => (y.year === year ? { ...y, ...patch } : y)) });
  const remove = (year: number) => onChange({ royaltyYears: sw.royaltyYears.filter((y) => y.year !== year) });
  const add = () => {
    const years = sw.royaltyYears.map((y) => y.year);
    const year = years.length === 0 ? taxYear : Math.max(...years) + 1;
    onChange({
      royaltyYears: [...sw.royaltyYears, { year, royaltyIncome: 0, relatedCosts: 0, profitBeforeTax: year === taxYear ? profitBeforeTax : 0 }],
    });
  };
  const rows = [...sw.royaltyYears].sort((a, b) => a.year - b.year);

  return (
    <Card
      title="Jogdíjbevétel évente"
      subtitle={`Tao: a jogdíjnyereség 50%-a × kumulatív nexus, legfeljebb az adózás előtti eredmény 50%-a – teljes nexusnál ${formatPercent(
        TAX_RATES.CIT * (1 - IP_RULES.ROYALTY_DEDUCTION_SHARE),
      )} tényleges Tao`}
      icon={ReceiptText}
      aside={<LegalBadge>{LEGAL_REFERENCES.IP_ROYALTY}</LegalBadge>}
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs tracking-wide text-slate-500 uppercase">
              <th className="py-2 pr-2 font-medium">Év</th>
              <th className="py-2 pr-2 font-medium">Jogdíjbevétel</th>
              <th className="py-2 pr-2 font-medium">Kapcsolódó ráfordítás</th>
              <th className="py-2 pr-2 font-medium">Adózás előtti eredmény</th>
              <th className="py-2 pr-2 text-right font-medium">Nexus</th>
              <th className="py-2 pr-2 text-right font-medium">Megtakarítás</th>
              <th className="py-2" />
            </tr>
          </thead>
          <tbody className="tabular">
            {rows.map((y) => {
              const r = result.years.find((x) => x.year === y.year);
              return (
                <tr key={y.year} className={`border-b border-slate-100 ${y.year === taxYear ? 'bg-navy-50/60' : ''}`}>
                  <td className="py-2 pr-2 font-medium text-navy-900">
                    {y.year}
                    {y.year === taxYear && <span className="ml-1 text-[10px] text-slate-500 uppercase">vizsgált</span>}
                  </td>
                  <td className="py-2 pr-2">
                    <MoneyCell label={`${y.year} jogdíjbevétel`} value={y.royaltyIncome} onChange={(royaltyIncome) => update(y.year, { royaltyIncome })} />
                  </td>
                  <td className="py-2 pr-2">
                    <MoneyCell label={`${y.year} ráfordítás`} value={y.relatedCosts} onChange={(relatedCosts) => update(y.year, { relatedCosts })} />
                  </td>
                  <td className="py-2 pr-2">
                    <MoneyCell
                      label={`${y.year} adózás előtti eredmény`}
                      value={y.profitBeforeTax}
                      onChange={(profitBeforeTax) => update(y.year, { profitBeforeTax })}
                    />
                  </td>
                  <td className="py-2 pr-2 text-right text-slate-600">{r ? formatPercent(r.nexusRatio) : '–'}</td>
                  <td className="py-2 pr-2 text-right font-semibold text-navy-900" title={r ? `Tao ${formatHuf(r.citSaving)} + HIPA/járulék ${formatHuf(r.hipaSaving + r.innovationContributionSaving)}` : ''}>
                    {r ? formatHuf(r.total) : '–'}
                  </td>
                  <td className="py-2 text-right">
                    <button
                      type="button"
                      onClick={() => remove(y.year)}
                      className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-risk-red"
                      aria-label={`${y.year} sor törlése`}
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr>
                <td className="pt-3 font-semibold text-navy-900" colSpan={5}>
                  Összesen ({rows.length} év)
                </td>
                <td className="tabular pt-3 pr-2 text-right font-bold text-navy-900">
                  {formatHuf(result.years.reduce((sum, y) => sum + y.total, 0))}
                </td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <Button icon={Plus} onClick={add}>
          Év hozzáadása
        </Button>
        <p className="text-xs text-slate-500">
          A nexus az adott év végéig aktivált összes fejlesztésből számol (kumulatív), így a korábbi saját fejlesztés a későbbi évek kedvezményét is védi.
        </p>
      </div>
    </Card>
  );
}

function SaleCard({ sw, result, onChange }: Pick<SoftwareStepProps, 'sw' | 'result' | 'onChange'>) {
  const s = result.sale;
  return (
    <Card
      title="Értékesítés (exit)"
      subtitle={`Mentes, ha az eredeti fejlesztést határidőben bejelentették, és az eredeti szerzés óta eltelt ${IP_RULES.MIN_HOLDING_YEARS} év (továbbfejlesztés nem indítja újra)`}
      icon={Scale}
      aside={<LegalBadge>{LEGAL_REFERENCES.IP_SALE}</LegalBadge>}
    >
      <div className="grid gap-5 sm:grid-cols-3">
        <DateField id="sale-date" label="Tervezett eladás napja" value={sw.saleDate} onChange={(saleDate) => onChange({ saleDate })} />
        <CurrencyInput label="Eladási ár" value={sw.salePrice} onChange={(salePrice) => onChange({ salePrice })} />
        <CurrencyInput
          label="Könyv szerinti érték"
          value={sw.saleBookValue}
          onChange={(saleBookValue) => onChange({ saleBookValue })}
          hint="Bekerülési érték − értékcsökkenés"
        />
      </div>
      <div className="mt-4">
        <Toggle
          label="Nexus-arány alkalmazása az eladási nyereségre"
          description="Konzervatív alapbeállítás; kikapcsolva a bejelentett részre jutó teljes nyereség mentes."
          checked={sw.applyNexusToSaleGain}
          onChange={(applyNexusToSaleGain) => onChange({ applyNexusToSaleGain })}
        />
      </div>
      {s.gain > 0 && (
        <div
          className={`mt-4 rounded-lg px-4 py-3 text-sm ${
            !s.eligible ? 'bg-risk-red-soft' : s.exemptShare < 1 ? 'bg-risk-yellow-soft' : 'bg-risk-green-soft'
          }`}
        >
          <dl className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
            <Row label="Árfolyamnyereség" value={formatHuf(s.gain)} />
            <Row label="Bejelentett rész aránya" value={formatPercent(s.exemptShare)} />
            <Row label="Adóalap-csökkentés" value={formatHuf(s.deduction)} />
            <Row label="Adóköteles rész" value={formatHuf(s.taxablePart)} />
            <Row label="Egyszeri Tao-megtakarítás" value={formatHuf(s.citSaving)} strong />
          </dl>
          {s.reasons.length > 0 && (
            <ul className="mt-2 space-y-1 text-slate-700">
              {s.reasons.map((r) => (
                <li key={r} className="flex gap-2">
                  <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-risk-yellow" aria-hidden />
                  {r}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Card>
  );
}

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-slate-600">{label}</dt>
      <dd className={`tabular ${strong ? 'font-bold text-navy-900' : 'font-medium text-slate-800'}`}>{value}</dd>
    </div>
  );
}
