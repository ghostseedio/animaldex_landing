#!/usr/bin/env node
/**
 * The behaviours harness (behaviours plan P1, AnimalDex docs/ark/behaviours-plan.md): builds
 * `src/ark-scene/behaviours-entry.ts` into `.ark-golden/behaviours/` (gitignored), serves it with the scene's art, and
 * drives Chrome through made-up record events on the page's controlled clock: a birth in the open, a den birth, a
 * contest before a mating, a herd's dung. Frames at each act's moments and a contact strip per scene.
 *
 *   node scripts/ark-behaviours-clips.mjs --out <dir> [--scenes birth,den,contest,dung]
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
const out = path.resolve(arg("out", path.join(root, ".ark-golden", "behaviours-shots")));
const scenes = arg("scenes", "birth,den,contest,dung").split(",");
mkdirSync(out, {recursive: true});
const site = path.join(root, ".ark-golden", "behaviours");
mkdirSync(site, {recursive: true});
await build({entryPoints: [path.join(root, "src/ark-scene/behaviours-entry.ts")], outfile: path.join(site, "scene.js"), bundle: true, format: "iife", platform: "browser", target: ["es2020"], minify: true, tsconfig: path.join(root, "tsconfig.json"), define: {"process.env.NODE_ENV": JSON.stringify("development")}, logLevel: "warning"});
writeFileSync(path.join(site, "index.html"), `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Ark behaviours</title>
<style>html,body{margin:0;height:100%;background:#0b1020;overflow:hidden}#ark{position:fixed;inset:0}#note{position:fixed;left:10px;top:8px;z-index:9;font:600 13px/1.35 ui-sans-serif,system-ui;color:#fff;text-shadow:0 1px 3px #000;white-space:pre}</style>
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

/** Each scene's moments (s after the event), framing distance (m) and who to frame. */
const PLANS = {
    birth: {distance: 6, shots: [[1, "she settles"], [9, "born"], [15, "licked"], [27, "getting up"], [31, "up on wobbly legs"], [38, "to her flank"], [50, "suckling"], [72, "back to their day"]]},
    den: {distance: 5, shots: [[1, "she settles"], [9, "the first cub"], [13, "both born"], [22, "licked"], [40, "suckling at her belly"], [70, "back to their day"]]},
    contest: {distance: 9, shots: [[1, "the rival comes"], [8, "closing"], ["walk+2.1", "a clash"], ["walk+4", "backing off"], ["walk+7.3", "another clash"], ["end-3", "the rival runs"], ["end+6", "the pair: courtship"], ["end+40", "the mating"]]},
    // 3.3 batch (C): the young one at its recorded mother's heel, then a nursing bout of the shared clock.
    nurse: {distance: 4, shots: [["bout-12", "at her heel"], ["bout+1.5", "coming to her flank"], ["bout+6", "suckling"], ["bout+16", "suckling, from the other side", 3.6], ["bout+24", "still suckling"], ["boutend+1", "back to her heel"], ["boutend+8", "at heel again"]]},
    dung: {distance: 5, shots: [[600, "the herd, ten minutes on"], [900, "a mark, close"], [1500, "marks fading"]]}
};
const summary = {};
for (const name of scenes) {
    const context = await browser.newContext({viewport: {width: 1280, height: 720}});
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
        if (m.type() === "error") errors.push(m.text().slice(0, 300));
        if (m.text().startsWith("[behaviours]")) console.log(name, m.text().slice(0, 600));
    });
    await page.goto(`${base}?scene=${name}&quality=high`, {waitUntil: "domcontentloaded", timeout: 120000});
    try {
        await page.waitForFunction(() => window.__behaviours || window.__behavioursError, null, {timeout: 300000});
    } catch (error) {
        console.log(name, "no harness:", error.message.split("\n")[0], errors.slice(0, 5));
        await context.close();
        continue;
    }
    const failed = await page.evaluate(() => window.__behavioursError ?? null);
    if (failed) {
        console.log(name, "failed:", failed.slice(0, 500));
        await context.close();
        continue;
    }
    const info = await page.evaluate(() => window.__behaviours.info());
    console.log(name, JSON.stringify({births: info.births, matings: info.matings}));
    const plan = PLANS[name];
    const mating = info.matings[0];
    // (A contest's moments are from its own script: its walk is told by its end, 14–22 s of bouts and 5 s to run.)
    const end = mating?.contestEnd ?? 0;
    const bout = name === "nurse" ? await page.evaluate(() => window.__behaviours.nurseBout()) : null;
    if (name === "nurse") {
        console.log(name, JSON.stringify({nurse: info.nurse, bout}));
        // (The cast has walked on since the scene's start: the camera is brought to the mother before the first frame.)
        await page.evaluate(([s, who]) => window.__behaviours.shot(s, 5, who), [(bout?.start ?? 0) - 20, info.nurse.mother]);
    }
    const at = (s) => (typeof s === "number" ? s : s.startsWith("boutend") ? (bout?.start ?? 0) + (bout?.length ?? 0) + Number(s.slice(7)) : s.startsWith("bout") ? (bout?.start ?? 0) + Number(s.slice(4)) : s.startsWith("end") ? end + Number(s.slice(3)) : Math.max(end - 27, 2) + Number(s.slice(4)));
    const dir = path.join(out, name);
    rmSync(dir, {recursive: true, force: true});
    mkdirSync(dir, {recursive: true});
    const labels = [];
    for (let i = 0; i < plan.shots.length; i++) {
        const [when, label, azimuth] = plan.shots[i];
        const s = at(when);
        const note = await page.evaluate(async ([s, d, label, name, rival, who, azimuth]) => {
            let point;
            if (name === "dung" && label.includes("close")) {
                await window.__behaviours.shot(s, d);
                const marks = window.__behaviours.dung().sort((p, q) => q.alpha - p.alpha);
                if (marks[0]) point = {x: marks[0].x, z: marks[0].z};
            }
            const text = await window.__behaviours.shot(s, point ? 2.2 : d, name === "contest" && label.includes("runs") ? rival : who, point, name === "contest" ? 2.4 : azimuth ?? 0.7, name === "contest" ? 0.85 : 1.15);
            document.getElementById("note").textContent = `${label}\n${text}`;
            return text;
        }, [s, plan.distance, label, name, mating?.rival, info.births[0]?.mother ?? info.nurse?.mother ?? (name === "contest" ? info.a : undefined), azimuth]);
        labels.push(`${String(i).padStart(2, "0")} ${label}: ${note.replace(/\n/g, " | ")}`);
        await page.screenshot({path: path.join(dir, `${String(i).padStart(2, "0")}.jpg`), type: "jpeg", quality: 85});
    }
    writeFileSync(path.join(dir, "labels.txt"), labels.join("\n") + "\n");
    const cols = 4;
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", "1", "-i", path.join(dir, "%02d.jpg"), "-vf", `scale=640:-1,tile=${cols}x${Math.ceil(plan.shots.length / cols)}:padding=4:color=black`, "-frames:v", "1", path.join(out, `${name}-strip.jpg`)]);
    summary[name] = {info, errors: errors.slice(0, 10), shots: labels};
    console.log(name, labels.join("\n"));
    if (errors.length) console.log(name, "errors:", errors.slice(0, 5));
    await context.close();
}
writeFileSync(path.join(out, "summary.json"), JSON.stringify(summary, null, 1));
await browser.close();
server.close();
