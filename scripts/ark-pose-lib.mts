/**
 * ARK-POSE: a rig file loaded as the page loads it, without a browser (the scans' and the sheets' shared part): the
 * rest mesh, the skeleton, the bone rows after `prepareRigPoses` (the skin and clip fixes, the posed lie and sit, the
 * lying gate and the neck caps), and a small software picture of any row (a z-buffer, flat shaded) to look at.
 */
import {readFileSync, writeFileSync} from "node:fs";
import {deflateSync} from "node:zlib";
import {DataUtils, Matrix4, type BufferGeometry, type SkinnedMesh} from "three";
import {GLTFLoader} from "three/examples/jsm/loaders/GLTFLoader.js";
import {MeshoptDecoder} from "three/examples/jsm/libs/meshopt_decoder.module.js";
import {Vector3, type Bone} from "three";
import {boneMajorToRows, prepareRigPoses, rawSkeletonOf, restGeometry, rigLookChain, sittingLook, type RigClipData, type RigLookChain} from "@/ark-scene/rig-player";
import {decodeRigEntry, rigClip, type RigEntry} from "@/ark-scene/rig-clips";
import {buildLocoRig} from "@/ark-scene/locomotion/skeleton";
import type {LocoRig} from "@/ark-scene/locomotion/types";

export type LoadedRig = {
    slug: string;
    entry: RigEntry;
    rig: LocoRig;
    geometry: BufferGeometry;
    positions: Float32Array;
    joints: Uint8Array;
    weights: Float32Array;
    index: ArrayLike<number>;
    bones: number;
    /** The rows as the page holds them, and the file's own (before any load-time fix). */
    data: Uint16Array;
    raw: Uint16Array;
    clips: Record<string, RigClipData>;
    /** The look chain as the file gives it (before any fit), and whether a sitting rest pose turns it off. */
    look: RigLookChain | null;
    lookOff: boolean;
    prepared: ReturnType<typeof prepareRigPoses>;
};

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);

/** One rig file (`<slug>.glb`, meshopt or not), through the page's own load steps (`RigLibrary.parse`). */
export async function loadRig(file: string, slug: string): Promise<LoadedRig> {
    const b = readFileSync(file);
    const gltf: any = await new Promise((res, rej) => loader.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), "", res, rej));
    const extras = gltf.parser.json.extras?.ark_rig;
    const entry = decodeRigEntry(extras?.rig);
    if (!extras || !entry) throw new Error("no rig entry");
    const view = (await gltf.parser.getDependency("bufferView", extras.bufferView)) as ArrayBuffer;
    const bones: number = extras.bones.length;
    let mesh: SkinnedMesh | null = null;
    gltf.scene.updateMatrixWorld(true);
    gltf.scene.traverse((o: any) => {
        if (!mesh && o.isSkinnedMesh) mesh = o;
    });
    if (!mesh) throw new Error("no skinned mesh");
    const geometry = restGeometry(mesh, extras.bones);
    const raw = extras.layout === "bone_major" ? boneMajorToRows(new Uint16Array(view.slice(0)), bones, extras.rows) : new Uint16Array(view.slice(0));
    const data = raw.slice();
    const own = {flight: false, species: {[slug]: entry}};
    const clips: Record<string, RigClipData> = {};
    for (const [name, clip] of Object.entries(entry.clips as Record<string, any>)) {
        if (!rigClip(own, slug, name)) continue;
        clips[name] = {...clip, name, row: Number(clip.row), rows: Number(clip.rows)};
    }
    for (const [missing, standIn] of Object.entries(entry.alias && typeof entry.alias === "object" ? entry.alias : {})) {
        if (!clips[missing] && clips[standIn]) clips[missing] = {...clips[standIn], name: missing};
    }
    const skinned = mesh as SkinnedMesh;
    const boneOf = (name: string) => (skinned.skeleton.bones as Bone[]).find((bone) => bone.name === name);
    const restPivot = (name: string): [number, number, number] | null => {
        const bone = boneOf(name);
        if (!bone) return null;
        const at = new Vector3().setFromMatrixPosition(bone.matrixWorld);
        return [at.x, at.y, at.z];
    };
    const parentOf = (name: string): string | null => {
        const up = boneOf(name)?.parent as Bone | null | undefined;
        return up && up.isBone ? up.name : null;
    };
    const box = geometry.boundingBox!;
    const sitting = sittingLook(rigLookChain(entry, slug, extras.bones, restPivot, parentOf), entry.pose ?? null, box.min.y, box.max.y);
    const rig = buildLocoRig(rawSkeletonOf(mesh, extras.bones, geometry, slug, entry));
    const prepared = prepareRigPoses(rig, slug, entry.plan ?? null, geometry, data, bones, clips, sitting.look);
    return {
        slug,
        entry,
        rig,
        geometry,
        positions: geometry.getAttribute("position").array as Float32Array,
        joints: geometry.getAttribute("arkJoints").array as Uint8Array,
        weights: geometry.getAttribute("arkWeights").array as Float32Array,
        index: geometry.getIndex()!.array,
        bones,
        data: prepared.data,
        raw,
        clips,
        look: sitting.look,
        lookOff: sitting.off,
        prepared
    };
}

