import type {AnalyticsItem} from "@/lib/analytics";
import type {PaddleCheckoutData} from "@/lib/paddle-checkout";
import {isWebStoreProductCode, WEB_STORE_PRODUCTS, type WebStoreProductCode} from "@/lib/web-store-catalog";

/**
 * GA4 `begin_checkout` and `purchase` for web Credits and Pro.
 *
 * The value is what Paddle showed the buyer: its localized subtotal less any
 * discount, before tax (GA4's definition of `value`), in the checkout's own
 * currency. Only when Paddle reported nothing does the catalog's US-dollar
 * display price stand in. `purchase` is sent once the webhook has added the
 * purchase to the account, never on the browser's word alone, and once per
 * purchase.
 */

export type CheckoutValue = {value: number; currency: string; tax?: number};

/** What the overlay reported when it completed, kept until the server confirms. */
export type CompletedCheckout = {
    productCode: WebStoreProductCode;
    transactionId?: string;
    value?: CheckoutValue;
};

export type CheckoutStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const COMPLETED_KEY = "animaldex:checkout-completed:";
const REPORTED_KEY = "animaldex:purchase-reported:";

function amount(raw: unknown) {
    return typeof raw === "number" && Number.isFinite(raw) && raw >= 0 ? raw : null;
}

function cents(value: number) {
    return Math.round(value * 100) / 100;
}

export function checkoutValueFromPaddle(data: PaddleCheckoutData | null | undefined): CheckoutValue | null {
    const currency = typeof data?.currency_code === "string" && /^[A-Z]{3}$/.test(data.currency_code)
        ? data.currency_code
        : null;
    const totals = data?.totals;
    if (!currency || !totals) return null;
    const subtotal = amount(totals.subtotal);
    const discount = amount(totals.discount) ?? 0;
    const tax = amount(totals.tax);
    const total = amount(totals.total);
    const value = subtotal !== null ? subtotal - discount : total !== null ? total - (tax ?? 0) : null;
    if (value === null || value < 0) return null;
    return {value: cents(value), currency, ...(tax !== null ? {tax: cents(tax)} : {})};
}

/** Only when Paddle reported no price: the catalog's display price. */
export function catalogCheckoutValue(code: WebStoreProductCode): CheckoutValue {
    const product = WEB_STORE_PRODUCTS[code];
    return {value: product.fallbackAmount, currency: product.fallbackCurrency};
}

export function checkoutItems(code: WebStoreProductCode, value: CheckoutValue): AnalyticsItem[] {
    return [{item_id: code, item_name: WEB_STORE_PRODUCTS[code].label, price: value.value, quantity: 1}];
}

export function beginCheckoutParameters(code: WebStoreProductCode, data: PaddleCheckoutData | null | undefined) {
    const value = checkoutValueFromPaddle(data) ?? catalogCheckoutValue(code);
    return {value: value.value, currency: value.currency, items: checkoutItems(code, value)};
}

export function rememberCompletedCheckout(
    storage: CheckoutStorage | null,
    purchaseId: string,
    code: WebStoreProductCode,
    data: PaddleCheckoutData | null | undefined
) {
    const value = checkoutValueFromPaddle(data);
    const completed: CompletedCheckout = {
        productCode: code,
        ...(typeof data?.transaction_id === "string" && data.transaction_id.startsWith("txn_") ? {transactionId: data.transaction_id} : {}),
        ...(value ? {value} : {})
    };
    try {
        storage?.setItem(`${COMPLETED_KEY}${purchaseId}`, JSON.stringify(completed));
    } catch {
        // The purchase is still reported, at the catalog price.
    }
}

function readCompletedCheckout(storage: CheckoutStorage | null, purchaseId: string): CompletedCheckout | null {
    try {
        const raw = storage?.getItem(`${COMPLETED_KEY}${purchaseId}`);
        const parsed = raw ? JSON.parse(raw) as Partial<CompletedCheckout> : null;
        if (!parsed || !isWebStoreProductCode(parsed.productCode)) return null;
        const value = parsed.value
            && amount(parsed.value.value) !== null
            && typeof parsed.value.currency === "string"
            ? parsed.value
            : undefined;
        return {
            productCode: parsed.productCode,
            ...(typeof parsed.transactionId === "string" ? {transactionId: parsed.transactionId} : {}),
            ...(value ? {value} : {})
        };
    } catch {
        return null;
    }
}

/**
 * The `purchase` parameters for a purchase the server has just confirmed, or
 * null when it was already reported (a reload of the return page) or the
 * product is unknown. Marks it reported.
 */
export function takeConfirmedPurchase(
    storage: CheckoutStorage | null,
    purchaseId: string,
    serverProductCode: unknown
) {
    try {
        if (storage?.getItem(`${REPORTED_KEY}${purchaseId}`)) return null;
    } catch {
        // Unreadable storage: report it; GA4 also drops a repeated transaction_id.
    }
    const completed = readCompletedCheckout(storage, purchaseId);
    const code = isWebStoreProductCode(serverProductCode) ? serverProductCode : completed?.productCode;
    if (!code) return null;
    const value = (completed?.productCode === code ? completed.value : undefined) ?? catalogCheckoutValue(code);
    try {
        storage?.setItem(`${REPORTED_KEY}${purchaseId}`, "1");
        storage?.removeItem(`${COMPLETED_KEY}${purchaseId}`);
    } catch {
        // Nothing to clean up, then.
    }
    return {
        transaction_id: completed?.transactionId ?? purchaseId,
        value: value.value,
        currency: value.currency,
        ...(value.tax !== undefined ? {tax: value.tax} : {}),
        items: checkoutItems(code, value)
    };
}

/** localStorage, or null where the browser refuses it. */
export function checkoutStorage(): CheckoutStorage | null {
    try {
        return typeof window === "undefined" ? null : window.localStorage;
    } catch {
        return null;
    }
}
