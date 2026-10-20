import assert from "node:assert/strict";
import test from "node:test";
import {
    INTENT_MAX_AGE_MS,
    INTENT_MIN_AGE_MS,
    isSameOriginBrowserRequest,
    issueComparisonIntent,
    looksLikeBot,
    verifyComparisonIntent
} from "./comparison-generation-guard";

// Read on every call, so setting it after import is enough.
process.env.COMPARISON_INTENT_SECRET = "test-secret";

const CHROME = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36";

test("an intent token is accepted after a human pause and before it expires", () => {
    const issued = 1_000_000;
    const token = issueComparisonIntent("lion-vs-tiger", issued);
    assert.equal(verifyComparisonIntent("lion-vs-tiger", token, issued + INTENT_MIN_AGE_MS + 1), "ok");
    assert.equal(verifyComparisonIntent("lion-vs-tiger", token, issued + 100), "too_fast");
    assert.equal(verifyComparisonIntent("lion-vs-tiger", token, issued + INTENT_MAX_AGE_MS + 1), "expired");
});

test("a token for one pair cannot generate another, and forged or missing tokens fail", () => {
    const issued = 1_000_000;
    const token = issueComparisonIntent("lion-vs-tiger", issued);
    const later = issued + 5_000;
    assert.equal(verifyComparisonIntent("orca-vs-great-white-shark", token, later), "invalid");
    assert.equal(verifyComparisonIntent("lion-vs-tiger", `${issued}.forged`, later), "invalid");
    assert.equal(verifyComparisonIntent("lion-vs-tiger", `${issued + 1}.${token?.split(".")[1]}`, later), "invalid");
    assert.equal(verifyComparisonIntent("lion-vs-tiger", undefined, later), "missing");
});

test("crawlers, scripts and empty user agents look like bots; browsers do not", () => {
    assert.equal(looksLikeBot(CHROME), false);
    for (const ua of [
        null,
        "",
        "node",
        "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
        "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.2; +https://openai.com/gptbot)",
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/129.0.0.0 Safari/537.36",
        "python-requests/2.32.3",
        "curl/8.7.1"
    ]) {
        assert.equal(looksLikeBot(ua), true, String(ua));
    }
});

test("only same-origin browser fetches pass the origin check", () => {
    const post = (headers: Record<string, string>) => new Request("https://animaldex.app/api/comparisons/generate", {method: "POST", headers});
    assert.equal(isSameOriginBrowserRequest(post({"sec-fetch-site": "same-origin"})), true);
    assert.equal(isSameOriginBrowserRequest(post({"sec-fetch-site": "cross-site"})), false);
    assert.equal(isSameOriginBrowserRequest(post({origin: "https://animaldex.app", host: "animaldex.app"})), true);
    assert.equal(isSameOriginBrowserRequest(post({origin: "https://evil.example", host: "animaldex.app"})), false);
    assert.equal(isSameOriginBrowserRequest(post({})), false);
});
