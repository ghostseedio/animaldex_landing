#!/usr/bin/env node
/**
 * ARK-SEAT's audit (the owner, 2026-11-21: "i need guaranteed fixes on animals not properly interacting with their
 * environments from bugs to mammals"): the real scene (the apps' embed, a development bundle:
 * `node scripts/build-ark-bundle.mjs --dev`), headless, on a snapshot, at several hours of the day on both islands.
 * The camera goes to every animal in turn (near enough that it and its neighbours are drawn as models and rigs), and
 * each one drawn is measured by the scene's probe (`src/ark-scene/seat/audit-probe.ts`): every vertex of its body as
 * posed, against the scene's own meshes with three's Raycaster, not the seat pass's index.
 *
 * An animal found off its seat is looked at again for three seconds (one on its way there arrives): it counts when it
 * is off every time.
 *
 * It fails (exit 1, with `--gate`) when one flying or swimming has its middle inside a rock, or when an animal that is
 * not flying, swimming, hanging, carried or in its den is
 *   - more than 3 cm over the drawn surface it rests on (hovering: the lowest of its feet, nothing of it touching;
 *     not one in a hop's, a bound's or a pounce's clip, whose feet leave the ground by the clip),
 *   - more than 3 cm under it (sunk: its seat, the quarter of its lowest points on uneven ground allowed for, and in a
 *     stride one swinging foot the clip takes under the ground's level), or
 *   - inside a rock, a wall or any closed solid (its middle, or two or more of some forty points of its body, more
 *     than 3 cm under the thing's own top; one on a trunk's or a wall's face is measured against that face instead).
 *
 *   node scripts/ark-seat-audit.mjs --public public --snapshot /ark-local/live.json --out <dir>
 *        [--snapshot-file <file>]    a snapshot file from anywhere (.json or .json.gz), served to the page; CI's is
 *                                    tests/ark-seat/snapshot.json.gz: the real Ark of 2026-11-20 with who brought each
 *                                    animal taken out (made with `--make-fixture <snapshot.json>`, which writes it and exits)
 *        [--hours 3,7,11,15,19,23] [--islands wild,town]
 *        [--stops 400]               camera stops per island and hour at most (0: until every animal is seen)
 *        [--only id,id]              those animals alone (one caught off its seat in CI, looked at again)
 *        [--only-from <ci.json>]     those a run had off their seats, each island and hour (the camera goes to each first)
 *        [--shoot]                   a picture of each one off its seat (and each --only one), framed on it
 *        [--seat off]                the pass off (the "before" numbers)
 *        [--gl swiftshader]          software WebGL (GitHub's runners)
 *        [--quality high|medium|low] the tier, pinned (default high: 1,200 animals out at once; medium 400)
 *        [--unbudgeted]              no time budget for the pass (software WebGL: see below)
 *        [--width 900 --height 640]  the page's size (software WebGL: a small one, a frame costs its pixels)
 *        [--gate]                    exit 1 on any failure
 *        [--allow 0.02 --gross 0.10 --allow-gross 0.01]
 *                                    with --gate: the share of the seated animals measured that may be off, and the
 *                                    share that may be grossly off (by more than `gross` metres, inside a solid, with
 *                                    nothing under them); default: none off at all
 *        [--label after]
 *        [--broods 300]              BROODS (docs/ark/broods.md 7): once the scene is up, a development brood read of up to
 *                                    n broods made from the snapshot's own wildlife (`src/ark-scene/fixtures/broods.ts`),
 *                                    as the record's read would be: the sitting parents and the stand-ins are then measured
 *                                    too. Needs the TypeScript loader: `npx tsx scripts/ark-seat-audit.mjs ... --broods 300`.
 *
 * Writes <out>/<label>.json (every row) and <out>/<label>.md (the tables). Nothing is uploaded; the models are read
 * from the public bucket.
 */
import {createReadStream, existsSync, mkdirSync, readFileSync, statSync, writeFileSync} from "node:fs";
import {createServer} from "node:http";
import path from "node:path";
import {gunzipSync, gzipSync} from "node:zlib";

