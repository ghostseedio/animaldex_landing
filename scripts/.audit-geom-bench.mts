/**
 * PERF-WEB audit (area: geometric queries): replay the town join's recorded queries (.audit-geom-town.mts --record) through
 * the originals and the prototypes (.audit-geom-fast.mts): every answer compared by its bits (Object.is), ns a call
 * each (the best of 3 alternating passes). Untracked helper.
 *
 *   npx tsx scripts/.audit-geom-bench.mts --snapshot <voyage.json> --rec <dir> [--only colliders,height,wild,cache]
 */
import {readFileSync, existsSync} from "node:fs";
import {execSync} from "node:child_process";
import {createRequire} from "node:module";
import * as F from "./.audit-geom-fast.mts";
const req = createRequire(import.meta.url);
const arg = (name: string, fallback: string) => {
    const at = process.argv.indexOf(`--${name}`);
    return at >= 0 && process.argv[at + 1] && !process.argv[at + 1].startsWith("--") ? process.argv[at + 1] : fallback;
};
const only = new Set(arg("only", "colliders,height,cache,wild").split(","));
const recDir = arg("rec", "");
const {setArkWorld} = req("@/ark-scene/world");
setArkWorld("v2");
const {decodeArkSnapshot} = req("@/ark-scene/snapshot");
const {arkIslandSnapshot} = req("@/lib/ark-islands");
const {placeTownAnimals} = req("@/ark-scene/islands/town/placement");
const {townColliderSet} = req("@/ark-scene/islands/town/colliders");
const {townWorldSampler} = req("@/ark-scene/islands/town/sampler");
const {townWorldOrigin} = req("@/ark-scene/islands");
const collideIndex = req("@/ark-scene/collide");

const raw = JSON.parse(readFileSync(arg("snapshot", ""), "utf8"));
const snapshot = decodeArkSnapshot(raw.snapshot ?? raw);
const origin = townWorldOrigin();
const town = arkIslandSnapshot(snapshot, "town");
const placed = placeTownAnimals(town.animals);
const set = townColliderSet(placed.open, origin);
const sampler = townWorldSampler(placed.open, origin, set);

function rows(name: string): number[][] {
    const file = `${recDir}/${name}.f64`;
    if (!existsSync(file)) return [];
    const buf = readFileSync(file);
    const f = new Float64Array(buf.buffer, buf.byteOffset, buf.byteLength / 8);
    const out: number[][] = [];
    for (let o = 0; o < f.length; ) {
        const n = f[o++];
        out.push(Array.from(f.subarray(o, o + n)));
        o += n;
    }
    return out;
}
const now = () => performance.now();
/** Best of 3 alternating passes of each variant; every answer checked against the first variant's, by its bits. */
function race(label: string, n: number, variants: Array<[string, (i: number) => unknown]>, same: (a: unknown, b: unknown) => boolean = Object.is) {
    const ref: unknown[] = new Array(n);
    for (let i = 0; i < n; i++) ref[i] = variants[0][1](i);
    let mismatches = 0;
    let first = -1;
    for (const [, f] of variants.slice(1)) {
        for (let i = 0; i < n; i++) {
            if (!same(f(i), ref[i])) {
                mismatches++;
                if (first < 0) first = i;
            }
        }
    }
    const best = variants.map(() => Infinity);
    for (let pass = 0; pass < 3; pass++) {
        variants.forEach(([, f], v) => {
            const t = now();
            for (let i = 0; i < n; i++) f(i);
            best[v] = Math.min(best[v], now() - t);
        });
    }
    console.log(`${label}: ${n} calls; mismatches ${mismatches}${first >= 0 ? ` (first at ${first})` : ""}`);
    variants.forEach(([name], v) => console.log(`    ${name.padEnd(34)} ${((best[v] * 1e6) / n).toFixed(0).padStart(7)} ns/call  ${(best[0] / best[v]).toFixed(2)}x`));
    return {mismatches, ns: best.map((b) => (b * 1e6) / n)};
}

console.log(`load: ${execSync("uptime").toString().trim()}`);

