import {currencyFractionDigits} from "@/lib/guide-marketplace-core";

/**
 * Currencies Paddle Billing can charge. Indonesian rupiah is not one of them,
 * so an IDR listing is converted into USD and the buyer sees both amounts.
 * Apple Pay and Google Pay are offered inside Paddle Checkout when the
 * buyer's device and the merchant account allow them.
 */
export const PADDLE_PAYMENT_CURRENCIES: Record<string, {decimals: number; minimumMajor: number}> = {
    USD: {decimals: 2, minimumMajor: 0.7},
    GBP: {decimals: 2, minimumMajor: 0.55},
    EUR: {decimals: 2, minimumMajor: 0.65},
    ARS: {decimals: 2, minimumMajor: 780},
    AUD: {decimals: 2, minimumMajor: 1.1},
    BRL: {decimals: 2, minimumMajor: 4},
    CAD: {decimals: 2, minimumMajor: 1},
    CHF: {decimals: 2, minimumMajor: 0.6},
    CLP: {decimals: 0, minimumMajor: 800},
    CNY: {decimals: 2, minimumMajor: 5.1},
    COP: {decimals: 2, minimumMajor: 2980},
    CZK: {decimals: 2, minimumMajor: 15.5},
    DKK: {decimals: 2, minimumMajor: 4.7},
    HKD: {decimals: 2, minimumMajor: 5.5},
    HUF: {decimals: 2, minimumMajor: 252},
    ILS: {decimals: 2, minimumMajor: 2.5},
    INR: {decimals: 2, minimumMajor: 60},
    JPY: {decimals: 0, minimumMajor: 100},
    KRW: {decimals: 0, minimumMajor: 980},
    MXN: {decimals: 2, minimumMajor: 13.7},
    NOK: {decimals: 2, minimumMajor: 7.25},
    NZD: {decimals: 2, minimumMajor: 1.2},
    PEN: {decimals: 2, minimumMajor: 2.5},
    PLN: {decimals: 2, minimumMajor: 2.65},
    RUB: {decimals: 2, minimumMajor: 59},
    SEK: {decimals: 2, minimumMajor: 6.8},
    SGD: {decimals: 2, minimumMajor: 0.9},
    THB: {decimals: 2, minimumMajor: 23},
    TRY: {decimals: 2, minimumMajor: 27},
    TWD: {decimals: 2, minimumMajor: 25},
    UAH: {decimals: 2, minimumMajor: 29},
    VND: {decimals: 0, minimumMajor: 20276},
    ZAR: {decimals: 2, minimumMajor: 12.75}
};

export type GuideCheckoutQuote = {
    ok: true;
    listedCurrency: string;
    listedTotalMinor: number;
    chargeCurrency: string;
    chargeAmountMinor: number;
    /** USD per one major unit of the listing currency, when a conversion was required. */
    fxRate: number | null;
};

export function quoteGuideCheckout(input: {
    amountMinor: number;
    currencyCode: string;
    guestCount: number;
    /** USD received for one major unit of the listing currency. */
    usdPerMajorUnit?: number | null;
}): GuideCheckoutQuote | {ok: false; error: string} {
    const currency = input.currencyCode.trim().toUpperCase();
    const guests = input.guestCount;
    if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor < 1) {
        return {ok: false, error: "This experience does not have a price yet."};
    }
    if (!Number.isSafeInteger(guests) || guests < 1 || guests > 100) {
        return {ok: false, error: "Check the group size for this experience."};
    }
    if (!Number.isSafeInteger(input.amountMinor * guests)) {
        return {ok: false, error: "That group size is too large to price."};
    }

    const listedDigits = currencyFractionDigits(currency, "en");
    const listedMajor = (input.amountMinor / 10 ** listedDigits) * guests;
    const listedTotalMinor = input.amountMinor * guests;
    const native = PADDLE_PAYMENT_CURRENCIES[currency];

    let chargeCurrency = currency;
    let chargeMajor = listedMajor;
    let fxRate: number | null = null;
    if (!native) {
        const rate = input.usdPerMajorUnit;
        if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) {
            return {ok: false, error: `${currency} cannot be charged directly, and a USD conversion is not available.`};
        }
        chargeCurrency = "USD";
        chargeMajor = listedMajor * rate;
        fxRate = rate;
    }

    const paddle = PADDLE_PAYMENT_CURRENCIES[chargeCurrency];
    const chargeAmountMinor = Math.round(chargeMajor * 10 ** paddle.decimals);
    if (!Number.isSafeInteger(chargeAmountMinor) || chargeAmountMinor < 1) {
        return {ok: false, error: "That price is too small to charge."};
    }
    if (chargeAmountMinor / 10 ** paddle.decimals < paddle.minimumMajor) {
        return {ok: false, error: "That price is below the card checkout minimum."};
    }

    return {ok: true, listedCurrency: currency, listedTotalMinor, chargeCurrency, chargeAmountMinor, fxRate};
}
