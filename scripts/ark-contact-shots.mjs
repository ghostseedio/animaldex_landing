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
    const sp = report.subjects[name].under?.drawn?.surfacePoint;
    if (sp) console.log(name, "surfacePoint", JSON.stringify(await page.evaluate(({id, sp}) => window.__arkDebug.under(id, {x: sp.nx, y: sp.ny, z: sp.nz}, sp), {id: row.id, sp})));
    report.subjects[name].tips = await page.evaluate((id) => window.__arkDebug.tips?.(id) ?? null, row.id);
    console.log(name, "tips", JSON.stringify(report.subjects[name].tips));
    if (island === "town") console.log(name, "rayAll", JSON.stringify(await page.evaluate(({x, z}) => window.__arkDebug.rayAll?.(x, z) ?? null, report.subjects[name].under?.drawn ?? {x: 0, z: 0})));
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
// The owner's farm (2026-11-21): cows and pigs sunk to their hocks in the paddock, at night, on main. Each farm kind
// standing and walking, framed close (its rig), at 25 m and at 70 m: its feet line against the town's drawn ground
// (positive: sunk), and its leg tips (the rig's).
if (want("farm")) {
    await crossTo("town");
    report.farm = [];
    for (const slug of ["cow", "domestic-pig", "domestic-sheep", "domestic-goat", "domestic-horse", "domestic-chicken"]) {
        const rows = await find(slug);
        const picks = [rows.find((r) => !r.moving && !r.asleep), rows.find((r) => r.moving)].filter(Boolean);
        for (const row of picks) {
            for (const distance of [Math.max(row.length * 3.5, 2.5), 25, 70]) {
                if (!(await frame(row.id, distance, 1.1, Math.PI / 4, 3500))) continue;
                const u = await under(row.id, null);
                const t = await page.evaluate((id) => window.__arkDebug.tips?.(id) ?? null, row.id);
                const gaps = (t?.tips ?? []).map((x) => x.gap).filter((g) => g !== null);
                const item = {slug, moving: row.moving, distance: Math.round(distance), level: u?.drawn?.level ?? null, feetLineSunk: u?.drawnGround ?? null, tipsLowest: gaps.length ? Math.max(...gaps) : null, tipsHighest: gaps.length ? Math.min(...gaps) : null, clip: u?.drawn?.clip ?? null, base: u?.drawn?.base ?? null, poseY: u?.drawn?.poseY ?? null, height: u?.drawn?.height ?? null, ground: u?.drawn?.ground ?? null};
                report.farm.push(item);
                console.log("farm", JSON.stringify(item));
                if (distance < 20 && !report.farmShot?.[slug]) {
                    (report.farmShot ??= {})[slug] = true;
                    await shot(`farm-${slug}`);
                }
            }
        }
    }
}

