/**
 * Ant colonies and their trails (lane ARK-ANTS; owner 2026-11-23: "do ants make trails yet"). Pure: every number here
 * is a function of the colony (its members' ids), the real food the engine has, and the shared clock, so every viewer
 * sees the same trail, the same ants on it and the same lost ant at the same moment. Drawing is `ant-draw.ts`.
 *
 * The rule (owner, 2026-11-23, "no fake events"): a trail only ever leads to REAL food:
 * - a body the record says died (`live-deaths.ts`: it lies `DEATH_BODY_SECONDS`), for the kinds whose own text says they
 *   take dead insects or carrion;
 * - real sap-sucking Ark animals (aphids, scale insects, treehoppers…) for the kinds whose text says they tend them;
 * - plants (leafcutters' leaves, harvesters' seeds) only while the engine has the colony fed (its condition is not
 *   `hungry`): the leaf carried home is the engine's meal, narrated.
 * With none of these the colony only searches round its nest: no "found food", no trail, no line. Behaviour without
 * an outcome is fine: walking, a trail fading, an ant that gets lost, a raindrop breaking the trail, rivals meeting.
 *
 * As a colony flow (docs/ark/behaviour-flows.md, lane ARK-FLOWS' grammar): `colonySteps` gives the tick's steps
 * search · [found(server) · recruit · stream · fade]* with `server: true` on the step the record decided (the body,
 * the hosts, the fed day). The trail's strength and every worker's place are closed forms of the clock (no state).
 */

import kindsJson from "@/ark-scene/ants/ant-kinds.json";

export type AntForm = "trail" | "column" | "leafcut" | "harvest" | "solo" | "homing";
export type NestKind = "hole" | "dome" | "mound" | "crater" | "cleared" | "leafnest" | "trunk" | "twig" | "bivouac";

export type AntKind = {
    slug: string;
    form: AntForm;
    nest: NestKind;
    trunk: boolean;
    weave: boolean;
    carrion: boolean;
    guards: boolean;
    swarm: boolean;
    honeydew: readonly string[];
    plants: "leaves" | "seeds" | null;
    /** How far its foragers go (m). */
    reach: number;
    /** Walking speed (m/s). */
    speed: number;
    /** A worker's length (m, the true-scale table). */
    length: number;
    /** Head and thorax, gaster (0xRRGGBB). */
    front: number;
    back: number;
    raised: boolean;
};

type RawKind = {form: string; nest: string; trunk?: boolean; weave?: boolean; carrion?: boolean; guards?: boolean; swarm?: boolean; honeydew?: string[]; plants?: string | null; reach?: number; speed?: number; length?: number; colour?: number[]; raised?: boolean};
const RAW = (kindsJson as unknown as {kinds: Record<string, RawKind>}).kinds;

const KINDS = new Map<string, AntKind>();
for (const [slug, k] of Object.entries(RAW)) {
    if (k.form === "none") continue;
    KINDS.set(slug, {
        slug, form: k.form as AntForm, nest: k.nest as NestKind, trunk: Boolean(k.trunk), weave: Boolean(k.weave), carrion: Boolean(k.carrion), guards: Boolean(k.guards), swarm: Boolean(k.swarm),
        honeydew: k.honeydew ?? [], plants: (k.plants as AntKind["plants"]) ?? null, reach: k.reach ?? 5, speed: k.speed ?? 0.03, length: k.length ?? 0.005,
        front: k.colour?.[0] ?? 0x2a1d14, back: k.colour?.[2] ?? 0x2a1d14, raised: Boolean(k.raised)
    });
}

/** A colony ant kind (one that lives as a colony and forages), or null (velvet ants, the mantis, anything else). */
export function antKindOf(slug: string | null | undefined): AntKind | null {
    return (slug && KINDS.get(slug)) || null;
}

export function antKinds(): AntKind[] {
    return Array.from(KINDS.values());
}

// MARK: Seeds (fast, integer)

export function seedOf(text: string): number {
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) {
        h ^= text.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}

/** A unit in [0, 1) from a seed and two integers. */
export function u01(seed: number, a: number, b = 0): number {
    let h = (seed ^ Math.imul(a | 0, 0x9e3779b1) ^ Math.imul(b | 0, 0x85ebca77)) >>> 0;
    h = Math.imul(h ^ (h >>> 16), 0x7feb352d);
    h = Math.imul(h ^ (h >>> 15), 0x846ca68b);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
}

// MARK: Colonies

export type Pt = {x: number; y: number; z: number};

export type Colony = {
    key: string;
    kind: AntKind;
    /** The Ark ants of this colony (sorted ids): their names, their card. */
    members: readonly string[];
    name: string;
    speciesId: string;
    zone: string;
    nest: Pt;
    /** A nest up a tree (weaver ants' leaf nest, carpenter ants in a trunk): the trunk under it. */
    trunk: {cx: number; cz: number; r: number} | null;
    /** Weaver ants: their tree's crown (`weaverCanopy`): the leaf nests and the branch ways they forage along. */
    canopy?: Canopy | null;
    seed: number;
    /** The engine has it hungry (its condition): no plant forage is narrated. */
    hungry: boolean;
};

/** Real food the engine has, at a place. */
export type AntFood = {
    key: string;
    kind: "carcass" | "honeydew" | "plant";
    x: number;
    y: number;
    z: number;
    /** On a trunk (a sap-sucker up a tree, a leafcutters' plant): climbed from its foot. */
    trunk?: {cx: number; cz: number; r: number} | null;
    /** Epoch s it is there from, and until (the body's time; ±Infinity for hosts and plants). */
    from: number;
    until: number;
    /** What it is ("Field Cricket"): the log's words. */
    label: string;
    /** A honeydew host's kind (its slug). */
    host?: string;
};

/** Which colonies the record's ants form: one per kind and place (island, zone, area); held ants (a tank, a house) none. */
export function colonyKeyOf(slug: string, island: string | null | undefined, zone: string, area: string | null | undefined, container: string | null | undefined): string | null {
    if (container || !antKindOf(slug)) return null;
    return `${slug}|${island ?? "-"}|${zone}|${area ?? "-"}`;
}

/** Whether a food is one this kind takes (its own text: dead insects or carrion; the hosts it tends; its plants). */
export function eats(kind: AntKind, food: Pick<AntFood, "kind" | "label" | "host">, hungry: boolean): boolean {
    if (food.kind === "carcass") return kind.carrion;
    if (food.kind === "honeydew") return Boolean(food.host) && tendsHost(kind, food.host!);
    return Boolean(kind.plants) && !hungry;
}

/** A sap-sucking Ark animal this kind tends (its slug names one of the kind's hosts). */
export function tendsHost(kind: AntKind, hostSlug: string): boolean {
    return kind.honeydew.some((h) => hostSlug.includes(h));
}

// MARK: Timing (scene seconds; the Ark's clock is about 26x: an Ark hour is about 2.3 real minutes)

/** How long finding a food takes, at most (s, at the edge of its reach). */
export const FIND_SECONDS = 150;
/** Recruitment: the trail's strength rises over this after the finder is home (s). */
export const RISE_SECONDS = 90;
/** It fades over this once the food has run out (s). */
export const FADE_SECONDS = 120;

