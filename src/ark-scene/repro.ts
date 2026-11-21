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

import {AdditiveBlending, BufferAttribute, BufferGeometry, CanvasTexture, Color, DodecahedronGeometry, Euler, InstancedMesh, Matrix4, MeshStandardMaterial, NormalBlending, Points, PointsMaterial, Quaternion, Vector3, type Blending, type Scene} from "three";
import type {ActPose} from "@/ark-scene/acts";
import table from "@/ark-scene/reproduction-ways.json";

export type ReproWay = "broadcast" | "brooding" | "spawn_pair" | "amplexus" | "male_pregnancy" | "sessile_copulation" | "spermatophore" | "asexual" | "parthenogenesis";
export type Repro = {way: ReproWay; detail: string | null; guard: "male" | "female" | "both" | "none" | null; also: string | null};
/** How a pair's breeding is acted. */
export type ReproAct = "spawn_night" | "spawn_pair" | "amplexus" | "pouch" | "in_place" | "spermatophore";
/** Puffs (glowing: haze, milt, fry), laid eggs (solid: a sinking heap, a patch on a rock, a toad's strings) and the
 *  rock a clownfish lays on. */
export type FxKind = "haze" | "milt" | "eggs" | "fry" | "patch" | "string" | "rock";

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
export const PAIR = {sweep: 14, release: 12, guard: 30, lay: 32, pass: 8};
export const AMPLEXUS = {clasp: 3, held: 40, spawn: 30};
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
/** A body's height for a pose (the scene's height can be the model's box; never more than half its length here). */
const tall = (b: Body) => Math.min(b.height, b.length * 0.5);

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
        // (On a substrate she lays in passes and he passes over each row after her: longer than a release in open water.)
        const release = laysOn(r.detail) ? PAIR.lay : PAIR.release;
        return {...base, a: walk, b: a, c: a + release, end: a + release + (guard ? PAIR.guard : 20)};
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

/** Eggs laid on something (a rock, a redd's gravel, a nest), in passes, rather than let go into the water. */
export function laysOn(detail: string | null): boolean {
    return detail === "surface" || detail === "redd" || detail === "nest" || detail === null;
}

/** A clownfish's rock (detail "surface"): long, wide and tall (m) for the pair's size, and its top over the ground. */
export function rockOf(p: Pick<ReproPlan, "detail" | "m" | "f">): {long: number; wide: number; tall: number} | null {
    if (p.detail !== "surface") return null;
    const L = Math.max(p.m.length, p.f.length, 0.04);
    return {long: L * 1.9, wide: L * 1.3, tall: L * 0.45};
}

