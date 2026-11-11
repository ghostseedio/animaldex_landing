#!/usr/bin/env node
/**
 * The liveliness wiring's look-at-it harness (docs/ark/liveliness-wiring.md):
 * the live scene on the v2 fixture (the golden shots' entry), driven through
 * its handle into rain, a tide's turn, a young one at its parent's heel and a
 * walker's footprints, with frames saved for each (and a contact sheet and a
 * short clip where ffmpeg and Pillow are on the machine).
 *
 *   node scripts/ark-liveliness-clips.mjs --out <dir> [--only rain,tide,young,prints] [--device desktop|phone] [--headed]
 *
 * Reads the public model bucket; nothing is written anywhere but `--out`.
 */

import {execFileSync} from "node:child_process";
import {createServer} from "node:http";
import {existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync} from "node:fs";
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
const out = path.resolve(arg("out", path.join(root, ".ark-golden", "liveliness")));
const only = arg("only", "rain,tide,young,prints").split(",");
const deviceName = arg("device", "desktop");
mkdirSync(out, {recursive: true});

const DEVICES = {
    desktop: {viewport: {width: 1280, height: 760}, deviceScaleFactor: 1, isMobile: false, hasTouch: false},
    phone: {viewport: {width: 360, height: 760}, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: "Mozilla/5.0 (Linux; Android 14; SM-A356B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36"}
};

// MARK: build + serve (as scripts/ark-golden-shots.mjs)