/** One row of bone rows as floats (3×4 per bone). */
export function rowOf(data: Uint16Array, bones: number, row: number): Float32Array {
    const per = bones * 12;
    const out = new Float32Array(per);
    for (let i = 0; i < per; i++) out[i] = DataUtils.fromHalfFloat(data[row * per + i]);
    return out;
}

/** The rest mesh skinned by a row (3×4 per bone). */
export function skinnedBy(r: Pick<LoadedRig, "positions" | "joints" | "weights">, m: ArrayLike<number>): Float32Array {
    const P = r.positions;
    const n = P.length / 3;
    const out = new Float32Array(n * 3);
    for (let v = 0; v < n; v++) {
        const x = P[v * 3], y = P[v * 3 + 1], z = P[v * 3 + 2];
        let ox = 0, oy = 0, oz = 0, any = 0;
        for (let k = 0; k < 4; k++) {
            const w = r.weights[v * 4 + k];
            if (w <= 0) continue;
            const b = r.joints[v * 4 + k] * 12;
            ox += w * (m[b] * x + m[b + 1] * y + m[b + 2] * z + m[b + 3]);
            oy += w * (m[b + 4] * x + m[b + 5] * y + m[b + 6] * z + m[b + 7]);
            oz += w * (m[b + 8] * x + m[b + 9] * y + m[b + 10] * z + m[b + 11]);
            any += w;
        }
        if (any < 0.5) {
            ox = x;
            oy = y;
            oz = z;
        }
        out[v * 3] = ox;
        out[v * 3 + 1] = oy;
        out[v * 3 + 2] = oz;
    }
    return out;
}

/** Bone world matrices (mesh space) as a row. */
export function worldRow(rig: LocoRig, world: Matrix4[]): Float32Array {
    const out = new Float32Array(rig.bones.length * 12);
    const inv = new Matrix4();
    const m = new Matrix4();
    rig.bones.forEach((bone, b) => {
        const e = m.multiplyMatrices(world[b], inv.copy(bone.restWorld).invert()).elements;
        out.set([e[0], e[4], e[8], e[12], e[1], e[5], e[9], e[13], e[2], e[6], e[10], e[14]], b * 12);
    });
    return out;
}

export type Picture = {width: number; height: number; rgb: Uint8Array};

/**
 * A flat-shaded picture of a posed mesh: orthographic, from `azimuth` (degrees about up; 90 is its left side, 0 its
 * front) and `elevation` above level. The ground (y = `ground`) is a line at the feet and a tinted floor; anything
 * under it is drawn red. `fit` is the half extent shown (model units), `centre` what the picture looks at.
 */