// The owner: "zooming in and out on a resting animal makes it get up and lie back down". A sleeping horse, deer and dog
// zoomed 12 -> 90 -> 12 m five times (the view's target held on it, the distance eased as a wheel does), the fix off
// ("before") and on ("after"): how often it woke, got up (its sleep's share fell under 0.9), or played a way down or up.
if (want("zoom-sleep")) {
    report.zoomSleep = [];
    for (const [slug, island] of [["domestic-horse", "town"], ["domestic-dog", "town"], ["cow", "town"], ["red-deer", "wild"], ["fallow-deer", "wild"], ["white-tailed-deer", "wild"]]) {
        await crossTo(island);
        let row = null;
        for (const h of [23, 2, 4, 21, 13]) {
            await page.evaluate((h) => window.__arkScene.setHours(h), h);
            await wait(3000);
            const rows = await find(slug);
            row = rows.find((r) => r.asleep) ?? rows.find((r) => r.doing === "rest" && !r.moving) ?? null;
            if (row) break;
        }
        if (!row) {
            console.log("zoom-sleep", slug, "none asleep or resting");
            continue;
        }
        for (const off of [true, false]) {
            await page.evaluate((off) => (window.__arkZoomFixOff = off), off);
            if (!(await frame(row.id, 12, 1.1, Math.PI / 3, 3000))) continue;
            const result = await page.evaluate(async (id) => {
                const e = () => window.__arkDebug.entries().find((x) => x.animal.id === id);
                const at = window.__arkScene.locate(id);
                const c = window.__arkDebug.controls;
                const polar = c.getPolarAngle();
                const azimuth = c.getAzimuthalAngle();
                const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
                const counts = {woke: 0, gotUp: 0, restDrops: 0, reacted: new Set(), transitions: 0, clips: new Set(), samples: 0, levels: new Set()};
                let wasRest = (e()?.rest ?? 0) > 0.6;
                let wasWoke = Boolean(e()?.reactive?.woke);
                let wasUp = (e()?.sleepNow?.t ?? 0) < 0.9;
                let wasClip = e()?.rig?.now?.name ?? null;
                const sample = () => {
                    const x = e();
                    if (!x) return;
                    counts.samples++;
                    counts.levels.add(x.level);
                    const woke = Boolean(x.reactive?.woke);
                    if (woke && !wasWoke) counts.woke++;
                    wasWoke = woke;
                    const resting = (x.rest ?? 0) > 0.6;
                    if (!resting && wasRest) counts.restDrops++;
                    wasRest = resting;
                    if (x.reactive?.action) counts.reacted.add(x.reactive.action);
                    const up = (x.sleepNow?.t ?? 0) < 0.9;
                    if (up && !wasUp) counts.gotUp++;
                    wasUp = up;
                    const clip = x.rig && x.rig.weight > 0.05 ? x.rig.now?.name ?? null : null;
                    if (clip && clip !== wasClip && ["lie_down", "get_up", "get_up_fast", "side_down", "side_up", "sit_down", "sit_up", "rise", "drop"].includes(clip)) counts.transitions++;
                    if (clip) counts.clips.add(clip);
                    wasClip = clip;
                };
                for (let cycle = 0; cycle < 5; cycle++) {
                    for (const [from, to] of [[12, 90], [90, 12]]) {
                        // Eased as a wheel zoom: about 1.5 s each way, a 50 ms step.
                        for (let k = 1; k <= 30; k++) {
                            const d = from * Math.pow(to / from, k / 30);
                            window.__arkScene.setView({target: {x: at.x, y: at.y, z: at.z}, distance: d, polar, azimuth});
                            await sleep(50);
                            sample();
                        }
                        for (let k = 0; k < 20; k++) {
                            await sleep(100);
                            sample();
                        }
                    }
                }
                return {...counts, clips: [...counts.clips], levels: [...counts.levels], reacted: [...counts.reacted], doing: e()?.sched?.trip?.doing ?? null, asleep: Boolean(e()?.state?.asleep)};
            }, row.id);
            const item = {slug, fix: !off, ...result};
            report.zoomSleep.push(item);
            console.log("zoom-sleep", JSON.stringify(item));
        }
    }
    await page.evaluate(() => (window.__arkZoomFixOff = false));
    await daylight();
}

// The owner: "shield bugs and stink bugs are inside a rock", "a golden tortoise beetle is hovering above a daisy".
// Every small animal inside a drawn rock across the Ark (posed, and drawn where drawn), then the worst framed close with
// the fix off and on; insects on flower heads and leaves framed close: their gap to the first drawn surface under them.
if (want("micro-fix")) {
    report.micro = {};
    for (const island of ["wild"]) {
        await crossTo(island);
        await page.evaluate(() => window.__arkScene.setHours(11));
        await wait(3000);
        const all = await page.evaluate(() => window.__arkDebug.insideRocks(0.15));
        console.log("micro-rocks", island, JSON.stringify({checked: all.checked, inside: all.inside, worst: all.rows.slice(0, 12).map((r) => [r.slug, r.depth, r.from, r.micro])}));
        const rows = all.rows.slice(0, 12);
        const bugs = (await find("shield-stink-bug")).slice(0, 4).map((r) => ({id: r.id, slug: "shield-stink-bug"}));
        const tested = [];
        for (const r of [...rows, ...bugs]) {
            const one = {slug: r.slug, id: r.id};
            for (const off of [true, false]) {
                await page.evaluate((off) => (window.__arkRockFixOff = off), off);
                if (!(await frame(r.id, 1.2, 1.0, Math.PI / 3, 2200))) continue;
                const depth = await page.evaluate((id) => {
                    const e = window.__arkDebug.entries().find((x) => x.animal.id === id);
                    const d = e?.drawn;
                    return d ? window.__arkDebug.insideRocks && window.__arkDebug.rockDepth(d.x, d.y + Math.max(e.length * 0.25, 0.01), d.z) : null;
                }, r.id);
                one[off ? "before" : "after"] = depth;
                if (r.slug === "shield-stink-bug" && !report.micro[`bug-${off}`]) {
                    report.micro[`bug-${off}`] = true;
                    await shot(`${island}-shield-stink-bug-${off ? "before" : "after"}`);
                }
            }
            tested.push(one);
            console.log("micro-rock", island, JSON.stringify(one));
        }
        await page.evaluate(() => (window.__arkRockFixOff = false));
        report.micro[island] = {all, tested};
        // On flowers and leaves.
        const perched = await page.evaluate(() => {
            const out = [];
            for (const e of window.__arkDebug.entries()) {
                const tag = e.place?.micro?.attach?.tag ?? null;
                if ((tag === "flower_head" || tag === "leaf") && e.length <= 0.15) out.push({id: e.animal.id, slug: e.animal.model_slug, tag});
            }
            return out;
        });
        const beetles = (await find("golden-tortoise-beetle")).map((r) => ({id: r.id, slug: "golden-tortoise-beetle", tag: r.micro}));
        const sample = [...beetles, ...perched.filter((p) => p.tag === "flower_head").slice(0, 24), ...perched.filter((p) => p.tag === "leaf").slice(0, 10)];
        const tally = {before: {n: 0, off: 0}, after: {n: 0, off: 0}};
        for (const p of sample) {
            const item = {...p};
            for (const off of [true, false]) {
                await page.evaluate((off) => (window.__arkFlowerFixOff = off), off);
                if (!(await frame(p.id, 0.8, 1.0, Math.PI / 3, 2200))) continue;
                const u = await under(p.id, null);
                const first = u?.hits?.[0] ?? null;
                const gap = first ? first.gap : null;
                item[off ? "before" : "after"] = {gap, kind: first?.kind ?? null};
                const t = tally[off ? "before" : "after"];
                t.n++;
                if (gap === null || Math.abs(gap) > 0.01) t.off++;
                if (p.slug === "golden-tortoise-beetle") await shot(`${island}-golden-tortoise-beetle-${off ? "before" : "after"}`);
            }
            console.log("micro-flower", island, JSON.stringify(item));
        }
        await page.evaluate(() => (window.__arkFlowerFixOff = false));
        console.log("micro-flower-tally", island, JSON.stringify(tally));
    }
    await daylight();
}

