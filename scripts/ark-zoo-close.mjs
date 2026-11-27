#!/usr/bin/env node
/**
 * The zoo close-up probe (lane ZOOGLITCH, the owner 2026-11-24: the enclosures "glitch when I get close"): the real
 * scene (the apps' embed, a development bundle: `node scripts/build-ark-bundle.mjs --dev`) on a snapshot, on a stepped
 * clock: the page's frames run only when the probe steps them, each one 1/60 s of world time, so a recording and its
 * numbers are the same frames, run to run. For each enclosure asked for, the camera flies from mid distance down to
 * close on it, then holds there; every frame it logs each resident's drawn middle, heading, level and pose path, and
 * writes the canvas (jpg). Per animal: its frame-to-frame jitter (the second difference of its drawn middle, m, and of
 * its heading, rad), the frames its level or pose path flipped, and the frames it stepped back and forth.
 *
 *   node scripts/ark-zoo-close.mjs --snapshot /ark-local/live.json --out <dir>
 *        [--enclosures savanna_paddocks-1,childrens_farm-1]  (default: the elephants' and the three busiest outdoor ones)
 *        [--hour 11] [--frames 240 --hold 180] [--from 45 --to 4] [--every 2] [--label before]
 *        [--width 960 --height 600] [--gl metal] [--follow <resident id>[,<id>]] [--azimuth <rad>]
 *        [--gate]       exit 1 when a resident glitches: drawn in and out more than 4 times, or a step between two drawn
 *                       frames bigger than its length's quarter and 0.5 m (a walk is centimetres a frame), or a turn of
 *                       more than 1 rad in a frame
 *                       or two bodies inside each other (their collision capsules more than 8 cm deep beyond touching)
 *                       for more than --overlap-frames (10) frames running
 *        [--regate <label>.json]  the gate again on a report already made (no browser), with its deepest overlaps
 *        [--dump-leaders]  who each zoo resident keeps to, and where both are placed (<label>-leaders.json), then exits
 *
 * Writes <out>/<label>-<enclosure>/NNNN.jpg, <out>/<label>-<enclosure>.mp4, <out>/<label>-<enclosure>-strip.jpg and
 * <out>/<label>.json (every frame's rows and the per-animal summary). Nothing is uploaded; models come from the public bucket.
 */
import {execFileSync} from "node:child_process";
import {createReadStream, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync} from "node:fs";
import {createServer} from "node:http";
import path from "node:path";

const arg = (name, fallback) => {
    const at = process.argv.indexOf(`--${name}`);
    return at >= 0 && process.argv[at + 1] && !process.argv[at + 1].startsWith("--") ? process.argv[at + 1] : fallback;
};
const publicDir = path.resolve(arg("public", "public"));
const out = path.resolve(arg("out", ".ark-golden/zoo-close"));
const label = arg("label", "before");
const hour = Number(arg("hour", "11"));
const flyFrames = Number(arg("frames", "240"));
const holdFrames = Number(arg("hold", "180"));
const from = Number(arg("from", "45"));
const to = Number(arg("to", "4"));
const every = Number(arg("every", "2"));
const gl = arg("gl", "metal");
const wanted = arg("enclosures", "");
// The passes: "fixed" (the view's target held on the enclosure's middle) and "drift" (the target sliding onto it from
// `--drift` m off as the camera comes in: the page's zoom to the cursor moves the target as a viewer zooms).
const passes = arg("passes", "fixed,drift").split(",");
const drift = Number(arg("drift", "20"));
// (`--follow <id>[,<id>]`: the view's target on those residents' middle every frame, wherever they go: an elephant pair's close-up; full ids are selected first so they join.)
const follows = arg("follow", "").split(",").filter(Boolean);
// (`--azimuth`: the view's turn about the target, rad; 0.6 by default.)
const azimuth = Number(arg("azimuth", "0.6"));
/** The followed residents' middle on the page (their mean, each by the scene's `locate`), and how far apart the first two are (m). */
const followAt = (follows) => {
    const at = [];
    for (const f of follows) {
        const e = window.__arkDebug.entries().find((q) => q.animal.id.startsWith(f));
        const l = e && window.__arkScene.locate(e.animal.id);
        if (l) at.push({x: l.x, y: l.ground, z: l.z});
    }
    if (!at.length) return null;
    const m = {x: 0, y: 0, z: 0, n: at.length, apart: at.length > 1 ? Math.hypot(at[0].x - at[1].x, at[0].z - at[1].z) : null};
    for (const a of at) {
        m.x += a.x / at.length;
        m.y += a.y / at.length;
        m.z += a.z / at.length;
    }
    return m;
};
mkdirSync(out, {recursive: true});

