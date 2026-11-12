/**
 * The wild island's grass, chunk by chunk near the camera (Part B: grass is drawn only in chunks within reach, never
 * in the map view). Each chunk's tufts are a pure function of the ground and their 1 m cell, built when the camera
 * comes within the tier's reach and let go past it, so the island's 12 ha never hold their grass at once.
 *
 * A tuft is a clump of five blades (10 triangles), coloured by its zone (greener where wetter, golden on the savanna
 * and the steppe), dense on the meadows and the savanna, thin under the woods, none on the sand, the snow or the water.
 */

import {BufferAttribute, BufferGeometry, Color, DoubleSide, Group, InstancedMesh, Matrix4, MeshStandardMaterial, Quaternion, Vector3} from "three";
import {fbm, hashString} from "@/ark-scene/world";
import {sampleWildGround, underWater} from "@/ark-scene/islands/wild/ground";
import {gridSlope} from "@/ark-scene/islands/wild/terrain-cache";
import {WILD_CHUNK_COUNT, wildChunkDistance, wildChunkRect, type WildChunkSpan} from "@/ark-scene/islands/wild/frame";

/** Per tier: tufts a square metre at full want, and how far from the camera a chunk keeps its grass (m). */
export const WILD_GRASS: Record<"high" | "medium" | "low", {density: number; reach: number}> = {
    high: {density: 1.1, reach: 120},
    medium: {density: 0.6, reach: 85},
    low: {density: 0.28, reach: 55}
};

function tuftGeometry(): BufferGeometry {
    const positions: number[] = [];
    const colours: number[] = [];
    const base = [0.32, 0.4, 0.2];
    const tip = [0.85, 0.92, 0.55];
    for (let b = 0; b < 5; b++) {
        const a = (b / 5) * Math.PI * 2 + 0.4;
        const ox = Math.cos(a) * 0.06;
        const oz = Math.sin(a) * 0.06;
        const lean = 0.12 + 0.06 * (b % 2);
        const w = 0.035;
        const h = 0.38 + 0.12 * ((b * 7) % 3) / 2;
        const px = -Math.sin(a) * w;
        const pz = Math.cos(a) * w;
        const tx = ox + Math.cos(a) * lean;
        const tz = oz + Math.sin(a) * lean;
        positions.push(ox - px, 0, oz - pz, ox + px, 0, oz + pz, tx, h, tz);
        colours.push(...base, ...base, ...tip);
        positions.push(ox + px, 0, oz + pz, ox - px, 0, oz - pz, tx, h, tz);
        colours.push(...base, ...base, ...tip);
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
    geometry.setAttribute("color", new BufferAttribute(new Float32Array(colours), 3));
    geometry.computeVertexNormals();
    // Grass lit from above: its normals up, so a clump reads as the meadow's colour, not as dark blades.
    const n = geometry.getAttribute("normal") as BufferAttribute;
    for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0);
    return geometry;
}

const frac = (v: number) => v - Math.floor(v);

/** One chunk's tufts: (x, y, z, scale, yaw, r, g, b) each. */
function chunkTufts(key: number, density: number): Float32Array {
    const [x0, z0, x1, z1] = wildChunkRect(key);
    const out: number[] = [];
    const green = new Color("#6f9440");
    const dry = new Color("#c4a65e");
    const wet = new Color("#5d8a3c");
    const c = new Color();
    for (let z = Math.floor(z0); z < z1; z++) {
        for (let x = Math.floor(x0); x < x1; x++) {
            const h = hashString(`gr${x},${z}`);
            const r0 = (h & 0xff) / 255;
            if (r0 > density * 0.95) continue;
            const px = x + ((h >>> 8) & 0xff) / 255;
            const pz = z + ((h >>> 16) & 0xff) / 255;
            const s = sampleWildGround(px, pz);
            if (s.height < 0.4 || s.land < 0.9 || underWater(s) || s.ice > 0.1 || s.fresh > 0.02) continue;
            const w = s.weights;
            const want = w.grassland * 1 + w.woodland * 0.45 + w.rainforest * 0.3 + w.river_lake * 0.85 + w.wetland * 0.8 + w.mountains * 0.5 * (s.height < 46 ? 1 : 0) + w.seashore * 0.18 * (s.inland > 10 ? 1 : 0) + w.desert * 0.12 + w.polar * 0.3;
            const patch = 0.45 + 0.75 * fbm(px * 0.08 - 7, pz * 0.08 + 3);
            if (((h >>> 24) & 0xff) / 255 > want * patch) continue;
            if (gridSlope(px, pz) > 1) continue;
            const dryness = Math.min(1, w.desert + w.grassland * Math.max(0, 1 - s.moisture * 1.7) + w.polar * 0.5);
            c.copy(green).lerp(wet, w.wetland + w.river_lake * 0.6).lerp(dry, dryness * 0.8).multiplyScalar(0.85 + 0.3 * frac(px * 3.7 + pz * 1.3));
            const tall = w.grassland * 0.6 + w.wetland * 0.8 + 0.6;
            out.push(px, s.height - 0.02, pz, (0.7 + 0.6 * r0) * tall, frac(px * 7.13 + pz * 3.71) * Math.PI * 2, c.r, c.g, c.b);
        }
    }
    return new Float32Array(out);
}

