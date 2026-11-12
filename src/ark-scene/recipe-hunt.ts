/**
 * The quarry: the one ambient creature a hunting recipe goes after (the owner's "no chases between predators and
 * prey", motion 100x brief section 6). A cat's grasshopper that hops off as it rushes, the fish a heron watches swim in
 * under its bill, the moth a swallow twists after, the fish that bolts under an osprey's feet, the fish a dolphin runs
 * down. Visual only and ambient only: it is never a catalogue animal (`PreyKind`), and a catalogue animal still only
 * disappears through the server's meal event (`acts.ts`).
 *
 * Pure: a track is a function of the episode's own keys (its predator's pose along them) and the episode's id, so
 * every viewer sees the same quarry at the same moment. It is built once per catch and then only read.
 *
 * How it moves. The prey keeps to the predator's own way ahead of it: at a time t it is where the predator's mouth
 * (bill, forepaws, talons) will be a little later, `lead(t)` seconds on, and that lead shrinks to nothing at the catch.
 * So it flees along the predator's line at a little over half its speed, darting from side to side, and the predator
 * runs it down exactly where the recipe's catch is; a miss jinks aside at the last moment and gets away. On the ground
 * it hops (a grasshopper: arcs, a puff of dust where it lands), in the water it stays under the surface (a fish), in
 * the air it flits (a moth or fly).
 */

import type {PreyKind} from "@/ark-scene/recipe-templates";

type P = {x: number; y: number; z: number};

/** What it looks like: a ground insect that hops, a flying insect, a fish. */
export type QuarryLook = "hopper" | "flier" | "fish";
export type QuarryPhase = "idle" | "flee" | "caught" | "escaped";

/** The predator's mouth (bill, forepaws, talons: where a catch is made) and heading at a time. */
export type MouthAt = (epoch: number) => {x: number; y: number; z: number; yaw: number};

export type QuarryInput = {
    /** The episode's id and the catch key's index (its seed). */
    id: string;
    kind: PreyKind;
    look: QuarryLook;
    ok: boolean;
    /** Visible from (it is there while the predator watches it), starts fleeing, the catch. */
    tv: number;
    ts: number;
    tc: number;
    mouth: MouthAt;
    /** Body length of the predator (m): the fish's size and the darts' width follow it. */
    length: number;
    /** The ground's height (for a hopper), the water's floor (a fish keeps above it). */
    heightAt: (x: number, z: number) => number;
    /** A watcher (a heron in ambush, a bear at the river): the fish swims in towards it while it waits. */
    approach?: boolean;
};

export type QuarryTrack = {
    id: string;
    kind: PreyKind;
    look: QuarryLook;
    ok: boolean;
    size: number;
    tv: number;
    ts: number;
    tc: number;
    /** It is gone from then (caught: at the catch; escaped: faded out a moment later). */
    te: number;
    /** The predator's mouth at fixed steps from `ts` to `tc` (x, y, z, yaw per sample). */
    path: Float64Array;
    step: number;
    /** Where it waits before it flees, and (a watcher's fish) where it swims in from. */
    rest: P;
    from: P | null;
    /** A miss: the side it jinks to (+1 left of the predator's way, -1 right). */
    side: number;
    /** Its hops (a hopper): start times, each lasting `hop` seconds. */
    hops: number[];
    hop: number;
    seed: number;
    /** Where it was at the catch and how it goes on from there (a miss). */
    escapeAt: P | null;
    escapeDir: {x: number; z: number};
};

export type QuarryNow = {
    id: string;
    kind: PreyKind;
    look: QuarryLook;
    phase: QuarryPhase;
    x: number;
    y: number;
    z: number;
    yaw: number;
    /** Its true length (m); the scene keeps it to a pixel or so far off. */
    size: number;
    /** 1 seen … 0 gone (an escaped one hides in the grass or swims off). */
    alpha: number;
    /** A hopper in the air: 0 on the ground … 1 at the top of its hop; a flier's wing beat phase. */
    air: number;
    /** It landed (a hop) or bolted (a fish) since this many seconds ago: the scene's puff. */
    since: number | null;
};

const SAMPLE = 1 / 30;
/** An escaped one is seen getting away this long, then fades over FADE. */
const AWAY = 1.3;
const FADE = 0.6;