// MARK: the gate (a function: `--regate <label>.json` runs it again on a report already made, no browser)
function gate(report) {
const failures = [];
for (const e of report.enclosures) {
    for (const a of e.animals) {
        const why = [];
        if (a.drawnFlips > 4) why.push(`drawn in and out ${a.drawnFlips} times`);
        // (A step between two drawn frames: the first difference, not the second's jitter.)
        const rows = e.frames.map((f) => f.animals.find((x) => x.id.slice(0, 8) === a.id));
        let step = 0;
        let turn = 0;
        for (let i = 1; i < rows.length; i++) {
            const p = rows[i - 1];
            const q = rows[i];
            if (!p?.drawn || !q?.drawn) continue;
            step = Math.max(step, Math.hypot(q.x - p.x, q.z - p.z));
            if (p.yaw !== null && q.yaw !== null) turn = Math.max(turn, Math.abs(Math.atan2(Math.sin(q.yaw - p.yaw), Math.cos(q.yaw - p.yaw))));
        }
        if (step > Math.max(0.5, a.length * 0.25)) why.push(`a ${step.toFixed(2)} m step in a frame`);
        if (turn > 1) why.push(`a ${turn.toFixed(2)} rad turn in a frame`);
        a.step = +step.toFixed(3);
        a.turn = +turn.toFixed(3);
        if (why.length) failures.push(`${e.pass} ${e.enclosure} ${a.slug} ${a.id}: ${why.join(", ")}`);
    }
}
// Two bodies inside each other: their bodies as the collisions have them (`collide/bodies.ts`: a capsule along its heading,
// from `body-shapes.json`), deeper than `INSIDE` beyond touching, for more than `--overlap-frames` frames running.
const SHAPES = JSON.parse(readFileSync(path.resolve("src/ark-scene/collide/body-shapes.json"), "utf8")).shapes;
const INSIDE = 0.08;
const overlapFrames = Number(arg("overlap-frames", "10"));
const bodyOf = (slug, length) => {
    const code = SHAPES[slug];
    const [w, , l] = code && code.length === 6 ? [0, 2, 4].map((i) => parseInt(code.slice(i, i + 2), 36) / 100) : [0.35, 0.5, 1];
    const radius = Math.max((w * length) / 2, 0.005);
    return {radius, half: Math.max((l * length) / 2 - radius, 0)};
};
/** The closest two points' distance of two segments in the ground plane. */
const segDistance = (ax, az, bx, bz, cx, cz, dx, dz) => {
    const pts = [];
    const onto = (px, pz, x1, z1, x2, z2) => {
        const vx = x2 - x1;
        const vz = z2 - z1;
        const l = vx * vx + vz * vz;
        const t = l < 1e-9 ? 0 : Math.min(Math.max(((px - x1) * vx + (pz - z1) * vz) / l, 0), 1);
        return Math.hypot(px - (x1 + vx * t), pz - (z1 + vz * t));
    };
    // (Crossing: zero; else the least of the four ends onto the other.)
    const side = (px, pz, x1, z1, x2, z2) => Math.sign((x2 - x1) * (pz - z1) - (z2 - z1) * (px - x1));
    if (side(ax, az, cx, cz, dx, dz) * side(bx, bz, cx, cz, dx, dz) < 0 && side(cx, cz, ax, az, bx, bz) * side(dx, dz, ax, az, bx, bz) < 0) return 0;
    pts.push(onto(ax, az, cx, cz, dx, dz), onto(bx, bz, cx, cz, dx, dz), onto(cx, cz, ax, az, bx, bz), onto(dx, dz, ax, az, bx, bz));
    return Math.min(...pts);
};
const depthOf = (a, ba, b, bb) => {
    const fa = [Math.sin(a.yaw ?? 0) * ba.half, Math.cos(a.yaw ?? 0) * ba.half];
    const fb = [Math.sin(b.yaw ?? 0) * bb.half, Math.cos(b.yaw ?? 0) * bb.half];
    return ba.radius + bb.radius - segDistance(a.x - fa[0], a.z - fa[1], a.x + fa[0], a.z + fa[1], b.x - fb[0], b.z - fb[1], b.x + fb[0], b.z + fb[1]);
};
for (const e of report.enclosures) {
    const body = new Map(e.animals.map((a) => [a.id, bodyOf(a.slug, a.length)]));
    const slug = new Map(e.animals.map((a) => [a.id, a.slug]));
    const runs = new Map();
    const worst = new Map();
    e.overlaps = [];
    for (const f of e.frames) {
        const drawn = f.animals.filter((r) => r.drawn && body.get(r.id.slice(0, 8)));
        const now = new Set();
        for (let i = 0; i < drawn.length; i++) {
            for (let j = i + 1; j < drawn.length; j++) {
                const a = drawn[i];
                const b = drawn[j];
                const ba = body.get(a.id.slice(0, 8));
                const bb = body.get(b.id.slice(0, 8));
                // (A recipe's pair may touch; so may two asleep together: the collisions' own allowances, roughly.)
                const deep = depthOf(a, ba, b, bb) - 0.1 * Math.min(ba.radius, bb.radius);
                if (deep <= INSIDE || (a.asleep && b.asleep)) continue;
                const key = `${a.id.slice(0, 8)}|${b.id.slice(0, 8)}`;
                now.add(key);
                const run = (runs.get(key) ?? 0) + 1;
                runs.set(key, run);
                const was = worst.get(key);
                if (!was || run > was.n) worst.set(key, {n: run, frame: f.frame, deep: Math.max(deep, was?.deep ?? 0), a: {act: a.act, role: a.role, moment: a.moment, doing: a.doing, asleep: a.asleep}, b: {act: b.act, role: b.role, moment: b.moment, doing: b.doing, asleep: b.asleep}});
                else was.deep = Math.max(was.deep, deep);
            }
        }
        for (const k of [...runs.keys()]) if (!now.has(k)) runs.delete(k);
    }
    worst.forEach((w, key) => {
        const [a, b] = key.split("|");
        e.overlaps.push({a: `${slug.get(a)} ${a}`, b: `${slug.get(b)} ${b}`, ...w, deep: +w.deep.toFixed(2)});
        if (w.n > overlapFrames) failures.push(`${e.pass} ${e.enclosure} ${slug.get(a)} ${a} inside ${slug.get(b)} ${b} for ${w.n} frames, ${w.deep.toFixed(2)} m deep (to frame ${w.frame}; ${JSON.stringify(w.a)} / ${JSON.stringify(w.b)})`);
    });
}
return failures;
}
if (arg("regate", "")) {
    const report = JSON.parse(readFileSync(arg("regate", ""), "utf8"));
    const failures = gate(report);
    console.log(failures.length ? `GLITCHES (${failures.length}):\n  ${failures.join("\n  ")}` : "no glitches");
    for (const e of report.enclosures) for (const o of e.overlaps.sort((p, q) => q.n - p.n).slice(0, 6)) console.log(`  ${e.pass} ${e.enclosure} ${o.a} | ${o.b}: ${o.n} frames, ${o.deep} m`);
    process.exit(process.argv.includes("--gate") && failures.length ? 1 : 0);
}

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
const browser = await chromium.launch({channel: "chrome", headless: true, args: ["--headless=new", "--enable-gpu", "--ignore-gpu-blocklist", `--use-angle=${gl}`]});
const context = await browser.newContext({viewport: {width: Number(arg("width", "960")), height: Number(arg("height", "600"))}, deviceScaleFactor: 1});
const page = await context.newPage();
page.setDefaultTimeout(900_000);
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));

