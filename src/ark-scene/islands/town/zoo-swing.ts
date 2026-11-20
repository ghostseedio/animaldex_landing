/**
 * The primate house's swingers (lane ARK-JUNGLE, board 2026-11-20: "zoo primate house swinging"). The hall has its
 * climbing frames (`render/zoo-habitat.ts` climbingFrame: stripped-log posts, a high beam between each two, ropes), and
 * its residents were held on their spots on the floor. Now and then a resident that travels through trees
 * (`canopy-travel.ts`: the gibbons and the orangutan swing arm over arm, the colobus and the sakis leap, the macaques,
 * the capuchins, the lemurs and the marmosets run and bound) goes to the nearest post, climbs it, travels along the
 * frame's high beams the way its kind travels (swinging under them, or along their tops), comes back the same way,
 * climbs down and walks back to its spot. Apes of the ground (the gorillas, the mandrill, the baboons) stay down.
 *
 * Visual only, pure in the shared clock and the animal's id (the same for every viewer): where the resident "is" stays
 * its spot. The route is the canopy travel's own (`planRoute`, `canopyPoseAt`) on holds along the beams.
 */

import {canopyKindOf, canopyPoseAt, planRoute, type Anchor, type CanopyRoute} from "@/ark-scene/canopy-travel";
import {hashString} from "@/ark-scene/world";
import type {SurfaceFrame} from "@/ark-scene/grounding/stand";
import {canHang, travelKind, type LocoCanopy} from "@/ark-scene/locomotion/brachiate";

type Vec = {x: number; y: number; z: number};
type V3 = [number, number, number];
export type ZooClimb = {a: V3; b: V3; posts: [V3, V3]; feet: [V3, V3]};

/** A slot of the shared clock (s): at most one excursion in each, its own share of them. */
const SLOT = 150;
/** Its walk to the post and its climb (m/s). */
const WALK = 1.0;
const CLIMB = 0.9;
/** Holds along a beam this far apart (m). */
const STEP = 1.3;

const frac = (v: number) => v - Math.floor(v);
const unit = (seed: number, k: number) => frac(Math.sin(seed * 12.9898 + k * 78.233) * 43758.5453);
const norm = (v: Vec): Vec => {
    const l = Math.hypot(v.x, v.y, v.z) || 1;
    return {x: v.x / l, y: v.y / l, z: v.z / l};
};
const lerp = (a: Vec, b: Vec, t: number): Vec => ({x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t});
const ease = (t: number) => {
    const k = Math.min(Math.max(t, 0), 1);
    return k * k * (3 - 2 * k);
};
const vec = (v: V3): Vec => ({x: v[0], y: v[1], z: v[2]});

/** The holds along the frames' high beams: under them (a swinger's hand) or on their tops (a runner's or leaper's feet). */
export function beamHolds(climbs: readonly ZooClimb[], under: boolean): Anchor[] {
    const out: Anchor[] = [];
    climbs.forEach((c, i) => {
        const a = vec(c.a);
        const b = vec(c.b);
        const n = Math.max(1, Math.floor(Math.hypot(b.x - a.x, b.z - a.z) / STEP));
        for (let k = 0; k <= n; k++) {
            const p = lerp(a, b, 0.08 + (0.84 * k) / n);
            // (The beam's underside for a hand; its top, a log's width up, for feet.)
            out.push({id: `beam${i}:${k}`, tree: `beam${i}`, x: p.x, y: under ? p.y : p.y + 0.36, z: p.z, nx: 0, ny: under ? -1 : 1, nz: 0, under});
        }
    });
    return out;
}

type Excursion = {route: CanopyRoute; foot: Vec; top: Vec; spot: Vec; walk: number; climb: number; total: number; postOut: Vec};

const plans = new Map<string, Excursion | null>();

/** Its excursion from its spot: to the nearest post, up it, out along the beams and back, down and home. */
function plan(id: string, slug: string, scientific: string | null | undefined, length: number, spot: Vec, climbs: readonly ZooClimb[]): Excursion | null {
    const key = `${id}@${spot.x.toFixed(1)},${spot.z.toFixed(1)}${canHang(slug) ? "#hands" : ""}`;
    if (plans.has(key)) return plans.get(key) ?? null;
    let out: Excursion | null = null;
    // (ARK-CANOPY: under the beams by its hands only when its rig's arms can hold; else along their tops.)
    const found = canopyKindOf(slug, scientific);
    const kind = found ? travelKind(found, slug) : null;
    if (kind && climbs.length) {
        // The nearest post's foot, and its top.
        let best: {foot: Vec; top: Vec; d: number} | null = null;
        for (const c of climbs) {
            for (const j of [0, 1]) {
                const foot = vec(c.feet[j]);
                const d = Math.hypot(foot.x - spot.x, foot.z - spot.z);
                if (!best || d < best.d) best = {foot, top: vec(c.posts[j]), d};
            }
        }
        const under = kind.mode === "brachiate";
        const holds = beamHolds(climbs, under);
        if (best && holds.length) {
            // Its first hold: the beam's nearest to the post's top.
            const home = holds.reduce((h, p) => (Math.hypot(p.x - best!.top.x, p.z - best!.top.z) < Math.hypot(h.x - best!.top.x, h.z - best!.top.z) ? p : h));
            const floor = best.foot.y;
            const route = planRoute(home, holds, [], kind, length, hashString(`${id}#zoo-swing`), () => floor - 1, 4);
            if (route) {
                // (Off the post's side toward the spot: its body against the post, not in it.)
                const postOut = norm({x: spot.x - best.foot.x, y: 0, z: spot.z - best.foot.z});
                const off = 0.3 + length * 0.15;
                const foot = {x: best.foot.x + postOut.x * off, y: floor, z: best.foot.z + postOut.z * off};
                const top = {x: best.top.x + postOut.x * off, y: home.y - length * 0.5, z: best.top.z + postOut.z * off};
                const walk = Math.max(Math.hypot(foot.x - spot.x, foot.z - spot.z) / WALK, 0.5);
                const climb = Math.max((top.y - foot.y) / CLIMB, 1);
                out = {route, foot, top, spot, walk, climb, total: 2 * (walk + climb) + route.seconds, postOut};
            }
        }
    }
    if (plans.size > 128) plans.clear();
    plans.set(key, out);
    return out;
}