/** When the colony's searchers come on a food (or Infinity: never, gone first or out of reach). */
export function foundAt(colony: Colony, food: AntFood): number {
    const d = Math.hypot(food.x - colony.nest.x, food.z - colony.nest.z);
    if (d > colony.kind.reach) return Infinity;
    if (!Number.isFinite(food.from)) return -Infinity;
    const at = food.from + 10 + FIND_SECONDS * (0.25 + 0.75 * d / colony.kind.reach) * (0.6 + 0.8 * u01(colony.seed ^ seedOf(food.key), 1));
    return at < food.until ? at : Infinity;
}

export type TrailPhase = "forming" | "busy" | "fading";

export type TrailPlan = {
    food: AntFood;
    found: number;
    /** The finder is home: recruitment starts (found + the way home at its speed). */
    home: number;
    /** 0..1 now. */
    strength: number;
    phase: TrailPhase;
    /** The food is still there (ants coming home carry it). */
    stocked: boolean;
};

/** The colony's trail now: the first real food it found that is not yet faded, or null (only searching). */
export function trailNow(colony: Colony, foods: readonly AntFood[], epoch: number): TrailPlan | null {
    if (colony.kind.form === "solo" || colony.kind.form === "homing" || colony.kind.form === "harvest") return null;
    let best: TrailPlan | null = null;
    for (const food of foods) {
        if (!eats(colony.kind, food, colony.hungry)) continue;
        if (colony.kind.form === "leafcut" && food.kind !== "plant") continue;
        const found = foundAt(colony, food);
        if (!(found <= epoch) || epoch > food.until + FADE_SECONDS) continue;
        const d = Math.hypot(food.x - colony.nest.x, food.z - colony.nest.z) + (food.y - colony.nest.y > 0 ? food.y - colony.nest.y : 0);
        const home = Number.isFinite(found) ? found + d / colony.kind.speed : -Infinity;
        const rise = epoch <= home ? 0.05 : Math.min(1, 0.05 + (epoch - home) / RISE_SECONDS);
        const fade = epoch <= food.until ? 1 : Math.max(0, 1 - (epoch - food.until) / FADE_SECONDS);
        const strength = rise * fade;
        if (strength <= 0) continue;
        const phase: TrailPhase = epoch > food.until ? "fading" : rise < 1 ? "forming" : "busy";
        const plan = {food, found, home, strength, phase, stocked: epoch <= food.until};
        // (The earliest found wins: one trail a colony; ties by key, the same for every viewer.)
        if (!best || plan.found < best.found || (plan.found === best.found && food.key < best.food.key)) best = plan;
    }
    return best;
}

// MARK: Army ants (column form): a raid a day from the bivouac, and the bivouac moved at its end

/** The engine's tick (the Ark day, `ARK_DAY_MS` of the shared clock) in seconds: the flows' tick. */
export const ANT_TICK_SECONDS = (86_400 * 14) / 365;

export type Raid = {tick: number; bivouac: Pt; next: Pt; heading: number; front: number; width: number; moving: number};

/** Where the bivouac is on a tick (a seeded walk within its reach of the colony's place). */
export function bivouacAt(colony: Colony, tick: number): {x: number; z: number} {
    const r = colony.kind.reach * 0.5 * Math.sqrt(u01(colony.seed, tick, 7));
    const a = u01(colony.seed, tick, 8) * Math.PI * 2;
    return {x: colony.nest.x + Math.cos(a) * r, z: colony.nest.z + Math.sin(a) * r};
}

/**
 * The raid now: the swarm front's distance from the bivouac (m), its width, its heading (toward a real body in reach
 * when there is one, else seeded), and `moving` (0..1, the emigration at the tick's end; 0 before it).
 */
export function raidNow(colony: Colony, foods: readonly AntFood[], epoch: number, groundY: (x: number, z: number) => number): Raid {
    const tick = Math.floor(epoch / ANT_TICK_SECONDS);
    const u = epoch / ANT_TICK_SECONDS - tick;
    const b = bivouacAt(colony, tick);
    const n = bivouacAt(colony, tick + 1);
    let heading = u01(colony.seed, tick, 9) * Math.PI * 2;
    let reach = colony.kind.reach * (0.6 + 0.4 * u01(colony.seed, tick, 10));
    for (const food of foods) {
        if (food.kind !== "carcass" || food.from > epoch || food.until < epoch) continue;
        const d = Math.hypot(food.x - b.x, food.z - b.z);
        if (d <= colony.kind.reach) {
            heading = Math.atan2(food.z - b.z, food.x - b.x);
            reach = d;
            break;
        }
    }
    // Out over the first 65% of the day, held, then the column draws back while the last 15% is the move.
    const front = u < 0.65 ? reach * (u / 0.65) : u < 0.85 ? reach : reach * (1 - (u - 0.85) / 0.15);
    const width = Math.min(front * 0.5, colony.kind.reach * 0.25) + 0.05;
    const moving = u < 0.85 ? 0 : (u - 0.85) / 0.15;
    return {tick, bivouac: {x: b.x, y: groundY(b.x, b.z), z: b.z}, next: {x: n.x, y: groundY(n.x, n.z), z: n.z}, heading, front, width, moving};
}

// MARK: The colony flow (lane ARK-FLOWS' step grammar)

export type ColonyStepKind = "search" | "found" | "recruit" | "stream" | "fade" | "raid" | "column" | "emigrate" | "carryLeaves" | "carrySeeds" | "weave" | "tend" | "rest";
export type ColonyStep = {kind: ColonyStepKind; from: number; to: number; pose: "moving" | "still"; food?: string; detail?: string; server?: true};

/** The colony's steps through one engine tick, in order (narration; the server's are marked). */
export function colonySteps(colony: Colony, foods: readonly AntFood[], tick: number, awake: (epoch: number) => boolean): ColonyStep[] {
    const start = tick * ANT_TICK_SECONDS;
    const end = start + ANT_TICK_SECONDS;
    const steps: ColonyStep[] = [];
    const push = (s: ColonyStep) => {
        if (s.to > s.from) steps.push(s);
    };
    if (colony.kind.form === "column") {
        push({kind: "raid", from: start, to: start + ANT_TICK_SECONDS * 0.65, pose: "moving"});
        push({kind: "column", from: start + ANT_TICK_SECONDS * 0.65, to: start + ANT_TICK_SECONDS * 0.85, pose: "moving"});
        push({kind: "emigrate", from: start + ANT_TICK_SECONDS * 0.85, to: end, pose: "moving"});
        return steps;
    }
    // Plants, hosts and bodies by when they are found; searching in the gaps.
    const found = foods
        .filter((f) => eats(colony.kind, f, colony.hungry))
        .map((f) => ({f, at: Math.max(foundAt(colony, f), start)}))
        .filter((x) => x.at < end && x.f.until + FADE_SECONDS > start)
        .sort((a, b) => a.at - b.at || (a.f.key < b.f.key ? -1 : 1));
    let t = start;
    for (const {f, at} of found) {
        if (at < t) continue;
        push({kind: awake(t) ? "search" : "rest", from: t, to: at, pose: "moving"});
        const solo = colony.kind.form === "solo" || colony.kind.form === "homing" || colony.kind.form === "harvest";
        const until = Math.min(end, f.until + FADE_SECONDS);
        if (f.kind === "plant") {
            push({kind: colony.kind.plants === "seeds" ? "carrySeeds" : "carryLeaves", from: at, to: Math.min(end, f.until), pose: "moving", food: f.label, server: true});
        } else if (f.kind === "honeydew") {
            push({kind: "tend", from: at, to: Math.min(end, f.until), pose: "moving", food: f.label, server: true});
        } else {
            push({kind: "found", from: at, to: Math.min(at + 5, until), pose: "still", food: f.label, server: true});
            if (!solo) {
                const d = Math.hypot(f.x - colony.nest.x, f.z - colony.nest.z);
                const home = at + d / colony.kind.speed;
                push({kind: "recruit", from: at + 5, to: Math.min(home + RISE_SECONDS, f.until, end), pose: "moving", food: f.label});
                push({kind: "stream", from: Math.min(home + RISE_SECONDS, f.until, end), to: Math.min(f.until, end), pose: "moving", food: f.label});
                push({kind: "fade", from: Math.min(f.until, end), to: until, pose: "moving", food: f.label});
            }
        }
        t = Math.max(t, until);
        if (t >= end) break;
    }
    if (t < end) push({kind: awake(t) ? "search" : "rest", from: t, to: end, pose: "moving"});
    if (colony.kind.weave) steps.push({kind: "weave", from: start, to: end, pose: "still", detail: "leaf nest"});
    return steps;
}

