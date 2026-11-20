/**
 * Riders and hoppers (owner, 2026-11-21: "cat flea's would be good if they hopped like normal fleas and maybe were attached
 * on cats too, any other animals that do this should do that also").
 *
 * Two things, both client-side drawing only (the record, the engine's population and every animal's identity are untouched;
 * this only says where a rider is drawn):
 *
 * - **Hoppers** (`HOPPERS`): a flea or a springtail moves by jumps, never by walking: a fast ballistic arc of about 50-100
 *   times its body length, a pause on the ground, the next jump. With reduced motion it sits still.
 * - **Riders** (`RIDERS`): a parasite or a rider lives on a host of the right kind while one is near: on a point of the
 *   host's body surface (its back, its flank, its belly), worked out each frame from the host's own drawn pose, so it moves
 *   with the host. A flea now and then jumps off onto the ground beside its resting host, hops about, and jumps back on.
 *   With no host near it lives as before (a flea hopping on the ground at its own spot).
 *
 * Shared and pure where it can be: which host (the nearest of the first tier in range, ties by id), where on the body, when
 * a flea jumps off and for how long, and every hop on the ground are functions of the animal's id, the shared clock and
 * where the host is drawn. Only the spot a flea got off at is remembered (the host is where it was then).
 *
 * The host lists (real biology, each cited):
 * - Cat Flea (Ctenocephalides felis): domestic cats first, then dogs. Rust & Dryden 1997, "The biology, ecology, and
 *   management of the cat flea", Annu. Rev. Entomol. 42:451-473 (cats and dogs its main hosts; adults stay on the host);
 *   the catalogue's own row: "adults stay on the host", host group `cats_dogs` (`map/species.json`).
 * - Tick (the catalogue's group entry, Ixodida): land mammals. The map's `mammals` group first (the grazers, horses and
 *   tapirs the catalogue's text names: "roosts of their hosts"), then any other land mammal (`map/body.json` class m).
 *   Sonenshine & Roe 2014, "Biology of Ticks" (2nd ed.), OUP: hard ticks feed on mammals, birds and reptiles.
 * - Cayenne Tick (Amblyomma cajennense s.l.): horses, tapirs and cattle. The catalogue: "adults favour large mammals such
 *   as horses, tapirs and cattle"; Labruna et al. 2011, Exp. Appl. Acarol. 54:13-32 (horses, tapirs, cattle, capybaras).
 * - Chicken Mite (Dermanyssus gallinae): domestic chickens, on the bird only at night (it hides in the hen house's cracks
 *   by day). Sparagano et al. 2014, Annu. Rev. Entomol. 59:447-466; the catalogue: "feeding on birds at night".
 * - Red-billed Oxpecker (Buphagus erythrorynchus): on the back of large grazers (buffalo, giraffe, rhinos, zebras,
 *   wildebeest, cattle; `grazers`). The catalogue: "wherever large mammals such as buffalo, giraffe, rhinos, antelope or
 *   cattle are present"; Stutterheim 1982, Ostrich 53:79-90.
 * - Live Sharksucker (Echeneis naucrates): under sharks, rays and sea turtles (`sharks_rays_turtles`). The catalogue:
 *   "Remoras can attach to sharks"; O'Toole 2002, Rev. Fish Biol. Fish. 11:257-262 (Echeneis on sharks, rays, turtles).
 * Not riders here: the catalogue's "Louse" is a group entry with no host (lice are each host-specific), and the Head Louse
 * is held (its host is a human, never aboard). The Cattle Egret walks beside its grazers as before (`beside`).
 *
 * The hops (Cat Flea): Cadiergues et al. 2000, Vet. Parasitol. 92:239-241: C. felis jumps 19.9 cm long and 13.2 cm high
 * on average (2-3 mm long: about 70 body lengths). Springtails (Collembola) jump with their furca, up to about 100 body
 * lengths (Christian 1978, Pedobiologia 18:107-112).
 */

import {bodyOf, hostSlugId, isHost} from "@/ark-scene/map/species";
import type {HostGroup} from "@/ark-scene/map/tags";
import {unit} from "@/lib/ark-clock";

export type RiderSurface = "fur" | "back" | "belly";

