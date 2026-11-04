import {splitLocalePath} from "@/lib/request-routing";

export const WEB_STORE_PRODUCT_CODES = ["purchase_25", "purchase_100", "pro_upgrade", "pro_annual"] as const;
export type WebStoreProductCode = (typeof WEB_STORE_PRODUCT_CODES)[number];

/** The Pro plans, annual first: it is shown first and pre-selected (Nov 2026 pricing). */
export const WEB_STORE_PRO_PLANS = ["pro_annual", "pro_upgrade"] as const satisfies readonly WebStoreProductCode[];

export type WebStoreProduct = {
    code: WebStoreProductCode;
    kind: "credits" | "pro";
    credits: number;
    label: string;
    /** Pro plans: how often it bills. */
    period: "month" | "year" | null;
    detail: string;
    /** Shown until Paddle's localized price is known; also the analytics value of last resort. */
    fallbackPrice: string;
    fallbackAmount: number;
    fallbackCurrency: "USD";
};

export const WEB_STORE_PRODUCTS: Record<WebStoreProductCode, WebStoreProduct> = {
    purchase_25: {
        code: "purchase_25",
        kind: "credits",
        credits: 25,
        label: "25 Credits",
        period: null,
        // What Credits buy for most people (newcomer UX vet, 2026-10-30): captures and more talking.
        detail: "About 12 photo captures. Credits also keep a conversation going after the day's free messages.",
        fallbackPrice: "$2.99",
        fallbackAmount: 2.99,
        fallbackCurrency: "USD"
    },
    purchase_100: {
        code: "purchase_100",
        kind: "credits",
        credits: 100,
        label: "100 Credits",
        period: null,
        detail: "About 50 photo captures, or a mix of photos, videos and extra messages with your animals.",
        fallbackPrice: "$7.99",
        fallbackAmount: 7.99,
        fallbackCurrency: "USD"
    },
    // The monthly plan keeps its historic code: the database, the apps and
    // the existing web subscription all know Pro as "pro_upgrade".
    pro_upgrade: {
        code: "pro_upgrade",
        kind: "pro",
        credits: 0,
        label: "AnimalDex Pro",
        period: "month",
        detail: "Unlimited captures, 100 messages a day with any animal, and 42 Credits every month.",
        fallbackPrice: "$14.99/month",
        fallbackAmount: 14.99,
        fallbackCurrency: "USD"
    },
    pro_annual: {
        code: "pro_annual",
        kind: "pro",
        credits: 0,
        label: "AnimalDex Pro (yearly)",
        period: "year",
        detail: "Unlimited captures and 100 messages a day with any animal, billed once a year.",
        fallbackPrice: "$79.99/year",
        fallbackAmount: 79.99,
        fallbackCurrency: "USD"
    }
};

export function isProProductCode(code: WebStoreProductCode) {
    return WEB_STORE_PRODUCTS[code].kind === "pro";
}

/**
 * The product a web purchase is registered under in the database
 * (web_purchases.product_code, register_web_purchase): Pro is one product
 * there whatever the billing period, so the annual plan is "pro_upgrade"
 * with the annual Paddle Price ID. Fulfilment and the subscription checks
 * key on that Price ID, and the period is Paddle's.
 */
export function webPurchaseProductCode(code: WebStoreProductCode): "purchase_25" | "purchase_100" | "pro_upgrade" {
    return code === "pro_annual" ? "pro_upgrade" : code;
}

export type WebStoreBenefit = {title: string; detail?: string};

/**
 * What Pro bought on the website includes. Every line is implemented for an
 * account whose Pro comes from Paddle: spoken replies (animal_chat_speech_limit,
 * Pro 30 a day) and story videos (hasVerifiedPro) are app features, so they
 * say so; the web chat has no voice. Field-guide unlocks are not listed, and
 * Instagram Import is not either: it is paused (Nov 2026), so no buyer could use it.
 */
export const WEB_STORE_PRO_BENEFITS: readonly WebStoreBenefit[] = [
    {title: "Hear every animal’s voice", detail: "30 spoken replies a day, in the app."},
    {title: "Story videos of your animals", detail: "Made from your own captures, in the app."},
    {title: "Unlimited captures", detail: "Photo and video captures don’t use Credits."},
    {title: "100 messages a day with any animal"},
    {title: "42 Credits every month", detail: "Added each time Pro renews. Unused Credits carry over."}
];

const MONTHLY_CREDITS_BENEFIT = "42 Credits every month";

/**
 * The benefits of one Pro plan. Paddle Pro grants its 42 Credits once per
 * paid billing period (paddle_subscription_pro_monthly_credits), so the
 * yearly plan does not promise them every month.
 */
export function webStoreProBenefits(code: WebStoreProductCode): readonly WebStoreBenefit[] {
    return code === "pro_annual" ? WEB_STORE_PRO_BENEFITS.filter((benefit) => benefit.title !== MONTHLY_CREDITS_BENEFIT) : WEB_STORE_PRO_BENEFITS;
}

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
