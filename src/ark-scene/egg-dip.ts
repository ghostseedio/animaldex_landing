/**
 * A dragonfly laying her eggs (owner 2026-11-16; AnimalDex docs/ark/signature-behaviours.json, rows `clip:dragonfly_dip_oviposit`):
 * the female flies low over still water and dips the tip of her abdomen to the surface again and again, each dip leaving
 * a ring. The species are the catalogue's (`data/ark/egg-dip.json`, built by `scripts/ark-egg-dip.mts`): the recipe
 * `dip_lay` (`recipe-templates.ts`) is given only to those whose own stored text says the female does it.
 *
 * Here: the dip itself (how far down she is at a moment of the hold, pure in its time, so every viewer sees the same
 * taps) and the rings on the water (a viewer's own: a ring where each tap touched, spreading and fading). The engine
 * (`behaviour-recipes.ts`, block `dip_tail`) takes her height from `dipDepth`; the scene draws the rings.
 */

/** Taps a second. */
export const DIP_RATE = 1.1;
/** How long a ring spreads before it is gone (s). */
export const DIP_RING_SECONDS = 1.8;

/**
 * How far down she is `seconds` into the hold: 0 at her hovering height, 1 with her abdomen's tip on the water. A quick
 * tap once a cycle (down and straight up again, most of the cycle spent up), the first at the cycle's middle.
 */
export function dipDepth(seconds: number): number {
    if (!(seconds > 0)) return 0;
    const wave = 0.5 - 0.5 * Math.cos(seconds * DIP_RATE * Math.PI * 2);
    return wave * wave * wave;
}

/** How many taps have touched the water `seconds` into the hold. */
export function dipsBy(seconds: number): number {
    return seconds > 0 ? Math.floor(seconds * DIP_RATE + 0.5) : 0;
}

/** A ring `age` seconds after its tap, round a body of that length: its radius (m) and strength, or null once gone. */
export function dipRing(age: number, length: number): {radius: number; alpha: number} | null {
    if (!(age >= 0) || age >= DIP_RING_SECONDS) return null;
    const k = age / DIP_RING_SECONDS;
    const size = Math.min(Math.max(length, 0.06), 0.6);
    return {radius: size * (0.4 + 3.2 * k), alpha: 0.85 * Math.pow(1 - k, 1.5)};
}

// MARK: At her pond (a small animal off the schedule)

/**
 * The pond dragonflies are small animals at their own spot on the water (`micro.ts`, `pond_surface`), off the shared
 * schedule: their laying is this flight pattern round the spot, pure in the id and the time, so every viewer sees the
 * same bout. Now and then (a window every `MICRO_BOUT_EVERY` seconds, taken with `chance`) she lifts off her spot and
 * goes low over the water to a few places near it; at each she hovers and taps her abdomen's tip to the water three
 * times (`dipDepth`), then on to the next, and back to her spot.
 */
export const MICRO_BOUT_EVERY = 150;
const HOP = 1.5;
const TAPS = 3;
const STATIONS = 4;
const SETTLE = 1.4;
const HOLD = TAPS / DIP_RATE;
export const MICRO_BOUT_SECONDS = STATIONS * (HOP + HOLD) + SETTLE;

export type MicroDip = {x: number; y: number; z: number; yaw: number; pitch: number; block: "fly" | "dip_tail"; /** Seconds into the hold (a dip), else 0. */ since: number; episode: string; station: number; /** The water's level under her. */ top: number};

function unit(key: string): number {
    let h = 2166136261;
    for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
    return ((h >>> 0) % 100000) / 100000;
}
const ease = (u: number) => {
    const c = Math.min(Math.max(u, 0), 1);
    return c * c * (3 - 2 * c);
};

/**
 * Her laying flight at `epoch`, or null (on her spot, as ever). `spot`: where she sits; `surface(x, z)`: the water's
 * level there where it is open water, else null (she keeps over the water: a place that is not is not gone to).
 * `chance`: the share of windows she lays in (her season's factor; 0: never).
 */