export type RiderSpec = {
    /** The host tiers in order: the first tier with one in range wins (a cat over a dog for a cat flea). */
    tiers: ReadonlyArray<HostRule>;
    /** Where on the host's body: anywhere over the back and upper flanks (fur), on its back (a bird standing), under its belly. */
    on: RiderSurface;
    /** How far (m) from its own spot a host may be for it to be on it; null: the placed host only (the map's riders). */
    range: number | null;
    /** On its host only at night (a chicken mite). */
    night?: boolean;
    /** Now and then off its resting host and back (a flea). */
    excursions?: boolean;
};

/** A host tier: one of the map's host groups, or a body class (`map/body.json`, m: mammal), or a slug list. */
export type HostRule = {group?: HostGroup; slugs?: readonly string[]; body?: "m"; landOnly?: boolean};

const CAT = ["domestic-cat"];
const DOG = ["domestic-dog"];

/** The riders by model slug (cited above). */
export const RIDERS: Readonly<Record<string, RiderSpec>> = {
    "cat-flea": {tiers: [{slugs: CAT}, {slugs: DOG}], on: "fur", range: 25, excursions: true},
    tick: {tiers: [{group: "mammals"}, {body: "m", landOnly: true}], on: "fur", range: 40},
    "cayenne-tick": {tiers: [{group: "horses_tapirs_cattle"}], on: "fur", range: 40},
    "chicken-mite": {tiers: [{group: "birds"}], on: "fur", range: 15, night: true},
    "red-billed-oxpecker": {tiers: [{group: "grazers"}], on: "back", range: null},
    "live-sharksucker": {tiers: [{group: "sharks_rays_turtles"}], on: "belly", range: null}
};

/** Jumpers by model slug: fleas and springtails (not the water flea, Daphnia, which swims). */
export const HOPPERS: ReadonlySet<string> = new Set(["cat-flea", "globular-springtail"]);

export function riderOf(slug: string): RiderSpec | null {
    return RIDERS[slug] ?? null;
}

export function hops(slug: string): boolean {
    return HOPPERS.has(slug);
}

/**
 * Which tier of this rider's hosts an animal is (0 the first), or -1 for none. A breed counts as its kind (a Maine Coon is
 * a domestic cat: its kind's species id, `hostSlugId`); `water`: it is in the water now.
 */
export function hostTier(spec: RiderSpec, host: {slug: string; kindId?: string | null; speciesId: string; water?: boolean}): number {
    for (let i = 0; i < spec.tiers.length; i++) {
        const rule = spec.tiers[i];
        if (rule.slugs) {
            if (rule.slugs.some((slug) => slug === host.slug || (host.kindId && hostSlugId(slug) === host.kindId))) return i;
            continue;
        }
        if (rule.group) {
            if (isHost(rule.group, host.slug, host.kindId, host.speciesId)) return i;
            continue;
        }
        if (rule.body) {
            if (rule.landOnly && host.water) continue;
            if (bodyOf(host.slug) === rule.body) return i;
        }
    }
    return -1;
}

export type Candidate = {id: string; tier: number; x: number; y: number; z: number};

/**
 * The host it rides: the first tier with one within `range` of its own spot (3D, so a flea in a garden never rides a cat
 * in a flat ten storeys up), the nearest of that tier, ties by id. `current` keeps its host while that one is still in
 * range and of the best tier (no hopping between two cats as they pass).
 */
export function chooseHost(home: {x: number; y: number; z: number}, range: number, candidates: readonly Candidate[], current: string | null): string | null {
    let best: Candidate | null = null;
    let bestD = Infinity;
    let keep: Candidate | null = null;
    for (const c of candidates) {
        const d = Math.hypot(c.x - home.x, (c.y - home.y) * 2, c.z - home.z);
        if (d > range) continue;
        if (c.id === current) keep = c;
        if (!best || c.tier < best.tier || (c.tier === best.tier && (d < bestD || (d === bestD && c.id < best.id)))) {
            best = c;
            bestD = d;
        }
    }
    if (keep && best && keep.tier <= best.tier) return keep.id;
    return best ? best.id : null;
}

