import assert from "node:assert/strict";
import {readdirSync, readFileSync, statSync} from "node:fs";
import {dirname, join} from "node:path";
import test from "node:test";
import {fileURLToPath} from "node:url";
import {
    generationRefusal,
    INTENT_MAX_AGE_MS,
    INTENT_MIN_AGE_MS,
    isSameOriginBrowserRequest,
    issueComparisonIntent,
    looksLikeBot,
    userDailyGenerationLimit,
    verifyComparisonIntent
} from "./comparison-generation-guard";

const srcRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path: string) => readFileSync(join(srcRoot, path), "utf8");

function sourceFiles(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) return sourceFiles(path);
        return /\.(ts|tsx)$/.test(name) && !name.endsWith(".test.ts") ? [path] : [];
    });
}

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

const CHROME_UA = CHROME;
const allowed = {userAgent: CHROME_UA, sameOrigin: true, intent: "ok" as const, pairMatchesIntent: true, refreshImage: false};

test("only a signed-in account or an admin may generate; anonymous visitors are asked to sign in", () => {
    assert.deepEqual(generationRefusal({...allowed, requester: {kind: "anonymous"}}), {status: 401, error: "sign_in_required"});
    assert.equal(generationRefusal({...allowed, requester: {kind: "user", userId: "u1"}}), null);
    assert.equal(generationRefusal({...allowed, requester: {kind: "admin"}}), null);
    // A signed-in session does not excuse a crawler, another site or a missing click.
    assert.deepEqual(generationRefusal({...allowed, requester: {kind: "user", userId: "u1"}, userAgent: "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"}), {status: 403, error: "forbidden"});
    assert.deepEqual(generationRefusal({...allowed, requester: {kind: "anonymous"}, userAgent: "curl/8.7.1"}), {status: 403, error: "forbidden"});
    assert.deepEqual(generationRefusal({...allowed, requester: {kind: "user", userId: "u1"}, sameOrigin: false}), {status: 403, error: "forbidden"});
    assert.deepEqual(generationRefusal({...allowed, requester: {kind: "user", userId: "u1"}, intent: "missing"}), {status: 403, error: "forbidden"});
    assert.deepEqual(generationRefusal({...allowed, requester: {kind: "user", userId: "u1"}, intent: "expired"}), {status: 403, error: "intent_expired"});
    assert.deepEqual(generationRefusal({...allowed, requester: {kind: "user", userId: "u1"}, pairMatchesIntent: false}), {status: 403, error: "forbidden"});
    // Repainting an existing comparison's artwork is an admin job.
    assert.deepEqual(generationRefusal({...allowed, requester: {kind: "user", userId: "u1"}, refreshImage: true}), {status: 403, error: "forbidden"});
    assert.equal(generationRefusal({...allowed, requester: {kind: "admin"}, refreshImage: true}), null);
});

test("each account has its own daily ceiling", () => {
    assert.equal(userDailyGenerationLimit({} as NodeJS.ProcessEnv), 5);
    assert.equal(userDailyGenerationLimit({COMPARISON_USER_DAILY_LIMIT: "2"} as unknown as NodeJS.ProcessEnv), 2);
    assert.equal(userDailyGenerationLimit({COMPARISON_USER_DAILY_LIMIT: "junk"} as unknown as NodeJS.ProcessEnv), 5);
});

test("the generate route is the only place the site can spend on a comparison, and it checks who is asking first", () => {
    const callers = sourceFiles(srcRoot).filter((path) => /getOrGenerateSpeciesComparison\(/.test(readFileSync(path, "utf8")));
    assert.deepEqual(callers.map((path) => path.slice(srcRoot.length + 1)).sort(), ["app/api/comparisons/generate/route.ts", "data/species-comparisons.ts"]);
    // The data module only defines it: no render path generates on a miss.
    const data = read("data/species-comparisons.ts");
    assert.equal(data.match(/getOrGenerateSpeciesComparison\(/g)?.length, 1);
    assert.doesNotMatch(data, /resolveChallengeEntry/);
    const route = read("app/api/comparisons/generate/route.ts");
    const post = route.slice(route.indexOf("export async function POST"));
    assert.ok(post.indexOf("generationRefusal(") > 0 && post.indexOf("generationRefusal(") < post.indexOf("getOrGenerateSpeciesComparison("));
    assert.match(post, /const requester = await requesterOf\(request\)/);
    assert.match(post, /comparison-generate:user:\$\{requester\.userId\}/);
    // The status probe hands the click's token only to someone who may use it.
    assert.match(route, /requester\.kind === "anonymous" \? \{status: "pending", intent: null, signInRequired: true\}/);
    const screen = read("app/[locale]/(composited)/comparisons/[slug]/_components/comparison-generating.tsx");
    assert.match(screen, /payload\?\.signInRequired/);
    assert.match(screen, /response\.status === 401/);
});
