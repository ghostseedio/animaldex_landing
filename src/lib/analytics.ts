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

declare global {
    interface Window {
        gtag?: (
            command: "config" | "event" | "js" | "set",
            targetId: string | Date,
            config?: Record<string, string | number | boolean | undefined>
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

export function trackEvent(name: string, parameters: Record<string, string | number | boolean | undefined> = {}): void {
    if (!isGoogleAnalyticsEnabled() || typeof window === "undefined" || !window.gtag) return;
    window.gtag("event", name, parameters);
}
