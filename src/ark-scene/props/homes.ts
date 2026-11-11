/**
 * Nests, homes and structures (the owner's brief, section 5), shown only
 * where the species is present (`presence.ts`): birds' nests in tree forks,
 * on ledges, on the ground and under the eaves, with eggs and chicks when the
 * server has a clutch in or young were born; ant mounds and their trails up a
 * trunk (and up the cottage's wall); a wild bees' comb in a tree hollow and a
 * hive in the garden; a wasps' nest under the eaves; termite mounds; webs
 * between branches and on the porch (dew on them is `effects.ts`); cocoons
 * and chrysalises under leaves; a rabbits' warren; worm casts; dens and
 * lairs; the turtles' nest on the beach; a beavers' lodge and dam; snail
 * trails glinting on rocks, the wall and the path. (The bats' roost is in
 * the cave, `cave.ts`; burrow mouths and molehills stay `layers-scene.ts`'s.)
 *
 * Built again only when what is present changes. Positions come from the
 * scene's placements (a bird's nest under the bird that sits it) or from the
 * scenery's attach points by tag (`sampler.ts`), never from raw coordinates,
 * except for the few places the scenery interface does not name yet.
 */

import {BoxGeometry, BufferAttribute, BufferGeometry, Color, Group, LineBasicMaterial, LineSegments, Matrix4, MeshStandardMaterial, Vector3} from "three";
import {COTTAGE} from "@/ark-scene/micro-decor";
import type {Placement} from "@/ark-scene/placement";
import {worldDecor} from "@/ark-scene/decor";
import {LodBatch, merge, paint, propMaterial, type PropInstance, type PropsTier} from "@/ark-scene/props/kit";
import type {NestPlan, NestStyle, Presence} from "@/ark-scene/props/presence";
import {groundAt, namedPlace, propRandom, propsPoints, type PropsPoint} from "@/ark-scene/props/sampler";
import * as shapes from "@/ark-scene/props/shapes";
import {microCorner} from "@/ark-scene/micro-decor";
import {LAKE, RIVER, sampleGround, ZONE_SITES} from "@/ark-scene/world";
import type {ArkZone} from "@/ark-scene/types";

/** A web: its centre, the way its face looks, its radius. Its threads and dew are drawn by `buildWebs`. */
export type WebSpot = {x: number; y: number; z: number; facing: number; radius: number};

export type Homes = {
    group: Group;
    batches: LodBatch[];
    webs: WebSpot[];
    /** Whether the cave's bats' roost shows. */
    roost: boolean;
    /** Where the nests are (for the golden shots and the map lane): style, position. */
    nests: Array<{key: string; style: NestStyle; x: number; y: number; z: number; sitter: string | null}>;
    /** The materials that answer the weather, to dispose. */
    dispose: () => void;
    /** A glint on the slime trails: brighter wet and in a low sun. */
    setGlint: (glint: number) => void;
};

const NEST_RADIUS: Record<NestStyle, number> = {tree: 0.2, cliff: 0.34, ground: 0.3, eaves: 0.17, hole: 0.15, barn: 0.24, none: 0};

const zoneCorner = (zone: ArkZone) => {
    const site = ZONE_SITES[zone];
    if (site.kind === "sea") return {x: ZONE_SITES.seashore.x, z: ZONE_SITES.seashore.z};
    return microCorner(zone);
};

/** The barn's gable opening (the barn owl's): the barn decor item turned into the world. */
function barnGable(): {x: number; y: number; z: number; turn: number} | null {
    const barn = worldDecor().find((item) => item.kind === "barn");
    if (!barn) return null;
    const c = Math.cos(barn.rotation);
    const s = Math.sin(barn.rotation);
    // Local (x 2.6 along the long side, z 0): the gable end at +x, under the ridge.
    const lx = 3.24;
    return {x: barn.x + lx * c, y: barn.y + 3.9, z: barn.z - lx * s, turn: barn.rotation + Math.PI / 2};
}

/** A point on the ground near (x, z), out of the water: walks toward `toward` until dry. */
function dryGround(x: number, z: number, toward: {x: number; z: number}): {x: number; y: number; z: number} {
    for (let k = 0; k <= 20; k++) {
        const t = k / 20;
        const px = x + (toward.x - x) * t;
        const pz = z + (toward.z - z) * t;
        const y = groundAt(px, pz);
        if (y > 0.12) return {x: px, y, z: pz};
    }
    return {x: toward.x, y: groundAt(toward.x, toward.z), z: toward.z};
}

