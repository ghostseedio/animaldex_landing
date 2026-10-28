import crypto from "crypto";
import type {WebStoreProductCode} from "@/lib/web-store-catalog";
import {isWebStoreProductCode, WEB_STORE_PRODUCT_CODES} from "@/lib/web-store-catalog";

export type PaddleRuntimeEnvironment = "production" | "sandbox";

export const PADDLE_PRICE_ENV: Record<WebStoreProductCode, string> = {
    purchase_25: "PADDLE_PRICE_CREDITS_25",
    purchase_100: "PADDLE_PRICE_CREDITS_100",
    pro_upgrade: "PADDLE_PRICE_PRO_MONTHLY"
};

const PRODUCTION_HOSTS = new Set(["animaldex.app", "www.animaldex.app"]);

export function paddlePriceIdForProduct(code: WebStoreProductCode, env: NodeJS.ProcessEnv = process.env) {
    return env[PADDLE_PRICE_ENV[code]]?.trim() || "";
}

/**
 * Whether the configured catalog Price IDs can be trusted. Each product stands
 * on its own: a Price ID that is not set only makes that product unavailable.
 * A value that is set but is not a Paddle Price ID, or one Price ID shared by
 * two products, closes the whole catalog, because a Price ID that maps to the
 * wrong product could fulfil the wrong product.
 */
export function paddleCatalogError(env: NodeJS.ProcessEnv = process.env) {
    const configured = WEB_STORE_PRODUCT_CODES
        .map((code) => ({code, priceId: paddlePriceIdForProduct(code, env)}))
        .filter((entry) => entry.priceId);
    const malformed = configured.find((entry) => !entry.priceId.startsWith("pri_"));
    if (malformed) return `${PADDLE_PRICE_ENV[malformed.code]} must be a Paddle Price ID (pri_…).`;
    if (new Set(configured.map((entry) => entry.priceId)).size !== configured.length) {
        return "Each configured Paddle Price ID must be distinct.";
    }
    return null;
}

export function productCodeForPaddlePriceId(priceId: string, env: NodeJS.ProcessEnv = process.env): WebStoreProductCode | null {
    if (!priceId || paddleCatalogError(env)) return null;
    return WEB_STORE_PRODUCT_CODES.find((code) => paddlePriceIdForProduct(code, env) === priceId) ?? null;
}

export function getPaddleApiKey(env: NodeJS.ProcessEnv = process.env) {
    return env.PADDLE_API_KEY?.trim() || "";
}

export function getPaddleWebhookSecret(env: NodeJS.ProcessEnv = process.env) {
    return env.PADDLE_WEBHOOK_SECRET?.trim() || "";
}

export function getPaddleClientToken(env: NodeJS.ProcessEnv = process.env) {
    return env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN?.trim() || "";
}

export function resolvePaddleEnvironment(env: NodeJS.ProcessEnv = process.env): PaddleRuntimeEnvironment | null {
    const raw = env.PADDLE_ENVIRONMENT?.trim().toLowerCase();
    if (raw === "production" || raw === "live") return "production";
    if (raw === "sandbox") return "sandbox";
    return null;
}

export function paddleApiHost(environment: PaddleRuntimeEnvironment) {
    return environment === "production" ? "https://api.paddle.com" : "https://sandbox-api.paddle.com";
}

