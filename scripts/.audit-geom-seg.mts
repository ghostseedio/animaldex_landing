/**
 * PERF-WEB audit (area: geometric queries): the crawl's straight-run checks (segmentClear, recorded by
 * .audit-geom-town.mts --record) classified, and a boolean segmentClear that decides most runs without the march:
 *   clear    every point of the run at least `need` (+1e-6) from every shape the body meets (exact segment-shape distances)
 *   blocked  some point of the run more than 0.02 m (+1e-6) inside `need` of one (the march's 2 cm least step cannot
 *            pass it: the clearance is 1-Lipschitz and the march steps by what is free), the run 0 < length <= 79 m
 *   else     the march itself (the fast one, .audit-geom-fast.mts).
 * Untracked helper.  npx tsx scripts/.audit-geom-seg.mts --snapshot <voyage.json> --rec <dir>
 */
import {readFileSync} from "node:fs";
import {execSync} from "node:child_process";
import {createRequire} from "node:module";
import * as F from "./.audit-geom-fast.mts";
const req = createRequire(import.meta.url);
const arg = (name: string, fallback: string) => {
    const at = process.argv.indexOf(`--${name}`);
    return at >= 0 && process.argv[at + 1] && !process.argv[at + 1].startsWith("--") ? process.argv[at + 1] : fallback;
};
const {setArkWorld} = req("@/ark-scene/world");
setArkWorld("v2");
const {decodeArkSnapshot} = req("@/ark-scene/snapshot");
const {arkIslandSnapshot} = req("@/lib/ark-islands");
const {placeTownAnimals} = req("@/ark-scene/islands/town/placement");
const {townColliderSet} = req("@/ark-scene/islands/town/colliders");
const {townWorldOrigin} = req("@/ark-scene/islands");
const {colliderDistance} = req("@/ark-scene/collide/colliders");
const raw = JSON.parse(readFileSync(arg("snapshot", ""), "utf8"));
const snapshot = decodeArkSnapshot(raw.snapshot ?? raw);
const origin = townWorldOrigin();
const town = arkIslandSnapshot(snapshot, "town");
const placed = placeTownAnimals(town.animals);
const set = townColliderSet(placed.open, origin);
const P = Object.getPrototypeOf(set);

const buf = readFileSync(`${arg("rec", "")}/sweep.f64`);
const f = new Float64Array(buf.buffer, buf.byteOffset, buf.byteLength / 8);
const rows: number[][] = [];
for (let o = 0; o < f.length; ) {
    const n = f[o++];
    rows.push(Array.from(f.subarray(o, o + n)));
    o += n;
}
console.log(`load: ${execSync("uptime").toString().trim()}`);

// MARK: exact segment-shape distances (unsigned: 0 where the run meets the shape)