/** Where along the egg patch a laying pass is (-1..1, the patch's two ends) `u` passes in, and which way it goes (+1/-1). */
function passAt(u: number): {along: number; dir: number} {
    const n = Math.floor(u);
    const f = u - n;
    const dir = n % 2 === 0 ? 1 : -1;
    return {along: dir * (-1 + 2 * ease(f)), dir};
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
            const rock = rockOf(p);
            const top = rock ? rock.tall : 0;
            const dir = {x: Math.sin(p.heading), z: Math.cos(p.heading)};
            const side = {x: dir.z, z: -dir.x};
            const patch = rock ? rock.long * 0.32 : Math.max(p.m.length, p.f.length) * 0.5;
            if (laysOn(p.detail) && s >= p.b && s < p.c) {
                // She lays her eggs in rows, pass after pass close over the spot, belly down; he follows a little behind
                // and passes over the same row, releasing his milt over the eggs (decision 440: "fish who sperm on eggs").
                const lag = isM ? 1.6 : 0;
                const u = Math.max(s - p.b - lag, 0) / PAIR.pass;
                const {along, dir: way} = passAt(u);
                const q = {x: p.spot.x + dir.x * along * patch + side.x * (isM ? 0.15 : -0.05) * patch, z: p.spot.z + dir.z * along * patch + side.z * (isM ? 0.15 : -0.05) * patch};
                const yaw = way > 0 ? p.heading : p.heading + Math.PI;
                return pose(q, yaw, "swim", {lift: top + tall(me) * (isM ? 0.75 : 0.35), pitch: isM ? 0 : 0.18, roll: Math.sin(s * 23 + (isM ? 0 : 1)) * 0.1, speed: (patch * 2) / PAIR.pass});
            }
            if (rock && s >= p.c) {
                // He keeps by his eggs on the rock, fanning them with his fins and nipping out the bad ones; she goes.
                const guards = p.guard === "both" || (p.guard === "m" && isM) || (p.guard === "f" && !isM);
                if (!guards) {
                    // (She stays near, in their anemone a little off, while he tends the eggs.)
                    const q = {x: p.spot.x - side.x * rock.wide * 1.4, z: p.spot.z - side.z * rock.wide * 1.4};
                    return pose(q, yawTo(q, p.spot) + Math.sin(s * 0.5) * 0.4, "swim", {lift: top * 0.8 + Math.sin(s * 0.7) * tall(me) * 0.3, speed: 0});
                }
                const q = {x: p.spot.x + side.x * rock.wide * 0.45 + dir.x * Math.sin(s * 0.3) * patch * 0.6, z: p.spot.z + side.z * rock.wide * 0.45 + dir.z * Math.sin(s * 0.3) * patch * 0.6};
                return pose(q, yawTo(q, p.spot), "swim", {lift: top + tall(me) * 0.3, pitch: 0.25 + Math.sin(s * 5) * 0.08, roll: Math.sin(s * 7) * 0.12, speed: 0});
            }
            if (rock && s < p.b) {
                // The builder cleans the rock (nipping it bare, nose down at its top); the other waits beside it.
                if (builds) return pose({x: p.spot.x + dir.x * Math.sin(s * 0.8) * patch, z: p.spot.z + dir.z * Math.sin(s * 0.8) * patch}, p.heading + Math.sin(s * 0.8) * 0.4, "swim", {lift: top + tall(me) * 0.4, pitch: 0.45, speed: 0.02});
                const q = {x: p.spot.x - side.x * rock.wide * 0.9, z: p.spot.z - side.z * rock.wide * 0.9};
                return pose(q, yawTo(q, p.spot), "swim", {lift: top * 0.6, speed: 0});
            }
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
            // He climbs on her back and clasps her behind her forelegs (no rhythm: amplexus is a long hold). Then she
            // walks slowly on with him aboard, laying her eggs in long strings behind her as he fertilises them.
            const walked = amplexusWalk(p, s);
            const at = {x: p.spot.x + Math.sin(p.heading) * walked, z: p.spot.z + Math.cos(p.heading) * walked};
            const moving = s >= p.b && s < p.c;
            if (!isM) return pose(at, p.heading, moving ? "walk" : "rest", {speed: moving ? amplexusTravel(p) / (p.c - p.b) : 0});
            const k = ease((s - p.walk) / AMPLEXUS.clasp);
            const on = {x: at.x - Math.sin(p.heading) * p.f.length * 0.18 * k, z: at.z - Math.cos(p.heading) * p.f.length * 0.18 * k};
            return pose(lerpP(to, on, k), p.heading, "rest", {lift: tall(p.f) * 0.8 * k, pitch: -0.18 * k, roll: moving ? Math.sin(s * 4) * 0.05 : 0});
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

/** How far a toad pair has walked on as she lays (m), `s` into the act. */
function amplexusTravel(p: ReproPlan): number {
    return p.f.length * 2.6;
}
function amplexusWalk(p: ReproPlan, s: number): number {
    return s < p.b ? 0 : amplexusTravel(p) * ease((s - p.b) / (p.c - p.b));
}

/**
 * What a pair's act shows now besides the two: where (on the ground's level), what, and for how long so far (s).
 * `share` is how much of a laying is down (a patch's rows, a string's length); `yaw` and `long` lay a patch, a string
 * or a rock along the act's heading.
 */
export type FxEmitter = {key: string; x: number; y: number; z: number; kind: FxKind; t: number; size: number; share?: number; yaw?: number; long?: number; wide?: number; tall?: number};

export function reproFx(p: ReproPlan, key: string, s: number, ground: Ground): FxEmitter[] {
    const size = Math.max(p.f.length, p.m.length, 0.2);
    const at = (q: Point, kind: FxKind, t: number, lift = 0): FxEmitter => ({key, x: q.x, y: ground(q.x, q.z) + lift, z: q.z, kind, t, size});
    // (A spawning plume is metres tall in the water, whatever the spawner's size: drawn at least 0.6 m across.)
    const plume = Math.max(size, 0.6);
    if (p.act === "spawn_night" && s >= p.a && s < p.c) return [{...at(p.to.m, "haze", s - p.a, size * 0.5), size: plume}, {...at(p.to.f, "haze", s - p.a, size * 0.5), size: plume}];
    if (p.act === "spawn_pair") {
        const out: FxEmitter[] = [];
        const rock = rockOf(p);
        const L = Math.max(p.m.length, p.f.length, 0.04);
        const top = rock ? rock.tall : 0;
        // The rock is there from their arrival to the end (a stone by their anemone); the eggs once she lays, to the end.
        if (rock && s >= p.a - 2) out.push({...at(p.spot, "rock", s), size: L, yaw: p.heading, long: rock.long, wide: rock.wide, tall: rock.tall});
        if (laysOn(p.detail)) {
            const long = rock ? rock.long * 0.64 : L;
            if (s >= p.b) out.push({...at(p.spot, "patch", s - p.b, top), size: L, share: clamp((s - p.b) / (p.c - p.b), 0, 1), yaw: p.heading, long, wide: long * 0.55});
            if (s >= p.b + 1.6 && s < p.c + 3) {
                // His milt, where he is over the eggs now (a small cloud each pass).
                const u = (s - p.b - 1.6) / PAIR.pass;
                const along = passAt(u).along * long * 0.5;
                const q = {x: p.spot.x + Math.sin(p.heading) * along, z: p.spot.z + Math.cos(p.heading) * along};
                out.push({...at(q, "milt", s - p.b, top + L * 0.1), size: L});
            }
        } else if (s >= p.b && s < p.c + 6) {
            out.push(at(p.spot, "eggs", s - p.b), at(p.spot, "milt", s - p.b, size * 0.1));
        }
        return out;
    }
    if (p.act === "amplexus" && s >= p.b) {
        // Two strings of eggs from where she began to where she is (a toad's are metres long; drawn along her walk).
        const walked = amplexusWalk(p, s);
        return [{...at(p.spot, "string", s - p.b), size: p.f.length, share: 1, yaw: p.heading, long: walked}];
    }
    if (p.act === "pouch" && s >= p.b && s < p.c + 2) return [at(p.spot, "eggs", s - p.b, Math.max(size, 0.15))];
    return [];
}

/**
 * A split (transverse fission: a sea cucumber, a sea star's arm, an anemone): the one body pinches in two. The young
 * is its back part: it starts inside the parent's back half, in line with it, so the two read as one long body; the
 * halves twist against each other (each turns its own way, as a fissiparous sea cucumber does), the pinch draws them
 * apart along the body's line, and the back half comes away, turning off its own way, a good half body clear. Slow
 * (`SPLIT_SECONDS`). Pure; `splitParent` is the parent's side of it.
 */
export const SPLIT_SECONDS = 40;
const splitApart = (s: number) => ease((s / SPLIT_SECONDS - 0.2) / 0.8);
const splitTwist = (s: number) => Math.sin(Math.min(s / SPLIT_SECONDS, 1) * Math.PI) * 0.55 * Math.sin(s * 0.7);
export function splitPose(parent: Point & {yaw: number; length: number}, k: number, s: number, ground: Ground, parentId: string): ActPose {
    const u = splitApart(s);
    const L = parent.length;
    // (A second young of one split comes off the front instead.)
    const back = k % 2 === 0 ? -1 : 1;
    const off = L * (0.22 + 0.95 * u) * back;
    const x = parent.x + Math.sin(parent.yaw) * off;
    const z = parent.z + Math.cos(parent.yaw) * off;
    return {x, z, base: ground(x, z), yaw: parent.yaw + u * 0.6 * back, pitch: 0, roll: -splitTwist(s), scale: 0.62, dim: 0, hidden: false, state: "rest", speed: 0, with: parentId, meal: "resting"};
}

/** The parent in a split: it draws forward away from the pinch as the halves twist apart (and stays where it ends). */
export function splitParent(parent: Point & {yaw: number; length: number}, s: number, ground: Ground, youngId?: string): ActPose {
    const u = splitApart(s);
    const off = parent.length * 0.35 * u;
    const x = parent.x + Math.sin(parent.yaw) * off;
    const z = parent.z + Math.cos(parent.yaw) * off;
    return {x, z, base: ground(x, z), yaw: parent.yaw - u * 0.3, pitch: 0, roll: splitTwist(s), scale: 1, dim: 0, hidden: false, state: "rest", speed: 0, meal: s < SPLIT_SECONDS ? "birthing" : "resting", ...(youngId ? {with: youngId} : {})};
}

// MARK: The puffs, the eggs and the rock

/** Particles drawn at most (every puff and laying at once). */
export const FX_MOST = 768;
/** Particles per emitter. A patch is rows of eggs (`PATCH_ROWS` x 16); a string is two strands of eggs, each egg a
 *  dark yolk in a pale jelly (two particles). */
const PATCH_ROWS = 6;
const STRING_EGGS = 48;
const PER: Record<Exclude<FxKind, "rock">, number> = {haze: 64, milt: 28, eggs: 24, fry: 30, patch: PATCH_ROWS * 16, string: STRING_EGGS * 4};
const COLOUR: Record<Exclude<FxKind, "rock">, Color> = {haze: new Color("#ffe9f2"), milt: new Color("#f4f6ff"), eggs: new Color("#ffb066"), fry: new Color("#d8f0ff"), patch: new Color("#ff8a2a"), string: new Color("#20211c")};
const JELLY = new Color("#e6efd8");
const LIFE: Record<"haze" | "milt" | "eggs" | "fry", number> = {haze: 40, milt: 6, eggs: 18, fry: 20};
/** Drawn glowing (added to what is behind) or solid. */
const GLOW = new Set<FxKind>(["haze", "milt", "fry"]);

function hash01(n: number): number {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
}

/** A particle: where, how big (m across), and whether it takes its kind's second colour (a toad egg's jelly). */
export type Particle = {x: number; y: number; z: number; size: number; alt: boolean};

/** Where particle `i` of an emitter is `t` s after it began, and how bright (0: not drawn). Pure: no particle state. */
export function particleAt(e: FxEmitter, i: number, out: Particle): number {
    const seed = i * 7.31 + e.key.length * 13.7 + (e.key.charCodeAt(e.key.length - 1) || 0);
    const r1 = hash01(seed + 1) - 0.5;
    const r2 = hash01(seed + 2) - 0.5;
    const S = e.size;
    out.alt = false;
    if (e.kind === "patch" || e.kind === "string") {
        const yaw = e.yaw ?? 0;
        const dir = {x: Math.sin(yaw), z: Math.cos(yaw)};
        const side = {x: dir.z, z: -dir.x};
        const share = e.share ?? 1;
        let along: number;
        let across: number;
        if (e.kind === "patch") {
            // Rows laid one pass at a time, each a little wider of the last: a tight oval of eggs on the rock's top.
            const row = Math.floor(i / 16);
            const col = i % 16;
            if ((row + col / 16) / PATCH_ROWS >= share) return 0;
            const long = e.long ?? S;
            const wide = e.wide ?? long * 0.5;
            const v = (row + 0.5) / PATCH_ROWS - 0.5;
            const reach = Math.sqrt(Math.max(1 - 4 * v * v, 0.1));
            along = ((col + 0.5) / 16 - 0.5) * long * reach + r1 * long * 0.03;
            across = v * wide + r2 * wide * 0.06;
            out.size = Math.max(S * 0.075, 0.004);
        } else {
            // Two strands from where she began to where she is now, side by side, gently winding; yolk then jelly.
            const egg = Math.floor(i / 4);
            const strand = (i >> 1) & 1;
            const jelly = (i & 1) === 1;
            const f = egg / (STRING_EGGS - 1);
            // (From where she began, along her walk, to just behind her now.)
            along = f * Math.max((e.long ?? 0) - S * 0.35, 0);
            if (e.long !== undefined && e.long < S * 0.05) return 0;
            across = (strand ? 1 : -1) * S * 0.09 + Math.sin(f * 11 + strand * 2.1) * S * 0.12;
            out.alt = jelly;
            out.size = jelly ? Math.max(S * 0.17, 0.008) : Math.max(S * 0.07, 0.004);
        }
        out.x = e.x + dir.x * along + side.x * across;
        out.z = e.z + dir.z * along + side.z * across;
        out.y = e.y + out.size * 0.4;
        return 1;
    }
    const kind = e.kind as keyof typeof LIFE;
    const life = LIFE[kind];
    // Each particle is let go at its own moment and lives `life` s, then a new one takes its place while the puff lasts.
    const born = hash01(seed) * life;
    const age = ((e.t - born) % life + life) % life;
    if (e.t < born) return 0;
    const u = age / life;
    if (kind === "haze") {
        // Up and out in a slow rising plume, drifting with the current.
        out.x = e.x + r1 * S * (0.3 + 2.4 * u) + u * S * 0.8;
        out.z = e.z + r2 * S * (0.3 + 2.4 * u);
        out.y = e.y + u * S * 4;
        out.size = 0.1 * Math.max(S / 0.6, 1);
    } else if (kind === "milt") {
        // A small milky cloud spreading where he is, just over the eggs.
        out.x = e.x + r1 * S * (0.15 + 1.1 * u);
        out.z = e.z + r2 * S * (0.15 + 1.1 * u);
        out.y = e.y + u * S * 0.35;
        out.size = Math.max(S * 0.32, 0.02);
    } else if (kind === "eggs") {
        // Sinking into a small heap at the spot (the pouch's mouth).
        const k = Math.min(u * 3, 1);
        out.x = e.x + r1 * S * 0.35;
        out.z = e.z + r2 * S * 0.35;
        out.y = e.y + (1 - k) * S * 0.3 + 0.01;
        out.size = Math.max(S * 0.1, 0.012);
    } else {
        out.x = e.x + r1 * S * (0.4 + 3 * u);
        out.z = e.z + r2 * S * (0.4 + 3 * u);
        out.y = e.y + hash01(seed + 3) * S * 0.8;
        out.size = Math.max(S * 0.08, 0.012);
    }
    // Brightest early, gone by its end.
    return (1 - u) * Math.min(age * 2, 1);
}

function dotTexture(soft: boolean): CanvasTexture | null {
    if (typeof document === "undefined") return null;
    const c = document.createElement("canvas");
    c.width = c.height = 32;
    const g = c.getContext("2d");
    if (!g) return null;
    const grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(soft ? 0.5 : 0.7, soft ? "rgba(255,255,255,0.45)" : "rgba(255,255,255,0.95)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 32, 32);
    return new CanvasTexture(c);
}

/** One Points cloud whose particles each have their own size in metres (`psize`, scaled with distance as the scene's). */
class Cloud {
    readonly points: Points;
    readonly position = new Float32Array(FX_MOST * 3);
    readonly colour = new Float32Array(FX_MOST * 3);
    readonly size = new Float32Array(FX_MOST);
    readonly geometry = new BufferGeometry();
    n = 0;

    constructor(scene: Scene, blending: Blending, soft: boolean, opacity: number) {
        this.geometry.setAttribute("position", new BufferAttribute(this.position, 3));
        this.geometry.setAttribute("color", new BufferAttribute(this.colour, 3));
        this.geometry.setAttribute("psize", new BufferAttribute(this.size, 1));
        this.geometry.setDrawRange(0, 0);
        const map = dotTexture(soft);
        const material = new PointsMaterial({size: 1, vertexColors: true, transparent: true, opacity, depthWrite: false, blending, sizeAttenuation: true, ...(map ? {map} : {})});
        material.onBeforeCompile = (shader) => {
            shader.vertexShader = "attribute float psize;\n" + shader.vertexShader.replace("gl_PointSize = size;", "gl_PointSize = size * psize;");
        };
        this.points = new Points(this.geometry, material);
        this.points.frustumCulled = false;
        this.points.visible = false;
        this.points.renderOrder = 3;
        scene.add(this.points);
    }

    push(p: Particle, c: Color, a: number, glow: boolean): void {
        if (this.n >= FX_MOST) return;
        const n = this.n++;
        this.position[n * 3] = p.x;
        this.position[n * 3 + 1] = p.y;
        this.position[n * 3 + 2] = p.z;
        // (A glow fades by its colour; a solid egg by its size.)
        const k = glow ? a : 1;
        this.colour[n * 3] = c.r * k;
        this.colour[n * 3 + 1] = c.g * k;
        this.colour[n * 3 + 2] = c.b * k;
        this.size[n] = glow ? p.size : p.size * Math.min(a * 1.5, 1);
    }

    flush(): void {
        this.points.visible = this.n > 0;
        this.geometry.setDrawRange(0, this.n);
        if (this.n) for (const name of ["position", "color", "psize"]) (this.geometry.getAttribute(name) as BufferAttribute).needsUpdate = true;
    }

    dispose(): void {
        this.points.removeFromParent();
        this.geometry.dispose();
        (this.points.material as PointsMaterial).map?.dispose();
        (this.points.material as PointsMaterial).dispose();
    }
}

/** Rocks drawn at most at once (a clownfish pair's laying stone). */
const ROCKS_MOST = 6;

/** Every puff in one glowing cloud, every laid egg in one solid cloud, the rocks in one instanced mesh: at most three
 *  draw calls, each hidden while it has nothing. */
export class ReproFx {
    private readonly glow: Cloud;
    private readonly solid: Cloud;
    private readonly rocks: InstancedMesh;
    private readonly p: Particle = {x: 0, y: 0, z: 0, size: 0, alt: false};
    private readonly m = new Matrix4();
    private readonly q = new Quaternion();
    private readonly e = new Euler();
    private readonly v = new Vector3();
    private readonly sc = new Vector3();

    constructor(scene: Scene) {
        this.glow = new Cloud(scene, AdditiveBlending, true, 1);
        this.solid = new Cloud(scene, NormalBlending, false, 0.95);
        const rock = new DodecahedronGeometry(0.5, 1);
        // (A worn stone: flattened a little unevenly, so the dodecahedron does not read as a ball.)
        const pos = rock.getAttribute("position") as BufferAttribute;
        for (let i = 0; i < pos.count; i++) pos.setY(i, pos.getY(i) * (0.85 + 0.3 * hash01(i * 3.7)));
        rock.computeVertexNormals();
        this.rocks = new InstancedMesh(rock, new MeshStandardMaterial({color: "#8a7f72", roughness: 1, metalness: 0, flatShading: true}), ROCKS_MOST);
        this.rocks.count = 0;
        this.rocks.visible = false;
        this.rocks.frustumCulled = false;
        scene.add(this.rocks);
    }

    /** Whether anything is drawn now. */
    get visible(): boolean {
        return this.glow.points.visible || this.solid.points.visible || this.rocks.visible;
    }

    /** This frame's emitters. */
    update(emitters: FxEmitter[]): void {
        this.glow.n = 0;
        this.solid.n = 0;
        let rocks = 0;
        for (const e of emitters) {
            if (e.kind === "rock") {
                if (rocks >= ROCKS_MOST) continue;
                // (Sunk a little into the ground, its top at `tall`.)
                const tall = e.tall ?? e.size * 0.4;
                this.v.set(e.x, e.y + tall * 0.42, e.z);
                this.q.setFromEuler(this.e.set(0, e.yaw ?? 0, 0));
                this.sc.set(e.wide ?? e.size, tall * 1.15, e.long ?? e.size);
                this.rocks.setMatrixAt(rocks++, this.m.compose(this.v, this.q, this.sc));
                continue;
            }
            const glow = GLOW.has(e.kind);
            const cloud = glow ? this.glow : this.solid;
            const c = COLOUR[e.kind];
            for (let i = 0; i < PER[e.kind] && cloud.n < FX_MOST; i++) {
                const a = particleAt(e, i, this.p);
                if (a <= 0.01) continue;
                cloud.push(this.p, this.p.alt ? JELLY : c, a, glow);
            }
        }
        this.glow.flush();
        this.solid.flush();
        this.rocks.count = rocks;
        this.rocks.visible = rocks > 0;
        if (rocks) this.rocks.instanceMatrix.needsUpdate = true;
    }

    dispose(): void {
        this.glow.dispose();
        this.solid.dispose();
        this.rocks.removeFromParent();
        this.rocks.geometry.dispose();
        (this.rocks.material as MeshStandardMaterial).dispose();
    }
}
