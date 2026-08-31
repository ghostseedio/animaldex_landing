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
    "Re-analysis included",
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

export function sanitizeBillingReturnPath(value: string | null | undefined, localePrefix = "") {
    const fallback = `${localePrefix}/app/import/instagram`;
    const raw = (value ?? "").trim();
    if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("://")) return fallback;
    const path = raw.split("?")[0]?.split("#")[0] ?? "";
    const allowed = ALLOWED_RETURN_PREFIXES.flatMap((prefix) => [prefix, `${localePrefix}${prefix}`].filter(Boolean));
    return allowed.includes(path) ? path : fallback;
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
