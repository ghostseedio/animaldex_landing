/**
 * Pure currency-conversion helpers shared by the admin FX endpoint and the
 * metrics dashboard. Rates are keyed by source currency and calendar date so a
 * historical report converts at the rate for its own period, not today's.
 */

export const displayCurrencies = ["USD", "GBP", "IDR"] as const;
export type DisplayCurrency = (typeof displayCurrencies)[number];

export type FxRates = {
  /** Every rate converts one unit of the keyed currency into this currency. */
  base: string;
  rates: Record<string, number>;
  failed: string[];
  provider: string;
  fetchedAt: string;
};

const CURRENCY = /^[A-Z]{3}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
export const MAX_FX_PAIRS = 60;

export function isCurrencyCode(value: string | null | undefined): value is string {
  return Boolean(value && CURRENCY.test(value));
}

export function isDisplayCurrency(value: string | null | undefined): value is DisplayCurrency {
  return displayCurrencies.includes(value as DisplayCurrency);
}

/** A rate date: the first 10 characters of an ISO date, never later than today (UTC). */
export function fxDate(value: string | Date | null | undefined, today = new Date().toISOString().slice(0, 10)) {
  const date = value instanceof Date ? value.toISOString().slice(0, 10) : String(value ?? "").slice(0, 10);
  if (!DATE.test(date)) return today;
  return date > today ? today : date;
}

export function fxKey(currency: string, date: string) {
  return `${currency.toUpperCase()}@${date}`;
}

/** Parses `GBP@2026-08-25,IDR@2026-09-15` into unique, valid pairs. */
export function parseFxPairs(query: string | null | undefined) {
  const pairs = new Map<string, { currency: string; date: string }>();
  for (const raw of String(query ?? "").split(",")) {
    const [currency, date] = raw.trim().toUpperCase().split("@");
    if (!isCurrencyCode(currency) || !DATE.test(date ?? "")) continue;
    pairs.set(fxKey(currency, date), { currency, date });
    if (pairs.size >= MAX_FX_PAIRS) break;
  }
  return Array.from(pairs.entries()).map(([key, pair]) => ({ key, ...pair }));
}

/** Converts, or returns null when the rate is unknown so callers can show the original. */
export function convertAmount(
  amount: number,
  currency: string,
  date: string,
  target: string,
  rates: FxRates | null,
): number | null {
  if (!Number.isFinite(amount)) return null;
  const source = currency.toUpperCase();
  if (source === target.toUpperCase()) return amount;
  if (!rates || rates.base.toUpperCase() !== target.toUpperCase()) return null;
  const rate = rates.rates[fxKey(source, fxDate(date))];
  return typeof rate === "number" && rate > 0 ? amount * rate : null;
}
