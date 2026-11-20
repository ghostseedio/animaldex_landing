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
// Daylight and dry, whatever the clock (the owner can't judge contact at night in the rain): late morning, no rain, no
// fog, no storm, ground dry, a little cloud.
const HOURS = Number(arg("hours", "11"));
const daylight = () => page.evaluate((hours) => {
    window.__arkScene.setHours?.(hours);
    window.__arkScene.setEnvironment?.({rain: 0, wetness: 0, fog: 0, storm: 0, snow: 0, cloud: 0.15, wind: 0.2});
}, HOURS);
await daylight();
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
            rows.push({id: e.animal.id, x: at?.x ?? null, y: at?.y ?? null, z: at?.z ?? null, doing: e.sched?.trip?.doing ?? null, moving: Boolean(p?.moving), aloft: Boolean(p?.aloft), length: e.length, level: e.level, asleep: Boolean(e.state?.asleep), yaw: e.yawNow ?? 0, water: Boolean(e.place?.water), micro: e.place?.micro ? e.place.micro.attach?.tag ?? e.place.micro.surface : null, normal: e.sched?.pose?.surface ? {x: e.sched.pose.surface.nx, y: e.sched.pose.surface.ny, z: e.sched.pose.surface.nz} : null});
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
/** What is drawn under it (`__arkDebug.under`): its base's gap over the first surface (negative: into it). */
const under = (id, normal) => page.evaluate(({id, normal}) => window.__arkDebug.under?.(id, normal) ?? null, {id, normal});
const want = (name) => !only || only.includes(name);
const pick = (rows, test) => rows.find(test) ?? rows[0];
const crossTo = async (island) => {
    if ((await page.evaluate(() => window.__arkScene.island?.())) === island) return;
    await page.evaluate((island) => window.__arkScene.crossTo?.(island), island);
    await wait(6000);
    await daylight();
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
    report.subjects[name].under = await under(row.id, row.normal ?? null);
    console.log(name, JSON.stringify(report.subjects[name].under));
    await shot(name);
};

await close("cat-rest", "domestic-cat", (r) => !r.moving, (r) => Math.max(r.length * 2.6, 1.0), 1.42, "town");
// The owner's hovering cat: its Power's lift (the climb Power's "up the slope's way", 45% of its height) on a cat on
// the ground. The live cat rig has no pounce or leap clip (drink, graze, groom, idle, lie, run, scan, sit, sleep, trot,
// walk...); the Power's lift is what raised it. Held on it here, as power-show.ts sets it.
if (want("cat-lift")) {
    await crossTo("town");
    const rows = await find("domestic-cat");
    const row = pick(rows, (r) => !r.moving && !r.asleep) ?? rows[0];
    if (row) {
        await page.evaluate((id) => {
            const e = window.__arkDebug.entries().find((x) => x.animal.id === id);
            window.__catLift = setInterval(() => {
                if (!e) return;
                const h = (e.length ?? 0.45) * 0.55;
                e.power = Object.assign(e.power ?? {}, {mechanism: "c", react: 1, q: 1, look: null, pack: 0, still: 0, drop: -h * 0.45, head: null, threat: 0, check: 0, fromX: 0, fromZ: 0, act: null, since: 0, state: null, flock: null, clip: null});
            }, 16);
        }, row.id);
        await frame(row.id, Math.max(row.length * 2.6, 1.0), 1.42);
        report.subjects["cat-lift"] = {...row, under: await under(row.id, null)};
        console.log("cat-lift", JSON.stringify(report.subjects["cat-lift"].under));
        await shot("cat-lift");
        await page.evaluate(() => clearInterval(window.__catLift));
    }
}
await close("bug-on-leaf", "seven-spot-ladybird", (r) => r.micro === "leaf", (r) => 0.07, 1.3, "town");
await close("bug-on-leaf-2", "shield-stink-bug", (r) => r.micro === "leaf", (r) => 0.1, 1.3);
await close("grasshopper", "common-field-grasshopper", (r) => true, (r) => 0.16, 1.35);
await close("crab-on-rock", "mangrove-crab", (r) => r.micro === "rock_face", (r) => 0.28, 1.4);
await close("frog-on-bank", "marsh-frog", (r) => true, (r) => 0.45, 1.42);
await close("starfish", "crown-of-thorns-starfish", (r) => true, (r) => 1.2, 1.2);
await close("croc-asleep", "saltwater-crocodile", (r) => r.asleep || r.doing === "sleep" || r.doing === "rest", (r) => 6.5, 1.4);
await close("bird-at-water", "grey-heron", (r) => r.water && !r.aloft, (r) => 3, 1.42);
await close("bird-at-water-2", "great-cormorant", (r) => r.water && !r.aloft, (r) => 2.4, 1.42);
await close("bird-at-water-3", "little-egret", (r) => r.water && !r.aloft, (r) => 2, 1.42);

