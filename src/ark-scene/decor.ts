/**
 * What grows and stands in each zone, placed once from a fixed seed so every
 * viewer sees the same world: layered rainforest canopy, mixed woodland,
 * conifers climbing the mountain, acacias on the savanna, cacti and dry
 * shrubs in the desert, palms on the coast, reeds and lily pads in the
 * wetland and the lake, coral and kelp on the reef, rocks in clusters, and
 * at Home a barn, hay bales, an orchard and fences. Kept out of each site's
 * clearing (the animals' ground), off the water where they don't belong and
 * away from the river.
 *
 * Grass is placed separately (`grassBlades`): it is dense, and how much of
 * it is drawn depends on the device.
 */

import {COTTAGE, GARDEN_POND, microDecor} from "@/ark-scene/micro-decor";
import {cropsGrowAt, ORCHARD} from "@/ark-scene/fields";
import {hamletKeeps, hamletLotAt} from "@/ark-scene/props/hamlet-land";
import {ZONE_PALETTES} from "@/ark-scene/palettes";
import {treeBody, TreeSpacing} from "@/ark-scene/tree-spacing";
import {rockAssetFor, rockBox} from "@/ark-scene/rock-assets";
import {allMounds, moundFoot} from "@/ark-scene/mounds";
import {fbm, LAKE, LANE_WIDTH, laneDistance, noise, riverDistance, sampleGround, seeded, smoothstep, TERRAIN_HALF, VILLAGE_REACH, ZONE_SITES, zoneAt, type GroundSample} from "@/ark-scene/world";
import type {ArkZone} from "@/ark-scene/types";

export type DecorKind =
    | "broadleaf"
    | "rainforest"
    | "conifer"
    | "acacia"
    | "palm"
    | "shrub"
    | "cactus"
    | "rock"
    | "reed"
    | "lily"
    | "coral"
    | "kelp"
    | "barn"
    | "hay"
    | "fence"
    | "orchard"
    // The microhabitats (`micro-decor.ts`): the cottage and its pond are drawn by `micro-scene.ts`, the rest instanced here.
    | "cottage"
    | "pond"
    | "flower"
    | "leaf"
    // The canopy's trees (`micro-decor.ts` canopyTree): limbs to perch, climb and hang on.
    | "canopy"
    // A lamp post at each land zone's micro corner (drawn by `micro-scene.ts`).
    | "lamp";

export type DecorItem = {
    kind: DecorKind;
    /** Which of the kind's shapes. */
    variant: number;
    x: number;
    y: number;
    z: number;
    /** Overall size (1 = the kind's usual size). */
    scale: number;
    rotation: number;
    color: string;
};

type Pick = (roll: number) => DecorKind | null;

/** Per zone: tries per 100 m² (out of MAX_DENSITY), and what each try becomes. */
const GROWTH: Partial<Record<ArkZone, {density: number; pick: Pick}>> = {
    rainforest: {density: 4.8, pick: (r) => (r < 0.55 ? "rainforest" : r < 0.78 ? "broadleaf" : r < 0.96 ? "shrub" : "rock")},
    woodland: {density: 3.4, pick: (r) => (r < 0.6 ? "broadleaf" : r < 0.88 ? "conifer" : r < 0.95 ? "shrub" : "rock")},
    mountains: {density: 1.1, pick: (r) => (r < 0.5 ? "conifer" : r < 0.62 ? "shrub" : "rock")},
    grassland: {density: 0.22, pick: (r) => (r < 0.5 ? "acacia" : r < 0.8 ? "shrub" : "rock")},
    desert: {density: 0.4, pick: (r) => (r < 0.32 ? "cactus" : r < 0.66 ? "shrub" : "rock")},
    wetland: {density: 2.6, pick: (r) => (r < 0.88 ? "reed" : r < 0.94 ? "broadleaf" : "shrub")},
    river_lake: {density: 0.7, pick: (r) => (r < 0.5 ? "reed" : r < 0.8 ? "broadleaf" : "rock")},
    farm_garden: {density: 0.12, pick: (r) => (r < 0.7 ? "broadleaf" : "shrub")},
    seashore: {density: 0.22, pick: (r) => (r < 0.45 ? "palm" : "rock")},
    polar: {density: 0.3, pick: () => "rock"}
};

const MAX_DENSITY = 5;

/**
 * Where nothing of the decor grows outside the forests (home growth): on the hamlet's lanes and their verges, and on
 * its reserved plots and a couple of metres round them (`props/hamlet-land.ts`, the baked footprints): the gardens,
 * yards and paddocks are the props' and the residents'. Trees stand between the plots and in the fields round them.
 */
function inVillage(x: number, z: number): boolean {
    if (laneDistance(x, z) < LANE_WIDTH / 2 + 2) return true;
    for (const [dx, dz] of [[0, 0], [2, 0], [-2, 0], [0, 2], [0, -2]]) if (hamletLotAt(x + dx, z + dz)) return true;
    return false;
}

/** The forests and the high ground keep every tree, even near the hamlet's lanes (the river's far bank). */
const FOREST_ZONES: ReadonlySet<ArkZone> = new Set<ArkZone>(["rainforest", "woodland", "mountains", "polar"]);

const WOODS_TREES = new Set<DecorKind>(["broadleaf", "rainforest", "conifer"]);

