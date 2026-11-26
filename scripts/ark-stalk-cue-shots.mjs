#!/usr/bin/env node
/**
 * The stalking cue (`arkStalkCue`, `src/lib/ark-eat-soon.ts`): pictures of a real hunter, unselected, with the camera
 * aimed at it (no selection: a selected animal shows its own ring, not the cue), every `--every` s for `--minutes`, each
 * with what the scene's `__arkDebug.stalkers()` says (a development bundle: `node scripts/build-ark-bundle.mjs --dev`).
 * The data are the live public reads, as `ark-eat-soon-shots.mjs`; nothing is laid over them.
 *
 *   node scripts/ark-stalk-cue-shots.mjs --out <dir> --hunter-id <id> [--minutes 10] [--every 15]
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
    page.on("pageerror", (e) => console.log("pageerror", String(e).slice(0, 200)));
    await page.goto(`${base}/ark/embed.html?lang=en`);
    await page.waitForFunction(() => document.querySelector("canvas") && document.getElementById("ark-loader")?.style.display === "none", null, {timeout: 300000}).catch(() => null);
    await page.waitForTimeout(5000);
    const t0 = Date.now();
    for (let i = 0; Date.now() - t0 < minutes * 60000; i++) {
        const state = await page.evaluate((id) => {
            const d = window.__arkDebug;
            const e = d?.entries?.().find((x) => x.animal.id === id);
            if (!d || !e?.middle) return {drawn: false, stalkers: d?.stalkers?.() ?? null};
            // The camera aimed at it from 9 m, a little above (the controls' own target and position; nothing selected).
            d.controls.target.set(e.middle.x, e.middle.y, e.middle.z);
            d.camera.position.set(e.middle.x + 6, e.middle.y + 5, e.middle.z + 6);
            d.controls.update();
            return {drawn: true, doing: e.sched?.pose?.doing ?? null, stalkers: d.stalkers()};
        }, hunterId);
        await page.waitForTimeout(800);
        const file = path.join(out, `cue-${String(i).padStart(3, "0")}.png`);
        await page.screenshot({path: file});
        const cued = Boolean(state.stalkers && hunterId in state.stalkers);
        log.push({i, t: Math.round((Date.now() - t0) / 1000), file, ...state, cued});
        console.log(i, JSON.stringify({drawn: state.drawn, doing: state.doing, cued, chance: state.stalkers?.[hunterId] ?? null}));
        await page.waitForTimeout(Math.max(every * 1000 - 800, 0));
    }
    await page.close();
} finally {
    await browser.close();
    server.close();
}
writeFileSync(path.join(out, "cue.json"), JSON.stringify({site, hunterId, log}, null, 1));
