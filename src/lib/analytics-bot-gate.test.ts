import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {dirname, join} from "node:path";
import test from "node:test";
import {fileURLToPath} from "node:url";
import {analyticsGate, hasSupabaseSessionCookie} from "./analytics-bot-gate";

// The GA tag is withheld from a conservative bot signature (Nov 2026: one-second
// "Direct" sessions from China and Singapore landing on /account). A person on
// any real browser must always be measured.

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (path: string) => readFileSync(join(repoRoot, path), "utf8");

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1";
const ANDROID_CHROME = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36";
const ANDROID_WEBVIEW = "Mozilla/5.0 (Linux; Android 13; SM-A135F Build/TP1A.220624.014; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/118.0.0.0 Mobile Safari/537.36";
const DESKTOP = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const CUBOT = "Mozilla/5.0 (Linux; Android 11; CUBOT KINGKONG 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";

const human = {webdriver: false, pathname: "/animals/lion", referrer: "", hasSession: false};

test("real browsers are always measured, on any page, with or without a referrer or a session", () => {
    for (const userAgent of [IPHONE, ANDROID_CHROME, DESKTOP, CUBOT]) {
        assert.equal(analyticsGate({...human, userAgent}).load, true, userAgent);
        assert.equal(analyticsGate({...human, userAgent, pathname: "/account"}).load, true, userAgent);
        assert.equal(analyticsGate({...human, userAgent, pathname: "/id/account", referrer: "https://www.google.com/"}).load, true, userAgent);
    }
    // A WebView that came from one of our pages, or already has an account, is a person too.
    assert.equal(analyticsGate({...human, userAgent: ANDROID_WEBVIEW, pathname: "/account", referrer: "https://animaldex.app/animals/lion"}).load, true);
    assert.equal(analyticsGate({...human, userAgent: ANDROID_WEBVIEW, pathname: "/account", hasSession: true}).load, true);
    assert.equal(analyticsGate({...human, userAgent: ANDROID_WEBVIEW, pathname: "/animals/lion"}).load, true);
});

test("automation gets no tag: WebDriver, headless and HTTP-library user agents, an empty one", () => {
    assert.deepEqual(analyticsGate({...human, userAgent: DESKTOP, webdriver: true}), {load: false, reason: "webdriver"});
    assert.deepEqual(analyticsGate({...human, userAgent: ""}), {load: false, reason: "empty_user_agent"});
    assert.deepEqual(analyticsGate({...human, userAgent: null}), {load: false, reason: "empty_user_agent"});
    for (const userAgent of [
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/130.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Unknown; Linux x86_64) AppleWebKit/538.1 (KHTML, like Gecko) PhantomJS/2.1.1 Safari/538.1",
        "python-requests/2.32.3",
        "curl/8.7.1",
        "Go-http-client/2.0",
        "okhttp/4.12.0",
        "Scrapy/2.11 (+https://scrapy.org)",
        "Mozilla/5.0 (compatible; SomeCrawler/1.0; +http://example.com/bot)",
        "node-fetch/1.0 (+https://github.com/bitinn/node-fetch)",
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Chrome-Lighthouse"
    ]) {
        assert.equal(analyticsGate({...human, userAgent}).reason, "automation_user_agent", userAgent);
    }
});

test("an Android WebView landing cold on /account with no session is the bot pattern; the same visit elsewhere is not", () => {
    assert.deepEqual(analyticsGate({...human, userAgent: ANDROID_WEBVIEW, pathname: "/account"}), {load: false, reason: "webview_account_landing"});
    assert.equal(analyticsGate({...human, userAgent: ANDROID_WEBVIEW, pathname: "/id/account/"}).load, false);
    assert.equal(analyticsGate({...human, userAgent: ANDROID_WEBVIEW, pathname: "/account/settings"}).load, true);
    assert.equal(analyticsGate({...human, userAgent: ANDROID_CHROME, pathname: "/account"}).load, true, "Chrome is not a WebView");
});

test("the session check reads the Supabase auth cookie, chunked or not", () => {
    assert.equal(hasSupabaseSessionCookie("NEXT_LOCALE=en; sb-wwhsdzpczekgdlobwaej-auth-token=base64-abc"), true);
    assert.equal(hasSupabaseSessionCookie("sb-wwhsdzpczekgdlobwaej-auth-token.0=abc; sb-wwhsdzpczekgdlobwaej-auth-token.1=def"), true);
    assert.equal(hasSupabaseSessionCookie("NEXT_LOCALE=en; _ga=GA1.1.1"), false);
    assert.equal(hasSupabaseSessionCookie(""), false);
    assert.equal(hasSupabaseSessionCookie(null), false);
});

test("the GA component stays static on the server and gates in the browser", () => {
    const server = read("src/components/analytics/google-analytics.tsx");
    assert.doesNotMatch(server, /headers\(|cookies\(|"use client"/);
    assert.match(server, /<GoogleAnalyticsLoader measurementId=\{GA_MEASUREMENT_ID\} \/>/);
    const loader = read("src/components/analytics/google-analytics-loader.tsx");
    assert.match(loader, /^"use client";/);
    assert.match(loader, /analyticsGate\(\{/);
    assert.match(loader, /navigator\.webdriver === true/);
    assert.match(loader, /if \(!allowed\) return null;/);
    assert.match(loader, /googletagmanager\.com\/gtag\/js\?id=\$\{measurementId\}/);
    // The route tracker never uses useSearchParams (request-amplification contract) and still rides inside the gated tree.
    assert.match(loader, /<GoogleAnalyticsRouteTracker \/>/);
});
