export type PaddleRuntimeEnvironment = "production" | "sandbox";

/**
 * The checkout as Paddle.js reports it on its events (checkout.loaded,
 * checkout.completed): amounts are numbers in the currency's major unit,
 * localized to the buyer.
 */
export type PaddleCheckoutData = {
    transaction_id?: string;
    currency_code?: string;
    totals?: {subtotal?: number; discount?: number; tax?: number; total?: number};
};

export type PaddleCheckoutEvent = {name?: string; data?: PaddleCheckoutData};

export function assertPaddleBrowserCheckout(
    environment: PaddleRuntimeEnvironment,
    clientToken: string,
    priceId: string
) {
    if (!priceId.startsWith("pri_")) return "Invalid Paddle Price ID.";
    if (environment === "production") {
        if (!clientToken.startsWith("live_")) return "Paddle live token required.";
    } else if (!clientToken.startsWith("test_")) {
        return "Paddle sandbox token required.";
    }
    return null;
}

/**
 * The languages Paddle Checkout is translated into (Paddle.js v2
 * `settings.locale`, per developer.paddle.com Paddle.Checkout.open()).
 */
export const PADDLE_CHECKOUT_LOCALES = [
    "ar", "zh-Hans", "zh-TW", "da", "nl", "en", "fr", "de", "it", "ja",
    "ko", "no", "pl", "pt", "pt-BR", "tr", "ru", "es", "sv"
] as const;
export type PaddleCheckoutLocale = (typeof PADDLE_CHECKOUT_LOCALES)[number];

/**
 * The page's language as a Paddle Checkout locale: an exact match, else the
 * language alone ("de-AT" is "de"), else English. Indonesian, which the site
 * has, is not one of Paddle's, so it is English.
 */
export function paddleCheckoutLocale(locale: string | null | undefined): PaddleCheckoutLocale {
    const raw = (locale ?? "").trim().replace(/_/g, "-");
    if (!raw) return "en";
    const lower = raw.toLowerCase();
    const exact = PADDLE_CHECKOUT_LOCALES.find((candidate) => candidate.toLowerCase() === lower);
    if (exact) return exact;
    const language = lower.split("-")[0];
    if (language === "zh") return /-(tw|hk|mo|hant)\b/.test(lower) ? "zh-TW" : "zh-Hans";
    if (language === "nb" || language === "nn") return "no";
    return PADDLE_CHECKOUT_LOCALES.find((candidate) => candidate === language) ?? "en";
}

type PaddleBrowser = {
    Environment: {set(environment: "sandbox" | "production"): void};
    Initialize(options: {token: string; eventCallback(event: PaddleCheckoutEvent): void}): void;
    Checkout: {
        open(options: {
            items?: Array<{priceId: string; quantity: number}>;
            transactionId?: string;
            customer?: {email: string};
            customData?: Record<string, string>;
            settings: {displayMode: "overlay"; theme: "dark"; locale: PaddleCheckoutLocale; variant?: "one-page"};
        }): void;
    };
};

declare global {
    interface Window {Paddle?: PaddleBrowser}
}

let paddleLoad: Promise<PaddleBrowser> | null = null;
let initializedToken = "";
let initializedEnvironment: PaddleRuntimeEnvironment | "" = "";

function loadPaddleJs() {
    if (window.Paddle) return Promise.resolve(window.Paddle);
    if (paddleLoad) return paddleLoad;
    paddleLoad = new Promise<PaddleBrowser>((resolve, reject) => {
        const existing = document.querySelector<HTMLScriptElement>('script[data-animaldex-paddle="true"]');
        const script = existing ?? document.createElement("script");
        const onLoad = () => window.Paddle ? resolve(window.Paddle) : reject(new Error("Paddle.js did not initialize."));
        script.addEventListener("load", onLoad, {once: true});
        script.addEventListener("error", () => reject(new Error("Paddle.js could not load.")), {once: true});
        if (!existing) {
            script.src = "https://cdn.paddle.com/paddle/v2/paddle.js";
            script.async = true;
            script.dataset.animaldexPaddle = "true";
            document.head.appendChild(script);
        }
    });
    return paddleLoad;
}

