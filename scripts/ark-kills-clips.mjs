#!/usr/bin/env node
/**
 * The kills harness (lane ark-kills-real): builds `src/ark-scene/kills-entry.ts` into `.ark-golden/kills/` (gitignored),
 * serves it on localhost with the scene's art, and drives Chrome (playwright-core, channel "chrome"; the cached
 * Chromium when Chrome is missing) through a made-up server meal per pair, on the page's controlled clock: frames at the
 * meal's moments (the chase, the catch, the feeding bouts, the swallow, the drink, the rest, the scavengers, the traces)
 * and a contact strip per pair, each frame labelled with what the card and the marker say.
 *
 *   node scripts/ark-kills-clips.mjs --out <dir> [--pairs lion,heron,hawk,python] [--width 1280 --height 720]
 */
import {execFileSync} from "node:child_process";
import {createServer} from "node:http";
import {existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync} from "node:fs";
import os from "node:os";
import path from "node:path";
import {createRequire} from "node:module";
import {fileURLToPath} from "node:url";
import {build} from "esbuild";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const arg = (name, fallback) => {
    const at = process.argv.indexOf(`--${name}`);
    return at > 0 && process.argv[at + 1] && !process.argv[at + 1].startsWith("--") ? process.argv[at + 1] : fallback;
};
const out = path.resolve(arg("out", path.join(root, ".ark-golden", "kills-shots")));
const pairs = arg("pairs", "lion,heron,hawk,python").split(",");
const width = Number(arg("width", "1280"));
const height = Number(arg("height", "720"));
mkdirSync(out, {recursive: true});

