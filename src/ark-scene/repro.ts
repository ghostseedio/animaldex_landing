/**
 * REAL-REPRODUCTION (AnimalDex docs/ark/real-reproduction.md, owner decision 440, 2026-11-20: "animals that stay
 * motionless 99% of time like coral, black sea cucumber ... how do they typically reproduce in the wild real-life — can
 * we mimic that for the ark" and "fix other animals too like fish who sperm on eggs ensuring visuals match").
 *
 * Every kind breeds its one real way (AnimalDex docs/ark/reproduction-ways.json, read from its stored field-guide text
 * and taxonomy; this folder's `reproduction-ways.json` is its compact copy keyed by kind). A mating of the record is
 * acted the kind's way, never as a mammal's mount (decision 416, every mating shown):
 *
 *   spawn night  (broadcast, brooding: corals, sea cucumbers, urchins, giant clams, reef fish that spawn in groups)
 *                nobody moves to a partner: where each is, it rears up (a sea cucumber stands up on its end) and
 *                releases a haze of eggs and sperm into the night water; every one of its kind close by spawns with it.
 *   spawn pair   (salmon, cichlids, clownfish, sticklebacks...) to her spot, where the builder sweeps a redd or a nest
 *                (on her side, beating her tail); the two side by side over it, quivering: she lays, he releases milt
 *                over the eggs (a milky puff); the guard stays over it. A mouthbrooder takes the eggs up; scatterers
 *                and pelagic spawners ("rise") rise together and release in the water.
 *   amplexus     (frogs, toads) he clasps her from on top, held a long while; then the spawn mass.
 *   pouch        (seahorses, pipefish: the male is pregnant) face to face, tails near, they circle and rise together;
 *                she passes her eggs into his pouch (a small bright puff); his young come later from the pouch.
 *   in place     (barnacles) neither moves; they reach to each other where they are fixed.
 *   spermatophore (newts, salamanders, scorpions) he dances before her and leads her a step over his packet; no mount.
 *   split        (hydra, anemones, corals, sea stars and the Black Sea Cucumber besides spawning) a birth with one
 *                parent: the young is pinched slowly off its parent's body (`splitPose`).
 *
 * Cheap: one Points cloud for every puff at once (`ReproFx`, at most `FX_MOST` particles, positions from the clock: no
 * state per particle), and pure poses. The scene loads this with the rest of its lazy chunk.
 */

import {AdditiveBlending, BufferAttribute, BufferGeometry, CanvasTexture, Color, Points, PointsMaterial, type Scene} from "three";
import type {ActPose} from "@/ark-scene/acts";
import table from "@/ark-scene/reproduction-ways.json";

export type ReproWay = "broadcast" | "brooding" | "spawn_pair" | "amplexus" | "male_pregnancy" | "sessile_copulation" | "spermatophore" | "asexual" | "parthenogenesis";
export type Repro = {way: ReproWay; detail: string | null; guard: "male" | "female" | "both" | "none" | null; also: string | null};
/** How a pair's breeding is acted. */
export type ReproAct = "spawn_night" | "spawn_pair" | "amplexus" | "pouch" | "in_place" | "spermatophore";
export type FxKind = "haze" | "milt" | "eggs" | "fry";

const ROWS = (table as {kinds: Record<string, string>}).kinds;
const cache = new Map<string, Repro | null>();

/** A kind's way of breeding (by its species_profile_id); null: it mates (the mating acts as before). */
export function reproOf(speciesId: string | null | undefined): Repro | null {
    if (!speciesId) return null;
    const hit = cache.get(speciesId);
    if (hit !== undefined) return hit;
    const row = ROWS[speciesId];
    let out: Repro | null = null;
    if (row) {
        const [way, detail, guard, also] = row.split("|");
        out = {way: way as ReproWay, detail: detail || null, guard: (guard || null) as Repro["guard"], also: also || null};
    }
    cache.set(speciesId, out);
    return out;
}

/** How a pair of this way is acted (null: the mating as before). Asexual and all-female kinds never pair. */
export function reproAct(r: Repro | null): ReproAct | null {
    if (!r) return null;
    switch (r.way) {
        case "broadcast":
        case "brooding":
            return "spawn_night";
        case "spawn_pair":
            return "spawn_pair";
        case "amplexus":
            return "amplexus";
        case "male_pregnancy":
            return "pouch";
        case "sessile_copulation":
            return "in_place";
        case "spermatophore":
            return "spermatophore";
        default:
            return null;
    }
}

/** Whether the pair stays where each is (no walk to the other). */
export function staysPut(act: ReproAct): boolean {
    return act === "spawn_night" || act === "in_place";
}

