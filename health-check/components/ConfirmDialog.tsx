'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * Megerősítő ablak. Nem a böngésző `confirm()`-ját használja, mert az
 * beágyazott keretben (előnézet) tiltva lehet, és ott csendben „nem”-et ad.
 */
export default function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel = 'Rendben',
  cancelLabel = 'Mégse',
  danger,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  children?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 print:hidden" onClick={onCancel}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl"
      >
        <h2 id="confirm-title" className="text-base font-semibold text-slate-900">
          {title}
        </h2>
        {children && <div className="mt-2 text-sm text-slate-600">{children}</div>}
        <div className="mt-5 flex justify-end gap-2">
          <button ref={cancelRef} onClick={onCancel} className="rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`rounded-md px-3 py-1.5 text-sm font-medium text-white ${danger ? 'bg-red-600 hover:bg-red-700' : 'bg-slate-900 hover:bg-slate-800'}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

interface AskOptions {
  title: string;
  body?: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
}

/**
 * Kérdés ígérettel: `if (await ask({ title: '…' })) …`. A visszaadott
 * `dialog` elemet a komponens renderelje.
 */
export function useConfirm(): [ReactNode, (opts: AskOptions) => Promise<boolean>] {
  const [state, setState] = useState<(AskOptions & { resolve: (v: boolean) => void }) | null>(null);
  const ask = useCallback((opts: AskOptions) => new Promise<boolean>((resolve) => setState({ ...opts, resolve })), []);
  const close = (v: boolean) => {
    state?.resolve(v);
    setState(null);
  };
  const dialog = (
    <ConfirmDialog
      open={Boolean(state)}
      title={state?.title ?? ''}
      confirmLabel={state?.confirmLabel}
      danger={state?.danger}
      onCancel={() => close(false)}
      onConfirm={() => close(true)}
    >
      {state?.body}
    </ConfirmDialog>
  );
  return [dialog, ask];
}
