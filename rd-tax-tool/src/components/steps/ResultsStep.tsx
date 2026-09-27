import { ChartColumn, FileSpreadsheet, Eye, EyeOff, Gauge, ListChecks, Printer, Route } from 'lucide-react';
import { useState } from 'react';
import type { ActionStep } from '../../domain/actionPlan';
import { formatHuf, formatPercent } from '../../domain/format';
import type { Assessment, AuditResult, SavingsResult, TaxParameters } from '../../domain/types';
import { CriteriaBars } from '../charts/CriteriaBars';
import { RiskGauge } from '../charts/RiskGauge';
import { SavingsBreakdown } from '../charts/SavingsBreakdown';
import { ActionPlan } from '../report/ActionPlan';
import { ExecutiveReport } from '../report/ExecutiveReport';
import { SealPanel } from '../report/SealPanel';
import { ScenarioCard } from '../report/ScenarioCard';
import { ExposureCard } from '../software/ExposureCard';
import type { Exposure } from '../../domain/exposure';
import type { SealStatus } from '../../state/useAssessment';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { DerivationTable, Warnings } from './CostStep';

interface ResultsStepProps {
  assessment: Assessment;
  savings: SavingsResult;
  exposure: Exposure;
  audit: AuditResult;
  actionPlan: ActionStep[];
  missingClientData: boolean;
  sealStatus: SealStatus;
  onParamsChange: (patch: Partial<TaxParameters>) => void;
  onSeal: (sealedBy: string) => Promise<void>;
  onReopen: () => void;
  onApplyVariant: (variant: Assessment) => void;
}

