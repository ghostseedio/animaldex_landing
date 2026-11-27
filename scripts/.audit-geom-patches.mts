/**
 * PERF-WEB audit (area: geometric queries): install the prototype accelerations (.audit-geom-fast.mts) on the live
 * classes and the town sampler, for the end-to-end runs of .audit-geom-town.mts (--patch a,b,c). Untracked helper.
 *
 *   colliders   ColliderSet near/distance/clearance/sweep/sweepAll/segmentClear/blocked -> the CSR index versions
 *   height      the town sampler's heightAt/waterDepth/slope -> height-only, lazy inland, street index
 *   hcache      the town sampler's heightAt behind an exact direct-mapped cache (2^14)
 *   attach      NavGrid.attachable remembered per grid by its exact arguments
 *   sweepmemo   ColliderSet.sweepAll / segmentClear remembered per set by their exact arguments (no skip)
 */
import {createRequire} from "node:module";
import * as F from "./.audit-geom-fast.mts";
const req = createRequire(import.meta.url);

export const stats: Record<string, number> = {};

export function install(names: string[], ctx: {sampler: any; set: any; origin: {x: number; z: number}}) {
    const want = new Set(names);
    process.on("exit", () => {
        const parts: string[] = [];
        for (const [k, v] of Object.entries(stats)) parts.push(typeof v === "number" ? `${k} ${v}` : `${k} hits ${(v as any).hits} misses ${(v as any).misses}`);
        if (parts.length) console.log(`patch stats: ${parts.join("; ")}`);
    });
    const P = Object.getPrototypeOf(ctx.set);
    if (want.has("colliders")) {
        P.near = function (x: number, z: number, r: number, out?: any[]) {
            return F.fastNear(this, x, z, r, out);
        };
        P.distance = function (x: number, z: number, cap = 4, skip?: (c: any) => boolean) {
            return F.fastDistance(this, x, z, cap, skip);
        };
        P.clearance = function (x: number, z: number, radius = 0, cap = 4, base = -Infinity, height = Infinity) {
            return F.fastClearance(this, x, z, radius, cap, base, height);
        };
        P.sweep = function (ax: number, az: number, bx: number, bz: number, radius: number, slack = 0.01) {
            return F.fastSweep(this, ax, az, bx, bz, radius, slack);
        };
        P.sweepAll = function (ax: number, az: number, bx: number, bz: number, radius: number, slack = 0.01, skip?: (c: any) => boolean) {
            return F.fastSweepAll(this, ax, az, bx, bz, radius, slack, skip);
        };
        P.blocked = function (x: number, z: number, radius: number, base = -Infinity, height = Infinity) {
            return F.fastBlocked(this, x, z, radius, base, height);
        };
    }
    if (want.has("sweepmemo")) {
        const sweepAll0 = P.sweepAll;
        const segmentClear0 = P.segmentClear;
        const memo = new WeakMap<object, Map<string, number>>();
        const of = (set: object) => {
            let m = memo.get(set);
            if (!m) memo.set(set, (m = new Map()));
            return m;
        };
        P.sweepAll = function (ax: number, az: number, bx: number, bz: number, radius: number, slack = 0.01, skip?: (c: any) => boolean) {
            if (skip) return sweepAll0.call(this, ax, az, bx, bz, radius, slack, skip);
            const m = of(this);
            const key = `a${ax},${az},${bx},${bz},${radius},${slack}`;
            let v = m.get(key);
            if (v === undefined) {
                v = sweepAll0.call(this, ax, az, bx, bz, radius, slack) as number;
                if (m.size > 200000) m.clear();
                m.set(key, v);
                stats.sweepMiss = (stats.sweepMiss ?? 0) + 1;
            } else stats.sweepHit = (stats.sweepHit ?? 0) + 1;
            return v;
        };
        P.segmentClear = function (ax: number, az: number, bx: number, bz: number, radius: number, slack = 0.01) {
            const m = of(this);
            const key = `s${ax},${az},${bx},${bz},${radius},${slack}`;
            let v = m.get(key);
            if (v === undefined) {
                v = segmentClear0.call(this, ax, az, bx, bz, radius, slack) ? 1 : 0;
                if (m.size > 200000) m.clear();
                m.set(key, v);
                stats.segMiss = (stats.segMiss ?? 0) + 1;
            } else stats.segHit = (stats.segHit ?? 0) + 1;
            return v === 1;
        };
    }
    if (want.has("segclear2")) {
        P.segmentClear = function (ax: number, az: number, bx: number, bz: number, radius: number, slack = 0.01) {
            return F.fastSegmentClear2(this, ax, az, bx, bz, radius, slack);
        };
    }
    if (want.has("segmemo")) {
        const inner = P.segmentClear;
        const memos = new WeakMap<object, ReturnType<typeof F.exactCache6>>();
        P.segmentClear = function (ax: number, az: number, bx: number, bz: number, radius: number, slack = 0.01) {
            let m = memos.get(this);
            if (!m) {
                const set = this;
                memos.set(this, (m = F.exactCache6((a, b, c, d, e, f) => inner.call(set, a, b, c, d, e, f), 16)));
                (stats as any)[`segmemo[${this.list.length} colliders]`] = m;
            }
            return m(ax, az, bx, bz, radius, slack);
        };
    }
    if (want.has("fits")) {
        const nav = req("@/ark-scene/behaviour-nav");
        const N = nav.NavGrid.prototype;
        const MAX = nav.MAX_SLOPE;
        N.fits = function (x: number, z: number, radius: number, maxSlope = MAX) {
            if (!this.solid) return this.walkable(x, z, maxSlope);
            const [i, j] = this.cellOf(x, z);
            const k = j * this.size + i;
            if (i < 1 || j < 1 || i >= this.size - 1 || j >= this.size - 1 || this.height[k] <= 0.05 || this.steep[k] > maxSlope) return false;
            return F.fastDistanceAtLeast(this.solid, x, z, 4, radius) && this.sampler.heightAt(x, z) > 0.02 && this.localSlope(x, z) <= maxSlope * 1.25;
        };
    }
    if (want.has("crawlstats")) {
        // (Each crawl search starts with one wide near() (flat / 2 + 12 m): what follows until the next is that search's.)
        const near0 = P.near, blocked0 = P.blocked, seg0 = P.segmentClear;
        type Search = {r: number; blocked: number; segs: number; clear: number; ms: number; t0: number};
        const searches: Search[] = [];
        let cur: Search | null = null;
        let inner = 0;
        P.near = function (x: number, z: number, r: number, out?: any[]) {
            if (!inner && r >= 12) {
                if (cur) cur.ms = performance.now() - cur.t0;
                cur = {r, blocked: 0, segs: 0, clear: 0, ms: 0, t0: performance.now()};
                searches.push(cur);
            }
            return near0.call(this, x, z, r, out);
        };
        P.blocked = function (...a: any[]) {
            if (cur && !inner) cur.blocked++;
            inner++;
            try {
                return blocked0.apply(this, a);
            } finally {
                inner--;
            }
        };
        P.segmentClear = function (...a: any[]) {
            inner++;
            try {
                const v = seg0.apply(this, a);
                if (cur) {
                    cur.segs++;
                    if (v) cur.clear++;
                }
                return v;
            } finally {
                inner--;
            }
        };
        process.on("exit", () => {
            if (cur) cur.ms = performance.now() - cur.t0;
            const segs = searches.reduce((n, s) => n + s.segs, 0);
            const sorted = [...searches].sort((a, b) => b.segs - a.segs);
            console.log(`crawl searches (wide near calls): ${searches.length}; segmentClear in them ${segs}; with any run tested ${searches.filter((s) => s.segs > 0).length}`);
            const q = (p: number) => sorted[Math.floor((sorted.length - 1) * p)]?.segs ?? 0;
            console.log(`  runs per search: max ${q(0)}, p10 ${q(0.1)}, median ${q(0.5)}; ring tests (blocked) per search, top 5: ${sorted.slice(0, 5).map((s) => `${s.segs} runs ${s.clear} clear ${s.blocked} ring tests r ${s.r.toFixed(1)} ${s.ms.toFixed(0)} ms`).join(" | ")}`);
            const top = sorted.slice(0, Math.ceil(sorted.length * 0.05));
            console.log(`  the top 5% of searches: ${top.reduce((n, s) => n + s.segs, 0)} runs, ${top.reduce((n, s) => n + s.ms, 0).toFixed(0)} ms (wall, includes what runs between)`);
        });
    }
    const s = ctx.sampler;
    const ox = ctx.origin.x;
    const oz = ctx.origin.z;
    if (want.has("height") || want.has("hcache")) {
        // (The town's ground height in its own frame, as the sampler asks it: townHeight(x - ox, z - oz). The height-only
        // version and/or an exact cache of it; heightAt, waterDepth and slope all through it.)
        const {townWaterSurface} = req("@/ark-scene/islands/town/drawn-ground");
        const ground = req("@/ark-scene/islands/town/ground");
        const base: (x: number, z: number) => number = want.has("height") ? F.makeTownHeight({lazyInland: true, streetIndex: true}) : ground.townHeight;
        let h = base;
        if (want.has("hcache")) {
            const cached = F.exactCache2(base, 14);
            (stats as any).hcache = cached;
            h = cached;
        }
        s.heightAt = (x: number, z: number) => h(x - ox, z - oz);
        s.waterDepth = (x: number, z: number) => Math.max((townWaterSurface(x - ox, z - oz) ?? 0) - h(x - ox, z - oz), 0);
        s.slope = (x: number, z: number) => {
            const d = 0.75;
            const lx = x - ox;
            const lz = z - oz;
            return Math.max(Math.abs(h(lx + d, lz) - h(lx - d, lz)), Math.abs(h(lx, lz + d) - h(lx, lz - d))) / (2 * d);
        };
    }
    if (want.has("attach")) {
        const N = req("@/ark-scene/behaviour-nav").NavGrid.prototype;
        const attachable0 = N.attachable;
        const memo = new WeakMap<object, Map<string, boolean>>();
        N.attachable = function (x: number, z: number, radius: number, maxSlope = 0.9, onto = false) {
            let m = memo.get(this);
            if (!m) memo.set(this, (m = new Map()));
            const key = `${x},${z},${radius},${maxSlope},${onto ? 1 : 0}`;
            let v = m.get(key);
            if (v === undefined) {
                v = attachable0.call(this, x, z, radius, maxSlope, onto) as boolean;
                m.set(key, v);
                stats.attachMiss = (stats.attachMiss ?? 0) + 1;
            } else stats.attachHit = (stats.attachHit ?? 0) + 1;
            return v;
        };
    }
}
