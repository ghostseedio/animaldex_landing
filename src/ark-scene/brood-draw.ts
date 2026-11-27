/**
 * BROODS drawn in the world: the instanced meshes behind `live-broods.ts` (its `BroodSink`). Every nest, egg and
 * instanced member of every brood on the Ark is a handful of draw calls: one mesh for the twig nests, one for the
 * scrapes, one for the shelled eggs, one for the spawn, one each for the members' five small shapes. Written again
 * each frame from what the layer says is there now, so a count that drops is seen dropping.
 *
 * Nothing here decides anything; made only for a brood read that says `on: true` (`index.ts`).
 */

import {
    Color,
    BoxGeometry,
    ConeGeometry,
    CylinderGeometry,
    DynamicDrawUsage,
    Float32BufferAttribute,
    Group,
    InstancedBufferAttribute,
    InstancedMesh,
    Matrix4,
    MeshStandardMaterial,
    Quaternion,
    SphereGeometry,
    TorusGeometry,
    Vector3,
    type BufferGeometry
} from "three";
import {mergeGeometries} from "three/examples/jsm/utils/BufferGeometryUtils.js";
import {placeholderGeometry} from "@/ark-scene/placeholder";
import type {BroodSink, EggLook, NestLook, SpeckLook} from "@/ark-scene/live-broods";
import {eggLook, nestProfile} from "@/ark-scene/props/nest-kinds";

const SHELL = new Color("#f2eadb");
const SPECKLED = new Color("#d9e3d0");
const SAC = new Color("#f4f1e6");
const SPAWN = new Color("#dfe9dc");
const TWIGS = new Color("#7d6448");
const SCRAPE = new Color("#9d8466");
const TADPOLE = new Color("#2a2622");
const GRUB = new Color("#d8cfae");
const PLAIN = new Color("#a8977a");
const WHITE = new Color(1, 1, 1);
/** A nestling: its sparse down, its skin, its gape's flanges and the mouth inside. */
const DOWN = new Color("#8e8178");
const SKIN = new Color("#7a6a66");
const GAPE = new Color("#f2c335");
const MOUTH = new Color("#e2702c");

/** Scaled and moved to fill the unit box: x and z −0.5…0.5, y 0…1 (as `herd-specks.ts`). */
function unitBox(geometry: BufferGeometry): BufferGeometry {
    geometry.computeBoundingBox();
    const box = geometry.boundingBox!;
    geometry.translate(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2);
    geometry.scale(1 / Math.max(box.max.x - box.min.x, 0.001), 1 / Math.max(box.max.y - box.min.y, 0.001), 1 / Math.max(box.max.z - box.min.z, 0.001));
    for (const name of ["color", "uv"]) if (geometry.getAttribute(name)) geometry.deleteAttribute(name);
    geometry.computeBoundingSphere();
    return geometry;
}

/** A body and a tail behind it along −z (a fry's, a tadpole's): `head` the body's share of the length. */
function tailed(head: number, fat: number): BufferGeometry {
    const body = new SphereGeometry(0.5, 7, 5);
    body.scale(fat, fat, head);
    body.translate(0, 0, (1 - head) / 2);
    const tail = new ConeGeometry(0.22 * fat, 1 - head * 0.7, 5, 1);
    tail.rotateX(-Math.PI / 2);
    tail.scale(0.35, 1, 1);
    tail.translate(0, 0, -head * 0.35);
    const merged = mergeGeometries([body.toNonIndexed(), tail.toNonIndexed()]);
    body.dispose();
    tail.dispose();
    return unitBox(merged);
}

/**
 * A hatchling reptile seen from above (a crocodile's, a monitor's, a gecko's): a slim body, a head, a long tapering tail
 * and four legs out to the sides, lying flat; its head along +z. As a share of its length: about 0.3 across the legs,
 * 0.09 high.
 */
function lizard(): BufferGeometry {
    const part = (g: BufferGeometry, sx: number, sy: number, sz: number, x: number, y: number, z: number) => {
        g.scale(sx, sy, sz);
        g.translate(x, y, z);
        const flat = g.index ? g.toNonIndexed() : g;
        if (flat !== g) g.dispose();
        if (flat.getAttribute("uv")) flat.deleteAttribute("uv");
        return flat;
    };
    const tail = new ConeGeometry(0.5, 1, 6, 1);
    tail.rotateX(-Math.PI / 2);
    const parts = [
        part(new SphereGeometry(0.5, 8, 6), 0.15, 0.08, 0.36, 0, 0.045, 0.06),
        part(new SphereGeometry(0.5, 7, 5), 0.1, 0.065, 0.2, 0, 0.04, 0.3),
        part(tail, 0.11, 0.05, 0.5, 0, 0.035, -0.36),
        ...[0.16, -0.06].flatMap((z) => [-1, 1].map((side) => part(new BoxGeometry(1, 1, 1), 0.13, 0.025, 0.035, side * 0.1, 0.015, z)))
    ];
    const merged = mergeGeometries(parts);
    for (const g of parts) g.dispose();
    return unitBox(merged);
}

