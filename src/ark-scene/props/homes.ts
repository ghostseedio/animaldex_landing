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
import type {Presence} from "@/ark-scene/props/presence";
import {eggLength, eggLook, nestRadius, type NestForm, type NestProfile, type NestSite} from "@/ark-scene/props/nest-kinds";
import {buildOf, nestStage, registerNestSites, type NestSiteInfo} from "@/ark-scene/props/nest-growth";
import {eggGeometry, nestFarGeometry, nestGeometry} from "@/ark-scene/props/nest-shapes";
import {nestSpots} from "@/ark-scene/props/nest-sites";
import {arkBody} from "@/ark-scene/stats";
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
    /** Points along the slime trails that glint (`effects.ts`). */
    slimeGlints: Float32Array;
    /** Whether the cave's bats' roost shows. */
    roost: boolean;
    /** Where the nests are (for the golden shots and the other lanes): form, site, position, size. */
    nests: Array<{key: string; speciesId: string; siteId: string; form: NestForm; site: NestSite; x: number; y: number; z: number; turn: number; radius: number; sitter: string | null}>;
    /** Every nest site drawn, as the recipes lane reads them (`nest-growth.ts` nestSites). */
    nestSites: NestSiteInfo[];
    /** Set every nest's build stage for Ark day `t` (`nest-growth.ts` nestStage); true when one changed. */
    setNestStages: (t: number | null) => boolean;
    /** The materials that answer the weather, to dispose. */
    dispose: () => void;
    /** Where things are (for the golden shots and the other lanes): an ant mound, the bees' hollow, a web… */
    marks: Record<string, {x: number; y: number; z: number}>;
    /** A glint on the slime trails: brighter wet and in a low sun. */
    setGlint: (glint: number) => void;
};

const zoneCorner = (zone: ArkZone) => {
    const site = ZONE_SITES[zone];
    if (site.kind === "sea") return {x: ZONE_SITES.seashore.x, z: ZONE_SITES.seashore.z};
    return microCorner(zone);
};

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
        // Proud of the ground by more than the terrain mesh's own error between its vertices.
        const lift = a.n.y > 0.7 ? 0.04 : 0.008;
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
            const p = a.p.clone().lerp(b.p, t).addScaledVector(a.n, a.n.y > 0.7 ? 0.045 : 0.012);
            out.push({x: p.x, y: p.y, z: p.z, turn: random() * Math.PI * 2, scale: 1, up: a.n.clone()});
        }
    }
    return out;
}

/** The decor tree under a host id (`decor12`), for its trunk's axis. */
function treeOf(host: string): {x: number; y: number; z: number} | null {
    const match = /^decor(\d+)$/.exec(host);
    const item = match ? worldDecor()[Number(match[1])] : null;
    return item ? {x: item.x, y: item.y, z: item.z} : null;
}

/**
 * A point on a decor tree's trunk (the sampler's `bark` points, on the drawn bark), `low`…`high` metres up, facing
 * sideways, nearest `near` (in `zone` first); its tree not already taken by another home.
 */
function trunkPoint(near: {x: number; z: number}, zone: ArkZone, used: Set<string>, low = 0.6, high = 6): PropsPoint | null {
    const ok = (point: PropsPoint) => /^decor\d+$/.test(point.host) && !used.has(point.host) && Math.abs(point.normal.y) < 0.35 && point.y - groundAt(point.x, point.z) > low && point.y - groundAt(point.x, point.z) < high;
    return propsPoints("bark", {x: near.x, z: near.z, radius: 60}, zone).find(ok) ?? propsPoints("bark", {x: near.x, z: near.z, radius: 160}).find(ok) ?? null;
}

/** Where eggs lie in each form's cup (its floor, at radius 1), and how far apart. Forms not listed hide theirs. */
const EGG_FLOOR: Partial<Record<NestForm, number>> = {cup: 0.31, platform: 0.34, eyrie: 0.65, scrape: 0.03, down_bowl: 0.17, floating: 0.13, mound: 0.44, pebbles: 0.05};
/** How far a nest's detail is drawn, against the tier's near radius. */
const NEST_REACH: Partial<Record<NestForm, number>> = {eyrie: 1.8, megapode: 1.6, mound: 1.3, platform: 1.3, pendant: 1.0, cup: 0.8, mud_cup: 0.8, ball: 0.9, dome: 1.0, scrape: 0.7, pebbles: 0.8, floating: 1.0, down_bowl: 0.9};

