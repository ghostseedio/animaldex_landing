#!/usr/bin/env node
/**
 * The stalking cue (`arkStalkCue`, `src/lib/ark-eat-soon.ts`): pictures of a real hunter, unselected, with the camera
 * aimed at it (no selection: a selected animal shows its own ring, not the cue), every `--every` s for `--minutes`, each
 * with what the scene's `__arkDebug.stalkers()` says (a development bundle: `node scripts/build-ark-bundle.mjs --dev`).
 * The data are the live public reads, as `ark-eat-soon-shots.mjs`; nothing is laid over them.
 *
 *   node scripts/ark-stalk-cue-shots.mjs --out <dir> --hunter-id <id> [--minutes 10] [--every 15] [--least <chance>]
 *
 * `--least`: the development hook `__arkStalkCueLeast`, a lower cue threshold for a picture of the ring when no live
 * hunter is at the cue's 40% now (the odds and the hunting stay the engine's; only where the ring starts moves).
 */

import {createServer} from "node:http";
import {existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync} from "node:fs";
import os from "node:os";
import path from "node:path";
import {createRequire} from "node:module";
import {fileURLToPath} from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const arg = (name, fallback) => {
    const at = process.argv.indexOf(`--${name}`);
    return at > 0 && process.argv[at + 1] ? process.argv[at + 1] : fallback;
};
const out = path.resolve(arg("out", path.join(root, ".ark-golden", "eat-soon-shots")));
mkdirSync(out, {recursive: true});
const site = arg("site", "https://animaldex.app");
const cardKeys = (lang) => {
    const file = lang === "en" || lang === "id" ? path.join(root, "src/data/locales", `${lang}.json`) : path.join(root, "src/data/locales/ark", `${lang}.json`);
    if (!existsSync(file)) return {};
    const card = JSON.parse(readFileSync(file, "utf8")).ark.card;
    return Object.fromEntries(Object.entries(card).filter(([k]) => k.startsWith("eatSoon")));
};

const cache = new Map();
async function live(url) {
    if (!cache.has(url)) cache.set(url, fetch(`${site}${url}`, {headers: {"User-Agent": "ark-shots"}}).then(async (r) => ({status: r.status, type: r.headers.get("content-type") ?? "application/json", body: Buffer.from(await r.arrayBuffer())})));
    return cache.get(url);
}