// The owner: "a Ruddy Ground Dove perched on a house roof is in mid-air". Town birds resting on an eave perch (the
// plan's eave spots), framed close with the fix off and on: the gap to the first drawn surface under them; 10 houses.
if (want("eaves")) {
    await crossTo("town");
    report.eaves = [];
    let shots = 0;
    for (const h of [11, 15, 8]) {
        await page.evaluate((h) => window.__arkScene.setHours(h), h);
        await wait(3500);
        const birds = await page.evaluate(() => {
            const out = [];
            for (const e of window.__arkDebug.entries()) {
                const p = e.sched?.pose;
                if (!p || p.moving || p.aloft || e.length > 0.7) continue;
                const eave = window.__arkScene.island?.() === "town" ? window.__arkDebug.eaveAt?.(p.x, p.y, p.z) : null;
                if (eave) out.push({id: e.animal.id, slug: e.animal.model_slug, building: eave.building, spot: {x: p.x, y: p.y, z: p.z}, eave});
            }
            return out;
        });
        console.log("eaves", h, birds.length, JSON.stringify(birds.slice(0, 12).map((b) => b.slug)));
        const seen = new Set(report.eaves.map((r) => r.building));
        for (const b of birds) {
            if (seen.has(b.building) || report.eaves.length >= 10) continue;
            seen.add(b.building);
            const item = {...b};
            for (const off of [true, false]) {
                await page.evaluate((off) => (window.__arkEaveFixOff = off), off);
                // (From above and outside its house: looking steeply down on the eave from 3 m, the view's target on the eave.)
                const at = off ? b.spot : b.eave;
                await page.evaluate((at) => window.__arkScene.setView({target: {x: at.x, y: at.y, z: at.z}, distance: 3, polar: 0.75, azimuth: Math.atan2(at.x, at.z)}), at);
                await wait(3500);
                const t = await page.evaluate((id) => window.__arkDebug.tips?.(id, 8) ?? null, b.id);
                const gaps = (t?.tips ?? []).map((x) => x.gap).filter((g) => g !== null);
                const u = await under(b.id, null);
                item[off ? "before" : "after"] = {first: u?.hits?.[0] ?? null, tipsLowest: gaps.length ? Math.max(...gaps) : null};
                if (shots < 3) await shot(`eave-${b.slug}-${off ? "before" : "after"}`);
            }
            shots++;
            report.eaves.push(item);
            console.log("eave", JSON.stringify(item));
        }
        if (report.eaves.length >= 10) break;
    }
    await page.evaluate(() => (window.__arkEaveFixOff = false));
}