// MARK: Workers (closed form: where each drawn ant is now)

/** One drawn ant: where, its heading (unit tangent), its up (the surface's normal), its size and what it carries. */
export type AntLoad = 0 | 1 | 2 | 3 | 4;
export const LOAD_NONE = 0, LOAD_LEAF = 1, LOAD_SEED = 2, LOAD_PIECE = 3, LOAD_BROOD = 4;

export type AntSink = (x: number, y: number, z: number, tx: number, ty: number, tz: number, ux: number, uy: number, uz: number, scale: number, load: AntLoad, front: number, back: number) => boolean;

/** A path sampled at even steps: positions, normals, cumulative length. */
export type Path = {n: number; p: Float32Array; nrm: Float32Array; s: Float32Array; length: number};

/** At distance `s` along the path: position into `o` [x,y,z,tx,ty,tz,nx,ny,nz]. */
export function pathAt(path: Path, s: number, o: Float32Array): void {
    const n = path.n;
    const clamped = Math.min(Math.max(s, 0), path.length);
    let lo = 0;
    let hi = n - 1;
    while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (path.s[mid] <= clamped) lo = mid;
        else hi = mid;
    }
    const span = path.s[hi] - path.s[lo] || 1;
    const k = (clamped - path.s[lo]) / span;
    const a = lo * 3;
    const b = hi * 3;
    for (let i = 0; i < 3; i++) {
        o[i] = path.p[a + i] + (path.p[b + i] - path.p[a + i]) * k;
        o[6 + i] = path.nrm[a + i] + (path.nrm[b + i] - path.nrm[a + i]) * k;
    }
    const tx = path.p[b] - path.p[a];
    const ty = path.p[b + 1] - path.p[a + 1];
    const tz = path.p[b + 2] - path.p[a + 2];
    const l = Math.hypot(tx, ty, tz) || 1;
    o[3] = tx / l;
    o[4] = ty / l;
    o[5] = tz / l;
}

/**
 * The trail's path from the nest to the food: down the nest's trunk (a tree nest), over the ground with a gentle
 * seeded meander, up the food's trunk (a host or a plant in a tree). Sampled every couple of centimetres (at most 600).
 */
export function trailPath(colony: Colony, food: Pick<AntFood, "x" | "y" | "z" | "key" | "trunk">, groundY: (x: number, z: number) => number): Path {
    const pts: number[] = [];
    const nrm: number[] = [];
    const seed = colony.seed ^ seedOf(food.key);
    const climb = (trunk: {cx: number; cz: number; r: number}, toward: {x: number; z: number}, top: number, down: boolean) => {
        const a = Math.atan2(toward.z - trunk.cz, toward.x - trunk.cx);
        const nx = Math.cos(a);
        const nz = Math.sin(a);
        const x = trunk.cx + nx * (trunk.r + 0.003);
        const z = trunk.cz + nz * (trunk.r + 0.003);
        const foot = groundY(x, z);
        const steps = Math.max(2, Math.min(80, Math.ceil((top - foot) / 0.03)));
        for (let i = 0; i <= steps; i++) {
            const k = down ? 1 - i / steps : i / steps;
            pts.push(x, foot + (top - foot) * k, z);
            nrm.push(nx, 0, nz);
        }
        return {x: x + nx * 0.01, z: z + nz * 0.01};
    };
    let from = {x: colony.nest.x, z: colony.nest.z};
    const canopy = colony.canopy ?? null;
    const up = food.trunk && food.y > groundY(food.x, food.z) + 0.05 ? food.trunk : null;
    if (canopy) {
        // Weaver ants: from the leaf nest in along its limb to the trunk, round it to the food's side.
        const way = canopy.ways[canopy.nests[0]];
        branchWalk(canopy, way, false, pts, nrm);
        const a0 = wayAngle(canopy, way);
        if (up && sameTrunk(up, canopy.trunk)) {
            // A host on the nest's own tree: along the trunk to it, never down to the ground and up again.
            trunkWalk(canopy.trunk, a0, way.y, Math.atan2(food.z - up.cz, food.x - up.cx), food.y, pts, nrm);
            return finishPath(pts, nrm);
        }
        const a1 = Math.atan2(food.z - canopy.trunk.cz, food.x - canopy.trunk.cx);
        trunkWalk(canopy.trunk, a0, way.y, a1, way.y - Math.min(0.15, way.y - groundY(colony.nest.x, colony.nest.z)), pts, nrm);
        from = climb(canopy.trunk, {x: food.x, z: food.z}, way.y - 0.15, true);
    } else if (colony.trunk && colony.nest.y > groundY(colony.nest.x, colony.nest.z) + 0.05) from = climb(colony.trunk, {x: food.x, z: food.z}, colony.nest.y, true);
    let to = {x: food.x, z: food.z};
    if (up) {
        const a = Math.atan2(from.z - up.cz, from.x - up.cx);
        to = {x: up.cx + Math.cos(a) * (up.r + 0.013), z: up.cz + Math.sin(a) * (up.r + 0.013)};
    }
    const dx = to.x - from.x;
    const dz = to.z - from.z;
    const d = Math.hypot(dx, dz);
    const steps = Math.max(2, Math.min(500, Math.ceil(d / 0.02)));
    const px = -dz / (d || 1);
    const pz = dx / (d || 1);
    const amp = Math.min(d * 0.08, 0.6);
    const w1 = 1 + Math.floor(u01(seed, 1) * 3);
    const w2 = 3 + Math.floor(u01(seed, 2) * 4);
    const p1 = u01(seed, 3) * 6.283;
    for (let i = 0; i <= steps; i++) {
        const k = i / steps;
        const bend = Math.sin(Math.PI * k) * (amp * Math.sin(w1 * Math.PI * k + p1) + amp * 0.3 * Math.sin(w2 * Math.PI * k));
        const x = from.x + dx * k + px * bend;
        const z = from.z + dz * k + pz * bend;
        // (A leafcutters' highway is cleared of litter: its floor is drawn over the litter, the ants on it.)
        pts.push(x, groundY(x, z) + (colony.kind.form === "leafcut" ? 0.005 : 0.0005), z);
        nrm.push(0, 1, 0);
    }
    if (up) climb(up, from, food.y, false);
    return finishPath(pts, nrm);
}