export function draw(points: Float32Array, index: ArrayLike<number>, o: {azimuth: number; elevation: number; ground: number; fit: number; centre: [number, number, number]; size?: number; tint?: (triangle: number) => [number, number, number] | null}): Picture {
    const size = o.size ?? 420;
    const rgb = new Uint8Array(size * size * 3).fill(246);
    const depth = new Float32Array(size * size).fill(-Infinity);
    const az = (o.azimuth * Math.PI) / 180;
    const el = (o.elevation * Math.PI) / 180;
    // The camera's axes: `f` from the subject toward the eye, `r` to the picture's right, `u` up.
    const f = [Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)];
    const r = [Math.cos(az), 0, -Math.sin(az)];
    const u = [f[1] * r[2] - f[2] * r[1], f[2] * r[0] - f[0] * r[2], f[0] * r[1] - f[1] * r[0]];
    const s = size / (2 * o.fit);
    const project = (x: number, y: number, z: number) => {
        const dx = x - o.centre[0], dy = y - o.centre[1], dz = z - o.centre[2];
        return [size / 2 + (dx * r[0] + dy * r[1] + dz * r[2]) * s, size / 2 - (dx * u[0] + dy * u[1] + dz * u[2]) * s, dx * f[0] + dy * f[1] + dz * f[2]];
    };
    // The floor: a disc of ground under it, drawn first.
    for (let py = 0; py < size; py++) {
        for (let px = 0; px < size; px++) {
            // The ray through this pixel meets y = ground where: (centre + a r + b u + t f).y = ground.
            const a = (px - size / 2) / s, bb = (size / 2 - py) / s;
            if (Math.abs(f[1]) < 1e-3) {
                if (o.centre[1] + bb * u[1] < o.ground) rgb.set([222, 214, 196], (py * size + px) * 3);
                continue;
            }
            const t = (o.ground - o.centre[1] - a * r[1] - bb * u[1]) / f[1];
            if (t < 0 || el > 0) {
                const gx = a * r[0] + bb * u[0] + t * f[0], gz = a * r[2] + bb * u[2] + t * f[2];
                if (Math.hypot(gx, gz) < o.fit * 0.95) {
                    rgb.set([222, 214, 196], (py * size + px) * 3);
                    depth[py * size + px] = t - 1e-4;
                }
            }
        }
    }
    const light = [0.35, 0.8, 0.5];
    const ll = Math.hypot(...light);
    for (let t = 0; t + 2 < index.length; t += 3) {
        const ia = index[t] * 3, ib = index[t + 1] * 3, ic = index[t + 2] * 3;
        const A = project(points[ia], points[ia + 1], points[ia + 2]);
        const B = project(points[ib], points[ib + 1], points[ib + 2]);
        const C = project(points[ic], points[ic + 1], points[ic + 2]);
        const ex = points[ib] - points[ia], ey = points[ib + 1] - points[ia + 1], ez = points[ib + 2] - points[ia + 2];
        const fx = points[ic] - points[ia], fy = points[ic + 1] - points[ia + 1], fz = points[ic + 2] - points[ia + 2];
        let nx = ey * fz - ez * fy, ny = ez * fx - ex * fz, nz = ex * fy - ey * fx;
        const nl = Math.hypot(nx, ny, nz) || 1;
        nx /= nl; ny /= nl; nz /= nl;
        if (nx * f[0] + ny * f[1] + nz * f[2] < 0) { nx = -nx; ny = -ny; nz = -nz; }
        const shade = 0.35 + 0.65 * Math.max((nx * light[0] + ny * light[1] + nz * light[2]) / ll, 0);
        const base = o.tint?.(t / 3) ?? [176, 148, 108];
        const minX = Math.max(Math.floor(Math.min(A[0], B[0], C[0])), 0), maxX = Math.min(Math.ceil(Math.max(A[0], B[0], C[0])), size - 1);
        const minY = Math.max(Math.floor(Math.min(A[1], B[1], C[1])), 0), maxY = Math.min(Math.ceil(Math.max(A[1], B[1], C[1])), size - 1);
        const area = (B[0] - A[0]) * (C[1] - A[1]) - (B[1] - A[1]) * (C[0] - A[0]);
        if (Math.abs(area) < 1e-9) continue;
        for (let py = minY; py <= maxY; py++) {
            for (let px = minX; px <= maxX; px++) {
                const w0 = ((B[0] - px) * (C[1] - py) - (B[1] - py) * (C[0] - px)) / area;
                const w1 = ((C[0] - px) * (A[1] - py) - (C[1] - py) * (A[0] - px)) / area;
                const w2 = 1 - w0 - w1;
                if (w0 < -1e-4 || w1 < -1e-4 || w2 < -1e-4) continue;
                const d = w0 * A[2] + w1 * B[2] + w2 * C[2];
                const at = py * size + px;
                if (d <= depth[at]) continue;
                depth[at] = d;
                const y = w0 * points[ia + 1] + w1 * points[ib + 1] + w2 * points[ic + 1];
                const under = y < o.ground - o.fit * 0.01;
                rgb[at * 3] = under ? 200 * shade : base[0] * shade;
                rgb[at * 3 + 1] = under ? 60 * shade : base[1] * shade;
                rgb[at * 3 + 2] = under ? 60 * shade : base[2] * shade;
            }
        }
    }
    return {width: size, height: size, rgb};
}

