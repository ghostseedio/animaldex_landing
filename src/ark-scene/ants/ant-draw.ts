/**
 * The ant colonies drawn (lane ARK-ANTS): each colony's nest (a hole in the ground or paving, a fire ants' dome with no
 * opening, a leafcutters' mound, a harvesters' cleared patch, a honeypot crater, a weaver ants' leaf nest up a tree, an
 * army ants' bivouac), its trail to real food as a faint scent line (a leafcutters' cleared highway), and its workers
 * as many tiny instanced ants: one draw call for every ant, one for what they carry (leaf pieces, seeds, pieces of a
 * real body, brood). Only close up: nothing is drawn while the camera is further than a few hundred ant-lengths from
 * what it looks at, and only the ants within the view's reach are visited (`colony.ts`, closed forms of the clock).
 *
 * Loaded with the first colony ant the scene has (`index.ts`), never in the /ark page's static JavaScript. Visual only:
 * what it draws never decides anything on the Ark, and its trails only ever go to food the record has (`colony.ts`).
 *
 * Shared approach with lane ARK-WEBS (small instanced things): one `InstancedMesh` per shape with per-instance
 * colours, filled each frame from a pure function into a capped budget, no shadows, `frustumCulled` off (the view
 * window bounds it).
 */

import {
    BoxGeometry,
    BufferAttribute,
    BufferGeometry,
    Color,
    DoubleSide,
    DynamicDrawUsage,
    Group,
    IcosahedronGeometry,
    InstancedBufferAttribute,
    InstancedMesh,
    Mesh,
    MeshStandardMaterial,
    SphereGeometry,
    TorusGeometry,
    CylinderGeometry,
    PlaneGeometry,
    type Material,
    type Vector3
} from "three";
import {mergeGeometries} from "three/examples/jsm/utils/BufferGeometryUtils.js";
import {
    ANT_TICK_SECONDS,
    LOAD_BROOD,
    LOAD_LEAF,
    LOAD_NONE,
    LOAD_PIECE,
    LOAD_SEED,
    antKindOf,
    colonyKeyOf,
    finderAt,
    pathAt,
    raidNow,
    raiders,
    rivalEdge,
    searchers,
    seedOf,
    standoff,
    trailNow,
    trailPath,
    trailWorkers,
    u01,
    weaverChains,
    type AntFood,
    type AntLoad,
    type AntSink,
    type Colony,
    type Disturb,
    type Path,
    type Raid,
    type TrailPlan,
    type View
} from "@/ark-scene/ants/colony";

export type AntTier = "high" | "medium" | "low" | "lite";
/** Ants drawn at most, per tier. */
/** One shared pool of ants (and their loads), allocated at the tier's size only while a colony is in view close up, freed
 * after a few seconds with none: no per-colony buffers. A phone (low) draws at most 256 at once. */
export const ANT_BUDGET: Record<AntTier, number> = {high: 1024, medium: 512, low: 256, lite: 128};
/** Frames with no colony close up before the pool is freed (a few seconds). */
const POOL_IDLE_FRAMES = 240;

interface AntPool {
    size: number;
    ants: InstancedMesh;
    aFront: InstancedBufferAttribute;
    aBack: InstancedBufferAttribute;
    leaves: InstancedMesh;
    blobs: InstancedMesh;
}

export type AntHost = {
    groundY: (x: number, z: number) => number;
    /** The nearest tree trunk to a point within `r` (the scene's trunk colliders), or null. */
    trunkNear: (x: number, z: number, r: number, skip?: number) => {cx: number; cz: number; r: number; top: number} | null;
    /** Awake now by its activity (`isAwake` on the island's sun). */
    awake: (activity: string | null | undefined, epoch: number) => boolean;
};

export type AntMember = {id: string; slug: string; name: string; speciesId: string; zone: string; island?: string | null; area?: string | null; container?: string | null; x: number; z: number; hungry: boolean; activity?: string | null};

/** A line for the live log (`ArkSeenAct.words`), said once per episode. */
export type AntMoment = {memberId: string; name: string; speciesId: string; zone: string; key: AntWordKey; other: string | null; episode: string};
export type AntWordKey = "antTrailFound" | "antTend" | "antLeaves" | "antSeeds" | "antRaid" | "antBivouac" | "antWeave";

type ColonyState = Colony & {activity: string | null; nestMesh: Group | null; paths: Map<string, {path: Path; ribbon: Mesh | null}>; plan: TrailPlan | null; plantFood: AntFood | null; raid: Raid | null};

// MARK: Shapes (unit length along +z, up +y)

