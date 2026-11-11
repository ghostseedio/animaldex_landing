/**
 * Where each bird's nest goes (docs/ark/props.md, "Nest sites"), found only
 * through the scenery interface (`src/ark-scene/sampler.ts`: `surfaceAt`,
 * `attachPoints`, `place`) and the props' own few extra sites built on it
 * (`props/sampler.ts`: ledges). A tree nest sits on a `branch` attach point
 * (the graphics lane puts those on the asset trees' real branches), a hole
 * on a `tree_hollow` or `bark` point, a martin's cup on a `house_eave`, a
 * puffin's burrow on a `burrow` point, a grebe's raft where the ground
 * meets the water. Never a hard-coded canopy offset.
 *
 * Deterministic: the same sites for every viewer.
 */

import {allAttachPoints, surfaceAt, type AttachPoint} from "@/ark-scene/sampler";
import {worldDecor} from "@/ark-scene/decor";
import {COTTAGE, microCorner} from "@/ark-scene/micro-decor";
import type {Placement} from "@/ark-scene/placement";
import {ZONE_SITES, hashString, sampleGround, seeded} from "@/ark-scene/world";
import type {ArkZone} from "@/ark-scene/types";
import type {NestPlan} from "@/ark-scene/props/presence";
import {propsPoints, type PropsPoint} from "@/ark-scene/props/sampler";

export type NestSpot = {
    /** Stable: the attach point's id, the ledge's, or `<kind>:<sitter or species>:<n>`. */
    siteId: string;
    x: number;
    y: number;
    z: number;
    /** Its heading about its up. */
    turn: number;
    /** Its up, when not straight up (a nest on sloping ground). */
    up?: {x: number; y: number; z: number};
    /** The sitter's own nest (the first of a colony). */
    own: boolean;
    /** The scenery draws it already (a `tree_hollow`'s hole): the props draw no hole over it. */
    drawn?: boolean;
};

const TREE_KINDS = new Set(["broadleaf", "rainforest", "orchard", "acacia", "conifer", "palm", "canopy"]);

const zoneCorner = (zone: ArkZone) => {
    const site = ZONE_SITES[zone];
    if (site.kind === "sea") return {x: ZONE_SITES.seashore.x, z: ZONE_SITES.seashore.z};
    return microCorner(zone);
};

/** The decor tree under a host id (`decor12`, `fill40`), for its trunk's position. */
function hostTree(host: string): {x: number; z: number; y: number} | null {
    const match = /^decor(\d+)$/.exec(host);
    if (!match) return null;
    const item = worldDecor()[Number(match[1])];
    return item ? {x: item.x, z: item.z, y: item.y} : null;
}

function dist(a: {x: number; z: number}, b: {x: number; z: number}): number {
    return Math.hypot(a.x - b.x, a.z - b.z);
}

/** Dry, gentle ground at (x, z): no water, not a cliff. */
function dryAt(x: number, z: number, maxSlope = 0.3): {y: number; normal: {x: number; y: number; z: number}} | null {
    const surface = surfaceAt(x, z);
    if (surface.waterDepth > 0 || surface.height < 0.18 || 1 - surface.normal.y > maxSlope || surface.cliff > 0.4) return null;
    return {y: surface.height, normal: surface.normal};
}

/** The lowest ground under a disc (a nest on a slope sits into it, never floating off its low side). */
function seatY(x: number, z: number, radius: number): number {
    let low = surfaceAt(x, z).height;
    for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        low = Math.min(low, surfaceAt(x + Math.cos(a) * radius * 0.8, z + Math.sin(a) * radius * 0.8).height);
    }
    return low;
}

/** A spiral search from (x, z) out to `reach` for the first point `ok` accepts (deterministic). */
function spiral<T>(x: number, z: number, reach: number, step: number, ok: (px: number, pz: number) => T | null): T | null {
    for (let k = 0; k < 900; k++) {
        const r = step * Math.sqrt(k);
        if (r > reach) break;
        const a = k * 2.39996;
        const found = ok(x + Math.cos(a) * r, z + Math.sin(a) * r);
        if (found) return found;
    }
    return null;
}

