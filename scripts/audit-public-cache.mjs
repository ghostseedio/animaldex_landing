#!/usr/bin/env node

/**
 * Probe anonymous cache behavior for every public AnimalDex family.
 *
 * Usage:
 *   node scripts/audit-public-cache.mjs
 *   node scripts/audit-public-cache.mjs --base https://animaldex.app
 */

const BASE = (process.argv.includes("--base")
    ? process.argv[process.argv.indexOf("--base") + 1]
    : process.env.ANIMALDEX_CACHE_AUDIT_BASE) || "https://animaldex.app";

const DELAY_MS = 750;
const SLOW_WARM_MS = 1500;

/** @type {Array<{family: string, path: string, kind?: "page" | "redirect" | "sitemap"}>} */
const TARGETS = [
    {family: "/", path: "/"},
    {family: "/animals", path: "/animals"},
    {family: "/animals/*", path: "/animals/tiger"},
    {family: "/animals/* invalid", path: "/animals/this-slug-does-not-exist-xyz"},
    {family: "/animal-lessons", path: "/animal-lessons"},
    {family: "/animal-lessons/*", path: "/animal-lessons/tiger"},
    {family: "/pokemon-animals", path: "/pokemon-animals"},
    {family: "/pokemon-animals/*", path: "/pokemon-animals/generation-i"},
    {family: "/animal-hybrids", path: "/animal-hybrids"},
    {family: "/animal-hybrids/*", path: "/animal-hybrids/zebra-rhino-hybrid"},
    {family: "/comparisons", path: "/comparisons"},
    {family: "/comparisons/* canonical", path: "/comparisons/tiger-vs-lion"},
    {family: "/comparisons/* reverse", path: "/comparisons/lion-vs-tiger", kind: "redirect"},
    {family: "/powers", path: "/powers"},
    {family: "/powers/*", path: "/powers/resilience"},
    {family: "/blog", path: "/blog"},
    {family: "/blog/*", path: "/blog/axolotl-symbolism"},
    {family: "/locations", path: "/locations"},
    {family: "/locations/*", path: "/locations/indonesia"},
    {family: "/support", path: "/support"},
    {family: "/p/*", path: "/p/invalid-post-id-cache-audit"},
    {family: "/best-animal-identification-app", path: "/best-animal-identification-app"},
    {family: "/tier-list", path: "/tier-list"},
    {family: "/legendary-earth-beasts/*", path: "/legendary-earth-beasts/sinai-dragon"},
    {family: "/use-cases", path: "/use-cases"},
    {family: "/legal/terms", path: "/legal/terms"},
    {family: "/legal/privacy", path: "/legal/privacy"},
    {family: "/contact", path: "/contact"},
    {family: "/sitemap.xml", path: "/sitemap.xml", kind: "sitemap"},
    {family: "/robots.txt", path: "/robots.txt", kind: "sitemap"}
];

function header(headers, name) {
    return headers.get(name) || headers.get(name.toLowerCase()) || "";
}

function classifyCache(value) {
    const raw = value.trim();
    if (!raw) return "NONE";
    const token = raw.split(",")[0].trim().toUpperCase();
    if (token === "HIT" || token === "MISS" || token === "STALE" || token === "PRERENDER") {
        return token;
    }
    if (/HIT/i.test(raw)) return "HIT";
    if (/PRERENDER/i.test(raw)) return "PRERENDER";
    if (/STALE/i.test(raw)) return "STALE";
    if (/MISS/i.test(raw)) return "MISS";
    return raw;
}

