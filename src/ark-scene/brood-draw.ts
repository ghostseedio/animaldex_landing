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
    ConeGeometry,
    CylinderGeometry,
    DynamicDrawUsage,
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

const SHELL = new Color("#f2eadb");
const SPECKLED = new Color("#d9e3d0");
const SAC = new Color("#f4f1e6");
const SPAWN = new Color("#dfe9dc");
const TWIGS = new Color("#7d6448");
const SCRAPE = new Color("#9d8466");
const TADPOLE = new Color("#2a2622");
const GRUB = new Color("#d8cfae");
const PLAIN = new Color("#a8977a");

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
const CAPS = {high: {eggs: 3072, spawn: 4096, nests: 512, specks: 2048}, medium: {eggs: 1536, spawn: 2048, nests: 256, specks: 1024}, low: {eggs: 768, spawn: 1024, nests: 128, specks: 512}} as const;

export class BroodDraw implements BroodSink {
    readonly root = new Group();
    private readonly pools: {nest: Pool; scrape: Pool; eggs: Pool; spawn: Pool; oval: Pool; four: Pool; fry: Pool; tadpole: Pool; grub: Pool};
    private readonly matrix = new Matrix4();
    private readonly quaternion = new Quaternion();
    private readonly position = new Vector3();
    private readonly scale = new Vector3();
    private readonly axis = new Vector3(1, 0, 0.4).normalize();
    private readonly up = new Vector3(0, 1, 0);
    private readonly colours = new Map<string, Color>();

    /** `colourOf`: a species' own colour (its model's, as its herd's specks are tinted), or null until its model is in. */
    constructor(tier: "high" | "medium" | "low", private readonly colourOf: (slug: string) => Color | null) {
        const caps = CAPS[tier];
        const matte = () => new MeshStandardMaterial({roughness: 0.9, metalness: 0});
        const egg = new SphereGeometry(0.5, 8, 6);
        egg.scale(0.8, 1, 0.8);
        const ring = new TorusGeometry(0.5, 0.16, 5, 14);
        ring.rotateX(Math.PI / 2);
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
            grub: new Pool(unitBox(grub), matte(), caps.specks, false)
        };
        this.root.name = "broods";
        for (const pool of Object.values(this.pools)) {
            pool.mesh.receiveShadow = pool === this.pools.nest || pool === this.pools.scrape;
            this.root.add(pool.mesh);
        }
        // (Spawn floats at the water's top: drawn after the water's surfaces (2), as the wakes on it are, so it is seen from above.)
        this.pools.spawn.mesh.renderOrder = 3;
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

    egg(look: EggLook, x: number, y: number, z: number, size: number, roll: number) {
        const s = Math.max(size, 0.0001);
        this.quaternion.setFromAxisAngle(this.axis, roll);
        this.matrix.compose(this.position.set(x, y, z), this.quaternion, this.scale.set(s, s, s));
        if (look === "spawn") this.pools.spawn.push(this.matrix, SPAWN);
        else this.pools.eggs.push(this.matrix, look === "sac" ? SAC : look === "speckled" ? SPECKLED : SHELL);
    }

    speck(look: SpeckLook, slug: string, x: number, y: number, z: number, yaw: number, length: number, scale: number) {
        const k = Math.min(Math.max(scale, 0), 1);
        if (k <= 0.01) return;
        const l = length * k;
        // (Its body's proportions by its shape: wide and tall as a share of its length.)
        const wide = look === "four" ? 0.36 : look === "oval" ? 0.5 : look === "tadpole" ? 0.36 : look === "fry" ? 0.2 : 0.34;
        const tall = look === "four" ? 0.62 : look === "oval" ? 0.58 : look === "tadpole" ? 0.3 : look === "fry" ? 0.26 : 0.3;
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