const site = path.join(root, ".ark-golden", "kills");
mkdirSync(site, {recursive: true});
await build({
    entryPoints: [path.join(root, "src/ark-scene/kills-entry.ts")],
    outfile: path.join(site, "kills-scene.js"),
    bundle: true,
    format: "iife",
    platform: "browser",
    target: ["es2020"],
    minify: true,
    tsconfig: path.join(root, "tsconfig.json"),
    define: {"process.env.NODE_ENV": JSON.stringify("development")},
    logLevel: "warning"
});
writeFileSync(path.join(site, "kills.html"), `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Ark kills</title>
<style>html,body{margin:0;height:100%;background:#0b1020;overflow:hidden}#ark{position:fixed;inset:0}#note{position:fixed;left:10px;top:8px;z-index:9;font:600 13px/1.35 ui-sans-serif,system-ui;color:#fff;text-shadow:0 1px 3px #000;white-space:pre}</style>
</head><body><div id="ark"></div><div id="note"></div><script src="./kills-scene.js"></script></body></html>`);
const server = createServer((request, response) => {
    const url = new URL(request.url, "http://localhost");
    const fromPublic = url.pathname.startsWith("/ark/");
    const folder = fromPublic ? path.join(root, "public") : site;
    const file = path.join(folder, path.normalize(url.pathname).replace(/^\/+/, "") || "kills.html");
    if (!file.startsWith(folder) || !existsSync(file)) {
        response.writeHead(404).end();
        return;
    }
    const type = file.endsWith(".html") ? "text/html" : file.endsWith(".js") ? "text/javascript" : file.endsWith(".webp") ? "image/webp" : file.endsWith(".json") ? "application/json" : "application/octet-stream";
    response.writeHead(200, {"Content-Type": type, "Cache-Control": "no-store"}).end(readFileSync(file));
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}/kills.html`;

const {chromium} = createRequire(path.join(root, "node_modules", "x.js"))("playwright-core");
let browser;
try {
    browser = await chromium.launch({channel: "chrome", headless: true, args: ["--use-angle=metal", "--ignore-gpu-blocklist"]});
} catch {
    const cache = path.join(os.homedir(), "Library", "Caches", "ms-playwright");
    const dir = readdirSync(cache).filter((d) => /^chromium-\d+$/.test(d)).sort().reverse()[0];
    browser = await chromium.launch({executablePath: path.join(cache, dir, "chrome-mac-arm64", "Google Chrome for Testing.app", "Contents", "MacOS", "Google Chrome for Testing"), headless: true, args: ["--use-angle=metal", "--ignore-gpu-blocklist"]});
}

/** How close each pair is framed (m). */
const DISTANCE = {lion: 7.5, heron: 5, hawk: 4, python: 2.6, fox: 2.8, "fox-cache": 2.8};
const summary = {};
for (const pair of pairs) {
    const context = await browser.newContext({viewport: {width, height}});
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
        if (m.type() === "error") errors.push(m.text().slice(0, 300));
        if (m.text().startsWith("[kills]")) console.log(pair, m.text().slice(0, 600));
    });
    // (fox-cache: the fox pair with its catch cached (SIG-EVENTS food_cache); the fox pairs with the behaviour flows on.)
    await page.goto(`${base}?pair=${pair.replace("-cache", "")}${pair === "fox-cache" ? "&cache=1" : ""}${pair.startsWith("fox") ? "&flows=1" : ""}&quality=high${process.argv.includes("--where") ? "&where=1" : ""}${pair === "python" ? "&jaw=1" : ""}`, {waitUntil: "domcontentloaded", timeout: 120000});
    page.on("pageerror", (e) => console.log(pair, "page error:", e.message.slice(0, 300)));
    try {
        await page.waitForFunction(() => window.__kills, null, {timeout: 300000});
    } catch (error) {
        console.log(pair, "no harness:", error.message.split("\n")[0], errors.slice(0, 5));
        await context.close();
        continue;
    }
    let [info] = await page.evaluate(() => window.__kills.info());
    // (The live meal starts a moment after the event's step now: until then it is not built. Run the world on to it.)
    for (let k = 0; k < 6 && info && !info.plan; k++) {
        await page.evaluate((s) => window.__kills.shot(s, 6), 20 * (k + 1));
        [info] = await page.evaluate(() => window.__kills.info());
    }
    if (info?.plan) {
        // (Times relative to the harness's own clock: the meal's start and its catch.)
        const lead = info.t0 - Number(info.key.split("@")[1]);
        const shift = (v) => v + lead;
        info = {...info, catchAt: shift(info.catchAt), feedTo: shift(info.feedTo), rest: info.rest.map(shift), carcassEnd: shift(info.carcassEnd), drink: info.drink?.map(shift) ?? null, cache: info.cache?.map(shift) ?? null, visits: info.visits.map((v) => ({...v, start: shift(v.start), arrive: shift(v.arrive), leave: shift(v.leave)}))};
    }
    console.log(pair, JSON.stringify({...info, plan: info?.plan ? {style: info.plan.style, feedSeconds: +info.plan.feedSeconds.toFixed(1), naturalMinutes: +info.plan.naturalMinutes.toFixed(1), restSeconds: +info.plan.restSeconds.toFixed(0), drinkSeconds: info.plan.drinkSeconds, trace: info.plan.trace, scavengers: info.plan.scavengers} : null}));
    const c = info.catchAt;
    const f = info.feedTo - c;
    const shots = [
        [0.3, "the hunter at its waypoint (the chase begins)"],
        [c * 0.5, "the chase"],
        [Math.max(c - 0.15, 0), "the catch"],
        [c + 0.6, "down: lying on its side (no fade)"],
        [c + 2, "the meal begins"],
        ...(info.cache ? [[(c + info.cache[0]) / 2, "picking up its catch"], [(info.cache[0] + info.cache[1]) / 2, "carrying it off in its mouth"], [(info.cache[1] + info.cache[2]) / 2, "digging the cache"], [(info.cache[2] + info.cache[3]) / 2, "covering it over"]] : [0.15, 0.3, 0.45, 0.6, 0.75, 0.9].map((k) => [c + f * k, `the meal ${Math.round(k * 100)}%`])),
        [info.feedTo + 0.5, "the meal over"],
        ...(info.drink ? [[(info.drink[0] + info.drink[1]) / 2, "a drink at the water"]] : []),
        [info.rest[0] + 3, "resting nearby"],
        ...info.visits.flatMap((v) => [[(v.start + v.arrive) / 2, `a scavenger on its way (${v.id.slice(-2)})`], [v.arrive + 4, `a scavenger feeding (${v.id.slice(-2)})`]]),
        [info.carcassEnd + 1, "the carcass left: fading"],
        [info.carcassEnd + 4, "gone: the trace"],
        [info.carcassEnd + 900, "the trace later (15 min)"]
    ].sort((a, b) => a[0] - b[0]);
    const dir = path.join(out, pair);
    rmSync(dir, {recursive: true, force: true});
    mkdirSync(dir, {recursive: true});
    const labels = [];
    for (let i = 0; i < shots.length; i++) {
        const [s, label] = shots[i];
        const follow = /water|resting|on its way|chase|waypoint|carrying|digging|covering/.test(label) ? (label.includes("scavenger") ? info.visits.find((v) => label.includes(v.id.slice(-2)))?.id : "0000feed-0000-4000-8000-000000000000") : undefined;
        const note = await page.evaluate(async ([s, d, follow, label]) => {
            const text = await window.__kills.shot(s, d, follow);
            document.getElementById("note").textContent = `${label}\n${text}`;
            return text;
        }, [s, follow ? DISTANCE[pair] * 1.6 : DISTANCE[pair], follow, label]);
        labels.push(`${String(i).padStart(2, "0")} ${label}: ${note.replace(/\n/g, " | ")}`);
        await page.screenshot({path: path.join(dir, `${String(i).padStart(2, "0")}.jpg`), type: "jpeg", quality: 85});
    }
    writeFileSync(path.join(dir, "labels.txt"), labels.join("\n") + "\n");
    const n = shots.length;
    const cols = 4;
    const rows = Math.ceil(n / cols);
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", "1", "-i", path.join(dir, "%02d.jpg"), "-vf", `scale=480:-1,tile=${cols}x${rows}:padding=4:color=black`, "-frames:v", "1", path.join(out, `${pair}-strip.jpg`)]);
    summary[pair] = {info, errors: errors.slice(0, 10), shots: labels};
    if (errors.length) console.log(pair, "errors:", errors.slice(0, 5));
    await context.close();
}
writeFileSync(path.join(out, "summary.json"), JSON.stringify(summary, null, 1));
await browser.close();
server.close();