/**
 * How open the woods stand at a spot (graphics batch 6, owner: "the trees are too dense"): 0 in a glade (broad open
 * patches a few tens of metres across), rising to 1 in the deep woods, with a ragged edge where the forest fades into
 * its neighbour. 1 outside the rainforest and the woodland. Shared by the decor trees and the forest fill.
 */
function woodsCover(x: number, z: number, sample: GroundSample, zone: ArkZone): number {
    if (zone !== "rainforest" && zone !== "woodland") return 1;
    const glade = 1 - smoothstep(0.52, 0.6, fbm(x * 0.028 + 41, z * 0.028 - 17));
    const edge = smoothstep(0.45, 0.85, (sample.weights[zone] ?? 0) + 0.3 * (fbm(x * 0.09 - 5, z * 0.09 + 9) - 0.5));
    return glade * edge;
}

/**
 * Trees at a believable size beside the cottage (graphics pass, batch 2): its ridge is 4.3 m, so a broadleaf now
 * stands 5–9 m and a rainforest tree 9–15 m. Everything that reads a tree's size (bark animals, obstacles, attach
 * points) takes it from the item's scale, so they follow.
 */
const TREE_SIZE: Partial<Record<DecorKind, number>> = {broadleaf: 1.5, rainforest: 1.45, conifer: 1.6, acacia: 1.35, palm: 1.3, orchard: 1.15};

function tone(zone: ArkZone, kind: DecorKind, r: number): string {
    const palette = ZONE_PALETTES[zone];
    switch (kind) {
        case "rock":
            if (zone === "polar") return r < 0.5 ? "#eef4f7" : "#dbe6ec";
            if (zone === "desert") return r < 0.5 ? "#c39066" : "#ad7f58";
            if (zone === "mountains") return r < 0.5 ? "#8f877a" : "#7b7468";
            return r < 0.5 ? "#958c7c" : "#827a6c";
        case "reed":
            return r < 0.5 ? "#b2a565" : "#8f8f4f";
        case "shrub":
            if (zone === "desert") return r < 0.5 ? "#9c8a5a" : "#8a7a4c";
            return r < 0.5 ? "#5f7535" : "#6f7f3c";
        case "cactus":
            return r < 0.5 ? "#6d8a4c" : "#5d7a44";
        case "palm":
            return r < 0.5 ? "#6f8f3a" : "#7d9a42";
        case "acacia":
            return r < 0.5 ? "#6f7c38" : "#7d8540";
        case "conifer":
            return r < 0.5 ? "#3f5a35" : "#4a6439";
        case "rainforest":
            return r < 0.33 ? "#3e6a2c" : r < 0.66 ? "#355f29" : "#4b7531";
        default:
            return r < 0.5 ? palette.growth[0] : palette.growth[1];
    }
}

let cached: DecorItem[] | null = null;

/**
 * The scatter's trees, kept apart (scenery lane, the motion 100x pass; the owner: "trees grow inside each other"): a
 * tree that would grow into one already standing (`tree-spacing.ts`: trunk to trunk, a trunk through a crown, crowns
 * fused) is grown smaller, as a younger tree in the gap; if even that would clash it stands as an understorey shrub
 * instead (the glade rule's way), and a shrub that would stand in a trunk is smaller, or steps a metre aside.
 *
 * Mature trees are placed first (every candidate at its full size, in the scatter's order), then the younger ones in
 * the gaps left, then the shrubs: a sapling never takes a big tree's place, so the woods keep their big trees and
 * their thick limbs. Decided after every skip test and with no extra draw, so the scatter's draws, and every decor
 * index, stay where they were.
 */
const MATURE = [1, 0.85];
const YOUNGER = [0.7, 0.55, 0.42];
const SMALLER_SHRUB = [1, 0.75, 0.55];

/** The tree grown to the first of these sizes that fits (and kept), the tree as it is when it is not drawn as a tree, or null. */
function grow(spacing: TreeSpacing, item: DecorItem, sizes: number[]): DecorItem | null {
    for (const f of sizes) {
        const grown = f === 1 ? item : {...item, scale: item.scale * f};
        const body = treeBody(grown);
        // Not a tree as drawn (an asset tree left off a bare rock face): nothing to keep apart.
        if (!body) return grown;
        if (spacing.fits(body)) {
            spacing.add(body);
            return grown;
        }
    }
    return null;
}

/** A shrub, smaller where it would stand in a trunk; with `aside`, the smallest steps a metre or so out of the way. */
function shrubAt(spacing: TreeSpacing, under: DecorItem, aside: boolean): DecorItem | null {
    for (const f of SMALLER_SHRUB) {
        const grown = f === 1 ? under : {...under, scale: under.scale * f};
        const body = treeBody(grown)!;
        if (spacing.fits(body)) {
            spacing.add(body);
            return grown;
        }
    }
    if (!aside) return null;
    const small = {...under, scale: under.scale * SMALLER_SHRUB[SMALLER_SHRUB.length - 1]};
    // Away from the trunk it stands in; or, on a rock or a mound, a metre or two out from where it was.
    const first = spacing.clashes(treeBody(small)!)[0]?.other;
    const away = first ? Math.atan2(small.z - first.z, small.x - first.x) : 0;
    const steps: Array<{x: number; z: number}> = [];
    for (const reach of first ? [Math.max(first.trunk + 0.75 * 0.65 * small.scale + 0.15, 0.6)] : [1, 2]) {
        for (const turn of [0, 1, -1, 2, -2, 3]) {
            const angle = away + turn * (Math.PI / 3);
            steps.push(first ? {x: first.x + Math.cos(angle) * reach, z: first.z + Math.sin(angle) * reach} : {x: small.x + Math.cos(angle) * reach, z: small.z + Math.sin(angle) * reach});
        }
    }
    for (const {x, z} of steps) {
        const ground = sampleGround(x, z);
        if (ground.height < 0.3 || ground.land < 0.45 || riverDistance(x, z) < 3 || Math.hypot(x - LAKE.x, z - LAKE.z) < LAKE.r + 1) continue;
        const moved = {...small, x, y: ground.height, z};
        const body = treeBody(moved)!;
        if (spacing.fits(body)) {
            spacing.add(body);
            return moved;
        }
    }
    return null;
}