function finishPath(pts: number[], nrm: number[]): Path {
    const n = pts.length / 3;
    const s = new Float32Array(n);
    for (let i = 1; i < n; i++) s[i] = s[i - 1] + Math.hypot(pts[i * 3] - pts[i * 3 - 3], pts[i * 3 + 1] - pts[i * 3 - 2], pts[i * 3 + 2] - pts[i * 3 - 1]);
    return {n, p: new Float32Array(pts), nrm: new Float32Array(nrm), s, length: s[n - 1]};
}

// MARK: Weaver ants in the crown

/**
 * Weaver ants (Oecophylla) live and forage in the crown: one colony holds many leaf nests over its trees, joined by
 * trails along the branches, and its workers patrol the branches and leaves for prey and honeydew (Hölldobler & Wilson
 * 1990, *The Ants*; the Field Guide: "Their nests are built in vegetation rather than underground"). Here: the drawn
 * tree's own branch and leaf places (`canopyPoints`), each a way out along a branch from the trunk to a leaf; its leaf
 * nests on a few of them.
 */
export type CanopyWay = {to: Pt; /** Where its limb leaves the trunk (m, world height). */ y: number; /** A leaf it reaches on past the limb (a twig's hop), when one is near. */ leaf: Pt | null};
export type Canopy = {trunk: {cx: number; cz: number; r: number}; foot: number; ways: CanopyWay[]; /** The nests' ways (the first the colony's main nest). */ nests: number[]};

/** The crown's places as the host gives them: its drawn branch and leaf places; `wood` on the drawn wood (a limb's top). */
export type CanopyPoint = {x: number; y: number; z: number; leaf: boolean; wood: boolean};

/** The colony's crown on its tree (seeded), or null where its tree has too few places up in it. */
export function weaverCanopy(seed: number, trunk: {cx: number; cz: number; r: number}, foot: number, points: readonly CanopyPoint[]): Canopy | null {
    const inCrown = (p: CanopyPoint) => {
        const d = Math.hypot(p.x - trunk.cx, p.z - trunk.cz);
        return p.y > foot + 1 && d > trunk.r + 0.15 && d < 6;
    };
    const up = points.filter(inCrown);
    // The ways go out along the drawn limbs (their places are on the wood); a tree with too few, along its branches.
    const wood = up.filter((p) => p.wood);
    const bases = wood.length >= 3 ? wood : up.filter((p) => !p.leaf).length >= 3 ? up.filter((p) => !p.leaf) : up;
    if (bases.length < 3) return null;
    const leaves = up.filter((p) => p.leaf);
    // Seeded order; no two ways end within 25 cm.
    const order = bases.map((p, i) => ({p, k: u01(seed, i, 61)})).sort((a, b) => a.k - b.k).map((o) => o.p);
    const ends: CanopyPoint[] = [];
    for (const p of order) {
        if (ends.length >= 28) break;
        if (ends.some((e) => Math.hypot(e.x - p.x, e.y - p.y, e.z - p.z) < 0.25)) continue;
        ends.push(p);
    }
    const ways: CanopyWay[] = ends.map((p) => {
        const d = Math.hypot(p.x - trunk.cx, p.z - trunk.cz) - trunk.r;
        let leaf: Pt | null = null;
        let best = 1.5;
        for (const l of leaves) {
            const dl = Math.hypot(l.x - p.x, l.y - p.y, l.z - p.z);
            // (Further out than the limb's place, not back toward the trunk.)
            if (dl < best && Math.hypot(l.x - trunk.cx, l.z - trunk.cz) > d) {
                best = dl;
                leaf = {x: l.x, y: l.y, z: l.z};
            }
        }
        // (A limb rises a little as it leaves the trunk: it left a little lower down.)
        return {to: {x: p.x, y: p.y, z: p.z}, y: Math.min(p.y, Math.max(foot + 0.6, p.y - 0.15 * d)), leaf};
    });
    // The nests: at a way's leaf (its leaves pulled together) where there is one, low enough in the crown to be seen
    // (1.2 to 4.5 m up), a metre apart; up to 3.
    const nests: number[] = [];
    const nestAt = (w: CanopyWay) => w.leaf ?? w.to;
    for (const pass of [0, 1, 2]) {
        ways.forEach((w, i) => {
            const at = nestAt(w);
            if (nests.length >= 3 || nests.includes(i)) return;
            if (pass === 0 && !(w.leaf && at.y < foot + 4.5 && at.y > foot + 1.2)) return;
            if (pass === 1 && !w.leaf) return;
            if (nests.some((n) => Math.hypot(nestAt(ways[n]).x - at.x, nestAt(ways[n]).y - at.y, nestAt(ways[n]).z - at.z) < 0.9)) return;
            nests.push(i);
        });
    }
    return {trunk, foot, ways, nests};
}

/** Where a nest is: its way's leaf, else the limb's place. */
export const canopyNest = (canopy: Canopy, k: number): Pt => canopy.ways[canopy.nests[k]].leaf ?? canopy.ways[canopy.nests[k]].to;

const sameTrunk = (a: {cx: number; cz: number}, b: {cx: number; cz: number}) => Math.hypot(a.cx - b.cx, a.cz - b.cz) < 0.05;
const wayAngle = (canopy: Canopy, way: CanopyWay) => Math.atan2(way.to.z - canopy.trunk.cz, way.to.x - canopy.trunk.cx);

/** Round and along the trunk from (a0, y0) to (a1, y1), on its bark, the shorter way round. */
function trunkWalk(trunk: {cx: number; cz: number; r: number}, a0: number, y0: number, a1: number, y1: number, pts: number[], nrm: number[]): void {
    let da = a1 - a0;
    while (da > Math.PI) da -= Math.PI * 2;
    while (da < -Math.PI) da += Math.PI * 2;
    const steps = Math.max(2, Math.min(160, Math.ceil(Math.hypot(da * trunk.r, y1 - y0) / 0.03)));
    for (let i = 0; i <= steps; i++) {
        const k = i / steps;
        const a = a0 + da * k;
        const nx = Math.cos(a);
        const nz = Math.sin(a);
        pts.push(trunk.cx + nx * (trunk.r + 0.003), y0 + (y1 - y0) * k, trunk.cz + nz * (trunk.r + 0.003));
        nrm.push(nx, 0, nz);
    }
}

/** A way's corners: off the trunk at its limb's foot, the limb's place, its leaf. */
function wayCorners(canopy: Canopy, way: CanopyWay): Pt[] {
    const a = wayAngle(canopy, way);
    const base = {x: canopy.trunk.cx + Math.cos(a) * (canopy.trunk.r + 0.003), y: way.y, z: canopy.trunk.cz + Math.sin(a) * (canopy.trunk.r + 0.003)};
    return way.leaf ? [base, way.to, way.leaf] : [base, way.to];
}