function antGeometry(): BufferGeometry {
    const parts: BufferGeometry[] = [];
    const part = (g: BufferGeometry, back: number) => {
        const n = g.getAttribute("position").count;
        const c = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) c[i * 3] = back;
        g.setAttribute("color", new BufferAttribute(c, 3));
        g.deleteAttribute("uv");
        parts.push(g.index ? g.toNonIndexed() : g);
    };
    const blob = (rx: number, ry: number, rz: number, z: number, y: number, back: number) => {
        const g = new SphereGeometry(1, 7, 5);
        g.scale(rx, ry, rz);
        g.translate(0, y, z);
        part(g, back);
    };
    blob(0.11, 0.1, 0.12, 0.36, 0.17, 0); // head
    blob(0.075, 0.075, 0.17, 0.12, 0.16, 0); // thorax
    blob(0.035, 0.04, 0.04, -0.06, 0.15, 0); // petiole
    blob(0.14, 0.12, 0.2, -0.26, 0.17, 1); // gaster
    const leg = (side: number, z: number, splay: number) => {
        const g = new BoxGeometry(0.34, 0.018, 0.018);
        g.translate(0.17, 0, 0);
        g.rotateZ(-0.55);
        g.rotateY(splay);
        if (side < 0) g.scale(-1, 1, 1);
        g.translate(side * 0.04, 0.15, z);
        part(g, 0);
    };
    for (const side of [1, -1]) {
        leg(side, 0.2, -0.5);
        leg(side, 0.12, 0);
        leg(side, 0.04, 0.55);
        const ant = new BoxGeometry(0.012, 0.012, 0.28);
        ant.translate(0, 0, 0.14);
        ant.rotateX(-0.5);
        ant.rotateY(side * 0.45);
        ant.translate(side * 0.04, 0.22, 0.44);
        part(ant, 0);
    }
    const merged = mergeGeometries(parts, false)!;
    merged.computeVertexNormals();
    return merged;
}

const twoTone = (material: MeshStandardMaterial) => {
    material.vertexColors = true;
    material.onBeforeCompile = (shader) => {
        shader.vertexShader = shader.vertexShader
            .replace("#include <common>", "#include <common>\nattribute vec3 aFront;\nattribute vec3 aBack;")
            .replace("#include <color_vertex>", "vColor = vec4(mix(aFront, aBack, color.r), 1.0).rgb;");
    };
    material.customProgramCacheKey = () => "ark-ant-two-tone";
};

// MARK: The layer

export class AntColonies {
    readonly group = new Group();
    private pool: AntPool | null = null;
    private idle = 0;
    private readonly antGeo: BufferGeometry;
    private readonly antMaterial: MeshStandardMaterial;
    private readonly leafGeo = new BoxGeometry(0.02, 0.9, 0.8);
    private readonly blobGeo = new IcosahedronGeometry(0.5, 0);
    private readonly leafMaterial = new MeshStandardMaterial({color: 0xffffff, roughness: 0.7, side: DoubleSide});
    private readonly blobMaterial = new MeshStandardMaterial({color: 0xffffff, roughness: 0.6});
    private budget = 0;
    private readonly sink: AntSink = (x, y, z, tx, ty, tz, ux, uy, uz, scale, load, front, back) => this.push(x, y, z, tx, ty, tz, ux, uy, uz, scale, load, front, back);
    private readonly finder = new Float32Array(9);
    private colonies: ColonyState[] = [];
    private membersKey = "";
    private foods: AntFood[] = [];
    private tier: AntTier = "high";
    private reduced = false;
    private count = 0;
    private leafCount = 0;
    private blobCount = 0;
    private readonly materials: Material[] = [];
    private readonly ribbonMaterialScent = new MeshStandardMaterial({color: 0x2c2418, roughness: 1, transparent: true, opacity: 0.15, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2});
    private readonly ribbonMaterialCleared = new MeshStandardMaterial({color: 0x6f5a40, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2});
    private stats = {drawn: 0, colonies: 0, trails: 0, ms: 0};

    constructor(private readonly host: AntHost) {
        this.antMaterial = new MeshStandardMaterial({roughness: 0.55, metalness: 0.05});
        twoTone(this.antMaterial);
        this.materials.push(this.antMaterial, this.leafMaterial, this.blobMaterial);
        this.antGeo = antGeometry();
        this.group.name = "ark-ants";
    }

    /** The shared pool at the tier's size (made when a colony first comes into view close up; remade on a tier change). */
    private ensurePool(): AntPool {
        const size = ANT_BUDGET[this.tier];
        if (this.pool && this.pool.size === size) return this.pool;
        this.freePool();
        // The ant geometry is shared; each pool gets its own copy so its instanced colours are its own.
        const geo = this.antGeo.clone();
        const ants = new InstancedMesh(geo, this.antMaterial, size);
        const aFront = new InstancedBufferAttribute(new Float32Array(size * 3), 3).setUsage(DynamicDrawUsage) as InstancedBufferAttribute;
        const aBack = new InstancedBufferAttribute(new Float32Array(size * 3), 3).setUsage(DynamicDrawUsage) as InstancedBufferAttribute;
        geo.setAttribute("aFront", aFront);
        geo.setAttribute("aBack", aBack);
        ants.instanceMatrix.setUsage(DynamicDrawUsage);
        const half = Math.max(16, size >> 1);
        const leaves = new InstancedMesh(this.leafGeo, this.leafMaterial, half);
        const blobs = new InstancedMesh(this.blobGeo, this.blobMaterial, half);
        for (const m of [ants, leaves, blobs]) {
            m.instanceMatrix.setUsage(DynamicDrawUsage);
            m.frustumCulled = false;
            m.count = 0;
        }
        this.group.add(ants, leaves, blobs);
        this.pool = {size, ants, aFront, aBack, leaves, blobs};
        return this.pool;
    }

