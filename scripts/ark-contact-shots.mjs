#!/usr/bin/env node
/**
 * ARK-CONTACT's shots (decision 447): the apps' embed (a development bundle, `node scripts/build-ark-bundle.mjs --dev`)
 * on a local fixture Ark (`public/ark-local/<file>`, gitignored: the v2 fixture plus the brief's species from the
 * validator's catalogue list), on a clock that starts at a fixed moment, so two builds (before and after) show the same
 * animals in the same places. Development only; nothing is uploaded; the models are read from the public bucket.
 *
 *   node scripts/ark-contact-shots.mjs --public <dir with ark/ and ark-local/> --out <dir> --label before|after [--only cat,giraffe,...]
 *
 * Shots (each animal framed from its side, near, its rig in): cat, bug on a leaf, grasshopper on grass, crab, frog, sea
 * star, crocodile asleep, giraffes at three zooms (and their positions measured at each, the clock held still), a bird
 * at the water, shadows of four sizes. Writes <out>/<label>-<shot>.png and <out>/<label>-zoom.json.
 */
import {createReadStream, existsSync, mkdirSync, statSync, writeFileSync} from "node:fs";
import {createServer} from "node:http";
import path from "node:path";

const arg = (name, fallback) => {
    const at = process.argv.indexOf(`--${name}`);
    return at >= 0 && process.argv[at + 1] ? process.argv[at + 1] : fallback;
};
const publicDir = path.resolve(arg("public", "public"));
const out = path.resolve(arg("out", "/tmp/ark-contact-shots"));
const label = arg("label", "after");
const only = arg("only", "") ? arg("only", "").split(",") : null;
const snapshot = arg("snapshot", "/ark-local/contact.json");
mkdirSync(out, {recursive: true});

