#!/usr/bin/env tsx
/**
 * ARK-FISH picture strips: the live scene (the golden v2 world) with the leaping kinds added to the fixture (labelled:
 * a picture fixture, not the Ark's population), the world clock pinned through one of each animal's own seeded leaps
 * (`water-leaps.ts`), the camera on it, a frame at each beat of the leap, then one contact sheet per kind.
 *
 *   npx tsx scripts/ark-fish-strips.mts [--out <dir>] [--kinds spinner-dolphin,...] [--frames 8]
 */

import {createServer} from "node:http";
import {execFileSync} from "node:child_process";
import {existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync} from "node:fs";
import os from "node:os";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {build} from "esbuild";
import {leapsInTick, leapSpec, LEAP_TICK_SECONDS, type LeapStep} from "../src/ark-scene/water-leaps";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const arg = (name: string, fallback: string) => {
    const at = process.argv.indexOf(`--${name}`);
    return at > 0 && process.argv[at + 1] && !process.argv[at + 1].startsWith("--") ? process.argv[at + 1] : fallback;
};
const out = path.resolve(arg("out", path.join(os.homedir(), "AnimalDex-work", "ark-fish", "strips")));
const KINDS = arg("kinds", "spinner-dolphin,dusky-dolphin,flathead-grey-mullet,tropical-two-wing-flyingfish,southern-right-whale,spotted-eagle-ray,commersons-dolphin").split(",");
const FRAMES = Number(arg("frames", "8"));
mkdirSync(out, {recursive: true});

// The picture fixture: the golden v2 snapshot, with one of each leaping kind cloned from its humpback's row (open ocean).
const fixture = JSON.parse(readFileSync(path.join(root, "src/ark-scene/fixtures/snapshot-v2.json"), "utf8"));
const template = fixture.animals.find((a: {model_slug: string}) => a.model_slug === "humpback-whale");
const NAMES: Record<string, string> = {"spinner-dolphin": "Spinner Dolphin", "dusky-dolphin": "Dusky Dolphin", "flathead-grey-mullet": "Flathead Grey Mullet", "tropical-two-wing-flyingfish": "Tropical Two-wing Flyingfish", "southern-right-whale": "Southern Right Whale", "spotted-eagle-ray": "Spotted Eagle Ray", "commersons-dolphin": "Commerson's Dolphin", "atlantic-tarpon": "Atlantic Tarpon"};
const ids: Record<string, string> = {};
KINDS.forEach((slug, i) => {
    const id = `00000000-f150-4000-8000-${String(i + 1).padStart(12, "0")}`;
    ids[slug] = id;
    fixture.animals.push({...template, id, model_slug: slug, name: NAMES[slug] ?? slug, scientific_name: "", species_profile_id: `00000000-f151-4000-8000-${String(i + 1).padStart(12, "0")}`, slot: 40 + i, activity: "d"});
});

