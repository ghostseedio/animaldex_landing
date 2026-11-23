/**
 * SIG4 (town solid proxies): the town's solid scenery as the seat pass can read it, never drawn.
 *
 * The town's meshes let their vertex arrays go once on the GPU (phone heap, 62e24d4c: the zoo's solids and foliage, the
 * town's chunks, the library's trees and logs, the zoo halls' insides, the garden rooms). The seat pass (`seat/solids.ts`
 * DrawnSolids) reads what is drawn by its triangles, so it found nothing there: animals stood, walked and slept inside
 * the zoo's sheds, perches and rockwork, the logs, the garden rooms.
 *
 * The same scenery is already in memory as shapes, the town's colliders (`colliders.ts`, from `solids.ts` townSolids:
 * circles, boxes and segments, each with a foot and a top; the prebuild worker's, so nothing is worked out again on the
 * page). Here each becomes a closed prism (a log a lying cylinder, a mound a cone's frustum), gathered into one small
 * indexed geometry per town chunk. The meshes sit on a layer the camera never draws
 * and their material is not visible, so they cost no draw call and no shader; the seat pass walks the scene by object
 * visibility and labels, so it reads them as built (HARD) solids. The seat audit's probe passes over them
 * (`userData.solidProxy`): it measures against what is drawn.
 *
 * Which solids: `proxied` below. The zoo's own solid batch keeps its positions instead (`render/index.ts`), so the
 * pass reads its rockwork, sheds, perches, banks and ground cover exactly as drawn.
 */

import {BufferAttribute, BufferGeometry, Group, Mesh, MeshBasicMaterial} from "three";
import {townChunkOf} from "@/ark-scene/islands/town/chunks";
import {townHeight} from "@/ark-scene/islands/town/ground";
import type {Collider} from "@/ark-scene/collide/colliders";
import {ZOO_HOUSE_TYPES} from "@/ark-scene/islands/town/tanks";

/** The layer the proxies are on: never the camera's (it draws layer 0; 30 and 31 are the streamer's and the held rigs'). */
export const SOLID_PROXY_LAYER = 29;

/** One material for every proxy, never drawn (not visible: three passes over it before any program is made). */
const HIDDEN = new MeshBasicMaterial({visible: false});

type Builder = {pos: number[]; idx: number[]};

/** A ring of corners round (x, z) (radius `r`), counter-clockwise seen from above. */
function ring(x: number, z: number, r: number, n: number): number[] {
    const out: number[] = [];
    for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        out.push(x + Math.cos(a) * r, z - Math.sin(a) * r);
    }
    return out;
}

/** A closed prism (or frustum: `top` its own ring) between two heights, each face wound outward. */
function prism(b: Builder, bottom: number[], top: number[], y0: number, y1: number): void {
    const n = bottom.length / 2;
    const v = b.pos.length / 3;
    for (let i = 0; i < n; i++) b.pos.push(bottom[i * 2], y0, bottom[i * 2 + 1]);
    for (let i = 0; i < n; i++) b.pos.push(top[i * 2], y1, top[i * 2 + 1]);
    let cx = 0;
    let cz = 0;
    for (let i = 0; i < n; i++) {
        cx += bottom[i * 2] / n;
        cz += bottom[i * 2 + 1] / n;
    }
    // (Each triangle checked against the way it should face, and turned if not: the ring's own winding never matters.)
    const tri = (a: number, c: number, d: number, ox: number, oy: number, oz: number) => {
        const p = b.pos;
        const ux = p[c * 3] - p[a * 3];
        const uy = p[c * 3 + 1] - p[a * 3 + 1];
        const uz = p[c * 3 + 2] - p[a * 3 + 2];
        const wx = p[d * 3] - p[a * 3];
        const wy = p[d * 3 + 1] - p[a * 3 + 1];
        const wz = p[d * 3 + 2] - p[a * 3 + 2];
        const nx = uy * wz - uz * wy;
        const ny = uz * wx - ux * wz;
        const nz = ux * wy - uy * wx;
        if (nx * ox + ny * oy + nz * oz >= 0) b.idx.push(a, c, d);
        else b.idx.push(a, d, c);
    };
    for (let i = 1; i + 1 < n; i++) {
        tri(v, v + i, v + i + 1, 0, -1, 0);
        tri(v + n, v + n + i, v + n + i + 1, 0, 1, 0);
    }
    for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        const ox = (bottom[i * 2] + bottom[j * 2]) / 2 - cx;
        const oz = (bottom[i * 2 + 1] + bottom[j * 2 + 1]) / 2 - cz;
        tri(v + i, v + j, v + n + j, ox, 0, oz);
        tri(v + i, v + n + j, v + n + i, ox, 0, oz);
    }
}