/** Point p to segment a-b. */
function pSeg(px: number, pz: number, ax: number, az: number, bx: number, bz: number): number {
    const vx = bx - ax;
    const vz = bz - az;
    const l2 = vx * vx + vz * vz;
    const t = l2 > 0 ? Math.min(Math.max(((px - ax) * vx + (pz - az) * vz) / l2, 0), 1) : 0;
    return Math.hypot(px - (ax + vx * t), pz - (az + vz * t));
}
function cross(ax: number, az: number, bx: number, bz: number, cx: number, cz: number): number {
    return (bx - ax) * (cz - az) - (bz - az) * (cx - ax);
}
/** Do segments a-b and c-d cross (or touch)? Conservative: near-collinear or touching counts as crossing. */
function segsMeet(ax: number, az: number, bx: number, bz: number, cx: number, cz: number, dx: number, dz: number): boolean {
    const d1 = cross(cx, cz, dx, dz, ax, az);
    const d2 = cross(cx, cz, dx, dz, bx, bz);
    const d3 = cross(ax, az, bx, bz, cx, cz);
    const d4 = cross(ax, az, bx, bz, dx, dz);
    return d1 * d2 <= 1e-9 && d3 * d4 <= 1e-9;
}
function segSeg(ax: number, az: number, bx: number, bz: number, cx: number, cz: number, dx: number, dz: number): number {
    if (segsMeet(ax, az, bx, bz, cx, cz, dx, dz)) return 0;
    return Math.min(pSeg(ax, az, cx, cz, dx, dz), pSeg(bx, bz, cx, cz, dx, dz), pSeg(cx, cz, ax, az, bx, bz), pSeg(dx, dz, ax, az, bx, bz));
}
/** The least of the collider's signed distance over the run, from below (-Infinity where the run goes into it). */
function runLow(c: any, ax: number, az: number, bx: number, bz: number): number {
    if (c.shape === "circle") {
        const d = pSeg(c.cx, c.cz, ax, az, bx, bz);
        return d - c.r;
    }
    if (c.shape === "segment") {
        const d = segSeg(ax, az, bx, bz, c.ax, c.az, c.bx, c.bz);
        return d - c.r;
    }
    // box: the run in the box's frame (local x = dx cos - dz sin, local z = dx sin + dz cos), then segment to rectangle.
    const tx = (x: number, z: number) => (x - c.cx) * c.cos - (z - c.cz) * c.sin;
    const tz = (x: number, z: number) => (x - c.cx) * c.sin + (z - c.cz) * c.cos;
    const ux = tx(ax, az), uz = tz(ax, az), vx = tx(bx, bz), vz = tz(bx, bz);
    const inside = (x: number, z: number) => x >= c.hx0 && x <= c.hx1 && z >= c.hz0 && z <= c.hz1;
    if (inside(ux, uz) || inside(vx, vz)) return -Infinity;
    const X = [c.hx0, c.hx1, c.hx1, c.hx0];
    const Z = [c.hz0, c.hz0, c.hz1, c.hz1];
    let best = Infinity;
    for (let k = 0; k < 4; k++) {
        const d = segSeg(ux, uz, vx, vz, X[k], Z[k], X[(k + 1) % 4], Z[(k + 1) % 4]);
        if (d === 0) return -Infinity;
        best = Math.min(best, d);
    }
    return best;
}
/** The least signed distance at the run's points nearest the shape, from above: a point that is that close. */
function runProbe(c: any, ax: number, az: number, bx: number, bz: number): number {
    const vx = bx - ax;
    const vz = bz - az;
    const l2 = vx * vx + vz * vz;
    const at = (x: number, z: number) => {
        const t = l2 > 0 ? Math.min(Math.max(((x - ax) * vx + (z - az) * vz) / l2, 0), 1) : 0;
        return colliderDistance(c, ax + vx * t, az + vz * t);
    };
    if (c.shape === "segment") return Math.min(at(c.ax, c.az), at(c.bx, c.bz), at(c.cx, c.cz));
    return at(c.cx, c.cz);
}

const SLACK = 1e-6;
let byClear = 0, byBlocked = 0, byMarch = 0, wrongClear = 0, wrongBlocked = 0;
const ix = F.fastIndexOf(set);
function decide(ax: number, az: number, bx: number, bz: number, radius: number, slack = 0.01): boolean {
    const need = radius - slack;
    const cap = radius + 2;
    const length = Math.hypot(bx - ax, bz - az);
    // The run's candidates: every collider listed within cap of it (cells over its bounds), each once.
    const x0 = Math.min(ax, bx) - cap, x1 = Math.max(ax, bx) + cap, z0 = Math.min(az, bz) - cap, z1 = Math.max(az, bz) + cap;
    const i0 = Math.max(Math.floor(x0 / 4), ix.iMin), i1 = Math.min(Math.floor(x1 / 4), ix.iMin + ix.ni - 1);
    const j0 = Math.max(Math.floor(z0 / 4), ix.jMin), j1 = Math.min(Math.floor(z1 / 4), ix.jMin + ix.nj - 1);
    const epoch = ++ix.epoch;
    let low = Infinity;
    let high = Infinity;
    for (let i = i0; i <= i1; i++) {
        for (let j = j0; j <= j1; j++) {
            const cell = (i - ix.iMin) * ix.nj + (j - ix.jMin);
            for (let k = ix.start[cell]; k < ix.start[cell + 1]; k++) {
                const id = ix.items[k];
                if (ix.mark[id] === epoch) continue;
                ix.mark[id] = epoch;
                if (ix.gap[id] > 0 && radius * 2 < ix.gap[id]) continue;
                const c = ix.list[id];
                // (Its centre farther from the run than cap + its bound: no point of the run within cap of it.)
                if (pSeg(ix.cx[id], ix.cz[id], ax, az, bx, bz) - ix.bound[id] > cap) continue;
                low = Math.min(low, runLow(c, ax, az, bx, bz));
                if (length > 0 && length <= 79) high = Math.min(high, runProbe(c, ax, az, bx, bz));
            }
        }
    }
    if (low >= need + SLACK) {
        byClear++;
        return true;
    }
    if (high < need - 0.02 - SLACK) {
        byBlocked++;
        return false;
    }
    byMarch++;
    return F.fastSweep(set, ax, az, bx, bz, radius, slack) >= 1;
}

