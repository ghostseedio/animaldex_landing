#!/usr/bin/env node
/**
 * The rig player's scene recordings (flight, grazing, head look). Builds
 * `src/ark-scene/rig-scenes-entry.ts` into `.ark-golden/rig/` (gitignored),
 * serves it on localhost with the scene's art and a local rig set, and
 * drives Playwright's cached Chromium (playwright-core, an existing dev
 * dependency) through each scene: a video (mp4, from the DevTools screencast
 * and the system's ffmpeg), key frames (png) and every cast animal's rig and
 * head look sampled every 100 ms (json). With --perf, frame intervals and
 * draw counts per tier on the desktop and the phone proxy.
 *
 *   node scripts/ark-rig-scenes.mjs --set <publish dir> --out <dir> [--scenes a,b] [--seconds 22] [--perf] [--device desktop|phone]
 *
 * `--set` is a local rig set's folder (publish_rig.py's output: manifest.json, <slug>/<v>.rig.glb), served as
 * /ark-rig/v2; every species it does not list falls back to the live v1 set beside the live model set (read only).
 * Nothing is uploaded.
 */

import {execFileSync} from "node:child_process";
import {createServer} from "node:http";
import {existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync} from "node:fs";
import os from "node:os";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {build} from "esbuild";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const arg = (name, fallback) => {
    const at = process.argv.indexOf(`--${name}`);
    return at > 0 && process.argv[at + 1] && !process.argv[at + 1].startsWith("--") ? process.argv[at + 1] : fallback;
};
const flag = (name) => process.argv.includes(`--${name}`);
const out = path.resolve(arg("out", path.join(root, ".ark-golden", "rig-shots")));
const set = arg("set", null) ? path.resolve(arg("set")) : null;
const seconds = Number(arg("seconds", "22"));
const deviceName = arg("device", "desktop");
mkdirSync(out, {recursive: true});

const site = path.join(root, ".ark-golden", "rig");
mkdirSync(site, {recursive: true});
await build({
    entryPoints: [path.join(root, "src/ark-scene/rig-scenes-entry.ts")],
    outfile: path.join(site, "rig-scene.js"),
    bundle: true,
    format: "iife",
    platform: "browser",
    target: ["es2020"],
    minify: true,
    tsconfig: path.join(root, "tsconfig.json"),
    define: {"process.env.NODE_ENV": JSON.stringify("development")},
    logLevel: "warning"
});
writeFileSync(path.join(site, "rig.html"), `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover">
<title>Ark rig scenes</title>
<style>html,body{margin:0;height:100%;background:#ecdcc4;overflow:hidden}#ark{position:fixed;inset:0}</style>
</head><body><div id="ark"></div><script src="./rig-scene.js"></script></body></html>
`);