const site = path.join(root, ".ark-golden", "site-liveliness");
mkdirSync(site, {recursive: true});
await build({
    entryPoints: [path.join(root, "src/ark-scene/golden-entry.ts")],
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
writeFileSync(path.join(site, "golden.html"), `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover">
<style>html,body{margin:0;height:100%;background:#ecdcc4;overflow:hidden}#ark{position:fixed;inset:0}</style>
</head><body><div id="ark"></div><script src="./golden-scene.js"></script></body></html>`);
const server = createServer((request, response) => {
    const url = new URL(request.url, "http://localhost");
    const fromPublic = url.pathname.startsWith("/ark/");
    const folder = fromPublic ? path.join(root, "public") : site;
    const file = path.join(folder, path.normalize(url.pathname).replace(/^\/+/, "") || "golden.html");
    if (!file.startsWith(folder) || !existsSync(file)) {
        response.writeHead(404).end();
        return;
    }
    const type = file.endsWith(".html") ? "text/html" : file.endsWith(".js") ? "text/javascript" : file.endsWith(".webp") ? "image/webp" : "application/octet-stream";
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

const {chromium} = await import("playwright-core");
const browser = await chromium.launch({
    executablePath: process.env.ARK_CHROMIUM || cachedChromium() || undefined,
    headless: !flag("headed"),
    args: [...(flag("headed") ? [] : ["--headless=new"]), "--enable-gpu", "--ignore-gpu-blocklist", "--use-angle=metal", "--disable-background-timer-throttling", "--disable-renderer-backgrounding"]
});
const context = await browser.newContext(DEVICES[deviceName]);
const page = await context.newPage();
// Every request for the sounds bucket, to show nothing is fetched before sound is turned on.
const soundRequests = [];
page.on("request", (request) => {
    if (/animal-chat-sounds|\/ark\/sound\//.test(request.url())) soundRequests.push({at: Date.now(), url: request.url()});
});
const errors = [];
page.on("pageerror", (error) => errors.push(String(error)));
page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
});
await page.goto(`${base}/golden.html`);
await page.waitForFunction(() => window.__arkGolden || window.__arkGoldenError, null, {timeout: 180_000});
const failed = await page.evaluate(() => window.__arkGoldenError);
if (failed) throw new Error(failed);
const log = (...parts) => console.log(new Date().toISOString().slice(11, 19), ...parts);
log("preparing");
await page.evaluate(() => window.__arkGolden.prepare());
log("prepared");

const wait = (ms) => page.waitForTimeout(ms);
const CALM = {seaLevel: 0, wetness: 0, snow: 0, wind: 0.35, storm: 0, windDirection: 0.41, cloud: 0.35, rain: 0, fog: 0};
const frames = {};
async function frame(name, key) {
    const file = `${key}-${name}.png`;
    await page.screenshot({path: path.join(out, file)});
    (frames[key] ??= []).push(file);
    const stats = await page.evaluate(() => window.__arkGolden.handle.stats().liveliness);
    log(key, name, JSON.stringify(stats));
    return stats;
}
/** Point the camera at a spot from `distance` m (polar from straight down, azimuth round). */
async function look(target, distance, polar = 1.12, azimuth = 0.6) {
    await page.evaluate(([t, d, p, a]) => window.__arkGolden.handle.setView({target: t, distance: d, polar: p, azimuth: a}), [target, distance, polar, azimuth]);
}
/** The scene's entries as plain rows (id, slug, zone, origin, where it is drawn now, moving, doing). */
async function animals() {
    return page.evaluate(() => window.__arkDebug.entries().map((e) => ({id: e.animal.id, slug: e.animal.model_slug, zone: e.animal.zone, origin: e.animal.origin ?? null, born: e.animal.born_ark_day ?? null, x: e.middle?.x ?? e.place.x, y: e.middle?.y ?? e.place.ground, z: e.middle?.z ?? e.place.z, length: e.length, moving: Boolean(e.sched?.pose?.moving), doing: e.sched?.pose?.doing ?? null, sched: Boolean(e.sched), water: Boolean(e.depth || e.place.water)})));
}

const notes = {};

if (only.includes("rain")) {
    // A herd in the grassland: dry, then the rain comes in and they go to cover (each at its own moment).
    await page.evaluate((calm) => window.__arkGolden.handle.setEnvironment(calm), CALM);
    await page.evaluate(() => window.__arkGolden.handle.setHours(10.5));
    const list = await animals();
    const herd = list.filter((a) => a.zone === "grassland" && a.sched && !a.water);
    const centre = herd.length ? {x: herd.reduce((s, a) => s + a.x, 0) / herd.length, y: 0, z: herd.reduce((s, a) => s + a.z, 0) / herd.length} : {x: 0, y: 0, z: 0};
    centre.y = await page.evaluate((c) => window.__arkGolden.handle.heightAt(c.x, c.z), centre);
    await look(centre, 34, 1.18, 2.2);
    await wait(2500);
    await frame("00-dry", "rain");
    await page.evaluate(() => window.__arkGolden.handle.setEnvironment({seaLevel: 0, wetness: 0.85, snow: 0, wind: 0.62, storm: 0.25, windDirection: 0.41, cloud: 0.95, rain: 0.9, fog: 0.15}));
    let last = 0;
    for (const t of [2, 8, 16, 26, 40, 55]) {
        await wait((t - last) * 1000);
        last = t;
        notes[`rain-${t}s`] = await frame(`${String(t).padStart(2, "0")}s`, "rain");
    }
    await page.evaluate((calm) => window.__arkGolden.handle.setEnvironment(calm), CALM);
    await wait(30_000);
    notes["rain-after"] = await frame("99-after", "rain");
}

if (only.includes("tide")) {
    // The shore at low, mean and high water (the sea level pinned in steps, the weather calm).
    await page.evaluate(() => window.__arkGolden.shoot("coast_rocks", "day"));
    for (const [name, level] of [["1-low", -0.35], ["2-mean", 0], ["3-high", 0.35]]) {
        await page.evaluate(([calm, sea]) => window.__arkGolden.handle.setEnvironment({...calm, seaLevel: sea}), [CALM, level]);
        await wait(2500);
        notes[`tide-${name}`] = await frame(name, "tide");
    }
    // A beach animal's view, low to high.
    const list = await animals();
    const beach = list.find((a) => a.zone === "seashore" && !a.water && a.sched);
    if (beach) {
        await look({x: beach.x, y: 0.2, z: beach.z}, 14, 1.2, 1.0);
        for (const [name, level] of [["4-beach-low", -0.35], ["5-beach-high", 0.35]]) {
            await page.evaluate(([calm, sea]) => window.__arkGolden.handle.setEnvironment({...calm, seaLevel: sea}), [CALM, level]);
            await wait(2500);
            notes[`tide-${name}`] = await frame(name, "tide");
        }
    }
    await page.evaluate((calm) => window.__arkGolden.handle.setEnvironment(calm), CALM);
}

if (only.includes("young")) {
    await page.evaluate((calm) => window.__arkGolden.handle.setEnvironment(calm), CALM);
    const list = await animals();
    const young = list.find((a) => a.origin === "born");
    if (young) {
        const age = await page.evaluate((id) => {
            const e = window.__arkDebug.entries().find((x) => x.animal.id === id);
            const a = window.__arkDebug.liveliness.ageOf(e);
            return a ? {stage: a.stage, scale: a.scale, follow: a.follow, carried: a.carried, play: a.play, care: a.care, ageDays: a.ageDays} : null;
        }, young.id);
        notes.youngAge = age;
        log("young", young.id, young.slug, JSON.stringify(age));
        // The world's clock three times faster (a short time-lapse), so the parent walks while we watch.
        await page.evaluate(() => window.__arkGolden.handle.setClockScale(3));
        const track = [];
        for (let i = 0; i < 20; i++) {
            const all = await animals();
            const now = all.find((a) => a.id === young.id);
            const parent = age?.follow ? all.find((a) => a.id === age.follow.parentId) : null;
            const mid = parent ? {x: (now.x + parent.x) / 2, y: (now.y + parent.y) / 2, z: (now.z + parent.z) / 2} : {x: now.x, y: now.y, z: now.z};
            await look(mid, 10, 1.15, 0.9);
            await wait(800);
            track.push(parent ? {i, gap: Math.round(Math.hypot(now.x - parent.x, now.z - parent.z) * 100) / 100, parent: [Math.round(parent.x * 10) / 10, Math.round(parent.z * 10) / 10], young: [Math.round(now.x * 10) / 10, Math.round(now.z * 10) / 10], parentLength: Math.round(parent.length * 100) / 100, youngLength: Math.round(now.length * 100) / 100} : {i});
            await frame(String(i).padStart(2, "0"), "young");
        }
        notes.youngTrack = track;
        log("young track", JSON.stringify(track));
        await page.evaluate(() => window.__arkGolden.handle.setClockScale(1));
    }
}

if (only.includes("prints")) {
    await page.evaluate((calm) => window.__arkGolden.handle.setEnvironment({...calm, wetness: 0.4}), CALM);
    // A walker on sand: the desert's camels first, then the shore's and anyone else on the move.
    const list = (await animals()).filter((a) => a.sched && !a.water && a.zone !== "open_ocean");
    const big = list.filter((a) => a.length > 0.9);
    const order = [...big.filter((a) => a.zone === "desert"), ...big.filter((a) => ["seashore", "polar", "wetland", "farm_garden"].includes(a.zone)), ...big];
    await page.evaluate(() => window.__arkGolden.handle.setClockScale(2));
    let chosen = null;
    for (const a of order.slice(0, 18)) {
        const before = await page.evaluate(() => window.__arkDebug.liveliness.traces.counts.prints);
        const at = (await animals()).find((x) => x.id === a.id);
        await look({x: at.x, y: at.y, z: at.z}, 8, 0.9, 0.4);
        await wait(6000);
        const after = await page.evaluate(() => window.__arkDebug.liveliness.traces.counts.prints);
        log("prints try", a.slug, a.zone, after - before);
        if (after - before >= 4) {
            chosen = a;
            break;
        }
    }
    if (chosen) {
        notes.printsWalker = chosen.slug;
        for (let i = 0; i < 6; i++) {
            await wait(3000);
            const at = (await animals()).find((x) => x.id === chosen.id);
            await look({x: at.x, y: at.y, z: at.z}, 5 + i * 0.6, 0.8, 0.4 + i * 0.25);
            await wait(400);
            await frame(String(i), "prints");
        }
    }
    await page.evaluate(() => window.__arkGolden.handle.setClockScale(1));
}

if (only.includes("printtest")) {
    // The print shader itself: a deer-sized walker stepped across the desert's sand beside the camera, and a bird's.
    await page.evaluate((calm) => window.__arkGolden.handle.setEnvironment({...calm, wetness: 0.5}), CALM);
    const sand = (await animals()).find((a) => a.zone === "desert") ?? {x: 40, z: 40};
    const ground = await page.evaluate((p) => window.__arkGolden.handle.heightAt(p.x, p.z), sand);
    await look({x: sand.x + 6, y: ground, z: sand.z + 6}, 6, 0.75, 0.3);
    await wait(1500);
    await page.evaluate(([x, z]) => {
        const L = window.__arkDebug.liveliness;
        const H = window.__arkGolden.handle;
        const env = L.environment;
        const t0 = L.traces.time.value;
        for (const [id, dz, length, bird] of [["probe-deer", 0, 1.6, false], ["probe-bird", 1.6, 0.6, true]]) {
            for (let i = 0; i <= 120; i++) {
                const px = x + 3 + i * 0.05;
                const pz = z + 6 + dz;
                L.traces.observe({id, x: px, y: H.heightAt(px, pz), z: pz, yaw: Math.PI / 2, length, onGround: true, atSurface: false, bird, distance: 5}, t0 - (120 - i) * 0.05, env);
            }
        }
    }, [sand.x, sand.z]);
    await wait(1200);
    notes.printtest = await frame("probe", "printtest");
    // What the print mesh holds, and the same view with depth testing off (a depth problem or a shader problem).
    notes.printDebug = await page.evaluate(() => {
        const prints = window.__arkDebug.liveliness.traces.prints;
        const m = prints.mesh;
        const first = Array.from(m.instanceMatrix.array.slice(0, 16)).map((v) => Math.round(v * 1000) / 1000);
        const attr = Array.from(prints.attribute.array.slice(0, 8)).map((v) => Math.round(v * 1000) / 1000);
        return {count: m.count, visible: m.visible, inScene: Boolean(m.parent?.parent?.parent), now: m.material.uniforms.now.value, first, attr, camera: window.__arkDebug.camera.position.toArray().map((v) => Math.round(v * 100) / 100)};
    });
    log("print debug", JSON.stringify(notes.printDebug));
}

if (only.includes("sound")) {
    // Off until the tap: no context, no request. Then on (the harness's click stands for the viewer's tap).
    await page.evaluate((calm) => window.__arkGolden.handle.setEnvironment(calm), CALM);
    await page.evaluate(() => window.__arkGolden.shoot("forest_floor", "day"));
    // Dawn: the chorus (birds, frogs and mammals with a voice call most).
    await page.evaluate(() => window.__arkGolden.handle.setHours(6.3));
    await wait(3000);
    const before = await page.evaluate(() => ({unlocked: window.__arkDebug.liveliness.audio.unlocked, sound: window.__arkGolden.handle.sound()}));
    notes.soundBefore = {...before, requests: soundRequests.length};
    log("sound before", JSON.stringify(notes.soundBefore));
    await page.evaluate(() => {
        const button = document.createElement("button");
        button.id = "sound-tap";
        button.textContent = "sound";
        Object.assign(button.style, {position: "fixed", left: "8px", top: "8px", zIndex: "9"});
        button.onclick = () => window.__arkGolden.handle.setSound(true);
        document.body.appendChild(button);
    });
    await page.click("#sound-tap");
    for (let i = 0; i < 16; i++) {
        await wait(2500);
        const now = await page.evaluate(() => ({stats: window.__arkGolden.handle.stats().liveliness, counts: window.__arkDebug.liveliness.audio.counts, credits: window.__arkGolden.handle.sound().credits.length}));
        log("sound", i, JSON.stringify(now));
        notes[`sound-${i}`] = now;
    }
    // A storm: the storm bed, and thunder after the flashes.
    await page.evaluate((calm) => window.__arkGolden.handle.setEnvironment({...calm, storm: 1, rain: 1, wind: 0.8, wetness: 0.9, cloud: 1}), CALM);
    for (let i = 0; i < 12; i++) {
        await wait(3000);
        const now = await page.evaluate(() => ({counts: window.__arkDebug.liveliness.audio.counts, beds: window.__arkDebug.liveliness.audio.activity().beds}));
        log("storm", i, JSON.stringify(now));
        notes[`storm-${i}`] = now;
    }
    await page.evaluate((calm) => window.__arkGolden.handle.setEnvironment(calm), CALM);
    notes.soundRequests = soundRequests.length;
    notes.soundUrls = soundRequests.slice(0, 12).map((r) => r.url.replace(/^https:\/\/[^/]+/, ""));
    await page.evaluate(() => window.__arkGolden.handle.setSound(false));
}

writeFileSync(path.join(out, "notes.json"), JSON.stringify({frames, notes, errors}, null, 2));
if (errors.length) log(errors.length, "page errors:", errors.slice(0, 4).join(" | ").slice(0, 600));
await browser.close();
server.close();

// Contact sheets (Pillow) and clips (ffmpeg), where the machine has them.
for (const [key, files] of Object.entries(frames)) {
    try {
        execFileSync("python3", ["-c", `
import sys, PIL.Image as I
files = sys.argv[2:]
ims = [I.open(f).convert("RGB") for f in files]
w, h = ims[0].size
cols = 3 if len(ims) > 4 else len(ims)
scale = 0.5 if w > 800 else 1.0
tw, th = int(w * scale), int(h * scale)
rows = (len(ims) + cols - 1) // cols
sheet = I.new("RGB", (tw * cols, th * rows), (20, 20, 20))
for i, im in enumerate(ims):
    sheet.paste(im.resize((tw, th)), ((i % cols) * tw, (i // cols) * th))
sheet.save(sys.argv[1], quality=88)
`, path.join(out, `${key}-sheet.jpg`), ...files.map((f) => path.join(out, f))]);
    } catch (error) {
        log("sheet", key, String(error).slice(0, 200));
    }
    if (files.length >= 6) {
        try {
            execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", "2", "-pattern_type", "glob", "-i", path.join(out, `${key}-*.png`), "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2", "-pix_fmt", "yuv420p", path.join(out, `${key}.mp4`)]);
        } catch (error) {
            log("clip", key, String(error).slice(0, 200));
        }
    }
}
log("wrote", out);
