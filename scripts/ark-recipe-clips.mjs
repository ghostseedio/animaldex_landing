#!/usr/bin/env node
/**
 * The behaviour recipes' clips (docs/ark/behaviour-recipes.md): builds `src/ark-scene/recipes-entry.ts` into
 * `.ark-golden/recipes/` (gitignored), serves it on localhost with the scene's art, and drives Playwright's cached
 * Chromium (playwright-core, Apache-2.0, an existing dev dependency) through each clip frame by frame on the page's
 * controlled clock: frames (jpg), a video (mp4, the system's ffmpeg) and a contact sheet per clip.
 *
 *   node scripts/ark-recipe-clips.mjs --out <dir> [--clips kingfisher,stags,murmuration,nest,heron,osprey] [--width 960 --height 540]
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
const out = path.resolve(arg("out", path.join(root, ".ark-golden", "recipe-clips")));
const clips = arg("clips", "kingfisher,stags,murmuration,nest").split(",");
const width = Number(arg("width", "960"));
const height = Number(arg("height", "540"));
mkdirSync(out, {recursive: true});

const site = path.join(root, ".ark-golden", "recipes");
mkdirSync(site, {recursive: true});
await build({
    entryPoints: [path.join(root, "src/ark-scene/recipes-entry.ts")],
    outfile: path.join(site, "recipes-scene.js"),
    bundle: true,
    format: "iife",
    platform: "browser",
    target: ["es2020"],
    minify: true,
    tsconfig: path.join(root, "tsconfig.json"),
    define: {"process.env.NODE_ENV": JSON.stringify("development")},
    logLevel: "warning"
});
writeFileSync(path.join(site, "recipes.html"), `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Ark recipe clips</title>
<style>html,body{margin:0;height:100%;background:#ecdcc4;overflow:hidden}#ark{position:fixed;inset:0}#note{position:fixed;left:10px;top:8px;z-index:9;font:600 13px/1.3 ui-sans-serif,system-ui;color:#fff;text-shadow:0 1px 3px #000;white-space:pre}</style>
</head><body><div id="ark"></div><div id="note"></div><script src="./recipes-scene.js"></script></body></html>`);
const server = createServer((request, response) => {
    const url = new URL(request.url, "http://localhost");
    const fromPublic = url.pathname.startsWith("/ark/");
    const folder = fromPublic ? path.join(root, "public") : site;
    const file = path.join(folder, path.normalize(url.pathname).replace(/^\/+/, "") || "recipes.html");
    if (!file.startsWith(folder) || !existsSync(file)) {
        response.writeHead(404).end();
        return;
    }
    const type = file.endsWith(".html") ? "text/html" : file.endsWith(".js") ? "text/javascript" : file.endsWith(".webp") ? "image/webp" : "application/octet-stream";
    response.writeHead(200, {"Content-Type": type, "Cache-Control": "no-store"}).end(readFileSync(file));
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}/recipes.html`;

const cache = path.join(os.homedir(), "Library", "Caches", "ms-playwright");
const chromiumDir = readdirSync(cache).filter((d) => /^chromium-\d+$/.test(d)).sort().reverse()[0];
const executablePath = path.join(cache, chromiumDir, "chrome-mac-arm64", "Google Chrome for Testing.app", "Contents", "MacOS", "Google Chrome for Testing");
const {chromium} = createRequire(path.join(root, "node_modules", "x.js"))("playwright-core");
const browser = await chromium.launch({executablePath, headless: true, args: ["--use-angle=metal", "--ignore-gpu-blocklist"]});
const summary = {};
for (const clip of clips) {
  try {
    const context = await browser.newContext({viewport: {width, height}});
    const page = await context.newPage();
    page.on("pageerror", (e) => console.log(clip, "pageerror", e.message));
    await page.goto(`${base}?clip=${clip}`, {waitUntil: "domcontentloaded", timeout: 120000});
    await page.waitForFunction(() => window.__clip, null, {timeout: 240000});
    const info = await page.evaluate(() => ({moment: window.__clip.moment, sexes: window.__clip.sexes}));
    console.log(clip, JSON.stringify(info.moment?.note ?? "no moment"), info.sexes.join(", "));
    summary[clip] = info;
    if (!info.moment) {
        await context.close();
        continue;
    }
    const dir = path.join(out, clip);
    rmSync(dir, {recursive: true, force: true});
    mkdirSync(dir, {recursive: true});
    const {start, seconds, step} = info.moment;
    const n = Math.round(seconds / step);
    for (let i = 0; i < n; i++) {
        const t = start + i * step;
        await page.evaluate(async ({t, label}) => {
            await window.__clip.at(t);
            document.getElementById("note").textContent = label;
        }, {t, label: `${clip}   world +${(i * step).toFixed(2)} s`});
        await page.screenshot({path: path.join(dir, `${String(i).padStart(4, "0")}.jpg`), type: "jpeg", quality: 85});
    }
    if (clip === "nest") {
        // The nest at the same place through its first days (the props lane's own nests replace this drawing in the release).
        const day0 = Date.UTC(2026, 3, 1, 11) / 1000;
        for (const d of [0.3, 1, 2, 3, 4, 5.5]) {
            await page.evaluate(async ({t, d}) => {
                await window.__clip.at(t);
                document.getElementById("note").textContent = `nest, day ${d} of its season`;
            }, {t: day0 + d * 86400, d});
            await page.screenshot({path: path.join(dir, `stage-${d}.jpg`), type: "jpeg", quality: 88});
        }
    }
    const fps = Math.round(1 / step);
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", String(Math.min(fps, 24)), "-i", path.join(dir, "%04d.jpg"), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2", path.join(out, `${clip}.mp4`)]);
    // Contact sheet: 12 frames spread through the clip.
    const pick = Array.from({length: 12}, (_, k) => Math.min(Math.round((k / 11) * (n - 1)), n - 1));
    const sheetIn = pick.flatMap((k) => ["-i", path.join(dir, `${String(k).padStart(4, "0")}.jpg`)]);
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...sheetIn, "-filter_complex", `${pick.map((_, k) => `[${k}:v]scale=480:-1[v${k}]`).join(";")};${pick.map((_, k) => `[v${k}]`).join("")}xstack=inputs=12:layout=${[0, 1, 2, 3].flatMap((r) => [0, 1, 2].map((c) => `${c === 0 ? "0" : c === 1 ? "w0" : "w0+w1"}_${r === 0 ? "0" : r === 1 ? "h0" : r === 2 ? "h0+h1" : "h0+h1+h2"}`)).join("|")}`, path.join(out, `${clip}-sheet.jpg`)]);
    await context.close();
  } catch (error) {
    console.log(clip, "failed:", error.message.split("\n")[0]);
  }
}
writeFileSync(path.join(out, "summary.json"), JSON.stringify(summary, null, 1));
await browser.close();
server.close();
