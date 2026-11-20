/**
 * Langurs up the rocks (lane ARK-JUNGLE, board 2026-11-20: "langur rock-ledge climb"). The langurs of the karst and the
 * rocky hills (François' langur sleeps in the caves of limestone cliffs and suns on their ledges; the grey langurs
 * sit on rock outcrops) go up a rock near where their day has them on the ground, ledge by ledge, sit on its top a while
 * looking out, and come down again.
 *
 * The ledges are the drawn rock's own (`rock-assets.ts` rockAttachPoints: its flat shelves on the lod0 surface), so a
 * foot meets stone. Like canopy travel (`canopy-travel.ts`), it is visual only and pure in the shared clock and the
 * animal's id: where the animal "is" stays its schedule's spot; the climb is an excursion from it and back within the
 * schedule's stay there, the same for every viewer.
 */

import {worldDecor} from "@/ark-scene/decor";
import {rockAssetFor, rockAttachPoints} from "@/ark-scene/rock-assets";
import {hashString} from "@/ark-scene/world";
import type {SurfaceFrame} from "@/ark-scene/grounding/stand";

type Vec = {x: number; y: number; z: number};

/** The langurs that go up rock: by genus (the leaf monkeys of the karst and the rocky hills). */
const ROCK_GENUS = new Set(["Trachypithecus", "Semnopithecus"]);

export function climbsRock(scientific: string | null | undefined): boolean {
    return ROCK_GENUS.has((scientific ?? "").trim().split(/\s+/)[0] ?? "");
}

/** How far round its spot it looks for a rock (m), how high its top must stand (m), the most a hop rises (m). */
const REACH = 18;
const TALL = 1.5;
const RISE = 2.1;
const SPAN = 3.2;
const WALK = 1.1;

type Step = {from: Vec; to: Vec; up0: Vec; up1: Vec; kind: "walk" | "hop"; start: number; seconds: number};
export type LedgeRoute = {steps: Step[]; sitFrom: number; sitTo: number; seconds: number; top: Vec; topUp: Vec; out: Vec};

const frac = (v: number) => v - Math.floor(v);
const unit = (seed: number, k: number) => frac(Math.sin(seed * 12.9898 + k * 78.233) * 43758.5453);
const norm = (v: Vec): Vec => {
    const l = Math.hypot(v.x, v.y, v.z) || 1;
    return {x: v.x / l, y: v.y / l, z: v.z / l};
};
const ease = (t: number) => {
    const k = Math.min(Math.max(t, 0), 1);
    return k * k * (3 - 2 * k);
};
const lerp = (a: Vec, b: Vec, t: number): Vec => ({x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t});

let rocks: Array<{x: number; z: number; ledges: Array<{p: Vec; n: Vec}>; top: number; centre: Vec}> | null = null;

/** The decor's rocks with flat ledges that stand tall enough, once. */
function tallRocks(groundAt: (x: number, z: number) => number) {
    if (rocks) return rocks;
    rocks = [];
    for (const item of worldDecor()) {
        if (item.kind !== "rock" || item.scale < 1.2) continue;
        const placed = rockAssetFor(item);
        if (!placed) continue;
        const ground = groundAt(item.x, item.z);
        // Its shelves, and the faces that look up enough to stand on (a foothold on the way); its back mostly upright on
        // them (the rock's slope tips it a little, never onto its side).
        const ledges = rockAttachPoints(placed)
            .filter((p) => (p.tag === "ledge" && p.normal.y >= 0.5) || (p.tag === "rock_face" && p.normal.y >= 0.55 && p.position.y > ground + 0.4))
            .map((p) => ({p: {x: p.position.x, y: p.position.y, z: p.position.z}, n: norm({x: p.normal.x * 0.4, y: p.normal.y * 0.4 + 0.6, z: p.normal.z * 0.4})}));
        if (!ledges.length) continue;
        const top = Math.max(...ledges.map((l) => l.p.y)) - ground;
        if (top < TALL) continue;
        rocks.push({x: item.x, z: item.z, ledges, top, centre: {x: item.x, y: ground, z: item.z}});
    }
    return rocks;
}