type Point = {x: number; z: number};
type Body = {length: number; height: number; pace: number};
type Ground = (x: number, z: number) => number;

/** A pair's act of its way: where each is and goes, and when each phase begins (s after the act's start). */
export type ReproPlan = {
    act: ReproAct;
    detail: string | null;
    /** Who stays over the eggs: "m" (the male), "f", "both", or null. */
    guard: "m" | "f" | "both" | null;
    /** Who sweeps the redd or the nest: the guard when it is the male (a nest builder), else the female. */
    builder: "m" | "f";
    from: {m: Point; f: Point};
    to: {m: Point; f: Point};
    spot: Point;
    heading: number;
    walk: number;
    /** Phase starts: sweeping, releasing, guarding (or rearing, spawning, settling; circling, passing). */
    a: number;
    b: number;
    c: number;
    end: number;
    m: Body;
    f: Body;
};

export const SPAWN_NIGHT = {rear: 6, spawn: 60, settle: 16};
export const PAIR = {sweep: 14, release: 12, guard: 70};
export const AMPLEXUS = {clasp: 3, held: 60, spawn: 14};
export const POUCH = {dance: 34, pass: 8, after: 40};
export const IN_PLACE = {reach: 30};
export const SPERMATOPHORE = {dance: 12, lead: 10, after: 30};

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);
const ease = (u: number) => {
    const c = clamp(u, 0, 1);
    return c * c * (3 - 2 * c);
};
const lerpP = (p: Point, q: Point, k: number): Point => ({x: p.x + (q.x - p.x) * k, z: p.z + (q.z - p.z) * k});
const yawTo = (p: Point, q: Point) => Math.atan2(q.x - p.x, q.z - p.z);

/** The plan of a pair's act from the mating's own meeting (`to`, `walk`, `heading`, from `live-matings.ts`). */
export function reproPlan(act: ReproAct, r: Repro, mating: {from: {m: Point; f: Point}; to: {m: Point; f: Point}; walk: number; heading: number; m: Body; f: Body}): ReproPlan {
    const guard = r.guard === "male" ? "m" : r.guard === "female" ? "f" : r.guard === "both" ? "both" : null;
    const put = staysPut(act);
    const to = put ? mating.from : mating.to;
    const walk = put ? 0 : mating.walk;
    const spot = put ? lerpP(mating.from.m, mating.from.f, 0.5) : lerpP(mating.to.m, mating.to.f, 0.5);
    const base = {act, detail: r.detail, guard, builder: guard === "m" ? "m" : "f", from: mating.from, to, spot, heading: put ? yawTo(mating.from.m, mating.from.f) : mating.heading, walk, m: mating.m, f: mating.f} as const;
    if (act === "spawn_night") {
        const a = SPAWN_NIGHT.rear;
        return {...base, a, b: a + SPAWN_NIGHT.spawn, c: a + SPAWN_NIGHT.spawn + SPAWN_NIGHT.settle, end: a + SPAWN_NIGHT.spawn + SPAWN_NIGHT.settle};
    }
    if (act === "spawn_pair") {
        // (The builder clears its spot first: a salmon's redd, a stickleback's nest, a clownfish's rock surface.)
        const sweep = r.detail === "redd" || r.detail === "nest" || r.detail === "surface" || r.detail === "bubble_nest" ? PAIR.sweep : 0;
        const a = walk + sweep;
        return {...base, a: walk, b: a, c: a + PAIR.release, end: a + PAIR.release + (guard ? PAIR.guard : 20)};
    }
    if (act === "amplexus") {
        const a = walk + AMPLEXUS.clasp;
        return {...base, a, b: a + AMPLEXUS.held, c: a + AMPLEXUS.held + AMPLEXUS.spawn, end: a + AMPLEXUS.held + AMPLEXUS.spawn + 20};
    }
    if (act === "pouch") {
        const a = walk + POUCH.dance;
        return {...base, a: walk, b: a, c: a + POUCH.pass, end: a + POUCH.pass + POUCH.after};
    }
    if (act === "spermatophore") {
        const a = walk + SPERMATOPHORE.dance;
        return {...base, a: walk, b: a, c: a + SPERMATOPHORE.lead, end: a + SPERMATOPHORE.lead + SPERMATOPHORE.after};
    }
    return {...base, a: 0, b: IN_PLACE.reach, c: IN_PLACE.reach, end: IN_PLACE.reach + 10};
}