// Shadows of four sizes: a beetle-sized, a cat-sized, a zebra-sized and an elephant, each framed from above-side.
if (want("shadows")) {
    for (const [i, slug, d] of [[1, "meerkat", 1.6], [2, "domestic-dog", 3], [3, "plains-zebra", 6], [4, "african-bush-elephant", 12]]) {
        const rows = await find(slug);
        const row = pick(rows, (r) => !r.asleep && !r.aloft);
        if (!row) continue;
        await frame(row.id, d, 0.95);
        report.subjects[`shadow-${i}`] = {...row, under: await under(row.id, null)};
        await shot(`shadow-${i}-${slug}`);
    }
}

// Giraffes in their zoo paddock, the clock held still, zoomed out through every level's distance and back in (near,
// rig off, far, icon, then back): where each animal is drawn at every step (`entry.drawn`: its base by its level), and
// any jump at a level's switch. With the clock still, any move at all is a jump.
if (want("giraffe")) {
    await crossTo("town");
    const rows = await find("giraffe");
    if (rows.length) {
        const first = rows[0];
        await frame(first.id, 12, 1.15, Math.PI / 3, 6000);
        const target = await page.evaluate((id) => window.__arkScene.locate(id), first.id);
        // Let the camera's approach be seen (the reactive layer: a giraffe steps back from a camera close by).
        await page.evaluate(({target}) => window.__arkScene.setView({target: {x: target.x, y: target.y, z: target.z}, distance: 9, polar: 1.15, azimuth: 1.0}), {target});
        await wait(8000);
        await page.evaluate(() => window.__clock.hold());
        await wait(600);
        const steps = [];
        const DISTANCES = [9, 22, 30, 60, 90, 150, 250, 400, 650, 400, 250, 150, 90, 60, 30, 22, 9];
        for (const distance of DISTANCES) {
            await page.evaluate(({target, distance}) => window.__arkScene.setView({target: {x: target.x, y: target.y, z: target.z}, distance, polar: 1.15, azimuth: 1.0}), {target, distance});
            await wait(1800);
            const at = await page.evaluate(() => window.__arkDebug.entries().filter((e) => e.drawn && e.sched?.pose).map((e) => ({id: e.animal.id, slug: e.animal.model_slug, level: e.level === "token" ? "token" : e.drawn.level, x: e.drawn.x, y: e.drawn.y, z: e.drawn.z, reactive: e.reactive ? Math.hypot(e.reactive.dx, e.reactive.dz) : 0})));
            steps.push({distance, at});
            if ([9, 90, 650].includes(distance) && steps.filter((s) => s.distance === distance).length === 1) await shot(`giraffe-zoom-${distance}m`);
        }
        await page.evaluate(() => window.__clock.run());
        // Every switch (an animal drawn at one level, then at another) and every move between consecutive steps.
        const jumps = [];
        const switches = {};
        for (let k = 1; k < steps.length; k++) {
            for (const b of steps[k].at) {
                const a = steps[k - 1].at.find((x) => x.id === b.id);
                if (!a || a.level === "token" || b.level === "token") continue;
                const d = Math.hypot(b.x - a.x, b.z - a.z);
                const dy = b.y - a.y;
                const key = `${a.level}>${b.level}`;
                if (a.level !== b.level) switches[key] = (switches[key] ?? 0) + 1;
                if (d > 0.02 || Math.abs(dy) > 0.02) jumps.push({slug: b.slug, id: b.id.slice(-6), from: steps[k - 1].distance, to: steps[k].distance, levels: key, moved: Math.round(d * 1000) / 1000, dy: Math.round(dy * 1000) / 1000, reactive: Math.round(b.reactive * 100) / 100});
            }
        }
        jumps.sort((a, b) => Math.hypot(b.moved, b.dy) - Math.hypot(a.moved, a.dy));
        const giraffeLevels = steps.map((s) => `${s.distance}:${s.at.filter((x) => x.slug === "giraffe").map((x) => x.level).join("/")}`);
        report.zoom = {steps: steps.length, compared: steps[0].at.length, switches, jumps: jumps.length, worst: jumps.slice(0, 15), giraffeLevels};
        console.log("zoom", JSON.stringify({switches, jumps: jumps.length, worst: jumps.slice(0, 6), giraffeLevels}));
    }
}
report.errors = errors.slice(0, 10);
writeFileSync(path.join(out, `${label}-report.json`), JSON.stringify(report, null, 1));
await context.close();
await browser.close();
server.close();