/**
 * The ground's height under an attach point (the same as `surfaceAt(x, z).height`: the ground sample's height), kept
 * per point: at the captures' scale hundreds of nests ask about the same thousands of trunk and branch points, and a
 * ground sample each time was most of the mount (the runtime lane's measure, docs/ark/runtime.md).
 */
const groundUnderPoint = new Map<string, number>();
function groundUnder(point: AttachPoint): number {
    let height = groundUnderPoint.get(point.id);
    if (height === undefined) {
        height = sampleGround(point.position.x, point.position.z).height;
        groundUnderPoint.set(point.id, height);
    }
    return height;
}

/** Up the attach list once (by tag), so a site search does not refilter thousands of points. */
let byTag: Map<string, AttachPoint[]> | null = null;
function pointsTagged(tag: string): AttachPoint[] {
    if (!byTag) {
        byTag = new Map();
        for (const point of allAttachPoints()) {
            const list = byTag.get(point.tag) ?? [];
            list.push(point);
            byTag.set(point.tag, list);
        }
    }
    return byTag.get(tag) ?? [];
}

/** Every site of one nest plan: the sitter's first, then the colony's. `used` keeps two nests off one site. */
export function nestSpots(plan: NestPlan, radius: number, placeOf: (id: string) => Placement | null, used: Set<string>): NestSpot[] {
    const sitter = plan.sitter ? placeOf(plan.sitter) : null;
    const corner = zoneCorner(plan.zone);
    const from = sitter ?? {x: corner.x, z: corner.z};
    const random = seeded(hashString(`nest:${plan.key}`));
    const count = Math.max(1, plan.profile.colony);
    const out: NestSpot[] = [];
    const take = (id: string, spot: Omit<NestSpot, "siteId" | "own">) => {
        if (used.has(id)) return false;
        if (out.some((other) => dist(other, spot) < radius * 2.1) && plan.profile.site !== "branch_tip") return false;
        used.add(id);
        out.push({...spot, siteId: id, own: out.length === 0});
        return true;
    };

    switch (plan.profile.site) {
        case "ground":
        case "shore": {
            const shore = plan.profile.site === "shore";
            const suits = (x: number, z: number) => {
                const dry = dryAt(x, z, shore ? 0.2 : 0.3);
                if (!dry) return null;
                if (shore) {
                    const s = surfaceAt(x, z);
                    const sandy = (s.weights.sand ?? 0) + (s.weights.wet_sand ?? 0) + (s.weights.mud ?? 0);
                    if (sandy < 0.35 || s.height > 2.2) return null;
                }
                return dry;
            };
            // Under the sitter when it stands where it nests.
            if (sitter && !sitter.water && !sitter.micro && !sitter.canopy && suits(sitter.x, sitter.z)) {
                const dry = suits(sitter.x, sitter.z)!;
                take(`ground:${plan.sitter}:0`, {x: sitter.x, y: seatY(sitter.x, sitter.z, radius), z: sitter.z, turn: sitter.yaw, up: blendUp(dry.normal, 0.6)});
            }
            for (let k = 0; out.length < count && k < 6; k++) {
                const base = out[0] ?? from;
                const found = spiral(base.x + (k ? (random() - 0.5) * radius * 6 : 0), base.z + (k ? (random() - 0.5) * radius * 6 : 0), shore ? 45 : 30, Math.max(radius * 1.2, 0.5), (x, z) => {
                    if (out.some((other) => dist(other, {x, z}) < radius * 2.4)) return null;
                    const dry = suits(x, z);
                    return dry ? {x, z, dry} : null;
                });
                if (!found) break;
                take(`${plan.profile.site}:${plan.key}:${out.length}`, {x: found.x, y: seatY(found.x, found.z, radius), z: found.z, turn: random() * Math.PI * 2, up: blendUp(found.dry.normal, 0.6)});
            }
            break;
        }
        case "water_margin": {
            // Where the bank meets the water near the sitter: a raft floats at the surface, a mound sits in the shallows.
            for (let k = 0; out.length < count && k < count * 3; k++) {
                const base = out[0] ?? from;
                const found = spiral(base.x, base.z, 40, 0.6, (x, z) => {
                    if (out.some((other) => dist(other, {x, z}) < radius * 2.6)) return null;
                    const s = surfaceAt(x, z);
                    return s.waterDepth > 0.05 && s.waterDepth < 0.6 ? {x, z, depth: s.waterDepth, ground: s.height} : null;
                });
                if (!found) break;
                const floating = plan.profile.form === "floating";
                take(`margin:${plan.key}:${out.length}`, {x: found.x, y: floating ? 0 : Math.max(found.ground, -0.25), z: found.z, turn: random() * Math.PI * 2});
            }
            break;
        }
        case "tree_fork":
        case "tree_top":
        case "branch_tip": {
            if (sitter?.canopy && out.length === 0 && plan.profile.site !== "tree_top") take(`canopy:${plan.sitter}:0`, {x: sitter.x, y: sitter.ground - radius * 0.15, z: sitter.z, turn: sitter.yaw});
            const branches = pointsTagged("branch").filter((point) => TREE_KINDS.has(point.hostKind) && point.size[1] >= Math.min(radius * 0.4, 0.3));
            const near = branches.filter((point) => dist(point.position, from) < 70).sort((a, b) => dist(a.position, from) - dist(b.position, from) || a.id.localeCompare(b.id));
            const pool = near.length ? near : branches;
            if (plan.profile.site === "tree_top") {
                // On top of the crown, where herons, storks and fish eagles build: the highest upward-facing
                // `leaf` point of each nearby tree (on the crown's outside), the nest settled into the leaves.
                const tops = new Map<string, AttachPoint>();
                for (const point of pointsTagged("leaf")) {
                    // `open` (the attach lane's: how much of the sky the point sees) keeps it off leaves buried in the crown.
                    if (!TREE_KINDS.has(point.hostKind) || point.normal.y < 0.6 || ((point as {open?: number}).open ?? 1) < 0.3 || dist(point.position, from) > 70) continue;
                    const top = tops.get(point.host);
                    if (!top || point.position.y > top.position.y) tops.set(point.host, point);
                }
                const ranked = Array.from(tops.values()).sort((a, b) => dist(a.position, from) - dist(b.position, from) || a.id.localeCompare(b.id));
                for (const point of ranked) {
                    if (out.length >= count) break;
                    take(point.id, {x: point.position.x, y: point.position.y - radius * 0.3, z: point.position.z, turn: point.yaw});
                }
                if (out.length === 0 && sitter?.canopy) take(`canopy:${plan.sitter}:0`, {x: sitter.x, y: sitter.ground - radius * 0.15, z: sitter.z, turn: sitter.yaw});
            } else if (plan.profile.site === "branch_tip") {
                // Out at the tips of one tree's branches (a weaver colony hangs from one tree).
                const first = pool[0];
                const tree = first ? hostTree(first.host) : null;
                const sameTree = first ? pool.filter((point) => point.host === first.host) : [];
                const tips = sameTree.sort((a, b) => (tree ? dist(b.position, tree) - dist(a.position, tree) : 0) || a.id.localeCompare(b.id));
                for (const point of tips) {
                    if (out.length >= count) break;
                    if (out.some((other) => Math.hypot(other.x - point.position.x, other.y - point.position.y, other.z - point.position.z) < radius * 2.2)) continue;
                    take(point.id, {x: point.position.x, y: point.position.y - 0.02, z: point.position.z, turn: point.yaw});
                }
            } else {
                // A fork low in the crown: the nearest branch two to six metres up.
                const low = pool.filter((point) => {
                    const ground = groundUnder(point);
                    return point.position.y - ground > 1.4 && point.position.y - ground < 7;
                });
                for (const point of low.length ? low : pool) {
                    if (out.length >= count) break;
                    take(point.id, {x: point.position.x, y: point.position.y - radius * 0.08, z: point.position.z, turn: point.yaw});
                }
            }
            break;
        }
        case "trunk_hole": {
            // A drawn `tree_hollow` near the bird first (the attach lane's: the asset tree draws the hole), else a sideways
            // `bark` point more than a metre up, where the props cut one.
            const byDistance = (a: AttachPoint, b: AttachPoint) => dist(a.position, from) - dist(b.position, from) || a.id.localeCompare(b.id);
            const hollows = pointsTagged("tree_hollow").filter((point) => dist(point.position, from) < 80).sort(byDistance);
            // The cheap tests first and the nearest first; the height over the ground only for the points looked at.
            const bark = pointsTagged("bark").filter((point) => TREE_KINDS.has(point.hostKind) && Math.abs(point.normal.y) < 0.35).sort(byDistance);
            const pool = [...hollows, ...bark];
            for (const point of pool) {
                if (out.length >= count) break;
                if (used.has(point.host)) continue;
                if (point.tag === "bark" && !(point.position.y - groundUnder(point) > 1.0)) continue;
                // A `tree_hollow` is a hole the asset tree draws itself: the props add nothing over it.
                if (take(point.id, {x: point.position.x, y: point.position.y, z: point.position.z, turn: Math.atan2(point.normal.x, point.normal.z), drawn: point.tag === "tree_hollow"})) used.add(point.host);
            }
            break;
        }
        case "cliff_ledge": {
            const zone = plan.zone === "farm_garden" || plan.zone === "river_lake" ? "seashore" : plan.zone;
            // The sampler's ledges: a steep point of a cliff (`ledge:ground:N`, up is up, `forward` out of the cliff) or the
            // level top of a big rock (`ledge:decorN:0`).
            const ledges = [...propsPoints("ledge", {x: from.x, z: from.z, radius: 90}, zone), ...propsPoints("ledge", {x: corner.x, z: corner.z, radius: 160})];
            for (const ledge of ledges) {
                if (out.length >= count) break;
                const out3 = ledge.forward ?? {x: Math.sin(ledge.yaw), y: 0, z: Math.cos(ledge.yaw)};
                const flat = Math.hypot(out3.x, out3.z) || 1;
                const outward = {x: out3.x / flat, z: out3.z / flat};
                const turn = Math.atan2(outward.x, outward.z);
                if (ledge.host !== "ground") {
                    // A rock's shelf: the nest sits on it, if the rock is big enough to hold it.
                    if (ledge.size[1] < radius * 0.8) continue;
                    take(ledge.id, {x: ledge.x, y: ledge.y, z: ledge.z, turn, up: blendUp(ledge.normal, 0.5)});
                    continue;
                }
                // The steep point is the cliff; the nest is on the level shelf at its top, the drop in front of it.
                const shelf = cliffShelf(ledge, outward, radius);
                if (!shelf) continue;
                take(ledge.id, {x: shelf.x, y: shelf.y, z: shelf.z, turn, up: blendUp(shelf.normal, 0.5)});
            }
            break;
        }
        case "eaves": {
            // The back and side eaves first: the front's is over the porch roof, where nothing would be seen.
            const eaves = propsPoints("house_eave", {x: COTTAGE.x, z: COTTAGE.z, radius: 12}).sort((a, b) => Number(a.z - COTTAGE.z > COTTAGE.depth / 2 - 0.2 + COTTAGE.overhang * 0.3) - Number(b.z - COTTAGE.z > COTTAGE.depth / 2 - 0.2 + COTTAGE.overhang * 0.3) || a.id.localeCompare(b.id));
            for (const point of eaves) {
                for (let n = 0; n < 3 && out.length < count; n++) {
                    // Tucked in at the top of the wall, its back to it; a colony spaced along the eave.
                    const wall = wallOut(point);
                    const along = (n - 1) * radius * 2.6;
                    // The eave point is `out` from the wall under the overhang: the nest goes back against the wall's face.
                    const out = COTTAGE.overhang * 0.6;
                    const back = out - 0.004;
                    const x = point.x + Math.cos(wall) * along - Math.sin(wall) * back;
                    const z = point.z - Math.sin(wall) * along - Math.cos(wall) * back;
                    // Wholly under the drawn roof: the underside falls away from the wall (the eave point's normal gives
                    // its slope; none under a gable's verge), so the nest's top is under the underside at its front edge.
                    const slope = Math.hypot(point.normal.x, point.normal.z) / Math.max(Math.abs(point.normal.y), 1e-3);
                    const reach = radius * (plan.profile.form === "ball" ? 1.4 : 1.02);
                    const tall = radius * (plan.profile.form === "ball" ? 1.9 : plan.profile.closed ? 1.32 : 1.08);
                    const underside = point.y + (out - reach) * slope;
                    take(`${point.id}:${n}`, {x, y: Math.min(underside, point.y + out * slope) - 0.025 - tall, z, turn: wall});
                }
                if (out.length >= count) break;
            }
            break;
        }
        case "barn": {
            const barn = worldDecor().find((item) => item.kind === "barn");
            if (barn) {
                const c = Math.cos(barn.rotation);
                const s = Math.sin(barn.rotation);
                take("barn:gable:0", {x: barn.x + 3.24 * c, y: barn.y + 3.9, z: barn.z - 3.24 * s, turn: barn.rotation + Math.PI / 2});
            }
            break;
        }
        case "bank": {
            const banks = propsPoints("burrow", {x: from.x, z: from.z, radius: 70}).filter((point) => !used.has(point.id));
            const zoneFirst = banks.filter((point) => point.zone === plan.zone);
            for (const point of zoneFirst.length ? zoneFirst : banks) {
                if (out.length >= count) break;
                take(point.id, {x: point.x, y: surfaceAt(point.x, point.z).height, z: point.z, turn: Math.atan2(point.normal.x, point.normal.z), up: blendUp(point.normal, 0.5)});
            }
            break;
        }
        default:
            break;
    }
    return out;
}