const site = path.join(out, "site");
mkdirSync(site, {recursive: true});
writeFileSync(path.join(site, "population.json"), JSON.stringify(fixture));
writeFileSync(path.join(site, "entry.ts"), `import "${path.join(root, "src/ark-scene/golden-entry.ts")}";\nimport {pinArkClock} from "${path.join(root, "src/ark-scene/shared-clock.ts")}";\n(window as any).__pinArk = pinArkClock;\n`);
await build({
    entryPoints: [path.join(site, "entry.ts")],
    outfile: path.join(site, "golden-scene.js"),
    bundle: true,
    format: "iife",
    platform: "browser",
    target: ["es2020"],
    minify: true,
    tsconfig: path.join(root, "tsconfig.json"),
    define: {"process.env.NODE_ENV": JSON.stringify("development")},
    logLevel: "warning"
});
writeFileSync(path.join(site, "golden.html"), `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Ark fish strips</title><style>html,body{margin:0;height:100%;background:#ecdcc4;overflow:hidden}#ark{position:fixed;inset:0}</style></head><body><div id="ark"></div><script src="./golden-scene.js"></script></body></html>`);
const server = createServer((request, response) => {
    const url = new URL(request.url!, "http://localhost");
    const fromPublic = url.pathname.startsWith("/ark/");
    const folder = fromPublic ? path.join(root, "public") : site;
    const file = path.join(folder, path.normalize(url.pathname).replace(/^\/+/, "") || "golden.html");
    if (!file.startsWith(folder) || !existsSync(file)) return response.writeHead(404).end();
    const type = file.endsWith(".html") ? "text/html" : file.endsWith(".js") ? "text/javascript" : file.endsWith(".json") ? "application/json" : file.endsWith(".webp") ? "image/webp" : file.endsWith(".wasm") ? "application/wasm" : "application/octet-stream";
    response.writeHead(200, {"Content-Type": type, "Cache-Control": "no-store"}).end(readFileSync(file));
});
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${(server.address() as {port: number}).port}`;

function cachedChromium() {
    const cache = path.join(os.homedir(), "Library", "Caches", "ms-playwright");
    if (!existsSync(cache)) return null;
    for (const name of readdirSync(cache).filter((entry) => /^chromium-\d+$/.test(entry)).sort().reverse()) {
        const candidate = path.join(cache, name, "chrome-mac-arm64", "Google Chrome for Testing.app", "Contents", "MacOS", "Google Chrome for Testing");
        if (existsSync(candidate)) return candidate;
    }
    return null;
}
const {chromium} = await import("playwright-core");
const browser = await chromium.launch({executablePath: process.env.ARK_CHROMIUM || cachedChromium() || undefined, args: ["--headless=new", "--enable-gpu", "--ignore-gpu-blocklist", "--use-angle=metal", "--disable-background-timer-throttling", "--disable-renderer-backgrounding"]});
// A phone's view (390 × 844 CSS px at 3×): the splash, the arc and the rings must read at phone distance.
const context = await browser.newContext({viewport: {width: 390, height: 844}, deviceScaleFactor: 2});
const page = await context.newPage();
const errors: string[] = [];
page.on("pageerror", (error) => errors.push(String(error)));
await page.goto(`${base}/golden.html?world=v2&population=./population.json`, {waitUntil: "domcontentloaded", timeout: 180_000});
await page.waitForFunction(() => (window as any).__arkGolden || (window as any).__arkGoldenError, null, {timeout: 180_000});
const failed = await page.evaluate(() => (window as any).__arkGoldenError);
if (failed) throw new Error(failed);
await page.evaluate(() => (window as any).__arkGolden.prepare());
await page.evaluate(() => (window as any).__arkGolden.handle.setHours(11));

const report: unknown[] = [];
for (const slug of KINDS) {
    const id = ids[slug];
    const spec = leapSpec(slug)!;
    // Its first leaps after a fixed moment: the first one where it is awake and drawn.
    const fromTick = Math.floor(Date.UTC(2026, 10, 23, 3) / 1000 / LEAP_TICK_SECONDS);
    const steps: LeapStep[] = [];
    for (let t = fromTick; steps.length < 6 && t < fromTick + 60; t++) steps.push(...leapsInTick(id, slug, 1, t));
    let done = false;
    for (const step of steps.slice(0, 6)) {
        if (done) break;
        // (Its true length decides the leap's shape: read it from the scene, then its steps again with it.)
        await page.evaluate((s) => (window as any).__pinArk(s), step.from - 3);
        for (let i = 0; i < 20; i++) await page.evaluate(() => new Promise((r) => requestAnimationFrame(r)));
        const info = await page.evaluate((who) => {
            const debug = (window as any).__arkDebug;
            const e = debug.entries().find((x: any) => x.animal.id === who);
            return e ? {trueLength: e.trueLength, asleep: e.state.asleep, depth: Boolean(e.depth)} : null;
        }, id);
        if (!info || info.asleep) continue;
        const own = leapsInTick(id, slug, info.trueLength, Math.floor(step.from / LEAP_TICK_SECONDS)).find((s) => Math.abs(s.from - step.from) < 1e-6);
        if (!own) continue;
        const span = own.to - own.from;
        const files: string[] = [];
        for (let f = 0; f < FRAMES; f++) {
            const t = spec.style === "sail" ? [0, 3, 6, 20, 60, own.back - own.from - 2, own.back - own.from + 1, span][f] ?? span : (f / (FRAMES - 1)) * Math.min(span, own.back - own.from + 2.4);
            await page.evaluate((s) => (window as any).__pinArk(s), own.from + t - 0.25);
            const where = await page.evaluate(async (who) => {
                const golden = (window as any).__arkGolden;
                const frame = () => new Promise((r) => requestAnimationFrame(r));
                let at = golden.handle.locate(who);
                for (let i = 0; i < 6; i++) {
                    at = golden.handle.locate(who);
                    if (at) golden.handle.setView({target: {x: at.x, y: 0.6, z: at.z}, distance: Math.max(at.length * 7, 9), polar: 1.32, azimuth: (at.yaw ?? 0) + Math.PI / 2});
                    await frame();
                }
                return at;
            }, id);
            const file = path.join(out, `${slug}-${String(f).padStart(2, "0")}.png`);
            await page.screenshot({path: file});
            files.push(file);
            if (!where) break;
        }
        const sheet = path.join(out, `${slug}-strip.png`);
        execFileSync("montage", [...files, "-tile", `${FRAMES}x1`, "-geometry", "260x563+4+4", "-background", "#222", "-title", `${NAMES[slug] ?? slug} · ${spec.style} · "${spec.quote.slice(0, 90)}"`, "-fill", "white", "-pointsize", "18", sheet]);
        report.push({slug, id, from: own.from, style: own.style, apex: own.apex, turns: own.turns, run: own.run, span, sheet});
        console.log(slug, own.style, `apex ${own.apex.toFixed(2)} m`, `span ${span.toFixed(1)} s`, sheet);
        done = true;
    }
    if (!done) console.log(slug, "no awake leap found in range");
}
if (errors.length) console.log(errors.length, "page errors:", errors.slice(0, 3).join(" | ").slice(0, 600));
writeFileSync(path.join(out, "strips.json"), JSON.stringify(report, null, 2));
await browser.close();
server.close();