/** Where a nest goes: under its sitter when the sitter is where the style nests, else the nearest attach point of its kind. */
function nestSpot(plan: NestPlan, placeOf: (id: string) => Placement | null, used: Set<string>): {x: number; y: number; z: number; turn: number; up?: Vector3} | null {
    const sitter = plan.sitter ? placeOf(plan.sitter) : null;
    const corner = zoneCorner(plan.zone);
    const take = (points: PropsPoint[]) => {
        const point = points.find((p) => !used.has(p.host) && !used.has(p.id));
        if (!point) return null;
        used.add(point.host === "ground" ? point.id : point.host);
        return point;
    };
    switch (plan.style) {
        case "ground": {
            if (sitter && !sitter.water && !sitter.micro && !sitter.canopy) return {x: sitter.x, y: sitter.ground, z: sitter.z, turn: sitter.yaw};
            const from = sitter ?? {x: corner.x, z: corner.z};
            const site = ZONE_SITES[plan.zone];
            const dry = dryGround(from.x, from.z, {x: site.x + (corner.x - site.x) * 1.4, z: site.z + (corner.z - site.z) * 1.4});
            return {...dry, turn: 0};
        }
        case "tree": {
            if (sitter?.canopy) return {x: sitter.x, y: sitter.ground - 0.12, z: sitter.z, turn: sitter.yaw};
            const point = take(propsPoints("fork", {x: sitter?.x ?? corner.x, z: sitter?.z ?? corner.z, radius: 60}, plan.zone)) ?? take(propsPoints("fork", {x: corner.x, z: corner.z, radius: 120}));
            return point ? {x: point.x, y: point.y, z: point.z, turn: point.yaw} : null;
        }
        case "hole": {
            const point = take(propsPoints("hollow", {x: sitter?.x ?? corner.x, z: sitter?.z ?? corner.z, radius: 70}, plan.zone)) ?? take(propsPoints("hollow", {x: corner.x, z: corner.z, radius: 140}));
            return point ? {x: point.x, y: point.y, z: point.z, turn: Math.atan2(point.normal.x, point.normal.z)} : null;
        }
        case "cliff": {
            const zone = plan.zone === "farm_garden" ? "seashore" : plan.zone;
            const point = take(propsPoints("ledge", {x: sitter?.x ?? corner.x, z: sitter?.z ?? corner.z, radius: 80}, zone)) ?? take(propsPoints("ledge", {x: corner.x, z: corner.z, radius: 160}));
            return point ? {x: point.x, y: point.y, z: point.z, turn: point.yaw} : null;
        }
        case "eaves": {
            const point = take(propsPoints("house_eave", {x: COTTAGE.x, z: COTTAGE.z, radius: 10}));
            if (!point) return null;
            // Tucked in at the top of the wall, its back to it.
            const out = Math.atan2(point.normal.x, point.normal.z);
            const wallOut = Math.hypot(point.x - COTTAGE.x, 0) > COTTAGE.width / 2 - 0.1 ? Math.sign(point.x - COTTAGE.x) * Math.PI / 2 : point.z > COTTAGE.z ? 0 : Math.PI;
            void out;
            return {x: point.x, y: point.y - 0.22, z: point.z, turn: wallOut};
        }
        case "barn": {
            const gable = barnGable();
            return gable ? {x: gable.x, y: gable.y, z: gable.z, turn: gable.turn} : null;
        }
        default:
            return null;
    }
}