const SLUG = /^[a-z0-9][a-z0-9-]{0,120}$/;
const server = createServer((request, response) => {
    const url = new URL(request.url, "http://localhost");
    const parts = url.pathname.split("/").filter(Boolean);
    let file = null;
    let type = "application/octet-stream";
    if (parts[0] === "ark-rig" && parts[1] === "v2" && set) {
        if (parts.length === 3 && parts[2] === "manifest.json") {
            file = path.join(set, "manifest.json");
            type = "application/json";
        } else if (parts.length === 4 && SLUG.test(parts[2]) && /^[0-9a-f]{12}\.rig\.glb$/.test(parts[3])) {
            file = path.join(set, parts[2], parts[3]);
            type = "model/gltf-binary";
        }
    } else {
        const fromPublic = url.pathname.startsWith("/ark/");
        const folder = fromPublic ? path.join(root, "public") : site;
        const candidate = path.join(folder, path.normalize(url.pathname).replace(/^\/+/, "") || "rig.html");
        if (candidate.startsWith(folder)) file = candidate;
        type = candidate.endsWith(".html") ? "text/html" : candidate.endsWith(".js") ? "text/javascript" : candidate.endsWith(".webp") ? "image/webp" : candidate.endsWith(".json") ? "application/json" : type;
    }
    if (!file || !existsSync(file)) {
        response.writeHead(404).end();
        return;
    }
    response.writeHead(200, {"Content-Type": type, "Cache-Control": "no-store"}).end(readFileSync(file));
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}`;

function cachedChromium() {
    const cache = path.join(os.homedir(), "Library", "Caches", "ms-playwright");
    if (!existsSync(cache)) return null;
    for (const name of readdirSync(cache).filter((entry) => /^chromium-\d+$/.test(entry)).sort().reverse()) {
        const candidate = path.join(cache, name, "chrome-mac-arm64", "Google Chrome for Testing.app", "Contents", "MacOS", "Google Chrome for Testing");
        if (existsSync(candidate)) return candidate;
    }
    return null;
}

const DEVICES = {
    desktop: {viewport: {width: 1280, height: 720}, deviceScaleFactor: 1, isMobile: false, hasTouch: false, cpuThrottle: 1},
    phone: {viewport: {width: 360, height: 800}, deviceScaleFactor: 2, isMobile: true, hasTouch: true, cpuThrottle: 4, userAgent: "Mozilla/5.0 (Linux; Android 14; SM-A356B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36"}
};

const {chromium} = await import("playwright-core");
const browser = await chromium.launch({
    executablePath: process.env.ARK_CHROMIUM || cachedChromium() || undefined,
    headless: !flag("headed"),
    args: [...(flag("headed") ? [] : ["--headless=new"]), "--enable-gpu", "--ignore-gpu-blocklist", ...(process.platform === "darwin" ? ["--use-angle=metal"] : []), "--disable-background-timer-throttling", "--disable-renderer-backgrounding"]
});
const log = (...parts) => console.log(new Date().toISOString().slice(11, 19), ...parts);

async function open(name, query) {
    const device = DEVICES[name];
    const context = await browser.newContext({viewport: device.viewport, deviceScaleFactor: device.deviceScaleFactor, isMobile: device.isMobile, hasTouch: device.hasTouch, userAgent: device.userAgent});
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(String(error)));
    page.on("console", (message) => {
        if (message.type() === "error" || /\[ark\] rig/.test(message.text())) errors.push(message.text());
    });
    const cdp = await context.newCDPSession(page);
    if (device.cpuThrottle > 1) await cdp.send("Emulation.setCPUThrottlingRate", {rate: device.cpuThrottle});
    await page.goto(`${base}/rig.html?${query}`);
    await page.waitForFunction(() => window.__arkRig || window.__arkRigError, null, {timeout: 180_000});
    const failed = await page.evaluate(() => window.__arkRigError);
    if (failed) throw new Error(failed);
    return {context, page, errors, cdp};
}

async function record(cdp, name) {
    const dir = path.join(out, `.frames-${name}`);
    rmSync(dir, {recursive: true, force: true});
    mkdirSync(dir, {recursive: true});
    let n = 0;
    let stopped = false;
    const stamps = [];
    cdp.on("Page.screencastFrame", async (frame) => {
        if (stopped) return;
        writeFileSync(path.join(dir, `f${String(n++).padStart(5, "0")}.jpg`), Buffer.from(frame.data, "base64"));
        stamps.push(frame.metadata.timestamp);
        await cdp.send("Page.screencastFrameAck", {sessionId: frame.sessionId}).catch(() => undefined);
    });
    await cdp.send("Page.startScreencast", {format: "jpeg", quality: 82, everyNthFrame: 1});
    return async (picks = []) => {
        stopped = true;
        await cdp.send("Page.stopScreencast").catch(() => undefined);
        if (n < 2) return null;
        // The frames nearest each pick's wall-clock time (the screencast's own timestamps), kept as stills.
        for (const pick of picks) {
            let best = 0;
            for (let i = 0; i < stamps.length; i++) if (Math.abs(stamps[i] - pick.epoch) < Math.abs(stamps[best] - pick.epoch)) best = i;
            const from = path.join(dir, `f${String(best).padStart(5, "0")}.jpg`);
            if (existsSync(from)) writeFileSync(path.join(out, pick.file), readFileSync(from));
        }
        const fps = Math.max(Math.min((stamps.length - 1) / (stamps[stamps.length - 1] - stamps[0] || 1), 60), 4);
        const file = path.join(out, `${name}.mp4`);
        execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", fps.toFixed(2), "-i", path.join(dir, "f%05d.jpg"), "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2", "-pix_fmt", "yuv420p", "-c:v", "libx264", "-crf", "24", file]);
        rmSync(dir, {recursive: true, force: true});
        return {file, frames: n, fps: Math.round(fps * 10) / 10};
    };
}

const query = set ? "rig=/ark-rig/v2" : "";
const summary = [];
const wanted = arg("scenes", flag("perf") ? "none" : "");
for (const name of wanted ? wanted.split(",").filter((n) => n !== "none") : ["duck_flight", "deer_graze", "deer_look"]) {
    const {context, page, errors, cdp} = await open(deviceName, query);
    const prepared = await page.evaluate(() => window.__arkRig.prepare());
    log(name, "prepared", JSON.stringify({settled: prepared.settled, tier: prepared.stats.tier}));
    const info = await page.evaluate((n) => window.__arkRig.setup(n), name);
    const stop = await record(cdp, name);
    await page.evaluate((watch) => window.__arkRig.trace(watch), info.watch);
    const samples = [];
    const started = Date.now();
    const shots = [];
    // Light sampling only (the page's own trace has every clip change; frames come from the video afterwards).
    while (Date.now() - started < seconds * 1000) {
        const t = (Date.now() - started) / 1000;
        samples.push({t, s: await page.evaluate((watch) => window.__arkRig.sample(watch), info.watch)});
        await page.waitForTimeout(250);
    }
    const {epoch0, log: trace} = await page.evaluate(() => window.__arkRigTrace());
    // A still a little after each clip change (past the cross-fade; a one-shot at its middle), named by the time and clip.
    const picks = [];
    const seen = new Set();
    for (const row of trace) {
        const key = `${row.id}:${row.clip}:${Math.floor(row.t / 3)}`;
        if (!row.clip || seen.has(key)) continue;
        seen.add(key);
        const after = ["takeoff", "land", "enter_water", "exit_water", "shake_off"].includes(row.clip) ? [0.3, 0.6] : [0.5];
        for (const dt of after) picks.push({epoch: epoch0 + row.t + dt, file: `${name}-t${(row.t + dt).toFixed(2).padStart(5, "0")}-${row.clip}.jpg`});
    }
    for (const extra of (arg("stills", "") || "").split(",").filter(Boolean)) picks.push({epoch: epoch0 + Number(extra), file: `${name}-t${Number(extra).toFixed(2).padStart(5, "0")}-at.jpg`});
    const video = await stop(picks);
    const stats = await page.evaluate(() => window.__arkRig.stats());
    await context.close();
    writeFileSync(path.join(out, `${name}.json`), JSON.stringify({name, ...info, trace, shots, samples}, null, 1));
    const clips = {};
    const headYaw = {};
    for (const {s} of samples) {
        for (const r of s) {
            if (r.clip) (clips[r.slug + "#" + r.id.slice(-2)] ??= new Set()).add(r.clip);
            if (r.headYaw !== null) {
                const h = (headYaw[r.slug + "#" + r.id.slice(-2)] ??= [Infinity, -Infinity]);
                h[0] = Math.min(h[0], r.headYaw);
                h[1] = Math.max(h[1], r.headYaw);
            }
        }
    }
    const row = {
        name,
        note: info.note,
        video: video ? path.basename(video.file) : null,
        videoFps: video?.fps ?? null,
        clips: Object.fromEntries(Object.entries(clips).map(([k, v]) => [k, [...v]])),
        headYawRange: Object.fromEntries(Object.entries(headYaw).map(([k, [a, b]]) => [k, [a, b]])),
        rigged: stats.rigged,
        rigsLoaded: stats.rigsLoaded,
        errors: errors.filter((e) => !/Failed to load resource/.test(e)).slice(0, 5)
    };
    summary.push(row);
    log(name, JSON.stringify(row).slice(0, 600));
}

const perf = [];
if (flag("perf")) {
    for (const device of ["desktop", "phone"]) {
        for (const rigs of [true, false]) {
            const {context, page} = await open(device, rigs ? query : "norig=1");
            await page.evaluate(() => window.__arkRig.prepare());
            await page.evaluate(() => window.__arkRig.setup("crowd"));
            await page.waitForTimeout(4000);
            const m = await page.evaluate(() => window.__arkRig.measure(8000));
            perf.push({device, rigs, ...m});
            log("perf", device, rigs ? "rigs" : "no rigs", JSON.stringify(m));
            await context.close();
        }
    }
}

await browser.close();
server.close();
writeFileSync(path.join(out, "summary.json"), JSON.stringify({summary, perf}, null, 2));
log("wrote", out);