/** At `k` (0..1) of the way along its corners: the point, the unit way on. */
function wayAt(corners: readonly Pt[], k: number): {x: number; y: number; z: number; tx: number; ty: number; tz: number} {
    let total = 0;
    for (let i = 1; i < corners.length; i++) total += Math.hypot(corners[i].x - corners[i - 1].x, corners[i].y - corners[i - 1].y, corners[i].z - corners[i - 1].z);
    let left = Math.min(Math.max(k, 0), 1) * total;
    for (let i = 1; i < corners.length; i++) {
        const a = corners[i - 1];
        const b = corners[i];
        const l = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z) || 1e-6;
        if (left <= l || i === corners.length - 1) {
            const f = Math.min(left / l, 1);
            return {x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, z: a.z + (b.z - a.z) * f, tx: (b.x - a.x) / l, ty: (b.y - a.y) / l, tz: (b.z - a.z) / l};
        }
        left -= l;
    }
    const c = corners[0];
    return {x: c.x, y: c.y, z: c.z, tx: 1, ty: 0, tz: 0};
}

/** Along a way: out from the trunk along its limb to its leaf, or in (on its top: the ants' up is the world's). */
function branchWalk(canopy: Canopy, way: CanopyWay, out: boolean, pts: number[], nrm: number[]): void {
    const corners = wayCorners(canopy, way);
    let L = 0;
    for (let i = 1; i < corners.length; i++) L += Math.hypot(corners[i].x - corners[i - 1].x, corners[i].y - corners[i - 1].y, corners[i].z - corners[i - 1].z);
    const steps = Math.max(2, Math.min(240, Math.ceil(L / 0.02)));
    for (let i = 0; i <= steps; i++) {
        const p = wayAt(corners, out ? i / steps : 1 - i / steps);
        pts.push(p.x, p.y + 0.004, p.z);
        nrm.push(0, 1, 0);
    }
}

/** The trail between two leaf nests: in along one's branch, along the trunk, out along the other's. */
export function nestTrailPath(canopy: Canopy, a: number, b: number): Path {
    const pts: number[] = [];
    const nrm: number[] = [];
    const wa = canopy.ways[a];
    const wb = canopy.ways[b];
    branchWalk(canopy, wa, false, pts, nrm);
    trunkWalk(canopy.trunk, wayAngle(canopy, wa), wa.y, wayAngle(canopy, wb), wb.y, pts, nrm);
    branchWalk(canopy, wb, true, pts, nrm);
    return finishPath(pts, nrm);
}

/** A trail between nests as a trail plan: always there, steady, nothing carried along it. */
export function nestTrailPlan(key: string, at: Pt): TrailPlan {
    return {food: {key, kind: "honeydew", x: at.x, y: at.y, z: at.z, from: -Infinity, until: Infinity, label: "nest"}, found: -Infinity, home: -Infinity, strength: 0.6, phase: "busy", stocked: false};
}

/**
 * Weaver ant searchers in the crown: each out along a branch from the trunk toward its leaf and back, a seeded way a
 * trip, winding a little across the branch; none on the ground. Searching only: no food, no load.
 */
export function canopySearchers(colony: Colony, canopy: Canopy, epoch: number, awake: boolean, count: number, view: View, sink: AntSink): number {
    const kind = colony.kind;
    const ways = canopy.ways;
    let drawn = 0;
    const r2 = view.r * view.r;
    for (let j = 0; j < count; j++) {
        // (Asleep: only on the nests' own branches, near the nest.)
        const pick = (cycle: number) => (awake ? Math.floor(u01(colony.seed, j, cycle + 1000) * ways.length) : canopy.nests[j % canopy.nests.length]);
        const span = 1.6 / kind.speed + 8;
        const period = span * (0.6 + 0.8 * u01(colony.seed, j, 1));
        const t = epoch + u01(colony.seed, j, 2) * period;
        const cycle = Math.floor(t / period);
        const u = t / period - cycle;
        const way = ways[pick(cycle) % ways.length];
        const corners = wayCorners(canopy, way);
        // Out from the trunk along the limb toward its leaf and back in (asleep: a few close round the nest's leaf).
        const reach = awake ? 0.35 + 0.65 * Math.sqrt(u01(colony.seed, j, cycle + 2000)) : 0.12;
        const k = awake ? reach * Math.sin(Math.PI * u) : 1 - reach * (0.5 + 0.5 * Math.sin(u * 6.283 + j));
        const at = wayAt(corners, k);
        if ((at.x - view.x) ** 2 + (at.z - view.z) ** 2 > r2) continue;
        const dir = awake ? (u < 0.5 ? 1 : -1) : 1;
        let tx = at.tx * dir;
        const ty = at.ty * dir;
        let tz = at.tz * dir;
        // Winding across the limb (its side: square to it, level).
        const sx = -tz;
        const sz = tx;
        const sl = Math.hypot(sx, sz) || 1;
        const w = Math.sin(k * 90 + j * 1.7) * kind.length * 1.2;
        const turn = Math.cos(k * 90 + j * 1.7) * 0.5;
        const c = Math.cos(turn);
        const sn = Math.sin(turn);
        const ntx = tx * c - tz * sn;
        tz = tx * sn + tz * c;
        tx = ntx;
        const x = at.x + (sx / sl) * w;
        const z = at.z + (sz / sl) * w;
        const y = at.y + 0.004;
        if (!sink(x, y, z, tx, ty, tz, 0, 1, 0, kind.length, LOAD_NONE, kind.front, kind.back)) return drawn;
        drawn++;
    }
    return drawn;
}

const O = new Float32Array(9);
const O2 = new Float32Array(9);

/** What the ants near a point look like now: the view the sink is filled for. */
export type View = {x: number; z: number; r: number};

/** A disturbance on the trail: a raindrop (seeded, while it rains) or an animal's foot (now). */
export type Disturb = {x: number; z: number; r: number; age: number};

/** The raindrops that hit a trail lately (seeded by the trail and the clock): where along it and how long ago. */
export function raindrops(seed: number, length: number, rain: number, epoch: number, out: Array<{s: number; age: number}>): void {
    out.length = 0;
    if (rain < 0.2 || length <= 0) return;
    const every = 14 / rain;
    const k = Math.floor(epoch / every);
    for (let j = k - 2; j <= k; j++) {
        const age = epoch - j * every;
        if (age < 0 || age > 25) continue;
        out.push({s: u01(seed, j, 77) * length, age});
    }
}

const drops: Array<{s: number; age: number}> = [];

/**
 * The workers on a trail, both ways: out along one lane, home along the other (carrying while the food lasts). Ant
 * `j` of a lane is at `(j·gap + v·t) mod 2L`; its trip (`cycle`) is shown when its seeded draw is under the trail's
 * strength at the trip's start, so the trail thickens as it is reinforced and thins as it fades. Only the ants within
 * `view` are visited. A few step off and come back (lost); near a raindrop or a foot they mill, then pick it up again.
 */