    private freePool() {
        const p = this.pool;
        if (!p) return;
        this.group.remove(p.ants, p.leaves, p.blobs);
        p.ants.geometry.dispose();
        for (const m of [p.ants, p.leaves, p.blobs]) m.dispose();
        this.pool = null;
    }

    setTier(tier: AntTier, reduced: boolean) {
        this.tier = tier;
        this.reduced = reduced;
    }

    /** The record's colony ants (each one's kind, place and the engine's hunger): colonies rebuilt when they change. */
    setMembers(members: readonly AntMember[]) {
        // (Membership and hunger only: a member walking about does not rebuild its colony or move the nest.)
        const key = members.map((m) => `${m.id}:${m.hungry ? 1 : 0}`).sort().join(",");
        if (key === this.membersKey) return;
        this.membersKey = key;
        for (const c of this.colonies) this.dropColony(c);
        const groups = new Map<string, AntMember[]>();
        for (const m of members) {
            const k = colonyKeyOf(m.slug, m.island, m.zone, m.area, m.container);
            if (!k) continue;
            const list = groups.get(k) ?? [];
            list.push(m);
            groups.set(k, list);
        }
        this.colonies = [];
        for (const [k, list] of Array.from(groups)) {
            list.sort((a, b) => (a.id < b.id ? -1 : 1));
            const first = list[0];
            const kind = antKindOf(first.slug)!;
            const seed = seedOf(k);
            let nest = {x: first.x, y: this.host.groundY(first.x, first.z), z: first.z};
            let trunk: Colony["trunk"] = null;
            if (kind.nest === "leafnest" || kind.nest === "trunk" || kind.nest === "twig") {
                const t = this.host.trunkNear(first.x, first.z, 8);
                if (t) {
                    trunk = {cx: t.cx, cz: t.cz, r: t.r};
                    const a = u01(seed, 1) * Math.PI * 2;
                    const x = t.cx + Math.cos(a) * (t.r + (kind.nest === "leafnest" ? 0.1 : 0.004));
                    const z = t.cz + Math.sin(a) * (t.r + (kind.nest === "leafnest" ? 0.1 : 0.004));
                    const ground = this.host.groundY(x, z);
                    const h = kind.nest === "leafnest" ? Math.min(Math.max(t.top * 0.5, 1.4), 3.5) : kind.nest === "twig" ? Math.min(t.top * 0.4, 1.8) : 0.35;
                    nest = {x, y: ground + h, z};
                } else if (kind.nest === "leafnest") {
                    nest.y += 0.25;
                }
            }
            const colony: ColonyState = {key: k, kind, members: list.map((m) => m.id), name: first.name, speciesId: first.speciesId, zone: first.zone, nest, trunk, seed, hungry: list.every((m) => m.hungry), activity: first.activity ?? null, nestMesh: null, paths: new Map(), plan: null, plantFood: null, raid: null};
            // A leafcutters' plant: the nearest tree in reach (the world's real vegetation), fed days only (`eats`).
            if (kind.plants === "leaves") {
                const t = this.host.trunkNear(nest.x, nest.z, kind.reach, 0.8);
                if (t) {
                    const a = Math.atan2(nest.z - t.cz, nest.x - t.cx);
                    const x = t.cx + Math.cos(a) * t.r;
                    const z = t.cz + Math.sin(a) * t.r;
                    colony.plantFood = {key: `plant:${Math.round(t.cx * 10)}:${Math.round(t.cz * 10)}`, kind: "plant", x, z, y: this.host.groundY(x, z) + Math.min(1.1, t.top * 0.3), trunk: {cx: t.cx, cz: t.cz, r: t.r}, from: -Infinity, until: Infinity, label: "leaves"};
                }
            }
            this.colonies.push(colony);
        }
        this.stats.colonies = this.colonies.length;
    }

    /** Real food the record has: bodies lying where they died, sap-sucking Ark animals (`colony.ts`). */
    setFoods(foods: readonly AntFood[]) {
        this.foods = foods.slice();
    }

    private foodsOf(c: ColonyState): AntFood[] {
        return c.plantFood ? [...this.foods, c.plantFood] : this.foods;
    }

    private dropColony(c: ColonyState) {
        if (c.nestMesh) {
            this.group.remove(c.nestMesh);
            c.nestMesh.traverse((o) => (o as Mesh).geometry?.dispose());
        }
        for (const p of Array.from(c.paths.values())) if (p.ribbon) this.dropRibbon(p.ribbon);
        c.paths.clear();
    }

    private dropRibbon(ribbon: Mesh) {
        this.group.remove(ribbon);
        ribbon.geometry.dispose();
        if (ribbon.material !== this.ribbonMaterialCleared) (ribbon.material as MeshStandardMaterial).dispose();
    }

