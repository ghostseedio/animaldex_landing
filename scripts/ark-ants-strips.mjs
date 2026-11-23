#!/usr/bin/env node
/**
 * The ant colonies' harness (lane ARK-ANTS; `src/ark-scene/ants/`): builds `src/ark-scene/ants-entry.ts` into
 * `.ark-golden/ants/` (gitignored), serves it with the scene's art, and drives Chrome on the page's controlled clock.
 * Picture strips at a close zoom: a forming trail and a busy one (to a fixture body), a leafcutters' highway, an army
 * ants' raid, a weaver ants' leaf nest.
 *
 *   node scripts/ark-ants-strips.mjs --out <dir> [--scenes ghost,fire,leafcutter,army,weaver]
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
const out = path.resolve(arg("out", path.join(root, ".ark-golden", "ants-shots")));
const pairs = arg("scenes", "ghost,fire,leafcutter,army,weaver").split(",");
const width = Number(arg("width", "1280"));
const height = Number(arg("height", "720"));
mkdirSync(out, {recursive: true});

const site = path.join(root, ".ark-golden", "ants");
mkdirSync(site, {recursive: true});
await build({
    entryPoints: [path.join(root, "src/ark-scene/ants-entry.ts")],
    outfile: path.join(site, "ants-scene.js"),
    bundle: true,
    format: "iife",
    platform: "browser",
    target: ["es2020"],
    minify: true,
    tsconfig: path.join(root, "tsconfig.json"),
    define: {"process.env.NODE_ENV": JSON.stringify("development")},
    logLevel: "warning"
});
writeFileSync(path.join(site, "ants.html"), `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Ark ants</title>
<style>html,body{margin:0;height:100%;background:#0b1020;overflow:hidden}#ark{position:fixed;inset:0}#note{position:fixed;left:10px;top:8px;z-index:9;font:600 13px/1.35 ui-sans-serif,system-ui;color:#fff;text-shadow:0 1px 3px #000;white-space:pre}</style>
</head><body><div id="ark"></div><div id="note"></div><script src="./ants-scene.js"></script></body></html>`);
const server = createServer((request, response) => {
    const url = new URL(request.url, "http://localhost");
    const fromPublic = url.pathname.startsWith("/ark/");
    const folder = fromPublic ? path.join(root, "public") : site;
    const file = path.join(folder, path.normalize(url.pathname).replace(/^\/+/, "") || "ants.html");
    if (!file.startsWith(folder) || !existsSync(file)) {
        response.writeHead(404).end();
        return;
    }
    const type = file.endsWith(".html") ? "text/html" : file.endsWith(".js") ? "text/javascript" : file.endsWith(".webp") ? "image/webp" : file.endsWith(".json") ? "application/json" : "application/octet-stream";
    response.writeHead(200, {"Content-Type": type, "Cache-Control": "no-store"}).end(readFileSync(file));
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}/ants.html`;

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
for (const name of pairs) {
    const context = await browser.newContext({viewport: {width, height}});
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
        if (m.type() === "error") errors.push(m.text().slice(0, 300));
        if (m.text().startsWith("[ants]")) console.log(name, m.text().slice(0, 600));
    });
    await page.goto(`${base}?scene=${name}&quality=high${process.argv.includes("--rain") ? "&rain=1" : ""}`, {waitUntil: "domcontentloaded", timeout: 120000});
    try {
        await page.waitForFunction(() => window.__ants || window.__antsError, null, {timeout: 300000});
    } catch (error) {
        console.log(name, "no harness:", error.message.split("\n")[0], errors.slice(0, 5));
        await context.close();
        continue;
    }
    const failed = await page.evaluate(() => window.__antsError ?? null);
    if (failed) {
        console.log(name, "harness error:", failed.slice(0, 500));
        await context.close();
        continue;
    }
    const info = await page.evaluate(() => window.__ants.info());
    const c = info.colony;
    const nest = c.nest;
    const TICK = (86400 * 14) / 365;
    let shots = [];
    if (info.death) {
        const d = info.death;
        const until = d.t0 + 17 * 60;
        // A probe while it is busy: when the colony found the body and the finder got home.
        await page.evaluate(([t, at]) => window.__ants.shot(t, 1, at), [until - 60, {x: d.x, z: d.z}]);
        const probe = await page.evaluate(() => window.__ants.info());
        const plan = probe.colony.plan;
        console.log(name, "plan", JSON.stringify(plan));
        const pts = plan.path;
        const at = (k) => pts[Math.round(k * 10)];
        const near = name === "ghost" ? 0.09 : name === "fire" ? 0.16 : 0.22;
        const finder = (t) => at(1 - Math.min(Math.max((t - plan.found) / Math.max(plan.home - plan.found, 1), 0), 1));
        const lo = name === "weaver" ? 0.6 : 0.5;
        // Weaver ants: their crown first (the leaf nests, searchers along the branches, the trail between nests).
        const cz = c.canopy;
        const crown = cz
            ? [
                  [d.t0 - 20, 0.5, cz.nests[0], "the leaf nest, searchers on its branches"],
                  [d.t0 - 20, 1.6, cz.nests[0], "the crown: nests and branches"],
                  [d.t0 - 20, 0.3, cz.branches[1], "searchers along a branch"],
                  ...(cz.between ? [[d.t0 - 20, 0.6, cz.between[3], "the trail between two leaf nests"], [d.t0 - 20, 0.4, cz.between[9], "the trail out to the other nest"]] : [])
              ]
            : [];
        shots = [
            ...crown,
            [d.t0 - 20, near * 2.5, at(0), "before: the nest, searching round it (no food yet)"],
            [d.t0 - 20, near, at(0.3), "before: searchers (no trail, no find)"],
            [plan.found + (plan.home - plan.found) * 0.5, near, finder(plan.found + (plan.home - plan.found) * 0.5), "the finder heads home laying the trail"],
            [plan.home + 15, near, at(lo), "forming: the first recruits"],
            [plan.home + 45, near, at(lo), "forming: more on it"],
            [plan.home + 300, near, at(lo), "busy: both ways, pieces carried home"],
            [plan.home + 300, near * 1.6, at(1), "busy: at the body"],
            [plan.home + 300, near * 4, at(lo), "busy: the trail from higher"],
            [until + 60, near, at(lo), "fading: the body is gone"],
            [until + 125, near, at(lo), "faded: searching again"]
        ];
    } else if (c.plant) {
        const t = info.date + 60;
        await page.evaluate(([t, at]) => window.__ants.shot(t, 2, at), [t, nest]);
        const pts = (await page.evaluate(() => window.__ants.info())).colony.plan.path;
        const at = (k) => pts[Math.round(k * 10)];
        shots = [
            [t, 2.2, nest, "the mound and its highway"],
            [t, 0.25, at(0.1), "the highway leaving the mound"],
            [t, 0.12, at(0.4), "leaf pieces carried home, held upright"],
            [t + 20, 0.12, at(0.6), "the highway, both ways"],
            [t, 0.7, at(0.5), "the cleared highway from higher"],
            [t, 0.3, at(1), "up the plant"]
        ];
    } else if (c.slug === "eciton-army-ant" || c.slug === "driver-ant") {
        const tick = Math.floor(info.date / TICK) + 1;
        const raidAt = async (u) => {
            await page.evaluate(([t, at]) => window.__ants.shot(t, 30, at), [(tick + u) * TICK, nest]);
            return (await page.evaluate(() => window.__ants.info())).colony.raid;
        };
        shots = [];
        for (const [u, dist, where, label] of [[0.12, 0.35, "front", "the raid sets out: the swarm front"], [0.4, 0.3, "front", "the broad swarm front"], [0.4, 0.9, "front", "the swarm front from higher"], [0.4, 0.25, "column", "the column behind it"], [0.6, 0.9, "bivouac", "the bivouac"], [0.93, 0.25, "move", "the bivouac moves: workers carry brood"]]) {
            const r = await raidAt(u);
            const hx = Math.cos(r.heading);
            const hz = Math.sin(r.heading);
            const p = where === "front" ? {x: r.bivouac.x + hx * (r.front - 0.05), z: r.bivouac.z + hz * (r.front - 0.05)} : where === "column" ? {x: r.bivouac.x + hx * r.front * 0.5, z: r.bivouac.z + hz * r.front * 0.5} : where === "move" ? {x: r.bivouac.x + (r.next.x - r.bivouac.x) * 0.05, z: r.bivouac.z + (r.next.z - r.bivouac.z) * 0.05} : {x: r.bivouac.x, z: r.bivouac.z};
            shots.push([(tick + u) * TICK, dist, p, label]);
        }
    } else {
        const t = info.date + 60;
        shots = [[t, 0.6, nest, "the nest"], [t, 0.2, nest, "close"]];
    }
    const dir = path.join(out, name);
    rmSync(dir, {recursive: true, force: true});
    mkdirSync(dir, {recursive: true});
    const labels = [];
    for (let i = 0; i < shots.length; i++) {
        const [t, distance, at, label] = shots[i];
        const note = await page.evaluate(async ([t, distance, at, label]) => {
            const text = await window.__ants.shot(t, distance, at, 0.8);
            document.getElementById("note").textContent = `${label}\n${text}`;
            return text;
        }, [t, distance, at, label]);
        labels.push(`${String(i).padStart(2, "0")} ${label}: ${note}`);
        await page.screenshot({path: path.join(dir, `${String(i).padStart(2, "0")}.jpg`), type: "jpeg", quality: 85});
    }
    writeFileSync(path.join(dir, "labels.txt"), labels.join("\n") + "\n");
    const cols = 3;
    const rows = Math.ceil(shots.length / cols);
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", "1", "-i", path.join(dir, "%02d.jpg"), "-vf", `scale=640:-1,tile=${cols}x${rows}:padding=4:color=black`, "-frames:v", "1", path.join(out, `${name}-strip.jpg`)]);
    summary[name] = {info, errors: errors.slice(0, 10), shots: labels};
    console.log(name, labels.join("\n"));
    if (errors.length) console.log(name, "errors:", errors.slice(0, 5));
    await context.close();
}
writeFileSync(path.join(out, "summary.json"), JSON.stringify(summary, null, 1));
await browser.close();
server.close();