export function trailWorkers(colony: Colony, plan: TrailPlan, path: Path, epoch: number, view: View, rain: number, feet: readonly Disturb[], sink: AntSink): number {
    const kind = colony.kind;
    const L = path.length;
    if (L <= 0) return 0;
    const v = kind.speed * (kind.form === "leafcut" ? 0.8 : 1);
    const gap = kind.length * (kind.form === "column" ? 1.6 : kind.form === "leafcut" ? 3 : 3.5);
    const loop = 2 * L;
    const slots = Math.max(1, Math.floor(loop / gap));
    const g = loop / slots;
    const shift = (v * epoch) % loop;
    const lane = kind.length * (kind.form === "leafcut" ? 1.2 : 0.9);
    const seed = colony.seed ^ seedOf(plan.food.key);
    raindrops(seed, L, rain, epoch, drops);
    // Which stretches of the path are in view (by its samples).
    let drawn = 0;
    const r2 = view.r * view.r;
    let i = 0;
    while (i < path.n) {
        while (i < path.n && (path.p[i * 3] - view.x) ** 2 + (path.p[i * 3 + 2] - view.z) ** 2 > r2) i++;
        if (i >= path.n) break;
        const s0 = path.s[Math.max(i - 1, 0)];
        while (i < path.n && (path.p[i * 3] - view.x) ** 2 + (path.p[i * 3 + 2] - view.z) ** 2 <= r2) i++;
        const s1 = path.s[Math.min(i, path.n - 1)];
        // Both lanes over [s0, s1]: outbound at s, home at 2L - s.
        for (let home = 0; home < 2; home++) {
            const a = home ? loop - s1 : s0;
            const b = home ? loop - s0 : s1;
            const first = Math.ceil((a - shift) / g);
            const last = Math.floor((b - shift) / g);
            for (let m = first; m <= last; m++) {
                const raw = m * g + shift;
                const j = ((m % slots) + slots) % slots;
                const cycle = Math.floor((j * g + v * epoch) / loop);
                // The trip started when it left the nest: (cycle·2L + j·g - shift)/v ago… its draw against the strength then.
                const r = u01(seed, j, cycle);
                const started = epoch - (raw - Math.floor(raw / loop) * loop) / v;
                const strengthThen = startStrength(plan, started);
                // (Never every slot: a real trail is irregular, bunched here and gappy there.)
                if (r >= strengthThen * 0.8) continue;
                const along = raw - Math.floor(raw / loop) * loop;
                const s = home ? loop - along : along;
                pathAt(path, s + (u01(seed, j, 3) - 0.5) * g * 1.4, O);
                // Lateral: its lane, a wobble, lost ants, milling at a drop or a foot.
                let side = (home ? -1 : 1) * lane + Math.sin(s * 40 + j) * lane * 0.4;
                let mill = 0;
                if (u01(seed, j, cycle * 3 + 1) < 0.025) {
                    const at = u01(seed, j, cycle * 3 + 2) * L;
                    const k = (s - at) / Math.max(kind.length * 30, 0.04);
                    if (k > -1 && k < 1) side += (home ? -1 : 1) * Math.cos(k * Math.PI * 0.5) ** 2 * kind.length * (10 + 10 * u01(seed, j, 5));
                }
                for (const d of drops) {
                    const near = Math.abs(s - d.s);
                    const r0 = Math.max(0.025, kind.length * 6);
                    if (near < r0) mill = Math.max(mill, (1 - near / r0) * (1 - d.age / 25));
                }
                for (const f of feet) {
                    const dd = Math.hypot(O[0] - f.x, O[2] - f.z);
                    if (dd < f.r) mill = Math.max(mill, 1 - dd / f.r);
                }
                if (mill > 0) {
                    // (Mills round, its heading turned: it has lost the scent there and casts about for it.)
                    side += (u01(seed, j, cycle + 11) - 0.5) * kind.length * 14 * mill;
                    const turn = (u01(seed, j, cycle + 12) - 0.5) * Math.PI * 2 * mill;
                    const c = Math.cos(turn);
                    const sn = Math.sin(turn);
                    const tx = O[3] * c - O[5] * sn;
                    const tz = O[3] * sn + O[5] * c;
                    O[3] = tx;
                    O[5] = tz;
                }
                // Side is across the path on the surface: tangent × normal.
                const cx = O[4] * O[8] - O[5] * O[7];
                const cy = O[5] * O[6] - O[3] * O[8];
                const cz = O[3] * O[7] - O[4] * O[6];
                const x = O[0] + cx * side;
                const y = O[1] + cy * side;
                const z = O[2] + cz * side;
                const dir = home ? -1 : 1;
                const carry: AntLoad = home && started + L / v <= plan.food.until && plan.food.kind !== "honeydew" ? (kind.form === "leafcut" ? LOAD_LEAF : kind.plants === "seeds" ? LOAD_SEED : plan.food.kind === "carcass" ? LOAD_PIECE : LOAD_NONE) : LOAD_NONE;
                const size = 0.75 + 0.5 * u01(seed, j, 9);
                if (!sink(x, y, z, O[3] * dir, O[4] * dir, O[5] * dir, O[6], O[7], O[8], kind.length * (kind.form === "leafcut" || kind.form === "column" ? size : 0.9 + 0.2 * size), carry, kind.front, kind.back)) return drawn;
                drawn++;
            }
        }
    }
    // A driver ant column's soldiers along its edges, jaws out (its own text).
    if (kind.guards && plan.stocked) drawn += guards(colony, path, view, epoch, sink);
    return drawn;
}

function startStrength(plan: TrailPlan, t: number): number {
    if (t < plan.found) return 0;
    // The finder alone on its way home (it lays the trail as it goes): one ant.
    if (t < plan.home) return 0;
    const rise = Math.min(1, 0.05 + (t - plan.home) / RISE_SECONDS);
    const fade = t <= plan.food.until ? 1 : Math.max(0, 1 - (t - plan.food.until) / FADE_SECONDS);
    return rise * fade;
}

/** The finder coming home along the new trail (laying it): where it is now, or null. */
export function finderAt(plan: TrailPlan, path: Path, epoch: number, speed: number, o: Float32Array): boolean {
    if (epoch < plan.found || epoch > plan.home) return false;
    const s = path.length - (epoch - plan.found) * speed;
    if (s < 0) return false;
    pathAt(path, s, o);
    o[3] = -o[3];
    o[4] = -o[4];
    o[5] = -o[5];
    return true;
}

function guards(colony: Colony, path: Path, view: View, epoch: number, sink: AntSink): number {
    const kind = colony.kind;
    let n = 0;
    const every = kind.length * 6;
    for (let s = 0; s < path.length; s += every) {
        pathAt(path, s, O2);
        if ((O2[0] - view.x) ** 2 + (O2[2] - view.z) ** 2 > view.r * view.r) continue;
        const j = Math.round(s / every);
        const side = (j % 2 ? 1 : -1) * kind.length * 3.2;
        const cx = O2[4] * O2[8] - O2[5] * O2[7];
        const cz = O2[3] * O2[7] - O2[4] * O2[6];
        const sway = Math.sin(epoch * 2 + j) * 0.15;
        const ox = cx * (j % 2 ? 1 : -1);
        const oz = cz * (j % 2 ? 1 : -1);
        if (!sink(O2[0] + cx * side, O2[1], O2[2] + cz * side, ox * Math.cos(sway) - oz * Math.sin(sway), 0, ox * Math.sin(sway) + oz * Math.cos(sway), 0, 1, 0, kind.length * 1.5, LOAD_NONE, kind.front, kind.back)) break;
        n++;
    }
    return n;
}