/**
 * Its frame now on the frame (the feet's point, its back's way, its head's way), or null: not a kind that travels through
 * trees, asleep, not its turn this slot, or before or after its excursion. `spot`: where it is held on the floor.
 */
export function zooSwingFrame(
    animal: {id: string; model_slug: string; scientific_name?: string | null},
    length: number,
    spot: Vec,
    climbs: readonly ZooClimb[],
    epoch: number,
    awake: boolean
): (SurfaceFrame & {air: boolean; phase: string; arms?: LocoCanopy | null; leap?: number | null; canopy?: boolean}) | null {
    if (!awake || !climbs.length) return null;
    const ex = plan(animal.id, animal.model_slug, animal.scientific_name, length, spot, climbs);
    if (!ex) return null;
    const slot = Math.floor(epoch / SLOT);
    const seed = hashString(`${animal.id}#zoo-swing#${slot}`);
    if (unit(seed, 1) > (ex.route.kind.mode === "brachiate" ? 0.75 : 0.5)) return null;
    const slack = SLOT - ex.total - 6;
    if (slack < 0) return null;
    const t = epoch - slot * SLOT - 3 - slack * unit(seed, 2);
    if (t < 0 || t > ex.total) return null;
    const frame = (p: Vec, n: Vec, f: Vec, air: boolean, phase: string) => {
        const d = f.x * n.x + f.y * n.y + f.z * n.z;
        const tv = norm({x: f.x - d * n.x, y: f.y - d * n.y, z: f.z - d * n.z});
        return {x: p.x, y: p.y, z: p.z, nx: n.x, ny: n.y, nz: n.z, tx: tv.x, ty: tv.y, tz: tv.z, air, phase};
    };
    const up = {x: 0, y: 1, z: 0};
    const toPost = {x: ex.foot.x - ex.spot.x, y: 0, z: ex.foot.z - ex.spot.z};
    // Walk to the post, climb it (its belly to the post, head up), along the beams, down, and home.
    if (t < ex.walk) return frame(lerp(ex.spot, ex.foot, ease(t / ex.walk)), up, toPost, false, "walk");
    let s = t - ex.walk;
    if (s < ex.climb) return frame(lerp(ex.foot, ex.top, ease(s / ex.climb)), ex.postOut, up, false, "climb");
    s -= ex.climb;
    if (s < ex.route.seconds) {
        const pose = canopyPoseAt(ex.route, s);
        if (!pose) return null;
        // Its feet a fifth of its length under its middle (as `canopy-scene.ts` draws it); eased off the post at the start.
        const drop = length * 0.18;
        let p = {x: pose.centre.x - pose.up.x * drop, y: pose.centre.y - pose.up.y * drop, z: pose.centre.z - pose.up.z * drop};
        let n = pose.up;
        let f = pose.forward;
        if (pose.blend < 1) {
            const w = pose.blend;
            p = lerp(ex.top, p, w);
            n = norm(lerp(ex.postOut, n, w));
            f = norm(lerp(up, f, w));
        }
        zooSeen.set(animal.id, {epoch, phase: pose.phase});
        // (ARK-CANOPY: its arms on the beam's holds and its leaps' clip, as on the wild island's trees: `canopy-scene.ts`.)
        const arms: LocoCanopy | null = pose.blend > 0.5 && (pose.phase === "swing" || pose.phase === "flight" || pose.phase === "hold") ? {phase: pose.phase, hand: pose.hand, next: pose.next ?? null, lead: pose.lead ?? 1, u: pose.u ?? 0, brachiate: ex.route.kind.mode === "brachiate"} : null;
        return {...frame(p, n, f, pose.air, pose.phase), arms, leap: pose.phase === "leap" ? pose.u ?? null : null, canopy: true};
    }
    s -= ex.route.seconds;
    if (s < ex.climb) return frame(lerp(ex.top, ex.foot, ease(s / ex.climb)), ex.postOut, {x: 0, y: -1, z: 0}, false, "climb");
    s -= ex.climb;
    return frame(lerp(ex.foot, ex.spot, ease(s / ex.walk)), up, {x: -toPost.x, y: 0, z: -toPost.z}, false, "walk");
}


/** Each swinger's canopy phase when last drawn on the frame (for the canopy harness to find one; not read by the scene). */
export const zooSeen = new Map<string, {epoch: number; phase: string}>();