/** The pose of the male (`isM`) or the female `s` seconds into the act. Pure. */
export function reproPose(p: ReproPlan, isM: boolean, s: number, ground: Ground, otherId: string): ActPose | null {
    if (s < 0 || s >= p.end) return null;
    const me = isM ? p.m : p.f;
    const from = isM ? p.from.m : p.from.f;
    const to = isM ? p.to.m : p.to.f;
    const facing = yawTo(isM ? p.to.m : p.to.f, isM ? p.to.f : p.to.m);
    const pose = (q: Point, yaw: number, state: string, extra: Partial<ActPose> & {lift?: number} = {}): ActPose => {
        const {lift = 0, ...rest} = extra;
        return {x: q.x, z: q.z, base: ground(q.x, q.z) + lift, yaw, pitch: 0, roll: 0, scale: 1, dim: 0, hidden: false, state, speed: 0, with: otherId, ...rest};
    };
    if (p.walk > 0 && s < p.walk) {
        const k = ease(s / p.walk);
        const d = Math.hypot(to.x - from.x, to.z - from.z);
        const swims = p.act === "spawn_pair" || p.act === "pouch";
        return pose(lerpP(from, to, k), d > 0.05 ? yawTo(from, to) : facing, d > 0.05 ? (swims ? "swim" : "walk") : "scan", {speed: d / p.walk});
    }
    const L = me.length;
    switch (p.act) {
        case "spawn_night": {
            // Where it is: up on its end (a sea cucumber, a star: a slow rear, nose up), spawning, then down again.
            const rears = p.detail === "sea_cucumber" || p.detail === "sea_star";
            const up = s < p.a ? ease(s / p.a) : s < p.b ? 1 : 1 - ease((s - p.b) / (p.c - p.b));
            const sway = s >= p.a && s < p.b ? Math.sin(s * 0.9 + (isM ? 0 : 1.7)) * 0.05 : 0;
            return pose(to, isM ? p.heading : p.heading + Math.PI, "rest", rears ? {pitch: -0.9 * up + sway, lift: L * 0.3 * up} : {roll: sway * 0.4});
        }
        case "spawn_pair": {
            const builds = (p.builder === "m") === isM;
            if (s < p.b) {
                // The builder on its side over the spot, beating its tail (the redd's gravel, the nest's hollow).
                if (builds) return pose(p.spot, p.heading + Math.sin(s * 1.3) * 0.5, "swim", {roll: 0.9 + Math.sin(s * 9) * 0.25, speed: 0.1});
                return pose(lerpP(to, p.spot, 0.3), facing, "swim", {speed: 0.05});
            }
            if (s < p.c) {
                // Side by side over it, quivering (she lays; he releases his milt over the eggs). A pelagic spawner rises
                // together through the water as it does.
                const side = {x: Math.cos(p.heading), z: -Math.sin(p.heading)};
                const off = (p.m.length + p.f.length) * 0.14 * (isM ? 1 : -1);
                const q = {x: p.spot.x + side.x * off, z: p.spot.z + side.z * off};
                const rise = p.detail === "rise" ? ease((s - p.b) / (p.c - p.b)) * Math.max(L * 1.5, 0.3) : 0;
                return pose(q, p.heading, "swim", {roll: Math.sin(s * 31 + (isM ? 0 : 1)) * 0.12, lift: rise, speed: 0});
            }
            // The guard keeps over the eggs (fanning them); a mouthbrooder takes them up first; the other goes.
            const guards = p.guard === "both" || (p.guard === "m" && isM) || (p.guard === "f" && !isM);
            if (!guards) return null;
            const pick = p.detail === "mouthbrood" && s < p.c + 4;
            return pose(p.spot, p.heading + Math.sin(s * 0.4) * 0.3, "swim", {pitch: pick ? 0.5 : 0, roll: Math.sin(s * 3) * 0.05, speed: 0});
        }
        case "amplexus": {
            // He on her back, his forelegs round her (no rhythm: amplexus is a long hold); then the spawn as she lays.
            if (!isM) return pose(p.spot, p.heading, "rest");
            const k = ease((s - p.walk) / AMPLEXUS.clasp);
            const on = {x: p.spot.x - Math.sin(p.heading) * p.f.length * 0.12 * k, z: p.spot.z - Math.cos(p.heading) * p.f.length * 0.12 * k};
            return pose(lerpP(to, on, k), p.heading, "rest", {lift: p.f.height * 0.5 * k, pitch: -0.12 * k});
        }
        case "pouch": {
            // Face to face, tails near: they circle a common middle and rise together, then nose to nose she passes her eggs.
            if (s < p.b) {
                const u = (s - p.a) / (p.b - p.a);
                const r = (p.m.length + p.f.length) * 0.22;
                const ang = p.heading + u * Math.PI * 1.5 + (isM ? 0 : Math.PI);
                const q = {x: p.spot.x + Math.sin(ang) * r, z: p.spot.z + Math.cos(ang) * r};
                return pose(q, ang + Math.PI, "swim", {lift: ease(u) * Math.max(L, 0.15), roll: Math.sin(s * 1.6) * 0.1});
            }
            const side = (isM ? 1 : -1) * (p.m.length + p.f.length) * 0.12;
            const q = {x: p.spot.x + Math.sin(p.heading) * side, z: p.spot.z + Math.cos(p.heading) * side};
            const down = s < p.c ? 1 : 1 - ease((s - p.c) / 8);
            return pose(q, yawTo(q, p.spot), "swim", {lift: down * Math.max(L, 0.15), pitch: s < p.c ? -0.3 : 0});
        }
        case "spermatophore": {
            // He dances before her; then leads her a step on, over his packet. No mount.
            if (s < p.b) return pose(to, facing, isM ? "dance" : "scan");
            const k = ease((s - p.b) / (p.c - p.b));
            const ahead = {x: Math.sin(p.heading) * L * 1.2 * k, z: Math.cos(p.heading) * L * 1.2 * k};
            return pose({x: to.x + ahead.x, z: to.z + ahead.z}, p.heading, k < 1 ? "walk" : "rest", {speed: k < 1 ? (L * 1.2) / (p.c - p.b) : 0});
        }
        default:
            // Fixed where each is: it reaches toward the other (a barnacle's long penis; a slow lean is what reads).
            return pose(to, facing, "rest", {pitch: 0.15 * Math.sin(clamp(s / p.b, 0, 1) * Math.PI)});
    }
}

