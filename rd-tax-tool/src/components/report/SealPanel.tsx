/**
 * Seal ("Lezárás") controls on the results page and the seal line printed on
 * the executive report.
 */
import { Copy, Lock, LockOpen, ShieldCheck, ShieldX } from 'lucide-react';
import { useState } from 'react';
import { formatSealTime, shortHash } from '../../domain/seal';
import type { AuditSeal } from '../../domain/types';
import type { SealStatus } from '../../state/useAssessment';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';

interface SealPanelProps {
  seal: AuditSeal | null;
  status: SealStatus;
  history: AuditSeal[];
  defaultName: string;
  onSeal: (sealedBy: string) => Promise<void>;
  onReopen: () => void;
}

export function SealPanel({ seal, status, history, defaultName, onSeal, onReopen }: SealPanelProps) {
  const [name, setName] = useState(defaultName);
  const [confirming, setConfirming] = useState<'seal' | 'reopen' | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyHash = async () => {
    if (!seal) return;
    try {
      await navigator.clipboard.writeText(seal.hash);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard refused – the hash stays selectable on screen.
    }
  };

  if (!seal) {
    return (
      <Card
        title="Ügy lezárása"
        subtitle="SHA-256 ujjlenyomat a teljes adatcsomagról – utólagos módosítás esetén a pecsét érvénytelenné válik"
        icon={Lock}
      >
        <div className="flex flex-col gap-3">
          <p className="text-sm text-slate-600">
            Lezárás után az adatok csak olvashatók, a riportra rákerül az időpont és az ellenőrző kód. Az időpont a gép
            órájából származik; jogilag minősített időbélyeghez (eIDAS) külső szolgáltató kell.
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex min-w-56 flex-1 flex-col gap-1.5 text-[13px] font-medium text-slate-700">
              Lezáró tanácsadó neve
              <input
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal focus:border-navy-600 focus:ring-2 focus:ring-navy-100 focus:outline-none"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="pl. Kovács Anna"
              />
            </label>
            {confirming === 'seal' ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-slate-700">Lezárás után nem szerkeszthető. Biztos?</span>
                <Button
                  variant="primary"
                  icon={Lock}
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await onSeal(name);
                    } finally {
                      setBusy(false);
                      setConfirming(null);
                    }
                  }}
                >
                  Igen, lezárom
                </Button>
                <Button variant="ghost" onClick={() => setConfirming(null)}>
                  Mégse
                </Button>
              </div>
            ) : (
              <Button variant="primary" icon={Lock} disabled={!name.trim()} onClick={() => setConfirming('seal')}>
                Ügy lezárása
              </Button>
            )}
          </div>
          {history.length > 0 && <SealHistory history={history} />}
        </div>
      </Card>
    );
  }

  const valid = status === 'valid';
  const invalid = status === 'invalid';

  return (
    <Card
      title="Lezárt ügy"
      subtitle="Az adatok csak olvashatók"
      icon={invalid ? ShieldX : ShieldCheck}
      aside={
        <span
          className={`rounded-md px-2.5 py-1 text-xs font-semibold ${
            valid ? 'bg-risk-green-soft text-risk-green' : invalid ? 'bg-risk-red-soft text-risk-red' : 'bg-slate-100 text-slate-600'
          }`}
        >
          {valid ? '✓ Pecsét érvényes' : invalid ? '✕ Pecsét érvénytelen' : 'Ellenőrzés…'}
        </span>
      }
    >
      <div className="flex flex-col gap-4">
        {invalid && (
          <p className="rounded-lg border border-risk-red/30 bg-risk-red-soft px-4 py-2.5 text-sm text-risk-red">
            Az ujjlenyomat nem egyezik az adatokkal: a mentett fájlt a lezárás után módosították. Ez az ügy nem
            tekinthető hiteles lezárt állapotnak.
          </p>
        )}
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
          <dt className="text-slate-500">Lezárva</dt>
          <dd className="tabular font-medium text-slate-800">{formatSealTime(seal.sealedAt)}</dd>
          <dt className="text-slate-500">Lezárta</dt>
          <dd className="font-medium text-slate-800">{seal.sealedBy || '—'}</dd>
          <dt className="text-slate-500">Számítási motor</dt>
          <dd className="font-mono text-xs text-slate-700">v{seal.engineVersion}</dd>
          <dt className="text-slate-500">SHA-256</dt>
          <dd className="flex min-w-0 items-start gap-2">
            <code className="min-w-0 font-mono text-xs break-all text-slate-800 select-all">{seal.hash}</code>
            <button
              type="button"
              onClick={copyHash}
              className="shrink-0 rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-navy-900"
              aria-label="Ujjlenyomat másolása"
              title="Másolás"
            >
              <Copy className="size-3.5" aria-hidden />
            </button>
            {copied && <span className="text-xs text-risk-green">Másolva</span>}
          </dd>
        </dl>
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
          {confirming === 'reopen' ? (
            <>
              <span className="text-sm text-slate-700">
                A mostani pecsét az előzmények közé kerül, és szerkeszthető új verzió nyílik. Folytatja?
              </span>
              <Button
                icon={LockOpen}
                onClick={() => {
                  onReopen();
                  setConfirming(null);
                }}
              >
                Új verzió nyitása
              </Button>
              <Button variant="ghost" onClick={() => setConfirming(null)}>
                Mégse
              </Button>
            </>
          ) : (
            <Button icon={LockOpen} onClick={() => setConfirming('reopen')}>
              Új verzió nyitása
            </Button>
          )}
        </div>
        {history.length > 0 && <SealHistory history={history} />}
      </div>
    </Card>
  );
}

function SealHistory({ history }: { history: AuditSeal[] }) {
  return (
    <div className="text-xs text-slate-500">
      <p className="mb-1 font-semibold tracking-wide uppercase">Korábbi lezárások</p>
      <ul className="space-y-0.5">
        {history.map((s) => (
          <li key={s.hash} className="tabular">
            {formatSealTime(s.sealedAt)} · {s.sealedBy || '—'} · <span className="font-mono">{shortHash(s.hash)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Seal line printed at the bottom of the executive report. */
export function ReportSealLine({ seal, status }: { seal: AuditSeal | null; status: SealStatus }) {
  if (!seal) {
    return (
      <p className="text-[11px] tracking-wide text-slate-400 uppercase">
        Nem lezárt munkaváltozat – az adatok még módosulhatnak
      </p>
    );
  }
  return (
    <div className={`rounded-md border px-3 py-2 text-[10.5px] ${status === 'invalid' ? 'border-risk-red text-risk-red' : 'border-navy-800 text-navy-900'}`}>
      <p className="font-semibold tracking-wide uppercase">
        {status === 'invalid' ? 'Érvénytelen pecsét – az adatok a lezárás után módosultak' : 'Lezárt K+F diagnosztika'} ·{' '}
        {formatSealTime(seal.sealedAt)} ({seal.sealedAt}) · {seal.sealedBy} · motor v{seal.engineVersion}
      </p>
      <p className="mt-0.5 font-mono break-all">SHA-256: {seal.hash}</p>
    </div>
  );
}