const has = (name) => process.argv.includes(`--${name}`);
const arg = (name, fallback) => {
    const at = process.argv.indexOf(`--${name}`);
    return at >= 0 && process.argv[at + 1] && !process.argv[at + 1].startsWith("--") ? process.argv[at + 1] : fallback;
};
if (arg("make-fixture", "")) {
    // The real Ark's snapshot without its people: no usernames (who brought an animal, whose it is), everything else as it is.
    const snapshot = JSON.parse(readFileSync(arg("make-fixture"), "utf8"));
    for (const animal of snapshot.animals) {
        animal.brought_by = null;
        animal.bringers = [];
        animal.mine = false;
    }
    for (const nest of snapshot.nests ?? []) nest.mine = false;
    const file = path.resolve(arg("to", "tests/ark-seat/snapshot.json.gz"));
    mkdirSync(path.dirname(file), {recursive: true});
    writeFileSync(file, gzipSync(Buffer.from(JSON.stringify(snapshot)), {level: 9}));
    console.log("wrote", file, snapshot.animals.length, "animals");
    process.exit(0);
}
const publicDir = path.resolve(arg("public", "public"));
const out = path.resolve(arg("out", ".ark-golden/seat"));
const label = arg("label", "after");
const hours = arg("hours", "3,7,11,15,19,23").split(",").map(Number);
const islands = arg("islands", "wild,town").split(",");
const maxStops = Number(arg("stops", "0"));
const seatOff = arg("seat", "on") === "off";
const gl = arg("gl", "metal");
const TOLERANCE = 0.03;
const snapshotFile = arg("snapshot-file", "") ? path.resolve(arg("snapshot-file")) : null;
mkdirSync(out, {recursive: true});