/** The puffs a pair's act makes now: where (on the ground's level `base`), what, and for how long so far (s). */
export type FxEmitter = {key: string; x: number; y: number; z: number; kind: FxKind; t: number; size: number};

export function reproFx(p: ReproPlan, key: string, s: number, ground: Ground): FxEmitter[] {
    const size = Math.max(p.f.length, p.m.length, 0.2);
    const at = (q: Point, kind: FxKind, t: number, lift = 0): FxEmitter => ({key, x: q.x, y: ground(q.x, q.z) + lift, z: q.z, kind, t, size});
    // (A spawning plume is metres tall in the water, whatever the spawner's size: drawn at least 0.6 m across.)
    const plume = Math.max(size, 0.6);
    if (p.act === "spawn_night" && s >= p.a && s < p.c) return [{...at(p.to.m, "haze", s - p.a, size * 0.5), size: plume}, {...at(p.to.f, "haze", s - p.a, size * 0.5), size: plume}];
    if (p.act === "spawn_pair" && s >= p.b && s < p.c + 6) return [at(p.spot, "eggs", s - p.b), at(p.spot, "milt", s - p.b, size * 0.1)];
    if (p.act === "amplexus" && s >= p.b && s < p.c + 6) return [at(p.spot, "eggs", s - p.b)];
    if (p.act === "pouch" && s >= p.b && s < p.c + 2) return [at(p.spot, "eggs", s - p.b, Math.max(size, 0.15))];
    return [];
}

/**
 * A split: the one parent's young pinched off its body, slowly (`SPLIT_SECONDS`): it begins inside the parent, swells
 * out of its side and comes away a body length off. Pure.
 */
export const SPLIT_SECONDS = 40;
export function splitPose(parent: Point & {yaw: number; length: number}, k: number, s: number, ground: Ground, parentId: string): ActPose {
    const u = ease(s / SPLIT_SECONDS);
    const a = parent.yaw + Math.PI * (0.5 + 0.35 * k);
    const off = parent.length * (0.15 + 0.85 * u);
    const x = parent.x + Math.sin(a) * off;
    const z = parent.z + Math.cos(a) * off;
    return {x, z, base: ground(x, z), yaw: parent.yaw, pitch: 0, roll: 0, scale: 0.55 + 0.45 * u, dim: 0, hidden: false, state: "rest", speed: 0, with: parentId, meal: "resting"};
}

// MARK: The puffs

/** Particles drawn at most (every puff at once). */
export const FX_MOST = 768;
const PER: Record<FxKind, number> = {haze: 64, milt: 28, eggs: 24, fry: 30};
const COLOUR: Record<FxKind, Color> = {haze: new Color("#ffe9f2"), milt: new Color("#f4f6ff"), eggs: new Color("#ffb066"), fry: new Color("#d8f0ff")};
const LIFE: Record<FxKind, number> = {haze: 40, milt: 10, eggs: 18, fry: 20};

