import crypto from "crypto";
import type {WebStoreProductCode} from "@/lib/web-store-catalog";
import {isWebStoreProductCode} from "@/lib/web-store-catalog";

export type PaddleRuntimeEnvironment = "production" | "sandbox";

const PRICE_ENV: Record<WebStoreProductCode, string> = {
    purchase_25: "PADDLE_PRICE_CREDITS_25",
    purchase_100: "PADDLE_PRICE_CREDITS_100",
    pro_upgrade: "PADDLE_PRICE_PRO_MONTHLY"
};

const PRODUCTION_HOSTS = new Set(["animaldex.app", "www.animaldex.app"]);

export function paddlePriceIdForProduct(code: WebStoreProductCode, env: NodeJS.ProcessEnv = process.env) {
    return env[PRICE_ENV[code]]?.trim() || "";
}

export function productCodeForPaddlePriceId(priceId: string, env: NodeJS.ProcessEnv = process.env): WebStoreProductCode | null {
    return (Object.keys(PRICE_ENV) as WebStoreProductCode[])
        .find((code) => paddlePriceIdForProduct(code, env) === priceId) ?? null;
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

function catalogError(env: NodeJS.ProcessEnv) {
    const prices = (Object.keys(PRICE_ENV) as WebStoreProductCode[]).map((code) => paddlePriceIdForProduct(code, env));
    if (prices.some((priceId) => !priceId.startsWith("pri_")) || new Set(prices).size !== prices.length) {
        return "Three distinct live Paddle Price IDs are required.";
    }
    return null;
}

export function assertPaddleCheckoutConfigured(env: NodeJS.ProcessEnv = process.env) {
    const environment = resolvePaddleEnvironment(env);
    if (!environment) return "PADDLE_ENVIRONMENT must be production.";
    if (isAnimalDexProductionDeployment(env) && environment !== "production") {
        return "Production animaldex.app cannot use Paddle sandbox credentials.";
    }
    const token = getPaddleClientToken(env);
    if (environment === "production") {
        if (!token.startsWith("live_")) return "A Paddle live client-side token is required.";
    } else if (!token.startsWith("test_")) {
        return "A Paddle sandbox client-side token is required.";
    }
    const prices = catalogError(env);
    if (prices) return environment === "production"
        ? "Three distinct live Paddle Price IDs are required."
        : "Three distinct Paddle sandbox Price IDs are required.";
    return null;
}

export function assertPaddleApiConfigured(env: NodeJS.ProcessEnv = process.env) {
    const checkoutError = assertPaddleCheckoutConfigured(env);
    if (checkoutError) return checkoutError;
    const environment = resolvePaddleEnvironment(env);
    const apiKey = getPaddleApiKey(env);
    if (environment === "production") {
        if (!apiKey.startsWith("pdl_live_")) return "A Paddle live API key is required.";
    } else if (!apiKey.startsWith("pdl_sdbx_")) {
        return "A Paddle sandbox API key is required.";
    }
    return null;
}

export function assertPaddleWebhookConfigured(env: NodeJS.ProcessEnv = process.env) {
    const apiError = assertPaddleApiConfigured(env);
    if (apiError) return apiError;
    if (!getPaddleWebhookSecret(env)) return "A Paddle webhook secret is required.";
    return null;
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