    /** How near the camera may come over a colony (a few ant-lengths), or 4 (the usual) away from them. */
    closeUp(x: number, z: number): number {
        let want = 4;
        for (const c of this.colonies) if (Math.hypot(c.nest.x - x, c.nest.z - z) < c.kind.reach + 1) want = Math.min(want, Math.max(c.kind.length * 12, 0.03));
        return want;
    }

    colonyList(): readonly Colony[] {
        return this.colonies;
    }

    /** Every frame: the ants near what the camera looks at. */
    update(camera: Vector3, target: Vector3, viewDistance: number, epoch: number, rain: number, feet: readonly Disturb[]) {
        const t0 = performance.now();
        const at = this.reduced ? Math.floor(epoch / 60) * 60 : epoch;
        this.count = this.leafCount = this.blobCount = 0;
        let trails = 0;
        // The pool only while some colony is in view close up (freed a few seconds after the last).
        let anyClose = false;
        for (const c of this.colonies) {
            const reachView = Math.min(Math.max(viewDistance * 1.3, 0.12), 6);
            if (viewDistance < c.kind.length * 700 && Math.hypot(c.nest.x - target.x, c.nest.z - target.z) <= c.kind.reach + reachView + 1) {
                anyClose = true;
                break;
            }
        }
        if (anyClose) this.idle = 0;
        else if (this.pool && ++this.idle > POOL_IDLE_FRAMES) this.freePool();
        const pool = anyClose ? this.ensurePool() : null;
        this.budget = pool ? pool.size : 0;
        const budget = this.budget;
        const sink = this.sink;
        const ground = this.host.groundY;
        for (const c of this.colonies) {
            const near = Math.hypot(c.nest.x - target.x, c.nest.z - target.z);
            const kind = c.kind;
            const close = viewDistance < kind.length * 700;
            const reachView = Math.min(Math.max(viewDistance * 1.3, 0.12), 6);
            const view: View = {x: target.x, z: target.z, r: reachView};
            const awake = this.host.awake(c.activity, at);
            this.ensureNest(c, near < 60 && viewDistance < 40);
            c.plan = trailNow(c, this.foodsOf(c), at);
            if (c.plan) trails++;
            // The trail's line: a scent line close up; a leafcutters' cleared highway further.
            // The line only while it is shown (made then, freed when it is not): the ants themselves show the trail.
            const show = c.plan !== null && (kind.form === "leafcut" ? viewDistance < 30 : viewDistance < kind.length * 250) && near < kind.reach + reachView + 1;
            c.paths.forEach((p, key) => {
                if (p.ribbon && (!show || key !== c.plan!.food.key)) {
                    this.dropRibbon(p.ribbon);
                    p.ribbon = null;
                }
            });
            if (show && c.plan) {
                const p = this.pathOf(c, c.plan.food);
                if (!p.ribbon) p.ribbon = this.makeRibbon(c, p.path);
                p.ribbon.visible = true;
                if (kind.form !== "leafcut") (p.ribbon.material as MeshStandardMaterial).opacity = 0.02 + 0.06 * c.plan.strength;
            }
            if (kind.form === "column") {
                c.raid = raidNow(c, this.foods, at, ground);
                this.moveBivouac(c, c.raid.moving > 0.5 ? c.raid.next : c.raid.bivouac);
            }
            if (!close || near > kind.reach + reachView + 1) continue;
            if (kind.form === "column") {
                const raid = c.raid!;
                const carrying = this.foods.some((f) => f.kind === "carcass" && f.from <= at && f.until >= at && Math.hypot(f.x - raid.bivouac.x, f.z - raid.bivouac.z) <= kind.reach);
                if (awake) raiders(c, raid, at, view, budget - this.count, ground, sink, carrying);
                continue;
            }
            // The trail's ants, the finder laying it.
            if (c.plan && awake) {
                const p = this.pathOf(c, c.plan.food);
                trailWorkers(c, c.plan, p.path, at, view, rain, feet, sink);
                const o = this.finder;
                if (finderAt(c.plan, p.path, at, kind.speed, o)) sink(o[0], o[1], o[2], o[3], o[4], o[5], o[6], o[7], o[8], kind.length, c.plan.food.kind === "carcass" ? LOAD_PIECE : LOAD_NONE, kind.front, kind.back);
            }
            // Searchers: fewer while a trail draws the foragers; a few by the nest while it sleeps.
            // (By the ground they cover: a colony's foragers are many; a solo forager's colony sends fewer at once.)
            const range = Math.min(kind.reach, Math.max(0.25, kind.reach * 0.35));
            const many = Math.min(300, Math.round(40 * (range / 0.35) ** 2));
            const out = !awake ? 6 : c.plan && c.plan.phase !== "fading" ? Math.round(many * 0.25) : kind.form === "solo" || kind.form === "homing" ? Math.round(many * 0.15) : many;
            const harvest = kind.plants === "seeds" && !c.hungry ? {load: LOAD_SEED as AntLoad, foodX: 0, foodZ: 0} : null;
            searchers(c, at, awake, Math.round(out * (this.tier === "lite" ? 0.4 : 1)), view, ground, sink, harvest);
            if (kind.weave) weaverChains(c, at, view, sink);
        }
        // Rival colonies where their ranges meet.
        for (let i = 0; i < this.colonies.length; i++) for (let j = i + 1; j < this.colonies.length; j++) {
            const a = this.colonies[i];
            const b = this.colonies[j];
            if (viewDistance > Math.min(a.kind.length, b.kind.length) * 700) continue;
            const edge = rivalEdge(a, b);
            if (edge && this.host.awake(a.activity, at) && this.host.awake(b.activity, at)) standoff(a, b, edge, at, {x: target.x, z: target.z, r: Math.min(Math.max(viewDistance * 1.3, 0.12), 6)}, ground, sink);
        }
        if (pool) {
            pool.ants.count = this.count;
            pool.leaves.count = this.leafCount;
            pool.blobs.count = this.blobCount;
            pool.ants.instanceMatrix.needsUpdate = true;
            pool.aFront.needsUpdate = true;
            pool.aBack.needsUpdate = true;
            pool.leaves.instanceMatrix.needsUpdate = true;
            if (pool.leaves.instanceColor) pool.leaves.instanceColor.needsUpdate = true;
            pool.blobs.instanceMatrix.needsUpdate = true;
            if (pool.blobs.instanceColor) pool.blobs.instanceColor.needsUpdate = true;
            pool.ants.visible = this.count > 0;
            pool.leaves.visible = this.leafCount > 0;
            pool.blobs.visible = this.blobCount > 0;
        }
        this.stats.drawn = this.count;
        this.stats.trails = trails;
        this.stats.ms = performance.now() - t0;
    }