function unitHash(seed: string): number {
    // FNV-1a, as `world.ts` hashString (kept local: this file is pure and import-free but for types).
    let h = 2166136261;
    for (let i = 0; i < seed.length; i++) {
        h ^= seed.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return (h >>> 0) / 4294967296;
}

const clamp = (v: number, a: number, b: number) => Math.min(Math.max(v, a), b);
const ease = (u: number) => {
    const c = clamp(u, 0, 1);
    return c * c * (3 - 2 * c);
};

/** Its true length (m): a grasshopper, a moth or fly by the hunter's size, a fish sized to the hunter. */
export function quarrySize(look: QuarryLook, predatorLength: number): number {
    if (look === "hopper") return clamp(0.03 + predatorLength * 0.01, 0.03, 0.055);
    if (look === "flier") return clamp(0.01 + predatorLength * 0.04, 0.012, 0.035);
    return clamp(predatorLength * 0.14, 0.05, 0.34);
}

export function buildQuarry(input: QuarryInput): QuarryTrack {
    const seed = unitHash(`${input.id}#quarry`);
    const ts = Math.min(input.ts, input.tc - 0.12);
    const tc = input.tc;
    const n = Math.max(Math.ceil((tc - ts) / SAMPLE), 1);
    const step = (tc - ts) / n;
    const path = new Float64Array((n + 1) * 4);
    for (let i = 0; i <= n; i++) {
        const m = input.mouth(ts + i * step);
        path[i * 4] = m.x;
        path[i * 4 + 1] = m.y;
        path[i * 4 + 2] = m.z;
        path[i * 4 + 3] = m.yaw;
    }
    const size = quarrySize(input.look, input.length);
    const side = unitHash(`${input.id}#side`) < 0.5 ? -1 : 1;
    const track: QuarryTrack = {
        id: input.id,
        kind: input.kind,
        look: input.look,
        ok: input.ok,
        size,
        tv: Math.min(input.tv, ts),
        ts,
        tc,
        te: input.ok ? tc : tc + AWAY + FADE,
        path,
        step,
        rest: {x: 0, y: 0, z: 0},
        from: null,
        side,
        hops: [],
        hop: 0.32 + 0.1 * seed,
        seed,
        escapeAt: null,
        escapeDir: {x: 0, z: 0}
    };
    // Where it waits: on the predator's way ahead, where the chase will find it (`lead` at its start).
    const start = chaseAt(track, ts, input.heightAt);
    track.rest = start;
    if (input.approach) {
        // A watcher's fish swims in from out in the water, off to one side of the way the predator faces.
        const yaw = path[3] + side * (0.7 + 0.5 * seed);
        const out = clamp(input.length * 0.9, 0.5, 1.6);
        track.from = {x: start.x + Math.sin(yaw) * out, y: start.y, z: start.z + Math.cos(yaw) * out};
    }
    if (input.look === "hopper") {
        // One hop or two between its fleeing and the catch, the last landing just before the paws do; a miss also
        // hops away twice after it (from the catch's side).
        const span = tc - ts;
        const count = span > track.hop * 2.6 ? 2 : 1;
        const hops: number[] = [];
        for (let k = 0; k < count; k++) hops.push(ts + ((k + 0.5) / count) * span - track.hop * 0.5);
        // (The last lands 0.08 s before the catch: it is pinned where it came down.)
        hops[hops.length - 1] = Math.min(hops[hops.length - 1], tc - 0.08 - track.hop);
        if (!input.ok) hops.push(tc - 0.18, tc - 0.18 + track.hop + 0.25 + 0.2 * seed);
        track.hops = hops.filter((h, i) => i === 0 || h > hops[i - 1] + track.hop * 0.9);
    }
    if (!input.ok) {
        const at = chaseAt(track, tc, input.heightAt);
        track.escapeAt = at;
        const yaw = path[path.length - 1];
        // Away to its side: a hopper sideways, a fish off at an angle, a moth aside and back, up and off (the bird
        // sweeps on past it at several times its speed: a moth that jinked ahead was overtaken again on ark-next).
        const a = yaw + side * (input.look === "hopper" ? 1.25 : input.look === "flier" ? 2 : 0.85);
        track.escapeDir = {x: Math.sin(a), z: Math.cos(a)};
    }
    return track;
}

/** The predator's mouth at a time inside the chase (interpolated from the samples). */
function mouthAt(track: QuarryTrack, t: number): {x: number; y: number; z: number; yaw: number} {
    const n = track.path.length / 4 - 1;
    const f = clamp((t - track.ts) / track.step, 0, n);
    const i = Math.min(Math.floor(f), n - 1 < 0 ? 0 : n - 1);
    const k = n === 0 ? 0 : f - i;
    const a = i * 4;
    const b = Math.min(i + 1, n) * 4;
    const p = track.path;
    let dy = p[b + 3] - p[a + 3];
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    return {x: p[a] + (p[b] - p[a]) * k, y: p[a + 1] + (p[b + 1] - p[a + 1]) * k, z: p[a + 2] + (p[b + 2] - p[a + 2]) * k, yaw: p[a + 3] + dy * k};
}

/**
 * Where the chase has it at `t` (between its fleeing and the catch): on the predator's way, `lead` seconds ahead of
 * it, the lead shrinking to nothing at the catch (so it flees at a little over half the predator's pace), darting from
 * side to side by less as it is caught; a miss jinks aside over the last moment.
 */
function chaseAt(track: QuarryTrack, t: number, heightAt: (x: number, z: number) => number): P {
    const span = Math.max(track.tc - track.ts, 1e-3);
    const u = clamp((t - track.ts) / span, 0, 1);
    const lead = span * 0.45 * (1 - u);
    const m = mouthAt(track, Math.min(t + lead, track.tc));
    // Darts: two or three changes of side, narrowing in to the catch (a fish's zigzag, a moth's flutter, a hopper's
    // hops off line).
    const darts = track.look === "hopper" ? 0 : (track.look === "fish" ? 0.35 : 0.22) * Math.max(track.size * 4, 0.12) * (1 - u) * Math.sin((u * (2 + track.seed) + track.seed) * Math.PI * 2);
    let side = darts;
    if (!track.ok) side += track.side * (track.look === "hopper" ? 0.3 : track.look === "fish" ? 0.45 : 0.22) * ease((u - 0.8) / 0.2);
    const x = m.x + Math.cos(m.yaw) * side;
    const z = m.z - Math.sin(m.yaw) * side;
    return {x, y: yOf(track, x, z, m.y, heightAt), z};
}

/** Its height there: a hopper on the ground, a fish under the surface (above the floor), a flier where the bill is. */
function yOf(track: QuarryTrack, x: number, z: number, mouthY: number, heightAt: (x: number, z: number) => number): number {
    const ground = heightAt(x, z);
    if (track.look === "hopper") return Math.max(ground, 0) + track.size * 0.3;
    if (track.look === "fish") {
        const depth = Math.min(-track.size * 0.8, -0.05);
        // (Under the surface, a little under the bill when that is in the water; above the bed; in the shallowest water
        // just under the surface.)
        const y = Math.min(mouthY, depth);
        return Math.min(Math.max(y, ground + track.size * 0.6), -0.03);
    }
    return Math.max(mouthY, Math.max(ground, 0) + 0.15);
}

/** The quarry at a time, or null when it is not there (before it is seen, after it is caught or gone). */
export function quarryAt(track: QuarryTrack, t: number, heightAt: (x: number, z: number) => number): QuarryNow | null {
    if (t < track.tv || t >= track.te) return null;
    let p: P;
    let phase: QuarryPhase;
    let alpha = 1;
    let air = 0;
    let since: number | null = null;
    if (t < track.ts) {
        phase = "idle";
        p = idleAt(track, t, heightAt);
    } else if (t < track.tc) {
        phase = "flee";
        p = chaseAt(track, t, heightAt);
    } else {
        phase = "escaped";
        const at = track.escapeAt ?? chaseAt(track, track.tc, heightAt);
        const away = t - track.tc;
        const speed = track.look === "fish" ? Math.max(track.size * 9, 0.6) : track.look === "flier" ? 1.2 : 0.5;
        const d = speed * (1 - Math.exp(-away * 2.2)) / 2.2 + speed * 0.2 * away;
        const x = at.x + track.escapeDir.x * d;
        const z = at.z + track.escapeDir.z * d;
        p = {x, y: track.look === "flier" ? at.y + d * 0.35 : yOf(track, x, z, at.y, heightAt), z};
        alpha = 1 - clamp((away - AWAY) / FADE, 0, 1);
    }
    // A hopper's hops: an arc between where it was as the hop began and where it lands (its way is the chase's).
    if (track.look === "hopper") {
        const hop = track.hops.find((h) => t >= h && t < h + track.hop);
        if (hop !== undefined) {
            const k = (t - hop) / track.hop;
            const a = posAt(track, hop, heightAt);
            const b = posAt(track, hop + track.hop, heightAt);
            const height = 0.12 + 0.12 * track.seed;
            air = Math.sin(Math.PI * k);
            p = {x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k + air * height, z: a.z + (b.z - a.z) * k};
        } else {
            // On the ground between hops: it stays where the last hop put it.
            const last = [...track.hops].reverse().find((h) => h + track.hop <= t);
            const from = last !== undefined ? last + track.hop : null;
            const next = track.hops.find((h) => h > t);
            if (from !== null) since = t - from;
            if (phase !== "idle" || next !== undefined || from !== null) p = posAt(track, from ?? track.ts, heightAt);
            if (from === null && next !== undefined) p = idleAt(track, Math.min(t, track.ts), heightAt);
        }
    } else if (track.look === "flier") {
        air = (t * (22 + track.seed * 9)) % 1;
    } else if (phase === "flee" || phase === "escaped") {
        since = t - track.ts;
    }
    const q = posAt(track, t + 0.05, heightAt);
    const yaw = Math.hypot(q.x - p.x, q.z - p.z) > 1e-4 ? Math.atan2(q.x - p.x, q.z - p.z) : track.path[3];
    return {id: track.id, kind: track.kind, look: track.look, phase, x: p.x, y: p.y, z: p.z, yaw, size: track.size, alpha, air, since};
}

/** Where it is at a time ignoring the hop arcs (the chase's place, its rest before, its escape after). */
function posAt(track: QuarryTrack, t: number, heightAt: (x: number, z: number) => number): P {
    if (t < track.ts) return idleAt(track, t, heightAt);
    if (t < track.tc || track.ok) return chaseAt(track, Math.min(t, track.tc), heightAt);
    const at = track.escapeAt ?? chaseAt(track, track.tc, heightAt);
    const away = t - track.tc;
    const speed = track.look === "fish" ? Math.max(track.size * 9, 0.6) : track.look === "flier" ? 1.2 : 0.5;
    const d = speed * (1 - Math.exp(-away * 2.2)) / 2.2 + speed * 0.2 * away;
    const x = at.x + track.escapeDir.x * d;
    const z = at.z + track.escapeDir.z * d;
    return {x, y: track.look === "flier" ? at.y + d * 0.35 : yOf(track, x, z, at.y, heightAt), z};
}

/** Before it flees: a hopper sits; a fish mills about, or swims in to where it is caught (a watcher's); a moth flits round. */
function idleAt(track: QuarryTrack, t: number, heightAt: (x: number, z: number) => number): P {
    const rest = track.rest;
    if (track.look === "hopper") return rest;
    if (track.from) {
        // In over the wait, slowing as it comes, then holding there, finning.
        const k = ease((t - track.tv) / Math.max(track.ts - track.tv - 0.5, 0.5));
        const x = track.from.x + (rest.x - track.from.x) * k;
        const z = track.from.z + (rest.z - track.from.z) * k;
        const wobble = Math.sin(t * 3.1 + track.seed * 9) * track.size * 0.25 * (1 - k * 0.7);
        return {x: x + wobble, y: yOf(track, x, z, rest.y, heightAt), z: z - wobble * 0.5};
    }
    // Round its spot, a little (it arrives back on it as it flees: the lag eases to nothing over the last second).
    const r = track.look === "fish" ? track.size * 1.5 : 0.18;
    const k = 1 - ease((t - (track.ts - 1)) / 1);
    const a = t * (track.look === "fish" ? 0.9 : 2.3) + track.seed * 6.28;
    const x = rest.x + (Math.sin(a) * r - Math.sin(track.ts * (track.look === "fish" ? 0.9 : 2.3) + track.seed * 6.28) * r * (1 - k)) * k;
    const z = rest.z + Math.sin(a * 1.7) * r * 0.6 * k;
    const y = track.look === "flier" ? rest.y + Math.sin(a * 1.3) * 0.12 * k : yOf(track, x, z, rest.y, heightAt);
    return {x, y, z};
}
