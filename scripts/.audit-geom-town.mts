/**
 * PERF-WEB audit (area: geometric queries). Untracked helper, not for commit.
 *
 * The town's schedule as the scene runs it when the town joins (every scheduled town resident: `islands/scene.ts`
 * scheduled(), zoo mates and beds, herd leaders as `index.ts` keptLeader / the paddock rig wire them), headless:
 *   cold: every resident's trip at one epoch (the town join's burst), then `--seconds` of frames at `--fps` (trip + pose).
 *
 *   npx tsx scripts/.audit-geom-town.mts --snapshot <voyage.json> [--zoo] [--seconds 20] [--fps 30]
 *        [--count] [--record <dir>] [--patch <list>] [--hash]
 *
 * --count:  counting wrappers on ColliderSet / NavGrid / the sampler; prints call counts, march steps, candidates.
 * --record: write sampled query inputs (exact) for the replay benches.
 * --patch:  install prototype accelerations from ./.audit-geom-patches.mts (comma list), to compare time + fingerprint.
 * --hash:   fingerprint every trip and every pose (exact float bits).
 */
import {readFileSync, writeFileSync, mkdirSync} from "node:fs";
import {createHash} from "node:crypto";
import {createRequire} from "node:module";
import type {ScheduleAnimal} from "@/ark-scene/behaviour-schedule";
// (Every scene module through require: tsx's ESM import of a .ts module can bind a second instance of it, the
// "?tsx-commonjs-export-preparse" one, whose classes and module state are not the ones the scene's own modules use.)
const req = createRequire(import.meta.url);
const {decodeArkSnapshot} = req("@/ark-scene/snapshot");
const {arkIslandSnapshot} = req("@/lib/ark-islands");
const {maskBox, penKeep, placeTownAnimals} = req("@/ark-scene/islands/town/placement");
const {townColliderSet} = req("@/ark-scene/islands/town/colliders");
const {townWorldSampler} = req("@/ark-scene/islands/town/sampler");
const {townWorldOrigin} = req("@/ark-scene/islands");
const {behaviourProfile} = req("@/ark-scene/behaviour-profile");
const {poseOnTrip, scheduleWorld, tripAt} = req("@/ark-scene/behaviour-schedule");
const {displayLength} = req("@/ark-scene/sizes");
const {collideBlocked, collideSegmentClear, setIslandColliders} = req("@/ark-scene/collide");
const {setRecipeColliders} = req("@/ark-scene/behaviour-recipes");
const {townZooBeds} = req("@/ark-scene/islands/town/zoo-beds");
const {groupLives} = req("@/ark-scene/behaviour-group");
const {setArkWorld} = req("@/ark-scene/world");
const {ColliderSet} = req("@/ark-scene/collide/colliders");
const {NavGrid} = req("@/ark-scene/behaviour-nav");
const {onBehaviourSchedule} = req("@/ark-scene/schedule-water");

const arg = (name: string, fallback: string) => {
    const at = process.argv.indexOf(`--${name}`);
    return at >= 0 && process.argv[at + 1] && !process.argv[at + 1].startsWith("--") ? process.argv[at + 1] : fallback;
};
const flag = (name: string) => process.argv.includes(`--${name}`);
const fps = Number(arg("fps", "30"));
const seconds = Number(arg("seconds", "20"));
const from = Number(arg("from", "1796032800"));
const zooOnly = flag("zoo");
const counting = flag("count");
const recordDir = arg("record", "");
const patches = arg("patch", "").split(",").filter(Boolean);
const hashing = flag("hash");