    private readonly colour = new Color();

    private push(x: number, y: number, z: number, tx: number, ty: number, tz: number, ux: number, uy: number, uz: number, s: number, load: AntLoad, front: number, back: number): boolean {
        const pool = this.pool;
        if (!pool || this.count >= this.budget) return false;
        // Basis: forward t, up u (made square to t), right = u × t.
        let fl = Math.hypot(tx, ty, tz) || 1;
        tx /= fl;
        ty /= fl;
        tz /= fl;
        const d = ux * tx + uy * ty + uz * tz;
        ux -= tx * d;
        uy -= ty * d;
        uz -= tz * d;
        fl = Math.hypot(ux, uy, uz) || 1;
        ux /= fl;
        uy /= fl;
        uz /= fl;
        const rx = uy * tz - uz * ty;
        const ry = uz * tx - ux * tz;
        const rz = ux * ty - uy * tx;
        const m = pool.ants.instanceMatrix.array as Float32Array;
        const o = this.count * 16;
        m[o] = rx * s; m[o + 1] = ry * s; m[o + 2] = rz * s; m[o + 3] = 0;
        m[o + 4] = ux * s; m[o + 5] = uy * s; m[o + 6] = uz * s; m[o + 7] = 0;
        m[o + 8] = tx * s; m[o + 9] = ty * s; m[o + 10] = tz * s; m[o + 11] = 0;
        m[o + 12] = x; m[o + 13] = y; m[o + 14] = z; m[o + 15] = 1;
        const f = pool.aFront.array as Float32Array;
        const b = pool.aBack.array as Float32Array;
        this.colour.setHex(front);
        f[this.count * 3] = this.colour.r; f[this.count * 3 + 1] = this.colour.g; f[this.count * 3 + 2] = this.colour.b;
        this.colour.setHex(back);
        b[this.count * 3] = this.colour.r; b[this.count * 3 + 1] = this.colour.g; b[this.count * 3 + 2] = this.colour.b;
        this.count++;
        if (load !== LOAD_NONE) {
            const leaf = load === LOAD_LEAF;
            const mesh = leaf ? pool.leaves : pool.blobs;
            const i = leaf ? this.leafCount : this.blobCount;
            if (i < (mesh.instanceMatrix.count ?? 0)) {
                const a = mesh.instanceMatrix.array as Float32Array;
                const k = i * 16;
                // A leaf piece held upright over the head (as big as the ant); a seed, a piece or brood in the jaws.
                const size = leaf ? s * 1.15 : load === LOAD_SEED ? s * 0.32 : load === LOAD_BROOD ? s * 0.38 : s * 0.42;
                const up = leaf ? 0.62 : 0.17;
                const fwd = leaf ? 0.25 : 0.52;
                a[k] = rx * size; a[k + 1] = ry * size; a[k + 2] = rz * size; a[k + 3] = 0;
                a[k + 4] = ux * size; a[k + 5] = uy * size; a[k + 6] = uz * size; a[k + 7] = 0;
                const stretch = load === LOAD_BROOD ? 1.6 : 1;
                a[k + 8] = tx * size * stretch; a[k + 9] = ty * size * stretch; a[k + 10] = tz * size * stretch; a[k + 11] = 0;
                a[k + 12] = x + ux * s * up + tx * s * fwd; a[k + 13] = y + uy * s * up + ty * s * fwd; a[k + 14] = z + uz * s * up + tz * s * fwd; a[k + 15] = 1;
                const tone = u01(seedOf(`${Math.round(x * 1e4)}`), i);
                this.colour.setHex(leaf ? 0x4f8a2c : load === LOAD_SEED ? 0xc9a66b : load === LOAD_BROOD ? 0xf1ead8 : 0x5a4030);
                if (leaf) this.colour.offsetHSL((tone - 0.5) * 0.05, 0, (tone - 0.5) * 0.12);
                mesh.setColorAt(i, this.colour);
                if (leaf) this.leafCount++;
                else this.blobCount++;
            }
        }
        return true;
    }