type Pending = {item: DecorItem; /** What it becomes when no tree fits (null: left out). */ shrub: (() => DecorItem) | null};

/** Every pending tree and shrub settled in the order above: the item each becomes, or null when nothing fits. */
function settle(spacing: TreeSpacing, pending: Pending[], aside: boolean, free: (i: number) => boolean = () => true, take: (i: number) => void = () => {}): Array<DecorItem | null> {
    const out: Array<DecorItem | null | undefined> = pending.map(() => undefined);
    for (const sizes of [MATURE, YOUNGER]) {
        pending.forEach((p, i) => {
            if (out[i] !== undefined || p.item.kind === "shrub" || !free(i)) return;
            const grown = grow(spacing, p.item, sizes);
            if (grown) {
                out[i] = grown;
                take(i);
            }
        });
    }
    pending.forEach((p, i) => {
        if (out[i] !== undefined) return;
        const under = p.item.kind === "shrub" ? p.item : p.shrub ? p.shrub() : null;
        out[i] = under && free(i) ? shrubAt(spacing, under, aside) : null;
        if (out[i]) take(i);
    });
    return out as Array<DecorItem | null>;
}

/** A decor rock as drawn (`rock-assets.ts`), for the trees to keep their trunks out of. */
function addRockTo(spacing: TreeSpacing, item: DecorItem) {
    const placed = rockAssetFor(item);
    if (placed) spacing.addRock(rockBox(placed));
}

/** The termite mounds (`mounds.ts`), as square-ish rocks of their foot: no trunk grows out of one. */
function addMoundsTo(spacing: TreeSpacing) {
    for (const mound of allMounds()) {
        const r = moundFoot(mound);
        spacing.addRock({x: mound.x, z: mound.z, cos: 1, sin: 0, hx0: -r, hx1: r, hz0: -r, hz1: r});
    }
}

/** The decor kinds that are trees or shrubs as drawn (kept apart by `settle`). */
const SPACED = new Set<DecorKind>(["broadleaf", "rainforest", "conifer", "acacia", "palm", "orchard", "shrub", "cactus"]);

/**
 * Runtime prebuild hook (runtime/prebuild.ts): the same seeded lists, computed in a worker before the mount, handed
 * in so the mount does not compute them on the main thread. Identical output (deep-equal tests in ark-prebuild.test.ts).
 */
let primedGrass: {count: number; tufts: GrassTuft[]} | null = null;
export function primeDecor(primed: {decor?: DecorItem[]; fill?: FillItem[]; grass?: {count: number; tufts: GrassTuft[]}}): void {
    if (primed.decor) cached = primed.decor;
    if (primed.fill) fillCache = primed.fill;
    if (primed.grass) primedGrass = primed.grass;
}

