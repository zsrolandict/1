/** Hungarian locale formatting helpers. */

const hufFormatter = new Intl.NumberFormat('hu-HU', {
  style: 'currency',
  currency: 'HUF',
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat('hu-HU', { maximumFractionDigits: 0 });

/** 12 345 678 Ft */
export const formatHuf = (value: number): string => hufFormatter.format(Math.round(value));

/** 12 345 678 (no currency) – for input fields. */
export const formatNumber = (value: number): string => numberFormatter.format(Math.round(value));

/** 12,3 M Ft / 850 E Ft – compact form for chart labels and tiles. */
export function formatHufCompact(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1e9) return `${(value / 1e9).toLocaleString('hu-HU', { maximumFractionDigits: 2 })} Mrd Ft`;
  if (abs >= 1e6) return `${(value / 1e6).toLocaleString('hu-HU', { maximumFractionDigits: 1 })} M Ft`;
  if (abs >= 1e3) return `${(value / 1e3).toLocaleString('hu-HU', { maximumFractionDigits: 0 })} E Ft`;
  return formatHuf(value);
}

/** 0.065 → "6,5%" */
export const formatPercent = (rate: number, digits = 1): string =>
  `${(rate * 100).toLocaleString('hu-HU', { maximumFractionDigits: digits })}%`;

/** Parses user input like "12 500 000" or "12.500.000 Ft" into 12500000. */
export function parseHufInput(raw: string): number {
  const negative = raw.trim().startsWith('-');
  const digits = raw.replace(/[^\d]/g, '');
  if (digits === '') return 0;
  const value = Number.parseInt(digits, 10);
  return negative ? -value : value;
}

/** Hungarian tax number: 8 digits – 1 digit (VAT code 1–5) – 2 digits (county). */
export const TAX_NUMBER_PATTERN = /^\d{8}-[1-5]-\d{2}$/;

export const isValidTaxNumber = (value: string): boolean => TAX_NUMBER_PATTERN.test(value.trim());