const TYPES = {".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".wasm": "application/wasm", ".webp": "image/webp", ".png": "image/png", ".glb": "model/gltf-binary", ".bin": "application/octet-stream", ".m4a": "audio/mp4", ".hdr": "application/octet-stream", ".ktx2": "image/ktx2", ".map": "application/json", ".css": "text/css"};
const server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    if (url.pathname === "/__seat/snapshot.json" && snapshotFile) {
        const raw = readFileSync(snapshotFile);
        response.writeHead(200, {"content-type": "application/json", "cache-control": "no-cache"});
        return void response.end(snapshotFile.endsWith(".gz") ? gunzipSync(raw) : raw);
    }
    const file = path.join(publicDir, decodeURIComponent(url.pathname));
    if (!file.startsWith(publicDir) || !existsSync(file) || !statSync(file).isFile()) return void response.writeHead(404).end();
    response.writeHead(200, {"content-type": TYPES[path.extname(file)] ?? "application/octet-stream", "cache-control": "no-cache"});
    createReadStream(file).pipe(response);
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}`;

const {chromium} = await import("playwright-core");
const browser = await chromium.launch(
    gl === "swiftshader"
        ? {headless: true, args: ["--headless=new", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--use-gl=angle", "--disable-background-timer-throttling", "--disable-renderer-backgrounding"]}
        : {channel: "chrome", headless: true, args: ["--headless=new", "--enable-gpu", "--ignore-gpu-blocklist", `--use-angle=${gl}`]}
);
const context = await browser.newContext({viewport: {width: Number(arg("width", "900")), height: Number(arg("height", "640"))}, deviceScaleFactor: 1});
const page = await context.newPage();
page.setDefaultTimeout(900_000);
// A watch on the page's own thread: a call that does not come back in a minute is stopped where it is, with where it
// was (the scene's function names: a development bundle), so a stall is a line in the report and not a run that hangs.
const cdp = await context.newCDPSession(page);
await cdp.send("Debugger.enable");
const stalls = [];
cdp.on("Debugger.paused", (event) => {
    const frames = (event.callFrames ?? []).slice(0, 14).map((f) => `${f.functionName || "(anonymous)"}@${(f.url || "").split("/").pop()}:${f.location?.lineNumber}`);
    stalls.push(frames);
    console.log("STALL in the page:", frames.join(" < "));
    void cdp.send("Runtime.terminateExecution").catch(() => undefined);
    void cdp.send("Debugger.resume").catch(() => undefined);
});
// (And between calls: every 20 s, has the page answered at all? A trivial question, watched the same way.)
let pulseBusy = false;
const pulse = setInterval(() => {
    if (pulseBusy) return;
    pulseBusy = true;
    let timer = setTimeout(() => void cdp.send("Debugger.pause").catch(() => undefined), 20_000);
    page.evaluate(() => 1).catch(() => undefined).finally(() => {
        clearTimeout(timer);
        pulseBusy = false;
    });
}, 20_000);
const watched = async (work, what) => {
    let timer;
    const stall = new Promise((_, reject) => {
        timer = setTimeout(() => {
            void cdp.send("Debugger.pause").catch(() => undefined);
            setTimeout(() => reject(new Error(`the page did not answer in a minute (${what})`)), 5000);
        }, 60_000);
    });
    try {
        return await Promise.race([work(), stall]);
    } finally {
        clearTimeout(timer);
    }
};
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
// The clock: from a fixed moment, running at real speed (the same animals in the same places run to run).
await page.addInitScript(() => {
    const realDate = Date.now.bind(Date);
    const start = Date.UTC(2026, 10, 20, 3, 0, 0);
    const date0 = realDate();
    Date.now = () => start + (realDate() - date0);
});
// The tier pinned (the roster is the tier's: a busy machine would drop it, and most of the animals with it).
await page.addInitScript((quality) => {
    window.__arkQuality = quality;
}, arg("quality", "high"));
// (The town trees' vertex arrays kept on the page, development only, so the probe can read the limbs a bird sits on:
// `render/assets.ts` lets them go once on the GPU.)
await page.addInitScript(() => {
    window.__arkKeepArrays = true;
});
const wait = (ms) => page.waitForTimeout(ms);
const source = `snapshot=${snapshotFile ? "/__seat/snapshot.json" : arg("snapshot", "/ark-local/live.json")}`;
await page.goto(`${base}/ark/embed.html?${source}&hud=0&lang=en${seatOff ? "&seat=off" : ""}`, {waitUntil: "domcontentloaded"});
await page.waitForFunction(() => Boolean(window.__arkScene), null, {timeout: 900_000});
await page.evaluate(() => window.__arkScene.mounted());
await page.waitForFunction(() => !window.__arkScene.attached || window.__arkScene.attached(), null, {timeout: 900_000}).catch(() => undefined);
await page.waitForFunction(() => Boolean(window.__arkSeatProbe), null, {timeout: 120_000});
const calm = (hour) =>
    page.evaluate((hour) => {
        window.__arkScene.setHours?.(hour);
        // (Still air: the trees stand where their meshes are, so a perch is measured against the branch as drawn.)
        window.__arkScene.setEnvironment?.({rain: 0, wetness: 0, fog: 0, storm: 0, snow: 0, cloud: 0.15, wind: 0});
    }, hour);
// (Software WebGL takes the whole machine: a frame's 0.6 ms of seating is then a seat or two, and the roster is never
// through in a run's time. `--unbudgeted`: every animal seated each frame; the seats are the same, only sooner.)
if (has("unbudgeted")) await page.evaluate(() => { window.__arkSeat.force = true; });
await calm(hours[0]);
const broodCount = parseInt(arg("broods", "0"), 10);
if (broodCount > 0) {
    // (Development only: the fixture is read here, in Node, and the decoded read handed to the page; nothing of it is in the bundle.)
    const snapshotRaw = snapshotFile ? readFileSync(snapshotFile) : null;
    if (!snapshotRaw) throw new Error("--broods needs --snapshot-file");
    const snap = JSON.parse(String(snapshotFile.endsWith(".gz") ? gunzipSync(snapshotRaw) : snapshotRaw));
    const [{rawBroodsFromSnapshot}, {decodeArkBroods}] = await Promise.all([import("../src/ark-scene/fixtures/broods.ts"), import("../src/lib/ark-broods.ts")]);
    // (The Ark day as the measure page reckons it: a year in fourteen days since the voyage began.)
    const epoch = await page.evaluate(() => Date.now() / 1000);
    const started = Date.parse(snap.voyage?.started_at ?? "") || epoch * 1000 - 86_400_000 * 20;
    const day = ((epoch * 1000 - started) * 365) / (14 * 86_400_000);
    const read = decodeArkBroods(rawBroodsFromSnapshot(snap.animals, broodCount, epoch, day));
    await page.evaluate((r) => window.__arkScene.setBroods(r), read);
    console.log("broods", read.broods.length, "at ark day", day);
}
await wait(6000);
/** Each island's whole view, as the page opens on it (taken when the audit first stands on that island). */
const wideView = () => page.evaluate(() => { const c = window.__arkDebug.controls; return {target: {x: c.target.x, y: c.target.y, z: c.target.z}, distance: c.getDistance(), polar: c.getPolarAngle(), azimuth: c.getAzimuthalAngle()}; });
let wide = await wideView();
console.log("mounted", JSON.stringify(await page.evaluate(() => ({island: window.__arkScene.island?.(), two: window.__arkScene.twoIslands?.(), entries: window.__arkDebug?.entries().length}))));

const REPTILE = /lizard|gecko|snake|python|\bboa\b|-boa|boa-|viper|cobra|monitor|komodo|iguana|chameleon|skink|tortoise|turtle|terrapin|crocodile|alligator|caiman|gharial|anole|agama|mamba|adder|rattlesnake|tegu|basilisk|slow-worm|tuatara|gila|bearded-dragon|water-dragon|racer|kingsnake|anaconda|taipan|krait|copperhead|cottonmouth|sidewinder|uromastyx|chuckwalla/;
const AMPHIBIAN = /frog|toad|newt|salamander|axolotl|caecilian|mudpuppy|hellbender|olm/;
const INSECT_PLANS = new Set(["flying_insect", "arthropod", "insect", "spider", "worm", "slow_invertebrate", "sessile", "crab", "snail", "mollusc"]);
const FISH_PLANS = new Set(["fish", "eel", "ray", "flatfish", "cephalopod", "jellyfish", "shark", "whale", "dolphin"]);
/** Insects (and the other small invertebrates), reptiles, birds, mammals; amphibians and fish apart. */
const categoryOf = (row) => {
    if (row.plan === "bird") return "birds";
    if (INSECT_PLANS.has(row.plan)) return "insects";
    if (REPTILE.test(row.slug)) return "reptiles";
    if (AMPHIBIAN.test(row.slug)) return "amphibians";
    if (FISH_PLANS.has(row.plan)) return "fish";
    return "mammals";
};

/** Wait until the animals drawn as models have stopped changing (their models in) and their seats have arrived. */
const settle = async () => {
    let last = "";
    let same = 0;
    let frame = await page.evaluate(() => window.__arkSeat.frames);
    for (let i = 0; i < 60; i++) {
        // (By frames drawn, not by the clock: software WebGL draws a few a second.)
        frame += 3;
        await page.waitForFunction((f) => window.__arkSeat.frames >= f, frame, {timeout: 4000, polling: 50}).catch(() => undefined);
        const now = await watched(() => page.evaluate(() => {
            const rows = window.__arkSeatProbe.drawn(3);
            const entries = new Map(window.__arkDebug.entries().map((e) => [e.animal.id, e]));
            let moving = 0;
            for (const row of rows) {
                const s = entries.get(row.id)?.seat;
                if (!s || !["stand", "lie", "perch", "cling"].includes(row.kind)) continue;
                // (Not seated yet, on its way to its seat, seated before the scenery last changed, or waiting to see whether what it is held on is drawn.)
                if (!s.solved || s.x !== s.tx || s.y !== s.ty || s.z !== s.tz || s.seen !== window.__arkSeat.solids.version || (s.doubt > 0 && s.doubt < 0.8) || s.gap !== s.gap) moving++;
            }
            // (The models and the rigs on their way: an animal is its marker until its model is in.)
            const loading = (window.__arkDebug.library?.busy ? 1 : 0) + (window.__arkDebug.rigs?.busy ? 1 : 0);
            return {key: `${rows.length}|${rows.filter((r) => r.level !== "far").length}`, moving, loading, pending: window.__arkSeat.solids.stats().pending, frames: window.__arkSeat.frames};
        }), "settling").catch(() => null);
        if (!now) return;
        frame = now.frames;
        if (now.key === last && !now.loading && (seatOff || (now.moving === 0 && now.pending === 0))) {
            if (++same >= 3) return;
        } else same = 0;
        last = now.key;
    }
};

const SEATED = new Set(["stand", "lie", "perch", "cling"]);
const verdict = (row) => {
    // (Flying or swimming: left alone, but never inside a rock.)
    if (!SEATED.has(row.kind)) return (row.kind === "fly" || row.kind === "swim") && row.middle ? "inside" : "exempt";
    if (row.middle || row.inside >= 2) return "inside";
    if (row.gap === null) return "nothing";
    // (Hovering: nothing of it touches, its lowest point over the surface. Sunk: its seat under it.)
    // (In a hop's, a bound's or a pounce's clip its feet leave the ground: that is the clip. Sunk or inside still counts.)
    if (row.low > TOLERANCE) return row.leaping ? "exempt" : "above";
    if (row.gap < -TOLERANCE) return "below";
    return "ok";
};
/** How far off its seat a measure has it (for the better of two looks): inside counts most. */
const badness = (row) => (verdict(row) === "ok" || verdict(row) === "exempt" ? 0 : (row.middle || row.inside >= 2 ? 100 : 0) + (row.gap === null ? 50 : Math.max(Math.abs(row.gap), Math.abs(row.low))));

const rows = [];
const notDrawn = [];
const coverage = [];
for (const island of islands) {
    if ((await page.evaluate(() => window.__arkScene.island?.())) !== island) {
        await page.evaluate((island) => window.__arkScene.crossTo?.(island), island);
        await wait(10000);
        wide = await wideView();
    }
    for (const hour of hours) {
        await calm(hour);
        // (The hour is a jump of the island's clock: its animals' days start again from where the new hour has them, a
        // few seconds of poses that are no hour's.)
        await wait(10000);
        // Every animal the scene draws one by one on this island: its roster from the island's whole view (zoomed in,
        // the scene lets go of the ones out of sight), each with where it is now.
        await page.evaluate((view) => window.__arkScene.setView(view), wide);
        await wait(5000);
        // (The town's animals join the scene a few at a time: the roster is read once its count has stopped growing, and
        // with --only once every one asked for is in it, or a minute and a half has gone. Read at once, an --only animal
        // not joined yet was no target at all, and the run measured none.)
        // (--only-from <run's json>: the animals that run had off their seats on this island and hour; the camera goes to
        // where each was first, since the town lets its animals join by where the camera is.)
        const from = arg("only-from", "") ? JSON.parse(readFileSync(arg("only-from", ""), "utf8")).rows.filter((r) => r.island === island && r.hour === hour && verdict(r) !== "ok" && verdict(r) !== "exempt") : [];
        const only = arg("only", "") ? new Set(arg("only", "").split(",")) : from.length ? new Set(from.map((r) => r.id)) : arg("only-from", "") ? new Set() : null;
        for (const r of from) {
            await page.evaluate((r) => window.__arkScene.setView({target: {x: r.x, y: r.y, z: r.z}, distance: 12, polar: 1.05, azimuth: 0.7}), r);
            await wait(4000);
        }
        for (let k = 0, last = -1, still = 0; k < 45; k++) {
            const have = await page.evaluate(({island, ids}) => {
                const list = window.__arkDebug.entries().filter((e) => !e.ghost && !e.visitor && (e.animal.island ?? "wild") === island);
                const in_ = new Set(list.map((e) => e.animal.id));
                return {count: list.length, missing: ids.filter((id) => !in_.has(id)).length};
            }, {island, ids: only ? [...only] : []});
            still = have.count === last ? still + 1 : 0;
            last = have.count;
            if (still >= 2 && have.missing === 0) break;
            await wait(2000);
        }
        const targets = new Map(
            (await page.evaluate((island) => window.__arkDebug.entries().filter((e) => !e.ghost && !e.visitor && (e.animal.island ?? "wild") === island).map((e) => { const at = window.__arkScene.locate(e.animal.id); return at && {id: e.animal.id, x: at.x, y: at.y, z: at.z, length: e.length}; }).filter(Boolean), island)).map((t) => [t.id, t])
        );
        // (--only id,id: those animals alone, framed in turn: one caught off its seat in CI looked at again.)
        if (only) for (const id of [...targets.keys()]) if (!only.has(id)) targets.delete(id);
        const all = new Set(targets.keys());
        const seen = new Set();
        const gone = new Set();
        let stops = 0;
        let camera = {x: wide.target.x, z: wide.target.z};
        const started = Date.now();
        for (;;) {
            if (maxStops && stops >= maxStops) break;
            // The next one: the nearest to where the camera is now among those not yet seen.
            let next = null;
            let least = Infinity;
            for (const t of targets.values()) {
                if (seen.has(t.id) || gone.has(t.id)) continue;
                const d = (t.x - camera.x) ** 2 + (t.z - camera.z) ** 2;
                if (d < least) {
                    least = d;
                    next = t;
                }
            }
            if (!next) break;
            stops++;
            camera = {x: next.x, z: next.z};
            const look = (at) => page.evaluate(({at, distance, azimuth}) => {
                window.__arkDebug.controls.minDistance = 0.05;
                window.__arkScene.setView({target: {x: at.x, y: at.y, z: at.z}, distance, polar: 1.05, azimuth});
            }, {at, distance: Math.min(Math.max(0.2 + 9 * next.length, 0.3), 16), azimuth: (stops * 2.399) % (Math.PI * 2)});
            await look(next);
            await settle();
            // (It has walked on since the whole view: once more, where it is now.)
            const now = await page.evaluate((id) => { const at = window.__arkScene.locate(id); const drawn = window.__arkSeatProbe.drawn(3).some((row) => row.id === id && row.level !== "far"); return at && !drawn ? {x: at.x, y: at.y, z: at.z} : null; }, next.id);
            if (now && Math.hypot(now.x - next.x, now.z - next.z) > 0.5) {
                await look(now);
                await settle();
            }
            const measure = (ids, skip) => page.evaluate(({ids, skip, target, island}) => {
                const probe = window.__arkSeatProbe;
                const seen = new Set(skip);
                const only = ids && new Set(ids);
                // (One drawn far is measured when its own turn brings the camera to it.)
                const drawn = probe.drawn(3).filter((row) => (row.island ?? "wild") === island && (only ? only.has(row.id) : !seen.has(row.id) && (row.level !== "far" || row.id === target)));
                probe.begin();
                const out = [];
                try {
                    for (const row of drawn) {
                        const m = probe.measure(row.id);
                        if (m) out.push({...row, ...m});
                    }
                } finally {
                    probe.end();
                }
                return out;
            }, {ids, skip, target: next.id, island});
            let measured = [];
            try {
                measured = await watched(() => measure(null, Array.from(seen)), `measuring at ${next.id}`);
            } catch (error) {
                console.log(String(error));
                gone.add(next.id);
                continue;
            }
            // One caught off its seat is looked at again, up to seven times over three seconds: a stride's or a landing's
            // moment passes, and one on its way to its seat arrives; one that is off every time is off.
            for (let again = 0; again < 7; again++) {
                const off = measured.filter((row) => verdict(row) !== "ok" && verdict(row) !== "exempt");
                if (!off.length) break;
                await wait(430);
                for (const row of await watched(() => measure(off.map((r) => r.id), []), "looking again").catch(() => [])) {
                    const at = measured.findIndex((r) => r.id === row.id);
                    if (at >= 0 && badness(row) < badness(measured[at])) measured[at] = {...row, looks: again + 2};
                }
            }
            // (--shoot: a picture of each one still off its seat, framed on it, for the record and a before/after.)
            if (has("shoot")) {
                for (const row of measured.filter((r) => (verdict(r) !== "ok" && verdict(r) !== "exempt") || only?.has(r.id))) {
                    const at = await page.evaluate((id) => window.__arkScene.locate(id), row.id).catch(() => null);
                    if (!at) continue;
                    await look(at);
                    await wait(600);
                    const slug = await page.evaluate((id) => window.__arkDebug.entries().find((x) => x.animal.id === id)?.animal.model_slug ?? "animal", row.id);
                    await page.screenshot({path: path.join(out, `${label}-${island}-${hour}-${slug}-${row.id.slice(0, 6)}.png`)}).catch(() => undefined);
                }
            }
            for (const row of measured) {
                seen.add(row.id);
                all.add(row.id);
                rows.push({island, hour, ...row, category: categoryOf(row)});
            }
            const left = all.size - seen.size - gone.size - (seen.has(next.id) ? 0 : 1);
            // (Framed and still not drawn as a model: in its den, under the water out of sight, a marker only.)
            if (!seen.has(next.id)) {
                gone.add(next.id);
                notDrawn.push(await page.evaluate(({id, island, hour}) => { const e = window.__arkDebug.entries().find((x) => x.animal.id === id); return {island, hour, id, slug: e?.animal.model_slug ?? null, level: e?.level ?? null, kind: e?.seat?.kind ?? null, asleep: Boolean(e?.state?.asleep), den: Boolean(e?.denIn), water: Boolean(e?.place?.water), burrow: Boolean(e?.place?.burrow), length: e?.length ?? null}; }, {id: next.id, island, hour}));
            }
            if (stops % 25 === 0) console.log(`${island} ${hour}h: stop ${stops}, ${seen.size} measured, ${gone.size} not drawn, ${left} left, ${Math.round((Date.now() - started) / 1000)} s`);
        }
        const left = Array.from(targets.keys()).filter((id) => !seen.has(id) && !gone.has(id)).length;
        coverage.push({island, hour, animals: all.size, measured: seen.size, notDrawn: gone.size, left, stops, seconds: Math.round((Date.now() - started) / 1000)});
        console.log("done", JSON.stringify(coverage[coverage.length - 1]));
        // (What is measured so far, should the run be cut short.)
        writeFileSync(path.join(out, `${label}.partial.json`), JSON.stringify({coverage, rows: rows.map((row) => ({...row, verdict: verdict(row)})), notDrawn}));
    }
}
clearInterval(pulse);
const seatStats = await page.evaluate(() => ({...window.__arkSeat.solids.stats(), solves: window.__arkSeat.solves, ms: window.__arkSeat.ms}));
await browser.close();
server.close();

// MARK: The verdict

for (const row of rows) row.verdict = verdict(row);
const gated = rows.filter((row) => row.level !== "far");
const categories = ["insects", "reptiles", "birds", "mammals", "amphibians", "fish"];
const table = categories.map((category) => {
    const mine = gated.filter((row) => row.category === category);
    const count = (v) => mine.filter((row) => row.verdict === v).length;
    return {category, measured: mine.length, ok: count("ok"), above: count("above"), below: count("below"), inside: count("inside"), nothing: count("nothing"), exempt: count("exempt")};
});
const failures = gated.filter((row) => row.verdict === "above" || row.verdict === "below" || row.verdict === "inside" || row.verdict === "nothing");
const bySpecies = new Map();
for (const row of failures) {
    const key = `${row.slug}|${row.kind}|${row.verdict}`;
    const it = bySpecies.get(key) ?? {slug: row.slug, kind: row.kind, verdict: row.verdict, count: 0, worst: 0, on: new Set(), example: row};
    it.count++;
    if (Math.abs(row.gap ?? 0) >= Math.abs(it.worst)) {
        it.worst = row.gap ?? 0;
        it.example = row;
    }
    it.on.add(row.verdict === "inside" ? row.insideOf : row.on);
    bySpecies.set(key, it);
}
// Left alone as off the ground by their pose's own rule (a burrow's mouth, a swarm, the sea floor), not flying or swimming:
// how many of them have nothing of their body within 3 cm of anything drawn (for the record; not part of the gate).
const afloatInAir = gated.filter((row) => row.kind === "afloat" && row.low !== null && row.low > TOLERANCE);
const exempt = {};
for (const row of gated) if (row.verdict === "exempt") exempt[`${row.category}:${row.kind}`] = (exempt[`${row.category}:${row.kind}`] ?? 0) + 1;
// The gate. Strict (the default): none off its seat. With `--allow <share> --gross <metres> --allow-gross <share>`, as
// the Ark's other audits are guarded (at today's values, so a change that makes the animals worse fails): no more than
// `allow` of the seated animals measured off their seats at all, and no more than `allow-gross` of them grossly (by
// more than `gross`, with their middle or a quarter of their body inside a solid, or with nothing under them).
const seatedCount = gated.filter((row) => row.verdict !== "exempt").length;
const allow = Number(arg("allow", "0"));
const grossOver = Number(arg("gross", "0"));
const allowGross = Number(arg("allow-gross", "0"));
const isGross = (row) => row.verdict === "nothing" || (row.verdict === "inside" && (row.middle || row.inside >= 0.25 * Math.max(row.of, 1))) || Math.max(Math.abs(row.gap ?? 0), Math.abs(row.low ?? 0)) > grossOver;
const gross = failures.filter(isGross);
const summary = {label, stalls, gate: {seated: seatedCount, off: failures.length, gross: gross.length, allow, grossOver}, seat: seatOff ? "off" : "on", quality: arg("quality", "high"), afloatInAir: afloatInAir.length, tolerance: TOLERANCE, hours, islands, coverage, table, failures: failures.length, exempt, seatStats, errors: errors.slice(0, 10)};
writeFileSync(path.join(out, `${label}.json`), JSON.stringify({summary, rows, notDrawn}, null, 1));
const md = [
    `# Ark seat audit: ${label} (seat pass ${seatOff ? "off" : "on"})`,
    "",
    `Hours ${hours.join(", ")}; islands ${islands.join(", ")}; tolerance ±${TOLERANCE * 100} cm; near and rig levels.`,
    "",
    "| category | measured | seated ok | above > 3 cm | below > 3 cm | inside a solid | nothing under it | left alone (flying, swimming, …) |",
    "|---|---|---|---|---|---|---|---|",
    ...table.map((r) => `| ${r.category} | ${r.measured} | ${r.ok} | ${r.above} | ${r.below} | ${r.inside} | ${r.nothing} | ${r.exempt} |`),
    "",
    "## Coverage",
    "",
    "| island | hour | animals | measured | not drawn | left | stops | seconds |",
    "|---|---|---|---|---|---|---|---|",
    ...coverage.map((c) => `| ${c.island} | ${c.hour} | ${c.animals} | ${c.measured} | ${c.notDrawn} | ${c.left} | ${c.stops} | ${c.seconds} |`),
    "",
    `Off their seats: ${failures.length} of ${seatedCount} seated animals measured (${seatedCount ? ((100 * failures.length) / seatedCount).toFixed(2) : "-"}%); grossly (over ${(grossOver * 100).toFixed(0)} cm, inside a solid, nothing under it): ${gross.length}.`,
    "",
    `## Failures by species and state (${failures.length} of ${seatedCount} seated animals)`,
    "",
    "| species | state | verdict | count | worst gap (cm) | on |",
    "|---|---|---|---|---|---|",
    ...Array.from(bySpecies.values()).sort((a, b) => b.count - a.count).slice(0, 200).map((it) => `| ${it.slug} | ${it.kind} | ${it.verdict} | ${it.count} | ${(it.worst * 100).toFixed(1)} | ${Array.from(it.on).slice(0, 3).join(", ")} |`),
    "",
    `## Left alone by their pose's own rule ("afloat") and over 3 cm from anything drawn: ${afloatInAir.length}`,
    "",
    ...Object.entries(afloatInAir.reduce((by, row) => ((by[`${row.category}: ${row.slug}`] = Math.max(by[`${row.category}: ${row.slug}`] ?? 0, row.low)), by), {})).sort().map(([k, v]) => `- ${k}: ${(v * 100).toFixed(1)} cm`),
    "",
    "## Left alone, by category and state",
    "",
    ...Object.entries(exempt).sort().map(([k, v]) => `- ${k}: ${v}`),
    ""
].join("\n");
writeFileSync(path.join(out, `${label}.md`), md);
console.log(md.split("\n").slice(0, 14).join("\n"));
console.log(`failures: ${failures.length}; rows: ${rows.length}; wrote ${path.join(out, `${label}.json`)}`);
if (errors.length) console.log("page errors:", JSON.stringify(errors.slice(0, 6)));
console.log(`gate: ${failures.length} of ${seatedCount} seated animals off their seats (${seatedCount ? ((100 * failures.length) / seatedCount).toFixed(2) : "-"}%; allowed ${(100 * allow).toFixed(2)}%), ${gross.length} of them grossly (over ${(grossOver * 100).toFixed(0)} cm, inside a solid, nothing under it: ${seatedCount ? ((100 * gross.length) / seatedCount).toFixed(2) : "-"}%; allowed ${(100 * allowGross).toFixed(2)}%)`);
if (stalls.length) console.log(`the page stalled ${stalls.length} time(s): see STALL above`);
if (has("gate") && (!seatedCount || stalls.length || failures.length > allow * seatedCount || gross.length > allowGross * seatedCount)) process.exit(1);