/** A lying cylinder from a to b (its axis at heights ya and yb), radius r, its two ends closed. */
function cylinder(b: Builder, ax: number, ay: number, az: number, bx: number, by: number, bz: number, r: number): void {
    const dx = bx - ax;
    const dy = by - ay;
    const dz = bz - az;
    const l = Math.hypot(dx, dy, dz) || 1;
    // Two directions across the axis: one level (sideways), one up its side.
    let sx = -dz;
    let sz = dx;
    const sl = Math.hypot(sx, sz) || 1;
    sx /= sl;
    sz /= sl;
    // up = axis × side (unit, since both are unit and at right angles).
    const tx = dx / l;
    const ty = dy / l;
    const tz = dz / l;
    const upx = ty * sz - tz * 0;
    const upy = tz * sx - tx * sz;
    const upz = tx * 0 - ty * sx;
    const n = 8;
    const v = b.pos.length / 3;
    for (const [px, py, pz] of [[ax, ay, az], [bx, by, bz]])
        for (let i = 0; i < n; i++) {
            const a = (i / n) * Math.PI * 2;
            const c = Math.cos(a) * r;
            const s = Math.sin(a) * r;
            b.pos.push(px + sx * c + upx * s, py + upy * s, pz + sz * c + upz * s);
        }
    const mx = (ax + bx) / 2;
    const my = (ay + by) / 2;
    const mz = (az + bz) / 2;
    const tri = (a: number, c: number, d: number) => {
        const p = b.pos;
        const ux2 = p[c * 3] - p[a * 3];
        const uy2 = p[c * 3 + 1] - p[a * 3 + 1];
        const uz2 = p[c * 3 + 2] - p[a * 3 + 2];
        const wx = p[d * 3] - p[a * 3];
        const wy = p[d * 3 + 1] - p[a * 3 + 1];
        const wz = p[d * 3 + 2] - p[a * 3 + 2];
        const nx = uy2 * wz - uz2 * wy;
        const ny = uz2 * wx - ux2 * wz;
        const nz = ux2 * wy - uy2 * wx;
        // (Outward: away from the middle of the axis.)
        const ox = (p[a * 3] + p[c * 3] + p[d * 3]) / 3 - mx;
        const oy = (p[a * 3 + 1] + p[c * 3 + 1] + p[d * 3 + 1]) / 3 - my;
        const oz = (p[a * 3 + 2] + p[c * 3 + 2] + p[d * 3 + 2]) / 3 - mz;
        if (nx * ox + ny * oy + nz * oz >= 0) b.idx.push(a, c, d);
        else b.idx.push(a, d, c);
    };
    for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        tri(v + i, v + j, v + n + j);
        tri(v + i, v + n + j, v + n + i);
    }
    for (let i = 1; i + 1 < n; i++) {
        tri(v, v + i, v + i + 1);
        tri(v + n, v + n + i, v + n + i + 1);
    }
}

/**
 * The town solids among the town's colliders (`colliders.ts` solidCollider: `town:` and the solid's own id, `solids.ts`)
 * whose drawn meshes let their arrays go: the deadwood and the flower beds (the town's chunks), the garden rooms
 * (`pet-homes.ts`), the zoo halls' furnishings (`zoo-houses.ts` inside), and in the open enclosures the library's logs
 * and climbing trees (`render/assets.ts`). The rest of an open enclosure is the zoo's solid batch, whose positions are
 * kept (`render/index.ts`): the seat pass reads it as drawn, and a prism over it would only be coarser. Never a rock
 * (drawn as instances the pass reads), a pond (water), or one a small body goes into (`gap`).
 */
