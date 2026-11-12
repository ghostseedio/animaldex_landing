#!/usr/bin/env node
/**
 * The collision recordings (motion pass L5): builds `src/ark-scene/collide-entry.ts` into `.ark-golden/collide/`
 * (gitignored), serves it with the scene's art and a snapshot (read in place: the real one never leaves this machine),
 * and drives Playwright's cached Chromium through each shot of `scripts/ark-collide-shots.mts`'s list frame by frame on
 * the page's controlled clock, the camera on the moment's animal: frames (jpg, the canvas only), a video (mp4) and a
 * contact sheet per shot. Run it on the tree before the collisions and on the tree after, with the same shots.
 *
 *   node scripts/ark-collide-clips.mjs --snapshot <snapshot.json> --shots <shots.json> --label before|after --out <dir>
 *       [--fps 5 --before 3 --after 6 --width 960 --height 600 --quality high]
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
const snapshotFile = path.resolve(arg("snapshot"));
const shots = JSON.parse(readFileSync(path.resolve(arg("shots")), "utf8"));
const label = arg("label", "after");
const out = path.resolve(arg("out", path.join(root, ".ark-golden", "collide-clips")));
const fps = Number(arg("fps", "5"));
const lead = Number(arg("before", "3"));
const tail = Number(arg("after", "6"));
const width = Number(arg("width", "960"));
const height = Number(arg("height", "600"));
const quality = arg("quality", "high");
const only = arg("kinds", null)?.split(",") ?? null;
mkdirSync(out, {recursive: true});

const site = path.join(root, ".ark-golden", "collide");
mkdirSync(site, {recursive: true});
await build({
    entryPoints: [path.join(root, "src/ark-scene/collide-entry.ts")],
    outfile: path.join(site, "collide-scene.js"),
    bundle: true,
    format: "iife",
    platform: "browser",
    target: ["es2020"],
    minify: true,
    tsconfig: path.join(root, "tsconfig.json"),
    define: {"process.env.NODE_ENV": JSON.stringify("development")},
    logLevel: "warning"
});
writeFileSync(path.join(site, "collide.html"), `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Ark collision clips</title>
<style>html,body{margin:0;height:100%;background:#0b1020;overflow:hidden}#ark{position:fixed;inset:0}</style>
</head><body><div id="ark"></div><script src="./collide-scene.js"></script></body></html>`);
const server = createServer((request, response) => {
    const url = new URL(request.url, "http://localhost");
    if (url.pathname === "/snapshot.json") {
        response.writeHead(200, {"Content-Type": "application/json", "Cache-Control": "no-store"}).end(readFileSync(snapshotFile));
        return;
    }
    const fromPublic = url.pathname.startsWith("/ark/");
    const folder = fromPublic ? path.join(root, "public") : site;
    const file = path.join(folder, path.normalize(url.pathname).replace(/^\/+/, "") || "collide.html");
    if (!file.startsWith(folder) || !existsSync(file)) {
        response.writeHead(404).end();
        return;
    }
    const type = file.endsWith(".html") ? "text/html" : file.endsWith(".js") ? "text/javascript" : file.endsWith(".webp") ? "image/webp" : file.endsWith(".json") ? "application/json" : "application/octet-stream";
    response.writeHead(200, {"Content-Type": type, "Cache-Control": "no-store"}).end(readFileSync(file));
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}/collide.html`;
const cache = path.join(os.homedir(), "Library", "Caches", "ms-playwright");
const chromiumDir = readdirSync(cache).filter((d) => /^chromium-\d+$/.test(d)).sort().reverse()[0];
const executablePath = path.join(cache, chromiumDir, "chrome-mac-arm64", "Google Chrome for Testing.app", "Contents", "MacOS", "Google Chrome for Testing");
const {chromium} = createRequire(path.join(root, "node_modules", "x.js"))("playwright-core");
const browser = await chromium.launch({executablePath, headless: true, args: ["--use-angle=metal", "--ignore-gpu-blocklist"]});
const summary = [];
if (process.argv.includes("--list-drawn")) {
    // Who the scene draws one by one at a moment (`--at <epoch>`): the shots' finder keeps to them.
    const context = await browser.newContext({viewport: {width, height}});
    const page = await context.newPage();
    const at = Number(arg("at"));
    await page.goto(`${base}?snapshot=snapshot.json&quality=${quality}&at=${at}`, {waitUntil: "domcontentloaded", timeout: 180000});
    await page.waitForFunction(() => window.__collide, null, {timeout: 400000});
    await page.evaluate(async (epoch) => window.__collide.frame(epoch, {target: {x: 0, y: 0, z: 0}, distance: 120, polar: 0.9, azimuth: 0}), at);
    const drawn = await page.evaluate(() => window.__collide.drawn());
    writeFileSync(path.join(out, `drawn-${at}.json`), JSON.stringify(drawn));
    console.log("drawn", drawn.length);
    await browser.close();
    server.close();
    process.exit(0);
}
for (const shot of shots) {
    if (only && !only.includes(shot.kind)) continue;
    const context = await browser.newContext({viewport: {width, height}});
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(`${base}?snapshot=snapshot.json&quality=${quality}&at=${shot.t - lead}`, {waitUntil: "domcontentloaded", timeout: 180000});
    await page.waitForFunction(() => window.__collide, null, {timeout: 400000});
    const dir = path.join(out, `${shot.kind}-${label}`);
    rmSync(dir, {recursive: true, force: true});
    mkdirSync(dir, {recursive: true});
    // The camera: on the moment's spot, a few body lengths off, looking down at it from the side.
    const distance = Math.min(Math.max(shot.length * 4, 5), 14);
    const view = shot.view ?? {target: {x: shot.x, y: shot.y + Math.min(shot.length * 0.3, 1), z: shot.z}, distance, polar: 1.05, azimuth: 0.7};
    await page.evaluate(async ([epoch, v]) => {
        await window.__collide.frame(epoch, v);
        await window.__collide.settle(60000);
    }, [shot.t - lead, view]);
    if (process.argv.includes("--cost")) {
        // The cost at this place, on the real clock (the scene running as a viewer sees it), not a recording.
        const cost = await page.evaluate(async () => window.__collide.cost(8000));
        summary.push({kind: shot.kind, label, cost: {frames: cost.frames, meanFrameMs: +cost.meanFrameMs.toFixed(2), collisionsMsPerFrame: cost.collisionsMsPerFrame === null ? null : +cost.collisionsMsPerFrame.toFixed(3), pushedPerFrame: cost.pushedPerFrame, easedPerFrame: cost.easedPerFrame, near: cost.stats.near, far: cost.stats.far, live: cost.stats.live}});
        console.log(shot.kind, label, JSON.stringify(summary[summary.length - 1].cost));
        await context.close();
        continue;
    }
    const n = Math.round((lead + tail) * fps);
    const canvas = await page.$("canvas");
    // The camera follows the moment's animal (the drawn one of its species nearest the spot), keeping its own angle.
    const subject = await page.evaluate(([id, slug, x, z]) => (id && window.__collide.locate(id) ? id : window.__collide.find(slug, x, z)), [shot.id, shot.slug, shot.x, shot.z]);
    for (let i = 0; i < n; i++) {
        const epoch = shot.t - lead + i / fps;
        await page.evaluate(async ([e, v, id]) => {
            const at = id ? window.__collide.locate(id) : null;
            const follow = at ? {...v, target: {x: at.x, y: at.ground + Math.min(at.height * 0.5, 1.2), z: at.z}} : v;
            await window.__collide.frame(e, follow);
            if (id) {
                const now = window.__collide.locate(id);
                if (now) await window.__collide.frame(e, {...v, target: {x: now.x, y: now.ground + Math.min(now.height * 0.5, 1.2), z: now.z}});
            }
        }, [epoch, view, subject]);
        await canvas.screenshot({path: path.join(dir, `${String(i).padStart(4, "0")}.jpg`), type: "jpeg", quality: 85});
    }
    try {
        execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", String(fps), "-i", path.join(dir, "%04d.jpg"), "-pix_fmt", "yuv420p", "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2", path.join(out, `${shot.kind}-${label}.mp4`)]);
        execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", path.join(dir, "%04d.jpg"), "-vf", `select='not(mod(n\\,${Math.max(Math.round(n / 12), 1)}))',scale=480:-1,tile=4x3`, "-frames:v", "1", path.join(out, `${shot.kind}-${label}-sheet.jpg`)]);
    } catch (error) {
        errors.push(String(error).slice(0, 300));
    }
    summary.push({kind: shot.kind, slug: shot.slug, t: shot.t, label, frames: n, followed: Boolean(subject), errors: errors.slice(0, 5)});
    console.log(shot.kind, label, n, "frames", errors.length ? errors[0] : "");
    await context.close();
}
writeFileSync(path.join(out, process.argv.includes("--cost") ? `cost-${label}.json` : `clips-${label}.json`), JSON.stringify(summary, null, 1));
await browser.close();
server.close();
