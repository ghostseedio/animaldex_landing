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
// The clock: from a fixed moment (2026-11-20 03:00 UTC), running at real speed. `hold` stills the world's time
// (Date.now: the schedules, the weather) while the frames go on (performance.now keeps running: the scene's work
// budgets are timed on it; held, they never end and the frames stop).
await page.addInitScript(() => {
    const realDate = Date.now.bind(Date);
    const start = Date.UTC(2026, 10, 20, 3, 0, 0);
    const date0 = realDate();
    let held = null;
    let offset = 0;
    const now = () => (held !== null ? held : realDate() - offset);
    Date.now = () => start + (now() - date0);
    window.__clock = {
        hold: () => (held = now()),
        run: () => {
            if (held === null) return;
            offset = realDate() - held;
            held = null;
        }
    };
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
            rows.push({id: e.animal.id, x: at?.x ?? null, y: at?.y ?? null, z: at?.z ?? null, doing: e.sched?.trip?.doing ?? null, moving: Boolean(p?.moving), aloft: Boolean(p?.aloft), length: e.length, level: e.level, asleep: Boolean(e.state?.asleep), yaw: e.yawNow ?? 0, water: Boolean(e.place?.water), micro: e.place?.micro ? e.place.micro.attach?.tag ?? e.place.micro.surface : null, normal: e.sched?.pose?.surface ? {x: e.sched.pose.surface.nx, y: e.sched.pose.surface.ny, z: e.sched.pose.surface.nz} : null, clip: e.rig ? {now: e.rig.now?.name ?? null, phase: e.rig.now?.phase ?? null, from: e.rig.from?.name ?? null, weight: e.rig.weight, flying: Boolean(e.rig.flying)} : null, act: e.sched?.pose?.act?.block ?? e.act?.state ?? null, recipe: e.sched?.pose?.act?.recipe ?? null, sleepStarted: Boolean(e.sleepStarted), held: Boolean(e.held), gait: e.gait ? {moving: e.gait.moving ?? null, speed: e.gait.speed ?? null} : null, power: e.power ? {drop: e.power.drop, state: e.power.state} : null});
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
    console.log(name, "drawn", JSON.stringify(await page.evaluate((id) => {
        const e = window.__arkDebug.entries().find((x) => x.animal.id === id);
        return e ? {drawn: e.drawn, length: e.length, minY: null} : null;
    }, row.id)));
    console.log(name, "state", JSON.stringify({doing: report.subjects[name].doing, asleep: report.subjects[name].asleep, moving: report.subjects[name].moving, clip: report.subjects[name].clip, act: report.subjects[name].act, recipe: report.subjects[name].recipe, sleepStarted: report.subjects[name].sleepStarted, gait: report.subjects[name].gait, power: report.subjects[name].power}));
    console.log(name, JSON.stringify(report.subjects[name].under));
    await shot(name);
};

// (From 2.5 m: closer, the camera's approach sends it off at a run, `reactive.ts`, the owner's hovering-cat frame.)
await close("cat-rest", "domestic-cat", (r) => r.asleep || r.doing === "rest" || r.doing === "groom", (r) => 2.5, 1.42, "town");
await close("cat-near", "domestic-cat", (r) => !r.asleep, (r) => 1.0, 1.42, "town");
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
await close("bug-on-leaf", "seven-spot-ladybird", (r) => r.micro === "leaf", (r) => 0.22, 1.05, "town");
await close("bug-on-leaf-2", "shield-stink-bug", (r) => r.micro === "leaf", (r) => 0.3, 1.1);
await close("grasshopper", "common-field-grasshopper", (r) => true, (r) => 0.16, 1.35);
await close("crab-on-rock", "mangrove-crab", (r) => r.micro === "rock_face", (r) => 0.28, 1.4);
await close("frog-on-bank", "marsh-frog", (r) => true, (r) => 0.8, 0.75);
await close("starfish", "crown-of-thorns-starfish", (r) => true, (r) => 1.2, 1.2);
// (A crocodile asleep in daylight: the first daylight hour it is.)
if (want("croc-asleep")) {
    await crossTo("wild");
    for (const hours of [11, 14, 16, 8, 18, 6.5]) {
        await page.evaluate((hours) => window.__arkScene.setHours(hours), hours);
        await wait(5000);
        const rows = await find("saltwater-crocodile");
        if (rows.some((r) => r.asleep || r.doing === "sleep" || r.doing === "rest")) {
            report.crocHours = hours;
            break;
        }
    }
    await close("croc-asleep", "saltwater-crocodile", (r) => r.asleep || r.doing === "sleep" || r.doing === "rest", (r) => 6.5, 1.4);
    await daylight();
}
await close("bird-at-water", "grey-heron", (r) => r.water && !r.aloft, (r) => 3, 1.42);
await close("bird-at-water-2", "great-cormorant", (r) => r.water && !r.aloft, (r) => 3.2, 0.85);
await close("bird-at-water-3", "little-egret", (r) => r.water && !r.aloft, (r) => 2, 1.42);

// Shadows of four sizes: a beetle-sized, a cat-sized, a zebra-sized and an elephant, each framed from above-side.
if (want("shadows")) {
    for (const [i, slug, d] of [[1, "meerkat", 1.6], [2, "domestic-dog", 3], [3, "plains-zebra", 6], [4, "african-bush-elephant", 12]]) {
        const rows = await find(slug);
        const row = pick(rows, (r) => !r.asleep && !r.aloft);
        if (!row) continue;
        await frame(row.id, d, 0.6);
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
        await wait(1500);
        // Every frame, every animal drawn near the paddock: where it is drawn and at which level.
        await page.evaluate(({target}) => {
            window.__zoomLog = [];
            const step = () => {
                const at = [];
                for (const e of window.__arkDebug.entries()) {
                    if (!e.drawn || !e.sched?.pose) continue;
                    if (Math.hypot(e.drawn.x - target.x, e.drawn.z - target.z) > 60) continue;
                    at.push([e.animal.id, e.animal.model_slug, e.level === "token" ? "token" : e.drawn.level, e.drawn.x, e.drawn.y, e.drawn.z]);
                }
                window.__zoomLog.push({t: performance.now(), distance: window.__arkDebug.camera.position.distanceTo(window.__arkDebug.controls.target), at});
                window.__zoomRaf = requestAnimationFrame(step);
            };
            window.__zoomRaf = requestAnimationFrame(step);
        }, {target});
        const DISTANCES = [9, 22, 30, 60, 90, 150, 250, 400, 650, 400, 250, 150, 90, 60, 30, 22, 9];
        for (const [i, distance] of DISTANCES.entries()) {
            await page.evaluate(({target, distance}) => window.__arkScene.setView({target: {x: target.x, y: target.y, z: target.z}, distance, polar: 1.15, azimuth: 1.0}), {target, distance});
            await wait(1800);
            if ([9, 90, 650].includes(distance)) await shot(`giraffe-zoom-${distance}m-${i <= 8 ? "out" : "in"}`);
        }
        const log = await page.evaluate(() => {
            cancelAnimationFrame(window.__zoomRaf);
            return window.__zoomLog;
        });
        await page.evaluate(() => window.__clock.run());
        // The world held still: any move of a drawn animal from one frame to the next is a jump (its clip plays on, but
        // where it is drawn, its base by its level, does not move). Each, with the levels it was drawn at either side.
        const jumps = [];
        const switches = {};
        const levelsSeen = {};
        for (let k = 1; k < log.length; k++) {
            const before = new Map(log[k - 1].at.map((r) => [r[0], r]));
            for (const r of log[k].at) {
                const a = before.get(r[0]);
                levelsSeen[r[1]] ??= new Set();
                levelsSeen[r[1]].add(r[2]);
                if (!a) continue;
                const key = `${a[2]}>${r[2]}`;
                if (a[2] !== r[2]) switches[key] = (switches[key] ?? 0) + 1;
                if (a[2] === "token" || r[2] === "token") continue;
                const moved = Math.hypot(r[3] - a[3], r[5] - a[5]);
                const dy = r[4] - a[4];
                if (moved > 0.03 || Math.abs(dy) > 0.03) jumps.push({slug: r[1], id: r[0].slice(-6), distance: Math.round(log[k].distance), levels: key, moved: Math.round(moved * 1000) / 1000, dy: Math.round(dy * 1000) / 1000});
            }
        }
        jumps.sort((a, b) => Math.hypot(b.moved, b.dy) - Math.hypot(a.moved, a.dy));
        const levels = Object.fromEntries(Object.entries(levelsSeen).map(([k, v]) => [k, Array.from(v).join("/")]));
        report.zoom = {frames: log.length, switches, jumps: jumps.length, atSwitch: jumps.filter((j) => j.levels.includes(">") && j.levels.split(">")[0] !== j.levels.split(">")[1]).length, worst: jumps.slice(0, 20), levels};
        console.log("zoom", JSON.stringify({frames: log.length, switches, jumps: jumps.length, atSwitch: report.zoom.atSwitch, worst: jumps.slice(0, 8), levels}));
    }
}
// The zoom again with the world's clock running (what the owner sees): every frame, each walking animal's step from
// the last; a jump is a step far off the one before it (its pace does not change in a frame). A far model stepped at
// half a second showed as such jumps zoomed out, and one more as it came in near.
if (want("zoom-run")) {
    await crossTo("town");
    const rows = await find("giraffe");
    if (rows.length) {
        const target = await page.evaluate((id) => window.__arkScene.locate(id), rows[0].id);
        await page.evaluate(({target}) => {
            window.__zoomLog = [];
            const step = () => {
                const at = [];
                for (const e of window.__arkDebug.entries()) {
                    if (!e.drawn || !e.sched?.pose || e.level === "token") continue;
                    if (Math.hypot(e.drawn.x - target.x, e.drawn.z - target.z) > 80) continue;
                    at.push([e.animal.id, e.animal.model_slug, e.drawn.level, e.drawn.x, e.drawn.y, e.drawn.z, e.sched.pose.x, e.sched.pose.z, e.sched.at, Boolean(e.sched.pose.moving), e.level]);
                }
                window.__zoomLog.push({t: performance.now(), at});
                window.__zoomRaf = requestAnimationFrame(step);
            };
            window.__zoomRaf = requestAnimationFrame(step);
        }, {target});
        for (const distance of [12, 40, 90, 200, 90, 40, 12]) {
            await page.evaluate(({target, distance}) => window.__arkScene.setView({target: {x: target.x, y: target.y, z: target.z}, distance, polar: 1.15, azimuth: 1.0}), {target, distance});
            await wait(4000);
        }
        const log = await page.evaluate(() => {
            cancelAnimationFrame(window.__zoomRaf);
            return window.__zoomLog;
        });
        // (Velocities by each frame's own time: under load the frames come 20 to 150 ms apart, and a walk's step per
        // frame with them. A jump: its velocity changed by over 3 m/s from one frame to the next, and it moved over 5 cm
        // in that frame; no animal here changes pace that fast.)
        writeFileSync(path.join(out, `${label}-zoom-run.json`), JSON.stringify(log));
        const spikes = {};
        const steps = {};
        const worst = [];
        for (let k = 2; k < log.length; k++) {
            const dt1 = (log[k - 1].t - log[k - 2].t) / 1000;
            const dt2 = (log[k].t - log[k - 1].t) / 1000;
            if (dt1 <= 0 || dt2 <= 0) continue;
            const a = new Map(log[k - 2].at.map((r) => [r[0], r]));
            const b = new Map(log[k - 1].at.map((r) => [r[0], r]));
            for (const r of log[k].at) {
                const p = a.get(r[0]);
                const q = b.get(r[0]);
                if (!p || !q) continue;
                const v1 = [(q[3] - p[3]) / dt1, (q[4] - p[4]) / dt1, (q[5] - p[5]) / dt1];
                const step = [r[3] - q[3], r[4] - q[4], r[5] - q[5]];
                const v2 = step.map((d) => d / dt2);
                const change = Math.hypot(v2[0] - v1[0], v2[1] - v1[1], v2[2] - v1[2]);
                const key = q[2] === r[2] ? r[2] : `${q[2]}>${r[2]}`;
                steps[key] = (steps[key] ?? 0) + 1;
                if (change > 3 && Math.hypot(...step) > 0.05) {
                    spikes[key] = (spikes[key] ?? 0) + 1;
                    worst.push({slug: r[1], levels: key, step: Math.round(Math.hypot(...step) * 1000) / 1000, dy: Math.round(step[1] * 1000) / 1000, change: Math.round(change * 10) / 10});
                }
            }
        }
        worst.sort((x, y) => y.step - x.step);
        report.zoomRun = {frames: log.length, steps, spikes, worst: worst.slice(0, 12)};
        console.log("zoom-run", JSON.stringify(report.zoomRun));
    }
}

// Safari animals on the wild island at a distance (their ground's tiles drawn as the map past the render distance):
// each one's gap to the ground tile drawn under it, near and zoomed out. Before: they stood on the full ground's
// triangles over coarse ones (sinking in hollows, floating on rises).
if (want("safari")) {
    await crossTo("wild");
    const rows = await find("african-bush-elephant");
    const row = pick(rows, (r) => !r.aloft);
    if (row) {
        await frame(row.id, 14, 1.2, Math.PI / 3, 5000);
        const target = await page.evaluate((id) => window.__arkScene.locate(id), row.id);
        const SAFARI = ["african-bush-elephant", "plains-zebra", "giraffe", "rhinoceros", "african-lion", "cape-buffalo", "impala", "common-warthog", "meerkat"];
        report.safari = [];
        for (const distance of [14, 120, 250, 450]) {
            await page.evaluate(({target, distance}) => window.__arkScene.setView({target: {x: target.x, y: target.y, z: target.z}, distance, polar: 1.0, azimuth: 0.8}), {target, distance});
            await wait(3500);
            const gaps = await page.evaluate(({target, SAFARI}) => {
                const out = [];
                for (const e of window.__arkDebug.entries()) {
                    if (!e.drawn || e.level === "token" || !e.sched?.pose || e.sched.pose.afloat) continue;
                    if (Math.hypot(e.drawn.x - target.x, e.drawn.z - target.z) > 120) continue;
                    if (!SAFARI.includes(e.animal.model_slug) && (e.length ?? 0) < 1) continue;
                    const u = window.__arkDebug.under(e.animal.id);
                    const ground = u?.hits.find((h) => h.kind.startsWith("ark-ground"));
                    if (ground) out.push({slug: e.animal.model_slug, level: e.drawn.level, gap: ground.gap, asleep: Boolean(e.sleepNow?.down), lying: e.drawn.lying ?? null, act: e.sched.pose.act?.state ?? null, root: e.drawn.root, stand: e.drawn.ground});
                }
                return out;
            }, {target, SAFARI});
            const worst = gaps.filter((g) => g.lying === null).sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap)).slice(0, 5);
            // (One lying asleep has its torso on the ground, `lieOnGround`: its feet line is under the ground by design.)
            const standing = gaps.filter((g) => g.lying === null);
            const sunk = standing.filter((g) => g.gap > 0.05).length;
            const floating = standing.filter((g) => g.gap < -0.05).length;
            writeFileSync(path.join(out, `${label}-safari-${distance}.json`), JSON.stringify(gaps));
            report.safari.push({distance, animals: gaps.length, sunkOver5cm: sunk, floatingOver5cm: floating, worst});
            console.log("safari", distance, JSON.stringify({animals: gaps.length, lying: gaps.length - standing.length, sunk, floating, worst}));
            if (distance === 250) await shot("safari-250m");
        }
    }
}
report.errors = errors.slice(0, 10);
writeFileSync(path.join(out, `${label}-report.json`), JSON.stringify(report, null, 1));
await context.close();
await browser.close();
server.close();