const SOLID_IDS = ["town:deadwood:", "town:bed:", "town:garden-room:"];
const HALL = new RegExp(`^town:zoo:(${Array.from(ZOO_HOUSE_TYPES).join("|")})-`);
export function proxied(c: Collider): boolean {
    if (c.gap > 0 || c.kind === "pond" || !(c.y1 > c.y0 + 0.02)) return false;
    if (c.kind === "rock" && !isMound(c)) return false;
    if (SOLID_IDS.some((p) => c.id.startsWith(p))) return true;
    if (!c.id.startsWith("town:zoo:")) return false;
    // (A hall's: all of it. An open enclosure's: its library logs and climbing trees.)
    return HALL.test(c.id) || c.id.includes("/log-") || c.id.includes("/trunk-");
}

const isMound = (c: Collider) => c.id.includes("/mound-");

/** One collider's prism onto a chunk's builder, in the town's frame (the colliders are in the world's: less `ox`, `oz`). */
export function addProxy(b: Builder, c: Collider, ox: number, oz: number): void {
    switch (c.shape) {
        case "circle": {
            const n = c.r > 1 ? 10 : 8;
            const bottom = ring(c.cx - ox, c.cz - oz, c.r, n);
            // (A termite mound: a broad foot rising into narrow chimneys, a cone's frustum, not a drum.)
            const top = isMound(c) ? ring(c.cx - ox, c.cz - oz, c.r * 0.4, n) : bottom;
            prism(b, bottom, top, c.y0, c.y1);
            return;
        }
        case "box": {
            // (The collider's frame, `collide/colliders.ts` colliderDistance, turned back: its local (lx, lz) to the town's.)
            const corner = (lx: number, lz: number) => [c.cx - ox + lx * c.cos + lz * c.sin, c.cz - oz - lx * c.sin + lz * c.cos];
            const bottom = [...corner(c.hx0, c.hz0), ...corner(c.hx1, c.hz0), ...corner(c.hx1, c.hz1), ...corner(c.hx0, c.hz1)];
            prism(b, bottom, bottom, c.y0, c.y1);
            return;
        }
        case "segment": {
            // A log: its axis a radius under its top, each end on the ground there (`zoo-habitat.ts` log, 0.85 of its radius
            // up), held between its foot and its top.
            const lo = c.y0 + c.r;
            const hi = c.y1 - c.r;
            const end = (x: number, z: number) => Math.min(Math.max(townHeight(x, z) + c.r * 0.85, Math.min(lo, hi)), hi);
            cylinder(b, c.ax - ox, end(c.ax - ox, c.az - oz), c.az - oz, c.bx - ox, end(c.bx - ox, c.bz - oz), c.bz - oz, c.r);
            return;
        }
    }
}

/** The proxies for these solids: one mesh a town chunk, on `SOLID_PROXY_LAYER`, under one group. */
export function buildSolidProxies(colliders: readonly Collider[], origin: {x: number; z: number}): {group: Group; triangles: number; solids: number; dispose: () => void} {
    const group = new Group();
    group.name = "town:solid-proxies";
    const byChunk = new Map<number, Builder>();
    let count = 0;
    for (const c of colliders) {
        if (!proxied(c)) continue;
        const key = townChunkOf(c.cx - origin.x, c.cz - origin.z);
        let b = byChunk.get(key);
        if (!b) byChunk.set(key, (b = {pos: [], idx: []}));
        addProxy(b, c, origin.x, origin.z);
        count++;
    }
    let triangles = 0;
    byChunk.forEach((b, key) => {
        const geometry = new BufferGeometry();
        geometry.setAttribute("position", new BufferAttribute(new Float32Array(b.pos), 3));
        const vertices = b.pos.length / 3;
        geometry.setIndex(new BufferAttribute(vertices > 65535 ? new Uint32Array(b.idx) : new Uint16Array(b.idx), 1));
        geometry.computeBoundingBox();
        geometry.computeBoundingSphere();
        triangles += b.idx.length / 3;
        const mesh = new Mesh(geometry, HIDDEN);
        mesh.name = `town:solid-proxy:${key}`;
        mesh.userData.solidProxy = true;
        mesh.layers.set(SOLID_PROXY_LAYER);
        mesh.castShadow = false;
        mesh.receiveShadow = false;
        group.add(mesh);
    });
    return {
        group,
        triangles,
        solids: count,
        dispose: () => {
            for (const child of group.children) (child as Mesh).geometry.dispose();
            group.clear();
        }
    };
}
