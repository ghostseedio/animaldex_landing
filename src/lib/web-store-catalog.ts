import {splitLocalePath} from "@/lib/request-routing";

export const WEB_STORE_PRODUCT_CODES = ["purchase_25", "purchase_100", "pro_upgrade"] as const;
export type WebStoreProductCode = (typeof WEB_STORE_PRODUCT_CODES)[number];

export type WebStoreProduct = {
    code: WebStoreProductCode;
    kind: "credits" | "pro";
    credits: number;
    label: string;
    detail: string;
    fallbackPrice: string;
};

export const WEB_STORE_PRODUCTS: Record<WebStoreProductCode, WebStoreProduct> = {
    purchase_25: {
        code: "purchase_25",
        kind: "credits",
        credits: 25,
        label: "25 Credits",
        detail: "Enough for a small import of photo-equivalent animals.",
        fallbackPrice: "$2.99"
    },
    purchase_100: {
        code: "purchase_100",
        kind: "credits",
        credits: 100,
        label: "100 Credits",
        detail: "For a larger archive import or mixed photo and video.",
        fallbackPrice: "$7.99"
    },
    pro_upgrade: {
        code: "pro_upgrade",
        kind: "pro",
        credits: 0,
        label: "AnimalDex Pro",
        detail: "Instagram Import included, plus unlimited scans and field-guide unlocks.",
        fallbackPrice: "$9.99/month"
    }
};

export const WEB_STORE_PRO_BENEFITS = [
    "Instagram Import included with Pro",
    "Unlimited photo and video scans",
    "Field-guide unlocks included"
] as const;

export function isWebStoreProductCode(value: unknown): value is WebStoreProductCode {
    return typeof value === "string" && (WEB_STORE_PRODUCT_CODES as readonly string[]).includes(value);
}

export function creditDeltaForProduct(code: WebStoreProductCode) {
    return WEB_STORE_PRODUCTS[code].credits;
}

export function recommendCreditPack(deficit: number): WebStoreProductCode {
    if (!Number.isFinite(deficit) || deficit <= 0) return "purchase_25";
    if (deficit <= 25) return "purchase_25";
    return "purchase_100";
}

const ALLOWED_RETURN_PREFIXES = [
    "/app/import/instagram",
    "/app/collection",
    "/app/profile",
    "/app/credits",
    "/app"
];

/**
 * "/id" on an Indonesian page, "" on an English one: the prefix the app's own
 * links carry (`localePrefix: "as-needed"`).
 */
export function localePrefixForPath(pathname: string | null | undefined) {
    const path = pathname ?? "";
    const {locale} = splitLocalePath(path);
    const prefixed = path === `/${locale}` || path.startsWith(`/${locale}/`);
    return prefixed && locale !== "en" ? `/${locale}` : "";
}

/**
 * Where a buyer goes back to after checkout: one of the pages that can start
 * one, same-origin and relative, in the page's own language. Anything else
 * (another site, a query string, an unknown page) becomes the fallback.
 */
export function sanitizeBillingReturnPath(value: string | null | undefined, localePrefix = "") {
    const fallback = `${localePrefix}/app/import/instagram`;
    const raw = (value ?? "").trim();
    if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("://") || raw.includes("\\")) return fallback;
    const path = raw.split("?")[0]?.split("#")[0] ?? "";
    const prefix = localePrefixForPath(path);
    const appPath = prefix ? path.slice(prefix.length) : (path.startsWith("/en/") ? path.slice(3) : path);
    if (!ALLOWED_RETURN_PREFIXES.includes(appPath)) return fallback;
    return `${prefix}${appPath}`;
}

/** The return path for a page that starts checkout, in the language of the page the buyer is on. */
export function localizedBillingReturnPath(appPath: string, currentPathname: string | null | undefined) {
    const prefix = localePrefixForPath(currentPathname);
    return sanitizeBillingReturnPath(`${prefix}${splitLocalePath(appPath).appPath}`, prefix);
}

/** The page that waits for the webhook after Paddle says the payment went through. */
export function billingReturnHref(purchaseId: string, returnPath: string) {
    const prefix = localePrefixForPath(returnPath);
    const params = new URLSearchParams({status: "success", purchase_id: purchaseId, return: returnPath});
    return `${prefix}/app/billing/return?${params.toString()}`;
}

export function billingSuccessHref(returnPath: string, purchaseId: string) {
    const url = new URL(returnPath, "https://animaldex.app");
    url.searchParams.set("billing", "success");
    url.searchParams.set("purchase_id", purchaseId);
    return `${url.pathname}${url.search}`;
}

export function billingCancelHref(returnPath: string) {
    const url = new URL(returnPath, "https://animaldex.app");
    url.searchParams.set("billing", "cancel");
    return `${url.pathname}${url.search}`;
}

export function parseBillingQuery(value: string | null | undefined): "success" | "cancel" | "pending" | null {
    if (value === "success" || value === "cancel" || value === "pending") return value;
    return null;
}

/** Webhook fulfillment is the only proof of payment. Pre-existing Pro is not. */
export function billingStatusIsServerFulfilled(payload: {fulfilled?: unknown}) {
    return payload.fulfilled === true;
}

export function validateCheckoutRequestBody(body: Record<string, unknown>) {
    if (
        typeof body.credits === "number"
        || typeof body.price === "number"
        || typeof body.creditAmount === "number"
        || body.userId
        || body.user_id
        || body.priceId
        || body.price_id
    ) {
        return {ok: false as const, error: "Client cannot set price, Credits, or user.", status: 400};
    }
    const productCode = isWebStoreProductCode(body.productCode)
        ? body.productCode
        : isWebStoreProductCode(body.product_code)
            ? body.product_code
            : null;
    if (!productCode) {
        return {ok: false as const, error: "Unknown product.", status: 400};
    }
    return {ok: true as const, productCode};
}