export function microDipAt(id: string, spot: {x: number; y: number; z: number; yaw: number}, epoch: number, length: number, chance: number, surface: (x: number, z: number) => number | null): MicroDip | null {
    if (!(chance > 0) || !Number.isFinite(epoch)) return null;
    const offset = unit(`${id}#dip`) * MICRO_BOUT_EVERY;
    const window = Math.floor((epoch - offset) / MICRO_BOUT_EVERY);
    const s = epoch - offset - window * MICRO_BOUT_EVERY;
    if (s >= MICRO_BOUT_SECONDS || unit(`${id}#dip#${window}`) >= chance) return null;
    const L = Math.max(length, 0.01);
    const hover = Math.max(L * 2.5, 0.08);
    const low = Math.max(L * 0.15, 0.006);
    const reach = Math.min(Math.max(L * 14, 0.5), 1.4);
    // The places she lays at: near her spot, each over open water (nearer in where the first try is not; else her spot).
    const station = (k: number): {x: number; z: number; top: number} => {
        if (k < 0 || k >= STATIONS) return {x: spot.x, z: spot.z, top: spot.y};
        const a = unit(`${id}#dip#${window}#a${k}`) * Math.PI * 2;
        for (const share of [1, 0.55, 0.25]) {
            const r = reach * (0.45 + 0.55 * unit(`${id}#dip#${window}#r${k}`)) * share;
            const x = spot.x + Math.sin(a) * r;
            const z = spot.z + Math.cos(a) * r;
            const top = surface(x, z);
            if (top !== null) return {x, z, top};
        }
        return {x: spot.x, z: spot.z, top: surface(spot.x, spot.z) ?? spot.y};
    };
    const episode = `dip:${id}:${window}`;
    const k = Math.min(Math.floor(s / (HOP + HOLD)), STATIONS);
    const from = station(k - 1);
    const to = station(k);
    const u = s - k * (HOP + HOLD);
    const d = Math.hypot(to.x - from.x, to.z - from.z);
    const yaw = d > 1e-4 ? Math.atan2(to.x - from.x, to.z - from.z) : spot.yaw;
    const up = (p: {top: number}, i: number) => (i < 0 || i >= STATIONS ? spot.y : p.top + hover);
    if (k >= STATIONS || u < HOP) {
        // On the wing to the next place (the last: down onto her spot again).
        const e = ease(u / (k >= STATIONS ? SETTLE : HOP));
        return {x: from.x + (to.x - from.x) * e, y: up(from, k - 1) + (up(to, k) - up(from, k - 1)) * e, z: from.z + (to.z - from.z) * e, yaw, pitch: -0.12, block: "fly", since: 0, episode, station: k, top: to.top};
    }
    const since = u - HOP;
    return {x: to.x, y: to.top + hover - (hover - low) * dipDepth(since), z: to.z, yaw, pitch: -0.45, block: "dip_tail", since, episode, station: k, top: to.top};
}

type Ring = {x: number; y: number; z: number; start: number; length: number};

/** The rings the dippers near the camera have left (a viewer's own, like a splash): noted per frame, drawn while they spread. */
export class DipRipples {
    private taps = new Map<string, {key: string; n: number}>();
    private rings: Ring[] = [];

    get size(): number {
        return this.rings.length;
    }

    /**
     * A dipper now: `since` seconds into its hold (`key`: that hold), over the water at `at` (y: the surface there). Each
     * tap since it was last seen leaves one ring where she is; a hold first seen part way through leaves only its newest.
     */
    note(id: string, key: string, since: number, at: {x: number; y: number; z: number}, length: number, now: number): void {
        const n = dipsBy(since);
        const had = this.taps.get(id);
        if (had && had.key === key && had.n >= n) return;
        if (this.taps.size > 400) this.taps.clear();
        this.taps.set(id, {key, n});
        if (n < 1) return;
        // (The tap's own moment: its ring is already that old.)
        const age = since - (n - 0.5) / DIP_RATE;
        if (this.rings.length < 120) this.rings.push({x: at.x, y: at.y, z: at.z, start: now - Math.max(age, 0), length});
    }

    /** The rings still spreading, each handed to `draw`; those gone are dropped. */
    each(now: number, draw: (x: number, y: number, z: number, radius: number, alpha: number) => void): void {
        for (let i = this.rings.length - 1; i >= 0; i--) {
            const r = this.rings[i];
            const ring = dipRing(now - r.start, r.length);
            if (!ring) {
                this.rings.splice(i, 1);
                continue;
            }
            draw(r.x, r.y, r.z, ring.radius, ring.alpha);
        }
    }
}