/** A geometry in one colour (vertex colours: the instance's own colour, white, leaves it as it is). */
function coloured(geometry: BufferGeometry, colour: Color): BufferGeometry {
    const g = geometry.index ? geometry.toNonIndexed() : geometry;
    if (g !== geometry) geometry.dispose();
    const n = g.getAttribute("position").count;
    const c = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
        c[i * 3] = colour.r;
        c[i * 3 + 1] = colour.g;
        c[i * 3 + 2] = colour.b;
    }
    g.setAttribute("color", new Float32BufferAttribute(c, 3));
    if (g.getAttribute("uv")) g.deleteAttribute("uv");
    return g;
}

/** A nestling's body (unit: its length; its belly at y 0, its front along +z): a low round lump of skin and sparse down. */
function nestlingBody(): BufferGeometry {
    const body = new SphereGeometry(0.5, 8, 6);
    body.scale(0.52, 0.4, 0.66);
    body.translate(0, 0.2, 0);
    return coloured(body, DOWN);
}

/**
 * A nestling's head (unit: the head is 1 across, its middle at the origin, its bill along +z): a round head and its open
 * gape, the wide yellow flanges of the upper and lower bill parted round the orange mouth, as a begging nestling's is.
 */
function nestlingHead(): BufferGeometry {
    const head = coloured(new SphereGeometry(0.5, 8, 6), SKIN);
    const bill = (tilt: number, lift: number) => {
        const cone = new ConeGeometry(0.4, 0.62, 7, 1);
        cone.rotateX(Math.PI / 2);
        cone.translate(0, 0, 0.31);
        cone.scale(1.05, 0.32, 1);
        cone.rotateX(tilt);
        cone.translate(0, lift, 0.3);
        return coloured(cone, GAPE);
    };
    const mouth = new SphereGeometry(0.5, 7, 5);
    mouth.scale(0.5, 0.34, 0.16);
    mouth.translate(0, 0, 0.42);
    const merged = mergeGeometries([head, bill(-0.32, 0.05), bill(0.26, -0.07), coloured(mouth, MOUTH)]);
    return merged;
}

class Pool {
    readonly mesh: InstancedMesh;
    private n = 0;
    private readonly colours: Float32Array;

    constructor(geometry: BufferGeometry, material: MeshStandardMaterial, readonly cap: number, shadow: boolean) {
        this.mesh = new InstancedMesh(geometry, material, cap);
        this.mesh.count = 0;
        this.mesh.frustumCulled = false;
        this.mesh.castShadow = shadow;
        this.mesh.receiveShadow = false;
        this.mesh.instanceMatrix.setUsage(DynamicDrawUsage);
        this.colours = new Float32Array(cap * 3);
        this.mesh.instanceColor = new InstancedBufferAttribute(this.colours, 3);
        this.mesh.instanceColor.setUsage(DynamicDrawUsage);
    }

    begin() {
        this.n = 0;
    }

    push(matrix: Matrix4, colour: Color) {
        if (this.n >= this.cap) return;
        this.mesh.setMatrixAt(this.n, matrix);
        this.colours[this.n * 3] = colour.r;
        this.colours[this.n * 3 + 1] = colour.g;
        this.colours[this.n * 3 + 2] = colour.b;
        this.n++;
    }

    end() {
        // (Nothing drawn and nothing was: nothing to send.)
        if (!this.n && !this.mesh.count) return;
        this.mesh.count = this.n;
        this.mesh.instanceMatrix.needsUpdate = true;
        this.mesh.instanceColor!.needsUpdate = true;
    }

    get count() {
        return this.n;
    }

    dispose() {
        this.mesh.geometry.dispose();
        (this.mesh.material as MeshStandardMaterial).dispose();
        this.mesh.dispose();
    }
}

/** How much the drawer holds at once, by tier (what is beyond it is not drawn: the nearest broods come first in the layer's order). */
const CAPS = {high: {eggs: 3072, spawn: 4096, nests: 512, specks: 2048, nestlings: 512}, medium: {eggs: 1536, spawn: 2048, nests: 256, specks: 1024, nestlings: 256}, low: {eggs: 768, spawn: 1024, nests: 128, specks: 512, nestlings: 128}} as const;