// Round 4c: the page's own close-up (select(id, true)) in daylight, the fix off then on: a bird on a town eave, the shield
// stink bug by a rock, a beetle on a flower head.
const closeUp = async (name, id, toggle) => {
    const out = {};
    for (const off of [true, false]) {
        await page.evaluate(({toggle, off}) => (window[toggle] = off), {toggle, off});
        await page.evaluate((id) => window.__arkScene.select(id, true), id);
        await wait(7000);
        out[off ? "before" : "after"] = {under: await under(id, null), tips: await page.evaluate((id) => window.__arkDebug.tips?.(id, 8) ?? null, id)};
        await shot(`${name}-${off ? "before" : "after"}`);
        await page.evaluate(() => window.__arkScene.select(null));
        await wait(1500);
    }
    await page.evaluate((toggle) => (window[toggle] = false), toggle);
    const brief = (r) => r && {first: r.under?.hits?.[0] ?? null, drawnGround: r.under?.drawnGround ?? null, tips: (r.tips?.tips ?? []).map((t) => t.gap).filter((g) => g !== null).slice(0, 8)};
    console.log("closeup", name, JSON.stringify({before: brief(out.before), after: brief(out.after)}));
};
// ARK-SLEEP's langur in the trunk: animals off the ground whose body is in a trunk, both islands, the fix off and on (the
// drawn ones move), and a monkey on a limb in the page's close-up.
if (want("langur")) {
    const langurs = await page.evaluate(() => window.__arkDebug.entries().filter((e) => /langur/.test(e.animal.model_slug)).map((e) => ({id: e.animal.id, slug: e.animal.model_slug, point: e.sched?.trip?.to.point ?? null, length: e.length})));
    console.log("langurs", JSON.stringify(langurs));
    console.log("langur limb", JSON.stringify(await page.evaluate(() => window.__arkDebug.limbClear("limb:decor98:4", 1.29))));
}
if (want("limbs")) {
    const short = (rows) => rows.slice(0, 12).map((x) => [x.slug, x.point, x.by, x.trunk]);
    let pick = null;
    for (const hour of [3, 7, 11, 15, 19, 23]) {
        await page.evaluate((h) => window.__arkScene.setHours(h), hour);
        await wait(4000);
        for (const off of [true, false]) {
            await page.evaluate((off) => (window.__arkLimbFixOff = off), off);
            const r = await page.evaluate(() => window.__arkDebug.inTrunks());
            console.log("limbs", hour, off ? "before" : "after", JSON.stringify({checked: r?.checked, before: r?.before, after: r?.after, moved: r?.moved, seated: r?.seated, unseated: r?.unseated, rows: short(off ? r?.beforeRows ?? [] : r?.afterRows ?? [])}));
            if (off) {
                console.log("limbs", hour, "primates on limbs", JSON.stringify(r?.primates ?? []));
                const inTrunk = (r?.beforeRows ?? []).find((x) => /langur|monkey|macaque|lemur|gibbon|colobus|capuchin|tamarin|marmoset|orangutan|baboon|chimp/.test(x.slug));
                if (inTrunk && hour >= 7 && hour <= 15 && !pick?.inTrunk) pick = {...inTrunk, hour, inTrunk: true};
                const still = (r?.primates ?? []).find((x) => !x.moving);
                if (!pick && still && hour >= 7 && hour <= 15) pick = {...still, hour};
            }
        }
    }
    await page.evaluate(() => (window.__arkLimbFixOff = false));
    console.log("limbs pick", JSON.stringify(pick));
    if (pick) {
        await page.evaluate((h) => window.__arkScene.setHours(h), pick.hour);
        await wait(3000);
        await closeUp(`limb-${pick.slug}`, pick.id, "__arkLimbFixOff");
    }
}

// Round 4e: an eave bird framed by hand from above and outside its house (the planned eave before, the drawn eave after),
// and the shield stink bug on the town island in the page's close-up.
if (want("r4e")) {
    await crossTo("town");
    let birds = [];
    for (const h of [11, 15, 8]) {
        await page.evaluate((h) => window.__arkScene.setHours(h), h);
        await wait(4000);
        birds = await page.evaluate(() => {
            const out = [];
            for (const e of window.__arkDebug.entries()) {
                const p = e.sched?.pose;
                if (!p || p.moving || p.aloft || e.length > 0.7 || e.length < 0.08 || /bat|moth|hornet|wasp|bee|fly|beetle|spider/.test(e.animal.model_slug)) continue;
                const eave = window.__arkDebug.eaveAt?.(p.x, p.y, p.z);
                if (eave) out.push({id: e.animal.id, slug: e.animal.model_slug, spot: {x: p.x, y: p.y, z: p.z}, eave});
            }
            return out;
        });
        console.log("r4e eave birds", h, JSON.stringify(birds.map((b) => b.slug)));
        if (birds.length) break;
    }
    for (const b of birds.slice(0, 3)) {
        for (const off of [true, false]) {
            await page.evaluate((off) => (window.__arkEaveFixOff = off), off);
            const at = off ? b.spot : b.eave;
            // (From above and outside: the view looks down on the eave from 3 m, steeply, so the camera is over the roof's edge.)
            await page.evaluate((at) => window.__arkScene.setView({target: {x: at.x, y: at.y, z: at.z}, distance: 3, polar: 0.75, azimuth: Math.atan2(at.x, at.z)}), at);
            await wait(3500);
            const drawn = await page.evaluate((id) => window.__arkDebug.entries().find((e) => e.animal.id === id)?.drawn ?? null, b.id);
            console.log("r4e eave", b.slug, off ? "before" : "after", JSON.stringify({drawn: drawn && {x: drawn.x, y: drawn.y, z: drawn.z}, spot: b.spot, eave: b.eave}));
            await shot(`eave-${b.slug}-${off ? "before" : "after"}`);
        }
    }
    await page.evaluate(() => (window.__arkEaveFixOff = false));
    let bugs = [];
    for (let k = 0; k < 4 && !bugs.length; k++) {
        bugs = await find("shield-stink-bug");
        if (!bugs.length) await wait(4000);
    }
    console.log("r4e bugs", bugs.length, JSON.stringify(bugs.map((b) => b.micro)));
    for (const bug of bugs.slice(0, 2)) await closeUp(`r4e-shield-stink-bug-${bug.micro ?? "ground"}`, bug.id, "__arkRockFixOff");
}