    private pathOf(c: ColonyState, food: AntFood): {path: Path; ribbon: Mesh | null} {
        let p = c.paths.get(food.key);
        if (!p) {
            const path = trailPath(c, food, this.host.groundY);
            p = {path, ribbon: null};
            c.paths.set(food.key, p);
            // (Old trails' lines dropped: a colony keeps a handful.)
            if (c.paths.size > 6) {
                const [oldKey, old] = c.paths.entries().next().value as [string, {path: Path; ribbon: Mesh | null}];
                if (old.ribbon) this.dropRibbon(old.ribbon);
                c.paths.delete(oldKey);
            }
        }
        return p;
    }

    /** A trail's mark: a very faint scent line one ant wide, or a leafcutters' cleared highway. */
    private makeRibbon(c: ColonyState, path: Path): Mesh {
        const width = c.kind.form === "leafcut" ? 0.045 : c.kind.length;
        const ribbon = new Mesh(ribbonGeometry(path, width), c.kind.form === "leafcut" ? this.ribbonMaterialCleared : this.ribbonMaterialScent.clone());
        ribbon.renderOrder = 1;
        ribbon.frustumCulled = false;
        this.group.add(ribbon);
        return ribbon;
    }

    private moveBivouac(c: ColonyState, at: {x: number; y: number; z: number}) {
        if (c.nestMesh) c.nestMesh.position.set(at.x, at.y, at.z);
    }

    private ensureNest(c: ColonyState, want: boolean) {
        if (!want) {
            if (c.nestMesh) {
                this.group.remove(c.nestMesh);
                c.nestMesh.traverse((o) => (o as Mesh).geometry?.dispose());
                c.nestMesh = null;
            }
            return;
        }
        if (!c.nestMesh) {
            c.nestMesh = nestMesh(c);
            c.nestMesh.position.set(c.nest.x, c.nest.y, c.nest.z);
            // (A hole in a trunk faces out from it.)
            if (c.trunk && (c.kind.nest === "trunk" || c.kind.nest === "twig")) {
                const a = Math.atan2(c.nest.z - c.trunk.cz, c.nest.x - c.trunk.cx);
                c.nestMesh.rotation.set(0, -a, -Math.PI / 2);
            }
            this.group.add(c.nestMesh);
        }
        c.nestMesh.visible = true;
    }

    /** What the log may say now about the colonies near the camera (each once per episode). */
    moments(epoch: number, target: Vector3, viewDistance: number): AntMoment[] {
        const out: AntMoment[] = [];
        const tick = Math.floor(epoch / ANT_TICK_SECONDS);
        for (const c of this.colonies) {
            if (Math.hypot(c.nest.x - target.x, c.nest.z - target.z) > c.kind.reach + 8 || viewDistance > 12) continue;
            if (!this.host.awake(c.activity, epoch)) continue;
            const say = (key: AntWordKey, other: string | null, episode: string) => out.push({memberId: c.members[0], name: c.name, speciesId: c.speciesId, zone: c.zone, key, other, episode: `ants:${c.key}:${episode}`});
            const plan = c.plan ?? trailNow(c, this.foodsOf(c), epoch);
            if (c.kind.form === "column") {
                const u = epoch / ANT_TICK_SECONDS - tick;
                if (u >= 0.85) say("antBivouac", null, `bivouac:${tick}`);
                else if (u < 0.65) say("antRaid", null, `raid:${tick}`);
                continue;
            }
            if (plan && plan.phase !== "fading") {
                if (plan.food.kind === "carcass" && plan.phase === "busy") say("antTrailFound", plan.food.label, plan.food.key);
                else if (plan.food.kind === "honeydew") say("antTend", plan.food.label, `${plan.food.key}:${tick}`);
                else if (plan.food.kind === "plant" && c.kind.form === "leafcut") say("antLeaves", null, `leaves:${tick}`);
            } else if (c.kind.plants === "seeds" && !c.hungry) {
                say("antSeeds", null, `seeds:${tick}`);
            }
            if (c.kind.weave && viewDistance < 4) say("antWeave", null, `weave:${tick}`);
        }
        return out;
    }