/**
 * The climb from `stand` (where its day has it, on the ground): to the foot of a rock in reach, up its ledges (each hop
 * at most RISE up and SPAN across), the top a while, and back the same way. Null when no rock is in reach.
 */
export function planLedges(stand: Vec, seed: number, groundAt: (x: number, z: number) => number): LedgeRoute | null {
    const near = tallRocks(groundAt).filter((r) => Math.hypot(r.x - stand.x, r.z - stand.z) < REACH);
    if (!near.length) return null;
    // Its own choice among them (seeded), the taller a little likelier.
    const rock = near.map((r, i) => ({r, s: unit(seed, i) + 0.2 * r.top})).sort((a, b) => b.s - a.s)[0].r;
    const ledges = [...rock.ledges].sort((a, b) => a.p.y - b.p.y);
    // The ledge it starts up from: the lowest; its foot a little out from it on the ground, on the rock's side toward it.
    const first = ledges[0];
    const outward = norm({x: first.p.x - rock.x, y: 0, z: first.p.z - rock.z});
    const footXZ = {x: first.p.x + outward.x * 0.6, z: first.p.z + outward.z * 0.6};
    const foot = {x: footXZ.x, y: groundAt(footXZ.x, footXZ.z), z: footXZ.z};
    const chain = [{p: foot, n: {x: 0, y: 1, z: 0}}];
    for (const l of ledges) {
        const at = chain[chain.length - 1].p;
        const rise = l.p.y - at.y;
        if (rise < 0.15 || rise > RISE || Math.hypot(l.p.x - at.x, l.p.z - at.z) > SPAN) continue;
        chain.push(l);
    }
    if (chain.length < 2 || chain[chain.length - 1].p.y - foot.y < TALL * 0.8) return null;
    const steps: Step[] = [];
    let t = 0;
    const up = {x: 0, y: 1, z: 0};
    const walk = (from: Vec, to: Vec) => {
        // (In legs of half a metre, each on the ground at its ends: over the hills' bumps, never through them.)
        const span = Math.hypot(to.x - from.x, to.z - from.z);
        const n = Math.max(1, Math.ceil(span / 0.5));
        let a = from;
        for (let i = 1; i <= n; i++) {
            const q = lerp(from, to, i / n);
            const b = i === n ? to : {x: q.x, y: groundAt(q.x, q.z), z: q.z};
            const seconds = Math.max(span / n / WALK, 0.4 / n);
            steps.push({from: a, to: b, up0: up, up1: up, kind: "walk", start: t, seconds});
            t += seconds;
            a = b;
        }
    };
    const hop = (a: {p: Vec; n: Vec}, b: {p: Vec; n: Vec}, k: number) => {
        const seconds = 0.5 + Math.hypot(b.p.x - a.p.x, b.p.y - a.p.y, b.p.z - a.p.z) / 3.5;
        steps.push({from: a.p, to: b.p, up0: a.n, up1: b.n, kind: "hop", start: t, seconds});
        // (A look round on each ledge before the next.)
        t += seconds + 0.6 + unit(seed, 40 + k) * 0.9;
    };
    walk(stand, foot);
    for (let i = 1; i < chain.length; i++) hop(chain[i - 1], chain[i], i);
    const top = chain[chain.length - 1];
    const sitFrom = t;
    t += 9 + 9 * unit(seed, 77);
    const sitTo = t;
    for (let i = chain.length - 1; i > 0; i--) hop(chain[i], chain[i - 1], 10 + i);
    walk(foot, stand);
    // Sitting on top it looks out, away from the rock's middle.
    const out = norm({x: top.p.x - rock.x, y: 0, z: top.p.z - rock.z});
    return {steps, sitFrom, sitTo, seconds: t, top: top.p, topUp: top.n, out: Math.hypot(out.x, out.z) > 0.1 ? out : outward};
}