/** A host as drawn now: its feet's point, its up and its head's way, its size, and how far it is lying down (0…1). */
export type HostFrame = {
    x: number; y: number; z: number;
    /** Up (its back's way) and forward (its head's way), unit. */
    nx: number; ny: number; nz: number;
    tx: number; ty: number; tz: number;
    length: number;
    height: number;
    /** Half its width (m). */
    radius: number;
    /** b bird, f fish, other: a mammal's or a reptile's trunk. */
    body: string | null;
    /** 0 standing … 1 lying down asleep. */
    rest: number;
};

export type Surface = {x: number; y: number; z: number; nx: number; ny: number; nz: number; tx: number; ty: number; tz: number};

/**
 * Its trunk as an ellipsoid in the host's frame (m): the middle's height over its feet, and the half-lengths along, up and
 * across. A standing quadruped's trunk is over its legs (its back at about 0.85 of its height); lying down it is on the
 * ground. A bird's body is round over its legs; a fish's whole body is the trunk.
 */
export function trunkOf(host: Pick<HostFrame, "length" | "height" | "radius" | "body" | "rest">): {mid: number; a: number; b: number; c: number} {
    const h = host.height;
    if (host.body === "f") return {mid: h * 0.5, a: host.length * 0.42, b: h * 0.42, c: Math.max(host.radius * 0.95, h * 0.2)};
    if (host.body === "b") return {mid: h * 0.5, a: host.length * 0.3, b: h * 0.2, c: host.radius * 0.9};
    const b = h * 0.2;
    const standing = h * 0.64;
    const lying = b * 1.1;
    return {mid: standing + (lying - standing) * Math.min(Math.max(host.rest, 0), 1), a: host.length * 0.34, b, c: host.radius * 0.92};
}

/**
 * Its spot on the host: along the trunk (s, -1 tail … 1 head) and round it from the top (phi, 0 the spine, ±π/2 the
 * flanks, π the belly), its own by id; a flea or a tick creeps a little about it as time goes (`time`, 0 with reduced
 * motion). Fleas keep to the back, neck and rump, ticks a little lower on the flanks (both mostly where the host cannot
 * groom: the neck and the base of the tail; Rust & Dryden 1997).
 */
export function spotOf(id: string, on: RiderSurface, time: number): {s: number; phi: number} {
    const u = unit(id, "ride-s");
    const v = unit(id, "ride-phi") * 2 - 1;
    if (on === "back") return {s: -0.15 + u * 0.35, phi: v * 0.12};
    if (on === "belly") return {s: -0.1 + u * 0.35, phi: Math.PI + v * 0.25};
    const creep = time ? Math.sin(time / (9 + 7 * u) + u * 40) : 0;
    const roll = time ? Math.sin(time / (13 + 5 * u) + v * 30) : 0;
    return {s: Math.min(Math.max(-0.75 + u * 1.45 + 0.08 * creep, -0.8), 0.78), phi: v * 1.15 + 0.12 * roll};
}

/** The point on the host's trunk for a spot, its outward normal and a way along it (the host's forward, laid on the fur). */
export function hostSurface(host: HostFrame, spot: {s: number; phi: number}, out: Surface = {x: 0, y: 0, z: 0, nx: 0, ny: 1, nz: 0, tx: 0, ty: 0, tz: 1}): Surface {
    const {mid, a, b, c} = trunkOf(host);
    // Its frame: up n, forward t, side = t × n (its right).
    const nx = host.nx, ny = host.ny, nz = host.nz;
    const tx = host.tx, ty = host.ty, tz = host.tz;
    const sx = ty * nz - tz * ny;
    const sy = tz * nx - tx * nz;
    const sz = tx * ny - ty * nx;
    const s = Math.min(Math.max(spot.s, -0.98), 0.98);
    const r = Math.sqrt(1 - s * s);
    const cu = Math.cos(spot.phi) * r;
    const cs = Math.sin(spot.phi) * r;
    const lf = a * s, lu = b * cu, ls = c * cs;
    out.x = host.x + nx * (mid + lu) + tx * lf + sx * ls;
    out.y = host.y + ny * (mid + lu) + ty * lf + sy * ls;
    out.z = host.z + nz * (mid + lu) + tz * lf + sz * ls;
    // The normal: the gradient of the ellipsoid (s/a, cu/b, cs/c) in its frame.
    const gf = s / a, gu = cu / b, gs = cs / c;
    let gx = tx * gf + nx * gu + sx * gs;
    let gy = ty * gf + ny * gu + sy * gs;
    let gz = tz * gf + nz * gu + sz * gs;
    const gl = Math.hypot(gx, gy, gz) || 1;
    gx /= gl;
    gy /= gl;
    gz /= gl;
    out.nx = gx;
    out.ny = gy;
    out.nz = gz;
    // Forward laid on the surface (t minus its part along the normal).
    const along = tx * gx + ty * gy + tz * gz;
    let fx = tx - gx * along;
    let fy = ty - gy * along;
    let fz = tz - gz * along;
    const fl = Math.hypot(fx, fy, fz);
    if (fl < 1e-6) {
        fx = nx;
        fy = ny;
        fz = nz;
    } else {
        fx /= fl;
        fy /= fl;
        fz /= fl;
    }
    out.tx = fx;
    out.ty = fy;
    out.tz = fz;
    return out;
}