    debug() {
        return {
            ...this.stats,
            colonies: this.colonies.map((c) => ({key: c.key, slug: c.kind.slug, form: c.kind.form, nest: c.nest, members: c.members.length, hungry: c.hungry, plan: c.plan ? {food: c.plan.food.key, kind: c.plan.food.kind, phase: c.plan.phase, strength: c.plan.strength, found: c.plan.found, home: c.plan.home, path: this.samplePath(c, c.plan.food)} : null, plant: c.plantFood ? {key: c.plantFood.key, x: c.plantFood.x, y: c.plantFood.y, z: c.plantFood.z} : null, raid: c.raid})),
            foods: this.foods.map((f) => ({key: f.key, kind: f.kind, x: f.x, z: f.z, label: f.label}))
        };
    }

    /** The trail's path at tenths of its length (the harness frames it). */
    private samplePath(c: ColonyState, food: AntFood): Array<{x: number; y: number; z: number}> {
        const p = this.pathOf(c, food).path;
        const o = new Float32Array(9);
        const out: Array<{x: number; y: number; z: number}> = [];
        for (let k = 0; k <= 10; k++) {
            pathAt(p, (p.length * k) / 10, o);
            out.push({x: o[0], y: o[1], z: o[2]});
        }
        return out;
    }

    dispose() {
        for (const c of this.colonies) this.dropColony(c);
        this.freePool();
        this.antGeo.dispose();
        this.leafGeo.dispose();
        this.blobGeo.dispose();
        for (const m of this.materials) m.dispose();
        this.ribbonMaterialScent.dispose();
        this.ribbonMaterialCleared.dispose();
        this.group.removeFromParent();
    }
}

/** A flat strip along the path, `width` across, on its surface. */
function ribbonGeometry(path: Path, width: number): BufferGeometry {
    const n = path.n;
    const pos = new Float32Array(n * 2 * 3);
    const nor = new Float32Array(n * 2 * 3);
    for (let i = 0; i < n; i++) {
        const a = Math.max(i - 1, 0);
        const b = Math.min(i + 1, n - 1);
        let tx = path.p[b * 3] - path.p[a * 3];
        let ty = path.p[b * 3 + 1] - path.p[a * 3 + 1];
        let tz = path.p[b * 3 + 2] - path.p[a * 3 + 2];
        const l = Math.hypot(tx, ty, tz) || 1;
        tx /= l;
        ty /= l;
        tz /= l;
        const nx = path.nrm[i * 3];
        const ny = path.nrm[i * 3 + 1];
        const nz = path.nrm[i * 3 + 2];
        const sx = ty * nz - tz * ny;
        const sy = tz * nx - tx * nz;
        const sz = tx * ny - ty * nx;
        for (let k = 0; k < 2; k++) {
            const side = (k ? 0.5 : -0.5) * width;
            const o = (i * 2 + k) * 3;
            pos[o] = path.p[i * 3] + sx * side + nx * 0.0006;
            pos[o + 1] = path.p[i * 3 + 1] + sy * side + ny * 0.0006;
            pos[o + 2] = path.p[i * 3 + 2] + sz * side + nz * 0.0006;
            nor[o] = nx;
            nor[o + 1] = ny;
            nor[o + 2] = nz;
        }
    }
    const index: number[] = [];
    for (let i = 0; i < n - 1; i++) {
        const a = i * 2;
        // (Facing the path's normal: up on the ground, out on a trunk.)
        index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(pos, 3));
    g.setAttribute("normal", new BufferAttribute(nor, 3));
    g.setIndex(index);
    return g;
}

const SOIL = new MeshStandardMaterial({color: 0x8a6a48, roughness: 1});
const LOOSE = new MeshStandardMaterial({color: 0x7d6347, roughness: 1, flatShading: true});
/** The bivouac's size (m across is twice this). */
export const BIVOUAC_RADIUS = 0.12;

/** A low dome of loose soil, lumpy (seeded), `r` across and `h` high. */
function soilDome(r: number, h: number, seed: number): BufferGeometry {
    const g = new SphereGeometry(1, 28, 10, 0, Math.PI * 2, 0, Math.PI / 2);
    const p = g.getAttribute("position");
    for (let i = 0; i < p.count; i++) {
        const x = p.getX(i);
        const y = p.getY(i);
        const z = p.getZ(i);
        const a = Math.atan2(z, x);
        const bump = 1 + 0.06 * Math.sin(a * 5 + (seed % 7)) + 0.05 * Math.sin(a * 11 + y * 9) + 0.08 * (u01(seed, i) - 0.5);
        p.setXYZ(i, x * r * bump, y * h * (y > 0.02 ? bump : 1), z * r * bump);
    }
    g.computeVertexNormals();
    return g;
}
const DARK = new MeshStandardMaterial({color: 0x120c08, roughness: 1});
const BARE = new MeshStandardMaterial({color: 0xa48a66, roughness: 1, transparent: true, opacity: 0.85, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1});
const LEAF = new MeshStandardMaterial({color: 0x4c7a2a, roughness: 0.8, side: DoubleSide});
const HUSK = new MeshStandardMaterial({color: 0xd8c39a, roughness: 1});
const BIVOUAC = new MeshStandardMaterial({color: 0x3e1f10, roughness: 0.9});