export class BroodDraw implements BroodSink {
    readonly root = new Group();
    private readonly pools: {nest: Pool; scrape: Pool; eggs: Pool; spawn: Pool; oval: Pool; four: Pool; fry: Pool; tadpole: Pool; grub: Pool; scaly: Pool; nestBody: Pool; nestHead: Pool};
    private readonly tilt = new Quaternion();
    private readonly side = new Vector3(1, 0, 0);
    private readonly matrix = new Matrix4();
    private readonly quaternion = new Quaternion();
    private readonly position = new Vector3();
    private readonly scale = new Vector3();
    private readonly axis = new Vector3(1, 0, 0.4).normalize();
    private readonly up = new Vector3(0, 1, 0);
    private readonly colours = new Map<string, Color>();
    private readonly eggColours = new Map<string, Color>();

    /** `colourOf`: a species' own colour (its model's, as its herd's specks are tinted), or null until its model is in. */
    constructor(tier: "high" | "medium" | "low", private readonly colourOf: (slug: string) => Color | null) {
        const caps = CAPS[tier];
        const matte = () => new MeshStandardMaterial({roughness: 0.9, metalness: 0});
        const egg = new SphereGeometry(0.5, 8, 6);
        egg.scale(0.8, 1, 0.8);
        const rim = new TorusGeometry(0.5, 0.16, 5, 14);
        rim.rotateX(Math.PI / 2);
        // (The cup's floor: a nest up a tree is seen from below and through, not only from above.)
        const floor = new CylinderGeometry(0.4, 0.3, 0.08, 14, 1);
        floor.translate(0, -0.1, 0);
        const ring = mergeGeometries([rim, floor]);
        rim.dispose();
        floor.dispose();
        const bead = new SphereGeometry(0.5, 6, 4);
        const oval = new SphereGeometry(0.5, 7, 5);
        const grub = new SphereGeometry(0.5, 6, 4);
        this.pools = {
            nest: new Pool(ring, new MeshStandardMaterial({roughness: 1, metalness: 0}), caps.nests, false),
            scrape: new Pool(new CylinderGeometry(0.55, 0.62, 0.06, 14, 1), new MeshStandardMaterial({roughness: 1, metalness: 0}), caps.nests, false),
            eggs: new Pool(egg, new MeshStandardMaterial({roughness: 0.55, metalness: 0}), caps.eggs, true),
            spawn: new Pool(bead, new MeshStandardMaterial({roughness: 0.25, metalness: 0, transparent: true, opacity: 0.74, depthWrite: false}), caps.spawn, false),
            oval: new Pool(unitBox(oval), matte(), caps.specks, true),
            four: new Pool(unitBox(placeholderGeometry("low")), matte(), caps.specks, true),
            fry: new Pool(tailed(0.62, 0.42), matte(), caps.specks, false),
            tadpole: new Pool(tailed(0.45, 0.7), matte(), caps.specks, false),
            grub: new Pool(unitBox(grub), matte(), caps.specks, false),
            scaly: new Pool(lizard(), matte(), caps.specks, false),
            nestBody: new Pool(nestlingBody(), new MeshStandardMaterial({roughness: 0.95, metalness: 0, vertexColors: true}), caps.nestlings, false),
            nestHead: new Pool(nestlingHead(), new MeshStandardMaterial({roughness: 0.7, metalness: 0, vertexColors: true}), caps.nestlings, false)
        };
        this.root.name = "broods";
        for (const pool of Object.values(this.pools)) {
            pool.mesh.receiveShadow = pool === this.pools.nest || pool === this.pools.scrape;
            this.root.add(pool.mesh);
        }
        // (Spawn floats at the water's top, and tadpoles keep to the top of the warm shallows: drawn after the water's
        // surfaces (2), as the wakes on it are, so they are seen from above through a hand's depth of clear water.)
        // (An opaque material is drawn before every transparent one whatever its order, the water among them: the
        // tadpoles' is marked transparent, at full opacity, to be drawn in that later pass.)
        this.pools.spawn.mesh.renderOrder = 3;
        this.pools.tadpole.mesh.renderOrder = 3;
        (this.pools.tadpole.mesh.material as MeshStandardMaterial).transparent = true;
    }

    begin() {
        for (const pool of Object.values(this.pools)) pool.begin();
    }

    end() {
        for (const pool of Object.values(this.pools)) pool.end();
    }

