/**
 * PERF-WEB verifier NET-8, in Chromium (headless, no scene): what a same-ETag refresh costs the page's main thread.
 * Per round, on the real 4 MB answer served by the local embed server:
 *   gap    the longest main-thread stall while `await response.json()` runs (a MessageChannel heartbeat: what a
 *          frame or an input event would wait), after the body is already fetched (`no-store` from 127.0.0.1)
 *   parse  TextDecoder + JSON.parse of the same bytes (what Body.json does)
 *   decode decodeArkSnapshot, live (signature + seen.snapshot replica), found (decodeArkFounders + 2 stringify)
 *
 *   node scripts/.audit-network-verify-net8-browser.mjs --origin http://127.0.0.1:3391 --path /population-file.json --rounds 10
 */
import {build} from "esbuild";
import {existsSync, readdirSync, writeFileSync, mkdirSync} from "node:fs";
import os from "node:os";
import path from "node:path";

const arg = (name, fallback) => {
    const i = process.argv.indexOf(`--${name}`);
    return i >= 0 ? process.argv[i + 1] : fallback;
};
const origin = arg("origin", "http://127.0.0.1:3391");
const file = arg("path", "/population-file.json");
const rounds = Number(arg("rounds", "10"));
const out = arg("out", path.join(os.homedir(), "AnimalDex-work/ark-perf-web/scratch/network-verify-net8"));
mkdirSync(out, {recursive: true});

const bundle = await build({entryPoints: ["scripts/.audit-network-verify-net8-entry.mts"], bundle: true, format: "iife", platform: "browser", write: false, minify: false, tsconfig: "tsconfig.json", logLevel: "warning"});
const code = bundle.outputFiles[0].text;

function cachedChromium() {
    const cache = path.join(os.homedir(), "Library", "Caches", "ms-playwright");
    for (const name of readdirSync(cache).filter((entry) => /^chromium-\d+$/.test(entry)).sort().reverse()) {
        const candidate = path.join(cache, name, "chrome-mac-arm64", "Google Chrome for Testing.app", "Contents", "MacOS", "Google Chrome for Testing");
        if (existsSync(candidate)) return candidate;
    }
    return undefined;
}
const pw = await import("playwright-core");
const browser = await pw.chromium.launch({executablePath: cachedChromium(), headless: true, args: ["--headless=new", "--disable-background-timer-throttling", "--disable-renderer-backgrounding"]});
const page = await (await browser.newContext({viewport: {width: 1440, height: 900}})).newPage();
// A blank same-origin page (fulfilled here, nothing on disk); the 4 MB answer is fetched from the real server.
await page.route(`${origin}/net8-blank`, (route) => route.fulfill({status: 200, contentType: "text/html", body: "<!doctype html><meta charset=utf-8><title>net8</title><body></body>"}));
await page.goto(`${origin}/net8-blank`, {waitUntil: "load"});
await page.addScriptTag({content: code});
const result = await page.evaluate(async ({file, rounds}) => {
    const {decodeArkSnapshot, decodeArkFounders, arkSeenStates, arkSeenStatesToPin} = globalThis.__net8;
    const hash = (value) => {
        let h = 0x811c9dc5;
        for (let i = 0; i < value.length; i++) {
            h ^= value.charCodeAt(i);
            h = Math.imul(h, 0x01000193);
        }
        return h >>> 0;
    };
    const signature = (s) => `${s.animals.length}:${hash(s.animals.map((a) => a.id).sort().join(","))}:${hash((s.nests ?? []).map((n) => JSON.stringify(n)).sort().join("|"))}`;
    const seen = (read) => {
        const lone = new Set(read.animals.filter((a) => a.lone === true).map((a) => a.id));
        const aboardC = new Map(read.animals.map((a) => [a.id, a]));
        const list = arkSeenStates(read);
        const states = new Map(list.map((s) => [s.id, s]));
        const aboard = new Map(read.animals.map((a) => [a.id, a]));
        const ids = new Set();
        for (const s of arkSeenStatesToPin(list, 40)) {
            ids.add(s.id);
            if (s.target && aboard.has(s.target)) ids.add(s.target);
        }
        return lone.size + aboardC.size + states.size + Array.from(ids).filter((id) => aboard.has(id)).sort().join(",").length;
    };
    // Heartbeat: a MessageChannel ping-pong; the longest gap between beats while json() runs is the stall.
    const beat = () => {
        const channel = new MessageChannel();
        let last = performance.now();
        let worst = 0;
        let on = true;
        channel.port1.onmessage = () => {
            const now = performance.now();
            worst = Math.max(worst, now - last);
            last = now;
            if (on) channel.port2.postMessage(0);
        };
        channel.port2.postMessage(0);
        return () => {
            on = false;
            return worst;
        };
    };
    const rows = [];
    let current = null;
    for (let i = 0; i < rounds; i++) {
        const response = await fetch(file, {cache: "no-store"});
        const blob = await response.clone().arrayBuffer(); // the body is in before json() is timed
        await new Promise((r) => setTimeout(r, 30));
        const stop = beat();
        const t0 = performance.now();
        const body = await response.json();
        const t1 = performance.now();
        const gap = stop();
        await new Promise((r) => setTimeout(r, 30));
        const p0 = performance.now();
        const again = JSON.parse(new TextDecoder().decode(blob));
        const p1 = performance.now();
        const next = decodeArkSnapshot(body.snapshot);
        const p2 = performance.now();
        const live = signature(next).length + seen(next);
        const p3 = performance.now();
        const named = decodeArkFounders(body.founders);
        current = current && JSON.stringify(current) === JSON.stringify(named) ? current : named;
        const p4 = performance.now();
        rows.push({jsonAwait: t1 - t0, gap, parse: p1 - p0, decode: p2 - p1, live: p3 - p2, found: p4 - p3, animals: next.animals.length, keys: Object.keys(again).length + (live > 0 ? 0 : 1)});
        await new Promise((r) => setTimeout(r, 200));
    }
    return {ua: navigator.userAgent, rows};
}, {file, rounds});
await browser.close();
const median = (list) => [...list].sort((a, b) => a - b)[Math.floor(list.length / 2)];
const keys = ["jsonAwait", "gap", "parse", "decode", "live", "found"];
const steady = result.rows.slice(2);
const summary = Object.fromEntries(keys.map((k) => [k, {median: +median(steady.map((r) => r[k])).toFixed(1), min: +Math.min(...result.rows.map((r) => r[k])).toFixed(1), max: +Math.max(...result.rows.map((r) => r[k])).toFixed(1), first: +result.rows[0][k].toFixed(1)}]));
const sameEtagPath = median(steady.map((r) => r.gap + r.decode + r.live + r.found));
console.log(result.ua);
for (const k of keys) console.log(`${k.padEnd(9)} median ${summary[k].median} ms (first ${summary[k].first}, min ${summary[k].min}, max ${summary[k].max})`);
console.log(`same-ETag path on the main thread (json stall + decode + live + founders), median ${sameEtagPath.toFixed(1)} ms; animals ${result.rows[0].animals}`);
writeFileSync(path.join(out, "browser-bench.json"), JSON.stringify({origin, file, rounds, summary, sameEtagPath, rows: result.rows, ua: result.ua}, null, 1));
