/**
 * ICT Európa – K+F Adódiagnosztika (internal advisory tool).
 *
 * Two modes:
 * - Full assessment: Ügyféladatok → Költség & bér → SZTNH audit → Szoftver → Eredménytábla.
 * - Royalty calculator: a one-page software royalty demo on the same data.
 * All figures are derived in `useAssessment` from the pure domain engine.
 */
import { ChevronLeft, ChevronRight, Lock, ShieldX } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AppHeader } from './components/layout/AppHeader';
import { LiveSummary } from './components/layout/LiveSummary';
import { STEPS, Stepper, type StepId } from './components/layout/Stepper';
import { ExecutiveReport } from './components/report/ExecutiveReport';
import { AuditStep } from './components/steps/AuditStep';
import { ClientStep, clientErrors } from './components/steps/ClientStep';
import { CostStep } from './components/steps/CostStep';
import { RoyaltyCalculator } from './components/software/RoyaltyCalculator';
import { SoftwareStep } from './components/software/SoftwareStep';
import { ResultsStep } from './components/steps/ResultsStep';
import { Button } from './components/ui/Button';
import { useAssessment, type SealStatus } from './state/useAssessment';

export default function App() {
  const {
    assessment,
    savings,
    audit,
    actionPlan,
    sealStatus,
    seal,
    reopen,
    exportJson,
    updateClient,
    updateCosts,
    updateParams,
    updateAudit,
    updateSoftware,
    reset,
    loadDemo,
    load,
  } = useAssessment();
  const [step, setStep] = useState<StepId>('client');
  const [mode, setMode] = useState<AppMode>(loadMode);

  useEffect(() => {
    try {
      localStorage.setItem(MODE_KEY, mode);
    } catch {
      // Remembering the mode is a convenience only.
    }
  }, [mode]);

  const stepIndex = STEPS.findIndex((s) => s.id === step);
  const missingClientData = Object.keys(clientErrors(assessment.client)).length > 0;

  const goTo = (target: StepId) => {
    setStep(target);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const prev = STEPS[stepIndex - 1];
  const next = STEPS[stepIndex + 1];

  return (
    <>
      <div className="no-print min-h-screen">
        <AppHeader
          onExport={exportJson}
          onImport={(data) => {
            load(data);
            goTo('client');
          }}
          onReset={() => {
            reset();
            goTo('client');
          }}
          onDemo={(demo) => {
            loadDemo(demo.build);
            goTo(demo.startStep);
          }}
          mode={mode}
          onModeChange={setMode}
        />
        {mode === 'full' && (
          <Stepper
            current={step}
            onSelect={goTo}
            incomplete={{
              client: missingClientData,
              ip: savings.ipBox.enabled && ['OPEN', 'MISSED', 'REPORTED_LATE'].includes(savings.ipBox.deadline.status),
            }}
          />
        )}
        {assessment.seal && <SealBanner status={sealStatus} onOpen={() => goTo('results')} />}

        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
          {mode === 'royalty' ? (
            <fieldset disabled={Boolean(assessment.seal)} className="m-0 min-w-0 border-0 p-0">
              <RoyaltyCalculator
                client={assessment.client}
                params={assessment.params}
                sw={assessment.software}
                result={savings.ipBox}
                onClient={updateClient}
                onParams={updateParams}
                onSoftware={updateSoftware}
              />
            </fieldset>
          ) : step === 'results' ? (
            <ResultsStep
              assessment={assessment}
              savings={savings}
              audit={audit}
              actionPlan={actionPlan}
              missingClientData={missingClientData}
              sealStatus={sealStatus}
              onParamsChange={updateParams}
              onSeal={seal}
              onReopen={reopen}
            />
          ) : (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
              {/* A disabled fieldset makes every control read-only while the case is sealed. */}
              <fieldset disabled={Boolean(assessment.seal)} className="m-0 min-w-0 border-0 p-0">
                {step === 'client' && <ClientStep client={assessment.client} onChange={updateClient} />}
                {step === 'costs' && (
                  <CostStep
                    costs={assessment.costs}
                    params={assessment.params}
                    savings={savings}
                    onCostsChange={updateCosts}
                    onParamsChange={updateParams}
                  />
                )}
                {step === 'audit' && (
                  <AuditStep
                    answers={assessment.audit}
                    industry={assessment.client.industry}
                    result={audit}
                    onChange={updateAudit}
                  />
                )}
                {step === 'ip' && (
                  <SoftwareStep
                    sw={assessment.software}
                    result={savings.ipBox}
                    taxYear={assessment.client.taxYear}
                    profitBeforeTax={assessment.client.profitBeforeTax}
                    onChange={updateSoftware}
                  />
                )}
              </fieldset>
              <LiveSummary savings={savings} audit={audit} />
            </div>
          )}

          <div className={`mt-8 flex justify-between border-t border-slate-200 pt-6 ${mode === 'royalty' ? 'hidden' : ''}`}>
            {prev ? (
              <Button icon={ChevronLeft} onClick={() => goTo(prev.id)}>
                {prev.label}
              </Button>
            ) : (
              <span />
            )}
            {next && (
              <Button variant="primary" iconRight={ChevronRight} onClick={() => goTo(next.id)}>
                Tovább: {next.label}
              </Button>
            )}
          </div>
        </main>

        <footer className="border-t border-slate-200 py-6 text-center text-xs text-slate-400">
          ICT Európa · Belső használatra · A számítások előzetes becslések, nem minősülnek adóhatósági állásfoglalásnak.
        </footer>
      </div>

      {/* Print target: only this is visible when printing, from any step. */}
      <div className="print-only">
        <ExecutiveReport assessment={assessment} savings={savings} audit={audit} actionPlan={actionPlan} sealStatus={sealStatus} />
      </div>
    </>
  );
}

export type AppMode = 'full' | 'royalty';
const MODE_KEY = 'ict-rd-mode';

function loadMode(): AppMode {
  try {
    return localStorage.getItem(MODE_KEY) === 'royalty' ? 'royalty' : 'full';
  } catch {
    return 'full';
  }
}

/** Read-only notice shown on every step while the case is sealed. */
function SealBanner({ status, onOpen }: { status: SealStatus; onOpen: () => void }) {
  const invalid = status === 'invalid';
  const Icon = invalid ? ShieldX : Lock;
  return (
    <div className={`no-print border-b ${invalid ? 'border-risk-red/30 bg-risk-red-soft' : 'border-navy-100 bg-navy-50'}`}>
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm sm:px-6">
        <span className={`flex items-center gap-2 font-medium ${invalid ? 'text-risk-red' : 'text-navy-800'}`}>
          <Icon className="size-4" aria-hidden />
          {invalid
            ? 'A lezárt ügy pecsétje érvénytelen: az adatok a lezárás után módosultak.'
            : 'Lezárt ügy – az adatok csak olvashatók.'}
        </span>
        <button type="button" onClick={onOpen} className="text-sm font-medium text-navy-700 underline-offset-2 hover:underline">
          Pecsét részletei
        </button>
      </div>
    </div>
  );
}
