import { CalendarClock, CircleCheck, CircleX, Copyright, Scale, TriangleAlert } from 'lucide-react';
import { IP_ASSET_LABELS, IP_RULES, LEGAL_REFERENCES, TAX_RATES } from '../../domain/constants';
import { formatHuf, formatPercent } from '../../domain/format';
import type { IpBoxInputs, IpBoxResult } from '../../domain/types';
import { Card, LegalBadge } from '../ui/Card';
import { CurrencyInput, Field, SelectInput, TextInput, Toggle } from '../ui/fields';

interface IpStepProps {
  ip: IpBoxInputs;
  result: IpBoxResult;
  onChange: (patch: Partial<IpBoxInputs>) => void;
}

const dateInputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-navy-600 focus:ring-2 focus:ring-navy-100 focus:outline-none disabled:bg-slate-50';

function DateInput({ label, value, onChange, hint }: { label: string; value: string; onChange: (v: string) => void; hint?: string }) {
  const id = `ip-${label.replace(/\W+/g, '-')}`;
  return (
    <Field label={label} htmlFor={id} hint={hint}>
      <input id={id} type="date" className={dateInputClass} value={value} onChange={(e) => onChange(e.target.value)} />
    </Field>
  );
}

export function IpStep({ ip, result, onChange }: IpStepProps) {
  return (
    <div className="flex flex-col gap-6">
      <Card
        title="Szellemi termék (IP-box)"
        subtitle="Jogdíjbevétel és bejelentett immateriális jószág kedvezményei – jellemzően szoftver- és szabadalomtulajdonos cégeknél"
        icon={Copyright}
      >
        <div className="flex flex-col gap-5">
          <Toggle
            label="A cégnek van jogdíjbevétele vagy értékesítendő szellemi terméke"
            description="Kikapcsolva ez a modul nem szerepel az összesítőben és a riportban."
            checked={ip.enabled}
            onChange={(enabled) => onChange({ enabled })}
          />
          {ip.enabled && (
            <div className="grid gap-5 sm:grid-cols-2">
              <SelectInput label="Szellemi termék típusa" value={ip.assetType} options={IP_ASSET_LABELS} onChange={(assetType) => onChange({ assetType })} />
              <TextInput label="Megnevezés" value={ip.assetName} onChange={(assetName) => onChange({ assetName })} placeholder="pl. Gyártásütemező szoftver" />
            </div>
          )}
        </div>
      </Card>

      {ip.enabled && (
        <>
          <DeadlineCard ip={ip} result={result} onChange={onChange} />

          <Card
            title="Jogdíjbevétel"
            subtitle={`50% levonható, legfeljebb az adózás előtti eredmény 50%-áig – teljes nexusnál kb. ${formatPercent(
              TAX_RATES.CIT * (1 - IP_RULES.ROYALTY_DEDUCTION_SHARE),
            )} tényleges Tao`}
            icon={Scale}
            aside={<LegalBadge>{LEGAL_REFERENCES.IP_ROYALTY}</LegalBadge>}
          >
            <div className="grid gap-6 sm:grid-cols-2">
              <CurrencyInput label="Éves jogdíjbevétel" value={ip.royaltyIncome} onChange={(royaltyIncome) => onChange({ royaltyIncome })} sliderMax={500_000_000} />
              <CurrencyInput
                label="A jogdíjhoz kapcsolódó ráfordítás"
                value={ip.royaltyRelatedCosts}
                onChange={(royaltyRelatedCosts) => onChange({ royaltyRelatedCosts })}
                hint="Jogdíjból származó nyereség = bevétel − ráfordítás"
              />
            </div>
          </Card>

          <Card
            title="Nexus-arány"
            subtitle="Csak olyan arányban jár kedvezmény, amilyen arányban a cég maga fejlesztette a szellemi terméket"
            icon={Scale}
            aside={
              <span className="rounded-md bg-navy-50 px-2.5 py-1 text-sm font-semibold text-navy-900 tabular">
                {formatPercent(result.nexusRatio)}
              </span>
            }
          >
            <div className="grid gap-6 sm:grid-cols-3">
              <CurrencyInput
                label="Saját fejlesztési költség"
                value={ip.nexusOwnCosts}
                onChange={(nexusOwnCosts) => onChange({ nexusOwnCosts })}
                hint="Független alvállalkozóval együtt"
              />
              <CurrencyInput
                label="Kapcsolt vállalkozástól vett K+F"
                value={ip.nexusRelatedPartyCosts}
                onChange={(nexusRelatedPartyCosts) => onChange({ nexusRelatedPartyCosts })}
              />
              <CurrencyInput
                label="Megvásárolt szellemi termék"
                value={ip.nexusAcquisitionCosts}
                onChange={(nexusAcquisitionCosts) => onChange({ nexusAcquisitionCosts })}
              />
            </div>
            <p className="mt-4 font-mono text-xs text-slate-500">
              nexus = min(1; saját × {IP_RULES.NEXUS_UPLIFT.toLocaleString('hu-HU')} / (saját + kapcsolt + vásárolt)) — a{' '}
              {IP_RULES.NEXUS_UPLIFT.toLocaleString('hu-HU')}-es szorzó az OECD-módszer szerinti, magyar alkalmazása ellenőrizendő
            </p>
          </Card>

          <Card
            title="Értékesítés"
            subtitle={`Bejelentett immateriális jószág eladási nyeresége adóalap-csökkentő, ha ${IP_RULES.MIN_HOLDING_YEARS} évig a cégnél volt`}
            icon={Scale}
            aside={<LegalBadge>{LEGAL_REFERENCES.IP_SALE}</LegalBadge>}
          >
            <div className="grid gap-6 sm:grid-cols-2">
              <CurrencyInput
                label="Várható eladási nyereség"
                value={ip.plannedSaleGain}
                onChange={(plannedSaleGain) => onChange({ plannedSaleGain })}
              />
              <DateInput label="Tervezett eladás napja" value={ip.plannedSaleDate} onChange={(plannedSaleDate) => onChange({ plannedSaleDate })} />
            </div>
            {ip.plannedSaleGain > 0 && (
              <div
                className={`mt-4 rounded-lg px-4 py-3 text-sm ${
                  result.sale.eligible ? 'bg-risk-green-soft text-risk-green' : 'bg-risk-red-soft text-risk-red'
                }`}
              >
                <p className="font-semibold">
                  {result.sale.eligible
                    ? `Érvényesíthető: ${formatHuf(result.sale.deduction)} levonás → ${formatHuf(result.sale.citSaving)} egyszeri Tao-megtakarítás`
                    : 'A kedvezmény jelenleg nem érvényesíthető'}
                </p>
                {result.sale.reasons.length > 0 && (
                  <ul className="mt-1 list-disc pl-5 text-slate-700">
                    {result.sale.reasons.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </Card>

          <Card title="HIPA és innovációs járulék" subtitle="A jogdíjbevétel helyi adós kezelése – az adócsapat megerősítéséig 0%" icon={TriangleAlert}>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between">
                <label htmlFor="ip-hipa-share" className="text-[13px] font-medium text-slate-700">
                  A jogdíjbevétel HIPA-alapot csökkentő hányada
                </label>
                <span className="tabular text-sm font-semibold text-navy-900">{formatPercent(ip.hipaRoyaltyReliefShare, 0)}</span>
              </div>
              <input
                id="ip-hipa-share"
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={ip.hipaRoyaltyReliefShare}
                onChange={(e) => onChange({ hipaRoyaltyReliefShare: Number(e.target.value) })}
              />
              <p className="text-xs text-slate-500">
                A Htv. jogdíjra vonatkozó szabályát nem sikerült forrásból megerősíteni. Csak az adócsapat jóváhagyásával állítsa át.
                {result.hipaSaving > 0 && ` Jelenlegi hatás: ${formatHuf(result.hipaSaving + result.innovationContributionSaving)}.`}
              </p>
            </div>
          </Card>

          <Card title="IP-box összesítés">
            <dl className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
              <Row label="Jogdíjból származó nyereség" value={formatHuf(result.royaltyProfit)} />
              <Row label="Tao-levonás" value={formatHuf(result.royaltyDeduction)} />
              <Row label="Tao-megtakarítás / év" value={formatHuf(result.royaltyCitSaving)} strong />
              <Row label="Tényleges Tao a jogdíjnyereségen" value={formatPercent(result.effectiveRoyaltyCitRate, 2)} />
              <Row label="HIPA + innovációs járulék / év" value={formatHuf(result.hipaSaving + result.innovationContributionSaving)} />
              <Row label="Egyszeri eladási megtakarítás" value={formatHuf(result.sale.citSaving)} />
            </dl>
          </Card>
        </>
      )}
    </div>
  );
}

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-4 border-b border-slate-100 py-1.5">
      <dt className="text-slate-500">{label}</dt>
      <dd className={`tabular ${strong ? 'font-bold text-navy-900' : 'font-medium text-slate-800'}`}>{value}</dd>
    </div>
  );
}

/** The 60-day notification is the single most expensive thing to miss. */
function DeadlineCard({ ip, result, onChange }: IpStepProps) {
  const { status, dueDate, daysLeft } = result.deadline;
  const tone = {
    NO_DATE: { cls: 'border-slate-200 bg-white', icon: CalendarClock, text: 'Adja meg a szerzés / létrehozás napját a határidő számításához.' },
    OPEN: {
      cls: daysLeft <= 14 ? 'border-risk-red/40 bg-risk-red-soft' : 'border-risk-yellow/40 bg-risk-yellow-soft',
      icon: CalendarClock,
      text: `Bejelentési határidő: ${dueDate} – még ${daysLeft} nap. Utólag nem pótolható!`,
    },
    MISSED: { cls: 'border-risk-red/40 bg-risk-red-soft', icon: CircleX, text: `A határidő ${dueDate}-én lejárt. Az eladási nyereség kedvezménye erre a jószágra elveszett.` },
    REPORTED_ON_TIME: { cls: 'border-risk-green/30 bg-risk-green-soft', icon: CircleCheck, text: `Határidőben bejelentve (határidő: ${dueDate}).` },
    REPORTED_LATE: { cls: 'border-risk-red/40 bg-risk-red-soft', icon: CircleX, text: `Késve bejelentve (határidő: ${dueDate} volt) – az eladási kedvezmény nem jár.` },
  }[status];
  const Icon = tone.icon;

  return (
    <section className={`rounded-xl border px-6 py-5 ${tone.cls}`}>
      <div className="mb-4 flex items-start gap-3">
        <Icon className="mt-0.5 size-5 shrink-0 text-navy-900" aria-hidden />
        <div>
          <h2 className="text-[15px] font-semibold text-navy-900">
            NAV-bejelentés – {IP_RULES.NOTIFICATION_DAYS} napos határidő
          </h2>
          <p className="text-sm text-slate-700">{tone.text}</p>
        </div>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <DateInput
          label="Szerzés / létrehozás (aktiválás) napja"
          value={ip.acquiredOn}
          onChange={(acquiredOn) => onChange({ acquiredOn })}
        />
        <DateInput
          label="NAV-bejelentés napja"
          value={ip.reportedOn}
          onChange={(reportedOn) => onChange({ reportedOn })}
          hint="Üresen hagyva: még nincs bejelentve"
        />
      </div>
    </section>
  );
}