export async function initializePaddleJs(options: {
    environment: PaddleRuntimeEnvironment;
    clientToken: string;
}) {
    const paddle = await loadPaddleJs();
    if (!initializedToken) {
        if (options.environment === "sandbox") {
            paddle.Environment.set("sandbox");
        }
        paddle.Initialize({
            token: options.clientToken,
            eventCallback(event) {
                window.dispatchEvent(new CustomEvent("animaldex:paddle", {detail: event}));
            }
        });
        initializedToken = options.clientToken;
        initializedEnvironment = options.environment;
        return paddle;
    }
    if (initializedToken !== options.clientToken || initializedEnvironment !== options.environment) {
        throw new Error("Paddle.js is already initialized with a different token.");
    }
    return paddle;
}

export async function openPaddleCheckout(options: {
    environment: PaddleRuntimeEnvironment;
    clientToken: string;
    priceId: string;
    purchaseId: string;
    userId?: string;
    customerEmail?: string;
    /** The page's locale; mapped to one Paddle supports. */
    locale?: string;
    /** The overlay has its price, localized for the buyer. */
    onLoaded?(data: PaddleCheckoutData | undefined): void;
    onCompleted(data: PaddleCheckoutData | undefined): void;
    onClosed(): void;
}) {
    const configError = assertPaddleBrowserCheckout(options.environment, options.clientToken, options.priceId);
    if (configError) throw new Error(configError);
    const paddle = await initializePaddleJs({
        environment: options.environment,
        clientToken: options.clientToken
    });

    let loaded = false;
    const listener = (rawEvent: Event) => {
        const event = (rawEvent as CustomEvent<PaddleCheckoutEvent>).detail;
        if (event.name === "checkout.loaded" && !loaded) {
            loaded = true;
            options.onLoaded?.(event.data);
        } else if (event.name === "checkout.completed") {
            window.removeEventListener("animaldex:paddle", listener);
            options.onCompleted(event.data);
        } else if (event.name === "checkout.closed") {
            window.removeEventListener("animaldex:paddle", listener);
            options.onClosed();
        }
    };
    window.addEventListener("animaldex:paddle", listener);
    paddle.Checkout.open({
        items: [{priceId: options.priceId, quantity: 1}],
        ...(options.customerEmail ? {customer: {email: options.customerEmail}} : {}),
        customData: {
            animaldex_purchase_id: options.purchaseId,
            ...(options.userId ? {animaldex_user_id: options.userId} : {})
        },
        settings: {displayMode: "overlay", theme: "dark", locale: paddleCheckoutLocale(options.locale)}
    });
}

export async function openPaddleTransactionCheckout(options: {
    environment: PaddleRuntimeEnvironment;
    clientToken: string;
    transactionId: string;
    customerEmail?: string;
    /** The page's locale; mapped to one Paddle supports. */
    locale?: string;
    onCompleted(): void;
    onClosed(): void;
}) {
    if (!options.transactionId.startsWith("txn_")) throw new Error("Invalid Paddle transaction.");
    if (options.environment === "production" && !options.clientToken.startsWith("live_")) {
        throw new Error("Paddle live token required.");
    }
    if (options.environment === "sandbox" && !options.clientToken.startsWith("test_")) {
        throw new Error("Paddle sandbox token required.");
    }
    const paddle = await initializePaddleJs({
        environment: options.environment,
        clientToken: options.clientToken
    });

    const listener = (rawEvent: Event) => {
        const event = (rawEvent as CustomEvent<PaddleCheckoutEvent>).detail;
        if (event.name === "checkout.completed") {
            window.removeEventListener("animaldex:paddle", listener);
            options.onCompleted();
        } else if (event.name === "checkout.closed") {
            window.removeEventListener("animaldex:paddle", listener);
            options.onClosed();
        }
    };
    window.addEventListener("animaldex:paddle", listener);
    paddle.Checkout.open({
        transactionId: options.transactionId,
        ...(options.customerEmail ? {customer: {email: options.customerEmail}} : {}),
        settings: {displayMode: "overlay", theme: "dark", locale: paddleCheckoutLocale(options.locale), variant: "one-page"}
    });
}