if (want("closeups")) {
    await crossTo("town");
    await page.evaluate(() => window.__arkScene.setHours(11));
    await wait(5000);
    // A bird (not a bat or an insect) resting on an eave perch whose drawn eave is elsewhere.
    for (let tries = 0; tries < 3; tries++) {
        const birds = await page.evaluate(() => {
            const out = [];
            for (const e of window.__arkDebug.entries()) {
                const p = e.sched?.pose;
                if (!p || p.moving || p.aloft || e.length > 0.7 || e.length < 0.08) continue;
                if (!/dove|pigeon|sparrow|gull|crow|jackdaw|starling|wren|swallow|martin|robin|finch|tit$|blackbird|kestrel/.test(e.animal.model_slug)) continue;
                if (window.__arkDebug.eaveAt?.(p.x, p.y, p.z)) out.push({id: e.animal.id, slug: e.animal.model_slug});
            }
            return out;
        });
        console.log("eave birds", JSON.stringify(birds.slice(0, 10)));
        if (birds.length) {
            for (const b of birds.slice(0, 2)) await closeUp(`c-eave-${b.slug}`, b.id, "__arkEaveFixOff");
            break;
        }
        await wait(3000);
    }
    await crossTo("wild");
    await page.evaluate(() => window.__arkScene.setHours(11));
    await wait(5000);
    let bugs = await find("shield-stink-bug");
    for (let k = 0; k < 4 && !bugs.length; k++) {
        await wait(4000);
        bugs = await find("shield-stink-bug");
    }
    console.log("bugs", bugs.length, JSON.stringify(bugs.map((b) => b.micro)));
    const byRock = bugs.find((r) => r.micro === "rock_face") ?? bugs.find((r) => !r.aloft);
    if (byRock) await closeUp(`c-shield-stink-bug-${byRock.micro ?? "ground"}`, byRock.id, "__arkRockFixOff");
    const second = bugs.find((r) => r !== byRock && !r.aloft);
    if (second) await closeUp(`c-shield-stink-bug-2-${second.micro ?? "ground"}`, second.id, "__arkRockFixOff");
    // A beetle on a flower head (a golden tortoise beetle where one sits on one, else the nearest beetle on a flower).
    const onFlower = await page.evaluate(() => {
        const out = [];
        for (const e of window.__arkDebug.entries()) if (e.place?.micro?.attach?.tag === "flower_head" && e.length <= 0.05) out.push({id: e.animal.id, slug: e.animal.model_slug});
        // (Beetles first.)
        return out.sort((a, b) => Number(/beetle|ladybird|weevil|chafer/.test(b.slug)) - Number(/beetle|ladybird|weevil|chafer/.test(a.slug)));
    });
    console.log("flower beetles", JSON.stringify(onFlower));
    for (const b of onFlower.slice(0, 2)) await closeUp(`c-flower-${b.slug}`, b.id, "__arkFlowerFixOff");
    // Leaves: the count again, framed close.
    const leafy = await page.evaluate(() => {
        const out = [];
        for (const e of window.__arkDebug.entries()) {
            const tag = e.place?.micro?.attach?.tag ?? null;
            if ((tag === "flower_head" || tag === "leaf") && e.length <= 0.15) out.push({id: e.animal.id, slug: e.animal.model_slug, tag});
        }
        return out;
    });
    const sample = [...leafy.filter((p) => p.tag === "flower_head").slice(0, 24), ...leafy.filter((p) => p.tag === "leaf").slice(0, 10)];
    const tally = {before: {n: 0, off: 0, flower: 0, leaf: 0}, after: {n: 0, off: 0, flower: 0, leaf: 0}};
    for (const p of sample) {
        const item = {...p};
        for (const off of [true, false]) {
            await page.evaluate((off) => (window.__arkFlowerFixOff = off), off);
            if (!(await frame(p.id, 0.8, 1.0, Math.PI / 3, 2500))) continue;
            const u = await under(p.id, null);
            const first = u?.hits?.[0] ?? null;
            const gap = first ? first.gap : null;
            item[off ? "before" : "after"] = {gap, kind: first?.kind ?? null};
            const t = tally[off ? "before" : "after"];
            t.n++;
            if (gap === null || Math.abs(gap) > 0.01) {
                t.off++;
                t[p.tag === "leaf" ? "leaf" : "flower"]++;
            }
        }
        console.log("leafy", JSON.stringify(item));
    }
    await page.evaluate(() => (window.__arkFlowerFixOff = false));
    console.log("leafy-tally", JSON.stringify(tally));
    // Every small animal inside a drawn rock, the whole island: drawn, posed and at home.
    const all = await page.evaluate(() => window.__arkDebug.insideRocks(0.15));
    console.log("rocks-all wild", JSON.stringify({checked: all.checked, inside: all.inside, worst: all.rows.slice(0, 15).map((r) => [r.slug, r.depth, r.from, r.micro])}));
    await crossTo("town");
    const town = await page.evaluate(() => window.__arkDebug.insideRocks(0.15));
    console.log("rocks-all town", JSON.stringify({checked: town.checked, inside: town.inside, worst: town.rows.slice(0, 15).map((r) => [r.slug, r.depth, r.from, r.micro])}));
}