setArkWorld("v2");
const raw = JSON.parse(readFileSync(arg("snapshot", ""), "utf8"));
const snapshot = decodeArkSnapshot(raw.snapshot ?? raw);
if (!snapshot) throw new Error("no snapshot");
const tBuild = performance.now();
const origin = townWorldOrigin();
const town = arkIslandSnapshot(snapshot, "town");
const placed = placeTownAnimals(town.animals);
const set = townColliderSet(placed.open, origin);
let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
for (const c of set.list) {
    x0 = Math.min(x0, c.cx - c.reach);
    x1 = Math.max(x1, c.cx + c.reach);
    z0 = Math.min(z0, c.cz - c.reach);
    z1 = Math.max(z1, c.cz + c.reach);
}
setIslandColliders({contains: (x, z) => x >= x0 && x <= x1 && z >= z0 && z <= z1, set});
setRecipeColliders({segmentClear: collideSegmentClear, blocked: (x, z, r) => collideBlocked(x, z, r)});
// (The wild island's colliders and the union with the town's, as the scene has them built long before the town joins:
// built here before any timing, so the town's cold start does not pay for the wild island's scenery.)
const tWild = performance.now();
req("@/ark-scene/collide").worldColliders();
const wildMs = performance.now() - tWild;

// (Patches: installed before the world is built, so the grid build and the schedule both run them.)
const sampler = townWorldSampler(placed.open, origin, set);
if (patches.length) {
    const mod = await import("./.audit-geom-patches.mts");
    mod.install(patches, {sampler, set, origin});
}
const counters = counting || recordDir ? await installCounters(sampler) : null;
const world = scheduleWorld(sampler);
const buildMs = performance.now() - tBuild;
counters?.reset();
const hours = (epoch: number) => (((epoch / 3600) % 24) + 24) % 24;

type Item = {id: string; slug: string; pen: string; sched: ScheduleAnimal; profile: any};
const items: Item[] = [];
const beds = townZooBeds(placed.town, town.animals.map((a: any) => ({id: a.id, model_slug: a.model_slug, length: displayLength(a)})), set, origin.x, origin.z);
const STILL_WHERE = new Set(["window", "indoor", "pool"]);
for (const a of town.animals as any[]) {
    const info = placed.town.get(a.id);
    const p = placed.places.get(a.id);
    if (!info || !p || info.still || STILL_WHERE.has(info.where) || !onBehaviourSchedule(a.model_slug)) continue;
    if (zooOnly && info.area !== "zoo") continue;
    const length = displayLength(a);
    const profile = behaviourProfile(a.model_slug);
    const box = info.pen ?? (info.enclosure && info.enclosureMargin !== undefined ? maskBox(info.enclosure.mask) : undefined);
    const margin = info.pen ? info.penMargin ?? 0 : info.enclosureMargin ?? 0;
    const sched: ScheduleAnimal = {id: a.id, zone: a.zone, home: {x: p.x + origin.x, y: p.ground, z: p.z + origin.z}, length, sea: false, range: Math.max(info.range, 0.6) * 1.5, kept: true, keep: box ? penKeep(box, margin, origin.x, origin.z) : null, bed: beds.get(a.id) ?? null};
    items.push({id: a.id, slug: a.model_slug, pen: info.enclosure?.id ?? info.place, sched, profile});
}
const GROUPED = new Set(["herd", "flock", "school", "troop", "pack", "group", "colony", "swarm"]);
const byId = new Map(items.map((it) => [it.id, it]));
const slugOf = new Map((town.animals as any[]).map((a) => [a.id, a.model_slug]));
for (const it of items) {
    const lead = placed.places.get(it.id)?.leader;
    const leader = lead && lead !== it.id ? byId.get(lead) : undefined;
    if (!leader || leader.slug !== it.slug || !(GROUPED.has(it.profile.social) || groupLives(it.slug))) continue;
    let size = 1;
    placed.places.forEach((p: any, id: string) => {
        if (id !== lead && p.leader === lead && slugOf.get(id) === it.slug) size++;
    });
    it.sched.group = {leader: leader.sched, profile: leader.profile, activity: undefined, rank: Math.max(placed.places.get(it.id)?.rank ?? 1, 1), size: Math.max(size, 2)};
}
const led = new Map<ScheduleAnimal, number>();
for (const it of items) if (it.sched.group) led.set(it.sched.group.leader, (led.get(it.sched.group.leader) ?? 1) + 1);
for (const it of items) it.sched.led = led.get(it.sched) ?? 0;
for (const it of items) {
    const info = placed.town.get(it.id);
    if (info?.area === "zoo" && info.enclosure && info.enclosureMargin !== undefined) {
        const mates = items.filter((o) => o.pen === it.pen && placed.town.get(o.id)?.area === "zoo");
        it.sched.mates = () => mates.map((o) => ({animal: o.sched, profile: o.profile}));
    }
}