export function worldDecor(): DecorItem[] {
    if (cached) return cached;
    const random = seeded(20261110);
    const items: DecorItem[] = [];
    const push = (item: DecorItem) => items.push(item);
    // The micro corners' trees (where the small animals live) stand first: the scatter gives way to them.
    const spacing = new TreeSpacing();
    for (const item of microDecor()) {
        const body = treeBody(item);
        if (body) spacing.add(body);
    }
    const pending: Array<Pending & {index: number}> = [];
    const area = (TERRAIN_HALF * 2) ** 2;
    const tries = Math.round(area / 100 * MAX_DENSITY);
    for (let i = 0; i < tries; i++) {
        const x = (random() * 2 - 1) * TERRAIN_HALF;
        const z = (random() * 2 - 1) * TERRAIN_HALF;
        const roll = random();
        const pickRoll = random();
        const toneRoll = random();
        const sizeRoll = random();
        const rotation = random() * Math.PI * 2;
        const variantRoll = random();
        const sample = sampleGround(x, z);
        if (sample.height < 0.3 || sample.land < 0.45) continue;
        const zone = zoneAt(sample);
        const growth = GROWTH[zone];
        if (!growth) continue;
        // Patchy, not even: groves and glades.
        const patch = 0.25 + 1.4 * fbm(x * 0.05 + 40, z * 0.05 - 40);
        if (roll > growth.density / MAX_DENSITY * patch) continue;
        const site = ZONE_SITES[zone];
        if (Math.hypot(x - site.x, z - site.z) < site.clearing) continue;
        if (riverDistance(x, z) < 4) continue;
        // The hamlet's village (home growth): nothing grows on its lanes and the plots along them.
        if (!FOREST_ZONES.has(zone) && inVillage(x, z)) continue;
        if (Math.hypot(x - LAKE.x, z - LAKE.z) < LAKE.r + 1.2) continue;
        const kind = growth.pick(pickRoll);
        if (!kind) continue;
        // Reeds keep to the water's edge; trees thin out up the mountain; palms keep to the sand.
        if (kind === "reed" && sample.height > 1.3) continue;
        if (kind === "conifer" && sample.height > 36) continue;
        if (kind === "broadleaf" && zone === "mountains") continue;
        if (kind === "palm" && sample.land > 0.97) continue;
        if (sample.cliff > 0.4 && kind !== "rock" && sample.land < 0.8) continue;
        const scale = kind === "rock" ? 0.5 + 1.3 * sizeRoll * sizeRoll : (0.75 + 0.55 * sizeRoll) * (TREE_SIZE[kind] ?? 1);
        const variant = Math.floor(variantRoll * 3);
        // In a glade or past the forest's ragged edge a tree stands as an understorey shrub instead (batch 6). Decided
        // after every skip test above and with no extra draw, so no decor index moves; the shrub keeps its spot.
        const open = WOODS_TREES.has(kind) && variantRoll * 3 - variant > woodsCover(x, z, sample, zone);
        const grown: DecorKind = open ? "shrub" : kind;
        const item: DecorItem = {kind: grown, variant, x, y: sample.height, z, scale: open ? 0.75 + 0.55 * sizeRoll : scale, rotation, color: tone(zone, grown, toneRoll)};
        if (SPACED.has(grown)) {
            // Settled once the whole scatter is in (mature trees first): its slot is kept.
            pending.push({index: items.length, item, shrub: () => ({...item, kind: "shrub", scale: 0.75 + 0.55 * sizeRoll, color: tone(zone, "shrub", toneRoll)})});
        }
        push(item);
        // Rocks come in clusters: a big one and a few smaller about it.
        if (kind === "rock") {
            const extra = 1 + Math.floor(random() * 3);
            for (let k = 0; k < extra; k++) {
                const angle = random() * Math.PI * 2;
                const distance = scale * (0.9 + random() * 0.9);
                const rx = x + Math.cos(angle) * distance;
                const rz = z + Math.sin(angle) * distance;
                const ground = sampleGround(rx, rz).height;
                push({kind: "rock", variant: Math.floor(random() * 3), x: rx, y: ground, z: rz, scale: scale * (0.3 + random() * 0.4), rotation: random() * Math.PI * 2, color: tone(zone, "rock", random())});
            }
        }
    }

    // The scatter's rocks as drawn, and the termite mounds: no trunk stands in one (scenery lane, the props check).
    for (const item of items) if (item.kind === "rock") addRockTo(spacing, item);
    addMoundsTo(spacing);
    // The scatter's trees and shrubs, settled (mature trees, then younger ones, then the shrubs). One that nothing fits
    // keeps its slot as an empty mark, dropped at the end, so the indices up to there hold.
    const settled = settle(spacing, pending, true);
    pending.forEach((p, i) => (items[p.index] = settled[i] ?? {...p.item, kind: "leaf", scale: 0}));

    // Rocks along the cliffs and the shore, half in the water: the waves break round them.
    for (let i = 0; i < 260; i++) {
        const theta = random() * Math.PI * 2;
        const x0 = Math.cos(theta);
        const z0 = Math.sin(theta);
        let placed = false;
        for (let r = 60; r < 100 && !placed; r += 0.8) {
            const s = sampleGround(x0 * r, z0 * r);
            if (s.height < 0.15 && s.height > -0.9) {
                const site = ZONE_SITES.seashore;
                if (Math.hypot(x0 * r - site.x, z0 * r - site.z) < 16) break;
                if (riverDistance(x0 * r, z0 * r) < 6) break;
                if (s.cliff < 0.3 && random() > 0.35) break;
                const zone = zoneAt(s);
                push({kind: "rock", variant: Math.floor(random() * 3), x: x0 * r, y: s.height, z: z0 * r, scale: 0.6 + random() * 1.4, rotation: random() * Math.PI * 2, color: tone(zone === "polar" ? "polar" : "seashore", "rock", random())});
                placed = true;
            }
        }
    }

    // Lily pads on the lake's still margins and the wetland's pools.
    for (let i = 0; i < 520; i++) {
        const nearLake = random() < 0.55;
        const angle = random() * Math.PI * 2;
        const x = nearLake ? LAKE.x + Math.cos(angle) * (LAKE.r - 1.5 - random() * 3) : ZONE_SITES.wetland.x + (random() * 2 - 1) * 22;
        const z = nearLake ? LAKE.z + Math.sin(angle) * (LAKE.r - 1.5 - random() * 3) : ZONE_SITES.wetland.z + (random() * 2 - 1) * 22;
        const s = sampleGround(x, z);
        if (s.height > -0.12 || s.height < -1.6) continue;
        if (noise(x * 0.4, z * 0.4) < 0.45) continue;
        push({kind: "lily", variant: Math.floor(random() * 3), x, y: 0.02, z, scale: 0.6 + random() * 0.6, rotation: random() * Math.PI * 2, color: random() < 0.5 ? "#5f8a3c" : "#6e9844"});
    }

    // The reef: coral heads and fans on the shallow floor, kelp swaying a little deeper.
    const reef = ZONE_SITES.coral_reef;
    // Muted, believable coral colours (graphics pass), not candy.
    const corals = ["#c8735d", "#c99a58", "#b06a78", "#8f7aa6", "#cfae86", "#c4805a"];
    for (let i = 0; i < 520; i++) {
        const angle = random() * Math.PI * 2;
        const radius = 3 + 30 * Math.sqrt(random());
        const x = reef.x + Math.cos(angle) * radius;
        const z = reef.z + Math.sin(angle) * radius;
        const height = sampleGround(x, z).height;
        if (height > -0.7 || height < -6) continue;
        if (height < -2.6 && random() < 0.7) {
            // Kelp never breaks the surface: its tallest ribbon (3.4 m) stays under.
            const scale = Math.min(0.7 + random() * 0.7, (-height - 0.5) / 3.4);
            if (scale < 0.35) continue;
            push({kind: "kelp", variant: Math.floor(random() * 3), x, y: height, z, scale, rotation: random() * Math.PI * 2, color: random() < 0.5 ? "#6f7a2e" : "#8a8a35"});
        } else {
            const coral: DecorItem = {kind: "coral", variant: Math.floor(random() * 3), x, y: height, z, scale: 0.5 + random() * 0.9, rotation: random() * Math.PI * 2, color: corals[Math.floor(random() * corals.length)]};
            // Out of the beach's clear shallows (the same random draws either way, so nothing after moves).
            if (height < -1.9) push(coral);
        }
    }

    // Home: a barn on the fields' edge, hay bales, an orchard in rows, and fences along the lanes.
    const farm = ZONE_SITES.farm_garden;
    const onFarm = (x: number, z: number) => {
        const s = sampleGround(x, z);
        return s.height > 0.4 && s.land > 0.9 && zoneAt(s) === "farm_garden" && riverDistance(x, z) > 5 && Math.hypot(x - farm.x, z - farm.z) > farm.clearing + 1;
    };
    const barn = {x: farm.x - 15, z: farm.z + 9};
    if (onFarm(barn.x, barn.z)) push({kind: "barn", variant: 0, x: barn.x, y: sampleGround(barn.x, barn.z).height, z: barn.z, scale: 1, rotation: 0.35, color: "#9a4a36"});
    for (let row = 0; row < 4; row++) {
        for (let col = 0; col < 6; col++) {
            const u = col * 3.2 + (row % 2) * 1.6;
            const v = row * 3.4;
            const x = farm.x + ORCHARD.x + u * Math.cos(ORCHARD.turn) - v * Math.sin(ORCHARD.turn);
            const z = farm.z + ORCHARD.z + u * Math.sin(ORCHARD.turn) + v * Math.cos(ORCHARD.turn);
            if (!onFarm(x, z) || laneDistance(x, z) < LANE_WIDTH / 2 + 1.5) continue;
            const tree: DecorItem = {kind: "orchard", variant: (row + col) % 3, x, y: sampleGround(x, z).height, z, scale: 0.85 + random() * 0.25, rotation: random() * Math.PI * 2, color: random() < 0.5 ? "#5f8a3a" : "#6b9440"};
            // An orchard's trees are pruned to their rows: smaller where two would grow into each other, never a shrub.
            const [kept] = settle(spacing, [{item: tree, shrub: null}], false);
            if (kept) push(kept);
        }
    }
    for (let i = 0; i < 60; i++) {
        const x = farm.x + (random() * 2 - 1) * 30;
        const z = farm.z + (random() * 2 - 1) * 24;
        // (Not in the hamlet's village: its lanes and the plots along them.)
        if (!onFarm(x, z) || noise(x * 0.12, z * 0.12) < 0.5 || laneDistance(x, z) < VILLAGE_REACH) continue;
        push({kind: "hay", variant: 0, x, y: sampleGround(x, z).height, z, scale: 0.9 + random() * 0.2, rotation: random() * Math.PI, color: "#d8b45c"});
    }
    // Fences: lines of posts and rails along the field boundaries (the fields' own grid, turned as the shader turns them).
    const along = {x: 0.94, z: 0.34};
    const across = {x: -0.34, z: 0.94};
    for (const line of [-2, 1, 3]) {
        for (let k = -14; k < 14; k++) {
            // A field boundary every 6.5 m across, segments 2.4 m long along it.
            const u = k * 2.4;
            const v = line * 6.5 + 0.2;
            const wx = along.x * u + across.x * v;
            const wz = along.z * u + across.z * v;
            if (!onFarm(wx, wz) || noise(wx * 0.08 + 11, wz * 0.08) < 0.35) continue;
            push({kind: "fence", variant: 0, x: wx, y: sampleGround(wx, wz).height, z: wz, scale: 1, rotation: -Math.atan2(along.z, along.x), color: "#8a6a48"});
        }
    }

    // The microhabitats: the cottage at Home with its garden, and a corner of flowers, litter and stones in every land zone.
    // Nothing of the farm stands in the cottage, its porch or its pond.
    const clear = (item: DecorItem) => {
        const inCottage = Math.abs(item.x - COTTAGE.x) < COTTAGE.width / 2 + 1.4 && item.z - COTTAGE.z < COTTAGE.depth / 2 + COTTAGE.porch.depth + 1.6 && COTTAGE.z - item.z < COTTAGE.depth / 2 + 1.4;
        return !inCottage && Math.hypot(item.x - GARDEN_POND.x, item.z - GARDEN_POND.z) > GARDEN_POND.radius + 0.8;
    };
    const kept = items.filter((item) => item.scale > 0 && clear(item));
    for (const item of microDecor()) kept.push({kind: item.kind, variant: item.variant, x: item.x, y: item.y, z: item.z, scale: item.scale, rotation: item.rotation, color: item.color});

    cached = kept;
    return kept;
}

