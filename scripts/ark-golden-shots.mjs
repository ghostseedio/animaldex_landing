#!/usr/bin/env node
/**
 * The Ark graphics pass's golden-shot harness (docs/ark/graphics-step1.md).
 *
 * Builds `src/ark-scene/golden-entry.ts` into `.ark-golden/site/` (gitignored),
 * serves it on localhost, and drives Playwright's cached Chromium
 * (playwright-core, Apache-2.0, already a dev dependency) through every
 * golden shot: 7 named places × day/dusk/night × desktop/phone. Each shot is
 * a PNG plus its numbers (frame interval p50/p95, the scene's CPU ms, the
 * GPU's drain ms, draw calls, triangles, tier).
 *
 *   node scripts/ark-golden-shots.mjs --label before
 *   node scripts/ark-golden-shots.mjs --label before-gpu-proxy --devices phone --gpu swiftshader
 *   node scripts/ark-golden-shots.mjs --study natural,toon,real --label studies
 *   node scripts/ark-golden-shots.mjs --animals red-fox,mallard --label animal-look     (the animal-look pass:
 *            each species close up, the pass off ("before") then on ("after"); --wet adds a rain shot;
 *            --rigged red-fox,... adds a moving shot of those (the rig playing: the look on a skinned mesh);
 *            --detail adds a shot closer than a viewer can come, to judge the surface (the wet one is then close too);
 *            --measure-animals measures each; the close-up skins come from the local build,
 *            ~/animaldex-talking-models/ark-closeup, or --closeup-dir)
 *   options: --out <dir>  --devices desktop,phone  --places coast_rocks,...  --times day,night
 *            --quality auto|high|medium|low  --gpu metal|swiftshader  --measure <ms>  --headed
 *            --attach-timing  also time the scenery attach points' build (sampler.ts) after the models are in
 *
 * Devices (GOLDEN_DEVICES in golden-shots.ts):
 *   desktop  1440×900, DPR 1, no throttle, the host GPU
 *   phone    360×800, DPR 2, touch + Android UA, 8 cores / 4 GB reported,
 *            4× CPU throttle (DevTools Emulation.setCPUThrottlingRate)
 *   --gpu swiftshader  the GPU-limited proxy: WebGL on SwiftShader (software, on the CPU), so fill rate and
 *            shader cost dominate as they do on a phone's GPU. Pessimistic, and not a model of any one GPU.
 */

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

const PLACES = ["island_far", "coast_rocks", "forest_floor", "house_fields", "river_pond", "mountain", "reef_underwater", "reef_closeup", "kelp_forest", "caterpillar_leaf", "bee_flower", "limpet_tidepool", "gecko_wall", "ant_bark", "waves_beach", "storm_trees", "fields_close"];
const TIMES = ["day", "dusk", "night"];
const DEVICES = {
    desktop: {viewport: {width: 1440, height: 900}, deviceScaleFactor: 1, isMobile: false, hasTouch: false, cpuThrottle: 1},
    phone: {
        viewport: {width: 360, height: 800},
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
        cpuThrottle: 4,
        userAgent: "Mozilla/5.0 (Linux; Android 14; SM-A356B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36"
    }
};