/** A trail drawn on a surface: a strip `width` wide along `points` (each with its out-normal), a hair above it. */
function strip(points: Array<{p: Vector3; n: Vector3}>, width: number, colour: string, shade: (t: number, i: number) => number = () => 1): BufferGeometry {
    const positions: number[] = [];
    const side = new Vector3();
    const dir = new Vector3();
    for (let i = 0; i < points.length - 1; i++) {
        const a = points[i];
        const b = points[i + 1];
        dir.copy(b.p).sub(a.p).normalize();
        side.crossVectors(a.n, dir).normalize().multiplyScalar(width / 2);
        const lift = 0.012;
        const a0 = a.p.clone().addScaledVector(a.n, lift).sub(side);
        const a1 = a.p.clone().addScaledVector(a.n, lift).add(side);
        const b0 = b.p.clone().addScaledVector(b.n, lift).sub(side);
        const b1 = b.p.clone().addScaledVector(b.n, lift).add(side);
        positions.push(a0.x, a0.y, a0.z, b0.x, b0.y, b0.z, a1.x, a1.y, a1.z, a1.x, a1.y, a1.z, b0.x, b0.y, b0.z, b1.x, b1.y, b1.z);
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
    const painted = paint(geometry, colour, (_, i) => shade(i / Math.max(positions.length / 3, 1), i));
    return painted;
}

/** A path over the ground from a to b, following it, with a little wander. */
function groundPath(ax: number, az: number, bx: number, bz: number, wander: number, random: () => number): Array<{p: Vector3; n: Vector3}> {
    const steps = Math.max(4, Math.round(Math.hypot(bx - ax, bz - az) / 0.25));
    const out: Array<{p: Vector3; n: Vector3}> = [];
    const phase = random() * 6;
    for (let k = 0; k <= steps; k++) {
        const t = k / steps;
        const nx = -(bz - az);
        const nz = bx - ax;
        const l = Math.hypot(nx, nz) || 1;
        const w = Math.sin(t * Math.PI) * Math.sin(t * 7 + phase) * wander;
        const x = ax + (bx - ax) * t + (nx / l) * w;
        const z = az + (bz - az) * t + (nz / l) * w;
        const e = 0.3;
        const hx = groundAt(x + e, z) - groundAt(x - e, z);
        const hz = groundAt(x, z + e) - groundAt(x, z - e);
        out.push({p: new Vector3(x, groundAt(x, z), z), n: new Vector3(-hx, 2 * e, -hz).normalize()});
    }
    return out;
}

/** Specks along a trail (ants, from afar, as a dotted line: their walking is the behaviour lane's). */
function specks(points: Array<{p: Vector3; n: Vector3}>, every: number, random: () => number): PropInstance[] {
    const out: PropInstance[] = [];
    for (let i = 0; i < points.length - 1; i++) {
        const a = points[i];
        const b = points[i + 1];
        const length = a.p.distanceTo(b.p);
        for (let d = 0; d < length; d += every * (0.6 + random() * 0.8)) {
            const t = d / length;
            const p = a.p.clone().lerp(b.p, t).addScaledVector(a.n, 0.018);
            out.push({x: p.x, y: p.y, z: p.z, turn: random() * Math.PI * 2, scale: 1, up: a.n.clone()});
        }
    }
    return out;
}

export function buildHomes(presence: Presence, placeOf: (id: string) => Placement | null, tier: PropsTier): Homes {
    const group = new Group();
    group.name = "props:homes";
    const batches: LodBatch[] = [];
    const warm = propMaterial();
    const slime = new MeshStandardMaterial({color: new Color("#c9d4d6"), roughness: 0.06, metalness: 0.75, transparent: true, opacity: 0.32, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2});
    const decal = propMaterial({roughness: 1});
    decal.polygonOffset = true;
    decal.polygonOffsetFactor = -2;
    const extraMaterials: MeshStandardMaterial[] = [];
    const add = (batch: LodBatch) => {
        batch.setTier(tier);
        batch.add(group);
        batches.push(batch);
    };
    const has = (g: Parameters<Presence["groups"]["get"]>[0]) => (presence.groups.get(g)?.length ?? 0) > 0;
    const first = (g: Parameters<Presence["groups"]["get"]>[0]) => presence.groups.get(g)?.[0] ?? null;
    const nestsOut: Homes["nests"] = [];
    const webs: WebSpot[] = [];

    // MARK: Birds' nests, eggs and chicks
    const used = new Set<string>();
    const byStyle = new Map<NestStyle, PropInstance[]>();
    const eggs: PropInstance[] = [];
    const chicks: PropInstance[] = [];
    const hollows: PropInstance[] = [];
    for (const plan of presence.nests) {
        const spot = nestSpot(plan, placeOf, used);
        if (!spot) continue;
        const r = NEST_RADIUS[plan.style];
        nestsOut.push({key: plan.key, style: plan.style, x: spot.x, y: spot.y, z: spot.z, sitter: plan.sitter});
        const random = propRandom(plan.key);
        if (plan.style === "hole" || plan.style === "barn") {
            // A hole in the trunk (or the barn's gable): the nest is inside, out of sight.
            hollows.push({x: spot.x, y: spot.y, z: spot.z, turn: spot.turn, scale: r / 0.15});
            continue;
        }
        const list = byStyle.get(plan.style) ?? [];
        list.push({x: spot.x, y: spot.y, z: spot.z, turn: spot.turn, scale: 1});
        byStyle.set(plan.style, list);
        // The cup's floor: where eggs and chicks sit, in the nest's own frame.
        const floor = plan.style === "ground" ? 0.06 : plan.style === "cliff" ? r * 0.36 : plan.style === "eaves" ? -0.05 : r * 0.42;
        const inward = plan.style === "eaves" ? 0.1 : 0;
        const c = Math.cos(spot.turn);
        const s = Math.sin(spot.turn);
        const at = (lx: number, lz: number) => ({x: spot.x + lx * c + (lz + inward) * s, z: spot.z - lx * s + (lz + inward) * c});
        const eggSize = Math.max(0.045, r * 0.3);
        for (let k = 0; k < plan.eggs; k++) {
            const a = k * 2.39996 + random();
            const d = plan.eggs === 1 ? 0 : r * 0.28 * Math.sqrt((k + 0.5) / plan.eggs);
            const p = at(Math.cos(a) * d, Math.sin(a) * d);
            eggs.push({x: p.x, y: spot.y + floor, z: p.z, turn: random() * Math.PI, scale: eggSize / 0.06, tint: new Color().setHSL(0.1 + random() * 0.4, 0.25, 0.82 + random() * 0.1)});
        }
        for (let k = 0; k < plan.chicks; k++) {
            const a = k * 2.39996 + 1;
            const d = plan.chicks === 1 ? 0 : r * 0.3;
            const p = at(Math.cos(a) * d, Math.sin(a) * d);
            chicks.push({x: p.x, y: spot.y + floor, z: p.z, turn: spot.turn + (random() - 0.5) * 1.2, scale: Math.max(r * 0.55, 0.08) / 0.1});
        }
    }
    const nestShapes: Record<string, () => BufferGeometry> = {
        tree: () => shapes.cupNest(NEST_RADIUS.tree),
        cliff: () => shapes.platformNest(NEST_RADIUS.cliff),
        ground: () => shapes.groundNest(NEST_RADIUS.ground),
        eaves: () => shapes.eavesNest(NEST_RADIUS.eaves)
    };
    byStyle.forEach((items, style) => add(new LodBatch(`nest-${style}`, items, nestShapes[style](), null, warm, {cap: 24, reach: 1.1})));
    if (hollows.length) add(new LodBatch("nest-hole", hollows, shapes.hollow(0.15), null, warm, {cap: 16, reach: 0.9}));
    if (eggs.length) add(new LodBatch("eggs", eggs, shapes.egg(0.06), null, warm, {cap: 60, reach: 0.6, fine: false}));
    if (chicks.length) add(new LodBatch("chicks", chicks, shapes.chick(0.1), null, warm, {cap: 30, reach: 0.6}));

    // MARK: Ants: a mound by the zone's corner, its trail to a tree and up the trunk (and up the cottage's wall at Home)
    if (has("ants")) {
        const ants = first("ants")!;
        const random = propRandom("ants");
        const corner = zoneCorner(ants.zone);
        const fork = propsPoints("fork", {x: corner.x, z: corner.z, radius: 40}, ants.zone)[0] ?? propsPoints("fork", {x: corner.x, z: corner.z, radius: 120})[0] ?? null;
        const tree = fork ? worldDecor()[Number(fork.host.replace("decor", ""))] : null;
        const moundAt = tree ? {x: tree.x + 2.2, z: tree.z + 1.6} : {x: corner.x + 1.5, z: corner.z + 1};
        const moundY = groundAt(moundAt.x, moundAt.z);
        const mounds: PropInstance[] = [{x: moundAt.x, y: moundY - 0.02, z: moundAt.z, turn: random() * 6, scale: 1}];
        add(new LodBatch("ant-mound", mounds, shapes.antMound(0.55, 0.45), shapes.heap(0.55, 0.45, "#7b5d3f", 1, 0.05), warm, {cap: 4, reach: 1.4}));
        const trails: BufferGeometry[] = [];
        const dots: PropInstance[] = [];
        if (tree) {
            const trunkR = 0.2 * tree.scale;
            // Toward the trunk's side that faces the mound.
            const ang = Math.atan2(moundAt.z - tree.z, moundAt.x - tree.x);
            const foot = {x: tree.x + Math.cos(ang) * trunkR * 1.05, z: tree.z + Math.sin(ang) * trunkR * 1.05};
            const ground = groundPath(moundAt.x - Math.cos(ang) * 0.4, moundAt.z - Math.sin(ang) * 0.4, foot.x, foot.z, 0.25, random);
            trails.push(strip(ground, 0.07, "#5a4532", () => 0.9));
            dots.push(...specks(ground, 0.035, random));
            // Up the trunk to the fork.
            const up: Array<{p: Vector3; n: Vector3}> = [];
            const height = fork ? fork.y - groundAt(foot.x, foot.z) : 1.6;
            for (let k = 0; k <= 12; k++) {
                const t = k / 12;
                const twist = ang + Math.sin(t * 3) * 0.35;
                const r = trunkR * (1.02 - 0.4 * t * (height / 3));
                up.push({p: new Vector3(tree.x + Math.cos(twist) * r, groundAt(foot.x, foot.z) + t * height * 0.95, tree.z + Math.sin(twist) * r), n: new Vector3(Math.cos(twist), 0, Math.sin(twist))});
            }
            trails.push(strip(up, 0.05, "#3c2d20"));
            dots.push(...specks(up, 0.03, random));
        }
        // Along the ground in another direction, foraging.
        const away = groundPath(moundAt.x + 0.4, moundAt.z, moundAt.x + 3.2, moundAt.z + 1.8, 0.4, random);
        trails.push(strip(away, 0.05, "#5d4734", () => 0.92));
        dots.push(...specks(away, 0.04, random));
        // At Home: up the cottage's wall too.
        if (ants.zone === "farm_garden") {
            const wallX = COTTAGE.x - COTTAGE.width / 2 - 0.01;
            const wallZ = COTTAGE.z + 0.6;
            const toWall = groundPath(wallX - 2.6, wallZ + 1.2, wallX - 0.02, wallZ, 0.2, random);
            const climb: Array<{p: Vector3; n: Vector3}> = [];
            for (let k = 0; k <= 10; k++) climb.push({p: new Vector3(wallX, COTTAGE.floor - 0.1 + k * 0.17, wallZ + Math.sin(k * 0.8) * 0.08), n: new Vector3(-1, 0, 0)});
            trails.push(strip(toWall, 0.05, "#5a4532"), strip(climb, 0.04, "#3a2b1f"));
            dots.push(...specks(toWall, 0.035, random), ...specks(climb, 0.03, random));
        }
        const trailCentre = new Vector3(moundAt.x, moundY, moundAt.z);
        add(new LodBatch("ant-trails", [{x: 0, y: 0, z: 0, turn: 0, scale: 1}], merge(trails), null, decal, {cap: 1, reach: 100, fine: true}));
        batches[batches.length - 1].setCentre(trailCentre);
        add(new LodBatch("ants", dots, paint(new BoxGeometry(0.012, 0.007, 0.022), "#1c140e"), null, warm, {cap: 900, reach: 0.4, fine: true}));
    }

    // MARK: Bees: comb in a tree hollow, and a hive in the garden
    if (has("bees")) {
        const bees = first("bees")!;
        const corner = zoneCorner(bees.zone === "farm_garden" ? "woodland" : bees.zone);
        const hollow = propsPoints("hollow", {x: corner.x, z: corner.z, radius: 60}).find((p) => !used.has(p.host)) ?? propsPoints("hollow", {x: COTTAGE.x, z: COTTAGE.z, radius: 120})[0];
        if (hollow) {
            used.add(hollow.host);
            const turn = Math.atan2(hollow.normal.x, hollow.normal.z);
            const combNest = merge([shapes.hollow(0.2), shapes.comb(0.2)]);
            add(new LodBatch("bee-hollow", [{x: hollow.x, y: hollow.y, z: hollow.z, turn, scale: 1}], combNest, null, warm, {cap: 2, reach: 1}));
            nestsOut.push({key: "bees", style: "hole", x: hollow.x, y: hollow.y, z: hollow.z, sitter: null});
        }
        const hiveX = COTTAGE.x - 6.2;
        const hiveZ = COTTAGE.z - 2.4;
        add(new LodBatch("hive-box", [{x: hiveX, y: groundAt(hiveX, hiveZ), z: hiveZ, turn: 0.3, scale: 1}], shapes.hiveBox(), null, warm, {cap: 2, reach: 1.2, shadow: true}));
    }

    // MARK: Wasps: a paper nest under the back eave
    if (has("wasps")) {
        const halfD = COTTAGE.depth / 2;
        add(new LodBatch("wasp-nest", [{x: COTTAGE.x + 1.6, y: COTTAGE.floor + COTTAGE.wall - 0.02, z: COTTAGE.z - halfD - COTTAGE.overhang * 0.5, turn: 0, scale: 1}], shapes.waspNest(0.3), null, warm, {cap: 2, reach: 1}));
    }

    // MARK: Termites: more mounds on the savanna and the desert's edge
    if (has("termites")) {
        const random = propRandom("termites");
        const items: PropInstance[] = [];
        for (const zone of ["grassland", "desert"] as ArkZone[]) {
            const site = ZONE_SITES[zone];
            for (let k = 0; k < 6; k++) {
                const a = random() * Math.PI * 2;
                const d = site.clearing + 2 + random() * 14;
                const x = site.x + Math.cos(a) * d;
                const z = site.z + Math.sin(a) * d;
                if (sampleGround(x, z).land < 0.9) continue;
                items.push({x, y: groundAt(x, z) - 0.05, z, turn: random() * 6, scale: 0.8 + random() * 0.6});
            }
        }
        add(new LodBatch("termite-mounds-active", items, shapes.termiteMound(2.2, 3), shapes.termiteMoundFar(2.2), warm, {cap: 16, reach: 1.6, shadow: true}));
    }

    // MARK: Spiders: webs on the porch, between branches by the zone's corner and at the garden's fence
    if (has("spiders")) {
        const halfD = COTTAGE.depth / 2;
        const postX = COTTAGE.x + COTTAGE.porch.width / 2 - 0.1;
        const postZ = COTTAGE.z + halfD + COTTAGE.porch.depth - 0.1;
        // In the porch's corner, between the post and the porch roof.
        webs.push({x: postX - 0.32, y: COTTAGE.floor + 2.15, z: postZ - 0.05, facing: 0, radius: 0.34});
        const spiders = first("spiders")!;
        const corner = zoneCorner(spiders.zone === "farm_garden" ? "woodland" : spiders.zone);
        const branches = propsPoints("branch", {x: corner.x, z: corner.z, radius: 25});
        const random = propRandom("webs");
        for (const branch of branches.slice(0, 5)) {
            webs.push({x: branch.x, y: branch.y - 0.35, z: branch.z, facing: Math.atan2(branch.x - corner.x, branch.z - corner.z) + (random() - 0.5) * 0.6, radius: 0.3 + random() * 0.18});
        }
        // Between two fence pickets at the garden's gate.
        webs.push({x: COTTAGE.x + 1.15, y: groundAt(COTTAGE.x + 1.15, COTTAGE.z + 8.6) + 0.55, z: COTTAGE.z + 8.6, facing: 0, radius: 0.22});
    }

    // MARK: Moths and butterflies: chrysalises and cocoons under leaves
    if (has("moths")) {
        const moths = first("moths")!;
        const corner = zoneCorner(moths.zone);
        const random = propRandom("chrysalis");
        const leaves = [...propsPoints("leaf", {x: corner.x, z: corner.z, radius: 20}).slice(0, 6), ...propsPoints("leaf", {x: COTTAGE.x, z: COTTAGE.z, radius: 25}).slice(0, 4)];
        const chrysalises: PropInstance[] = [];
        const cocoons: PropInstance[] = [];
        leaves.forEach((leaf, k) => {
            // Hanging under the leaf's outer edge, so it is seen from the side.
            (k % 2 ? cocoons : chrysalises).push({x: leaf.x, y: leaf.y - 0.05, z: leaf.z, turn: random() * 6, scale: 1});
        });
        add(new LodBatch("chrysalis", chrysalises, shapes.chrysalis(0.07, false), null, warm, {cap: 12, reach: 0.4, fine: true}));
        add(new LodBatch("cocoon", cocoons, shapes.chrysalis(0.08, true), null, warm, {cap: 12, reach: 0.4, fine: true}));
    }

    // MARK: Rabbits: a warren round the rabbits' ground (their own mouth is the layers'), runs between the holes
    if (has("rabbits")) {
        const rabbit = first("rabbits")!;
        const at = placeOf(rabbit.id) ?? {x: ZONE_SITES[rabbit.zone].x, z: ZONE_SITES[rabbit.zone].z, ground: 0};
        const random = propRandom("warren");
        const mouths: PropInstance[] = [];
        const runs: BufferGeometry[] = [];
        let last = {x: at.x, z: at.z};
        for (let k = 0; k < 5; k++) {
            const a = k * 1.3 + random();
            const d = 2.2 + random() * 2.5;
            const x = at.x + Math.cos(a) * d;
            const z = at.z - 1.5 + Math.sin(a) * d * 0.7;
            const y = groundAt(x, z);
            mouths.push({x, y: y - 0.03, z, turn: a + Math.PI / 2, scale: 0.9 + random() * 0.3});
            runs.push(strip(groundPath(last.x, last.z, x, z, 0.3, random), 0.14, "#8a7550", () => 0.95));
            last = {x, z};
        }
        add(new LodBatch("warren", mouths, shapes.warrenMouth(0.28), null, warm, {cap: 10, reach: 1}));
        add(new LodBatch("warren-runs", [{x: 0, y: 0, z: 0, turn: 0, scale: 1}], merge(runs), null, decal, {cap: 1, reach: 100}));
        batches[batches.length - 1].setCentre(new Vector3(at.x, at.ground, at.z));
    }

    // MARK: Earthworms: casts by the worm holes of the garden, the fields, the meadows and the woods
    if (has("worms")) {
        const random = propRandom("casts");
        const holes = propsPoints("worm_hole");
        const casts: PropInstance[] = [];
        for (const hole of holes) {
            for (let k = 0; k < 3; k++) {
                const x = hole.x + (random() - 0.5) * 1.6;
                const z = hole.z + (random() - 0.5) * 1.6;
                casts.push({x, y: groundAt(x, z) - 0.005, z, turn: random() * 6, scale: 0.8 + random() * 0.5});
            }
        }
        add(new LodBatch("worm-casts", casts, shapes.wormCast(0.07), null, warm, {cap: 260, reach: 0.35, fine: true}));
    }

    // MARK: Dens and lairs: behind the leader of each species that keeps one
    for (const [group, build, size] of [["den", shapes.den, 1.1], ["lair", shapes.lair, 1.5]] as const) {
        const members = presence.groups.get(group) ?? [];
        const seen = new Set<string>();
        const items: PropInstance[] = [];
        for (const animal of members) {
            const key = animal.kind_species_profile_id || animal.species_profile_id || animal.model_slug;
            if (seen.has(key)) continue;
            seen.add(key);
            const at = placeOf(animal.id);
            if (!at || at.water) continue;
            // A few metres behind it (away from the opening camera), facing it.
            const x = at.x + Math.sin(at.yaw + Math.PI) * 0.4;
            const z = at.z - size * 2.6;
            items.push({x, y: groundAt(x, z) - 0.05, z, turn: 0, scale: 1});
        }
        if (items.length) add(new LodBatch(group, items, build(size), null, warm, {cap: 12, reach: 1.3, shadow: true}));
    }

    // MARK: Sea turtles: a nest above the tide line, its tracks to the water
    if (presence.turtleNests.length) {
        const beach = namedPlace("beach");
        const random = propRandom("turtle-nest");
        const out = Math.atan2(beach.x, beach.z);
        const ox = Math.sin(out);
        const oz = Math.cos(out);
        const nests: PropInstance[] = [];
        const eggsHere: PropInstance[] = [];
        const tracks: BufferGeometry[] = [];
        presence.turtleNests.forEach((nest, k) => {
            // Along the beach from its middle, a little inland of the animals' line.
            const along = (k + 1) * 4.5;
            const x0 = beach.x - oz * along - ox * 2.5;
            const z0 = beach.z + ox * along - oz * 2.5;
            const dry = dryGround(x0, z0, {x: x0 - ox * 4, z: z0 - oz * 4});
            nests.push({x: dry.x, y: dry.y - 0.04, z: dry.z, turn: out, scale: 1});
            for (let e = 0; e < nest.eggs; e++) {
                const a = e * 2.4;
                eggsHere.push({x: dry.x + Math.cos(a) * 0.12, y: dry.y + 0.03, z: dry.z + Math.sin(a) * 0.12, turn: 0, scale: 0.75, tint: new Color("#f4efe4")});
            }
            // Two lines of flipper marks to the waterline and back.
            for (const offset of [-0.35, 0.35]) {
                let wx = dry.x + ox * 0.9;
                let wz = dry.z + oz * 0.9;
                for (let s = 0; s < 40 && groundAt(wx, wz) > -0.05; s++) {
                    wx += ox * 0.35;
                    wz += oz * 0.35;
                }
                const line = groundPath(dry.x + ox * 0.9 - oz * offset, dry.z + oz * 0.9 + ox * offset, wx - oz * offset, wz + ox * offset, 0.12, random);
                tracks.push(strip(line, 0.16, "#c3ab80", (t, i) => (Math.floor(i / 6) % 2 ? 0.86 : 1.02)));
            }
        });
        add(new LodBatch("turtle-nests", nests, shapes.turtleNest(0.75), null, warm, {cap: 6, reach: 1}));
        if (eggsHere.length) add(new LodBatch("turtle-eggs", eggsHere, shapes.egg(0.06), null, warm, {cap: 40, reach: 0.5}));
        add(new LodBatch("turtle-tracks", [{x: 0, y: 0, z: 0, turn: 0, scale: 1}], merge(tracks), null, decal, {cap: 1, reach: 100}));
        batches[batches.length - 1].setCentre(new Vector3(beach.x, beach.y, beach.z));
    }

    // MARK: Beavers: a lodge on the lake by the outflow, a dam across the river below it
    if (has("beavers")) {
        const [ax, az] = RIVER[1];
        const [bx, bz] = RIVER[2];
        // The lodge: on the lake's margin beside the outflow, in the water.
        const side = Math.atan2(az - LAKE.z, ax - LAKE.x) + 0.55;
        const lodge = {x: LAKE.x + Math.cos(side) * (LAKE.r - 2.2), z: LAKE.z + Math.sin(side) * (LAKE.r - 2.2)};
        add(new LodBatch("beaver-lodge", [{x: lodge.x, y: 0, z: lodge.z, turn: 0.4, scale: 1}], shapes.beaverLodge(1.9), null, warm, {cap: 2, reach: 1.6, shadow: true}));
        // The dam: a third of the way down the river's first stretch, square across it.
        const t = 0.35;
        const dx = ax + (bx - ax) * t;
        const dz = az + (bz - az) * t;
        const across = Math.atan2(bx - ax, bz - az);
        add(new LodBatch("beaver-dam", [{x: dx, y: 0, z: dz, turn: across + Math.PI / 2, scale: 1}], shapes.beaverDam(6.5), null, warm, {cap: 2, reach: 1.6}));
    }

    // MARK: Snails and slugs: slime trails on the rocks near their ground, the cottage's wall and the garden path's stones
    let setGlint = (_glint: number) => {};
    if (has("snails")) {
        const snails = first("snails")!;
        const corner = zoneCorner(snails.zone);
        const random = propRandom("slime");
        const trails: BufferGeometry[] = [];
        const rocks = [...propsPoints("rock_face", {x: corner.x, z: corner.z, radius: 30}).slice(0, 6), ...propsPoints("rock_face", {x: COTTAGE.x, z: COTTAGE.z, radius: 14}).slice(0, 4)];
        for (const rock of rocks) {
            const n = new Vector3(rock.normal.x, rock.normal.y, rock.normal.z).normalize();
            const t1 = new Vector3().crossVectors(n, new Vector3(0, 1, 0));
            if (t1.lengthSq() < 0.01) t1.set(1, 0, 0);
            t1.normalize();
            const t2 = new Vector3().crossVectors(n, t1).normalize();
            const points: Array<{p: Vector3; n: Vector3}> = [];
            const phase = random() * 6;
            for (let k = 0; k <= 14; k++) {
                const u = (k / 14 - 0.5) * 0.9;
                const v = Math.sin(k * 0.6 + phase) * 0.12;
                points.push({p: new Vector3(rock.x, rock.y, rock.z).addScaledVector(t1, u).addScaledVector(t2, v), n});
            }
            trails.push(strip(points, 0.03, "#ffffff"));
        }
        // Up the cottage's front wall from the flower bed, wandering.
        const wallZ = COTTAGE.z + COTTAGE.depth / 2 + 0.012;
        const wall: Array<{p: Vector3; n: Vector3}> = [];
        for (let k = 0; k <= 18; k++) wall.push({p: new Vector3(COTTAGE.x - 2.3 + Math.sin(k * 0.45) * 0.18 + k * 0.02, COTTAGE.floor - 0.05 + k * 0.07, wallZ), n: new Vector3(0, 0, 1)});
        trails.push(strip(wall, 0.025, "#ffffff"));
        // Across the path's stones.
        const path = groundPath(COTTAGE.x - 0.6, COTTAGE.z + 4.6, COTTAGE.x + 0.7, COTTAGE.z + 6.8, 0.3, random);
        trails.push(strip(path, 0.025, "#ffffff"));
        const geometry = merge(trails);
        add(new LodBatch("slime-trails", [{x: 0, y: 0, z: 0, turn: 0, scale: 1}], geometry, null, slime, {cap: 1, reach: 100, fine: true}));
        batches[batches.length - 1].setCentre(new Vector3(COTTAGE.x, COTTAGE.floor, COTTAGE.z));
        setGlint = (glint) => {
            slime.opacity = 0.16 + 0.5 * glint;
        };
    }

    return {
        group,
        batches,
        webs,
        roost: has("bats"),
        nests: nestsOut,
        setGlint,
        dispose: () => {
            for (const batch of batches) batch.dispose();
            warm.dispose();
            slime.dispose();
            decal.dispose();
            for (const material of extraMaterials) material.dispose();
        }
    };
}

/** Orb webs: radials and a spiral in thin silk lines, one draw call for all. Returns the dew beads' positions too. */
export function buildWebs(webs: WebSpot[]): {lines: LineSegments; beads: Float32Array} {
    const positions: number[] = [];
    const beads: number[] = [];
    const random = propRandom("web-threads");
    const matrix = new Matrix4();
    const v = new Vector3();
    for (const web of webs) {
        matrix.makeRotationY(web.facing).setPosition(web.x, web.y, web.z);
        const local: number[] = [];
        const spokes = 14 + Math.floor(random() * 6);
        const r = web.radius;
        const spoke = (k: number) => (k / spokes) * Math.PI * 2 + Math.sin(k * 1.7) * 0.08;
        for (let k = 0; k < spokes; k++) {
            const a = spoke(k);
            const reach = r * (0.85 + 0.25 * Math.sin(k * 2.3));
            local.push(0, 0, 0, Math.cos(a) * reach, Math.sin(a) * reach, 0);
        }
        // The spiral, ring by ring, between the spokes.
        const turns = 9;
        for (let t = 0; t < turns * spokes; t++) {
            const k0 = t % spokes;
            const k1 = (t + 1) % spokes;
            const r0 = r * (0.12 + 0.82 * (t / (turns * spokes)));
            const r1 = r * (0.12 + 0.82 * ((t + 1) / (turns * spokes)));
            const a0 = spoke(k0);
            const a1 = spoke(k1) + (k1 === 0 ? Math.PI * 2 : 0);
            local.push(Math.cos(a0) * r0, Math.sin(a0) * r0, 0, Math.cos(a1) * r1, Math.sin(a1) * r1, 0);
            if (t % 2 === 0) beads.push(...v.set(Math.cos(a0) * r0, Math.sin(a0) * r0 - 0.004, 0.002).applyMatrix4(matrix).toArray());
        }
        // Anchor threads out to what it hangs on.
        for (const a of [0.6, 2.4, 4.3]) local.push(Math.cos(a) * r * 0.9, Math.sin(a) * r * 0.9, 0, Math.cos(a) * r * 1.7, Math.sin(a) * r * 1.6, 0);
        for (let i = 0; i < local.length; i += 3) positions.push(...v.set(local[i], local[i + 1], local[i + 2]).applyMatrix4(matrix).toArray());
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
    const lines = new LineSegments(geometry, new LineBasicMaterial({color: new Color("#f2f4f6"), transparent: true, opacity: 0.4, depthWrite: false}));
    lines.name = "props:webs";
    return {lines, beads: new Float32Array(beads)};
}

/** The nest styles' far-away look is nothing: nests are only drawn near. */
export const NEST_STYLES: NestStyle[] = ["tree", "cliff", "ground", "eaves", "hole", "barn"];

