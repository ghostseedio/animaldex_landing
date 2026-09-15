import { fxDate, type FxRates } from "@/lib/fx-convert";

/**
 * Exchange rates from Wise for admin reporting.
 *
 * Rates are market data and read-only, so the production token is used even
 * while payouts run against the Wise sandbox (sandbox rates are not real).
 * Historical rates never change and are cached for a week; today's rate for an
 * hour. A pair that cannot be fetched is reported in `failed` and the dashboard
 * keeps showing that amount in its original currency.
 */

const PRODUCTION_URL = "https://api.wise.com";
const SANDBOX_URL = "https://api.sandbox.transferwise.tech";
const HISTORICAL_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const LATEST_TTL_MS = 60 * 60 * 1000;

const cache = new Map<string, { rate: number; expiresAt: number }>();

function wiseEndpoint() {
  const production = process.env.WISE_PRODUCTION_API_TOKEN?.trim();
  if (production) return { url: PRODUCTION_URL, token: production };
  const sandbox = process.env.WISE_SANDBOX_API_TOKEN?.trim();
  if (sandbox) return { url: SANDBOX_URL, token: sandbox };
  return null;
}

async function fetchRate(source: string, target: string, date: string, today: string) {
  const cacheKey = `${source}>${target}@${date}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.rate;

  const endpoint = wiseEndpoint();
  if (!endpoint) return null;

  const params = new URLSearchParams({ source, target });
  // End of the day, so a report that closes on `date` converts at that day's close.
  if (date < today) params.set("time", `${date}T23:59:00Z`);

  try {
    const response = await fetch(`${endpoint.url}/v1/rates?${params}`, {
      headers: { Authorization: `Bearer ${endpoint.token}`, Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return null;
    const body = (await response.json()) as Array<{ rate?: number }>;
    const rate = Number(body?.[0]?.rate);
    if (!Number.isFinite(rate) || rate <= 0) return null;
    cache.set(cacheKey, { rate, expiresAt: Date.now() + (date < today ? HISTORICAL_TTL_MS : LATEST_TTL_MS) });
    return rate;
  } catch {
    return null;
  }
}

export function hasFxProvider() {
  return wiseEndpoint() !== null;
}

/** Rates into `base` for each requested `{key, currency, date}`, keyed exactly as requested. */
export async function getFxRates(
  base: string,
  pairs: Array<{ key: string; currency: string; date: string }>,
): Promise<FxRates> {
  const today = new Date().toISOString().slice(0, 10);
  const rates: Record<string, number> = {};
  const failed: string[] = [];

  await Promise.all(
    pairs.map(async (pair) => {
      if (pair.currency === base) {
        rates[pair.key] = 1;
        return;
      }
      const rate = await fetchRate(pair.currency, base, fxDate(pair.date, today), today);
      if (rate == null) failed.push(pair.key);
      else rates[pair.key] = rate;
    }),
  );

  return { base, rates, failed, provider: "Wise", fetchedAt: new Date().toISOString() };
}
