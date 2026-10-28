const GA_ID_CANDIDATES = [
    process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID,
    process.env.GOOGLE_ANALYTICS_ID
];

export const GA_MEASUREMENT_ID = GA_ID_CANDIDATES
    .map((value) => value?.trim())
    .find((value) => value && /^G-[A-Z0-9]+$/.test(value)) ?? "";

export function isGoogleAnalyticsEnabled(): boolean {
    return /^G-[A-Z0-9]+$/.test(GA_MEASUREMENT_ID);
}

/** One line of a GA4 ecommerce event's `items`. */
export type AnalyticsItem = {
    item_id: string;
    item_name?: string;
    price?: number;
    quantity?: number;
};

type GtagValue = string | number | boolean | undefined | AnalyticsItem[];

declare global {
    interface Window {
        gtag?: (
            command: "config" | "event" | "js" | "set",
            targetId: string | Date,
            config?: Record<string, GtagValue>
        ) => void;
        dataLayer?: unknown[];
    }
}

export function trackPageView(url: string): void {
    if (!isGoogleAnalyticsEnabled() || typeof window === "undefined" || !window.gtag) {
        return;
    }

    window.gtag("config", GA_MEASUREMENT_ID, {
        page_path: url
    });
}

/**
 * GA4 reads event parameters named source / medium / campaign as traffic-source
 * attribution, so UI labels like "drawer" or "chip" showed up as session sources
 * (Oct 2026 audit). They are sent as ui_source / ui_medium / ui_campaign instead.
 */
export function analyticsEventParameters(parameters: Record<string, string | number | boolean | undefined>) {
    const renamed: Record<string, string | number | boolean | undefined> = {};
    for (const [key, value] of Object.entries(parameters)) {
        renamed[key === "source" || key === "medium" || key === "campaign" ? `ui_${key}` : key] = value;
    }
    return renamed;
}

export function trackEvent(name: string, parameters: Record<string, string | number | boolean | undefined> = {}): void {
    if (!isGoogleAnalyticsEnabled() || typeof window === "undefined" || !window.gtag) return;
    window.gtag("event", name, analyticsEventParameters(parameters));
}

/**
 * A GA4 recommended ecommerce event, with the value in the checkout's own
 * currency (Paddle's localized price where it is known).
 */
export function trackEcommerceEvent(
    name: "begin_checkout" | "purchase",
    parameters: {
        transaction_id?: string;
        value: number;
        currency: string;
        tax?: number;
        items: AnalyticsItem[];
        [key: string]: GtagValue;
    }
): void {
    if (!isGoogleAnalyticsEnabled() || typeof window === "undefined" || !window.gtag) return;
    window.gtag("event", name, parameters);
}
