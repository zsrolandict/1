/**
 * Printable executive summary (A4). Rendered on screen as a preview and in a
 * print-only container, so "Nyomtatás / PDF" always prints exactly this view.
 */
import type { ActionStep } from '../../domain/actionPlan';
import { COMPANY_SIZE_LABELS, FRASCATI_CRITERIA, INDUSTRY_LABELS, RISK_LABELS } from '../../domain/constants';
import { formatHuf, formatPercent } from '../../domain/format';
import { IP_RULES } from '../../domain/constants';
import type { Assessment, AuditResult, SavingsResult } from '../../domain/types';
import { RiskGauge } from '../charts/RiskGauge';
import { savingsRows } from '../charts/SavingsBreakdown';
import type { SealStatus } from '../../state/useAssessment';
import { ActionPlan } from './ActionPlan';
import { ReportSealLine } from './SealPanel';

interface ExecutiveReportProps {
  assessment: Assessment;
  savings: SavingsResult;
  audit: AuditResult;
  actionPlan: ActionStep[];
  sealStatus: SealStatus;
}

export function ExecutiveReport({ assessment, savings, audit, actionPlan, sealStatus }: ExecutiveReportProps) {
  const { client, params } = assessment;
  const today = new Date().toLocaleDateString('hu-HU', { year: 'numeric', month: 'long', day: 'numeric' });
  const years = params.selfRevisionYears;

  return (
    <article className="report-sheet mx-auto max-w-[210mm] rounded-xl border border-slate-200 bg-white px-12 py-10 text-slate-800 shadow-sm">
      {/* Letterhead */}
      <header className="flex items-end justify-between border-b-2 border-navy-900 pb-4">
        <div>
          <p className="font-serif text-2xl font-bold tracking-wide text-navy-900">ICT Európa</p>
          <p className="text-xs tracking-[0.18em] text-slate-500 uppercase">Üzleti és adótanácsadás</p>
        </div>
        <div className="text-right text-xs text-slate-500">
          <p className="font-semibold tracking-wider text-navy-800 uppercase">Bizalmas</p>
          <p>{today}</p>
        </div>
      </header>

      <section className="mt-6">
        <h1 className="font-serif text-[26px] leading-tight font-bold text-navy-900">
          Vezetői összefoglaló – K+F adókedvezmény-diagnosztika
        </h1>
        <dl className="mt-4 grid grid-cols-2 gap-x-8 gap-y-1.5 text-sm">
          <ReportMeta label="Ügyfél" value={client.companyName || '—'} />
          <ReportMeta label="Adószám" value={client.taxNumber || '—'} />
          <ReportMeta label="Projekt" value={client.projectName || '—'} />
          <ReportMeta label="Iparág" value={INDUSTRY_LABELS[client.industry]} />
          <ReportMeta label="Vizsgált adóév" value={String(client.taxYear)} />
          <ReportMeta label="Kategória" value={COMPANY_SIZE_LABELS[client.companySize]} />
        </dl>
      </section>

      {/* Key figures */}
      <section className="avoid-break mt-8 grid grid-cols-3 gap-4">
        <KeyFigure label="Éves adómegtakarítás" value={formatHuf(savings.totalAnnualSaving)} emphasis />
        <KeyFigure
          label={years > 0 ? `Potenciál (${years + 1} adóév)` : 'Közvetlen K+F költség'}
          value={formatHuf(years > 0 ? savings.multiYearPotential : savings.directRdCost)}
        />
        <KeyFigure label="Hatékony támogatási arány" value={formatPercent(savings.effectiveSubsidyRate)} />
      </section>

      {/* Savings table */}
      <section className="avoid-break mt-8">
        <ReportHeading>1. Megtakarítási potenciál</ReportHeading>
        <table className="tabular w-full text-sm">
          <tbody>
            {savingsRows(savings).map((row) => (
              <tr key={row.key} className="border-b border-slate-100">
                <td className="py-2">{row.label}</td>
                <td className="py-2 font-mono text-[11px] text-slate-500">{row.reference}</td>
                <td className="py-2 text-right font-medium">{formatHuf(row.value)}</td>
              </tr>
            ))}
            <tr className="border-t-2 border-navy-900">
              <td className="pt-2.5 font-semibold text-navy-900" colSpan={2}>
                Összesített tiszta adómegtakarítás / év
              </td>
              <td className="pt-2.5 text-right text-base font-bold text-navy-900">{formatHuf(savings.totalAnnualSaving)}</td>
            </tr>
            {savings.netAfterCitEffect !== savings.totalAnnualSaving && (
              <tr>
                <td className="pt-1 text-xs text-slate-500" colSpan={2}>
                  Tao-hatással korrigált nettó megtakarítás (a kisebb szocho-, HIPA- és járulékköltség növeli a Tao-alapot)
                </td>
                <td className="pt-1 text-right text-xs font-medium text-slate-600">{formatHuf(savings.netAfterCitEffect)}</td>
              </tr>
            )}
          </tbody>
        </table>
        {savings.warnings.length > 0 && (
          <ul className="mt-3 list-disc space-y-0.5 pl-5 text-xs text-slate-500">
            {savings.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        )}
      </section>

      {savings.ipBox.enabled && <ReportIpBox savings={savings} assetName={assessment.ip.assetName} />}

      {/* SZTNH readiness */}
      <section className="avoid-break mt-8">
        <ReportHeading>2. SZTNH minősítési készültség</ReportHeading>
        <div className="grid grid-cols-[180px_1fr] items-start gap-8">
          <RiskGauge score={audit.score} level={audit.level} size="sm" />
          <div>
            <p className="text-sm text-slate-700">
              A Frascati-kézikönyv öt kritériuma alapján a projekt <strong>{audit.score} / 100</strong> pontot ért el (
              {RISK_LABELS[audit.level].title.toLowerCase()} sáv – {RISK_LABELS[audit.level].subtitle.toLowerCase()}).
            </p>
            <table className="tabular mt-3 w-full text-[13px]">
              <tbody>
                {FRASCATI_CRITERIA.map((c) => {
                  const s = audit.criterionScores.find((x) => x.id === c.id);
                  return (
                    <tr key={c.id} className="border-b border-slate-100">
                      <td className="py-1.5">{c.label}</td>
                      <td className="py-1.5 text-right text-slate-500">{s?.rating ?? 0} / 4</td>
                    </tr>
                  );
                })}
                {audit.penalty > 0 && (
                  <tr>
                    <td className="py-1.5 text-risk-red">Kockázati levonás</td>
                    <td className="py-1.5 text-right text-risk-red">−{audit.penalty} pont</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        {(audit.knockOuts.length > 0 || audit.recommendations.length > 0) && (
          <div className="mt-4">
            <p className="mb-1.5 text-sm font-semibold text-navy-900">Szükséges intézkedések</p>
            <ul className="list-disc space-y-1 pl-5 text-[13px] text-slate-700">
              {audit.knockOuts.map((k) => (
                <li key={k} className="text-risk-red">
                  {k}
                </li>
              ))}
              {audit.recommendations.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
        )}
        {assessment.audit.notes.trim() && (
          <p className="mt-4 border-l-2 border-accent pl-3 text-[13px] text-slate-600 italic">{assessment.audit.notes}</p>
        )}
      </section>

      {/* Roadmap */}
      <section className="avoid-break mt-8">
        <ReportHeading>3. Javasolt megvalósítási ütemterv</ReportHeading>
        <ActionPlan steps={actionPlan} />
      </section>

      <footer className="avoid-break mt-10 grid grid-cols-2 gap-8 border-t border-slate-200 pt-6 print:mt-5 print:pt-3 text-xs text-slate-500">
        <p>
          A kalkuláció a megadott adatokon és a hatályos törvényi kulcsokon alapuló előzetes becslés; nem minősül
          adóhatósági állásfoglalásnak. A végleges összegeket az analitikus nyilvántartás és az SZTNH-minősítés
          határozza meg.
        </p>
        <div className="flex flex-col justify-end">
          <div className="border-t border-slate-400 pt-1 text-center">
            {client.advisorName || 'Felelős tanácsadó'} · ICT Európa
          </div>
        </div>
      </footer>
      <div className="avoid-break mt-4">
        <ReportSealLine seal={assessment.seal} status={sealStatus} />
      </div>
    </article>
  );
}

function ReportMeta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="w-28 shrink-0 text-slate-500">{label}</dt>
      <dd className="font-medium text-slate-800">{value}</dd>
    </div>
  );
}

function ReportHeading({ children }: { children: string }) {
  return <h2 className="mb-3 font-serif text-lg font-bold text-navy-900">{children}</h2>;
}

function KeyFigure({ label, value, emphasis = false }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div className={`rounded-lg px-4 py-3 ${emphasis ? 'bg-navy-900 text-white' : 'border border-slate-200 bg-slate-50'}`}>
      <p className={`text-[10px] font-medium tracking-[0.12em] uppercase ${emphasis ? 'text-navy-100/80' : 'text-slate-500'}`}>{label}</p>
      <p className={`tabular mt-1 font-serif text-xl font-bold ${emphasis ? 'text-white' : 'text-navy-900'}`}>{value}</p>
    </div>
  );
}

/** IP-box summary with the notification deadline status. */
function ReportIpBox({ savings, assetName }: { savings: SavingsResult; assetName: string }) {
  const ip = savings.ipBox;
  const { status, dueDate, daysLeft } = ip.deadline;
  const deadlineText = {
    NO_DATE: 'szerzési dátum nincs rögzítve',
    OPEN: `bejelentendő ${dueDate}-ig (még ${daysLeft} nap) – utólag nem pótolható`,
    MISSED: `a ${IP_RULES.NOTIFICATION_DAYS} napos határidő ${dueDate}-én lejárt`,
    REPORTED_ON_TIME: 'határidőben bejelentve',
    REPORTED_LATE: 'késve bejelentve – eladási kedvezmény nem jár',
  }[status];
  const alert = status === 'OPEN' || status === 'MISSED' || status === 'REPORTED_LATE';

  return (
    <section className="avoid-break mt-6 rounded-lg border border-slate-200 px-4 py-3 text-[13px]">
      <p className="mb-1.5 font-semibold text-navy-900">Szellemi termék (IP-box){assetName ? ` – ${assetName}` : ''}</p>
      <div className="grid grid-cols-2 gap-x-6 gap-y-1">
        <span className="text-slate-500">Nexus-arány</span>
        <span className="tabular text-right">{formatPercent(ip.nexusRatio)}</span>
        <span className="text-slate-500">Jogdíjkedvezmény (Tao) / év</span>
        <span className="tabular text-right">{formatHuf(ip.royaltyCitSaving)}</span>
        <span className="text-slate-500">Tényleges Tao a jogdíjnyereségen</span>
        <span className="tabular text-right">{formatPercent(ip.effectiveRoyaltyCitRate, 2)}</span>
        {ip.sale.citSaving > 0 && (
          <>
            <span className="text-slate-500">Egyszeri eladási megtakarítás</span>
            <span className="tabular text-right">{formatHuf(ip.sale.citSaving)}</span>
          </>
        )}
        <span className="text-slate-500">NAV-bejelentés</span>
        <span className={`text-right ${alert ? 'font-semibold text-risk-red' : ''}`}>{deadlineText}</span>
      </div>
    </section>
  );
}