    nest(look: NestLook, x: number, y: number, z: number, size: number, alpha: number) {
        // (An ended nest fades by sinking away: the instances share one material.)
        const k = Math.min(Math.max(alpha, 0), 1);
        if (k <= 0.01) return;
        this.quaternion.identity();
        if (look === "nest") this.matrix.compose(this.position.set(x, y + size * 0.05 * k, z), this.quaternion, this.scale.set(size * (0.6 + 0.4 * k), size * 0.55 * k, size * (0.6 + 0.4 * k)));
        else this.matrix.compose(this.position.set(x, y + 0.01, z), this.quaternion, this.scale.set(size * k, size * k, size * k));
        this.pools[look === "nest" ? "nest" : "scrape"].push(this.matrix, look === "nest" ? TWIGS : SCRAPE);
    }

    egg(look: EggLook, x: number, y: number, z: number, size: number, roll: number, slug?: string) {
        const s = Math.max(size, 0.0001);
        this.quaternion.setFromAxisAngle(this.axis, roll);
        this.matrix.compose(this.position.set(x, y, z), this.quaternion, this.scale.set(s, s, s));
        if (look === "spawn") this.pools.spawn.push(this.matrix, SPAWN);
        else this.pools.eggs.push(this.matrix, look === "sac" ? SAC : look === "speckled" ? this.birdEgg(slug) : SHELL);
    }

    /** A bird's eggs' ground colour, as the props colour a clutch (`props/nest-kinds.ts` eggLook: a robin's blue, a duck's cream, a raptor's buff). */
    private birdEgg(slug: string | undefined): Color {
        if (!slug) return SPECKLED;
        let colour = this.eggColours.get(slug);
        if (!colour) {
            const look = eggLook(slug, nestProfile({model_slug: slug, name: "", zone: "woodland"}));
            colour = new Color().setHSL(look.hue, look.saturation, look.lightness);
            this.eggColours.set(slug, colour);
        }
        return colour;
    }

    speck(look: SpeckLook, slug: string, x: number, y: number, z: number, yaw: number, length: number, scale: number) {
        const k = Math.min(Math.max(scale, 0), 1);
        if (k <= 0.01) return;
        const l = length * k;
        // (Its body's proportions by its shape: wide and tall as a share of its length.)
        const wide = look === "four" ? 0.36 : look === "oval" ? 0.5 : look === "tadpole" ? 0.36 : look === "fry" ? 0.2 : look === "scaly" ? 0.3 : 0.34;
        const tall = look === "four" ? 0.62 : look === "oval" ? 0.58 : look === "tadpole" ? 0.3 : look === "fry" ? 0.26 : look === "scaly" ? 0.09 : 0.3;
        this.quaternion.setFromAxisAngle(this.up, yaw);
        this.matrix.compose(this.position.set(x, y, z), this.quaternion, this.scale.set(l * wide, l * tall, l));
        let colour = look === "tadpole" ? TADPOLE : look === "grub" ? GRUB : this.colours.get(slug) ?? null;
        if (!colour) {
            const own = this.colourOf(slug);
            if (own) this.colours.set(slug, own);
            colour = own ?? PLAIN;
        }
        this.pools[look].push(this.matrix, colour);
    }

    nestling(x: number, y: number, z: number, yaw: number, length: number, beg: number, scale: number) {
        const k = Math.min(Math.max(scale, 0), 1);
        if (k <= 0.01) return;
        const l = length * k;
        const b = Math.min(Math.max(beg, 0), 1);
        // Its body low in the cup, stretched up a little as it begs.
        this.quaternion.setFromAxisAngle(this.up, yaw);
        this.matrix.compose(this.position.set(x, y, z), this.quaternion, this.scale.set(l, l * (1 + 0.55 * b), l));
        this.pools.nestBody.push(this.matrix, WHITE);
        // Its head on top: lying forward on the body at rest; begging, up on its neck, the gape turned to the sky.
        const s = Math.sin(yaw);
        const c = Math.cos(yaw);
        const ahead = l * (0.22 - 0.1 * b);
        const head = l * (0.34 + 0.04 * b);
        this.tilt.setFromAxisAngle(this.side, -(0.3 + 0.95 * b));
        this.quaternion.multiply(this.tilt);
        this.matrix.compose(this.position.set(x + s * ahead, y + l * (0.36 + 0.5 * b), z + c * ahead), this.quaternion, this.scale.set(head, head, head));
        this.pools.nestHead.push(this.matrix, WHITE);
    }

    /** Development (the broods harness): what was drawn last frame. */
    counts(): Record<string, number> {
        const out: Record<string, number> = {};
        for (const [name, pool] of Object.entries(this.pools)) out[name] = pool.mesh.count;
        return out;
    }

    dispose() {
        for (const pool of Object.values(this.pools)) pool.dispose();
        this.root.removeFromParent();
    }
}