// The stepped clock. Until `__step.hold()` the page runs on its own frames, the world clock moving 1/60 s each frame
// (from a fixed moment); held, a frame runs only when `__step.run(n)` runs it, each one 1/60 s on.
await page.addInitScript(() => {
    const realRaf = window.requestAnimationFrame.bind(window);
    const realPerf = performance.now.bind(performance);
    const start = Date.UTC(2026, 10, 24, 3, 0, 0);
    const perf0 = realPerf();
    let t = 0;
    let frame = 0;
    let queue = [];
    let held = false;
    Date.now = () => start + t;
    performance.now = () => perf0 + t;
    const runFrame = () => {
        t += 1000 / 60;
        frame++;
        const now = queue;
        queue = [];
        for (const callback of now) {
            try {
                callback(perf0 + t);
            } catch (error) {
                console.error(error);
            }
        }
        for (const after of window.__step.after) after(frame);
    };
    let id = 0;
    window.requestAnimationFrame = (callback) => {
        queue.push(callback);
        return ++id;
    };
    window.cancelAnimationFrame = () => undefined;
    const pump = () => {
        if (!held) runFrame();
        realRaf(pump);
    };
    realRaf(pump);
    window.__step = {
        after: [],
        hold: () => (held = true),
        free: () => (held = false),
        run: (n) => {
            for (let i = 0; i < n; i++) runFrame();
            return frame;
        },
        /** One real frame for the compositor, no scene frame (the canvas shows the last one run). */
        present: () => new Promise((resolve) => realRaf(() => realRaf(resolve))),
        frame: () => frame
    };
    window.__arkQuality = "high";
});
const wait = (ms) => page.waitForTimeout(ms);
await page.goto(`${base}/ark/embed.html?snapshot=${arg("snapshot", "/ark-local/live.json")}&hud=0&lang=en`, {waitUntil: "domcontentloaded"});
await page.waitForFunction(() => Boolean(window.__arkScene), null, {timeout: 900_000});
await page.evaluate(() => window.__arkScene.mounted());
await page.waitForFunction(() => !window.__arkScene.attached || window.__arkScene.attached(), null, {timeout: 900_000}).catch(() => undefined);
const calm = () => page.evaluate((hour) => {
    window.__arkScene.setHours?.(hour);
    window.__arkScene.setEnvironment?.({rain: 0, wetness: 0, fog: 0, storm: 0, snow: 0, cloud: 0.15, wind: 0});
}, hour);
await calm();
if ((await page.evaluate(() => window.__arkScene.island?.())) !== "town") {
    await page.evaluate(() => window.__arkScene.crossTo?.("town"));
    await wait(12000);
}
await calm();
await wait(8000);
console.log("on", await page.evaluate(() => window.__arkScene.island?.()), "entries", await page.evaluate(() => window.__arkDebug.entries().length));

