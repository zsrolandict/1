'use client';

import { useMemo, useState } from 'react';
import { ClipboardCopy, MessagesSquare } from 'lucide-react';
import { buildBuyerQuestions, buyerQuestionsText } from '@/lib/report/buyerQuestions';
import { RAG_LABEL } from '@/lib/risk/catalog';
import type { RiskAssessment } from '@/lib/risk/types';

/**
 * Eladói átvilágításnál: „ezt fogja kérdezni a vevő” – kérdések,
 * válaszvázlat és a szükséges iratok minden piros és sárga tételhez.
 */
export default function BuyerQuestionsPanel({ companyName, result, highlighted }: { companyName: string; result: RiskAssessment; highlighted: boolean }) {
  const [open, setOpen] = useState(false);
  const [withGreen, setWithGreen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showText, setShowText] = useState(false);
  const list = useMemo(() => buildBuyerQuestions(result, withGreen), [result, withGreen]);
  const text = buyerQuestionsText(companyName, list);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setShowText(true);
    }
  };

  return (
    <section className={`rounded-lg border bg-white shadow-sm ${highlighted ? 'border-indigo-200' : 'border-slate-200'}`}>
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left">
        <span className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <MessagesSquare className="h-4 w-4" /> Várható vevői kérdések
          {highlighted && <span className="rounded bg-indigo-50 px-1.5 text-xs font-medium text-indigo-700">eladói átvilágításhoz</span>}
        </span>
        <span className="text-xs text-slate-500">{open ? 'Bezár' : `${list.length} tétel, kérdésekkel, válaszvázlattal és iratlistával`}</span>
      </button>
      {open && (
        <div className="border-t border-slate-100 p-4">
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <label className="inline-flex items-center gap-1.5 text-slate-600">
              <input type="checkbox" checked={withGreen} onChange={(e) => setWithGreen(e.target.checked)} className="accent-slate-900" /> zöld tételek is
            </label>
            <button onClick={copy} className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-3 py-1.5 font-medium text-white hover:bg-slate-800">
              <ClipboardCopy className="h-3.5 w-3.5" /> {copied ? 'Másolva' : 'Másolás (szövegként)'}
            </button>
            <button onClick={() => setShowText((v) => !v)} className="rounded-md border border-slate-200 px-3 py-1.5 text-slate-600 hover:bg-slate-50">
              {showText ? 'Szöveg elrejtése' : 'Szöveg mutatása'}
            </button>
            <span className="text-slate-500">Az Excel-exportban külön munkalapon is benne van.</span>
          </div>
          {showText && <textarea readOnly value={text} rows={14} onFocus={(e) => e.target.select()} className="mt-3 w-full rounded-md border border-slate-200 p-2 font-mono text-xs" />}
          <ol className="mt-3 space-y-3">
            {list.map((q) => (
              <li key={q.code} className="rounded-md border border-slate-200 p-3 text-sm">
                <p className="font-medium text-slate-900">
                  <span className="mr-1.5 font-mono text-xs text-slate-500">{q.code}</span>
                  {q.title}
                  <span className={`ml-2 text-xs ${q.rag === 'RED' ? 'text-red-700' : q.rag === 'AMBER' ? 'text-amber-700' : 'text-emerald-700'}`}>{RAG_LABEL[q.rag]}</span>
                </p>
                <ul className="mt-1 list-inside list-disc text-slate-700">
                  {q.questions.map((x) => <li key={x}>{x}</li>)}
                </ul>
                <p className="mt-1 text-xs text-slate-600"><b>Válaszvázlat:</b> {q.answerDraft}</p>
                <p className="mt-0.5 text-xs text-slate-500"><b>Szükséges iratok:</b> {q.documents.join('; ')}</p>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-xs text-slate-500">Szabály alapú kérdésbank, tervezet: a válaszvázlatot a szakértő pontosítja, mielőtt a vevő elé kerül.</p>
        </div>
      )}
    </section>
  );
}