if (only.has("colliders")) {
    const ix = F.fastIndexOf(set);
    console.log(`town set: ${set.list.length} colliders (${ix.n} distinct), grid ${ix.ni}x${ix.nj} cells, ${ix.items.length} listings; footprints past their listed cells: ${ix.escapes}`);
    const wildSet = collideIndex.colliders();
    const wix = F.fastIndexOf(wildSet);
    console.log(`wild set: ${wildSet.list.length} colliders, grid ${wix.ni}x${wix.nj}, footprints past their listed cells: ${wix.escapes}`);
    const P = Object.getPrototypeOf(set);
    const dist = rows("distance");
    if (dist.length) race("distance (recorded, cap as asked)", dist.length, [["ColliderSet.distance", (i) => P.distance.call(set, dist[i][0], dist[i][1], dist[i][2])], ["fastDistance", (i) => F.fastDistance(set, dist[i][0], dist[i][1], dist[i][2])]]);
    const sw = rows("sweepAll");
    if (sw.length) race("sweepAll (recorded)", sw.length, [["ColliderSet.sweepAll", (i) => P.sweepAll.call(set, sw[i][0], sw[i][1], sw[i][2], sw[i][3], sw[i][4], sw[i][5])], ["fastSweepAll", (i) => F.fastSweepAll(set, sw[i][0], sw[i][1], sw[i][2], sw[i][3], sw[i][4], sw[i][5])]]);
    const sc = rows("sweep");
    if (sc.length) race("segmentClear -> sweep (recorded)", sc.length, [["ColliderSet.sweep", (i) => P.sweep.call(set, sc[i][0], sc[i][1], sc[i][2], sc[i][3], sc[i][4], sc[i][5] ?? 0.01)], ["fastSweep", (i) => F.fastSweep(set, sc[i][0], sc[i][1], sc[i][2], sc[i][3], sc[i][4], sc[i][5] ?? 0.01)]]);
    const cl = rows("clearance");
    if (cl.length) race("clearance (recorded)", cl.length, [["ColliderSet.clearance", (i) => P.clearance.call(set, cl[i][0], cl[i][1], cl[i][2] ?? 0, cl[i][3] ?? 4, cl[i][4] ?? -Infinity, cl[i][5] ?? Infinity)], ["fastClearance", (i) => F.fastClearance(set, cl[i][0], cl[i][1], cl[i][2] ?? 0, cl[i][3] ?? 4, cl[i][4] ?? -Infinity, cl[i][5] ?? Infinity)]]);
    const bl = rows("blocked");
    if (bl.length) race("blocked (recorded)", bl.length, [["ColliderSet.blocked", (i) => P.blocked.call(set, bl[i][0], bl[i][1], bl[i][2], bl[i][3] ?? -Infinity, bl[i][4] ?? Infinity)], ["fastBlocked", (i) => F.fastBlocked(set, bl[i][0], bl[i][1], bl[i][2], bl[i][3] ?? -Infinity, bl[i][4] ?? Infinity)]]);
    // Synthetic coverage: every collider's neighbourhood, caps 0.3-4, radii as the classes, runs 0.5-8 m (seeded).
    let seed = 12345;
    const rnd = () => ((seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 4294967296);
    const syn: number[][] = [];
    for (let k = 0; k < 120000; k++) {
        const c = set.list[Math.floor(rnd() * set.list.length)];
        const x = c.cx + (rnd() - 0.5) * 12;
        const z = c.cz + (rnd() - 0.5) * 12;
        const a = rnd() * Math.PI * 2;
        const l = 0.5 + rnd() * 7.5;
        syn.push([x, z, x + Math.cos(a) * l, z + Math.sin(a) * l, [0.01, 0.2, 0.35, 0.55, 0.8, 1.2, 2][k % 7], 0.3 + rnd() * 3.7]);
    }
    race("distance (synthetic)", syn.length, [["ColliderSet.distance", (i) => P.distance.call(set, syn[i][0], syn[i][1], syn[i][5])], ["fastDistance", (i) => F.fastDistance(set, syn[i][0], syn[i][1], syn[i][5])]]);
    race("clearance (synthetic, radius classes)", syn.length, [["ColliderSet.clearance", (i) => P.clearance.call(set, syn[i][0], syn[i][1], syn[i][4], syn[i][4] + 2)], ["fastClearance", (i) => F.fastClearance(set, syn[i][0], syn[i][1], syn[i][4], syn[i][4] + 2)]]);
    race("sweep (synthetic)", syn.length, [["ColliderSet.sweep", (i) => P.sweep.call(set, syn[i][0], syn[i][1], syn[i][2], syn[i][3], syn[i][4])], ["fastSweep", (i) => F.fastSweep(set, syn[i][0], syn[i][1], syn[i][2], syn[i][3], syn[i][4])]]);
    race("sweepAll (synthetic)", syn.length, [["ColliderSet.sweepAll", (i) => P.sweepAll.call(set, syn[i][0], syn[i][1], syn[i][2], syn[i][3], syn[i][4])], ["fastSweepAll", (i) => F.fastSweepAll(set, syn[i][0], syn[i][1], syn[i][2], syn[i][3], syn[i][4])]]);
    const sameList = (a: unknown, b: unknown) => {
        const x = a as unknown[];
        const y = b as unknown[];
        return x.length === y.length && x.every((c, i) => c === y[i]);
    };
    race("near (synthetic; list and order)", syn.length, [["ColliderSet.near", (i) => [...P.near.call(set, syn[i][0], syn[i][1], syn[i][5], [])]], ["fastNear", (i) => [...F.fastNear(set, syn[i][0], syn[i][1], syn[i][5], [])]]], sameList);
    // The union set (the recipes' and the scene's): wild + town.
    const union = collideIndex.worldColliders ? (collideIndex.setIslandColliders({contains: () => true, set}), collideIndex.worldColliders()) : null;
    if (union) {
        const uix = F.fastIndexOf(union);
        console.log(`union set: ${union.list.length} colliders, grid ${uix.ni}x${uix.nj}, escapes ${uix.escapes}`);
        race("distance (synthetic, union set)", syn.length, [["ColliderSet.distance", (i) => P.distance.call(union, syn[i][0], syn[i][1], syn[i][5])], ["fastDistance", (i) => F.fastDistance(union, syn[i][0], syn[i][1], syn[i][5])]]);
        race("sweep (synthetic, union set)", syn.length, [["ColliderSet.sweep", (i) => P.sweep.call(union, syn[i][0], syn[i][1], syn[i][2], syn[i][3], syn[i][4])], ["fastSweep", (i) => F.fastSweep(union, syn[i][0], syn[i][1], syn[i][2], syn[i][3], syn[i][4])]]);
    }
}

if (only.has("height") || only.has("cache")) {
    const file = `${recDir}/heightAt-all.f64`;
    const buf = readFileSync(file);
    const stream = new Float64Array(buf.buffer, buf.byteOffset, buf.byteLength / 8);
    const calls = stream.length / 2;
    const ox = origin.x;
    const oz = origin.z;
    if (only.has("cache")) {
        for (const bits of [10, 12, 14, 16]) {
            const c = F.exactCache2(() => 0, bits);
            for (let i = 0; i < calls; i++) c(stream[2 * i], stream[2 * i + 1]);
            console.log(`heightAt exact cache 2^${bits}: hit ${((c.hits / calls) * 100).toFixed(1)}% of ${calls}`);
        }
    }
    if (only.has("height")) {
        const plan = req("@/ark-scene/islands/town/plan");
        const ground = req("@/ark-scene/islands/town/ground");
        const n = Math.min(calls, 600000);
        const X = new Float64Array(n);
        const Z = new Float64Array(n);
        for (let i = 0; i < n; i++) {
            X[i] = stream[2 * i] - ox;
            Z[i] = stream[2 * i + 1] - oz;
        }
        const heightOnly = F.makeTownHeight({lazyInland: false, streetIndex: false});
        const plusInland = F.makeTownHeight({lazyInland: true, streetIndex: false});
        const all = F.makeTownHeight({lazyInland: true, streetIndex: true});
        race("town height (recorded stream, local)", n, [["townHeight", (i) => ground.townHeight(X[i], Z[i])], ["height only", (i) => heightOnly(X[i], Z[i])], ["+ lazy inland", (i) => plusInland(X[i], Z[i])], ["+ street index", (i) => all(X[i], Z[i])]]);
        race("inland (recorded stream)", n, [["inland", (i) => plan.inland(X[i], Z[i])], ["fastInland", (i) => F.fastInland(X[i], Z[i])]]);
        race("streetGrade (recorded stream)", n, [["streetGrade", (i) => ground.streetGrade(X[i], Z[i])], ["fastStreetGrade", (i) => F.fastStreetGrade(X[i], Z[i])]]);
        // Every point of the whole town square (and its sea) at 0.61 m, and the rest of the recorded stream.
        const half = plan.TOWN_HALF + 30;
        const G: number[] = [];
        for (let x = -half; x <= half; x += 0.613) for (let z = -half; z <= half; z += 0.613) G.push(x, z);
        const g = G.length / 2;
        race("town height (dense grid over the square)", g, [["townHeight", (i) => ground.townHeight(G[2 * i], G[2 * i + 1])], ["all three", (i) => all(G[2 * i], G[2 * i + 1])]]);
        race("inland (dense grid)", g, [["inland", (i) => plan.inland(G[2 * i], G[2 * i + 1])], ["fastInland", (i) => F.fastInland(G[2 * i], G[2 * i + 1])]]);
        let bad = 0;
        for (let i = n; i < calls; i++) {
            const x = stream[2 * i] - ox;
            const z = stream[2 * i + 1] - oz;
            if (!Object.is(ground.townHeight(x, z), all(x, z))) bad++;
        }
        console.log(`town height, the rest of the stream (${calls - n} calls): mismatches ${bad}`);
    }
}

if (only.has("wild")) {
    const {surfaceAt, groundNormal} = req("@/ark-scene/sampler");
    const {sampleGround, ZONE_SITES, arkWorld} = req("@/ark-scene/world");
    const {freshFrom, FRESH_LEVEL} = req("@/ark-scene/water-level");
    const {microCorner} = req("@/ark-scene/micro-decor");
    // nest-sites.ts dryAt, verbatim, and the same answer with the cheap tests first (the ground sample alone), the
    // normal (four more samples) only for a point that passes them.
    const dryAt = (x: number, z: number, maxSlope = 0.3) => {
        const surface = surfaceAt(x, z);
        if (surface.waterDepth > 0 || surface.height < 0.18 || 1 - surface.normal.y > maxSlope || surface.cliff > 0.4) return null;
        return {y: surface.height, normal: surface.normal};
    };
    let early = 0;
    const dryAtFast = (x: number, z: number, maxSlope = 0.3) => {
        const sample = sampleGround(x, z);
        const height = sample.height;
        const level = freshFrom(sample, x, z) >= 0.5 ? (arkWorld() === "v2" ? sample.freshLevel ?? FRESH_LEVEL : FRESH_LEVEL) : 0;
        const waterDepth = Math.max(level - height, 0);
        if (waterDepth > 0 || height < 0.18 || sample.cliff > 0.4) {
            early++;
            return null;
        }
        const normal = groundNormal(x, z);
        if (1 - normal.y > maxSlope) return null;
        return {y: height, normal};
    };
    const same = (a: any, b: any) => (a === null || b === null ? a === b : Object.is(a.y, b.y) && Object.is(a.normal.x, b.normal.x) && Object.is(a.normal.y, b.normal.y) && Object.is(a.normal.z, b.normal.z));
    // The spiral searches nests make from each land zone's corner (nest-sites.ts spiral: step 0.6 and 1.2, reach 30 and 45).
    const P: number[] = [];
    for (const zone of Object.keys(ZONE_SITES)) {
        const site = ZONE_SITES[zone];
        const c = site.kind === "sea" ? {x: ZONE_SITES.seashore.x, z: ZONE_SITES.seashore.z} : microCorner(zone);
        for (const [step, reach] of [[0.6, 30], [1.2, 45], [0.5, 30]]) {
            for (let k = 0; k < 900; k++) {
                const r = step * Math.sqrt(k);
                if (r > reach) break;
                const a = k * 2.39996;
                P.push(c.x + Math.cos(a) * r, c.z + Math.sin(a) * r);
            }
        }
    }
    const m = P.length / 2;
    early = 0;
    for (let i = 0; i < m; i++) dryAtFast(P[2 * i], P[2 * i + 1]);
    console.log(`dryAt: ${m} spiral points round the zones' corners; ${((early / m) * 100).toFixed(1)}% fail on water, height or cliff before the normal`);
    race("dryAt (spiral points)", m, [["dryAt (surfaceAt)", (i) => dryAt(P[2 * i], P[2 * i + 1])], ["sample first, normal last", (i) => dryAtFast(P[2 * i], P[2 * i + 1])]], same);
}

if (only.has("nav")) {
    // The town's walk grid as the schedule builds it, then the recorded fits() and attachable() through it.
    const {setIslandColliders} = collideIndex;
    let bx0 = Infinity, bx1 = -Infinity, bz0 = Infinity, bz1 = -Infinity;
    for (const c of set.list) {
        bx0 = Math.min(bx0, c.cx - c.reach);
        bx1 = Math.max(bx1, c.cx + c.reach);
        bz0 = Math.min(bz0, c.cz - c.reach);
        bz1 = Math.max(bz1, c.cz + c.reach);
    }
    setIslandColliders({contains: (x: number, z: number) => x >= bx0 && x <= bx1 && z >= bz0 && z <= bz1, set});
    const {scheduleWorld} = req("@/ark-scene/behaviour-schedule");
    const navMod = req("@/ark-scene/behaviour-nav");
    const world = scheduleWorld(sampler);
    const nav = world.nav;
    const N = navMod.NavGrid.prototype;
    const MAX = navMod.MAX_SLOPE;
    const fitsFast = function (this: any, x: number, z: number, radius: number, maxSlope = MAX) {
        if (!this.solid) return this.walkable(x, z, maxSlope);
        const [i, j] = this.cellOf(x, z);
        const k = j * this.size + i;
        if (i < 1 || j < 1 || i >= this.size - 1 || j >= this.size - 1 || this.height[k] <= 0.05 || this.steep[k] > maxSlope) return false;
        return F.fastDistanceAtLeast(this.solid, x, z, 4, radius) && this.sampler.heightAt(x, z) > 0.02 && this.localSlope(x, z) <= maxSlope * 1.25;
    };
    const un = (v: number | undefined) => (v === undefined || Number.isNaN(v) ? undefined : v);
    const fr = rows("fits");
    let passClear = 0;
    for (const r of fr) if (nav.clearanceAt(r[0], r[1]) >= r[2]) passClear++;
    console.log(`fits (recorded): clearance passes ${((passClear / fr.length) * 100).toFixed(1)}% (the two height tests run only then)`);
    race("fits (recorded)", fr.length, [["NavGrid.fits", (i) => N.fits.call(nav, fr[i][0], fr[i][1], fr[i][2], un(fr[i][3]))], ["boolean clearance", (i) => fitsFast.call(nav, fr[i][0], fr[i][1], fr[i][2], un(fr[i][3]))]]);
    race("clearanceAt >= radius (recorded fits)", fr.length, [["distance(x, z, 4) >= r", (i) => nav.clearanceAt(fr[i][0], fr[i][1]) >= fr[i][2]], ["fastDistanceAtLeast", (i) => F.fastDistanceAtLeast(set, fr[i][0], fr[i][1], 4, fr[i][2])]]);
    const ar = rows("attachable");
    race("attachable (recorded)", ar.length, [["NavGrid.attachable", (i) => N.attachable.call(nav, ar[i][0], ar[i][1], ar[i][2], un(ar[i][3]), ar[i][4] === 1)], ["(same, for the spread)", (i) => N.attachable.call(nav, ar[i][0], ar[i][1], ar[i][2], un(ar[i][3]), ar[i][4] === 1)]]);
}