const label = arg("label", "run");
const out = path.resolve(arg("out", path.join(root, ".ark-golden", "shots", label)));
const devices = arg("devices", "desktop,phone").split(",").filter((name) => DEVICES[name]);
const places = arg("places", PLACES.join(",")).split(",").filter((name) => PLACES.includes(name));
const times = arg("times", TIMES.join(",")).split(",").filter((name) => TIMES.includes(name));
const quality = arg("quality", "auto");
const gpu = arg("gpu", "metal");
const measureMs = Number(arg("measure", "3000"));
const studies = arg("study", "") ? arg("study", "").split(",") : [];
const animals = arg("animals", "") ? arg("animals", "").split(",") : [];
const rigged = new Set(arg("rigged", "") ? arg("rigged", "").split(",") : []);
// The shadow audit's animals: one id per --animals entry ("-" for any), and a fixed camera distance (m).
const animalIds = arg("ids", "") ? arg("ids", "").split(",") : [];
const fixedDistance = arg("distance", "") ? Number(arg("distance", "")) : undefined;
const closeUpDir = path.resolve(arg("closeup-dir", path.join(os.homedir(), "animaldex-talking-models", "ark-closeup")));
// The props lane's close-ups (src/ark-scene/props/golden-props.ts): --props all, or --props bird_nest,cave_roost
const PROPS_SHOTS = ["bird_nest", "nest_eyrie", "nest_heronry", "nest_weavers", "nest_growing", "nest_eaves", "nest_grebe", "ants_trunk", "web_dawn", "beehive_hollow", "house_night", "farm", "mountain_scree", "cave_roost", "turtle_nest", "snail_trail", "mist_dawn", "mist_meadow", "mist_shore", "hamlet_day", "hamlet_night", "hamlet_close_day", "hamlet_close_night"];
const propsShots = arg("props", "") ? (arg("props", "") === "all" ? PROPS_SHOTS : arg("props", "").split(",").filter((name) => PROPS_SHOTS.includes(name))) : [];

// MARK: build + serve

const site = path.join(root, ".ark-golden", "site");
mkdirSync(site, {recursive: true});
mkdirSync(out, {recursive: true});
await build({
    entryPoints: [path.join(root, "src/ark-scene/golden-entry.ts")],
    outfile: path.join(site, "golden-scene.js"),
    bundle: true,
    format: "iife",
    platform: "browser",
    target: ["es2020"],
    minify: true,
    tsconfig: path.join(root, "tsconfig.json"),
    // Development: the scene exposes __arkDebug (its three.js scene and camera), which the micro shots use to set a
    // species on an attach point. Nothing else in the scene reads NODE_ENV.
    define: {"process.env.NODE_ENV": JSON.stringify("development")},
    logLevel: "warning"
});
writeFileSync(path.join(site, "golden.html"), `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover">
<title>Ark golden shots</title>
<style>html,body{margin:0;height:100%;background:#ecdcc4;overflow:hidden}#ark{position:fixed;inset:0}</style>
</head><body><div id="ark"></div><script src="./golden-scene.js"></script></body></html>
`);