// Fingerprint: exact bits of every number.
const hash = createHash("sha256");
const f64 = new Float64Array(1);
const u8 = new Uint8Array(f64.buffer);
const seen = new WeakSet<object>();
const feed = (v: unknown, depth = 0): void => {
    if (depth > 10) return;
    if (typeof v === "number") {
        f64[0] = v;
        hash.update(u8);
    } else if (v === null || typeof v !== "object") hash.update(`${typeof v}:${String(v)};`);
    else if (Array.isArray(v)) {
        hash.update(`[${v.length}`);
        for (const x of v) feed(x, depth + 1);
        hash.update("]");
    } else {
        if (seen.has(v)) return void hash.update("@");
        seen.add(v);
        hash.update("{");
        for (const k of Object.keys(v).sort()) {
            const x = (v as Record<string, unknown>)[k];
            if (typeof x === "function") continue;
            hash.update(k + ":");
            feed(x, depth + 1);
        }
        hash.update("}");
    }
};

const tCold = performance.now();
for (const it of items) {
    const trip = tripAt(world, it.profile, it.sched, from, hours);
    if (hashing) feed(trip);
}
const coldMs = performance.now() - tCold;
const coldCounts = counters?.snapshot();
const frames = Math.round(seconds * fps);
let frameMs = 0;
let worst = 0;
const tFrames = performance.now();
for (let f = 1; f <= frames; f++) {
    const epoch = from + f / fps;
    const t0 = performance.now();
    for (const it of items) {
        const trip = tripAt(world, it.profile, it.sched, epoch, hours);
        const pose = poseOnTrip(world, trip, epoch);
        if (hashing && f % fps === 0) {
            feed(trip);
            feed({x: pose.x, y: pose.y, z: pose.z, yaw: pose.yaw});
        }
    }
    const ms = performance.now() - t0;
    frameMs += ms;
    worst = Math.max(worst, ms);
}
const framesWall = performance.now() - tFrames;
const out: Record<string, unknown> = {
    residents: items.length,
    zooOnly,
    patches,
    wildCollidersMs: +wildMs.toFixed(0),
    buildMs: +buildMs.toFixed(0),
    coldMs: +coldMs.toFixed(0),
    frames,
    framesMs: +framesWall.toFixed(0),
    msPerFrame: +(frameMs / frames).toFixed(3),
    worstFrameMs: +worst.toFixed(1),
    ...(hashing ? {fingerprint: hash.digest("hex").slice(0, 24)} : {})
};
console.log(JSON.stringify(out));
if (counters) {
    console.log("== cold (town join burst) counts");
    counters.print(coldCounts!);
    console.log("== cold + frames counts");
    counters.print(counters.snapshot());
    if (recordDir) counters.save(recordDir);
}

// MARK: counting wrappers