/** g (m/s²): the arcs are real ballistic jumps. */
export const GRAVITY = 9.81;

/** A jump's length in body lengths: 50…100 (the flea's mean is about 70: Cadiergues et al. 2000). */
export const HOP_MIN_BODIES = 50;
export const HOP_MAX_BODIES = 100;
/** The rest on the ground between hops (s). */
export const HOP_PAUSE: readonly [number, number] = [0.9, 3.2];
/** The apex over the higher end, as a share of the jump's length (13.2 cm over 19.9 cm for C. felis). */
export const HOP_APEX = 0.66;
/** The ground hops stay within this many hop lengths of their middle. */
const HOP_RING = 0.55;

/** How long a jump of this length and apex is in the air (s): up to the apex and down from it under g. */
export function hopFlight(length: number, rise = 0): number {
    const apex = Math.max(length * HOP_APEX, 0.002);
    const up = apex + Math.max(rise, 0);
    const down = apex + Math.max(-rise, 0);
    return Math.sqrt((2 * up) / GRAVITY) + Math.sqrt((2 * down) / GRAVITY);
}

/** A point of a ballistic arc from `a` to `b` at share `u` of its flight: straight across, a parabola up (apex over the higher end). */
export function hopArc(a: {x: number; y: number; z: number}, b: {x: number; y: number; z: number}, u: number, out: {x: number; y: number; z: number} = {x: 0, y: 0, z: 0}): {x: number; y: number; z: number} {
    const k = Math.min(Math.max(u, 0), 1);
    const across = Math.hypot(b.x - a.x, b.z - a.z);
    const apex = Math.max(across * HOP_APEX, 0.002);
    // A parabola through (0, a.y) and (1, b.y) whose top is `apex` over the higher end: y = a.y + p k − q k².
    const top = Math.max(a.y, b.y) + apex;
    // Solve for the vertex k0 in (0, 1): (top − a.y) = q k0², (top − b.y) = q (1 − k0)².
    const ra = Math.sqrt(top - a.y);
    const rb = Math.sqrt(top - b.y);
    const k0 = ra / (ra + rb);
    const q = (top - a.y) / (k0 * k0);
    out.x = a.x + (b.x - a.x) * k;
    out.z = a.z + (b.z - a.z) * k;
    out.y = top - q * (k - k0) * (k - k0);
    return out;
}

export type GroundHop = {
    /** Where it is (its feet), its heading (unit, flat). */
    x: number; y: number; z: number; hx: number; hz: number;
    /** In the air now (0…1 of its flight), or -1 on the ground. */
    air: number;
    /** The hop's index (a new one each jump). */
    n: number;
};

/** The hops' points about a middle: on a loose ring, each a hop's length from the last (a star round the middle). */
function hopPoint(id: string, n: number, bodyLength: number, mid: {x: number; z: number}): {x: number; z: number} {
    // A hop of length d between two points on a ring of radius R turns Δ = 2 asin(d / 2R).
    // (Pure in n: the turn per hop is fixed per animal, for a mean hop of 75 body lengths; each point is jittered on its own.)
    const ring = HOP_RING * bodyLength * (HOP_MIN_BODIES + HOP_MAX_BODIES) * 0.5 * 1.25;
    const mean = 2 * Math.asin(Math.min((bodyLength * 75) / (2 * ring), 0.999));
    const angle = unit(id, "hop-start") * Math.PI * 2 + n * mean * (unit(id, "hop-dir") < 0.5 ? 1 : -1) + (unit(id, "hop-j", n) - 0.5) * 0.5;
    const r = ring * (0.85 + 0.3 * unit(id, "hop-r", n));
    return {x: mid.x + Math.cos(angle) * r, z: mid.z + Math.sin(angle) * r};
}