function hostnameFromUrl(value: string | undefined) {
    const raw = value?.trim().toLowerCase() ?? "";
    if (!raw) return "";
    try {
        return new URL(raw.includes("://") ? raw : `https://${raw}`).hostname;
    } catch {
        return raw.replace(/^https?:\/\//, "").split("/")[0] ?? "";
    }
}

export function isAnimalDexProductionDeployment(env: NodeJS.ProcessEnv = process.env) {
    if (env.VERCEL_ENV === "production") return true;
    const hosts = [env.NEXT_PUBLIC_SITE_URL, env.SITE_URL, env.CANONICAL_URL, env.VERCEL_PROJECT_PRODUCTION_URL]
        .map(hostnameFromUrl)
        .filter(Boolean);
    return hosts.some((host) => PRODUCTION_HOSTS.has(host));
}

function environmentError(env: NodeJS.ProcessEnv) {
    const environment = resolvePaddleEnvironment(env);
    if (!environment) return "PADDLE_ENVIRONMENT must be production.";
    if (isAnimalDexProductionDeployment(env) && environment !== "production") {
        return "Production animaldex.app cannot use Paddle sandbox credentials.";
    }
    return null;
}

/** Paddle.js can start: the environment and its client-side token agree. */
export function assertPaddleClientConfigured(env: NodeJS.ProcessEnv = process.env) {
    const environmentProblem = environmentError(env);
    if (environmentProblem) return environmentProblem;
    const token = getPaddleClientToken(env);
    if (resolvePaddleEnvironment(env) === "production") {
        if (!token.startsWith("live_")) return "A Paddle live client-side token is required.";
    } else if (!token.startsWith("test_")) {
        return "A Paddle sandbox client-side token is required.";
    }
    return null;
}

/** The server can call Paddle: the environment and its API key agree. No catalog Price ID is needed. */
export function assertPaddleApiConfigured(env: NodeJS.ProcessEnv = process.env) {
    const environmentProblem = environmentError(env);
    if (environmentProblem) return environmentProblem;
    const apiKey = getPaddleApiKey(env);
    if (resolvePaddleEnvironment(env) === "production") {
        if (!apiKey.startsWith("pdl_live_")) return "A Paddle live API key is required.";
    } else if (!apiKey.startsWith("pdl_sdbx_")) {
        return "A Paddle sandbox API key is required.";
    }
    return null;
}

/**
 * Notifications can be verified and processed. A missing catalog Price ID never
 * stops the webhook: each event's Price ID is checked against the catalog when
 * the event is handled (src/lib/paddle-webhook.ts).
 */
export function assertPaddleWebhookConfigured(env: NodeJS.ProcessEnv = process.env) {
    const apiError = assertPaddleApiConfigured(env);
    if (apiError) return apiError;
    if (!getPaddleWebhookSecret(env)) return "A Paddle webhook secret is required.";
    return null;
}

/**
 * One catalog product can be sold: Paddle.js can open, the webhook that
 * fulfils the purchase is configured, the catalog is well formed and this
 * product has its own Price ID. Another product's missing Price ID does not
 * matter.
 */
export function assertPaddleProductCheckoutConfigured(code: WebStoreProductCode, env: NodeJS.ProcessEnv = process.env) {
    const clientError = assertPaddleClientConfigured(env);
    if (clientError) return clientError;
    const webhookError = assertPaddleWebhookConfigured(env);
    if (webhookError) return webhookError;
    const catalogError = paddleCatalogError(env);
    if (catalogError) return catalogError;
    if (!paddlePriceIdForProduct(code, env)) return `${PADDLE_PRICE_ENV[code]} is not set, so this product is not on sale.`;
    return null;
}

/** Which catalog products the website can sell right now. */
export function paddleProductAvailability(env: NodeJS.ProcessEnv = process.env): Record<WebStoreProductCode, boolean> {
    return {
        purchase_25: assertPaddleProductCheckoutConfigured("purchase_25", env) === null,
        purchase_100: assertPaddleProductCheckoutConfigured("purchase_100", env) === null,
        pro_upgrade: assertPaddleProductCheckoutConfigured("pro_upgrade", env) === null
    };
}

export function parseProductCode(value: unknown): WebStoreProductCode | null {
    return isWebStoreProductCode(value) ? value : null;
}

export function verifyPaddleSignature(
    rawBody: string,
    header: string | null,
    secret: string,
    toleranceSeconds = 5,
    nowSeconds = Math.floor(Date.now() / 1000)
) {
    if (!header || !secret) return {ok: false as const, error: "invalid_webhook_signature"};
    const parts = header.split(";").map((part) => part.trim()).filter(Boolean);
    const timestampText = parts.find((part) => part.startsWith("ts="))?.slice(3);
    const signatures = parts.filter((part) => part.startsWith("h1=")).map((part) => part.slice(3));
    const timestamp = Number(timestampText);
    if (!Number.isInteger(timestamp) || signatures.length === 0 || Math.abs(nowSeconds - timestamp) > toleranceSeconds) {
        return {ok: false as const, error: "invalid_webhook_signature"};
    }
    const expected = crypto.createHmac("sha256", secret).update(`${timestamp}:${rawBody}`, "utf8").digest("hex");
    const expectedBuffer = Buffer.from(expected, "utf8");
    const matches = signatures.some((signature) => {
        const actualBuffer = Buffer.from(signature, "utf8");
        return actualBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(expectedBuffer, actualBuffer);
    });
    return matches ? {ok: true as const} : {ok: false as const, error: "invalid_webhook_signature"};
}

export async function paddleApiRequest<T>(path: string, init: RequestInit = {}, env: NodeJS.ProcessEnv = process.env) {
    const configError = assertPaddleApiConfigured(env);
    if (configError) throw new Error(configError);
    const environment = resolvePaddleEnvironment(env);
    if (!environment) throw new Error("PADDLE_ENVIRONMENT must be production.");
    const response = await fetch(`${paddleApiHost(environment)}${path}`, {
        ...init,
        headers: {
            Authorization: `Bearer ${getPaddleApiKey(env)}`,
            "Content-Type": "application/json",
            ...(init.headers ?? {})
        }
    });
    const payload = await response.json() as T & {error?: {detail?: string}};
    if (!response.ok) throw new Error(payload.error?.detail || "Paddle request failed.");
    return payload;
}

export type PaddleEvent = {
    event_id: string;
    event_type: string;
    occurred_at: string;
    notification_id?: string;
    data: Record<string, unknown>;
};
