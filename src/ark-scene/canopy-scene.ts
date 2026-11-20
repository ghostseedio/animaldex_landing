/**
 * p5 (monkeys): the scene's side of canopy travel (`canopy-travel.ts`): for an animal staying up in a tree on its
 * schedule, its route out through the crowns from that hold (built once per hold, from the drawn trees' own places
 * round it), when in its stay it goes, and its drawn frame there, eased from and back to the schedule's own frame.
 * Pure in the shared clock and the animal's id; the scene only asks "the frame now, or null".
 */

import {allAttachPoints, type AttachPoint} from "@/ark-scene/sampler";
import {canopyKindOf, canopyPoseAt, excursionStart, planRoute, type Anchor, type CanopyKind, type CanopyRoute, type CrownDisc, type TrunkDisc} from "@/ark-scene/canopy-travel";
import {placedTrunk, treeHostOf} from "@/ark-scene/tree-climb";
import {forestFill, worldDecor, type DecorItem} from "@/ark-scene/decor";
import {treeBody} from "@/ark-scene/tree-spacing";
import {jungleHolds, jungleTrees} from "@/ark-scene/islands/wild/jungle";
import {hashString} from "@/ark-scene/world";
import type {SurfaceFrame} from "@/ark-scene/grounding/stand";
import {brachiateDriver, canHang, travelKind, type LocoCanopy} from "@/ark-scene/locomotion/brachiate";
import {registerLocoDriver} from "@/ark-scene/locomotion/layer";

// ARK-CANOPY: a brachiator's arms on its holds while it swings (asked before the legged and L2 drivers: it takes only
// an animal out on its canopy route, which none of them does).
registerLocoDriver(brachiateDriver);

/** The holds it may go to (a limb's top, a branch, a hang point under a limb), and how far round its own it looks (m). */
const HOLD_TAGS = new Set(["limb", "canopy_hang", "branch"]);
const AROUND = 11;

type Own = {base: CanopyKind | null; kind: CanopyKind | null; hands: boolean; routes: Map<string, CanopyRoute | null>};
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

/** A tree host's item (`decor<i>`, `fill<i>`, `jungle<j>`), for its crown. */
function hostItem(host: string): DecorItem | null {
    const m = /^(decor|fill|jungle)(\d+)$/.exec(host);
    if (!m) return null;
    const list: readonly DecorItem[] = m[1] === "decor" ? worldDecor() : m[1] === "fill" ? forestFill() : jungleTrees();
    return list[Number(m[2])] ?? null;
}

/** A tree's leaf mass as a disc a crossing is hidden in (its widest reach, a little in from the leaves' tips). */
function crownOf(host: string): CrownDisc | null {
    const item = hostItem(host);
    const body = item ? treeBody(item) : null;
    if (!body || !body.bands.length) return null;
    const reach = Math.max(...body.bands.map((band) => band[2])) * Math.max(...body.sectors);
    return {x: body.cx, z: body.cz, r: reach * 0.8, bottom: body.bands[0][0], top: body.top};
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
        // (And the jungle's holds round it, `islands/wild/jungle.ts`: no home is on one, they are only gone through.)
        const close = (p: {position: {x: number; z: number}}) => Math.abs(p.position.x - hold.position.x) < AROUND + 3 && Math.abs(p.position.z - hold.position.z) < AROUND + 3;
        const near = [...allAttachPoints().filter(close), ...(jungleTrees().length ? (jungleHolds() as unknown as AttachPoint[]).filter(close) : [])];
        const anchors = near.filter((p) => HOLD_TAGS.has(p.tag) && Math.hypot(p.position.x - hold.position.x, p.position.z - hold.position.z) < AROUND).map(anchorOf).filter((a): a is Anchor => a !== null);
        const trunks: TrunkDisc[] = [];
        const crowns: CrownDisc[] = [];
        const seen = new Set<string>();
        for (const p of near) {
            const tree = treeHostOf(p.id);
            if (!tree || seen.has(tree) || !p.asset || !p.wind) continue;
            seen.add(tree);
            const trunk = placedTrunk(p.asset, p.wind);
            if (trunk) trunks.push({tree, x: trunk.x, z: trunk.z, r: trunk.r0, top: trunk.y + trunk.height});
            const crown = crownOf(tree);
            if (crown) crowns.push(crown);
        }
        route = planRoute(home, anchors, trunks, own.kind, length, hashString(`${seed}#${hold.id}#canopy`), groundAt, 3, crowns);
    }
    own.routes.set(hold.id, route);
    return route;
}

/** ARK-CANOPY: whether a kind swings arm over arm (the gibbons, the siamang, the orangutan): on the ground it walks with its arms up. */
const brachiators = new Map<string, boolean>();
export function brachiates(slug: string, scientific: string | null | undefined): boolean {
    let known = brachiators.get(slug);
    if (known === undefined) brachiators.set(slug, (known = canopyKindOf(slug, scientific)?.mode === "brachiate"));
    return known;
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
): (SurfaceFrame & {air: boolean; hand: {x: number; y: number; z: number} | null; arms: LocoCanopy | null; leap: number | null; canopy: true}) | null {
    if (!trip || !awake || !trip.to.point || epoch < trip.arrive) return null;
    const hold = sceneryPoint(trip.to.point);
    if (!hold || !HOLD_TAGS.has(hold.tag)) return null;
    let own = owners.get(animal.id);
    if (!own) {
        const base = canopyKindOf(animal.model_slug, animal.scientific_name);
        owners.set(animal.id, (own = {base, kind: null, hands: !canHang(animal.model_slug), routes: new Map()}));
    }
    if (!own.base) return null;
    // (ARK-CANOPY: a brachiator hangs under the limbs only once its rig's hands can hold; until then it goes along the tops.)
    if (own.hands !== canHang(animal.model_slug) || !own.kind) {
        own.hands = canHang(animal.model_slug);
        own.kind = travelKind(own.base, animal.model_slug);
        own.routes.clear();
    }
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
    // (ARK-CANOPY: what its arms do, for the brachiation driver: the hold, the next one, which hand; eased in and out with
    // the excursion, so the hand goes to the wood as it leaves its sitting pose.)
    const arms: LocoCanopy | null = pose.blend > 0.5 && (pose.phase === "swing" || pose.phase === "flight" || pose.phase === "hold") ? {phase: pose.phase, hand: pose.hand, next: pose.next ?? null, lead: pose.lead ?? 1, u: pose.u ?? 0, brachiate: route.kind.mode === "brachiate"} : null;
    return {x, y, z, nx: n.x, ny: n.y, nz: n.z, tx: (t.x - d * n.x) / tl, ty: (t.y - d * n.y) / tl, tz: (t.z - d * n.z) / tl, air: pose.air, hand: pose.hand, arms, leap: pose.phase === "leap" ? pose.u ?? null : null, canopy: true};
}
