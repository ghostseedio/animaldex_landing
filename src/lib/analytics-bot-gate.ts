// Whether the Google Analytics tag should load for this visit, pure and run in
// the browser (src/components/analytics/google-analytics-loader.tsx). GA4
// showed 8,695 Direct sessions of one second, 6,200 "users" from China and
// Singapore and /account as the top landing page with no referrer (Nov 2026):
// headless browsers walking the site, and /app/* links that the middleware
// 307s to /account?next=… The GA component sits in a static layout, so the
// server cannot read headers without making every page dynamic; the browser
// decides instead, and a bot that fails the check simply gets no tag. The
// signature is deliberately conservative: only things a real phone or desktop
// browser never says about itself, so a person is never dropped from the
// numbers. The WAF and nginx rules in docs/ops/bot-traffic.md do the blocking.

export type VisitSignals = {
    userAgent: string | null | undefined;
    /** navigator.webdriver: true under Selenium, Puppeteer, Playwright and ChromeDriver. */
    webdriver: boolean;
    pathname: string;
    referrer: string | null | undefined;
    /** A Supabase auth cookie is present: a real account, never a crawler. */
    hasSession: boolean;
};

/**
 * Automation tools and HTTP libraries by the token they put in their own
 * user agent. No generic "bot" substring: it would catch phone brands
 * (Cubot) and the search engines GA already filters. \bbot\b and friends
 * match a standalone word only ("Googlebot" is one word, so it passes).
 */
export const AUTOMATION_USER_AGENT = /HeadlessChrome|PhantomJS|Puppeteer|Playwright|Selenium|WebDriver|Chrome-Lighthouse|Lighthouse|python-requests|python-urllib|aiohttp|Scrapy|\bcurl\/|\bWget\/|Go-http-client|okhttp|Java\/\d|libwww-perl|Apache-HttpClient|node-fetch|undici|axios\/|\b(?:bot|crawler|spider)\b/i;

/** Android WebView announces itself with "; wv)" in the UA (Chrome Custom Tabs and Chrome itself do not). */
export const ANDROID_WEBVIEW = /;\s*wv\)/;

export const ACCOUNT_PATH = /^\/(?:(?:en|id)\/)?account\/?$/;

export type GateVerdict = {load: boolean; reason: "ok" | "empty_user_agent" | "webdriver" | "automation_user_agent" | "webview_account_landing"};

export function analyticsGate(signals: VisitSignals): GateVerdict {
    const userAgent = (signals.userAgent ?? "").trim();
    if (!userAgent) return {load: false, reason: "empty_user_agent"};
    if (signals.webdriver) return {load: false, reason: "webdriver"};
    if (AUTOMATION_USER_AGENT.test(userAgent)) return {load: false, reason: "automation_user_agent"};
    // An Android WebView that lands straight on the sign-in page, from nowhere,
    // with no account: the pattern of the China/Singapore "Direct" sessions.
    // A person reaches /account from a page of ours (a Referer) or already has a session.
    if (ANDROID_WEBVIEW.test(userAgent) && ACCOUNT_PATH.test(signals.pathname) && !(signals.referrer ?? "").trim() && !signals.hasSession) {
        return {load: false, reason: "webview_account_landing"};
    }
    return {load: true, reason: "ok"};
}

/** The Supabase auth cookie (@supabase/ssr names it sb-<ref>-auth-token, chunked or not). */
export function hasSupabaseSessionCookie(cookieHeader: string | null | undefined) {
    return /(?:^|;\s*)sb-[a-z0-9-]+-auth-token(?:\.\d+)?=/i.test(cookieHeader ?? "");
}
