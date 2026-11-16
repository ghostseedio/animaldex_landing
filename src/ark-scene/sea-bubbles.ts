/**
 * Bubbles under the sea (3.3 batch, lane E; the owner, 2026-11-16: "add underwater caves, bubbles, more details"):
 * the pure parts. Three.js-free, so the tests run in node. `sea-bubbles-render.ts` draws them all as one `Points`.
 *
 * Two kinds, by what they are tied to (the brief's rule 2):
 * - **Tied to a place: the vents' streams.** Sites on the sea bed chosen by one pure rule over the terrain
 *   (`seaVents`), each a chain of bubbles whose every position is a pure function of the sea's shared clock
 *   (`ventBubble`): every viewer sees the same stream at the same moment. Each bubble's cycle is a whole number of
 *   cycles per clock period, so the clock's wrap is never seen.
 * - **Tied to a reaction: a diver's burst and a fast swimmer's trail.** Viewer-local, from a fixed pool
 *   (`BubblePool`) that overwrites its oldest: an air-breather (the depth table's own flag, `depth-bands.json` "b":
 *   whales, dolphins, turtles, seals, diving birds) lets go a burst as it turns down from its breath, a small one as
 *   it comes up to it; anything swimming fast leaves a thin trail (`SwimmerBubbles`). Visual only.
 */

import {TERRAIN_HALF, arkWorld, hashString, onArkWorld, sampleGround} from "@/ark-scene/world";
import {seaBedAt} from "@/ark-scene/reef";

// MARK: - Vents (shared)

export type SeaVent = {x: number; y: number; z: number; depth: number; phase: number};

/** A vent stands in water this deep (m): never in the swash, never off the drawn bed. */
export const VENT_MIN_DEPTH = 2.2;
export const VENT_MAX_DEPTH = 14;
/** No two vents nearer than this (m). */
export const VENT_SPACING = 12;
export const VENT_LIMIT = 36;
/** The bubbles of one vent's chain. */
export const VENT_BUBBLES = 14;
/** How fast a bubble rises (m/s). */
export const BUBBLE_RISE = 0.75;
/** The sea clock's period (`fish-schools.ts` SEA_CLOCK_PERIOD). */
const PERIOD = 600;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

const vents = new Map<string, SeaVent[]>();
onArkWorld(() => vents.clear());

/**
 * The vents: the sea bed's points on one spiral out from the island's middle, kept where the water is 2.2–14 m deep
 * and the bed is sand, rubble or bare rock (never on the reef's own framework, where the corals stand), and a spacing
 * apart. Pure: the same for every viewer of the same world.
 */
export function seaVents(): SeaVent[] {
    const world = arkWorld();
    const known = vents.get(world);
    if (known) return known;
    const found: SeaVent[] = [];
    // (The spiral runs out to the drawn ground's edge, whichever world is in use: the bigger island's sea is further out.)
    for (let k = 40; found.length < VENT_LIMIT; k++) {
        const radius = 2.6 * Math.sqrt(k);
        if (radius > TERRAIN_HALF * 1.05) break;
        const x = Math.cos(k * GOLDEN_ANGLE) * radius;
        const z = Math.sin(k * GOLDEN_ANGLE) * radius;
        // (The cheap test first: most of the spiral is land.)
        const height = sampleGround(x, z).height;
        if (height > -VENT_MIN_DEPTH || height < -VENT_MAX_DEPTH) continue;
        if (found.some((vent) => Math.hypot(vent.x - x, vent.z - z) < VENT_SPACING)) continue;
        // (A third of what is left: vents are places, not a carpet.)
        if (hashString(`vent#${k}`) % 3) continue;
        const bed = seaBedAt(x, z);
        if (bed.substrate === "reef" || bed.slope > 0.6) continue;
        found.push({x, y: bed.height, z, depth: bed.depth, phase: (hashString(`vent#${k}#phase`) % 1000) / 1000});
    }
    vents.set(world, found);
    return found;
}

export type BubblePoint = {x: number; y: number; z: number; size: number};

const fract = (v: number): number => v - Math.floor(v);