/** Grass tufts, densest on the meadows, thinning to nothing on sand, rock, snow and the fields. */
export type GrassTuft = {x: number; y: number; z: number; scale: number; rotation: number; zone: ArkZone; dry: number};

export function grassTufts(count: number): GrassTuft[] {
    if (primedGrass && primedGrass.count === count) {
        const tufts = primedGrass.tufts;
        primedGrass = null;
        return tufts;
    }
    const random = seeded(77001);
    const tufts: GrassTuft[] = [];
    const meadow: Partial<Record<ArkZone, number>> = {grassland: 1, woodland: 0.75, farm_garden: 0.55, river_lake: 0.85, wetland: 0.6, rainforest: 0.45, mountains: 0.35, seashore: 0.12};
    let guard = 0;
    while (tufts.length < count && guard++ < count * 12) {
        const x = (random() * 2 - 1) * 100;
        const z = (random() * 2 - 1) * 100;
        const s = sampleGround(x, z);
        if (s.height < 0.35 || s.land < 0.85 || s.height > 20) continue;
        const zone = zoneAt(s);
        // Fuller round the animals' own ground, where the camera comes close.
        const site = ZONE_SITES[zone];
        const nearAnimals = site.kind === "land" && Math.hypot(x - site.x, z - site.z) < site.clearing + 6 ? 1.8 : 1;
        const want = (meadow[zone] ?? 0) * nearAnimals * smoothstep(0.15, 0.5, fbm(x * 0.06 - 7, z * 0.06 + 3) + (nearAnimals > 1 ? 0.2 : 0));
        if (random() > want) continue;
        if (riverDistance(x, z) < 3) continue;
        // Not through the garden pond's water or the cottage's floor.
        if (Math.hypot(x - GARDEN_POND.x, z - GARDEN_POND.z) < GARDEN_POND.radius + 0.3 || (Math.abs(x - COTTAGE.x) < COTTAGE.width / 2 + 0.2 && Math.abs(z - COTTAGE.z - COTTAGE.porch.depth / 2) < COTTAGE.depth / 2 + COTTAGE.porch.depth / 2 + 0.2)) continue;
        // Not among the crops (graphics batch 5): meadow grass keeps to the fields' margins and the pasture. The draws
        // a tuft would take (scale, turn, dryness) are still taken, so the grass everywhere else stays where it was.
        // Nor on the hamlet's reserved plots: none under a house or a barn, about half on the rest of a plot
        // (props/hamlet-land.ts; a hash, not a draw, so every other tuft stays where it was).
        if (cropsGrowAt(x, z) || !hamletKeeps(x, z, (Math.abs(Math.sin(x * 12.9898 + z * 78.233) * 43758.5453) % 1))) {
            random();
            random();
            if (zone !== "mountains") random();
            continue;
        }
        tufts.push({x, y: s.height, z, scale: 0.45 + random() * 0.4, rotation: random() * Math.PI * 2, zone, dry: zone === "grassland" ? 0.3 + 0.45 * random() : zone === "mountains" ? 0.3 : 0.12 * random()});
    }
    return tufts;
}

