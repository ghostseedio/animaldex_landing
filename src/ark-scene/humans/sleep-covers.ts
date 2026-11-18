/**
 * A sleeper's cover (humans polish, 2026-11-18). The bed furniture (`render/pet-homes.ts`) is a made bed: a thin duvet
 * over its foot. A person asleep in it lies under their own cover, drawn here, from past their feet up to their chest,
 * a rounded mound as wide as the body is (`COVER_HALF_WIDTH` each side: two fit the 1.15 m bed with a gap between), the
 * head, shoulders and arms out on the pillow. One per sleeper (`TownHumans.covers`), in the duvet's own colour, with the
 * flats' own material (`interiorMaterial`), instanced in one draw call and written into preallocated arrays each frame.
 */

import {BufferAttribute, BufferGeometry, Color, Group, InstancedMesh, Matrix4, Quaternion, Vector3} from "three";
import type {SleepCover} from "@/ark-scene/humans/town-humans";
import {interiorMaterial} from "@/ark-scene/islands/town/render/displays";

/** The mound's half-width (m) and height (m) above the mattress. */
export const COVER_HALF_WIDTH = 0.26;
export const COVER_HEIGHT = 0.32;
/** Drawn only within this distance (m): a detail of a room. */
export const COVER_DRAW = 300;
/** At most this many drawn. */
export const COVER_MAX = 400;

/** The mound's cross-section, left to right over the top (× the half-width, × the height). */
const RING: ReadonlyArray<readonly [number, number]> = [[-1, 0], [-1, 0.62], [-0.9, 0.85], [-0.55, 0.97], [0, 1], [0.55, 0.97], [0.9, 0.85], [1, 0.62], [1, 0]];
/** Along it, from the feet (t = 0) to the chest (t = 1): its width and its height (tucked in at the feet, turned back at the chest). */
const SLICES: ReadonlyArray<{t: number; w: number; h: number}> = [
    {t: 0, w: 0.9, h: 0.55},
    {t: 0.06, w: 0.98, h: 0.95},
    {t: 0.14, w: 1, h: 1},
    {t: 0.5, w: 1, h: 1},
    {t: 0.82, w: 1, h: 1},
    {t: 0.92, w: 0.98, h: 0.9},
    {t: 1, w: 0.92, h: 0.55}
];

/** The cover's height (m) above the mattress at `lateral` m from its middle and `t` (0–1) along it; 0 outside it. */
export function coverHeightAt(lateral: number, t: number): number {
    if (t < 0 || t > 1) return 0;
    let i = 0;
    while (i + 2 < SLICES.length && t > SLICES[i + 1].t) i++;
    const a = SLICES[i];
    const b = SLICES[i + 1];
    const k = (Math.min(Math.max(t, a.t), b.t) - a.t) / (b.t - a.t);
    const w = a.w + (b.w - a.w) * k;
    const h = a.h + (b.h - a.h) * k;
    const x = lateral / (COVER_HALF_WIDTH * w);
    if (Math.abs(x) > 1) return 0;
    // (The ring's height at x: between its two points either side.)
    let top = 0;
    for (let j = 0; j + 1 < RING.length; j++) {
        const [x0, y0] = RING[j];
        const [x1, y1] = RING[j + 1];
        if (x >= Math.min(x0, x1) - 1e-9 && x <= Math.max(x0, x1) + 1e-9 && x1 !== x0) top = Math.max(top, y0 + ((y1 - y0) * (x - x0)) / (x1 - x0));
    }
    return top * h * COVER_HEIGHT;
}

/** The mound's mesh: unit length along −z (feet at z = 0, chest at z = −1), flat-shaded, white vertex colours, ~110 triangles. */
export function coverGeometry(): BufferGeometry {
    const p: number[] = [];
    const point = (s: (typeof SLICES)[number], r: readonly [number, number]): [number, number, number] => [r[0] * COVER_HALF_WIDTH * s.w, r[1] * COVER_HEIGHT * s.h, -s.t];
    const tri = (a: number[], b: number[], c: number[]) => p.push(...a, ...b, ...c);
    for (let i = 0; i + 1 < SLICES.length; i++) {
        for (let j = 0; j + 1 < RING.length; j++) {
            const a = point(SLICES[i], RING[j]);
            const b = point(SLICES[i], RING[j + 1]);
            const c = point(SLICES[i + 1], RING[j]);
            const d = point(SLICES[i + 1], RING[j + 1]);
            tri(a, b, c);
            tri(b, d, c);
        }
    }
    // The ends: a fan from the bottom middle (the foot end faces +z, the chest end −z).
    for (const [slice, feet] of [[SLICES[0], true], [SLICES[SLICES.length - 1], false]] as const) {
        const centre: [number, number, number] = [0, 0, -slice.t];
        for (let j = 0; j + 1 < RING.length; j++) {
            const a = point(slice, RING[j]);
            const b = point(slice, RING[j + 1]);
            if (feet) tri(centre, b, a);
            else tri(centre, a, b);
        }
    }
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(new Float32Array(p), 3));
    g.setAttribute("color", new BufferAttribute(new Float32Array(p.length).fill(1), 3));
    g.computeVertexNormals();
    g.computeBoundingSphere();
    return g;
}

export class SleepCovers {
    readonly group = new Group();
    /** How many were drawn at the last frame. */
    drawn = 0;
    private readonly mesh: InstancedMesh;
    private readonly m = new Matrix4();
    private readonly q = new Quaternion();
    private readonly p = new Vector3();
    private readonly s = new Vector3(1, 1, 1);
    private readonly up = new Vector3(0, 1, 0);
    private readonly c = new Color();

    constructor() {
        this.group.name = "humans:covers";
        const material = interiorMaterial();
        this.mesh = new InstancedMesh(coverGeometry(), material, COVER_MAX);
        this.mesh.name = "humans:covers";
        this.mesh.count = 0;
        this.mesh.visible = false;
        this.mesh.frustumCulled = false;
        this.mesh.receiveShadow = true;
        this.mesh.userData.gtaoSkip = true;
        this.mesh.raycast = () => {};
        this.group.add(this.mesh);
    }

    /** The covers within `COVER_DRAW` of the camera. */
    setFrame(covers: readonly SleepCover[], camera: {x: number; y: number; z: number}): number {
        let n = 0;
        for (let i = 0; i < covers.length && n < COVER_MAX; i++) {
            const c = covers[i];
            if ((c.x - camera.x) ** 2 + (c.y - camera.y) ** 2 + (c.z - camera.z) ** 2 > COVER_DRAW * COVER_DRAW) continue;
            this.q.setFromAxisAngle(this.up, c.yaw);
            this.p.set(c.x, c.y, c.z);
            this.s.set(1, 1, c.length);
            this.m.compose(this.p, this.q, this.s);
            this.mesh.setMatrixAt(n, this.m);
            this.mesh.setColorAt(n, this.c.setRGB(c.colour[0], c.colour[1], c.colour[2]));
            n++;
        }
        this.mesh.count = n;
        this.mesh.visible = n > 0;
        if (n > 0) {
            this.mesh.instanceMatrix.needsUpdate = true;
            if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
        }
        this.drawn = n;
        return n;
    }

    dispose(): void {
        this.mesh.geometry.dispose();
        (this.mesh.material as {dispose(): void}).dispose();
        this.mesh.dispose();
        this.group.removeFromParent();
    }
}