/** Pictures side by side in rows of `columns`. */
export function sheet(pictures: Picture[], columns: number): Picture {
    const w = pictures[0].width, h = pictures[0].height;
    const rows = Math.ceil(pictures.length / columns);
    const rgb = new Uint8Array(w * columns * h * rows * 3).fill(255);
    pictures.forEach((p, i) => {
        const cx = (i % columns) * w, cy = Math.floor(i / columns) * h;
        for (let y = 0; y < h; y++) rgb.set(p.rgb.subarray(y * w * 3, (y + 1) * w * 3), ((cy + y) * w * columns + cx) * 3);
    });
    return {width: w * columns, height: h * rows, rgb};
}

const CRC = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        t[n] = c >>> 0;
    }
    return t;
})();
function crc(buf: Uint8Array): number {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
}

export function writePng(file: string, p: Picture): void {
    const raw = Buffer.alloc((p.width * 3 + 1) * p.height);
    for (let y = 0; y < p.height; y++) Buffer.from(p.rgb.buffer, p.rgb.byteOffset + y * p.width * 3, p.width * 3).copy(raw, y * (p.width * 3 + 1) + 1);
    const chunk = (type: string, body: Buffer) => {
        const head = Buffer.alloc(8);
        head.writeUInt32BE(body.length, 0);
        head.write(type, 4, "ascii");
        const tail = Buffer.alloc(4);
        tail.writeUInt32BE(crc(Buffer.concat([head.subarray(4), body])), 0);
        return Buffer.concat([head, body, tail]);
    };
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(p.width, 0);
    ihdr.writeUInt32BE(p.height, 4);
    ihdr.set([8, 2, 0, 0, 0], 8);
    writeFileSync(file, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]));
}

/** A posed mesh from a few sides (its left, three-quarter front, front, three-quarter back, above), fitted to the rest mesh. */
export function views(r: LoadedRig, points: Float32Array, angles: Array<[number, number]> = [[90, 4], [45, 14], [0, 6], [135, 14], [90, 60]], size = 360): Picture[] {
    const box = r.geometry.boundingBox!;
    const fit = Math.max(box.max.x - box.min.x, box.max.y - box.min.y, box.max.z - box.min.z) * 0.62;
    const centre: [number, number, number] = [(box.min.x + box.max.x) / 2, box.min.y + (box.max.y - box.min.y) * 0.4, (box.min.z + box.max.z) / 2];
    return angles.map(([azimuth, elevation]) => draw(points, r.index, {azimuth, elevation, ground: box.min.y, fit, centre, size}));
}