/** Trunks, rocks and buildings the animals keep clear of: a coarse grid of (x, z, radius). */
export class DecorObstacles {
    private readonly cells = new Map<string, Array<[number, number, number, number]>>();
    private static readonly CELL = 6;

    constructor(items: DecorItem[]) {
        for (const item of items) {
            if (item.kind === "coral" || item.kind === "reed" || item.kind === "lily" || item.kind === "kelp" || item.kind === "fence" || item.kind === "flower" || item.kind === "leaf") continue;
            const radius = item.kind === "rock" ? 0.9 * item.scale : item.kind === "barn" ? 5.5 : item.kind === "cottage" ? 4.4 : item.kind === "pond" ? item.scale + 0.5 : item.kind === "lamp" ? 0.3 : item.kind === "hay" ? 1.1 : 0.9;
            // Tall enough to stand between an animal and the camera: trees, shrubs, cacti, a big rock.
            const tall = item.kind === "rock" ? radius >= 0.65 : item.kind !== "hay" && item.kind !== "barn" && item.kind !== "pond";
            const key = this.key(item.x, item.z);
            const list = this.cells.get(key) ?? [];
            list.push([item.x, item.z, radius, tall ? 1 : 0]);
            this.cells.set(key, list);
        }
    }

    private key(x: number, z: number): string {
        return `${Math.floor(x / DecorObstacles.CELL)},${Math.floor(z / DecorObstacles.CELL)}`;
    }

    blocked(x: number, z: number, clearance: number): boolean {
        const cx = Math.floor(x / DecorObstacles.CELL);
        const cz = Math.floor(z / DecorObstacles.CELL);
        for (let dx = -1; dx <= 1; dx++) {
            for (let dz = -1; dz <= 1; dz++) {
                for (const [ox, oz, r] of this.cells.get(`${cx + dx},${cz + dz}`) ?? []) {
                    if (Math.hypot(x - ox, z - oz) < r + clearance) return true;
                }
            }
        }
        return false;
    }

