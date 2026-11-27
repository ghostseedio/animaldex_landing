/**
 * PERF-WEB audit (area: geometric queries): the wild island's schedule on the real snapshot (islands mode, world v2, the
 * wild island's animals, wired as the scene does: src/lib/ark-collide/sim.ts buildSim), every scheduled animal's trip at
 * one epoch (cold), then `--seconds` of frames (trip + pose), fingerprinted by exact float bits; `--patch` installs the
 * collider/nav prototypes (.audit-geom-patches.mts) first. Untracked helper.
 *   npx tsx scripts/.audit-geom-wild.mts --snapshot <voyage.json> [--seconds 2] [--fps 30] [--patch a,b]
 */
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
import {createRequire} from "node:module";
const req = createRequire(import.meta.url);
const arg = (name: string, fallback: string) => {
    const at = process.argv.indexOf(`--${name}`);
    return at >= 0 && process.argv[at + 1] && !process.argv[at + 1].startsWith("--") ? process.argv[at + 1] : fallback;
};
const fps = Number(arg("fps", "30"));
const seconds = Number(arg("seconds", "2"));
const from = Number(arg("from", "1796032800"));
const patches = arg("patch", "").split(",").filter(Boolean);
const {setArkWorld} = req("@/ark-scene/world");
setArkWorld("v2");
req("@/ark-scene/no-hamlet").setNoHamlet(true);
const {decodeArkSnapshot} = req("@/ark-scene/snapshot");
const {arkIslandSnapshot} = req("@/lib/ark-islands");
const {buildSim} = req("@/lib/ark-collide/sim");
const {poseOnTrip, tripAt} = req("@/ark-scene/behaviour-schedule");

const raw = JSON.parse(readFileSync(arg("snapshot", ""), "utf8"));
const snapshot = decodeArkSnapshot(raw.snapshot ?? raw);
const wild = arkIslandSnapshot(snapshot, "wild").animals;
if (patches.length) {
    const mod = await import("./.audit-geom-patches.mts");
    // (An empty set only for the class's prototype: building the island's colliders here, before buildSim sets the
    // hamlet's plots, could build the scenery for other plots.)
    const {ColliderSet} = req("@/ark-scene/collide/colliders");
    mod.install(patches, {sampler: {}, set: new ColliderSet([], "empty"), origin: {x: 0, z: 0}});
}
const t0 = performance.now();
const sim = buildSim(wild, {arkDay: snapshot.ark_day ?? null});
const buildMs = performance.now() - t0;
const on = sim.animals.filter((s: any) => s.sched);

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
for (const s of on) feed(tripAt(sim.world, s.profile, s.sched, from, sim.hoursAt));
const coldMs = performance.now() - tCold;
const frames = Math.round(seconds * fps);
const tF = performance.now();
for (let f = 1; f <= frames; f++) {
    const epoch = from + f / fps;
    for (const s of on) {
        const trip = tripAt(sim.world, s.profile, s.sched, epoch, sim.hoursAt);
        const pose = poseOnTrip(sim.world, trip, epoch);
        if (f % fps === 0) {
            feed(trip);
            feed({x: pose.x, y: pose.y, z: pose.z, yaw: pose.yaw});
        }
    }
}
const framesMs = performance.now() - tF;
console.log(JSON.stringify({wild: wild.length, scheduled: on.length, patches, buildMs: +buildMs.toFixed(0), coldMs: +coldMs.toFixed(0), msPerFrame: +(framesMs / frames).toFixed(3), fingerprint: hash.digest("hex").slice(0, 24)}));