// Why a sleeping farm animal plays its idle: its sleep, its act, its rig's base and the clips it has.
if (want("farm-why")) {
    await crossTo("town");
    await page.evaluate(() => window.__arkScene.setHours(23));
    await wait(4000);
    for (const slug of ["domestic-pig", "domestic-sheep", "cow"]) {
        const rows = await find(slug);
        for (const row of rows.slice(0, 3)) {
            await frame(row.id, 4, 1.1, Math.PI / 4, 3000);
            const why = await page.evaluate((id) => {
                const e = window.__arkDebug.entries().find((x) => x.animal.id === id);
                if (!e) return null;
                return {doing: e.sched?.trip?.doing ?? null, level: e.level, sleepNow: e.sleepNow ? {posture: e.sleepNow.posture, down: e.sleepNow.down, t: e.sleepNow.t} : null, act: e.act ? {state: e.act.state, meal: Boolean(e.act.meal)} : null, sleepClipped: e.sleepClipped ?? null, clips: window.__arkDebug.rigClips?.(e.animal.model_slug) ?? null, rig: e.rig ? {now: e.rig.now?.name, base: e.rig.base, toward: e.rig.toward ?? null, weight: e.rig.weight} : null, visitor: Boolean(e.visitor), reactive: e.reactive ? {action: e.reactive.action, woke: e.reactive.woke} : null, place: e.place ? Object.keys(e.place).filter((k) => e.place[k]) : null};
            }, row.id);
            console.log("farm-why", slug, JSON.stringify(why));
        }
    }
}

// The owner's report at 03:31: the farm at night, every cow and pig (asleep or not), close at its rig and from 25 m.
if (want("farm-night")) {
    await crossTo("town");
    report.farmNight = [];
    for (const h of [3, 23]) {
        await page.evaluate((h) => window.__arkScene.setHours(h), h);
        await wait(4000);
        for (const slug of ["cow", "domestic-pig", "domestic-horse", "domestic-sheep"]) {
            const rows = await find(slug);
            console.log("farm-night", h, slug, JSON.stringify(rows.map((r) => [r.doing, r.asleep ? "z" : r.moving ? "m" : "s", r.clip?.now ?? null])));
            const picks = [rows.find((r) => r.asleep), rows.find((r) => !r.asleep && !r.moving), rows.find((r) => r.moving)].filter(Boolean);
            for (const row of picks) {
                for (const distance of [Math.max(row.length * 3.5, 2.5), 25]) {
                    if (!(await frame(row.id, distance, 1.1, Math.PI / 4, 3000))) continue;
                    const u = await under(row.id, null);
                    const t = await page.evaluate((id) => window.__arkDebug.tips?.(id) ?? null, row.id);
                    const gaps = (t?.tips ?? []).map((x) => x.gap).filter((g) => g !== null);
                    const item = {h, slug, asleep: row.asleep, moving: row.moving, distance: Math.round(distance), level: u?.drawn?.level ?? null, lying: u?.drawn?.lying ?? null, feetLineSunk: u?.drawnGround ?? null, tipsLowest: gaps.length ? Math.max(...gaps) : null, tipsHighest: gaps.length ? Math.min(...gaps) : null, clip: u?.drawn?.clip ?? null, base: u?.drawn?.base ?? null, poseY: u?.drawn?.poseY ?? null};
                    report.farmNight.push(item);
                    console.log("farm-night", JSON.stringify(item));
                    if (distance < 20) await shot(`night-${h}-${slug}-${row.asleep ? "asleep" : row.moving ? "moving" : "awake"}`);
                }
            }
        }
    }
    await daylight();
}