async function probe(path) {
    const url = new URL(path, BASE).toString();
    const started = Date.now();
    const response = await fetch(url, {
        redirect: "manual",
        signal: AbortSignal.timeout(20000),
        headers: {
            "user-agent": "AnimalDexCacheAudit/1.0",
            accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
        }
    });
    await response.arrayBuffer();
    const ttfb = Date.now() - started;
    const cacheControl = header(response.headers, "cache-control");
    const cache = classifyCache(
        header(response.headers, "x-vercel-cache")
        || header(response.headers, "cf-cache-status")
        || header(response.headers, "x-cache")
    );

    return {
        status: response.status,
        cache,
        age: header(response.headers, "age"),
        cacheControl,
        ttfb,
        location: header(response.headers, "location"),
        vercelId: header(response.headers, "x-vercel-id")
    };
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function flagsFor(target, first, second) {
    const flags = [];
    const kind = target.kind || "page";
    const cacheControl = `${first.cacheControl} ${second.cacheControl}`.toLowerCase();

    if (first.status >= 500 || second.status >= 500) flags.push("FAIL: 5xx");
    if (first.status === 0 || second.status === 0) flags.push("FAIL: timeout");

    if (kind === "redirect") {
        if (first.status !== 308 && first.status !== 301 && first.status !== 307 && first.status !== 302) {
            flags.push(`FAIL: expected redirect, got ${first.status}`);
        }
        return flags;
    }

    if (kind === "sitemap") {
        if (first.status !== 200 || second.status !== 200) flags.push("FAIL: sitemap status");
        if (cacheControl.includes("private") && cacheControl.includes("no-store")) {
            flags.push("FAIL: private/no-store");
        }
        if (first.cache === "MISS" && second.cache === "MISS") flags.push("FAIL: MISS -> MISS");
        return flags;
    }

    if (cacheControl.includes("private") && cacheControl.includes("no-store")) {
        flags.push("FAIL: private/no-store");
    }
    if (first.cache === "MISS" && second.cache === "MISS") {
        flags.push("FAIL: MISS -> MISS");
    }
    if (second.ttfb > SLOW_WARM_MS && second.cache !== "HIT" && second.cache !== "STALE" && second.cache !== "PRERENDER") {
        flags.push("FAIL: unexpectedly slow cached request");
    }
    if (["HIT", "STALE", "PRERENDER"].includes(first.cache) === false && second.cache !== "HIT" && second.status === 200) {
        flags.push("WARN: second GET was not HIT");
    }

    return flags;
}

async function main() {
    const rows = [];
    let failed = 0;

    for (const target of TARGETS) {
        let first;
        let second;
        try {
            first = await probe(target.path);
            await sleep(DELAY_MS);
            second = await probe(target.path);
        } catch (error) {
            first = {status: 0, cache: "NONE", age: "", cacheControl: "", ttfb: 0, location: "", vercelId: ""};
            second = first;
            rows.push({
                family: target.family,
                path: target.path,
                first,
                second,
                flags: [`FAIL: ${error instanceof Error ? error.message : "request failed"}`]
            });
            failed += 1;
            continue;
        }

        const flags = flagsFor(target, first, second);
        if (flags.some((flag) => flag.startsWith("FAIL:"))) failed += 1;
        rows.push({family: target.family, path: target.path, first, second, flags});
    }

    console.log(`Public cache audit against ${BASE}\n`);
    console.log([
        "FAMILY".padEnd(32),
        "S1".padEnd(5),
        "S2".padEnd(5),
        "C1".padEnd(12),
        "C2".padEnd(12),
        "T1".padEnd(7),
        "T2".padEnd(7),
        "FLAGS"
    ].join(" "));

    for (const row of rows) {
        console.log([
            row.family.slice(0, 32).padEnd(32),
            String(row.first.status).padEnd(5),
            String(row.second.status).padEnd(5),
            String(row.first.cache).padEnd(12),
            String(row.second.cache).padEnd(12),
            `${row.first.ttfb}ms`.padEnd(7),
            `${row.second.ttfb}ms`.padEnd(7),
            row.flags.join("; ") || "ok"
        ].join(" "));
    }

    console.log("");
    if (failed > 0) {
        console.error(`${failed} family(ies) failed.`);
        process.exitCode = 1;
        return;
    }

    console.log("All probed families passed.");
}

await main();