/** The nest by its kind (the kind's own text, `ant-kinds.json` cite.nest); at the colony's nest point. */
function nestMesh(c: Colony): Group {
    const g = new Group();
    g.name = `ant-nest:${c.kind.slug}`;
    const len = c.kind.length;
    const hole = (r: number, x = 0, z = 0) => {
        const m = new Mesh(new CylinderGeometry(r, r, 0.002, 10), DARK);
        m.position.set(x, 0.0008, z);
        g.add(m);
    };
    const crumbs = (r: number, n: number) => {
        const geo = new IcosahedronGeometry(1, 0);
        const im = new InstancedMesh(geo, SOIL, n);
        const m = new Group().matrix;
        for (let i = 0; i < n; i++) {
            const a = u01(c.seed, i, 21) * Math.PI * 2;
            const d = r * (0.5 + 0.7 * u01(c.seed, i, 22));
            const s = len * (0.3 + 0.5 * u01(c.seed, i, 23));
            m.makeScale(s, s * 0.6, s);
            m.setPosition(Math.cos(a) * d, s * 0.2, Math.sin(a) * d);
            im.setMatrixAt(i, m);
        }
        g.add(im);
    };
    switch (c.kind.nest) {
        case "hole":
            hole(len * 0.8);
            crumbs(len * 3, 26);
            break;
        case "dome": {
            // Fire ants: a dome of loose soil with no opening on top.
            g.add(new Mesh(soilDome(0.16, 0.09, c.seed), LOOSE));
            crumbs(0.17, 60);
            break;
        }
        case "mound": {
            // Leafcutters: a broad mound of loose soil, several entrances.
            g.add(new Mesh(soilDome(0.55, 0.16, c.seed), LOOSE));
            crumbs(0.6, 120);
            for (let i = 0; i < 5; i++) {
                const a = (i / 5) * Math.PI * 2 + u01(c.seed, i) * 0.6;
                const r = 0.15 + 0.3 * u01(c.seed, i, 2);
                const h = Math.sqrt(Math.max(0, 1 - (r / 0.55) ** 2)) * 0.55 * 0.3;
                const e = new Mesh(new CylinderGeometry(0.018, 0.018, 0.003, 10), DARK);
                e.position.set(Math.cos(a) * r, h + 0.001, Math.sin(a) * r);
                g.add(e);
            }
            break;
        }
        case "crater": {
            const ring = new Mesh(new TorusGeometry(len * 4, len * 1.2, 6, 18), SOIL);
            ring.rotation.x = Math.PI / 2;
            ring.scale.set(1, 1, 0.5);
            g.add(ring);
            hole(len * 1.2);
            break;
        }
        case "cleared": {
            // Harvesters: a cleared circular patch of bare ground, the entrance, heaps of seed husks.
            const disc = new Mesh(new CylinderGeometry(0.7, 0.7, 0.001, 28), BARE);
            disc.position.y = 0.0006;
            g.add(disc);
            hole(len * 1.2);
            const im = new InstancedMesh(new IcosahedronGeometry(1, 0), HUSK, 40);
            const m = new Group().matrix;
            for (let i = 0; i < 40; i++) {
                const a = u01(c.seed, i, 31) * 1.4 + u01(c.seed, 0, 30) * Math.PI * 2;
                const d = 0.05 + 0.05 * u01(c.seed, i, 32);
                const s = len * 0.25;
                m.makeScale(s, s * 0.5, s * 1.6);
                m.setPosition(Math.cos(a) * d, s * 0.3, Math.sin(a) * d);
                im.setMatrixAt(i, m);
            }
            g.add(im);
            break;
        }
        case "leafnest": {
            // Weaver ants: leaves pulled together and stitched into a ball, up in a tree.
            const im = new InstancedMesh(new PlaneGeometry(0.09, 0.05), LEAF, 22);
            const m = new Group().matrix;
            const q = new Group();
            for (let i = 0; i < 22; i++) {
                const a = u01(c.seed, i, 41) * Math.PI * 2;
                const b = Math.acos(2 * u01(c.seed, i, 42) - 1);
                const r = 0.08;
                q.position.set(Math.sin(b) * Math.cos(a) * r, Math.cos(b) * r * 0.8, Math.sin(b) * Math.sin(a) * r);
                q.lookAt(0, 0, 0);
                q.rotateZ(u01(c.seed, i, 43) * 3);
                q.updateMatrix();
                m.copy(q.matrix);
                im.setMatrixAt(i, m);
            }
            g.add(im);
            break;
        }
        case "trunk":
        case "twig":
            hole(len * 0.9);
            break;
        case "bivouac": {
            // Army ants: the bivouac is a mass of the workers' own bodies (the ants on it are drawn by `raiders`); a dark
            // core under them.
            const m = new Mesh(soilDome(BIVOUAC_RADIUS * 0.92, BIVOUAC_RADIUS * 0.8, c.seed), BIVOUAC);
            g.add(m);
            break;
        }
    }
    g.traverse((o) => {
        o.castShadow = false;
        o.receiveShadow = true;
    });
    return g;
}
