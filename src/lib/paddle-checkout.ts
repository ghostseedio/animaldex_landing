export type PaddleRuntimeEnvironment = "production" | "sandbox";

export type PaddleCheckoutEvent = {name?: string; data?: {transaction_id?: string}};

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

type PaddleBrowser = {
    Environment: {set(environment: "sandbox" | "production"): void};
    Initialize(options: {token: string; eventCallback(event: PaddleCheckoutEvent): void}): void;
    Checkout: {
        open(options: {
            items: Array<{priceId: string; quantity: number}>;
            customer?: {email: string};
            customData: Record<string, string>;
            settings: {displayMode: "overlay"; theme: "dark"; locale: "en"};
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
    onCompleted(): void;
    onClosed(): void;
}) {
    const configError = assertPaddleBrowserCheckout(options.environment, options.clientToken, options.priceId);
    if (configError) throw new Error(configError);
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
        items: [{priceId: options.priceId, quantity: 1}],
        ...(options.customerEmail ? {customer: {email: options.customerEmail}} : {}),
        customData: {
            animaldex_purchase_id: options.purchaseId,
            ...(options.userId ? {animaldex_user_id: options.userId} : {})
        },
        settings: {displayMode: "overlay", theme: "dark", locale: "en"}
    });
}
