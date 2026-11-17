/**
 * p5 (monkeys): the scene's side of canopy travel (`canopy-travel.ts`): for an animal staying up in a tree on its
 * schedule, its route out through the crowns from that hold (built once per hold, from the drawn trees' own places
 * round it), when in its stay it goes, and its drawn frame there, eased from and back to the schedule's own frame.
 * Pure in the shared clock and the animal's id; the scene only asks "the frame now, or null".
 */

import {allAttachPoints, type AttachPoint} from "@/ark-scene/sampler";
import {canopyKindOf, canopyPoseAt, excursionStart, planRoute, type Anchor, type CanopyKind, type CanopyRoute, type TrunkDisc} from "@/ark-scene/canopy-travel";
import {placedTrunk, treeHostOf} from "@/ark-scene/tree-climb";
import {hashString} from "@/ark-scene/world";
import type {SurfaceFrame} from "@/ark-scene/grounding/stand";

/** The holds it may go to (a limb's top, a branch, a hang point under a limb), and how far round its own it looks (m). */
const HOLD_TAGS = new Set(["limb", "canopy_hang", "branch"]);
const AROUND = 11;

type Own = {kind: CanopyKind | null; routes: Map<string, CanopyRoute | null>};
const owners = new Map<string, Own>();
let indexOf: AttachPoint[] | null = null;
let byId = new Map<string, AttachPoint>();

function sceneryPoint(id: string): AttachPoint | null {
    const all = allAttachPoints();
    if (indexOf !== all) {
        indexOf = all;
        byId = new Map(all.map((p) => [p.id, p]));
        owners.clear();
    }
    return byId.get(id.startsWith("map:") ? id.slice(4) : id) ?? null;
}

function anchorOf(p: AttachPoint): Anchor | null {
    const tree = treeHostOf(p.id);
    if (!tree) return null;
    return {id: p.id, tree, x: p.position.x, y: p.position.y, z: p.position.z, nx: p.normal.x, ny: p.normal.y, nz: p.normal.z, under: p.tag === "canopy_hang"};
}

/** Its route from this hold (built once): the holds round it in the drawn trees, those trees' trunks to keep clear of. */
function routeFrom(own: Own, seed: string, hold: AttachPoint, length: number, groundAt: (x: number, z: number) => number): CanopyRoute | null {
    if (own.routes.has(hold.id)) return own.routes.get(hold.id) ?? null;
    let route: CanopyRoute | null = null;
    const home = anchorOf(hold);
    if (home && own.kind) {
        const near = allAttachPoints().filter((p) => Math.abs(p.position.x - hold.position.x) < AROUND + 3 && Math.abs(p.position.z - hold.position.z) < AROUND + 3);
        const anchors = near.filter((p) => HOLD_TAGS.has(p.tag) && Math.hypot(p.position.x - hold.position.x, p.position.z - hold.position.z) < AROUND).map(anchorOf).filter((a): a is Anchor => a !== null);
        const trunks: TrunkDisc[] = [];
        const seen = new Set<string>();
        for (const p of near) {
            const tree = treeHostOf(p.id);
            if (!tree || seen.has(tree) || !p.asset || !p.wind) continue;
            seen.add(tree);
            const trunk = placedTrunk(p.asset, p.wind);
            if (trunk) trunks.push({tree, x: trunk.x, z: trunk.z, r: trunk.r0, top: trunk.y + trunk.height});
        }
        route = planRoute(home, anchors, trunks, own.kind, length, hashString(`${seed}#${hold.id}#canopy`), groundAt);
    }
    own.routes.set(hold.id, route);
    return route;
}

/** Whether a kind travels through the crowns at all (`canopy-moves.json`, or its genus). */
export function travelsCanopy(slug: string, scientific: string | null | undefined): boolean {
    return canopyKindOf(slug, scientific) !== null;
}

/**
 * Its frame now on its canopy route, or null (not one that travels so, not staying in a tree now, not its turn this
 * slot, or before or after its excursion). `held`: the schedule's own frame on its hold, eased from and back to.
 */
/** Each traveller's phase when last drawn on its route (for the canopy harness to find a swing; not read by the scene). */
export const canopyPhases = new Map<string, {phase: string; air: boolean; epoch: number}>();

export function canopyFrame(
    animal: {id: string; model_slug: string; scientific_name?: string | null},
    trip: {slot: number; arrive: number; end: number; to: {point: string | null}} | null | undefined,
    epoch: number,
    length: number,
    awake: boolean,
    held: SurfaceFrame | null,
    groundAt: (x: number, z: number) => number
): (SurfaceFrame & {air: boolean; hand: {x: number; y: number; z: number} | null}) | null {
    if (!trip || !awake || !trip.to.point || epoch < trip.arrive) return null;
    const hold = sceneryPoint(trip.to.point);
    if (!hold || !HOLD_TAGS.has(hold.tag)) return null;
    let own = owners.get(animal.id);
    if (!own) owners.set(animal.id, (own = {kind: canopyKindOf(animal.model_slug, animal.scientific_name), routes: new Map()}));
    if (!own.kind) return null;
    const route = routeFrom(own, animal.id, hold, length, groundAt);
    if (!route) return null;
    const start = excursionStart(route, hashString(`${animal.id}#excursion`), trip.slot, trip.end - trip.arrive);
    if (start === null) return null;
    const pose = canopyPoseAt(route, epoch - trip.arrive - start);
    if (!pose) return null;
    canopyPhases.set(animal.id, {phase: pose.phase, air: pose.air, epoch});
    // The frame: its underside a fifth of its length under its middle, against its back's way.
    const drop = length * 0.18;
    let x = pose.centre.x - pose.up.x * drop;
    let y = pose.centre.y - pose.up.y * drop;
    let z = pose.centre.z - pose.up.z * drop;
    let n = pose.up;
    let t = pose.forward;
    if (pose.blend < 1 && held) {
        const w = pose.blend;
        x = held.x + (x - held.x) * w;
        y = held.y + (y - held.y) * w;
        z = held.z + (z - held.z) * w;
        const mix = (a: {x: number; y: number; z: number}, b: {x: number; y: number; z: number}) => {
            const v = {x: a.x + (b.x - a.x) * w, y: a.y + (b.y - a.y) * w, z: a.z + (b.z - a.z) * w};
            const l = Math.hypot(v.x, v.y, v.z) || 1;
            return {x: v.x / l, y: v.y / l, z: v.z / l};
        };
        n = mix({x: held.nx, y: held.ny, z: held.nz}, n);
        t = mix({x: held.tx, y: held.ty, z: held.tz}, t);
    }
    // (Its heading square to its up.)
    const d = t.x * n.x + t.y * n.y + t.z * n.z;
    const tl = Math.hypot(t.x - d * n.x, t.y - d * n.y, t.z - d * n.z) || 1;
    return {x, y, z, nx: n.x, ny: n.y, nz: n.z, tx: (t.x - d * n.x) / tl, ty: (t.y - d * n.y) / tl, tz: (t.z - d * n.z) / tl, air: pose.air, hand: pose.hand};
}
