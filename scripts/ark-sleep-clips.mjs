#!/usr/bin/env node
/**
 * The sleep clips (docs/ark/sleep.md): builds `src/ark-scene/sleep-entry.ts` into `.ark-golden/sleep/` (gitignored),
 * serves it on localhost with the scene's art, and drives Playwright's cached Chromium (playwright-core, an existing
 * dev dependency) through each clip frame by frame on the page's controlled clock: frames (jpg), a video (mp4, the
 * system's ffmpeg) and a contact sheet per clip.
 *
 *   node scripts/ark-sleep-clips.mjs --out <dir> [--clips night,den] [--width 1280 --height 720] [--frames a-b] [--quality high]
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
const out = path.resolve(arg("out", path.join(root, ".ark-golden", "sleep-clips")));
const clips = arg("clips", "night,den").split(",");
const width = Number(arg("width", "1280"));
const height = Number(arg("height", "720"));
const quality = arg("quality", "high");
const range = arg("frames", null)?.split("-").map(Number) ?? null;
/** Single frames only (stills to look at): `--at 80,200`. */
const only = arg("at", null)?.split(",").map(Number) ?? null;
mkdirSync(out, {recursive: true});

const site = path.join(root, ".ark-golden", "sleep");
mkdirSync(site, {recursive: true});
await build({
    entryPoints: [path.join(root, "src/ark-scene/sleep-entry.ts")],
    outfile: path.join(site, "sleep-scene.js"),
    bundle: true,
    format: "iife",
    platform: "browser",
    target: ["es2020"],
    minify: true,
    tsconfig: path.join(root, "tsconfig.json"),
    define: {"process.env.NODE_ENV": JSON.stringify("development")},
    logLevel: "warning"
});
writeFileSync(path.join(site, "sleep.html"), `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Ark sleep clips</title>
<style>html,body{margin:0;height:100%;background:#0b1020;overflow:hidden}#ark{position:fixed;inset:0}#note{position:fixed;left:10px;top:8px;z-index:9;font:600 13px/1.3 ui-sans-serif,system-ui;color:#fff;text-shadow:0 1px 3px #000;white-space:pre}</style>
</head><body><div id="ark"></div><div id="note"></div><script src="./sleep-scene.js"></script></body></html>`);
const server = createServer((request, response) => {
    const url = new URL(request.url, "http://localhost");
    const fromPublic = url.pathname.startsWith("/ark/");
    const folder = fromPublic ? path.join(root, "public") : site;
    const file = path.join(folder, path.normalize(url.pathname).replace(/^\/+/, "") || "sleep.html");
    if (!file.startsWith(folder) || !existsSync(file)) {
        response.writeHead(404).end();
        return;
    }
    const type = file.endsWith(".html") ? "text/html" : file.endsWith(".js") ? "text/javascript" : file.endsWith(".webp") ? "image/webp" : file.endsWith(".json") ? "application/json" : "application/octet-stream";
    response.writeHead(200, {"Content-Type": type, "Cache-Control": "no-store"}).end(readFileSync(file));
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}/sleep.html`;

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
        const errors = [];
        page.on("pageerror", (e) => errors.push(e.message));
        page.on("console", (m) => {
            if (m.type() === "error" || /shader|WebGL|GL_/i.test(m.text())) errors.push(m.text().slice(0, 400));
        });
        await page.goto(`${base}?clip=${clip}&quality=${quality}`, {waitUntil: "domcontentloaded", timeout: 120000});
        await page.waitForFunction(() => window.__clip, null, {timeout: 240000});
        const script = await page.evaluate(() => window.__clip.script);
        console.log(clip, JSON.stringify(script?.note ?? "no script"));
        summary[clip] = {script, errors};
        if (!script) {
            await context.close();
            continue;
        }
        const dir = path.join(out, clip);
        rmSync(dir, {recursive: true, force: true});
        mkdirSync(dir, {recursive: true});
        const n = Math.round(script.seconds * script.fps);
        const [from, to] = range ?? [0, n];
        let k = 0;
        const list = only ?? Array.from({length: Math.max(Math.min(to, n) - from, 0)}, (_, j) => from + j);
        for (const i of list) {
            const label = await page.evaluate(async (i) => {
                const label = await window.__clip.frame(i);
                document.getElementById("note").textContent = label;
                return label;
            }, i);
            await page.screenshot({path: path.join(dir, `${String(k).padStart(4, "0")}.jpg`), type: "jpeg", quality: 85});
            k++;
            if (i % 50 === 0) console.log(clip, i, label);
        }
        summary[clip].errors = errors;
        if (errors.length) console.log(clip, "errors:", errors.slice(0, 5));
        if (only) {
            await context.close();
            continue;
        }
        execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", String(script.fps), "-i", path.join(dir, "%04d.jpg"), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2", path.join(out, `${clip}.mp4`)]);
        const pick = Array.from({length: 12}, (_, j) => Math.min(Math.round((j / 11) * (k - 1)), k - 1));
        const sheetIn = pick.flatMap((j) => ["-i", path.join(dir, `${String(j).padStart(4, "0")}.jpg`)]);
        execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...sheetIn, "-filter_complex", `${pick.map((_, j) => `[${j}:v]scale=480:-1[v${j}]`).join(";")};${pick.map((_, j) => `[v${j}]`).join("")}xstack=inputs=12:layout=${[0, 1, 2, 3].flatMap((r) => [0, 1, 2].map((c) => `${c === 0 ? "0" : c === 1 ? "w0" : "w0+w1"}_${r === 0 ? "0" : r === 1 ? "h0" : r === 2 ? "h0+h1" : "h0+h1+h2"}`)).join("|")}`, path.join(out, `${clip}-sheet.jpg`)]);
        await context.close();
    } catch (error) {
        console.log(clip, "failed:", error.message.split("\n")[0]);
    }
}
writeFileSync(path.join(out, "summary.json"), JSON.stringify(summary, null, 1));
await browser.close();
server.close();