const used = [];
const server = createServer(async (request, response) => {
    const url = new URL(request.url, "http://localhost");
    try {
        if (url.pathname.startsWith("/api/")) {
            const answer = await live(url.pathname + url.search);
            let body = answer.body;
            if (url.pathname === "/api/ark/words" && answer.status === 200) {
                const words = JSON.parse(body.toString("utf8"));
                if (words.ark?.card) Object.assign(words.ark.card, cardKeys(url.searchParams.get("lang") || "en"));
                body = Buffer.from(JSON.stringify(words));
            }
            response.writeHead(answer.status, {"Content-Type": answer.type, "Cache-Control": "no-store"}).end(body);
            return;
        }
        const folder = path.join(root, "public");
        const file = path.join(folder, path.normalize(url.pathname).replace(/^\/+/, ""));
        if (!file.startsWith(folder) || !existsSync(file)) return void response.writeHead(404).end();
        const ext = path.extname(file);
        const type = {".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".webp": "image/webp", ".png": "image/png", ".glb": "model/gltf-binary", ".ktx2": "image/ktx2", ".jpg": "image/jpeg", ".wasm": "application/wasm"}[ext] ?? "application/octet-stream";
        response.writeHead(200, {"Content-Type": type, "Cache-Control": "no-store"}).end(readFileSync(file));
    } catch (error) {
        response.writeHead(502).end(String(error));
    }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}`;

const hunterId = arg("hunter-id", null);
if (!hunterId) throw new Error("--hunter-id");
const minutes = Number(arg("minutes", "10"));
const every = Number(arg("every", "15"));
const {chromium} = createRequire(path.join(root, "node_modules", "x.js"))("playwright-core");
let browser;
try {
    browser = await chromium.launch({channel: "chrome", headless: true, args: ["--use-angle=metal", "--ignore-gpu-blocklist"]});
} catch {
    const dir = path.join(os.homedir(), "Library", "Caches", "ms-playwright");
    const chromiumDir = readdirSync(dir).filter((d) => /^chromium-\d+$/.test(d)).sort().reverse()[0];
    browser = await chromium.launch({executablePath: path.join(dir, chromiumDir, "chrome-mac-arm64", "Google Chrome for Testing.app", "Contents", "MacOS", "Google Chrome for Testing"), headless: true, args: ["--use-angle=metal", "--ignore-gpu-blocklist"]});
}
const log = [];
try {
    await live("/api/ark/words?lang=en");
    const page = await browser.newPage({viewport: {width: 1280, height: 800}, deviceScaleFactor: 1});
    // (The ring is off by default, `arkStalkCueOn`: on for this picture.)
    await page.addInitScript(() => (globalThis.__arkStalkCue = true));
    const least = arg("least", null);
    if (least !== null) await page.addInitScript((v) => (globalThis.__arkStalkCueLeast = v), Number(least));
    page.on("pageerror", (e) => console.log("pageerror", String(e).slice(0, 200)));
    await page.goto(`${base}/ark/embed.html?lang=en`);
    await page.waitForFunction(() => document.querySelector("canvas") && document.getElementById("ark-loader")?.style.display === "none", null, {timeout: 300000}).catch(() => null);
    // (Its island first: a selection flies there and brings its scene in; then the selection let go, so the cue is the
    // unselected hunter's, and the camera aimed by hand below.)
    await page.evaluate((id) => window.postMessage({type: "ark:select", id, closeUp: true}, "*"), hunterId);
    await page.waitForTimeout(15000);
    await page.evaluate(() => window.postMessage({type: "ark:select", id: null}, "*"));
    await page.waitForTimeout(3000);
    // (The world built and its animals placed before the camera is aimed: up to a minute more.)
    await page.waitForFunction((id) => Boolean(window.__arkDebug?.entries?.().some((e) => e.animal.id === id) || Object.keys(window.__arkDebug?.stalkers?.() ?? {}).length), hunterId, {timeout: 60000}).catch(() => null);
    await page.waitForTimeout(5000);
    const t0 = Date.now();
    for (let i = 0; Date.now() - t0 < minutes * 60000; i++) {
        const state = await page.evaluate((id) => {
            const d = window.__arkDebug;
            const all = d?.entries?.() ?? [];
            const cuedNow = d?.stalkers?.() ?? {};
            // (The hunter asked for; else the first the scene cues now, any of the drawn ones.)
            const e = all.find((x) => x.animal.id === id) ?? all.find((x) => x.animal.id in cuedNow);
            if (!d || !e) return {drawn: false, entries: all.length, stalkers: cuedNow};
            // The camera aimed at it from 9 m, a little above (the controls' own target and position; nothing selected);
            // where it is drawn, else its place (it is drawn once the camera is near, and aimed at again next time).
            const at = e.middle ?? {x: e.place.x, y: e.place.ground ?? 0, z: e.place.z};
            d.controls.target.set(at.x, at.y, at.z);
            d.camera.position.set(at.x + 6, at.y + 5, at.z + 6);
            d.controls.update();
            return {drawn: Boolean(e.middle), id: e.animal.id, name: e.animal.name, doing: e.sched?.pose?.doing ?? null, stalkers: d.stalkers()};
        }, hunterId);
        await page.waitForTimeout(800);
        const file = path.join(out, `cue-${String(i).padStart(3, "0")}.png`);
        await page.screenshot({path: file});
        const who = state.id ?? hunterId;
        const cued = Boolean(state.stalkers && who in state.stalkers);
        log.push({i, t: Math.round((Date.now() - t0) / 1000), file, ...state, cued});
        console.log(i, JSON.stringify({drawn: state.drawn, name: state.name ?? null, entries: state.entries, doing: state.doing, cued, chance: state.stalkers?.[who] ?? null, cuedNow: Object.keys(state.stalkers ?? {}).length}));
        await page.waitForTimeout(Math.max(every * 1000 - 800, 0));
    }
    await page.close();
} finally {
    await browser.close();
    server.close();
}
writeFileSync(path.join(out, "cue.json"), JSON.stringify({site, hunterId, log}, null, 1));
