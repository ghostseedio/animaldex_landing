#!/usr/bin/env node
/**
 * "See it in the Ark" on the apps' embed (owner, 2026-11-17): the host's `ark:select {id, closeUp, follow, arrival}` as the
 * capture's button sends it, recorded as a Playwright video (390x844, a phone's shape). Development only: a development
 * bundle (`node scripts/build-ark-bundle.mjs --dev`) and a local copy of the real public Ark under public/ark-local/
 * (gitignored; `curl https://animaldex.app/api/ark/voyage -o public/ark-local/live.json`).
 *
 *   node scripts/ark-see-it-clip.mjs --animal <animal id> [--out <dir>] [--seconds 40] [--mode arrival|follow|plain]
 *
 * Writes <out>/see-it-<mode>.mp4 (from just before the select on: the page's own screencast frames, timed as they came,
 * put together by ffmpeg) and stills, and prints what the scene reported (selected, followed, the host's messages).
 * Run it through `bash ~/AnimalDex-work/heavy.sh`: the scene is heavy.
 */
import {createReadStream, existsSync, mkdirSync, statSync, writeFileSync} from "node:fs";
import {createServer} from "node:http";
import {spawnSync} from "node:child_process";
import os from "node:os";
import path from "node:path";
import {fileURLToPath} from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const arg = (name, fallback) => {
    const at = process.argv.indexOf(`--${name}`);
    return at >= 0 && process.argv[at + 1] ? process.argv[at + 1] : fallback;
};
const animalId = arg("animal", "");
const out = path.resolve(arg("out", path.join(os.tmpdir(), "ark-see-it")));
const seconds = Number(arg("seconds", "40"));
const mode = arg("mode", "arrival");
const snapshotPath = arg("snapshot", "/ark-local/live.json");
if (!animalId) {
    console.error("--animal <animal id> is needed");
    process.exit(2);
}
mkdirSync(out, {recursive: true});

const TYPES = {".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".wasm": "application/wasm", ".webp": "image/webp", ".png": "image/png", ".glb": "model/gltf-binary", ".bin": "application/octet-stream", ".m4a": "audio/mp4", ".webm": "audio/webm", ".hdr": "application/octet-stream", ".ktx2": "image/ktx2", ".map": "application/json", ".css": "text/css"};
const publicDir = path.join(root, "public");
const server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    const file = path.join(publicDir, decodeURIComponent(url.pathname));
    if (!file.startsWith(publicDir) || !existsSync(file) || !statSync(file).isFile()) {
        response.writeHead(404).end();
        return;
    }
    response.writeHead(200, {"content-type": TYPES[path.extname(file)] ?? "application/octet-stream", "cache-control": "no-cache"});
    createReadStream(file).pipe(response);
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}`;

const {chromium} = await import("playwright-core");
const browser = await chromium.launch({channel: "chrome", headless: true, args: ["--headless=new", "--enable-gpu", "--ignore-gpu-blocklist", "--use-angle=metal"]});
const context = await browser.newContext({
    viewport: {width: 390, height: 844},
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true
});
const startedAt = Date.now();
const page = await context.newPage();
const errors = [];
const told = [];
// The page's own screencast (CDP): every frame the compositor makes, with its time, kept as it comes.
const frames = [];
const cast = await context.newCDPSession(page);
cast.on("Page.screencastFrame", (frame) => {
    frames.push({at: frame.metadata.timestamp, data: Buffer.from(frame.data, "base64")});
    cast.send("Page.screencastFrameAck", {sessionId: frame.sessionId}).catch(() => undefined);
});
let casting = false;
page.on("pageerror", (error) => errors.push(error.message));
await page.exposeFunction("__toldHost", (message) => told.push({at: Date.now() - startedAt, type: message.type, id: message.animal?.id}));
// (The Android bridge, as the app's WebView has it: the page tells the host through it.)
await page.addInitScript("window.AndroidArk = {postMessage: function (text) { window.__toldHost(JSON.parse(text)); }};");
await page.goto(`${base}/ark/embed.html?snapshot=${snapshotPath}&hud=0&lang=en`, {waitUntil: "domcontentloaded"});
await page.waitForFunction(() => Boolean(window.AnimalDexArkHost), null, {timeout: 120_000});
const send = (message) => page.evaluate((x) => window.AnimalDexArkHost.send(x), message);
// The scene up (the wild island at least) and its first frames drawn: the apps send their selection when the page says ready.
await page.waitForFunction(() => Boolean(window.__arkScene), null, {timeout: 600_000});
await page.evaluate(() => window.__arkScene.mounted());
await page.waitForTimeout(6000);
const selectAt = Date.now() - startedAt;
await cast.send("Page.startScreencast", {format: "jpeg", quality: 88, maxWidth: 780, maxHeight: 1688, everyNthFrame: 1});
casting = true;
await page.waitForTimeout(1500);
const message = {type: "ark:select", id: animalId, closeUp: true, ...(mode === "arrival" ? {follow: true, arrival: true} : mode === "follow" ? {follow: true} : {})};
await send(message);
const stills = [];
const stillCount = 8;
for (let i = 0; i < stillCount; i++) {
    await page.waitForTimeout((seconds * 1000) / stillCount);
    const file = path.join(out, `still-${mode}-${i}.png`);
    await page.screenshot({path: file});
    stills.push(file);
}
const selection = await page.evaluate(() => window.__arkScene.selection?.() ?? null);
if (casting) await cast.send("Page.stopScreencast").catch(() => undefined);
await context.close();
await browser.close();
server.close();

// The frames as a video: each shown until the next one came (ffmpeg's concat list), then at a steady 30 fps.
let mp4 = null;
if (frames.length > 2) {
    const dir = path.join(out, `frames-${mode}`);
    mkdirSync(dir, {recursive: true});
    const list = [];
    frames.forEach((frame, i) => {
        const file = path.join(dir, `f${String(i).padStart(5, "0")}.jpg`);
        writeFileSync(file, frame.data);
        const next = frames[i + 1];
        list.push(`file '${file}'`, `duration ${next ? Math.max(next.at - frame.at, 0.001).toFixed(4) : "0.5"}`);
    });
    list.push(`file '${path.join(dir, `f${String(frames.length - 1).padStart(5, "0")}.jpg`)}'`);
    writeFileSync(path.join(dir, "list.txt"), list.join("\n"));
    mp4 = path.join(out, `see-it-${mode}.mp4`);
    const made = spawnSync("ffmpeg", ["-y", "-f", "concat", "-safe", "0", "-i", path.join(dir, "list.txt"), "-vf", "fps=30,format=yuv420p", "-c:v", "libx264", "-crf", "23", "-an", mp4], {stdio: "ignore"});
    if (made.status !== 0) mp4 = null;
}
console.log(JSON.stringify({mp4, frames: frames.length, selectAt, selection, errors, told: told.filter((m) => m.type === "ark:selected" || m.type === "ark:ready").slice(0, 6), stills: stills.length}));
