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
    dung: {distance: 5, shots: [[600, "the herd, ten minutes on"], [900, "a mark, close"], [1500, "marks fading"]]}
};
/**
 * 3.3 batch (A): the defence moves' scenes. A predator is stood beside the animal (its shared pose pinned), left there,
 * then taken away: [what the harness does, seconds the world runs on, label]. Each scene: how many body lengths away
 * it is framed from, and the camera's azimuth and polar angle when the default hides the move (a flat coil is seen from above).
 */
const DEFENCE = {curl: [5], pangolin: [4], pill: [7, 2.4, 0.5], coil: [3, 2.4, 0.5], millipede: [4, 2.4, 0.5], shell: [5], snail: [7], hermit: [7], puff: [6], monitor: [3.5], puffer: [5], flash: [7, 2.4, 0.5], eyes: [7, 2.4, 0.5], lubber: [7, 2.4, 0.6], tail: [5, 2.4, 0.6], salamander: [5, 2.4, 0.6]};
const DEFENCE_STEPS = [["none", 2, "before: about its day"], ["near", 0.5, "a predator beside it, half a second"], ["hold", 0.5, "one second"], ["hold", 1, "two seconds"], ["hold", 3, "five seconds"], ["away", 4, "the predator gone, four seconds"], ["hold", 12, "sixteen seconds on"], ["hold", 30, "calm again"]];
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
    if (DEFENCE[name]) {
        const dir = path.join(out, name);
        rmSync(dir, {recursive: true, force: true});
        mkdirSync(dir, {recursive: true});
        const labels = [];
        for (let i = 0; i < DEFENCE_STEPS.length; i++) {
            const [what, seconds, label] = DEFENCE_STEPS[i];
            const note = await page.evaluate(async ([what, seconds, lengths, label, gap, azimuth, polar]) => {
                if (what === "near") window.__behaviours.threat(gap);
                if (what === "away") window.__behaviours.threat(null);
                const text = await window.__behaviours.run(seconds, lengths, Number(azimuth), Number(polar));
                document.getElementById("note").textContent = `${label}\n${text}`;
                return text;
            }, [what, seconds, DEFENCE[name][0], label, Number(arg("gap", "1.6")), arg("azimuth", String(DEFENCE[name][1] ?? 0.7)), arg("polar", String(DEFENCE[name][2] ?? 1.1))]);
            labels.push(`${String(i).padStart(2, "0")} ${label}: ${note}`);
            await page.screenshot({path: path.join(dir, `${String(i).padStart(2, "0")}.jpg`), type: "jpeg", quality: 88});
        }
        writeFileSync(path.join(dir, "labels.txt"), labels.join("\n") + "\n");
        execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", "1", "-i", path.join(dir, "%02d.jpg"), "-vf", "scale=640:-1,tile=4x2:padding=4:color=black", "-frames:v", "1", path.join(out, `${name}-strip.jpg`)]);
        summary[name] = {errors: errors.slice(0, 10), shots: labels};
        console.log(name, labels.join("\n"));
        if (errors.length) console.log(name, "errors:", errors.slice(0, 5));
        await context.close();
        continue;
    }
    const info = await page.evaluate(() => window.__behaviours.info());
    console.log(name, JSON.stringify({births: info.births, matings: info.matings}));
    const plan = PLANS[name];
    const mating = info.matings[0];
    // (A contest's moments are from its own script: its walk is told by its end, 14–22 s of bouts and 5 s to run.)
    const end = mating?.contestEnd ?? 0;
    const at = (s) => (typeof s === "number" ? s : s.startsWith("end") ? end + Number(s.slice(3)) : Math.max(end - 27, 2) + Number(s.slice(4)));
    const dir = path.join(out, name);
    rmSync(dir, {recursive: true, force: true});
    mkdirSync(dir, {recursive: true});
    const labels = [];
    for (let i = 0; i < plan.shots.length; i++) {
        const [when, label] = plan.shots[i];
        const s = at(when);
        const note = await page.evaluate(async ([s, d, label, name, rival, who]) => {
            let point;
            if (name === "dung" && label.includes("close")) {
                await window.__behaviours.shot(s, d);
                const marks = window.__behaviours.dung().sort((p, q) => q.alpha - p.alpha);
                if (marks[0]) point = {x: marks[0].x, z: marks[0].z};
            }
            const text = await window.__behaviours.shot(s, point ? 2.2 : d, name === "contest" && label.includes("runs") ? rival : who, point, name === "contest" ? 2.4 : 0.7, name === "contest" ? 0.85 : 1.15);
            document.getElementById("note").textContent = `${label}\n${text}`;
            return text;
        }, [s, plan.distance, label, name, mating?.rival, info.births[0]?.mother ?? (name === "contest" ? info.a : undefined)]);
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