/** Each enclosure's residents (the scene's own roster) and the middle of where they are. */
const residents = (enclosure) => page.evaluate((enclosure) => {
    // (A zoo enclosure by its residents' enclosure; a town farm's pen, `rural-paddock-2`, by its kept animals' town place.)
    const list = window.__arkDebug.entries().filter((e) => !e.ghost && !e.visitor && (e.animal.enclosure === enclosure || window.__arkDebug.townPlace?.(e.animal.id)?.place === enclosure));
    return list.map((e) => ({id: e.animal.id, slug: e.animal.model_slug, length: e.length, at: window.__arkScene.locate(e.animal.id)})).filter((r) => r.at);
}, enclosure);
const counts = await page.evaluate(() => {
    const by = {};
    for (const e of window.__arkDebug.entries()) if (e.animal.enclosure && !e.ghost) by[e.animal.enclosure] = (by[e.animal.enclosure] ?? 0) + 1;
    return by;
});
const enclosures = wanted ? wanted.split(",") : ["savanna_paddocks-1", "savanna_paddocks-2", "childrens_farm-1", "hoofstock_paddocks-1"];
console.log("residents joined", JSON.stringify(Object.fromEntries(enclosures.map((e) => [e, counts[e] ?? 0]))));

// (`--dump-leaders`: who each zoo resident drawn one by one keeps to, and where both are placed; then exits.)
if (process.argv.includes("--dump-leaders")) {
    const rows = await page.evaluate(() => window.__arkDebug.entries().filter((e) => e.animal.enclosure && !e.ghost).map((e) => ({id: e.animal.id.slice(0, 8), slug: e.animal.model_slug, enclosure: e.animal.enclosure, x: e.place.x, z: e.place.z, leader: e.place.leader ? e.place.leader.slice(0, 8) : null, leaderOut: Boolean(e.leader), leaderEnclosure: e.leader ? e.leader.animal.enclosure : null, lx: e.leader ? e.leader.place.x : null, lz: e.leader ? e.leader.place.z : null})));
    writeFileSync(path.join(out, `${label}-leaders.json`), JSON.stringify(rows, null, 1));
    console.log("leaders", rows.length);
    await browser.close();
    server.close();
    process.exit(0);
}
const report = {label, hour, flyFrames, holdFrames, from, to, enclosures: []};
for (const pass of passes) for (const enclosure of enclosures) {
    // (The town lets its animals join by where the camera is: stand over the enclosure first, on the page's own frames.
    // With `--follow`, stand over that resident's own place first, so it and its neighbours are drawn and in the list.)
    if (follows.length) {
        // (Far from the camera it is not joined yet: the host's own select, close up, flies there and joins it; `--follow` takes full ids for that.)
        if (follows[0].length === 36) console.log("select", await page.evaluate((id) => typeof window.__arkScene.select === "function" ? (window.__arkScene.select(id, true), "ok") : "no select", follows[0]));
        let at = null;
        for (let k = 0; k < 45; k++) {
            await wait(1000);
            at = await page.evaluate(followAt, follows);
            if (at && at.n === follows.length && k >= 12) break;
        }
        await page.evaluate(() => window.__arkScene.select?.(null));
        console.log("follow", follows.join(","), JSON.stringify(at));
        if (at) {
            await page.evaluate((v) => { window.__arkDebug.controls.minDistance = 0.05; window.__arkScene.setView(v); }, {target: at, distance: to, polar: 1.12, azimuth});
            await wait(8000);
        }
    }
    let list = await residents(enclosure);
    for (const f of follows) if (!list.some((r) => r.id.startsWith(f))) console.log(enclosure, "followed resident", f, "not in this enclosure's drawn list");
    if (!list.length) {
        console.log(enclosure, "no residents drawn");
        continue;
    }
    const c = {x: 0, y: 0, z: 0};
    for (const r of list) {
        c.x += r.at.x / list.length;
        c.y += r.at.ground / list.length;
        c.z += r.at.z / list.length;
    }
    if (follows.length) {
        const at = await page.evaluate(followAt, follows);
        if (at) Object.assign(c, {x: at.x, y: at.y, z: at.z});
    }
    const view = (distance, k = 1) => ({target: pass === "drift" ? {x: c.x + drift * (1 - k) * Math.cos(0.6), y: c.y, z: c.z - drift * (1 - k) * Math.sin(0.6)} : c, distance, polar: 1.12, azimuth});
    await page.evaluate((v) => { window.__arkDebug.controls.minDistance = 0.05; window.__arkScene.setView(v); }, view(to));
    // (Models and rigs in, on the page's own frames.)
    for (let k = 0; k < 60; k++) {
        await wait(1000);
        if (!(await page.evaluate(() => window.__arkDebug.library?.busy || window.__arkDebug.rigs?.busy))) break;
    }
    await page.evaluate((v) => window.__arkScene.setView(v), view(from, 0));
    await wait(4000);
    list = await residents(enclosure);
    const ids = list.map((r) => r.id);
    const name = `${label}-${pass}-${enclosure}`;
    const dir = path.join(out, name);
    rmSync(dir, {recursive: true, force: true});
    mkdirSync(dir, {recursive: true});
    // (`--trap-acts`: every write of a resident's act recorded with where it came from, for the flicker's source.)
    if (process.argv.includes("--trap-acts")) {
        await page.evaluate((ids) => {
            window.__actWrites = [];
            const set = new Set(ids);
            for (const e of window.__arkDebug.entries()) {
                if (!set.has(e.animal.id)) continue;
                let value = e.act;
                Object.defineProperty(e, "act", {
                    configurable: true,
                    get: () => value,
                    set: (v) => {
                        if (v !== value && window.__actWrites.length < 4000) window.__actWrites.push({id: e.animal.id.slice(0, 8), slug: e.animal.model_slug, frame: window.__step.frame(), to: v ? v.state ?? "act" : null, hidden: v ? Boolean(v.hidden) : null, stack: new Error().stack.split("\n").slice(2, 7).map((l) => l.trim()).join(" < ")});
                        value = v;
                    }
                });
            }
        }, list.map((r) => r.id));
    }
    await page.evaluate(() => window.__step.hold());
    const frames = [];
    const total = flyFrames + holdFrames;
    for (let i = 0; i < total; i++) {
        // From `from` to `to` (m) on an even log scale, then held at `to`.
        const k = Math.min(i / Math.max(flyFrames - 1, 1), 1);
        const distance = from * Math.pow(to / from, k);
        const row = await page.evaluate(({v, ids, follows, followAt}) => {
            let pair = null;
            if (follows.length) {
                const at = (0, eval)(followAt)(follows);
                if (at) {
                    v = {...v, target: {x: at.x, y: at.y, z: at.z}};
                    pair = at.apart;
                }
            }
            window.__arkScene.setView(v);
            window.__step.run(1);
            const byId = new Map(window.__arkDebug.entries().map((e) => [e.animal.id, e]));
            const cam = window.__arkDebug.camera;
            return {
                pair,
                frame: window.__step.frame(),
                camera: {x: cam.position.x, y: cam.position.y, z: cam.position.z, near: cam.near, far: cam.far},
                animals: ids.map((id) => {
                    const e = byId.get(id);
                    if (!e) return {id, gone: true};
                    const m = e.middle;
                    return {id, level: e.level, path: e.posePath ?? null, drawn: Boolean(m), x: m ? m.x : null, y: m ? m.y : null, z: m ? m.z : null, yaw: e.yawNow ?? null, rig: Boolean(e.rigOn), clip: e.rig?.now?.name ?? null, seatY: e.seat ? e.seat.y : null, apartX: e.apart ? e.apart.x : null, apartZ: e.apart ? e.apart.z : null, asleep: Boolean(e.state?.asleep), kind: e.state?.kind ?? e.state?.activity ?? null, sx: e.sched?.pose ? e.sched.pose.x : null, sz: e.sched?.pose ? e.sched.pose.z : null, sAt: e.sched?.at ?? null, px: e.place.x, pz: e.place.z, act: e.act ? (e.act.state ?? "act") : null, held: Boolean(e.held), res: e.residentAt ? [e.residentAt.x, e.residentAt.z] : null, rdx: e.reactive ? e.reactive.dx : null, rdz: e.reactive ? e.reactive.dz : null, ract: e.reactive ? e.reactive.action : null, seat: e.seat ? [e.seat.x, e.seat.z] : null, wander: e.wander ? [e.wander.x, e.wander.z] : null, role: e.act?.role ?? null, moment: e.moment?.kind ?? null, doing: e.sched?.pose?.doing ?? null, recipe: e.sched?.pose?.act?.kind ?? e.sched?.pose?.act?.name ?? null, wired: Boolean(e.sched?.wired), sched: Boolean(e.sched), ex: e.sched?.eased ? e.sched.eased.dx : null, ez: e.sched?.eased ? e.sched.eased.dz : null, seatOn: e.seat?.on ?? null, seatIn: e.seat?.inside ?? null, seatPushes: e.seat?.pushes ?? null};
                })
            };
        }, {v: view(distance, k), ids, follows, followAt: `(${followAt})`});
        row.distance = distance;
        frames.push(row);
        if (i % every === 0) {
            await page.evaluate(() => window.__step.present());
            await page.locator("canvas").first().screenshot({path: path.join(dir, `${String(i / every).padStart(4, "0")}.jpg`), type: "jpeg", quality: 82});
        }
    }
    await page.evaluate(() => window.__step.free());
    if (follows.length > 1) {
        const apart = frames.map((f) => f.pair).filter((d) => d != null).sort((a, b) => a - b);
        if (apart.length) console.log("followed pair apart (m): min", apart[0].toFixed(2), "median", apart[apart.length >> 1].toFixed(2), "max", apart[apart.length - 1].toFixed(2), "frames", apart.length);
    }
    if (process.argv.includes("--trap-acts")) writeFileSync(path.join(out, `${name}-acts.json`), JSON.stringify(await page.evaluate(() => window.__actWrites), null, 1));
    // MARK: per animal
    const slugOf = new Map(list.map((r) => [r.id, r.slug]));
    const lengthOf = new Map(list.map((r) => [r.id, r.length]));
    const animals = ids.map((id) => {
        const rows = frames.map((f) => ({...f.animals.find((a) => a.id === id), distance: f.distance, frame: f.frame}));
        let jumpMax = 0;
        let jumpAt = null;
        let yawMax = 0;
        let reversals = 0;
        let levelFlips = 0;
        let pathFlips = 0;
        let drawnFlips = 0;
        const paths = new Set();
        for (let i = 1; i < rows.length; i++) {
            const a = rows[i - 1];
            const b = rows[i];
            if (a.level !== b.level) levelFlips++;
            if (a.path !== b.path) pathFlips++;
            if (a.drawn !== b.drawn) drawnFlips++;
            if (b.path) paths.add(b.path);
            if (i < 2 || !a.drawn || !b.drawn || !rows[i - 2].drawn) continue;
            const p = rows[i - 2];
            // The second difference: a steady walk is ~0, a pose snapping back and forth is the size of the snap.
            const ddx = b.x - 2 * a.x + p.x;
            const ddy = b.y - 2 * a.y + p.y;
            const ddz = b.z - 2 * a.z + p.z;
            const j = Math.hypot(ddx, ddy, ddz);
            if (j > jumpMax) {
                jumpMax = j;
                jumpAt = {frame: i, distance: +b.distance.toFixed(2), level: b.level, path: b.path};
            }
            if (a.yaw !== null && b.yaw !== null && p.yaw !== null) {
                const w = (d) => Math.atan2(Math.sin(d), Math.cos(d));
                yawMax = Math.max(yawMax, Math.abs(w(b.yaw - a.yaw) - w(a.yaw - p.yaw)));
            }
            // Back and forth: the step reverses direction by more than 1 cm both ways.
            const s1 = [a.x - p.x, a.z - p.z];
            const s2 = [b.x - a.x, b.z - a.z];
            if (Math.hypot(...s1) > 0.01 && Math.hypot(...s2) > 0.01 && s1[0] * s2[0] + s1[1] * s2[1] < 0) reversals++;
        }
        const hold = rows.slice(flyFrames);
        return {id: id.slice(0, 8), slug: slugOf.get(id), length: +(lengthOf.get(id) ?? 0).toFixed(2), jumpMax: +jumpMax.toFixed(3), jumpAt, yawJitterMax: +yawMax.toFixed(3), reversals, levelFlips, pathFlips, drawnFlips, paths: [...paths], holdDrawn: hold.filter((r) => r.drawn).length, holdLevels: [...new Set(hold.map((r) => r.level))]};
    });
    animals.sort((a, b) => b.jumpMax - a.jumpMax);
    report.enclosures.push({pass, enclosure, residents: ids.length, centre: c, animals, frames});
    console.log(`\n${pass} ${enclosure}: ${ids.length} residents`);
    for (const a of animals) console.log(`  ${a.slug.padEnd(28)} len ${String(a.length).padStart(5)} jump ${String(a.jumpMax).padStart(6)} m yaw ${String(a.yawJitterMax).padStart(5)} rev ${String(a.reversals).padStart(3)} lvl ${a.levelFlips} path ${a.pathFlips} drawn ${a.drawnFlips} ${JSON.stringify(a.jumpAt)} ${a.paths.join("|")}`);
    try {
        execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-framerate", String(60 / every), "-i", path.join(dir, "%04d.jpg"), "-pix_fmt", "yuv420p", "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2", path.join(out, `${name}.mp4`)]);
        const n = Math.ceil(total / every);
        execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", path.join(dir, "%04d.jpg"), "-vf", `select='not(mod(n\\,${Math.max(Math.round(n / 12), 1)}))',scale=480:-1,tile=4x3`, "-frames:v", "1", path.join(out, `${name}-strip.jpg`)]);
    } catch (error) {
        errors.push(String(error).slice(0, 300));
    }
}
// MARK: the gate
const failures = gate(report);
console.log(failures.length ? `GLITCHES (${failures.length}):\n  ${failures.join("\n  ")}` : "no glitches");
writeFileSync(path.join(out, `${label}.json`), JSON.stringify({...report, failures, errors: errors.slice(0, 20)}));
console.log("errors", errors.slice(0, 5));
await browser.close();
server.close();
if (process.argv.includes("--gate") && failures.length) process.exit(1);