/**
 * The searchers round the nest: each walks a winding loop out and back (`homing`: winding out, straight home, its own
 * text), a seeded heading and range a trip. No food, no load: searching is behaviour without an outcome. `count` is
 * how many are out (the drawing's tier); nocturnal kinds by day and diurnal ones by night keep close to the nest.
 */
export function searchers(colony: Colony, epoch: number, awake: boolean, count: number, view: View, groundY: (x: number, z: number) => number, sink: AntSink, carry?: {load: AntLoad; foodX: number; foodZ: number} | null): number {
    const kind = colony.kind;
    const range = Math.min(kind.reach, awake ? Math.max(0.25, kind.reach * 0.35) : kind.length * 30);
    let drawn = 0;
    const r2 = (view.r + range) ** 2;
    if ((colony.nest.x - view.x) ** 2 + (colony.nest.z - view.z) ** 2 > r2) return 0;
    for (let j = 0; j < count; j++) {
        const period = (2.2 * range * (0.4 + 0.6 * u01(colony.seed, j, 1))) / kind.speed + 6;
        const t = epoch + u01(colony.seed, j, 2) * period;
        const cycle = Math.floor(t / period);
        const u = t / period - cycle;
        const heading = u01(colony.seed, j, cycle + 1000) * Math.PI * 2;
        const far = range * (0.25 + 0.75 * Math.sqrt(u01(colony.seed, j, cycle + 2000)));
        const at = (w: number, o: number[]) => {
            let rho: number;
            let a: number;
            if (kind.form === "homing") {
                // Winding out for 70% of the trip; then straight home.
                if (w < 0.7) {
                    const k = w / 0.7;
                    rho = far * k;
                    a = heading + 0.9 * Math.sin(k * 9 + j) * (1 - k * 0.3);
                } else {
                    const k = (w - 0.7) / 0.3;
                    const ex = far * Math.cos(heading + 0.9 * Math.sin(9 + j) * 0.7);
                    const ez = far * Math.sin(heading + 0.9 * Math.sin(9 + j) * 0.7);
                    o[0] = colony.nest.x + ex * (1 - k);
                    o[1] = colony.nest.z + ez * (1 - k);
                    return;
                }
            } else {
                rho = far * Math.sin(Math.PI * w);
                a = heading + 0.7 * Math.sin(w * 7 + j * 1.7) + (w > 0.5 ? 0.6 : 0);
            }
            o[0] = colony.nest.x + Math.cos(a) * rho;
            o[1] = colony.nest.z + Math.sin(a) * rho;
        };
        const p = [0, 0];
        const q = [0, 0];
        at(u, p);
        if ((p[0] - view.x) ** 2 + (p[1] - view.z) ** 2 > view.r * view.r) continue;
        at(Math.min(u + 0.004, 0.9999), q);
        let tx = q[0] - p[0];
        let tz = q[1] - p[1];
        const l = Math.hypot(tx, tz) || 1;
        tx /= l;
        tz /= l;
        // A solo forager or a harvester on its way home with what the record fed it (seeds), or a piece of a real body.
        const load = carry && u > 0.5 && u01(colony.seed, j, cycle + 3000) < 0.6 ? carry.load : LOAD_NONE;
        if (!sink(p[0], groundY(p[0], p[1]) + 0.0003, p[1], tx, 0, tz, 0, 1, 0, kind.length, load, kind.front, kind.back)) return drawn;
        drawn++;
    }
    return drawn;
}

/** The army ants' raid: the column from the bivouac, the broad swarm at its front, the emigration carrying brood. */
export function raiders(colony: Colony, raid: Raid, epoch: number, view: View, budget: number, groundY: (x: number, z: number) => number, sink: AntSink, carrying: boolean): number {
    const kind = colony.kind;
    let drawn = 0;
    const hx = Math.cos(raid.heading);
    const hz = Math.sin(raid.heading);
    const r2 = view.r * view.r;
    const emit = (x: number, z: number, tx: number, tz: number, load: AntLoad, size: number) => {
        if ((x - view.x) ** 2 + (z - view.z) ** 2 > r2) return true;
        if (drawn >= budget) return false;
        drawn++;
        return sink(x, groundY(x, z) + 0.0004, z, tx, 0, tz, 0, 1, 0, kind.length * size, load, kind.front, kind.back);
    };
    const gap = kind.length * 1.4;
    // The column: out on one side, home on the other (with pieces when the front is on a real body), a few branches.
    // (Only the stretch in view is visited: the view's centre in the raid's own frame, along and across.)
    const along0 = (view.x - raid.bivouac.x) * hx + (view.z - raid.bivouac.z) * hz;
    const across0 = (view.x - raid.bivouac.x) * -hz + (view.z - raid.bivouac.z) * hx;
    if (raid.front > 0.02 && along0 > -view.r && along0 < raid.front + view.r) {
        const n = Math.floor(raid.front / gap);
        const shift = (kind.speed * epoch) % gap;
        const i0 = Math.max(0, Math.floor((along0 - view.r) / gap) - 1);
        const i1 = Math.min(n, Math.ceil((along0 + view.r) / gap) + 1);
        for (let i = i0; i < i1; i++) {
            const s = i * gap + shift;
            const w = Math.sin(s * 3 + colony.seed) * kind.length * 2;
            const px = -hz;
            const pz = hx;
            const home = i % 2 === 1;
            const size = 0.6 + 0.8 * u01(colony.seed, i, 4);
            const along = home ? raid.front - s : s;
            if (!emit(raid.bivouac.x + hx * along + px * (w + (home ? -1 : 1) * kind.length), raid.bivouac.z + hz * along + pz * (w + (home ? -1 : 1) * kind.length), home ? -hx : hx, home ? -hz : hz, home && carrying ? LOAD_PIECE : LOAD_NONE, size)) return drawn;
        }
        // The swarm front: a broad, fan-shaped mass spread across `width`, its leading edge ragged.
        if (kind.swarm || raid.front > 0.3) {
            const across = Math.max(1, Math.floor(raid.width / (kind.length * 1.2)));
            const deep = Math.max(2, Math.floor(Math.min(raid.width * 0.5, 0.6) / (kind.length * 1.4)));
            const a0 = Math.max(0, Math.floor(((across0 - view.r) / raid.width + 0.5) * (across - 1)) - 1);
            const a1 = Math.min(across, Math.ceil(((across0 + view.r) / raid.width + 0.5) * (across - 1)) + 2);
            for (let a = a0; a < a1; a++) {
                for (let d = 0; d < deep; d++) {
                    if (u01(colony.seed, a * 131 + d, raid.tick) > 0.55 * (1 - d / deep) + 0.15) continue;
                    const k = a / Math.max(across - 1, 1) - 0.5;
                    const jit = Math.sin(epoch * 1.3 + a * 2.1 + d) * kind.length * 2;
                    const back = d * kind.length * 1.4 + Math.abs(k) * raid.width * 0.3 + jit;
                    const x = raid.bivouac.x + hx * (raid.front - back) - hz * k * raid.width;
                    const z = raid.bivouac.z + hz * (raid.front - back) + hx * k * raid.width;
                    const turn = Math.sin(epoch * 2 + a + d * 3) * 0.9;
                    if (!emit(x, z, hx * Math.cos(turn) - hz * Math.sin(turn), hz * Math.cos(turn) + hx * Math.sin(turn), LOAD_NONE, 0.6 + 0.8 * u01(colony.seed, a, d))) return drawn;
                }
            }
        }
    }
    // The bivouac itself: a mass of workers clinging over it (each at a seeded place on its dome, stirring).
    {
        const bx = raid.moving > 0.5 ? raid.next.x : raid.bivouac.x;
        const bz = raid.moving > 0.5 ? raid.next.z : raid.bivouac.z;
        const R = 0.12;
        if ((bx - view.x) ** 2 + (bz - view.z) ** 2 < (view.r + R) ** 2) {
            const n = Math.min(900, Math.round((2 * Math.PI * R * R) / (kind.length * kind.length * 0.9)));
            const base = groundY(bx, bz);
            for (let i = 0; i < n; i++) {
                const a = u01(colony.seed, i, 31) * Math.PI * 2;
                const c = Math.sqrt(u01(colony.seed, i, 32));
                const nx = Math.cos(a) * c;
                const nz = Math.sin(a) * c;
                const ny = Math.sqrt(Math.max(0, 1 - c * c));
                const turn = u01(colony.seed, i, 33) * Math.PI * 2 + Math.sin(epoch * 0.7 + i) * 0.3;
                // A tangent on the dome at that point, turned by the ant's own heading.
                const t1x = -Math.sin(a);
                const t1z = Math.cos(a);
                const t2x = -ny * Math.cos(a);
                const t2y = c;
                const t2z = -ny * Math.sin(a);
                const tx = t1x * Math.cos(turn) + t2x * Math.sin(turn);
                const ty = t2y * Math.sin(turn);
                const tz = t1z * Math.cos(turn) + t2z * Math.sin(turn);
                if (drawn >= budget) return drawn;
                drawn++;
                if (!sink(bx + nx * R, base + ny * R * 0.8, bz + nz * R, tx, ty, tz, nx, ny, nz, kind.length * (0.6 + 0.8 * u01(colony.seed, i, 34)), LOAD_NONE, kind.front, kind.back)) return drawn;
            }
        }
    }
    // The emigration: the column to the next bivouac, workers carrying brood (their own larvae and pupae).
    if (raid.moving > 0) {
        const dx = raid.next.x - raid.bivouac.x;
        const dz = raid.next.z - raid.bivouac.z;
        const d = Math.hypot(dx, dz) || 1;
        const n = Math.floor(d / gap);
        const shift = (kind.speed * epoch) % gap;
        for (let i = 0; i < n; i++) {
            const s = i * gap + shift;
            if (s / d > raid.moving * 1.2) break;
            const w = Math.sin(s * 3 + colony.seed) * kind.length * 2;
            if (!emit(raid.bivouac.x + (dx / d) * s - (dz / d) * w, raid.bivouac.z + (dz / d) * s + (dx / d) * w, dx / d, dz / d, i % 3 === 0 ? LOAD_BROOD : LOAD_NONE, 0.6 + 0.8 * u01(colony.seed, i, 6))) return drawn;
        }
    }
    return drawn;
}