export class WildGrass {
    readonly group = new Group();
    private readonly geometry = tuftGeometry();
    private readonly material = new MeshStandardMaterial({vertexColors: true, side: DoubleSide, roughness: 0.95, metalness: 0});
    private readonly meshes = new Map<number, InstancedMesh>();
    private tier: "high" | "medium" | "low";
    private drawn: ((chunk: number) => boolean) | null = null;
    private last = new Vector3(Infinity, 0, 0);

    constructor(tier: "high" | "medium" | "low", private readonly spans: WildChunkSpan[]) {
        this.tier = tier;
        this.group.name = "ark-wild-grass";
        this.material.customProgramCacheKey = () => "ark-wild-grass";
    }

    setTier(tier: "high" | "medium" | "low") {
        if (tier === this.tier) return;
        this.tier = tier;
        for (const key of Array.from(this.meshes.keys())) this.drop(key);
        this.last.set(Infinity, 0, 0);
    }

    setDrawn(drawn: ((chunk: number) => boolean) | null) {
        this.drawn = drawn;
        this.last.set(Infinity, 0, 0);
    }

    private drop(key: number) {
        const mesh = this.meshes.get(key);
        if (!mesh) return;
        this.group.remove(mesh);
        mesh.dispose();
        this.meshes.delete(key);
    }

    /** As the camera moves: build (at most one a call) the chunks come within reach, let go of those past it. */
    update(camera: Vector3) {
        if (camera.distanceToSquared(this.last) < 4 && this.meshes.size) return;
        const {density, reach} = WILD_GRASS[this.tier];
        let built = false;
        let pending = false;
        for (let key = 0; key < WILD_CHUNK_COUNT; key++) {
            const d = wildChunkDistance(key, camera.x, camera.y, camera.z, this.spans[key]);
            const want = d < reach && (!this.drawn || this.drawn(key));
            if (!want) {
                if (d > reach + 30 || (this.drawn && !this.drawn(key))) this.drop(key);
                continue;
            }
            if (this.meshes.has(key)) continue;
            if (built) {
                pending = true;
                continue;
            }
            const tufts = chunkTufts(key, density);
            const count = tufts.length / 8;
            const mesh = new InstancedMesh(this.geometry, this.material, Math.max(count, 1));
            const m = new Matrix4();
            const q = new Quaternion();
            const up = new Vector3(0, 1, 0);
            const c = new Color();
            for (let i = 0; i < count; i++) {
                const t = i * 8;
                m.compose(new Vector3(tufts[t], tufts[t + 1], tufts[t + 2]), q.setFromAxisAngle(up, tufts[t + 4]), new Vector3(tufts[t + 3], tufts[t + 3], tufts[t + 3]));
                mesh.setMatrixAt(i, m);
                mesh.setColorAt(i, c.setRGB(tufts[t + 5], tufts[t + 6], tufts[t + 7]));
            }
            mesh.count = count;
            mesh.receiveShadow = true;
            mesh.computeBoundingSphere();
            this.meshes.set(key, mesh);
            this.group.add(mesh);
            built = true;
        }
        // Keep coming back until every chunk in reach has its grass.
        if (!pending) this.last.copy(camera);
    }

    /** Build every chunk in reach now (stills and the visual check: nothing pops in after the shot). */
    fill(camera: Vector3) {
        for (let k = 0; k < WILD_CHUNK_COUNT; k++) {
            this.last.set(Infinity, 0, 0);
            this.update(camera);
        }
    }

    count(): number {
        let n = 0;
        this.meshes.forEach((mesh) => (n += mesh.count));
        return n;
    }

    dispose() {
        for (const key of Array.from(this.meshes.keys())) this.drop(key);
        this.geometry.dispose();
        this.material.dispose();
    }
}
