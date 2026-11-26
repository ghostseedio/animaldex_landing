#!/usr/bin/env node
/**
 * WATCH (`src/lib/ark-watch.ts`, the camera director): a short capture of the real embed (`public/ark/embed.html?watch=1`,
 * a development bundle so the scene's `__arkDebug.watch()` can be read: `node scripts/build-ark-bundle.mjs --dev`) on the
 * live public reads (`/api/ark/*` from the site, read only), one frame every `--every` seconds for `--seconds`, each
 * with the director's shot at that moment (who, what kind, since when) and what it could cut to. Then, with `--touch`,
 * a pointer press on the view, and a check that it stopped.
 *
 *   node scripts/ark-watch-shots.mjs --out <dir> [--seconds 120] [--every 3] [--site https://animaldex.app]
 *       [--width 1280 --height 800] [--touch]
 *
 * Writes frame-NNN.png, frames.json; the strip (a contact sheet) and the video are made from them by the caller.
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
const out = path.resolve(arg("out", path.join(root, ".ark-golden", "watch-shots")));
mkdirSync(out, {recursive: true});
const site = arg("site", "https://animaldex.app");
const seconds = Number(arg("seconds", "120"));
const every = Number(arg("every", "3"));
const viewport = {width: Number(arg("width", "1280")), height: Number(arg("height", "800"))};

const cache = new Map();
async function live(url) {
    if (!cache.has(url)) cache.set(url, fetch(`${site}${url}`, {headers: {"User-Agent": "ark-shots"}}).then(async (r) => ({status: r.status, type: r.headers.get("content-type") ?? "application/json", body: Buffer.from(await r.arrayBuffer())})));
    return cache.get(url);
}
const server = createServer(async (request, response) => {
    const url = new URL(request.url, "http://localhost");
    try {
        if (url.pathname.startsWith("/api/")) {
            // (The reads the page asks again, the hunting and the events, fresh each time: the live world moves on.)
            if (/\/api\/ark\/(hunting|events|voyage)/.test(url.pathname)) cache.delete(url.pathname + url.search);
            const answer = await live(url.pathname + url.search);
            response.writeHead(answer.status, {"Content-Type": answer.type, "Cache-Control": "no-store"}).end(answer.body);
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

const {chromium} = createRequire(path.join(root, "node_modules", "x.js"))("playwright-core");
let browser;
try {
    browser = await chromium.launch({channel: "chrome", headless: true, args: ["--use-angle=metal", "--ignore-gpu-blocklist"]});
} catch {
    const dir = path.join(os.homedir(), "Library", "Caches", "ms-playwright");
    const chromiumDir = readdirSync(dir).filter((d) => /^chromium-\d+$/.test(d)).sort().reverse()[0];
    browser = await chromium.launch({executablePath: path.join(dir, chromiumDir, "chrome-mac-arm64", "Google Chrome for Testing.app", "Contents", "MacOS", "Google Chrome for Testing"), headless: true, args: ["--use-angle=metal", "--ignore-gpu-blocklist"]});
}
const frames = [];
try {
    await live("/api/ark/words?lang=en");
    const page = await browser.newPage({viewport, deviceScaleFactor: 1});
    page.on("pageerror", (e) => console.log("pageerror", String(e).slice(0, 200), String(e.stack ?? "").split("\n").slice(1, 4).join(" | ").slice(0, 400)));
    await page.goto(`${base}/ark/embed.html?watch=1&lang=en`);
    await page.waitForFunction(() => document.querySelector("canvas") && document.getElementById("ark-loader")?.style.display === "none", null, {timeout: 300000}).catch(() => null);
    const t0 = Date.now();
    for (let i = 0; i * every <= seconds; i++) {
        const wait = t0 + i * every * 1000 - Date.now();
        if (wait > 0) await page.waitForTimeout(wait);
        const state = await page.evaluate(() => {
            const d = window.__arkDebug;
            const w = d?.watch?.() ?? null;
            const name = (id) => d?.entries?.().find((e) => e.animal.id === id)?.animal.name ?? null;
            return w ? {on: w.on, cost: w.cost, shot: w.shot ? {...w.shot, name: name(w.shot.id)} : null, candidates: w.candidates.map((c) => ({kind: c.kind, weight: Math.round(c.weight * 100) / 100, name: name(c.id)}))} : null;
        });
        const file = path.join(out, `frame-${String(i).padStart(3, "0")}.png`);
        await page.screenshot({path: file});
        frames.push({i, t: Math.round((Date.now() - t0) / 100) / 10, file, ...state});
        console.log(i, JSON.stringify(state?.shot ?? null), state?.candidates.length ?? 0);
    }
    if (process.argv.includes("--touch")) {
        await page.mouse.move(viewport.width / 2, viewport.height / 2);
        await page.mouse.down();
        await page.mouse.move(viewport.width / 2 + 40, viewport.height / 2, {steps: 4});
        await page.mouse.up();
        await page.waitForTimeout(1500);
        const after = await page.evaluate(() => window.__arkDebug?.watch?.().on ?? null);
        frames.push({touch: true, on: after});
        console.log("after a touch, watching:", after);
    }
    await page.close();
} finally {
    await browser.close();
    server.close();
}
writeFileSync(path.join(out, "frames.json"), JSON.stringify({site, seconds, every, viewport, frames}, null, 1));
