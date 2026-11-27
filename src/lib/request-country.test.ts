import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import path from "node:path";
import test from "node:test";
import {currencyForLanguage, DISPLAY_CURRENCY_CODES} from "./account-settings";
import {resolveCrisisCountry} from "./ask-animaldex/crisis-helplines";
import {currencyForCountry, normalizeCountry, rankedLanguageTags, regionOfLanguageTag, resolveVisitorCountry, systemCurrencyFor} from "./request-country";

test("CF-IPCountry: two letters, UK means GB, XX (unknown) and T1 (Tor) are no country", () => {
    assert.equal(normalizeCountry("gb"), "GB");
    assert.equal(normalizeCountry(" id "), "ID");
    assert.equal(normalizeCountry("UK"), "GB");
    assert.equal(normalizeCountry("XX"), null);
    assert.equal(normalizeCountry("T1"), null);
    assert.equal(normalizeCountry(""), null);
    assert.equal(normalizeCountry(null), null);
    assert.equal(normalizeCountry("GBR"), null);
});

test("country beats language: an en-US browser in the UK shows GBP", () => {
    assert.equal(systemCurrencyFor({country: "GB", acceptLanguage: "en-US,en;q=0.9"}), "GBP");
    assert.equal(systemCurrencyFor({country: "ID", acceptLanguage: "id"}), "IDR");
    assert.equal(systemCurrencyFor({country: "DE", acceptLanguage: "en-US"}), "EUR");
    assert.equal(systemCurrencyFor({country: "SK", acceptLanguage: "sk"}), "EUR");
});

test("a known country with no display currency shows USD, not a guess from the language", () => {
    assert.equal(systemCurrencyFor({country: "AR", acceptLanguage: "en-GB"}), "USD");
    assert.equal(systemCurrencyFor({country: "NG", acceptLanguage: "en-GB"}), "USD");
});

test("no country (local dev, XX, Tor): the best browser language with a region decides", () => {
    assert.equal(systemCurrencyFor({country: null, acceptLanguage: "en-GB,en;q=0.9"}), "GBP");
    assert.equal(systemCurrencyFor({country: "XX", acceptLanguage: "id,en-AU;q=0.8"}), "AUD");
    assert.equal(systemCurrencyFor({country: "T1", acceptLanguage: "fr;q=0.5,en-CA;q=0.9"}), "CAD");
    assert.equal(systemCurrencyFor({country: null, acceptLanguage: "en"}), null);
    assert.equal(systemCurrencyFor({languages: ["pt-BR", "en-US"]}), "BRL");
});

test("Accept-Language is ranked by q, then order; regions come from any position", () => {
    assert.deepEqual(rankedLanguageTags("fr;q=0.5, en-GB, de;q=0.8, *;q=0.1"), ["en-GB", "de", "fr"]);
    assert.equal(regionOfLanguageTag("zh-Hant-TW"), "TW");
    assert.equal(regionOfLanguageTag("en_GB"), "GB");
    assert.equal(regionOfLanguageTag("en"), null);
    assert.equal(resolveVisitorCountry({country: "XX", acceptLanguage: "en-NZ"}), "NZ");
    assert.equal(resolveVisitorCountry({country: "jp", acceptLanguage: "en-NZ"}), "JP");
});

test("every country currency is one the site can show, and the whole eurozone shows EUR", () => {
    for (const country of ["AT", "BE", "CY", "DE", "EE", "ES", "FI", "FR", "GR", "HR", "IE", "IT", "LT", "LU", "LV", "MT", "NL", "PT", "SI", "SK"]) {
        assert.equal(currencyForCountry(country), "EUR", country);
    }
    for (const code of ["US", "GB", "ID", "AU", "CA", "NZ", "IN", "JP", "KR", "SG", "MY", "PH", "TH", "ZA", "BR", "MX", "CH", "SE", "NO", "DK", "PL", "CZ", "HU", "RO", "TR", "IL", "IS", "HK", "CN"]) {
        const currency = currencyForCountry(code);
        assert.ok(currency && DISPLAY_CURRENCY_CODES.includes(currency), `${code} → ${currency}`);
    }
});

test("currencyForLanguage keeps its old answers (en-GB → GBP, plain en → null) and learns the rest of the eurozone", () => {
    assert.equal(currencyForLanguage("en-GB"), "GBP");
    assert.equal(currencyForLanguage("id-ID"), "IDR");
    assert.equal(currencyForLanguage("en"), null);
    assert.equal(currencyForLanguage("sk-SK"), "EUR");
});

test("crisis lines: Cloudflare's XX no longer hides the language's country", () => {
    assert.equal(resolveCrisisCountry({requestCountry: "XX", languageName: "Indonesian"}), "ID");
    assert.equal(resolveCrisisCountry({requestCountry: "T1", languageName: "japanese"}), "JP");
    assert.equal(resolveCrisisCountry({requestCountry: "gb", languageName: "Indonesian"}), "GB");
});

test("the server reads the country from CF-IPCountry for currency and crisis lines", () => {
    const root = path.join(__dirname, "..");
    const settings = readFileSync(path.join(root, "data", "account-settings.ts"), "utf8");
    assert.match(settings, /systemCurrencyFor\(\{country: request\.get\(COUNTRY_HEADER\)/);
    const stream = readFileSync(path.join(root, "app", "api", "ask", "stream", "route.ts"), "utf8");
    assert.match(stream, /cf-ipcountry/);
    const geo = readFileSync(path.join(root, "app", "api", "geo", "route.ts"), "utf8");
    assert.match(geo, /private, no-store/);
});