// The owner's walking pig and cow: hours tried until one walks; shot at 5, 15 and 35 m (its rig, near and far).
if (want("farm-walk")) {
    await crossTo("town");
    for (const slug of ["domestic-pig", "cow"]) {
        let row = null;
        for (const h of [11, 9, 13, 15, 17, 7, 19, 21, 23, 3]) {
            await page.evaluate((h) => window.__arkScene.setHours(h), h);
            await wait(3500);
            row = (await find(slug)).find((r) => r.moving) ?? null;
            if (row) {
                console.log("farm-walk", slug, "walking at", h);
                break;
            }
        }
        if (!row) {
            console.log("farm-walk", slug, "never walking");
            continue;
        }
        for (const d of [5, 15, 35]) {
            if (!(await frame(row.id, d, 1.25, Math.PI / 3, 2500))) continue;
            const u = await under(row.id, null);
            console.log("farm-walk", slug, d, JSON.stringify({level: u?.drawn?.level ?? null, sunk: u?.drawnGround ?? null, clip: u?.drawn?.clip ?? null}));
            await shot(`walk-${slug}-${d}m`);
        }
    }
    await daylight();
}

// Round 3 (rig jerk under load): a giraffe framed from 14 m, the clock running; 6 s as the page runs, then 6 s with
// the main thread held 150 ms every 300 ms (a long frame forced). Each frame's drawn step against its schedule's.
if (want("long-frame")) {
    await crossTo("town");
    const rows = await find("giraffe");
    const row = pick(rows, (r) => r.moving) ?? rows[0];
    if (row) {
        await frame(row.id, 14, 1.2, Math.PI / 3, 5000);
        const target = await page.evaluate((id) => window.__arkScene.locate(id), row.id);
        const run = async (stall) => {
            await page.evaluate(({target, stall}) => {
                window.__lfLog = [];
                if (stall) window.__lfStall = setInterval(() => {
                    const until = performance.now() + 150;
                    while (performance.now() < until) {}
                }, 300);
                const step = () => {
                    const at = [];
                    for (const e of window.__arkDebug.entries()) {
                        if (!e.drawn || !e.sched?.pose || e.level === "token") continue;
                        if (Math.hypot(e.drawn.x - target.x, e.drawn.z - target.z) > 60) continue;
                        at.push([e.animal.id, e.animal.model_slug, e.drawn.level, e.drawn.wx, e.drawn.wz, e.sched.pose.x, e.sched.pose.z, 0, null, e.drawn.path ?? null, e.drawn.frameDt ?? null, e.sched.at ?? null, e.drawn.react?.x ?? 0, e.drawn.react?.z ?? 0, e.drawn.apart?.x ?? 0, e.drawn.apart?.z ?? 0]);
                    }
                    window.__lfLog.push({t: performance.now(), at});
                    window.__lfRaf = requestAnimationFrame(step);
                };
                window.__lfRaf = requestAnimationFrame(step);
            }, {target, stall});
            await wait(6000);
            const log = await page.evaluate(() => {
                cancelAnimationFrame(window.__lfRaf);
                clearInterval(window.__lfStall);
                return window.__lfLog;
            });
            writeFileSync(path.join(out, `${label}-long-frame-${stall ? "forced" : "normal"}.json`), JSON.stringify(log));
            // Drawn steps (only frames where something moved: the scene draws on some frames, not every one).
            const last = new Map();
            let worst = 0;
            let worstRatio = 0;
            let longFrames = 0;
            let longPose = 0;
            let worstExcess = 0;
            const steps = [];
            for (const f of log) {
                for (const r of f.at) {
                    const p = last.get(r[0]);
                    if (p) {
                        const d = Math.hypot(r[3] - p.r[3], r[4] - p.r[4]);
                        const pd = Math.hypot(r[5] - p.r[5], r[6] - p.r[6]);
                        if (r[10] >= 0.09) longPose = Math.max(longPose, pd);
                        if (d > 1e-4 && pd > 0.02) worstExcess = Math.max(worstExcess, d - pd);
                        if (d > 1e-4) {
                            steps.push(d);
                            if (d > worst) worst = d;
                            if (pd > 0.02) worstRatio = Math.max(worstRatio, d / pd);
                        }
                    }
                    last.set(r[0], {r});
                }
            }
            for (let k = 1; k < log.length; k++) if (log[k].t - log[k - 1].t > 100) longFrames++;
            let lag = 0;
            let top = null;
            for (const f of log) for (const r of f.at) {
                lag = Math.max(lag, r[7] ?? 0);
                if (r[1] === "giraffe" && r[8] !== null) top = r[8];
            }
            steps.sort((a, b) => b - a);
            return {frames: log.length, longFrames, worstStep: Math.round(worst * 1000) / 1000, p99: Math.round((steps[Math.floor(steps.length * 0.01)] ?? 0) * 1000) / 1000, worstOverSchedule: Math.round(worstRatio * 100) / 100, eased: Math.round(lag * 1000) / 1000, giraffeTopPace: top, scheduleStepInLongFrames: Math.round(longPose * 1000) / 1000, worstStepOverSchedule: Math.round(worstExcess * 1000) / 1000};
        };
        report.longFrame = {normal: await run(false), forced: await run(true)};
        console.log("long-frame", JSON.stringify(report.longFrame));
    }
}