/**
 * On the ground, hopping about a middle: where it is at `t` (s since `t0`), pure in its id and the time. A hop, a pause,
 * the next hop; its body lengths fix how far each one is. `groundAt` gives the ground's height (contact on landing).
 * `phase` (0…1 of a cycle) where it is in its first cycle at t = 0 (0: at the start of a pause, just landed); its own by default.
 */
export function groundHop(id: string, mid: {x: number; z: number}, bodyLength: number, t: number, groundAt: (x: number, z: number) => number, out?: GroundHop, phase?: number): GroundHop {
    const o = out ?? {x: 0, y: 0, z: 0, hx: 0, hz: 1, air: -1, n: 0};
    const L = Math.max(bodyLength, 0.0005);
    // The cycle: a pause then a flight; flights are about 0.3 s, pauses its own (unit by hop index).
    const flight = hopFlight(L * 75);
    const pauseMean = (HOP_PAUSE[0] + HOP_PAUSE[1]) / 2;
    const cycle = pauseMean + flight;
    const tt = Math.max(t, 0) + (phase ?? unit(id, "hop-phase")) * cycle;
    const n = Math.floor(tt / cycle);
    const into = tt - n * cycle;
    // This cycle's pause, varied (the flight takes the rest of it, so the cycles stay even and pure in t).
    const pause = Math.min(HOP_PAUSE[0] + (HOP_PAUSE[1] - HOP_PAUSE[0]) * unit(id, "hop-pause", n), cycle - flight);
    const from = hopPoint(id, n, L, mid);
    const to = hopPoint(id, n + 1, L, mid);
    const fy = groundAt(from.x, from.z);
    const ty = groundAt(to.x, to.z);
    let dx = to.x - from.x;
    let dz = to.z - from.z;
    const dl = Math.hypot(dx, dz) || 1;
    dx /= dl;
    dz /= dl;
    o.n = n;
    o.hx = dx;
    o.hz = dz;
    if (into < pause) {
        o.x = from.x;
        o.y = fy;
        o.z = from.z;
        o.air = -1;
        return o;
    }
    const f = hopFlight(dl, ty - fy);
    const u = Math.min((into - pause) / Math.max(f, 1e-3), 1);
    if (u >= 1) {
        o.x = to.x;
        o.y = ty;
        o.z = to.z;
        o.air = -1;
        return o;
    }
    hopArc({x: from.x, y: fy, z: from.z}, {x: to.x, y: ty, z: to.z}, u, o);
    o.air = u;
    return o;
}

/** A flea's time off its host: in each slot of `EXCURSION_SLOT` s, now and then, for a while. */
export const EXCURSION_SLOT = 150;
export const EXCURSION_SHARE = 0.4;
export const EXCURSION_SECONDS: readonly [number, number] = [14, 40];

/** When (s, shared clock) this slot's time off begins and ends, or null if it stays on in this slot. */
export function excursionAt(id: string, clock: number): {start: number; end: number} | null {
    const slot = Math.floor(clock / EXCURSION_SLOT);
    if (unit(id, "off", slot) >= EXCURSION_SHARE) return null;
    const length = EXCURSION_SECONDS[0] + (EXCURSION_SECONDS[1] - EXCURSION_SECONDS[0]) * unit(id, "off-len", slot);
    const start = slot * EXCURSION_SLOT + (EXCURSION_SLOT - length - 5) * unit(id, "off-at", slot);
    return {start, end: start + length};
}

/** Night for a night feeder (a chicken mite on its bird): 20:00 to 05:00. */
export function nightNow(hours: number): boolean {
    const h = ((hours % 24) + 24) % 24;
    return h >= 20 || h < 5;
}