/** Rival colonies whose ranges touch: where their edges meet (the midpoint), or null. */
export function rivalEdge(a: Colony, b: Colony): {x: number; z: number; heading: number} | null {
    if (a.key === b.key) return null;
    const d = Math.hypot(a.nest.x - b.nest.x, a.nest.z - b.nest.z);
    const ra = Math.min(a.kind.reach, Math.max(0.25, a.kind.reach * 0.35));
    const rb = Math.min(b.kind.reach, Math.max(0.25, b.kind.reach * 0.35));
    if (d > ra + rb || d < 0.05) return null;
    const k = ra / (ra + rb);
    return {x: a.nest.x + (b.nest.x - a.nest.x) * k, z: a.nest.z + (b.nest.z - a.nest.z) * k, heading: Math.atan2(b.nest.z - a.nest.z, b.nest.x - a.nest.x)};
}

/** A standoff at the edge: a few of each side face each other and feint (visual flavour, never a fight's outcome). */
export function standoff(a: Colony, b: Colony, edge: {x: number; z: number; heading: number}, epoch: number, view: View, groundY: (x: number, z: number) => number, sink: AntSink): number {
    if ((edge.x - view.x) ** 2 + (edge.z - view.z) ** 2 > view.r * view.r) return 0;
    let n = 0;
    const hx = Math.cos(edge.heading);
    const hz = Math.sin(edge.heading);
    for (let i = 0; i < 6; i++) {
        for (const [c, dir] of [[a, 1], [b, -1]] as const) {
            const len = c.kind.length;
            const feint = Math.max(0, Math.sin(epoch * 1.7 + i * 1.3 + (dir > 0 ? 0 : 1.1))) * len * 1.2;
            const back = len * 1.5 + feint * -1 + (i % 2) * len;
            const across = (i - 2.5) * len * 2.2;
            const x = edge.x - hx * dir * back - hz * across;
            const z = edge.z - hz * dir * back + hx * across;
            if (!sink(x, groundY(x, z) + 0.0003, z, hx * dir, 0, hz * dir, 0, 1, 0, len, LOAD_NONE, c.kind.front, c.kind.back)) return n;
            n++;
        }
    }
    return n;
}

/** A weaver ants' chain at the leaf nest: ants end to end bridging two leaf edges, the gap closing over the tick. */
export function weaverChains(colony: Colony, epoch: number, view: View, sink: AntSink): {gap: number} {
    const tick = Math.floor(epoch / ANT_TICK_SECONDS);
    const u = epoch / ANT_TICK_SECONDS - tick;
    const len = colony.kind.length;
    // The leaf edges' gap: from 7 ants long to nearly closed, then the leaves are stitched (larval silk) and a new pull.
    const pull = (u * 4) % 1;
    const links = Math.max(2, Math.round(7 - 5 * pull));
    if ((colony.nest.x - view.x) ** 2 + (colony.nest.z - view.z) ** 2 > (view.r + 0.3) ** 2) return {gap: links * len};
    for (let c = 0; c < 3; c++) {
        const a = u01(colony.seed, c, tick) * Math.PI * 2;
        const ox = colony.nest.x + Math.cos(a) * 0.09;
        const oz = colony.nest.z + Math.sin(a) * 0.09;
        const oy = colony.nest.y + 0.02 + c * 0.02;
        const tx = -Math.sin(a);
        const tz = Math.cos(a);
        for (let i = 0; i < links; i++) {
            const sag = Math.sin((i / Math.max(links - 1, 1)) * Math.PI) * len * 0.6;
            if (!sink(ox + tx * i * len * 0.95, oy - sag, oz + tz * i * len * 0.95, tx, 0, tz, Math.cos(a), 0.4, Math.sin(a), len, LOAD_NONE, colony.kind.front, colony.kind.back)) return {gap: links * len};
        }
    }
    return {gap: links * len};
}