// Round 3: chosen as the page chooses one (`select(id, true)`: its close-up, tiny ones shown true to size), the camera
// the page's own; hours tried in turn until one is as wanted (an awake cat on the move).
const selected = async (name, slug, test, island = "wild", hours = [11]) => {
    if (!want(name)) return;
    await crossTo(island);
    let row = null;
    for (const h of hours) {
        await page.evaluate((h) => window.__arkScene.setHours(h), h);
        await wait(4000);
        row = (await find(slug)).find(test) ?? null;
        if (row) {
            report.subjects[`${name}-hours`] = h;
            break;
        }
    }
    if (!row) row = (await find(slug))[0] ?? null;
    if (!row) return console.log("none:", slug);
    await page.evaluate((id) => window.__arkScene.select(id, true), row.id);
    await wait(7000);
    const now = (await find(slug)).find((r) => r.id === row.id) ?? row;
    console.log(name, "state", JSON.stringify({doing: now.doing, asleep: now.asleep, moving: now.moving, clip: now.clip, micro: now.micro, hours: report.subjects[`${name}-hours`] ?? null}));
    console.log(name, "under", JSON.stringify(await under(row.id, row.normal ?? null)));
    console.log(name, "tips", JSON.stringify(await page.evaluate((id) => window.__arkDebug.tips?.(id) ?? null, row.id)));
    await shot(name);
    await page.evaluate(() => window.__arkScene.select(null));
    await daylight();
    await wait(1500);
};
await selected("r3-frog", "marsh-frog", (r) => !r.aloft);
await selected("r3-crab", "mangrove-crab", (r) => r.micro === "rock_face");
await selected("r3-cat-walk", "domestic-cat", (r) => !r.asleep && r.moving, "town", [8, 9.5, 13, 15, 17, 18.5, 20, 7]);
await selected("r3-cat-awake", "domestic-cat", (r) => !r.asleep, "town", [8, 13, 17, 20, 7]);
await selected("r3-bug-leaf", "seven-spot-ladybird", (r) => r.micro === "leaf", "town");
await selected("r3-bug-leaf-2", "shield-stink-bug", (r) => r.micro === "leaf");
await daylight();

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
                    at.push([e.animal.id, e.animal.model_slug, e.drawn.level, e.drawn.x, e.drawn.y, e.drawn.z, e.sched.pose.x, e.sched.pose.z, e.sched.at, Boolean(e.sched.pose.moving), e.level, e.drawn.wx, e.drawn.wz, e.drawn.yaw, e.drawn.react?.x ?? null, e.drawn.react?.z ?? null, e.reactive?.action ?? null]);
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
                    // (Swimming, its body in the water over the bed, is no gap; on a rock, the rock is what it stands on.)
                    if (e.drawn.inWater) continue;
                    const u = window.__arkDebug.under(e.animal.id);
                    const ground = u?.hits.find((h) => h.kind.startsWith("ark-ground") || h.kind.startsWith("asset-rock") || h.kind.startsWith("props")) ?? (u ? {gap: u.drawnGround, kind: "drawn-ground"} : null);
                    if (ground) out.push({slug: e.animal.model_slug, level: e.drawn.level, gap: ground.gap, on: ground.kind, asleep: Boolean(e.sleepNow?.down), lying: e.drawn.lying ?? null, act: e.sched.pose.act?.state ?? null, root: e.drawn.root, stand: e.drawn.ground, inWater: e.drawn.inWater, afloat: e.drawn.afloat, waterTop: e.drawn.waterTop, height: e.drawn.height, base: e.drawn.base, poseY: e.drawn.poseY, clip: e.drawn.clip, doing: e.state?.doing ?? null});
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
