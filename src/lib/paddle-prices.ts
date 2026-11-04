import {assertPaddleApiConfigured, paddleApiRequest, paddlePriceIdForProduct} from "@/lib/paddle-server";
import {WEB_STORE_PRO_PLANS} from "@/lib/web-store-catalog";

// What the website shows for each Pro plan: Paddle's own price for the
// configured Price ID (PADDLE_PRICE_PRO_MONTHLY / PADDLE_PRICE_PRO_ANNUAL), so
// the page follows the price set in Paddle, and the free trial only when that
// price has one. The catalog's fallback price stands in when Paddle can't be
// read. The overlay itself always shows the buyer's localized price.

export type ProPlanCode = (typeof WEB_STORE_PRO_PLANS)[number];

/** The parts of a Paddle Billing price object (GET /prices) the page needs. */
export type PaddlePriceObject = {
    id?: string;
    status?: string;
    unit_price?: {amount?: string; currency_code?: string};
    billing_cycle?: {interval?: string; frequency?: number} | null;
    trial_period?: {interval?: string; frequency?: number} | null;
};

type Interval = "day" | "week" | "month" | "year";

export type ProPlanPrice = {
    priceId: string;
    /** In the currency's major unit (79.99). */
    amount: number;
    currency: string;
    /** "$79.99/year". */
    display: string;
    interval: Interval;
    frequency: number;
    /** "7 days free", or null when the price has no trial. */
    trialLabel: string | null;
};

const INTERVALS: readonly Interval[] = ["day", "week", "month", "year"];

function isInterval(value: unknown): value is Interval {
    return typeof value === "string" && (INTERVALS as readonly string[]).includes(value);
}

/** A Paddle price as the page shows it; null for anything that isn't a recurring price we can read. */
export function describePaddlePrice(price: PaddlePriceObject | null | undefined, locale = "en-US"): ProPlanPrice | null {
    const id = price?.id;
    const raw = price?.unit_price?.amount;
    const currency = price?.unit_price?.currency_code;
    if (!id || !raw || !/^\d+$/.test(raw) || !currency || !/^[A-Z]{3}$/.test(currency)) return null;
    if (price?.status && price.status !== "active") return null;
    const interval = price?.billing_cycle?.interval;
    const frequency = Number(price?.billing_cycle?.frequency ?? 1);
    if (!isInterval(interval) || !Number.isInteger(frequency) || frequency < 1) return null;
    let format: Intl.NumberFormat;
    try {
        format = new Intl.NumberFormat(locale, {style: "currency", currency});
    } catch {
        return null;
    }
    // Paddle amounts are in the lowest denomination: cents for USD, whole yen for JPY.
    const amount = Number(raw) / 10 ** (format.resolvedOptions().maximumFractionDigits ?? 2);
    const trialInterval = price?.trial_period?.interval;
    const trialFrequency = Number(price?.trial_period?.frequency ?? 0);
    const trialLabel = isInterval(trialInterval) && Number.isInteger(trialFrequency) && trialFrequency > 0
        ? `${trialFrequency} ${trialInterval}${trialFrequency === 1 ? "" : "s"} free`
        : null;
    return {
        priceId: id,
        amount,
        currency,
        display: `${format.format(amount)}/${frequency === 1 ? interval : `${frequency} ${interval}s`}`,
        interval,
        frequency,
        trialLabel
    };
}

/** How much the yearly plan saves against twelve monthly payments, in whole percent; null unless both are plain monthly and yearly prices in one currency. */
export function annualSavingPercent(monthly: ProPlanPrice | null | undefined, annual: ProPlanPrice | null | undefined) {
    if (!monthly || !annual || monthly.currency !== annual.currency) return null;
    if (monthly.interval !== "month" || monthly.frequency !== 1 || annual.interval !== "year" || annual.frequency !== 1) return null;
    const percent = Math.floor((1 - annual.amount / (monthly.amount * 12)) * 100);
    return percent > 0 ? percent : null;
}

const CACHE_MS = 10 * 60_000;
let cache: {at: number; key: string; plans: Partial<Record<ProPlanCode, ProPlanPrice>>} | null = null;

/**
 * Paddle's price for each Pro plan whose Price ID is set, read from the
 * Paddle API and kept for 10 minutes. Never throws: a plan Paddle can't
 * describe is left out and the page shows the catalog's fallback price.
 */
export async function loadProPlanPrices(env: NodeJS.ProcessEnv = process.env): Promise<Partial<Record<ProPlanCode, ProPlanPrice>>> {
    const configured = WEB_STORE_PRO_PLANS.map((code) => ({code, priceId: paddlePriceIdForProduct(code, env)})).filter((entry) => entry.priceId);
    if (!configured.length || assertPaddleApiConfigured(env)) return {};
    const key = configured.map((entry) => entry.priceId).join(",");
    if (cache && cache.key === key && Date.now() - cache.at < CACHE_MS) return cache.plans;
    try {
        const payload = await paddleApiRequest<{data?: PaddlePriceObject[]}>(`/prices?id=${key}`, {method: "GET", signal: AbortSignal.timeout(4_000)}, env);
        const plans: Partial<Record<ProPlanCode, ProPlanPrice>> = {};
        for (const entry of configured) {
            const described = describePaddlePrice((payload.data ?? []).find((price) => price.id === entry.priceId));
            if (described) plans[entry.code] = described;
        }
        cache = {at: Date.now(), key, plans};
        return plans;
    } catch (error) {
        console.warn("[paddle-prices] could not read the Pro prices", error instanceof Error ? error.message : error);
        return {};
    }
}