    /**
     * Something tall just in front of this spot as the default camera sees
     * it (from the south, +z): a tree, a shrub or a big rock between about 1
     * and 5.5 m nearer the camera and across the line of sight, so an animal
     * here is partly behind it from afar and in plain view from close by.
     */
    covers(x: number, z: number): boolean {
        const cx = Math.floor(x / DecorObstacles.CELL);
        const cz = Math.floor(z / DecorObstacles.CELL);
        for (let dx = -1; dx <= 1; dx++) {
            for (let dz = 0; dz <= 1; dz++) {
                for (const [ox, oz, r, tall] of this.cells.get(`${cx + dx},${cz + dz}`) ?? []) {
                    if (!tall) continue;
                    const ahead = oz - z;
                    if (ahead > 0.9 + r * 0.5 && ahead < 5.5 && Math.abs(ox - x) < r + 0.3) return true;
                }
            }
        }
        return false;
    }
}

// MARK: - Graphics pass: the forest fill

/**
 * More trees (graphics pass, batch 1): the forests filled in, 5–10× the
 * decor's own trees, in natural clumps and glades. Visual only: they are not
 * obstacles and not perches (the decor's own trees keep those jobs), and they
 * keep out of every site's clearing, the river, the lake, the farm and the
 * cottage, so no animal stands in one. `rank` (0…1) orders them for the
 * tiers: a tier draws the ones under its fraction.
 */
export type FillItem = DecorItem & {rank: number};

/**
 * How many more trees the fill offers than it used to in the woods and on the mountain (scenery lane): with trees kept
 * apart (`tree-spacing.ts`), most of the old offers there grew into a neighbour and are left out, so the clumps are
 * offered more, and fill up to crowns that touch without growing into each other; the glades stay open (woodsCover still
 * decides them). The open country (grassland, farmland, the wetland and the lakeside) keeps its own sparse fill: there
 * the spacing seldom binds, and more offers would only be more trees where the animals graze, meet and sleep.
 */
const FILL_OFFERED = 2.5;
const FILL_OFFERED_IN: ReadonlySet<ArkZone> = new Set<ArkZone>(["rainforest", "woodland", "mountains"]);

let fillCache: FillItem[] | null = null;

export function forestFill(): FillItem[] {
    if (fillCache) return fillCache;
    const random = seeded(20261111);
    const items: FillItem[] = [];
    // A coarse grid keeps trunks at least ~2.4 m apart.
    const taken = new Set<string>();
    const candidates: Array<{key: string; item: FillItem}> = [];
    const cell = 2.4;
    // Graphics batch 6 (owner: "the trees are too dense"): about half the forest fill it had, so the woods read as
    // leafy but broken up from the island view, trunks and understorey show between the crowns, and the animals in
    // them can be seen; in the rainforest a lower canopy of broadleaves under fewer emergents.
    const kinds: Partial<Record<ArkZone, {density: number; pick: Pick}>> = {
        rainforest: {density: 0.16, pick: (r) => (r < 0.4 ? "rainforest" : r < 0.82 ? "broadleaf" : "shrub")},
        woodland: {density: 0.14, pick: (r) => (r < 0.55 ? "broadleaf" : r < 0.86 ? "conifer" : "shrub")},
        mountains: {density: 0.11, pick: (r) => (r < 0.82 ? "conifer" : "shrub")},
        river_lake: {density: 0.05, pick: (r) => (r < 0.7 ? "broadleaf" : "shrub")},
        wetland: {density: 0.035, pick: (r) => (r < 0.6 ? "broadleaf" : "shrub")},
        grassland: {density: 0.012, pick: (r) => (r < 0.6 ? "acacia" : "shrub")},
        farm_garden: {density: 0.012, pick: (r) => (r < 0.6 ? "broadleaf" : "shrub")}
    };
    const densest = Math.max(...Object.values(kinds).map((growth) => growth!.density));
    // Kept apart from the decor's trees and from each other (scenery lane): a fill tree that would grow into another is
    // grown smaller, or left out; a left-out one does not take its cell, so the next try there may stand.
    const spacing = new TreeSpacing();
    for (const item of worldDecor()) {
        const body = treeBody(item);
        if (body) spacing.add(body);
        if (item.kind === "rock") addRockTo(spacing, item);
    }
    addMoundsTo(spacing);
    const tries = 220000;
    for (let i = 0; i < tries; i++) {
        const x = (random() * 2 - 1) * TERRAIN_HALF;
        const z = (random() * 2 - 1) * TERRAIN_HALF;
        const roll = random();
        const pickRoll = random();
        const sizeRoll = random();
        const toneRoll = random();
        const rotation = random() * Math.PI * 2;
        const variant = Math.floor(random() * 3);
        const rank = random();
        // Clumps and glades: dense where the noise is high, open where it is low. Tested first against the densest
        // zone's density (it needs no ground sample), so most tries skip sampleGround: the same trees, 2.3× faster.
        const clump = smoothstep(0.38, 0.72, fbm(x * 0.045 + 13, z * 0.045 - 21));
        if (roll > densest * clump * 6 * FILL_OFFERED) continue;
        const sample = sampleGround(x, z);
        if (sample.height < 0.5 || sample.land < 0.7 || sample.cliff > 0.35) continue;
        const zone = zoneAt(sample);
        const growth = kinds[zone];
        if (!growth) continue;
        // The woods only (batch 6): none in the glades, fewer towards the ragged edge.
        if (roll > growth.density * clump * 6 * (FILL_OFFERED_IN.has(zone) ? FILL_OFFERED : 1) * woodsCover(x, z, sample, zone)) continue;
        const kind = growth.pick(pickRoll);
        if (!kind) continue;
        if (kind === "conifer" && sample.height > 22) continue;
        if (sample.height > 8 && Math.hypot(sampleGround(x + 1.5, z).height - sampleGround(x - 1.5, z).height, sampleGround(x, z + 1.5).height - sampleGround(x, z - 1.5).height) / 3 > 0.75) continue;
        const site = ZONE_SITES[zone];
        if (Math.hypot(x - site.x, z - site.z) < site.clearing + 2) continue;
        if (riverDistance(x, z) < 5) continue;
        if (Math.hypot(x - LAKE.x, z - LAKE.z) < LAKE.r + 3) continue;
        if (Math.hypot(x - COTTAGE.x, z - COTTAGE.z) < 16 || Math.hypot(x - ZONE_SITES.farm_garden.x, z - ZONE_SITES.farm_garden.z) < 22) continue;
        if (!FOREST_ZONES.has(zone) && inVillage(x, z)) continue;
        const key = `${Math.floor(x / cell)},${Math.floor(z / cell)}`;
        const scale = kind === "shrub" ? 0.7 + 0.6 * sizeRoll : (0.7 + 0.65 * sizeRoll) * (TREE_SIZE[kind] ?? 1);
        candidates.push({key, item: {kind, variant, x, y: sample.height, z, scale, rotation, color: tone(zone, kind, toneRoll), rank}});
    }
    // Settled as the decor's are (mature trees first, then younger ones, then shrubs), one to a grid cell. A fill tree
    // that cannot stand as a tree is left out (the decor's own shrubs are the understorey).
    const settled = settle(spacing, candidates.map(({item}) => ({item, shrub: null})), false, (i) => !taken.has(candidates[i].key), (i) => taken.add(candidates[i].key));
    settled.forEach((item) => item && items.push(item as FillItem));
    items.sort((a, b) => a.rank - b.rank);
    fillCache = items;
    return items;
}