/** Its frame `t` s into the climb (feet's point, up, heading), and whether it is in the air (mid-hop); null outside it. */
export function ledgePoseAt(route: LedgeRoute, t: number): (SurfaceFrame & {air: boolean}) | null {
    if (t < 0 || t > route.seconds) return null;
    const frame = (p: Vec, n: Vec, f: Vec, air: boolean) => {
        const d = f.x * n.x + f.y * n.y + f.z * n.z;
        const tv = norm({x: f.x - d * n.x, y: f.y - d * n.y, z: f.z - d * n.z});
        return {x: p.x, y: p.y, z: p.z, nx: n.x, ny: n.y, nz: n.z, tx: tv.x, ty: tv.y, tz: tv.z, air};
    };
    if (t >= route.sitFrom && t < route.sitTo) return frame(route.top, route.topUp, route.out, false);
    const step = route.steps.find((s) => t >= s.start && t < s.start + s.seconds) ?? null;
    if (!step) {
        // Between hops: on the ledge it came to, facing on up (or down) the way it goes next.
        const prev = [...route.steps].reverse().find((s) => s.start + s.seconds <= t);
        const next = route.steps.find((s) => s.start >= t);
        const at = prev ? prev.to : route.steps[0].from;
        const go = next ? {x: next.to.x - next.from.x, y: 0, z: next.to.z - next.from.z} : {x: route.out.x, y: 0, z: route.out.z};
        return frame(at, prev ? prev.up1 : {x: 0, y: 1, z: 0}, Math.hypot(go.x, go.z) > 0.01 ? go : route.out, false);
    }
    const k = (t - step.start) / step.seconds;
    const way = {x: step.to.x - step.from.x, y: 0, z: step.to.z - step.from.z};
    const heading = Math.hypot(way.x, way.z) > 0.01 ? way : route.out;
    if (step.kind === "walk") return frame(lerp(step.from, step.to, k), {x: 0, y: 1, z: 0}, heading, false);
    // A hop: a crouch, an arc up (or down) to the next ledge, a landing; its back from one ledge's normal to the next's.
    const u = Math.min(Math.max((k - 0.15) / 0.75, 0), 1);
    const p = lerp(step.from, step.to, u);
    p.y += (0.25 + 0.25 * Math.max(step.to.y - step.from.y, 0)) * 4 * u * (1 - u);
    const n = norm(lerp(step.up0, step.up1, ease(u)));
    return frame(p, n, {x: heading.x, y: (step.to.y - step.from.y) * 0.5, z: heading.z}, u > 0 && u < 1);
}

const routes = new Map<string, LedgeRoute | null>();

/**
 * Its frame now on a rock climb, or null (not a rock-climbing langur, not on the ground at rest in a stay now, no rock in
 * reach, not its turn this stay, or before or after the climb). `stand`: where its schedule has it.
 */
export function ledgeFrame(
    animal: {id: string; scientific_name?: string | null},
    trip: {slot: number; arrive: number; end: number} | null | undefined,
    epoch: number,
    awake: boolean,
    stand: Vec,
    groundAt: (x: number, z: number) => number
): (SurfaceFrame & {air: boolean}) | null {
    if (!trip || !awake || epoch < trip.arrive || !climbsRock(animal.scientific_name)) return null;
    const seed = hashString(`${animal.id}#ledge#${trip.slot}`);
    // Not every stay (its own share), and only where there is time for the whole climb.
    if (unit(seed, 1) > 0.65) return null;
    const key = `${animal.id}#${trip.slot}#${stand.x.toFixed(1)},${stand.z.toFixed(1)}`;
    let route = routes.get(key);
    if (route === undefined) {
        route = planLedges(stand, seed, groundAt);
        if (routes.size > 64) routes.clear();
        routes.set(key, route);
    }
    if (!route) return null;
    const slack = trip.end - trip.arrive - route.seconds - 4;
    if (slack < 0) return null;
    const start = 2 + slack * unit(seed, 2);
    const t = epoch - trip.arrive - start;
    const frame = ledgePoseAt(route, t);
    if (frame) ledgeSeen.set(animal.id, {epoch, phase: t >= route.sitFrom && t < route.sitTo ? "sit" : frame.air ? "hop" : frame.ny > 0.99 && Math.abs(frame.y - stand.y) < 0.3 ? "walk" : "ledge"});
    return frame;
}

/** Each climber's phase when last drawn on a rock (for the canopy harness to find a climb; not read by the scene). */
export const ledgeSeen = new Map<string, {epoch: number; phase: string}>();