export function ResultsStep({
  assessment,
  savings,
  exposure,
  audit,
  actionPlan,
  missingClientData,
  sealStatus,
  onParamsChange,
  onSeal,
  onReopen,
  onApplyVariant,
}: ResultsStepProps) {
  const [preview, setPreview] = useState(false);
  const [exporting, setExporting] = useState(false);

  /** Builds the workbook and hands it to the browser; the xlsx writer is loaded on demand. */
  const downloadExcel = async () => {
    setExporting(true);
    try {
      const [{ default: writeExcelFile }, { buildWorkbook, workbookFileName }, { compareScenarios }] = await Promise.all([
        import('write-excel-file/browser'),
        import('../../domain/workbook'),
        import('../../domain/scenarios'),
      ]);
      const sheets = buildWorkbook({ assessment, savings, audit, exposure, scenarios: compareScenarios(assessment).rows });
      await writeExcelFile(sheets).toFile(workbookFileName(assessment));
    } catch {
      window.alert('Az Excel-fájl elkészítése nem sikerült.');
    } finally {
      setExporting(false);
    }
  };
  const years = assessment.params.selfRevisionYears;

  return (
    <div className="flex flex-col gap-6">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl font-bold text-navy-900">Eredménytábla</h1>
          <p className="text-sm text-slate-500">
            {assessment.client.companyName || 'Névtelen ügyfél'} · {assessment.client.taxYear}. adóév
          </p>
        </div>
        <div className="flex gap-2">
          <Button icon={preview ? EyeOff : Eye} onClick={() => setPreview((p) => !p)}>
            {preview ? 'Dashboard nézet' : 'Riport előnézet'}
          </Button>
          <Button icon={FileSpreadsheet} onClick={() => void downloadExcel()} disabled={exporting}>
            {exporting ? 'Készül…' : 'Excel'}
          </Button>
          <Button variant="primary" icon={Printer} onClick={() => window.print()}>
            Nyomtatás / PDF
          </Button>
        </div>
      </div>

      {missingClientData && (
        <p className="rounded-lg border border-risk-yellow/30 bg-risk-yellow-soft px-4 py-2.5 text-sm text-slate-700">
          Az ügyféladatok hiányosak (cégnév / adószám) – a riport ezek nélkül is elkészül, de kiadás előtt pótolja őket.
        </p>
      )}

      {preview ? (
        <ExecutiveReport assessment={assessment} savings={savings} exposure={exposure} audit={audit} actionPlan={actionPlan} sealStatus={sealStatus} />
      ) : (
        <>
          {/* KPI row */}
          <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr_1fr]">
            <div className="rounded-xl bg-navy-900 px-6 py-5 text-white shadow-lg shadow-navy-900/20">
              <p className="text-[11px] font-medium tracking-[0.14em] text-navy-100/70 uppercase">
                Összesített tiszta adómegtakarítás / év
              </p>
              <p className="tabular mt-2 font-serif text-4xl font-bold">{formatHuf(savings.totalAnnualSaving)}</p>
              <p className="mt-2 text-sm text-navy-100/80">
                {formatPercent(savings.effectiveSubsidyRate)} hatékony támogatás a{' '}
                <span className="tabular text-white">{formatHuf(savings.directRdCost)}</span> közvetlen K+F költségre
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
              <p className="text-[11px] font-medium tracking-[0.14em] text-slate-500 uppercase">
                Többéves potenciál ({years + 1} adóév)
              </p>
              <p className="tabular mt-2 font-serif text-2xl font-bold text-navy-900">{formatHuf(savings.multiYearPotential)}</p>
              <label htmlFor="self-revision" className="mt-3 flex justify-between text-xs text-slate-500">
                <span>Önellenőrzéssel bevont múltbeli évek</span>
                <span className="font-semibold text-navy-900">{years}</span>
              </label>
              <input
                id="self-revision"
                disabled={Boolean(assessment.seal)}
                type="range"
                min={0}
                max={5}
                step={1}
                value={years}
                onChange={(e) => onParamsChange({ selfRevisionYears: Number(e.target.value) })}
                className="w-full"
              />
              <p className="text-[11px] text-slate-400">Feltevés: a múltbeli évek költségszerkezete a tárgyévivel azonos.</p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
              <p className="mb-1 text-[11px] font-medium tracking-[0.14em] text-slate-500 uppercase">SZTNH készültség</p>
              <RiskGauge score={audit.score} level={audit.level} size="sm" />
            </div>
          </div>

          <ExposureCard exposure={exposure} />

          <div className="grid gap-6 lg:grid-cols-2">
            <Card title="Megtakarítás jogcímenként" icon={ChartColumn}>
              <SavingsBreakdown savings={savings} />
            </Card>
            <Card title="Frascati-profil" subtitle="Elért pont / kritérium súlya" icon={Gauge}>
              <CriteriaBars audit={audit} />
            </Card>
          </div>

          <ScenarioCard assessment={assessment} locked={Boolean(assessment.seal)} onApply={onApplyVariant} />

          <SealPanel
            key={assessment.seal?.hash ?? 'open'}
            seal={assessment.seal}
            status={sealStatus}
            history={assessment.sealHistory}
            defaultName={assessment.client.advisorName}
            onSeal={onSeal}
            onReopen={onReopen}
          />

          {(audit.recommendations.length > 0 || audit.knockOuts.length > 0) && (
            <Card title="Kockázatcsökkentő javaslatok" subtitle="Prioritási sorrendben – a leggyengébb kritériummal kezdve" icon={ListChecks}>
              <ol className="list-decimal space-y-2 pl-5 text-sm text-slate-700">
                {audit.knockOuts.map((k) => (
                  <li key={k} className="font-medium text-risk-red">
                    {k}
                  </li>
                ))}
                {audit.recommendations.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ol>
            </Card>
          )}

          <Card title="ICT Európa megvalósítási ütemterv" subtitle="3 lépéses akcióterv a kockázati besorolás alapján" icon={Route}>
            <ActionPlan steps={actionPlan} />
          </Card>

          <Card title="Számítás levezetése">
            <DerivationTable savings={savings} hipaRate={assessment.params.hipaRate} />
          </Card>

          {savings.warnings.length > 0 && <Warnings warnings={savings.warnings} />}
        </>
      )}
    </div>
  );
}