/**
 * A shelf at the top of a cliff: from a steep point, uphill (against its
 * outward normal) to the first spot level enough for a nest of `radius`
 * whose front still drops away (at least a metre within two radii of it).
 */
function cliffShelf(ledge: PropsPoint, outward: {x: number; z: number}, radius: number): {x: number; y: number; z: number; normal: {x: number; y: number; z: number}} | null {
    const step = Math.max(radius * 0.5, 0.35);
    for (let k = 1; k <= 16; k++) {
        const x = ledge.x - outward.x * step * k;
        const z = ledge.z - outward.z * step * k;
        const s = surfaceAt(x, z);
        if (s.waterDepth > 0 || s.normal.y < 0.82) continue;
        const front = surfaceAt(x + outward.x * (radius * 2 + 0.6), z + outward.z * (radius * 2 + 0.6)).height;
        if (s.height - front < 1) continue;
        // Seated: no deeper into the slope than a fifth of the nest, never floating off its low side by more.
        const low = seatY(x, z, radius);
        return {x, y: Math.max(low, s.height - radius * 0.2), z, normal: s.normal};
    }
    return null;
}

/** Up, part way from straight up toward the ground's normal. */
function blendUp(normal: {x: number; y: number; z: number}, amount: number): {x: number; y: number; z: number} {
    const x = normal.x * amount;
    const y = 1 - amount + normal.y * amount;
    const z = normal.z * amount;
    const l = Math.hypot(x, y, z) || 1;
    return {x: x / l, y: y / l, z: z / l};
}

/** The heading out of the cottage wall an eave point is on (its back to the wall). */
function wallOut(point: PropsPoint): number {
    const dx = point.x - COTTAGE.x;
    const dz = point.z - COTTAGE.z;
    if (Math.abs(dx) > COTTAGE.width / 2 - 0.1 && Math.abs(dx) / COTTAGE.width > Math.abs(dz) / COTTAGE.depth) return Math.sign(dx) * Math.PI / 2;
    return dz > 0 ? 0 : Math.PI;
}