/** Sites where the bird stands on its nest in the scene: there the nest fits the drawn bird; elsewhere it is the scenery's scale. */
const SAT_ON = new Set<NestSite>(["ground", "shore", "water_margin"]);

/** A bird's drawn length and its real one (`stats.ts` arkBody). */
export type BirdBody = {drawn: number; metres: number};
const birdBody = (slug: string): BirdBody => {
    const body = arkBody({model_slug: slug}, "bird");
    return {drawn: body.display, metres: body.metres};
};

export function buildHomes(presence: Presence, placeOf: (id: string) => Placement | null, tier: PropsTier, bodyOf: (slug: string) => BirdBody = birdBody): Homes {
    const group = new Group();
    group.name = "props:homes";
    const batches: LodBatch[] = [];
    const warm = propMaterial();
    const slime = new MeshStandardMaterial({color: new Color("#eef5f7"), roughness: 0.1, metalness: 0.35, transparent: true, opacity: 0.3, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2});
    const decal = propMaterial({roughness: 1, texture: 2, textureScale: 1.2, textureStrength: 0.5});
    decal.side = 2;
    const straw = propMaterial({texture: 1, textureScale: 3, textureStrength: 0.7});
    const soil = propMaterial({texture: 1, textureScale: 1.6});
    const sand = propMaterial({texture: 3, textureScale: 1.2});
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
    const marks: Homes["marks"] = {};
    const webs: WebSpot[] = [];

    // MARK: Birds' nests, eggs and chicks: by species (nest-kinds.ts), on the scenery's sites (nest-sites.ts), built to their stage (nest-growth.ts)
    const used = new Set<string>();
    const eggs: PropInstance[] = [];
    const hollows: PropInstance[] = [];
    const burrowMouths: PropInstance[] = [];
    const nestGroups = new Map<string, {form: NestForm; lining: NestProfile["lining"]; closed: boolean; items: PropInstance[]; sites: NestSiteInfo[]}>();
    const nestSites: NestSiteInfo[] = [];
    for (const plan of presence.nests) {
        const profile = plan.profile;
        const body = bodyOf(plan.slug);
        // On the ground the sitter stands in it (so it fits the drawn bird); up a tree, on a cliff or a wall it is
        // the scenery's size (a little over life, so it reads): a weaver's purse is a hand across, an eyrie two metres.
        const drawn = SAT_ON.has(profile.site) ? body.drawn : Math.max(body.metres * 1.35, body.drawn * 0.3);
        const radius = nestRadius(profile, drawn);
        const spots = nestSpots(plan, radius, placeOf, used);
        const random = propRandom(plan.key);
        spots.forEach((spot, n) => {
            const up = spot.up ?? {x: 0, y: 1, z: 0};
            const info: NestSiteInfo = {
                speciesId: plan.speciesId,
                siteId: spot.siteId,
                slug: plan.slug,
                zone: plan.zone,
                position: {x: spot.x, y: spot.y, z: spot.z},
                up,
                radius,
                sitter: spot.own ? plan.sitter : null,
                eggs: spot.own ? plan.eggs : 0,
                chicks: spot.own ? plan.chicks : 0,
                ...buildOf(profile)
            };
            nestSites.push(info);
            nestsOut.push({key: plan.key, speciesId: plan.speciesId, siteId: spot.siteId, form: profile.form, site: profile.site, x: spot.x, y: spot.y, z: spot.z, turn: spot.turn, radius, sitter: info.sitter});
            if (profile.form === "hole" || profile.form === "barn") {
                // A hole in the trunk (or the barn's gable): the nest is inside, out of sight; its mouth about a fifth of the bird.
                const mouth = Math.max(0.05, 0.12 * drawn) * (profile.form === "barn" ? 1.6 : 1);
                hollows.push({x: spot.x, y: spot.y, z: spot.z, turn: spot.turn, scale: mouth / 0.15});
                return;
            }
            if (profile.form === "burrow") {
                burrowMouths.push({x: spot.x, y: spot.y - 0.02, z: spot.z, turn: spot.turn, scale: Math.max(radius, 0.12) / 0.28, up: new Vector3(up.x, up.y, up.z)});
                return;
            }
            const key = `${profile.form}:${profile.lining}:${profile.closed ? 1 : 0}`;
            const group = nestGroups.get(key) ?? {form: profile.form, lining: profile.lining, closed: Boolean(profile.closed), items: [], sites: []};
            group.items.push({x: spot.x, y: spot.y, z: spot.z, turn: spot.turn, scale: radius, up: spot.up ? new Vector3(up.x, up.y, up.z) : undefined, stage: 1});
            group.sites.push(info);
            nestGroups.set(key, group);
            // The clutch in the sitter's own nest, on the cup's floor.
            const floor = EGG_FLOOR[profile.form];
            if (!spot.own || !plan.eggs || floor === undefined) return;
            const length = eggLength(drawn);
            const look = eggLook(plan.slug, profile);
            const c = Math.cos(spot.turn);
            const s = Math.sin(spot.turn);
            for (let k = 0; k < plan.eggs; k++) {
                const a = k * 2.39996 + random();
                const d = plan.eggs === 1 ? 0 : Math.min(radius * 0.32, length * 0.62 * Math.sqrt(plan.eggs)) * Math.sqrt((k + 0.5) / plan.eggs);
                const lx = Math.cos(a) * d;
                const lz = Math.sin(a) * d;
                eggs.push({
                    x: spot.x + lx * c + lz * s,
                    y: spot.y + floor * radius - length * 0.18,
                    z: spot.z - lx * s + lz * c,
                    turn: random() * Math.PI,
                    scale: length / 0.06,
                    tint: new Color().setHSL(look.hue + (random() - 0.5) * 0.03, look.saturation, look.lightness + (random() - 0.5) * 0.05)
                });
            }
            void n;
        });
    }
    registerNestSites(nestSites);
    const nestMaterial = propMaterial({texture: 1, textureScale: 5, textureStrength: 0.3, roughness: 0.95, growth: true, doubleSide: true});
    // Eggs: a faint sheen, no ground texture.
    const eggMaterial = propMaterial({roughness: 0.55});
    extraMaterials.push(eggMaterial);
    extraMaterials.push(nestMaterial);
    const nestBatches: Array<{batch: LodBatch; sites: NestSiteInfo[]}> = [];
    let seed = 0;
    nestGroups.forEach((group) => {
        const batch = new LodBatch(`nest-${group.form}-${group.lining}`, group.items, nestGeometry(group.form, group.lining, {closed: group.closed, seed: seed++}), nestFarGeometry(group.form), nestMaterial, {cap: 24, reach: NEST_REACH[group.form] ?? 1});
        add(batch);
        nestBatches.push({batch, sites: group.sites});
    });
    if (hollows.length) add(new LodBatch("nest-hole", hollows, shapes.hollow(0.15), null, warm, {cap: 16, reach: 0.9}));
    if (burrowMouths.length) add(new LodBatch("nest-burrow", burrowMouths, shapes.warrenMouth(0.28), null, decal, {cap: 16, reach: 0.9}));
    if (eggs.length) add(new LodBatch("eggs", eggs, eggGeometry(0.06), null, eggMaterial, {cap: 60, reach: 0.6, fine: false}));
    const stageCache = new Map<NestSiteInfo, number>();
    const setNestStages = (t: number | null): boolean => {
        let changed = false;
        for (const {batch, sites: list} of nestBatches) {
            const values = list.map((site) => {
                const stage = t === null ? 1 : nestStage(site.speciesId, site.siteId, t);
                // Steps of a hundredth: a refill only when the nest has visibly grown.
                const rounded = Math.round(stage * 100) / 100;
                if (stageCache.get(site) !== rounded) changed = true;
                stageCache.set(site, rounded);
                return rounded;
            });
            batch.setStages(values);
        }
        return changed;
    };

    // MARK: Ants: a mound by the zone's corner, its trail to a tree and up the trunk (and up the cottage's wall at Home)
    if (has("ants")) {
        const ants = first("ants")!;
        const random = propRandom("ants");
        const corner = zoneCorner(ants.zone);
        // The tree the trail climbs: the nearest trunk (a sampler `bark` point, on the drawn bark) near the zone's corner.
        const barkPoint = trunkPoint({x: corner.x, z: corner.z}, ants.zone, used);
        const tree = barkPoint ? treeOf(barkPoint.host) : null;
        const outward = barkPoint ? Math.atan2(barkPoint.normal.z, barkPoint.normal.x) : 0;
        const moundAt = barkPoint && tree ? {x: tree.x + Math.cos(outward) * 2.6, z: tree.z + Math.sin(outward) * 2.6} : {x: corner.x + 1.5, z: corner.z + 1};
        const moundY = groundAt(moundAt.x, moundAt.z);
        marks.ants = {x: moundAt.x, y: moundY, z: moundAt.z};
        if (tree) marks.antsTree = {x: tree.x, y: tree.y, z: tree.z};
        const mounds: PropInstance[] = [{x: moundAt.x, y: moundY - 0.02, z: moundAt.z, turn: random() * 6, scale: 1}];
        add(new LodBatch("ant-mound", mounds, shapes.antMound(0.5, 0.34), shapes.heap(0.5, 0.34, "#7b5d3f", 1, 0.05), soil, {cap: 4, reach: 1.4}));
        const trails: BufferGeometry[] = [];
        const dots: PropInstance[] = [];
        if (barkPoint && tree) {
            // The trunk's radius where the bark point is (its distance from the trunk's axis), so the trail lies on the bark.
            const trunkR = Math.max(Math.hypot(barkPoint.x - tree.x, barkPoint.z - tree.z), 0.06);
            const ang = outward;
            const foot = {x: tree.x + Math.cos(ang) * trunkR * 1.08, z: tree.z + Math.sin(ang) * trunkR * 1.08};
            const ground = groundPath(moundAt.x - Math.cos(ang) * 0.4, moundAt.z - Math.sin(ang) * 0.4, foot.x, foot.z, 0.25, random);
            trails.push(strip(ground, 0.1, "#b39a72", () => 0.95));
            dots.push(...specks(ground, 0.03, random));
            // Up the trunk to the bark point.
            const up: Array<{p: Vector3; n: Vector3}> = [];
            const base = groundAt(foot.x, foot.z);
            const height = Math.max(barkPoint.y - base, 0.8);
            for (let k = 0; k <= 12; k++) {
                const t = k / 12;
                const twist = ang + Math.sin(t * 3) * 0.3;
                const r = trunkR * (1.04 + 0.25 * (1 - t));
                up.push({p: new Vector3(tree.x + Math.cos(twist) * r, base + t * height, tree.z + Math.sin(twist) * r), n: new Vector3(Math.cos(twist), 0, Math.sin(twist))});
            }
            trails.push(strip(up, 0.06, "#2a1f17"));
            dots.push(...specks(up, 0.025, random));
        }
        // Along the ground in another direction, foraging.
        const away = groundPath(moundAt.x + 0.4, moundAt.z, moundAt.x + 3.2, moundAt.z + 1.8, 0.4, random);
        trails.push(strip(away, 0.08, "#b0976f", () => 0.92));
        dots.push(...specks(away, 0.035, random));
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
        add(new LodBatch("ants", dots, merge([paint(new BoxGeometry(0.016, 0.012, 0.03), "#120c08"), paint(new BoxGeometry(0.012, 0.01, 0.012).translate(0, 0, 0.022), "#120c08")]), null, warm, {cap: 900, reach: 0.4, fine: true}));
    }

    // MARK: Bees: comb in a tree hollow, and a hive in the garden
    if (has("bees")) {
        const bees = first("bees")!;
        const corner = zoneCorner(bees.zone === "farm_garden" ? "woodland" : bees.zone);
        // A hollow in a trunk (a sampler `bark` point on the drawn bark), two to four metres up, facing open ground.
        const hollow = trunkPoint({x: corner.x, z: corner.z}, bees.zone === "farm_garden" ? "woodland" : bees.zone, used, 1.6, 4);
        if (hollow) {
            used.add(hollow.host);
            const turn = Math.atan2(hollow.normal.x, hollow.normal.z);
            const combNest = merge([shapes.hollow(0.2), shapes.comb(0.2)]);
            add(new LodBatch("bee-hollow", [{x: hollow.x, y: hollow.y, z: hollow.z, turn, scale: 1}], combNest, null, warm, {cap: 2, reach: 1}));
            marks.beesHollow = {x: hollow.x, y: hollow.y, z: hollow.z};
            marks.beesFacing = {x: hollow.normal.x, y: 0, z: hollow.normal.z};
        }
        const hiveX = COTTAGE.x - 6.2;
        const hiveZ = COTTAGE.z - 2.4;
        marks.hiveBox = {x: hiveX, y: groundAt(hiveX, hiveZ), z: hiveZ};
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
        // Between two tall flowers (sampler `flower_head` points a hand to a stride apart), as garden orb weavers hang them:
        // the web's middle a little below the heads, its face square to the line between them.
        const spiders = first("spiders")!;
        const corner = zoneCorner(spiders.zone);
        const heads = [...propsPoints("flower_head", {x: corner.x, z: corner.z, radius: 30}), ...propsPoints("flower_head", {x: COTTAGE.x, z: COTTAGE.z, radius: 20})];
        const random = propRandom("webs");
        for (let i = 0; i < heads.length && webs.length < 6; i++) {
            const a = heads[i];
            const b = heads.slice(i + 1).find((other) => {
                const d = Math.hypot(other.x - a.x, other.z - a.z);
                return d > 0.25 && d < 0.8 && Math.abs(other.y - a.y) < 0.25;
            });
            if (!b) continue;
            const mid = {x: (a.x + b.x) / 2, y: Math.min(a.y, b.y) - 0.04, z: (a.z + b.z) / 2};
            if (webs.some((w) => Math.hypot(w.x - mid.x, w.z - mid.z) < 1.2)) continue;
            const span = Math.hypot(b.x - a.x, b.z - a.z);
            const radius = Math.min(span * 0.42, Math.max(mid.y - groundAt(mid.x, mid.z) - 0.04, 0.08) * 0.9);
            webs.push({x: mid.x, y: mid.y - radius, z: mid.z, facing: Math.atan2(b.x - a.x, b.z - a.z) + Math.PI / 2 + (random() - 0.5) * 0.2, radius});
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
        marks.warren = {x: at.x, y: at.ground, z: at.z - 1.5};
        add(new LodBatch("warren", mouths, shapes.warrenMouth(0.28), null, decal, {cap: 10, reach: 1}));
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
            marks[group] ??= {x, y: groundAt(x, z), z};
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
            const along = 9 + k * 4.5;
            const x0 = beach.x - oz * along - ox * 2.5;
            const z0 = beach.z + ox * along - oz * 2.5;
            const dry = dryGround(x0, z0, {x: x0 - ox * 4, z: z0 - oz * 4});
            nests.push({x: dry.x, y: dry.y - 0.04, z: dry.z, turn: out, scale: 1});
            if (k === 0) marks.turtleNest = {x: dry.x, y: dry.y, z: dry.z};
            // The clutch at the bottom of its pit, a heap of round eggs half in the sand.
            for (let e = 0; e < nest.eggs; e++) {
                const a = e * 2.39996;
                const d = 0.035 + 0.1 * Math.sqrt((e + 0.5) / nest.eggs);
                eggsHere.push({x: dry.x + Math.cos(a) * d, y: dry.y + 0.01 + (e < 3 ? 0.03 : 0), z: dry.z + Math.sin(a) * d, turn: e, scale: 0.8, tint: new Color("#f4efe4")});
            }
            // Two lines of flipper marks to the waterline and back.
            for (const offset of [-0.32, 0.32]) {
                let wx = dry.x + ox * 0.9;
                let wz = dry.z + oz * 0.9;
                for (let s = 0; s < 40 && groundAt(wx, wz) > -0.05; s++) {
                    wx += ox * 0.35;
                    wz += oz * 0.35;
                }
                const line = groundPath(dry.x + ox * 0.9 - oz * offset, dry.z + oz * 0.9 + ox * offset, wx - oz * offset, wz + ox * offset, 0.12, random);
                tracks.push(strip(line, 0.09, "#b59c74", (t, i) => (Math.floor(i / 6) % 3 === 0 ? 0.8 : 1.0)));
            }
        });
        add(new LodBatch("turtle-nests", nests, shapes.turtleNest(0.65), null, sand, {cap: 6, reach: 1}));
        if (eggsHere.length) add(new LodBatch("turtle-eggs", eggsHere, eggGeometry(0.06), null, warm, {cap: 40, reach: 0.5}));
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
        marks.beaverLodge = {x: lodge.x, y: 0, z: lodge.z};
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
    const slimeGlints: number[] = [];
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
            trails.push(strip(points, 0.018, "#ffffff"));
        }
        // Up the cottage's front wall from the flower bed, wandering.
        const wallZ = COTTAGE.z + COTTAGE.depth / 2 + 0.012;
        const wall: Array<{p: Vector3; n: Vector3}> = [];
        for (let k = 0; k <= 18; k++) wall.push({p: new Vector3(COTTAGE.x - 2.3 + Math.sin(k * 0.45) * 0.18 + k * 0.02, COTTAGE.floor - 0.05 + k * 0.07, wallZ), n: new Vector3(0, 0, 1)});
        trails.push(strip(wall, 0.016, "#ffffff"));
        marks.slimeWall = {x: COTTAGE.x - 2.1, y: COTTAGE.floor + 0.6, z: wallZ};
        if (rocks[0]) marks.slimeRock = {x: rocks[0].x, y: rocks[0].y, z: rocks[0].z};
        // Across the path's stones.
        const path = groundPath(COTTAGE.x - 0.6, COTTAGE.z + 4.6, COTTAGE.x + 0.7, COTTAGE.z + 6.8, 0.3, random);
        trails.push(strip(path, 0.016, "#ffffff"));
        const geometry = merge(trails);
        // Glints along the trails (`effects.ts` draws them): a point every few centimetres.
        const position = geometry.getAttribute("position");
        for (let i = 0; i < position.count; i += 9) slimeGlints.push(position.getX(i), position.getY(i) + 0.004, position.getZ(i));
        add(new LodBatch("slime-trails", [{x: 0, y: 0, z: 0, turn: 0, scale: 1}], geometry, null, slime, {cap: 1, reach: 100, fine: true}));
        batches[batches.length - 1].setCentre(new Vector3(COTTAGE.x, COTTAGE.floor, COTTAGE.z));
        setGlint = (glint) => {
            slime.opacity = 0.12 + 0.35 * glint;
        };
    }

    return {
        group,
        batches,
        webs,
        roost: has("bats"),
        slimeGlints: new Float32Array(slimeGlints),
        marks: {...marks, ...(webs[0] ? {web: webs[0]} : {}), ...(webs[1] ? {webBranch: webs[1]} : {})},
        nests: nestsOut,
        nestSites,
        setNestStages,
        setGlint,
        dispose: () => {
            for (const batch of batches) batch.dispose();
            warm.dispose();
            slime.dispose();
            decal.dispose();
            soil.dispose();
            straw.dispose();
            sand.dispose();
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
    const lines = new LineSegments(geometry, new LineBasicMaterial({color: new Color("#eef2f4"), transparent: true, opacity: 0.26, depthWrite: false}));
    lines.name = "props:webs";
    return {lines, beads: new Float32Array(beads)};
}