function hash01(n: number): number {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
}

/** Where particle `i` of a puff is `t` s after it began (pure: no particle state). */
export function particleAt(e: FxEmitter, i: number, out: {x: number; y: number; z: number}): number {
    const seed = i * 7.31 + e.key.length * 13.7 + (e.key.charCodeAt(e.key.length - 1) || 0);
    const life = LIFE[e.kind];
    // Each particle is let go at its own moment and lives `life` s, then a new one takes its place while the puff lasts.
    const born = hash01(seed) * life;
    const age = ((e.t - born) % life + life) % life;
    if (e.t < born) return 0;
    const u = age / life;
    const r1 = hash01(seed + 1) - 0.5;
    const r2 = hash01(seed + 2) - 0.5;
    const S = e.size;
    if (e.kind === "haze") {
        // Up and out in a slow rising plume, drifting with the current.
        out.x = e.x + r1 * S * (0.3 + 2.4 * u) + u * S * 0.8;
        out.z = e.z + r2 * S * (0.3 + 2.4 * u);
        out.y = e.y + u * S * 4;
    } else if (e.kind === "milt") {
        out.x = e.x + r1 * S * (0.2 + 1.6 * u);
        out.z = e.z + r2 * S * (0.2 + 1.6 * u);
        out.y = e.y + u * S * 0.6;
    } else if (e.kind === "eggs") {
        // Sinking into a small heap at the spot (a redd, a spawn mass, the pouch's mouth).
        const k = Math.min(u * 3, 1);
        out.x = e.x + r1 * S * 0.35;
        out.z = e.z + r2 * S * 0.35;
        out.y = e.y + (1 - k) * S * 0.3 + 0.01;
    } else {
        out.x = e.x + r1 * S * (0.4 + 3 * u);
        out.z = e.z + r2 * S * (0.4 + 3 * u);
        out.y = e.y + hash01(seed + 3) * S * 0.8;
    }
    // Brightest early, gone by its end.
    return (1 - u) * Math.min(age * 2, 1);
}

function dotTexture(): CanvasTexture | null {
    if (typeof document === "undefined") return null;
    const c = document.createElement("canvas");
    c.width = c.height = 32;
    const g = c.getContext("2d");
    if (!g) return null;
    const grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(0.5, "rgba(255,255,255,0.45)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 32, 32);
    return new CanvasTexture(c);
}

/** Every puff in one Points cloud (one draw call); hidden while none is on. */
export class ReproFx {
    readonly points: Points;
    private readonly position = new Float32Array(FX_MOST * 3);
    private readonly colour = new Float32Array(FX_MOST * 3);
    private readonly geometry = new BufferGeometry();
    private readonly p = {x: 0, y: 0, z: 0};

    constructor(scene: Scene) {
        this.geometry.setAttribute("position", new BufferAttribute(this.position, 3));
        this.geometry.setAttribute("color", new BufferAttribute(this.colour, 3));
        this.geometry.setDrawRange(0, 0);
        const map = dotTexture();
        const material = new PointsMaterial({size: 0.1, vertexColors: true, transparent: true, depthWrite: false, blending: AdditiveBlending, sizeAttenuation: true, ...(map ? {map} : {})});
        this.points = new Points(this.geometry, material);
        this.points.frustumCulled = false;
        this.points.visible = false;
        this.points.renderOrder = 3;
        scene.add(this.points);
    }

    /** This frame's puffs. */
    update(emitters: FxEmitter[]): void {
        let n = 0;
        for (const e of emitters) {
            const c = COLOUR[e.kind];
            for (let i = 0; i < PER[e.kind] && n < FX_MOST; i++) {
                const a = particleAt(e, i, this.p);
                if (a <= 0.01) continue;
                this.position[n * 3] = this.p.x;
                this.position[n * 3 + 1] = this.p.y;
                this.position[n * 3 + 2] = this.p.z;
                this.colour[n * 3] = c.r * a;
                this.colour[n * 3 + 1] = c.g * a;
                this.colour[n * 3 + 2] = c.b * a;
                n++;
            }
        }
        this.points.visible = n > 0;
        this.geometry.setDrawRange(0, n);
        if (n) {
            (this.geometry.getAttribute("position") as BufferAttribute).needsUpdate = true;
            (this.geometry.getAttribute("color") as BufferAttribute).needsUpdate = true;
        }
    }

    dispose(): void {
        this.points.removeFromParent();
        this.geometry.dispose();
        (this.points.material as PointsMaterial).map?.dispose();
        (this.points.material as PointsMaterial).dispose();
    }
}