/**
 * Bubble `j` of a vent's chain at clock second `t`: it leaves the bed, rises at `BUBBLE_RISE` wobbling wider as it
 * goes, swells toward the surface (the pressure falls), and is gone a hand under it (`size` 0: not drawn), then a
 * pause before the next. A pure function of the clock.
 */
export function ventBubble(vent: SeaVent, j: number, t: number, out: BubblePoint): BubblePoint {
    const rise = Math.max(vent.depth - 0.1, 0.1) / BUBBLE_RISE;
    // A whole number of cycles in the clock's period (so t and t + 600 are the same moment).
    const cycle = PERIOD / Math.max(Math.round(PERIOD / (rise + 1.2)), 1);
    const own = fract(j * 0.6180339887 + vent.phase);
    const age = fract(t / cycle + own) * cycle;
    if (age >= rise) {
        out.x = vent.x;
        out.y = vent.y;
        out.z = vent.z;
        out.size = 0;
        return out;
    }
    const up = age / rise;
    const wide = 0.05 + 0.3 * up;
    out.x = vent.x + Math.sin(age * 3.1 + own * 40) * wide + (own - 0.5) * 0.16;
    out.z = vent.z + Math.cos(age * 2.6 + own * 23) * wide + (fract(own * 7.3) - 0.5) * 0.16;
    out.y = vent.y + 0.03 + age * BUBBLE_RISE;
    out.size = (0.02 + 0.045 * fract(own * 5.7) * fract(own * 5.7)) * (1 + 0.7 * up);
    return out;
}

// MARK: - The pool (viewer-local)

/** The pool's bubbles on the high, medium and low tiers. */
export const POOL_SIZE = {high: 240, medium: 140, low: 60} as const;

/**
 * A fixed pool of free bubbles: emitted at a point, rising and wobbling, gone at the surface or at the end of their
 * life. Nothing is allocated after the constructor; a full pool overwrites its oldest bubble.
 */
export class BubblePool {
    readonly capacity: number;
    private readonly px: Float32Array;
    private readonly py: Float32Array;
    private readonly pz: Float32Array;
    private readonly size: Float32Array;
    private readonly age: Float32Array;
    private readonly life: Float32Array;
    private readonly seed: Float32Array;
    private next = 0;
    private roll = 0x2f6e2b1;

    constructor(capacity: number) {
        this.capacity = Math.max(capacity | 0, 1);
        this.px = new Float32Array(this.capacity);
        this.py = new Float32Array(this.capacity);
        this.pz = new Float32Array(this.capacity);
        this.size = new Float32Array(this.capacity);
        this.age = new Float32Array(this.capacity);
        this.life = new Float32Array(this.capacity);
        this.seed = new Float32Array(this.capacity);
    }

    /** 0…1, the pool's own sequence (viewer-local, so not the shared clock's). */
    private random(): number {
        this.roll = (Math.imul(this.roll, 1664525) + 1013904223) >>> 0;
        return this.roll / 4294967296;
    }

    /** The bubbles alive now. */
    get live(): number {
        let n = 0;
        for (let i = 0; i < this.capacity; i++) if (this.life[i] > 0) n++;
        return n;
    }

    /** `count` bubbles about a point, within `spread` metres of it, about `size` metres across. */
    emit(x: number, y: number, z: number, count: number, spread: number, size: number): void {
        const n = Math.min(Math.max(count | 0, 0), this.capacity);
        for (let k = 0; k < n; k++) {
            const i = this.next;
            this.next = (this.next + 1) % this.capacity;
            this.px[i] = x + (this.random() - 0.5) * 2 * spread;
            this.py[i] = y + (this.random() - 0.5) * spread;
            this.pz[i] = z + (this.random() - 0.5) * 2 * spread;
            this.size[i] = size * (0.5 + this.random());
            this.age[i] = 0;
            this.life[i] = 2.5 + this.random() * 3.5;
            this.seed[i] = this.random() * 40;
        }
    }