if (!process.argv.includes("--sweepall-only")) {
let clear = 0;
let lenSum = 0;
const ref: boolean[] = [];
for (const r of rows) {
    const t = P.sweep.call(set, r[0], r[1], r[2], r[3], r[4], r[5] ?? 0.01);
    ref.push(t >= 1);
    if (t >= 1) clear++;
    lenSum += Math.hypot(r[2] - r[0], r[3] - r[1]);
}
console.log(`recorded crawl runs: ${rows.length}; clear ${((clear / rows.length) * 100).toFixed(1)}%; mean length ${(lenSum / rows.length).toFixed(2)} m; radii ${[...new Set(rows.map((r) => r[4]))].slice(0, 12).join(", ")}`);
let mism = 0;
rows.forEach((r, i) => {
    const v = decide(r[0], r[1], r[2], r[3], r[4], r[5] ?? 0.01);
    if (v !== ref[i]) {
        mism++;
        if (v) wrongClear++;
        else wrongBlocked++;
    }
});
console.log(`decided: by the clear bound ${((byClear / rows.length) * 100).toFixed(1)}%, by a blocked probe ${((byBlocked / rows.length) * 100).toFixed(1)}%, marched ${((byMarch / rows.length) * 100).toFixed(1)}%; mismatches ${mism} (clear ${wrongClear}, blocked ${wrongBlocked})`);
const time = (fn: (i: number) => unknown) => {
    let best = Infinity;
    for (let pass = 0; pass < 3; pass++) {
        const t0 = performance.now();
        for (let i = 0; i < rows.length; i++) fn(i);
        best = Math.min(best, performance.now() - t0);
    }
    return (best * 1e6) / rows.length;
};
const a = time((i) => P.segmentClear.call(set, rows[i][0], rows[i][1], rows[i][2], rows[i][3], rows[i][4], rows[i][5] ?? 0.01));
const b = time((i) => F.fastSegmentClear(set, rows[i][0], rows[i][1], rows[i][2], rows[i][3], rows[i][4], rows[i][5] ?? 0.01));
const c = time((i) => decide(rows[i][0], rows[i][1], rows[i][2], rows[i][3], rows[i][4], rows[i][5] ?? 0.01));
console.log(`segmentClear ns/call: original ${a.toFixed(0)}, fast march ${b.toFixed(0)} (${(a / b).toFixed(2)}x), bounds first ${c.toFixed(0)} (${(a / c).toFixed(2)}x)`);
let mism2 = 0;
rows.forEach((r, i) => {
    if (F.fastSegmentClear2(set, r[0], r[1], r[2], r[3], r[4], r[5] ?? 0.01) !== ref[i]) mism2++;
});
const d2 = time((i) => F.fastSegmentClear2(set, rows[i][0], rows[i][1], rows[i][2], rows[i][3], rows[i][4], rows[i][5] ?? 0.01));
console.log(`deep point first (fastSegmentClear2): ${d2.toFixed(0)} ns/call (${(a / d2).toFixed(2)}x); mismatches ${mism2}`);
// Synthetic runs over the whole set: every collider's neighbourhood, radii 0.01-2 m, runs 0.2-40 m, the slack 0.01.
let seed = 777;
const rnd = () => ((seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 4294967296);
const syn: number[][] = [];
for (let k = 0; k < 150000; k++) {
    const c = set.list[Math.floor(rnd() * set.list.length)];
    const x = c.cx + (rnd() - 0.5) * 16;
    const z = c.cz + (rnd() - 0.5) * 16;
    const ang = rnd() * Math.PI * 2;
    const l = k % 5 === 0 ? 0.2 + rnd() * 2 : 0.5 + rnd() * 40;
    syn.push([x, z, x + Math.cos(ang) * l, z + Math.sin(ang) * l, [0.011, 0.02, 0.05, 0.12, 0.35, 0.8, 2][k % 7], 0.01]);
}
let mism3 = 0;
let clear3 = 0;
for (const r of syn) {
    const want = P.segmentClear.call(set, r[0], r[1], r[2], r[3], r[4], r[5]);
    if (want) clear3++;
    if (F.fastSegmentClear2(set, r[0], r[1], r[2], r[3], r[4], r[5]) !== want) mism3++;
}
const a3 = (() => {
    let best = Infinity;
    for (let pass = 0; pass < 3; pass++) {
        const t0 = performance.now();
        for (const r of syn) P.segmentClear.call(set, r[0], r[1], r[2], r[3], r[4], r[5]);
        best = Math.min(best, performance.now() - t0);
    }
    return (best * 1e6) / syn.length;
})();
const b3 = (() => {
    let best = Infinity;
    for (let pass = 0; pass < 3; pass++) {
        const t0 = performance.now();
        for (const r of syn) F.fastSegmentClear2(set, r[0], r[1], r[2], r[3], r[4], r[5]);
        best = Math.min(best, performance.now() - t0);
    }
    return (best * 1e6) / syn.length;
})();
console.log(`synthetic runs: ${syn.length}, clear ${((clear3 / syn.length) * 100).toFixed(1)}%; mismatches ${mism3}; original ${a3.toFixed(0)} ns, fastSegmentClear2 ${b3.toFixed(0)} ns (${(a3 / b3).toFixed(2)}x)`);
// Exact repeats in the recorded sample (1 in 7 of the calls): a memo's floor.
const keys = new Set(rows.map((r) => r.join(",")));
console.log(`distinct runs in the sample: ${keys.size} of ${rows.length}`);

}
// MARK: sweepAll(...) >= 1, recorded (the nav's runClear / stepClear)
{
    const b2 = readFileSync(`${arg("rec", "")}/sweepAll.f64`);
    const g = new Float64Array(b2.buffer, b2.byteOffset, b2.byteLength / 8);
    const sw: number[][] = [];
    for (let o = 0; o < g.length; ) {
        const n = g[o++];
        sw.push(Array.from(g.subarray(o, o + n)));
        o += n;
    }
    let bad = 0;
    let clearN = 0;
    for (const r of sw) {
        const want = P.sweepAll.call(set, r[0], r[1], r[2], r[3], r[4], r[5] ?? 0.01) >= 1;
        if (want) clearN++;
        if (F.fastSweepAllClear(set, r[0], r[1], r[2], r[3], r[4], r[5] ?? 0.01) !== want) bad++;
    }
    const tm = (fn: (r: number[]) => unknown) => {
        let best = Infinity;
        for (let pass = 0; pass < 3; pass++) {
            const t0 = performance.now();
            for (const r of sw) fn(r);
            best = Math.min(best, performance.now() - t0);
        }
        return (best * 1e6) / sw.length;
    };
    const o1 = tm((r) => P.sweepAll.call(set, r[0], r[1], r[2], r[3], r[4], r[5] ?? 0.01) >= 1);
    const o2 = tm((r) => F.fastSweepAll(set, r[0], r[1], r[2], r[3], r[4], r[5] ?? 0.01) >= 1);
    const o3 = tm((r) => F.fastSweepAllClear(set, r[0], r[1], r[2], r[3], r[4], r[5] ?? 0.01));
    console.log(`sweepAll >= 1 (recorded ${sw.length}, clear ${((clearN / sw.length) * 100).toFixed(1)}%): original ${o1.toFixed(0)} ns, fast march ${o2.toFixed(0)} ns (${(o1 / o2).toFixed(2)}x), deep point first ${o3.toFixed(0)} ns (${(o1 / o3).toFixed(2)}x); mismatches ${bad}`);
}
