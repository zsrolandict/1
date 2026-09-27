/**
 * Form controls. All are controlled components that emit typed values
 * (numbers stay numbers; parsing happens here, not in the steps).
 */
import { useId, useState, type ReactNode } from 'react';
import { formatNumber, parseHufInput } from '../../domain/format';

interface FieldProps {
  label: string;
  hint?: ReactNode;
  error?: string;
  htmlFor?: string;
  children: ReactNode;
}

export function Field({ label, hint, error, htmlFor, children }: FieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-[13px] font-medium text-slate-700">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-xs text-risk-red">{error}</p>
      ) : hint ? (
        <p className="text-xs text-slate-500">{hint}</p>
      ) : null}
    </div>
  );
}

const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-navy-600 focus:ring-2 focus:ring-navy-100 focus:outline-none';

interface TextInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  hint?: ReactNode;
  error?: string;
}

export function TextInput({ label, value, onChange, placeholder, hint, error }: TextInputProps) {
  const id = useId();
  return (
    <Field label={label} hint={hint} error={error} htmlFor={id}>
      <input
        id={id}
        className={`${inputClass} ${error ? 'border-risk-red' : ''}`}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={Boolean(error)}
      />
    </Field>
  );
}

interface SelectInputProps<T extends string> {
  label: string;
  value: T;
  options: Record<T, string>;
  onChange: (value: T) => void;
}

export function SelectInput<T extends string>({ label, value, options, onChange }: SelectInputProps<T>) {
  const id = useId();
  return (
    <Field label={label} htmlFor={id}>
      <select id={id} className={inputClass} value={value} onChange={(e) => onChange(e.target.value as T)}>
        {(Object.entries(options) as [T, string][]).map(([key, text]) => (
          <option key={key} value={key}>
            {text}
          </option>
        ))}
      </select>
    </Field>
  );
}

interface CurrencyInputProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  hint?: ReactNode;
  /** Allows negative values (e.g. a pre-tax loss). */
  allowNegative?: boolean;
  /** When set, a range slider from 0 to this value is shown under the input. */
  sliderMax?: number;
  sliderStep?: number;
  /** Optional right-hand annotation, e.g. the live saving for this line. */
  annotation?: ReactNode;
}

/**
 * Forint input with thousands separators. While focused it keeps the raw
 * text the user types; on blur it re-renders the formatted value.
 */
export function CurrencyInput({
  label,
  value,
  onChange,
  hint,
  allowNegative = false,
  sliderMax,
  sliderStep = 500_000,
  annotation,
}: CurrencyInputProps) {
  const id = useId();
  const [draft, setDraft] = useState<string | null>(null);

  const commit = (raw: string) => {
    const parsed = parseHufInput(raw);
    onChange(allowNegative ? parsed : Math.max(0, parsed));
  };

  return (
    <Field label={label} hint={hint} htmlFor={id}>
      <div className="relative">
        <input
          id={id}
          inputMode="numeric"
          className={`${inputClass} tabular pr-10 text-right`}
          value={draft ?? (value === 0 ? '' : formatNumber(value))}
          placeholder="0"
          onFocus={() => setDraft(value === 0 ? '' : formatNumber(value))}
          onChange={(e) => {
            setDraft(e.target.value);
            commit(e.target.value);
          }}
          onBlur={() => setDraft(null)}
        />
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-slate-400">
          Ft
        </span>
      </div>
      {sliderMax !== undefined && (
        <input
          type="range"
          aria-label={`${label} csúszka`}
          min={0}
          max={Math.max(sliderMax, value)}
          step={sliderStep}
          value={Math.max(0, value)}
          onChange={(e) => onChange(Number(e.target.value))}
          className="mt-1 w-full"
        />
      )}
      {annotation}
    </Field>
  );
}

interface SegmentedProps<T extends string> {
  label: string;
  value: T;
  options: { value: T; label: string; description?: string }[];
  onChange: (value: T) => void;
}

export function Segmented<T extends string>({ label, value, options, onChange }: SegmentedProps<T>) {
  return (
    <div className="flex flex-col gap-1.5" role="radiogroup" aria-label={label}>
      <span className="text-[13px] font-medium text-slate-700">{label}</span>
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((opt) => {
          const active = opt.value === value;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(opt.value)}
              className={`rounded-lg border px-3 py-2.5 text-left transition-colors ${
                active
                  ? 'border-navy-700 bg-navy-50 ring-1 ring-navy-700'
                  : 'border-slate-300 bg-white hover:border-slate-400'
              }`}
            >
              <span className={`block text-sm font-medium ${active ? 'text-navy-900' : 'text-slate-700'}`}>
                {opt.label}
              </span>
              {opt.description && <span className="mt-0.5 block text-xs text-slate-500">{opt.description}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface ToggleProps {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export function Toggle({ label, description, checked, onChange }: ToggleProps) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 inline-flex h-5 w-9 shrink-0 rounded-full transition-colors ${
          checked ? 'bg-navy-700' : 'bg-slate-300'
        }`}
      >
        <span
          className={`absolute top-0.5 size-4 rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-4' : 'translate-x-0.5'
          }`}
        />
      </button>
      <span>
        <span className="block text-sm font-medium text-slate-700">{label}</span>
        {description && <span className="block text-xs text-slate-500">{description}</span>}
      </span>
    </label>
  );
}
