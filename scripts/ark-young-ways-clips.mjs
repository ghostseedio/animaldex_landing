#!/usr/bin/env node
/**
 * The young-ways harness (sig-young lane): builds `src/ark-scene/young-ways-entry.ts` into `.ark-golden/young-ways/` (gitignored),
 * serves it with the scene's art and drives Chrome through a cast of adults and newborn young left to the scene's own poses:
 * riding (back, chest, tail, beneath the tail), lines, young kept at a spot with their parents' visits, clumps. Frames at the
 * moments of each way and a contact strip per scene. Nothing is made up for the animals: no event is handed in.
 *
 *   node scripts/ark-young-ways-clips.mjs --out <dir> [--scenes grebe,swan,deer,...]
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
const out = path.resolve(arg("out", path.join(root, ".ark-golden", "young-ways-shots")));
const scenes = arg("scenes", "grebe,duck,deer,fox,penguin").split(",");
mkdirSync(out, {recursive: true});
const site = path.join(root, ".ark-golden", "young-ways");
mkdirSync(site, {recursive: true});
await build({entryPoints: [path.join(root, "src/ark-scene/young-ways-entry.ts")], outfile: path.join(site, "scene.js"), bundle: true, format: "iife", platform: "browser", target: ["es2020"], minify: true, tsconfig: path.join(root, "tsconfig.json"), define: {"process.env.NODE_ENV": JSON.stringify("development")}, logLevel: "warning"});
writeFileSync(path.join(site, "index.html"), `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Ark young ways</title>
<style>html,body{margin:0;height:100%;background:#0b1020;overflow:hidden}#ark{position:fixed;inset:0}#note{position:fixed;left:10px;top:8px;z-index:9;font:600 12px/1.35 ui-sans-serif,system-ui;color:#fff;text-shadow:0 1px 3px #000;white-space:pre-wrap;max-width:96vw}</style>
</head><body><div id="ark"></div><div id="note"></div><script src="./scene.js"></script></body></html>`);
const server = createServer((request, response) => {
    const url = new URL(request.url, "http://localhost");
    const folder = url.pathname.startsWith("/ark/") ? path.join(root, "public") : site;
    const file = path.join(folder, path.normalize(url.pathname).replace(/^\/+/, "") || "index.html");
    if (!file.startsWith(folder) || !existsSync(file)) return void response.writeHead(404).end();
    const type = file.endsWith(".html") ? "text/html" : file.endsWith(".js") ? "text/javascript" : file.endsWith(".webp") ? "image/webp" : file.endsWith(".json") ? "application/json" : "application/octet-stream";
    response.writeHead(200, {"Content-Type": type, "Cache-Control": "no-store"}).end(readFileSync(file));
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}/index.html`;
const {chromium} = createRequire(path.join(root, "node_modules", "x.js"))("playwright-core");
let browser;
try {
    browser = await chromium.launch({channel: "chrome", headless: true, args: ["--use-angle=metal", "--ignore-gpu-blocklist"]});
} catch {
    const cache = path.join(os.homedir(), "Library", "Caches", "ms-playwright");
    const dir = readdirSync(cache).filter((d) => /^chromium-\d+$/.test(d)).sort().reverse()[0];
    browser = await chromium.launch({executablePath: path.join(cache, dir, "chrome-mac-arm64", "Google Chrome for Testing.app", "Contents", "MacOS", "Google Chrome for Testing"), headless: true, args: ["--use-angle=metal", "--ignore-gpu-blocklist"]});
}

const summary = {};
for (const name of scenes) {
    const context = await browser.newContext({viewport: {width: 1280, height: 720}});
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
        if (m.type() === "error") errors.push(m.text().slice(0, 300));
        if (m.text().startsWith("[ways]")) console.log(name, m.text().slice(0, 600));
    });
    await page.goto(`${base}?scene=${name}&quality=high`, {waitUntil: "domcontentloaded", timeout: 120000});
    try {
        await page.waitForFunction(() => window.__ways || window.__waysError, null, {timeout: 300000});
    } catch (error) {
        console.log(name, "no harness:", error.message.split("\n")[0], errors.slice(0, 5));
        await context.close();
        continue;
    }
    const failed = await page.evaluate(() => window.__waysError ?? null);
    if (failed) {
        console.log(name, "failed:", failed.slice(0, 500));
        await context.close();
        continue;
    }
    const info = await page.evaluate(() => window.__ways.info());
    console.log(name, JSON.stringify(info));
    const dir = path.join(out, name);
    rmSync(dir, {recursive: true, force: true});
    mkdirSync(dir, {recursive: true});
    const y = info.ids.young;
    const parentOfFirst = info.ids.adults.find((id) => id.endsWith(info.parents[y[0].slice(-2)] ?? "")) ?? info.ids.adults[0];
    // Each scene's moments: [seconds after the start, label, how to frame: "young" | "parent" | "pair" | "line"].
    let plan = [];
    if (info.kind === "ride") plan = [[3, "carried: close", "young", info.distance], [14, "carried: close, later", "young", info.distance], [40, "carried: the pair", "pair"], [90, "carried: a minute and a half on", "young", info.distance * 1.5], [200, "carried: later still", "pair"]];
    if (info.kind === "line") plan = [[15, "a line behind her", "parent", info.distance], [30, "a line behind her", "parent", info.distance], [55, "a line", "parent", info.distance], [80, "a line", "parent", info.distance], [120, "a line", "parent", info.distance], [170, "a line", "parent", info.distance]];
    if (info.kind === "cluster") plan = [[10, "clumped", "young", info.distance], [40, "clumped", "young", info.distance], [120, "clumped, apart from the adults", "young", info.distance * 2], [730, "the clump on in the next slot", "young", info.distance], [760, "the clump on in the next slot", "young", info.distance]];
    if (info.kind === "stay") {
        const visits = await page.evaluate(() => window.__ways.visits(1500));
        console.log(name, "visits", JSON.stringify(visits.slice(0, 6)));
        const v = visits[0];
        if (!v) plan = [[10, "young kept at a spot", "young", info.distance], [200, "young kept at a spot", "young", info.distance]];
        else {
            const mid = (a, b) => (a + b) / 2;
            plan = [
                [Math.max(v.go - 20, 3), "before: the young lies, she is about her day", "pair-by", v.visitor],
                [v.go + 2, "she sets out", "pair-by", v.visitor],
                [mid(v.go, v.hold), "on her way", "pair-by", v.visitor],
                [v.hold + 2, "with it", "pair-by", v.visitor],
                [v.hold + 14, "with it", "pair-by", v.visitor],
                [mid(v.back, v.end), "going back to her day", "pair-by", v.visitor],
                [v.end + 20, "after: the young lies, she is away", "pair-by", v.visitor]
            ];
        }
    }
    const labels = [];
    for (let i = 0; i < plan.length; i++) {
        const [s, label, how, extra] = plan[i];
        const text = await page.evaluate(async ([s, label, how, extra, parent, young0, young1]) => {
            let t;
            if (how === "young") t = await window.__ways.shot(s, extra, young0);
            else if (how === "parent") t = await window.__ways.shot(s, extra, parent, 0.9, 1.0);
            else if (how === "pair") t = await window.__ways.pair(s, parent, young0);
            else {
                const visitor = window.__ways.info().ids.adults.find((id) => id.endsWith(extra));
                t = await window.__ways.pair(s, visitor, young0, 2);
            }
            document.getElementById("note").textContent = `${label}\n${t}`;
            return t;
        }, [s, label, how, extra, parentOfFirst, y[0], y[1]]);
        labels.push(`${String(i).padStart(2, "0")} ${label}: ${text.replace(/\n/g, " | ")}`);
        await page.screenshot({path: path.join(dir, `${String(i).padStart(2, "0")}.jpg`), type: "jpeg", quality: 86});
    }
    writeFileSync(path.join(dir, "labels.txt"), labels.join("\n") + "\n");
    const cols = plan.length > 6 ? 4 : plan.length > 4 ? 3 : 2;
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", "1", "-i", path.join(dir, "%02d.jpg"), "-vf", `scale=640:-1,tile=${cols}x${Math.ceil(plan.length / cols)}:padding=4:color=black`, "-frames:v", "1", path.join(out, `${name}-strip.jpg`)]);
    summary[name] = {info, errors: errors.slice(0, 10), shots: labels};
    console.log(name, labels.join("\n"));
    if (errors.length) console.log(name, "errors:", errors.slice(0, 5));
    await context.close();
}
writeFileSync(path.join(out, "summary.json"), JSON.stringify(summary, null, 1));
await browser.close();
server.close();