async function installCounters(s: typeof sampler) {
    const counts = new Map<string, number>();
    const add = (k: string, n = 1) => counts.set(k, (counts.get(k) ?? 0) + n);
    let depth = ""; // the outermost collider query we are under
    const rec: Record<string, unknown[][]> = {sweepAll: [], distance: [], near: [], sweep: [], clearance: [], heightAt: [], attachable: [], fits: [], waterSurface: [], blocked: []};
    const REC_EVERY = 7;
    let recTick = 0;
    const record = (k: string, args: unknown[]) => {
        if (!recordDir) return;
        if (recTick++ % REC_EVERY) return;
        if (rec[k] && rec[k].length < 400000) rec[k].push(args);
    };
    // Repeat detection for heightAt: an LRU-ish small window and a global distinct set (exact bits).
    const hWindow: string[] = [];
    const hSet = new Set<string>();
    const hGlobal = new Set<string>();
    const sweepKeys = new Set<string>();
    const attachKeys = new Set<string>();
    const segKeys = new Set<string>();
    // Every heightAt call's (x, z), in order (the cache simulations replay the whole stream).
    let hStream = new Float64Array(1 << 22);
    let hN = 0;
    const P = ColliderSet.prototype as any;
    const orig = {near: P.near, clearance: P.clearance, deepest: P.deepest, blocked: P.blocked, sweep: P.sweep, distance: P.distance, sweepAll: P.sweepAll, segmentClear: P.segmentClear};
    P.near = function (x: number, z: number, r: number, outArr?: unknown[]) {
        add(`near${depth ? ` (in ${depth})` : ""}`);
        const i0 = Math.floor((x - r) / 4), i1 = Math.floor((x + r) / 4), j0 = Math.floor((z - r) / 4), j1 = Math.floor((z + r) / 4);
        add("near.cells", (i1 - i0 + 1) * (j1 - j0 + 1));
        if (i0 === i1 && j0 === j1) add("near.singleCell");
        if (!depth) record("near", [x, z, r]);
        const res = orig.near.call(this, x, z, r, outArr);
        add("near.candidates", res.length);
        return res;
    };
    for (const name of ["clearance", "deepest", "blocked", "distance"] as const) {
        P[name] = function (...a: unknown[]) {
            add(`${name}${depth ? ` (in ${depth})` : ""}`);
            if (!depth && (name === "distance" || name === "clearance" || name === "blocked")) record(name, a.filter((v) => typeof v !== "function"));
            const was = depth;
            if (!depth) depth = name;
            try {
                return (orig as any)[name].apply(this, a);
            } finally {
                depth = was;
            }
        };
    }
    for (const name of ["sweep", "sweepAll", "segmentClear"] as const) {
        P[name] = function (...a: any[]) {
            add(`${name}${depth ? ` (in ${depth})` : ""}`);
            if (!depth) {
                const skip = a[6];
                const key = `${a[0]},${a[1]},${a[2]},${a[3]},${a[4]},${a[5]},${skip ? "skip" : "-"}`;
                if (name === "sweepAll") {
                    if (sweepKeys.has(key)) add("sweepAll.repeatExact");
                    sweepKeys.add(key);
                    add("sweepAll.length.cm", Math.round(Math.hypot(a[2] - a[0], a[3] - a[1]) * 100));
                    if (skip) add("sweepAll.withSkip");
                }
                if (name === "segmentClear") {
                    if (segKeys.has(key)) add("segmentClear.repeatExact");
                    segKeys.add(key);
                }
                if (name === "sweepAll" || name === "sweep") record(name, a.filter((v: unknown) => typeof v !== "function"));
                if (name === "segmentClear") record("sweep", a.filter((v: unknown) => typeof v !== "function"));
            }
            const was = depth;
            if (!depth) depth = name;
            try {
                const r = (orig as any)[name].apply(this, a);
                if (name === "sweepAll" && !was) add(r >= 1 ? "sweepAll.clear" : "sweepAll.blocked");
                return r;
            } finally {
                depth = was;
            }
        };
    }
    const N = NavGrid.prototype as any;
    const navOrig: Record<string, any> = {};
    for (const name of ["attachable", "fits", "runClear", "walkable", "region", "path", "clearanceAt", "nearest", "localSlope", "standable", "swimmable", "heightAt"]) {
        navOrig[name] = N[name];
        N[name] = function (...a: any[]) {
            add(`nav.${name}`);
            if (name === "attachable") {
                const key = `${a[0]},${a[1]},${a[2]},${a[3]},${a[4]}`;
                if (attachKeys.has(key)) add("nav.attachable.repeatExact");
                attachKeys.add(key);
                record("attachable", a);
                const before = counts.get("sweepAll (in -)") ?? 0;
                void before;
                const r = navOrig[name].apply(this, a);
                add(r ? "nav.attachable.true" : "nav.attachable.false");
                return r;
            }
            if (name === "fits") record("fits", a);
            return navOrig[name].apply(this, a);
        };
    }
    const sOrig = {heightAt: s.heightAt, waterSurface: s.waterSurface, waterDepth: s.waterDepth, blocked: s.blocked, roadway: s.roadway, slope: s.slope, zoneAt: s.zoneAt, isWater: s.isWater};
    s.heightAt = (x: number, z: number) => {
        add("sampler.heightAt");
        const key = `${x},${z}`;
        if (hSet.has(key)) add("sampler.heightAt.repeatInLast64");
        if (hGlobal.has(key)) add("sampler.heightAt.repeatEver");
        hGlobal.add(key);
        hWindow.push(key);
        hSet.add(key);
        if (hWindow.length > 64) {
            const old = hWindow.shift()!;
            if (!hWindow.includes(old)) hSet.delete(old);
        }
        record("heightAt", [x, z]);
        if (recordDir) {
            if (hN + 2 > hStream.length) {
                const grown = new Float64Array(hStream.length * 2);
                grown.set(hStream);
                hStream = grown;
            }
            hStream[hN++] = x;
            hStream[hN++] = z;
        }
        return sOrig.heightAt(x, z);
    };
    if (sOrig.waterSurface) s.waterSurface = (x: number, z: number) => (add("sampler.waterSurface"), record("waterSurface", [x, z]), sOrig.waterSurface!(x, z));
    if (sOrig.waterDepth) s.waterDepth = (x: number, z: number) => (add("sampler.waterDepth"), sOrig.waterDepth!(x, z));
    s.blocked = (x: number, z: number, c: number) => (add("sampler.blocked"), sOrig.blocked(x, z, c));
    if (sOrig.roadway) s.roadway = (x: number, z: number) => (add("sampler.roadway"), sOrig.roadway!(x, z));
    if (sOrig.slope) s.slope = (x: number, z: number) => (add("sampler.slope"), sOrig.slope!(x, z));
    if (sOrig.zoneAt) s.zoneAt = (x: number, z: number) => (add("sampler.zoneAt"), sOrig.zoneAt!(x, z));
    if (sOrig.isWater) s.isWater = (x: number, z: number) => (add("sampler.isWater"), sOrig.isWater!(x, z));
    return {
        reset: () => {
            counts.clear();
            hGlobal.clear();
            sweepKeys.clear();
            attachKeys.clear();
            segKeys.clear();
            hN = 0;
            for (const k of Object.keys(rec)) rec[k].length = 0;
        },
        snapshot: () => new Map(counts),
        print: (m: Map<string, number>) => {
            for (const [k, v] of [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]))) console.log(`  ${k.padEnd(44)} ${v}`);
            const sw = m.get("sweepAll") ?? 0;
            const swd = m.get("distance (in sweepAll)") ?? 0;
            if (sw) console.log(`  -> sweepAll: ${(swd / sw).toFixed(2)} march steps (distance calls) each; mean length ${((m.get("sweepAll.length.cm") ?? 0) / sw / 100).toFixed(2)} m`);
            const nr = m.get("near.cells") ?? 0;
            const nn = [...m.entries()].filter(([k]) => k.startsWith("near") && !k.includes(".")).reduce((a, [, v]) => a + v, 0);
            if (nn) console.log(`  -> near: ${(nr / nn).toFixed(2)} cells and ${((m.get("near.candidates") ?? 0) / nn).toFixed(1)} candidates a call; single-cell ${(((m.get("near.singleCell") ?? 0) / nn) * 100).toFixed(1)}%`);
        },
        save: (dir: string) => {
            mkdirSync(dir, {recursive: true});
            for (const [k, rows] of Object.entries(rec)) {
                const flat = new Float64Array(rows.reduce((n, r) => n + r.length + 1, 0));
                let o = 0;
                for (const r of rows) {
                    flat[o++] = r.length;
                    for (const v of r) flat[o++] = typeof v === "boolean" ? (v ? 1 : 0) : v === undefined ? NaN : (v as number);
                }
                writeFileSync(`${dir}/${k}.f64`, Buffer.from(flat.buffer));
            }
            writeFileSync(`${dir}/heightAt-all.f64`, Buffer.from(hStream.buffer, 0, hN * 8));
            console.log(`heightAt stream: ${hN / 2} calls`);
            console.log(`recorded to ${dir}: ${Object.entries(rec).map(([k, r]) => `${k} ${r.length}`).join(", ")}`);
        }
    };
}