    /** On by `dt` seconds: each rises (the larger the faster), wobbles, and is gone at the `surface` or at its life's end. */
    step(dt: number, surface = 0): void {
        const step = Math.min(Math.max(dt, 0), 0.1);
        for (let i = 0; i < this.capacity; i++) {
            if (this.life[i] <= 0) continue;
            this.age[i] += step;
            this.py[i] += (0.45 + this.size[i] * 9) * step;
            this.px[i] += Math.sin(this.age[i] * 4.2 + this.seed[i]) * 0.12 * step;
            this.pz[i] += Math.cos(this.age[i] * 3.7 + this.seed[i]) * 0.12 * step;
            if (this.age[i] >= this.life[i] || this.py[i] > surface - 0.04) this.life[i] = 0;
        }
    }

    /** Write the live bubbles into the drawn arrays from `offset` on (x, y, z per point; a size per point). Returns how many. */
    write(positions: Float32Array, sizes: Float32Array, offset: number): number {
        let n = 0;
        for (let i = 0; i < this.capacity; i++) {
            if (this.life[i] <= 0) continue;
            const at = offset + n;
            if ((at + 1) * 3 > positions.length) break;
            positions[at * 3] = this.px[i];
            positions[at * 3 + 1] = this.py[i];
            positions[at * 3 + 2] = this.pz[i];
            // (Fading out over its last half second.)
            sizes[at] = this.size[i] * Math.min((this.life[i] - this.age[i]) * 2, 1);
            n++;
        }
        return n;
    }

    clear(): void {
        this.life.fill(0);
    }
}

// MARK: - Swimmers (viewer-local)

/** A breath this far up (0…1, `sea-depth.ts` breathAt) is "at the surface". */
export const BREATH_UP = 0.7;
/** A swimmer faster than this (m/s, and than a body length a second) trails bubbles. */
export const TRAIL_SPEED = 1.5;
/** One trail bubble per this many metres swum. */
const TRAIL_EVERY = 0.45;

type Swimmer = {x: number; y: number; z: number; t: number; breath: number; swum: number};

/**
 * What the animals near the camera add to the pool: called each frame for each one drawn in the water. A burst as an
 * air-breather turns down from its breath (its `breath` falls back through `BREATH_UP`: the dive), a smaller one as it
 * rises through it (the breath out just under the surface), and a thin trail behind anything swimming fast.
 */
export class SwimmerBubbles {
    private readonly seen = new Map<string, Swimmer>();

    constructor(private readonly pool: BubblePool) {}

    track(id: string, x: number, y: number, z: number, breath: number, length: number, now: number): void {
        let s = this.seen.get(id);
        if (!s) {
            if (this.seen.size > 160) this.prune(now);
            s = {x, y, z, t: now, breath, swum: 0};
            this.seen.set(id, s);
            return;
        }
        const dt = now - s.t;
        // (Only between two frames it was seen in: a first sight, or one after a gap, bursts nothing.)
        if (dt > 0 && dt < 0.5) {
            const size = Math.min(0.02 + length * 0.012, 0.07);
            if (s.breath >= BREATH_UP && breath < BREATH_UP) this.pool.emit(x, Math.min(y, -0.15), z, Math.min(8 + Math.round(length * 5), 26), 0.15 + length * 0.2, size);
            else if (s.breath < BREATH_UP && breath >= BREATH_UP) this.pool.emit(x, Math.min(y, -0.15), z, Math.min(4 + Math.round(length * 2), 10), 0.1 + length * 0.12, size * 0.7);
            const moved = Math.hypot(x - s.x, y - s.y, z - s.z);
            const speed = moved / dt;
            if (speed > TRAIL_SPEED && speed > length && speed < 40) {
                s.swum += moved;
                if (s.swum >= TRAIL_EVERY) {
                    s.swum = 0;
                    this.pool.emit(s.x, Math.min(s.y, -0.1), s.z, 1, 0.04 + length * 0.05, Math.min(0.012 + length * 0.004, 0.03));
                }
            }
        }
        s.x = x;
        s.y = y;
        s.z = z;
        s.t = now;
        s.breath = breath;
    }

    /** Forget the ones not seen for five seconds. */
    private prune(now: number): void {
        this.seen.forEach((s, id) => {
            if (now - s.t > 5) this.seen.delete(id);
        });
        if (this.seen.size > 160) this.seen.clear();
    }

    get size(): number {
        return this.seen.size;
    }
}