const TYPES = {".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".wasm": "application/wasm", ".webp": "image/webp", ".png": "image/png", ".glb": "model/gltf-binary", ".bin": "application/octet-stream", ".m4a": "audio/mp4", ".hdr": "application/octet-stream", ".ktx2": "image/ktx2", ".map": "application/json", ".css": "text/css"};
const server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    const file = path.join(publicDir, decodeURIComponent(url.pathname));
    if (!file.startsWith(publicDir) || !existsSync(file) || !statSync(file).isFile()) return void response.writeHead(404).end();
    response.writeHead(200, {"content-type": TYPES[path.extname(file)] ?? "application/octet-stream", "cache-control": "no-cache"});
    createReadStream(file).pipe(response);
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}`;

const {chromium} = await import("playwright-core");
const browser = await chromium.launch({channel: "chrome", headless: true, args: ["--headless=new", "--enable-gpu", "--ignore-gpu-blocklist", "--use-angle=metal"]});
const context = await browser.newContext({viewport: {width: 900, height: 640}, deviceScaleFactor: 1});
const page = await context.newPage();
page.setDefaultTimeout(600_000);
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
// The clock: from a fixed moment (2026-11-20 03:00 UTC, morning on the island), running at real speed; held still on asking.
await page.addInitScript(() => {
    const realPerf = performance.now.bind(performance);
    const realDate = Date.now.bind(Date);
    const start = Date.UTC(2026, 10, 20, 3, 0, 0);
    const perf0 = realPerf();
    let held = null;
    let offset = 0;
    const now = () => (held !== null ? held : realPerf() - offset);
    performance.now = now;
    Date.now = () => start + (now() - perf0);
    window.__clock = {
        hold: () => (held = now()),
        run: () => {
            if (held === null) return;
            offset = realPerf() - held;
            held = null;
        }
    };
    void realDate;
});
const wait = (ms) => page.waitForTimeout(ms);
await page.goto(`${base}/ark/embed.html?snapshot=${snapshot}&hud=0&lang=en`, {waitUntil: "domcontentloaded"});
await page.waitForFunction(() => Boolean(window.__arkScene), null, {timeout: 600_000});
await page.evaluate(() => window.__arkScene.mounted());
await page.waitForFunction(() => !window.__arkScene.attached || window.__arkScene.attached(), null, {timeout: 600_000}).catch(() => undefined);
await wait(8000);
console.log("mounted", JSON.stringify(await page.evaluate(() => ({island: window.__arkScene.island?.(), two: window.__arkScene.twoIslands?.(), entries: window.__arkDebug?.entries().length}))));

/** Entries of a slug with their schedule's pose and what they are doing. */
const find = (slug) =>
    page.evaluate((slug) => {
        const rows = [];
        for (const e of window.__arkDebug.entries()) {
            if (e.animal.model_slug !== slug) continue;
            const p = e.sched?.pose;
            const at = e.middle ?? (p ? {x: p.x, y: p.y, z: p.z} : null);
            rows.push({id: e.animal.id, x: at?.x ?? null, y: at?.y ?? null, z: at?.z ?? null, doing: e.sched?.trip?.doing ?? null, moving: Boolean(p?.moving), aloft: Boolean(p?.aloft), length: e.length, level: e.level, asleep: Boolean(e.state?.asleep), yaw: e.yawNow ?? 0, water: Boolean(e.place?.water), micro: e.place?.micro ? e.place.micro.attach?.tag ?? e.place.micro.surface : null});
        }
        return rows;
    }, slug);
const frame = async (id, distance, polar = 1.25, side = Math.PI / 2, settle = 4500) => {
    const at = await page.evaluate((id) => window.__arkScene.locate(id), id);
    if (!at) return false;
    const yaw = (await page.evaluate((id) => window.__arkDebug.entries().find((e) => e.animal.id === id)?.yawNow ?? 0, id)) ?? 0;
    await page.evaluate(({at, distance, polar, azimuth}) => {
        window.__arkDebug.controls.minDistance = 0.05;
        window.__arkScene.setView({target: {x: at.x, y: at.y, z: at.z}, distance, polar, azimuth});
    }, {at, distance, polar, azimuth: yaw + side});
    await wait(settle);
    // Again on where it is now (it may have moved while its models came in).
    const again = await page.evaluate((id) => window.__arkScene.locate(id), id);
    if (again) await page.evaluate(({at, distance, polar, azimuth}) => window.__arkScene.setView({target: {x: at.x, y: at.y, z: at.z}, distance, polar, azimuth}), {at: again, distance, polar, azimuth: yaw + side});
    await wait(1200);
    return true;
};
const shot = async (name) => {
    const file = path.join(out, `${label}-${name}.png`);
    await page.locator("canvas").first().screenshot({path: file});
    console.log("shot", file);
};
const want = (name) => !only || only.includes(name);
const pick = (rows, test) => rows.find(test) ?? rows[0];
const crossTo = async (island) => {
    if ((await page.evaluate(() => window.__arkScene.island?.())) === island) return;
    await page.evaluate((island) => window.__arkScene.crossTo?.(island), island);
    await wait(6000);
};
const report = {label, zoom: null, subjects: {}};

const close = async (name, slug, test, distanceOf, polar = 1.2, island = "wild") => {
    if (!want(name)) return;
    await crossTo(island);
    const rows = await find(slug);
    const row = pick(rows, test);
    report.subjects[name] = row ?? null;
    if (!row) return console.log("none:", slug);
    if (!(await frame(row.id, distanceOf(row), polar))) return console.log("not located:", slug);
    report.subjects[name] = (await find(slug)).find((r) => r.id === row.id);
    await shot(name);
};

await close("cat", "domestic-cat", (r) => !r.asleep, (r) => Math.max(r.length * 3, 1.2), 1.3, "town");
await close("bug-on-leaf", "seven-spot-ladybird", (r) => r.micro === "leaf", (r) => 0.12, 1.1, "town");
await close("bug-on-leaf-2", "shield-stink-bug", (r) => true, (r) => 0.18, 1.1);
await close("grasshopper", "common-field-grasshopper", (r) => true, (r) => 0.3, 1.25);
await close("crab-on-rock", "mangrove-crab", (r) => true, (r) => 0.6, 1.2);
await close("frog-on-bank", "marsh-frog", (r) => true, (r) => 0.6, 1.3);
await close("starfish", "crown-of-thorns-starfish", (r) => true, (r) => 1.4, 0.9);
await close("croc-asleep", "saltwater-crocodile", (r) => r.asleep || r.doing === "sleep" || r.doing === "rest", (r) => 7, 1.3);
await close("bird-at-water", "great-cormorant", (r) => r.water || !r.aloft, (r) => 2.2, 1.35);
await close("bird-at-water-2", "grey-heron", (r) => !r.aloft, (r) => 3, 1.35);

// Shadows of four sizes: a beetle-sized, a cat-sized, a zebra-sized and an elephant, each framed from above-side.
if (want("shadows")) {
    for (const [i, slug, d] of [[1, "meerkat", 1.6], [2, "domestic-dog", 3], [3, "plains-zebra", 6], [4, "african-bush-elephant", 12]]) {
        const rows = await find(slug);
        const row = pick(rows, (r) => !r.asleep && !r.aloft);
        if (!row) continue;
        await frame(row.id, d, 0.75);
        await shot(`shadow-${i}-${slug}`);
    }
}

// Giraffes in their zoo paddock at three zooms, the clock held still: their drawn positions at each.
if (want("giraffe")) {
    await crossTo("town");
    const rows = await find("giraffe");
    if (rows.length) {
        const first = rows[0];
        await frame(first.id, 12, 1.15, Math.PI / 3, 6000);
        const target = await page.evaluate((id) => window.__arkScene.locate(id), first.id);
        await page.evaluate(() => window.__clock.hold());
        await wait(600);
        const positions = [];
        for (const distance of [9, 30, 90]) {
            await page.evaluate(({target, distance}) => window.__arkScene.setView({target: {x: target.x, y: target.y, z: target.z}, distance, polar: 1.15, azimuth: 1.0}), {target, distance});
            await wait(2500);
            const at = await page.evaluate(() => window.__arkDebug.entries().filter((e) => e.sched?.pose).map((e) => ({id: e.animal.id, slug: e.animal.model_slug, level: e.level, x: e.middle?.x ?? null, y: e.middle?.y ?? null, z: e.middle?.z ?? null})));
            positions.push({distance, at});
            await shot(`giraffe-zoom-${distance}m`);
        }
        await page.evaluate(() => window.__clock.run());
        // How far each animal drawn at every zoom moved between them (the clock still: it should not have moved at all).
        const moved = [];
        for (const a of positions[0].at) {
            if (a.x === null) continue;
            const others = positions.slice(1).map((p) => p.at.find((b) => b.id === a.id)).filter((b) => b && b.x !== null);
            if (others.length < positions.length - 1) continue;
            const d = Math.max(...others.map((b) => Math.hypot(b.x - a.x, b.z - a.z, b.y - a.y)));
            moved.push({id: a.id, slug: a.slug, moved: Math.round(d * 1000) / 1000, levels: [a.level, ...others.map((b) => b.level)].join(">")});
        }
        moved.sort((a, b) => b.moved - a.moved);
        report.zoom = {animals: moved.length, over2cm: moved.filter((m) => m.moved > 0.02).length, giraffes: moved.filter((m) => m.slug === "giraffe"), worst: moved.slice(0, 12)};
        console.log("zoom", JSON.stringify({animals: report.zoom.animals, over2cm: report.zoom.over2cm, giraffes: report.zoom.giraffes}));
    }
}
report.errors = errors.slice(0, 10);
writeFileSync(path.join(out, `${label}-report.json`), JSON.stringify(report, null, 1));
await context.close();
await browser.close();
server.close();