const server = createServer((request, response) => {
    const url = new URL(request.url, "http://localhost");
    // The scene's own art is served from public/ (as the site serves it); the page and its script from .ark-golden/site.
    // The animal-look pass's close-up skins from the local build (`/ark-closeup/<slug>/<version>.near.ktx2` → `<slug>/near.ktx2`).
    const closeUp = /^\/ark-closeup\/(?:(manifest\.json)|([a-z0-9-]+)\/[0-9a-f]{12}\.near\.ktx2)$/.exec(url.pathname);
    if (closeUp) {
        const file = closeUp[1] ? path.join(closeUpDir, "manifest.json") : path.join(closeUpDir, closeUp[2], "near.ktx2");
        if (!existsSync(file)) return response.writeHead(404).end();
        return response.writeHead(200, {"Content-Type": closeUp[1] ? "application/json" : "image/ktx2", "Cache-Control": "no-store"}).end(readFileSync(file));
    }
    const fromPublic = url.pathname.startsWith("/ark/graphics/") || url.pathname.startsWith("/ark/basis/") || url.pathname.startsWith("/ark/assets/");
    const folder = fromPublic ? path.join(root, "public") : site;
    const file = path.join(folder, path.normalize(url.pathname).replace(/^\/+/, "") || "golden.html");
    if (!file.startsWith(folder) || !existsSync(file)) {
        response.writeHead(404).end();
        return;
    }
    const type = file.endsWith(".html") ? "text/html" : file.endsWith(".js") ? "text/javascript" : file.endsWith(".webp") ? "image/webp" : file.endsWith(".wasm") ? "application/wasm" : file.endsWith(".glb") ? "model/gltf-binary" : file.endsWith(".json") ? "application/json" : "application/octet-stream";
    response.writeHead(200, {"Content-Type": type, "Cache-Control": "no-store"}).end(readFileSync(file));
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}`;

// MARK: browser

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
const gpuArgs = gpu === "swiftshader"
    ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--use-gl=angle"]
    : ["--enable-gpu", "--ignore-gpu-blocklist", ...(process.platform === "darwin" ? ["--use-angle=metal"] : [])];
const browser = await chromium.launch({
    executablePath: process.env.ARK_CHROMIUM || cachedChromium() || undefined,
    headless: !flag("headed"),
    args: [...(flag("headed") ? [] : ["--headless=new"]), ...gpuArgs, "--disable-background-timer-throttling", "--disable-renderer-backgrounding"]
});

const results = [];
const log = (...parts) => console.log(new Date().toISOString().slice(11, 19), ...parts);

async function openPage(deviceName, query) {
    const device = DEVICES[deviceName];
    const context = await browser.newContext({
        viewport: device.viewport,
        deviceScaleFactor: device.deviceScaleFactor,
        isMobile: device.isMobile,
        hasTouch: device.hasTouch,
        userAgent: device.userAgent
    });
    if (deviceName === "phone") {
        await context.addInitScript(() => {
            Object.defineProperty(navigator, "hardwareConcurrency", {get: () => 8});
            Object.defineProperty(navigator, "deviceMemory", {get: () => 4});
        });
    }
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(String(error)));
    page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
    });
    if (device.cpuThrottle > 1) {
        const cdp = await context.newCDPSession(page);
        await cdp.send("Emulation.setCPUThrottlingRate", {rate: device.cpuThrottle});
    }
    await page.goto(`${base}/golden.html?${query}`, {waitUntil: "domcontentloaded", timeout: 180_000});
    return {context, page, errors};
}

async function renderer(page) {
    return page.evaluate(() => {
        const gl = document.createElement("canvas").getContext("webgl2");
        const info = gl?.getExtension("WEBGL_debug_renderer_info");
        return info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : "unknown";
    });
}

if (flag("shadow-audit")) {
    // The contact-shadow audit: animals standing on ground far from their home spot's height (where a shadow used to lie).
    const {context, page} = await openPage(devices[0], quality === "auto" ? "" : `quality=${quality}`);
    await page.waitForFunction(() => window.__arkGolden || window.__arkGoldenError, null, {timeout: 120_000});
    await page.evaluate(() => window.__arkGolden.prepare());
    const rows = await page.evaluate((s) => window.__arkGolden.shadowAudit(s), Number(arg("seconds", "20")));
    writeFileSync(path.join(out, "shadow-audit.json"), JSON.stringify(rows, null, 1));
    log("shadow audit", rows.length, "animals off their home's ground; worst:", JSON.stringify(rows.slice(0, 12).map((r) => `${r.slug} ${r.off.toFixed(2)}`)));
    await context.close();
} else if (animals.length) {
    for (const deviceName of devices) {
        const query = [quality === "auto" ? "" : `quality=${quality}`, `closeup=${encodeURIComponent(`${base}/ark-closeup`)}`].filter(Boolean).join("&");
        const {context, page, errors} = await openPage(deviceName, query);
        await page.waitForFunction(() => window.__arkGolden || window.__arkGoldenError, null, {timeout: 120_000});
        const failed = await page.evaluate(() => window.__arkGoldenError);
        if (failed) throw new Error(failed);
        const gpuName = await renderer(page);
        const prepared = await page.evaluate(() => window.__arkGolden.prepare());
        log(deviceName, "prepared", JSON.stringify({settled: prepared.settled, tier: prepared.stats.tier, models: prepared.stats.modelsLoaded}));
        const variants = [
            {wetness: 0, suffix: "", moving: false, detail: false},
            ...(flag("detail") ? [{wetness: 0, suffix: "-detail", moving: false, detail: true}] : []),
            ...(flag("wet") ? [{wetness: 1, suffix: "-wet", moving: false, detail: flag("detail")}] : [])
        ];
        for (const time of times) {
            for (const slug of animals) {
                for (const variant of [...variants, ...(rigged.has(slug) ? [{wetness: 0, suffix: "-moving", moving: true, detail: false}] : [])]) {
                    for (const look of [false, true]) {
                        const shot = await page.evaluate(([s, t, o]) => window.__arkGolden.animal(s, t, o), [slug, time, {look, wetness: variant.wetness, still: !(variant.moving || flag("moving")), detail: variant.detail, ...(animalIds[animals.indexOf(slug)] && animalIds[animals.indexOf(slug)] !== "-" ? {id: animalIds[animals.indexOf(slug)]} : {}), ...(fixedDistance ? {distance: fixedDistance} : {})}]);
                        if (!shot.found) {
                            log(deviceName, slug, "not in the fixture");
                            break;
                        }
                        const file = `${deviceName}-${slug}-${time}${variant.suffix}-${look ? "after" : "before"}.png`;
                        await page.screenshot({path: path.join(out, file)});
                        const numbers = flag("measure-animals") ? await page.evaluate((ms) => window.__arkGolden.measure(ms), measureMs) : {};
                        results.push({device: deviceName, gpu, gpuName, place: slug, time: `${time}${variant.suffix} ${look ? "after" : "before"}`, file, clear: shot.clear, closeUpSkins: shot.closeUpSkins, furShells: shot.furShells, rigged: shot.rigged, ...numbers});
                        log(deviceName, slug, time + variant.suffix, look ? "after" : "before", JSON.stringify({clear: shot.clear, closeUp: shot.closeUpSkins, shells: shot.furShells, rigged: shot.rigged, ...numbers}));
                    }
                }
            }
        }
        if (errors.length) {
            writeFileSync(path.join(out, `errors-${deviceName}.txt`), errors.join("\n\n"));
            log(deviceName, errors.length, "page errors (errors-" + deviceName + ".txt)");
        }
        await context.close();
    }
} else if (propsShots.length) {
    for (const deviceName of devices) {
        const {context, page, errors} = await openPage(deviceName, `props=1${quality === "auto" ? "" : `&quality=${quality}`}`);
        await page.waitForFunction(() => window.__arkGolden || window.__arkGoldenError, null, {timeout: 120_000});
        const failed = await page.evaluate(() => window.__arkGoldenError);
        if (failed) throw new Error(failed);
        const gpuName = await renderer(page);
        const prepared = await page.evaluate(() => window.__arkGolden.prepare());
        log(deviceName, "prepared", JSON.stringify({settled: prepared.settled, tier: prepared.stats.tier, models: prepared.stats.modelsLoaded}));
        for (const shotName of propsShots) {
            const shot = await page.evaluate((name) => window.__arkGolden.shootProps(name), shotName);
            const file = `${deviceName}-props-${shotName}.png`;
            await page.screenshot({path: path.join(out, file)});
            const numbers = await page.evaluate((ms) => window.__arkGolden.measure(ms), measureMs);
            results.push({device: deviceName, gpu, gpuName, place: `props:${shotName}`, time: "-", file, anchor: shot.anchor, view: shot.actual, props: shot.props, ...numbers});
            log(deviceName, shotName, shot.anchor, `${numbers.intervalP50}ms p50 / ${numbers.intervalP95} p95, cpu ${numbers.cpuMs}, drain ${numbers.gpuDrainMs}, ${numbers.drawCalls} calls, ${numbers.triangles} tris, ${numbers.tier}`);
        }
        if (errors.length) {
            writeFileSync(path.join(out, `errors-${deviceName}.txt`), errors.join("\n\n"));
            log(deviceName, errors.length, "page errors (errors-" + deviceName + ".txt)");
        }
        await context.close();
    }
} else if (!studies.length) {
    for (const deviceName of devices) {
        const {context, page, errors} = await openPage(deviceName, quality === "auto" ? "" : `quality=${quality}`);
        await page.waitForFunction(() => window.__arkGolden || window.__arkGoldenError, null, {timeout: 120_000});
        const failed = await page.evaluate(() => window.__arkGoldenError);
        if (failed) throw new Error(failed);
        const gpuName = await renderer(page);
        log(deviceName, "preparing (every model in) on", gpuName);
        const prepared = await page.evaluate(() => window.__arkGolden.prepare());
        log(deviceName, "prepared", JSON.stringify({settled: prepared.settled, tier: prepared.stats.tier, models: prepared.stats.modelsLoaded}));
        if (flag("attach-timing")) {
            // The scenery attach points' build (sampler.ts), as the mount pays for it: sync, and sliced where offered.
            const timing = await page.evaluate(() => window.__arkGolden.attachTiming());
            log(deviceName, "attach points", JSON.stringify(timing));
            results.push({device: deviceName, attachTiming: timing});
        }
        for (const time of times) {
            for (const place of places) {
                const shot = await page.evaluate(([p, t]) => window.__arkGolden.shoot(p, t), [place, time]);
                const file = `${deviceName}-${place}-${time}.png`;
                await page.screenshot({path: path.join(out, file)});
                const numbers = await page.evaluate((ms) => window.__arkGolden.measure(ms), measureMs);
                results.push({device: deviceName, gpu, gpuName, place, time, file, anchor: shot.anchor, view: shot.actual, ...numbers});
                log(deviceName, place, time, `${numbers.intervalP50}ms p50 / ${numbers.intervalP95} p95, cpu ${numbers.cpuMs}, drain ${numbers.gpuDrainMs}, ${numbers.drawCalls} calls, ${numbers.triangles} tris, ${numbers.tier}`);
            }
        }
        if (errors.length) {
            writeFileSync(path.join(out, `errors-${deviceName}.txt`), errors.join("\n\n"));
            log(deviceName, errors.length, "page errors (errors-" + deviceName + ".txt):", errors.filter((e) => !/Failed to load resource/.test(e)).map((e) => e.split("\n").find((l) => /ERROR|Error/.test(l)) ?? e.slice(0, 160)).slice(0, 4).join(" | "));
        }
        await context.close();
    }
} else {
    for (const deviceName of devices) {
        for (const study of studies) {
            const {context, page, errors} = await openPage(deviceName, `study=${encodeURIComponent(study)}`);
            await page.waitForFunction(() => window.__arkStudy || window.__arkGoldenError, null, {timeout: 120_000});
            const failed = await page.evaluate(() => window.__arkGoldenError);
            if (failed) throw new Error(failed);
            const gpuName = await renderer(page);
            const views = await page.evaluate(() => window.__arkStudy.views);
            for (const time of times.filter((t) => t !== "dusk" || flag("dusk"))) {
                for (const view of views) {
                    const info = await page.evaluate(([v, t]) => window.__arkStudy.show(v, t), [view, time]);
                    const file = `${deviceName}-${study}-${view}-${time}.png`;
                    await page.screenshot({path: path.join(out, file)});
                    const numbers = await page.evaluate((ms) => window.__arkStudy.measure(ms), measureMs);
                    results.push({device: deviceName, gpu, gpuName, study, view, time, file, ...info, ...numbers});
                    log(deviceName, study, view, time, `${numbers.intervalP50}ms p50 / ${numbers.intervalP95} p95, drain ${numbers.gpuDrainMs}, ${info.drawCalls} calls, ${info.triangles} tris`);
                }
            }
            if (errors.length) log(deviceName, study, "page errors:", errors.slice(0, 5).join(" | "));
            await context.close();
        }
    }
}

await browser.close();
server.close();

writeFileSync(path.join(out, "numbers.json"), JSON.stringify(results, null, 2));
const rows = results.filter((r) => r.place || r.study).map((r) => `| ${r.device} | ${r.study ? `${r.study} / ${r.view}` : r.place} | ${r.time} | ${r.intervalP50} | ${r.intervalP95} | ${r.fps} | ${r.cpuMs ?? "–"} | ${r.gpuDrainMs} | ${r.drawCalls} | ${r.triangles} | ${r.tier ?? "–"} |`);
writeFileSync(path.join(out, "numbers.md"), [
    `Golden shots "${label}", ${new Date().toISOString()}, GPU mode ${gpu} (${results[0]?.gpuName ?? "?"}), quality ${quality}, ${measureMs} ms measured per shot.`,
    "",
    "| device | shot | light | interval p50 ms | p95 ms | fps | scene CPU ms | GPU drain ms | draw calls | triangles | tier |",
    "|---|---|---|---|---|---|---|---|---|---|---|",
    ...rows,
    ""
].join("\n"));
log("wrote", results.length, "shots to", out);