// MARK: - Rock shape (shared by vegetation.ts, which draws it, and sampler.ts, which puts attach points on it)

const rockBumps = new Map<number, Array<[number, number, number]>>();

/** The rock shape's radius along a unit direction (before its 1.1 × 0.62 × 0.95 squash and 0.18 lift), per variant. */
export function rockRadius(variant: number, dx: number, dy: number, dz: number): number {
    let bumps = rockBumps.get(variant);
    if (!bumps) {
        const random = seeded(551 + variant);
        bumps = Array.from({length: 6}, () => {
            const x = random() * 2 - 1;
            const y = random() * 2 - 1;
            const z = random() * 2 - 1;
            const l = Math.hypot(x, y, z) || 1;
            return [x / l, y / l, z / l] as [number, number, number];
        });
        rockBumps.set(variant, bumps);
    }
    let push = 0;
    for (const [bx, by, bz] of bumps) push += Math.max(dx * bx + dy * by + dz * bz, 0) ** 3 * 0.22;
    const facet = Math.floor((dx * 2.3 + dz * 1.7 + 4) % 3) * 0.015;
    const grain = Math.sin(dx * 13.1 + variant) * Math.sin(dz * 11.7 + dy * 9.3) * 0.035;
    return 0.85 * (0.85 + push - 0.08 * Math.abs(dy) + facet + grain);
}

/** A rock's own height squash (0.8–1.2), from where it lies, so every viewer and the attach points agree. */
export function rockSquash(item: {x: number; z: number}): number {
    const h = Math.sin(item.x * 12.9898 + item.z * 78.233) * 43758.5453;
    return 0.8 + 0.4 * (h - Math.floor(h));
}

/** A point on a rock's surface in the world, along a direction in its own frame (y up), and the surface's rough normal. */
export function rockSurfacePoint(item: DecorItem, variants: number, dx: number, dy: number, dz: number): {x: number; y: number; z: number; nx: number; ny: number; nz: number} {
    const l = Math.hypot(dx, dy, dz) || 1;
    const ux = dx / l;
    const uy = dy / l;
    const uz = dz / l;
    const r = rockRadius(item.variant % variants, ux, uy, uz);
    const squash = rockSquash(item);
    const lx = ux * r * 1.1 * item.scale;
    const ly = (uy * r * 0.62 + 0.18) * item.scale * squash;
    const lz = uz * r * 0.95 * item.scale;
    const c = Math.cos(item.rotation);
    const sn = Math.sin(item.rotation);
    // three's rotation about y: x' = x cos + z sin, z' = -x sin + z cos.
    const x = item.x + lx * c + lz * sn;
    const z = item.z - lx * sn + lz * c;
    // The ellipsoid's normal: the direction divided by the squash, turned the same way.
    let nx = ux / 1.1;
    let ny = uy / (0.62 * squash);
    let nz = uz / 0.95;
    const nl = Math.hypot(nx, ny, nz) || 1;
    nx /= nl;
    ny /= nl;
    nz /= nl;
    return {x, y: item.y - DECOR_SINK_ROCK + ly, z, nx: nx * c + nz * sn, ny, nz: -nx * sn + nz * c};
}

/** How far the instanced decor is sunk (micro-decor.ts DECOR_SINK), repeated here to keep this module free of cycles. */
const DECOR_SINK_ROCK = 0.08;
