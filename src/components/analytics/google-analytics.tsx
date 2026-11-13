import {GA_MEASUREMENT_ID, isGoogleAnalyticsEnabled} from "@/lib/analytics";
import GoogleAnalyticsLoader from "@/components/analytics/google-analytics-loader";

/**
 * Google Analytics, loaded in the browser once the visit passes the bot gate
 * (src/lib/analytics-bot-gate.ts; headless and automation user agents, an
 * empty one, WebDriver, and an Android WebView landing cold on /account get no
 * tag). It stays a server component in a static layout and reads no request
 * headers, so every public page keeps rendering statically.
 */
export default function GoogleAnalytics() {
    if (!isGoogleAnalyticsEnabled() || !GA_MEASUREMENT_ID) {
        return null;
    }

    return <GoogleAnalyticsLoader measurementId={GA_MEASUREMENT_ID} />;
}
