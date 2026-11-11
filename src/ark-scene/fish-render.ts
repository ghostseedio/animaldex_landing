/**
 * The ambient fish schools drawn (graphics pass, batch 4; the schools
 * themselves are `fish-schools.ts`). Decoration: not catalogue animals, not
 * pick targets, nothing counts them.
 *
 * Instanced per look with two versions: near the camera a real little fish
 * (a body of rings, forked or round tail, dorsal and anal fins, countershaded,
 * stripes or bars, an eye), its tail beating in the vertex shader; further
 * out a few crossed triangles in its mid tone. Past the far reach, nothing:
 * the schools out of sight cost nothing. Each frame every drawn fish is
 * placed by `fishPosition` (the shared clock, so every viewer sees the same
 * fish) and pointed along its own motion.
 */

import {
    BufferAttribute,
    BufferGeometry,
    Color,
    Euler,
    InstancedBufferAttribute,
    InstancedMesh,
    Matrix4,
    MeshStandardMaterial,
    Quaternion,
    Vector3
} from "three";
import {mergeGeometries} from "three/examples/jsm/utils/BufferGeometryUtils.js";
import {ARK_ENV} from "@/ark-scene/glsl";
import {FISH_KINDS, FISH_LOOKS, fishSchoolAt, fishSchools, placeFish, schoolFrame, schoolTime, seaEpochSeconds, surgeDirection, type FishKind, type FishLook, type SchoolFrame, type Vec3} from "@/ark-scene/fish-schools";

// MARK: - Shapes (unit length along +z, head forward; the instance scales it to the look's length)

function painted(points: number[], colourAt: (x: number, y: number, z: number) => Color, tailAt: (z: number) => number): BufferGeometry {
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(new Float32Array(points), 3));
    g.computeVertexNormals();
    const count = points.length / 3;
    const colours = new Float32Array(count * 3);
    const tail = new Float32Array(count);
    for (let i = 0; i < count; i++) {
        const c = colourAt(points[i * 3], points[i * 3 + 1], points[i * 3 + 2]);
        colours[i * 3] = c.r;
        colours[i * 3 + 1] = c.g;
        colours[i * 3 + 2] = c.b;
        tail[i] = tailAt(points[i * 3 + 2]);
    }
    g.setAttribute("color", new BufferAttribute(colours, 3));
    g.setAttribute("arkTail", new BufferAttribute(tail, 1));
    return g;
}

/** 0 at the head, 1 at the tail's tip: how much of the beat a point takes. */
const tailWeight = (z: number) => Math.min(Math.max((0.22 - z) / 0.72, 0), 1);

/** Both faces of a flat fin (the fish material is front-sided). */
function twoSided(points: number[]): number[] {
    const out = [...points];
    for (let i = 0; i < points.length; i += 9) out.push(points[i], points[i + 1], points[i + 2], points[i + 6], points[i + 7], points[i + 8], points[i + 3], points[i + 4], points[i + 5]);
    return out;
}

function fishGeometry(look: FishLook, near: boolean): BufferGeometry {
    const back = new Color(look.back);
    const belly = new Color(look.belly);
    const fin = new Color(look.fin);
    const stripe = look.stripe ? new Color(look.stripe) : null;
    const bars = look.bars ? {count: look.bars.count, colour: new Color(look.bars.colour)} : null;
    const eye = new Color("#141414");
    const H = look.height;
    const Wd = look.width;
    const shape = (u: number) => (0.18 + 0.82 * Math.sin(Math.PI * Math.pow(Math.min(Math.max(u, 0), 1), 0.8))) * (1 - Math.pow(u, 6) * 0.7);
    const zOf = (u: number) => -0.27 + u * 0.77;
    const bodyColour = (x: number, y: number, z: number) => {
        const u = (z + 0.27) / 0.77;
        const half = Math.max((H / 2) * shape(u), 1e-3);
        const t = Math.min(Math.max((y / half + 0.35) / 0.95, 0), 1);
        const c = belly.clone().lerp(back, t * t * (3 - 2 * t));
        if (stripe && Math.abs(y / half - 0.08) < 0.2 && u > 0.05 && u < 0.85) c.lerp(stripe, 0.85);
        if (bars && u > 0.08 && u < 0.85 && ((u * bars.count) % 1) < 0.38) c.lerp(bars.colour, 0.75);
        // The eye: a dark spot on each side, high on the head.
        if (u > 0.82 && u < 0.92 && y > 0 && y < half * 0.7 && Math.abs(x) > Wd * 0.12) c.copy(eye);
        return c;
    };
    if (!near) {
        // Far: a diamond seen from the side, another from above, a tail: ten triangles.
        const h = H / 2;
        const w = Wd / 2;
        const side = [0, 0, 0.5, 0, h, 0.05, 0, 0, -0.27, 0, 0, 0.5, 0, 0, -0.27, 0, -h * 0.8, 0.05];
        const top = [0, 0, 0.5, w, 0, 0.05, 0, 0, -0.27, 0, 0, 0.5, 0, 0, -0.27, -w, 0, 0.05];
        const tailFin = [0, 0, -0.22, 0, h * 0.8, -0.5, 0, -h * 0.8, -0.5];
        const mid = back.clone().lerp(belly, 0.45);
        return painted([...twoSided(side), ...twoSided(top), ...twoSided(tailFin)], (_x, y) => (y > 0.01 ? back.clone().lerp(mid, 0.4) : y < -0.01 ? belly.clone().lerp(mid, 0.5) : mid), tailWeight);
    }
    const parts: BufferGeometry[] = [];
    // The body: rings of an ellipse, peduncle to snout.
    const rings = 9;
    const sides = 8;
    const body: number[] = [];
    const at = (u: number, k: number): [number, number, number] => {
        const a = (k / sides) * Math.PI * 2;
        const s = shape(u);
        return [Math.cos(a) * (Wd / 2) * s, Math.sin(a) * (H / 2) * s, zOf(u)];
    };
    for (let r = 0; r < rings; r++) {
        const u0 = r / rings;
        const u1 = (r + 1) / rings;
        for (let k = 0; k < sides; k++) {
            const a = at(u0, k);
            const b = at(u0, k + 1);
            const c = at(u1, k + 1);
            const d = at(u1, k);
            body.push(...a, ...b, ...c, ...a, ...c, ...d);
        }
    }
    // The snout's tip and the peduncle's end closed.
    const snout: [number, number, number] = [0, H * 0.01, 0.51];
    for (let k = 0; k < sides; k++) body.push(...at(1, k), ...at(1, k + 1), ...snout);
    parts.push(painted(body, bodyColour, tailWeight));
    // The tail fin: forked or round, in the body's plane.
    const root = (H / 2) * shape(0) * 0.9;
    const tip = H * 0.46;
    const notch = look.forked ? -0.4 : -0.5;
    const tailFin = [
        0, root, -0.25, 0, tip, -0.5, 0, 0, notch,
        0, root, -0.25, 0, 0, notch, 0, -root, -0.25,
        0, -root, -0.25, 0, 0, notch, 0, -tip, -0.5
    ];
    parts.push(painted(twoSided(tailFin), () => fin, tailWeight));
    // The dorsal fin along the back, and the anal fin under the tail (big on the deep-bodied ones).
    const top = (H / 2) * shape(0.45);
    const deep = H > 0.5 ? 1.8 : 1;
    const dorsal = [0, top * 0.92, 0.2, 0, top + H * 0.16 * deep, 0.02, 0, top * 0.75, -0.16];
    const anal = [0, -top * 0.7, -0.02, 0, -top * 0.7 - H * 0.1 * deep, -0.1, 0, -top * 0.55, -0.2];
    parts.push(painted(twoSided([...dorsal, ...anal]), () => fin, tailWeight));
    const merged = mergeGeometries(parts);
    if (!merged) throw new Error("fish shape did not merge");
    return merged;
}

function fishMaterial(look: FishLook): MeshStandardMaterial {
    const material = new MeshStandardMaterial({vertexColors: true, roughness: 0.32 + 0.35 * (1 - look.metal), metalness: look.metal * 0.7});
    const uniforms = {envSeaLevel: ARK_ENV.seaLevel};
    material.customProgramCacheKey = () => "ark-fish-1";
    material.onBeforeCompile = (shader) => {
        Object.assign(shader.uniforms, uniforms);
        shader.vertexShader = shader.vertexShader
            .replace("#include <common>", `#include <common>
attribute float arkTail;
attribute vec2 arkFish;
varying vec3 vFishWorld;`)
            .replace("#include <begin_vertex>", `#include <begin_vertex>
// The beat: a wave down the body to the tail, bigger toward the tail (arkFish: phase, strength).
transformed.x += sin(arkFish.x - arkTail * 4.2) * 0.1 * arkTail * arkTail * arkFish.y;`)
            .replace("#include <worldpos_vertex>", `#include <worldpos_vertex>
vFishWorld = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;`);
        shader.fragmentShader = shader.fragmentShader
            .replace("#include <common>", `#include <common>
varying vec3 vFishWorld;
uniform float envSeaLevel;`)
            .replace("#include <color_fragment>", `#include <color_fragment>
{
    // The light reaching it under water: absorbed with depth, red first (as on the reef and the sea floor).
    float depthBelow = max(envSeaLevel - vFishWorld.y, 0.0);
    diffuseColor.rgb *= exp(-depthBelow * vec3(0.2, 0.065, 0.05)) * mix(1.0, 0.9, smoothstep(0.0, 2.0, depthBelow));
}`);
    };
    return material;
}

// MARK: - The view

type KindMeshes = {near: InstancedMesh; far: InstancedMesh; nearTriangles: number; farTriangles: number; nearCount: number; farCount: number};

export class FishView {
    readonly meshes: InstancedMesh[] = [];
    private readonly kinds = new Map<FishKind, KindMeshes>();
    private share = 1;
    private reach = 1;
    private triangleCount = 0;
    private readonly materials: MeshStandardMaterial[] = [];
    private readonly p: Vec3 = {x: 0, y: 0, z: 0};
    private readonly matrix = new Matrix4();
    private readonly rotation = new Quaternion();
    private readonly euler = new Euler(0, 0, 0, "YXZ");
    private readonly at = new Vector3();
    private readonly scale = new Vector3();
    private frame: SchoolFrame | undefined = undefined;
    private readonly velocity: Vec3 = {x: 0, y: 0, z: 0};

    constructor() {
        const capacity = new Map<FishKind, number>();
        for (const school of fishSchools()) capacity.set(school.kind, (capacity.get(school.kind) ?? 0) + school.count);
        for (const kind of FISH_KINDS) {
            const total = capacity.get(kind) ?? 0;
            if (!total) continue;
            const look = FISH_LOOKS[kind];
            const material = fishMaterial(look);
            this.materials.push(material);
            const make = (near: boolean) => {
                const geometry = fishGeometry(look, near);
                geometry.setAttribute("arkFish", new InstancedBufferAttribute(new Float32Array(total * 2), 2));
                const mesh = new InstancedMesh(geometry, material, total);
                mesh.count = 0;
                mesh.visible = false;
                // The fish move every frame: no stale bounds.
                mesh.frustumCulled = false;
                mesh.castShadow = false;
                mesh.receiveShadow = false;
                mesh.userData.kind = `fish-${kind}-${near ? "near" : "far"}`;
                mesh.raycast = () => {};
                this.meshes.push(mesh);
                return mesh;
            };
            const near = make(true);
            const far = make(false);
            this.kinds.set(kind, {near, far, nearTriangles: near.geometry.getAttribute("position").count / 3, farTriangles: far.geometry.getAttribute("position").count / 3, nearCount: 0, farCount: 0});
        }
    }

    /** The tier: the share of each school drawn and how far the versions reach (1 high, about 0.6 medium, 0.35 low). */
    setTier(share: number, reach: number) {
        this.share = Math.min(Math.max(share, 0.2), 1);
        this.reach = Math.min(Math.max(reach, 0.4), 1);
    }

    get triangles(): number {
        return this.triangleCount;
    }

    update(camera: Vector3) {
        const epoch = seaEpochSeconds();
        const seaLevel = ARK_ENV.seaLevel.value;
        const under = camera.y < seaLevel;
        this.kinds.forEach((entry) => {
            entry.nearCount = 0;
            entry.farCount = 0;
        });
        for (const school of fishSchools()) {
            if (Math.hypot(school.home.x - camera.x, school.home.z - camera.z) > school.range + 80) continue;
            const now = fishSchoolAt(school, epoch);
            const distance = Math.max(Math.hypot(now.centre.x - camera.x, now.centre.y - camera.y, now.centre.z - camera.z) - now.radius, 0);
            // Small fish: from above the water they show only fairly close; under it the water's haze closes in.
            const nearReach = 15 * this.reach;
            const farReach = (under ? 38 : 34) * this.reach * (school.kind === "silver_jack" ? 1.4 : 1);
            if (distance > farReach) continue;
            const entry = this.kinds.get(school.kind);
            if (!entry) continue;
            const near = distance < nearReach;
            const mesh = near ? entry.near : entry.far;
            const look = FISH_LOOKS[school.kind];
            const t = schoolTime(school, epoch);
            const frame = (this.frame = schoolFrame(school, t, this.frame));
            const slots = frame.slots;
            const matrices = mesh.instanceMatrix.array as Float32Array;
            const beats = (mesh.geometry.getAttribute("arkFish") as InstancedBufferAttribute).array as Float32Array;
            const surge = school.style === "hover" ? surgeDirection(now.centre) : null;
            for (let i = 0; i < slots.length; i++) {
                // A low-discrepancy share of the school (golden-ratio steps): thinned evenly, not from one side.
                if (this.share < 1 && ((i * 0.618034) % 1) > this.share) continue;
                const slot = slots[i];
                const p = placeFish(frame, i, this.p, this.velocity);
                let vx = this.velocity.x;
                const vy = this.velocity.y;
                let vz = this.velocity.z;
                const speed = Math.sqrt(vx * vx + vy * vy + vz * vz);
                if (surge) {
                    // Hovering: mostly facing into the surge, turning a little on its own; a dart points it where it goes.
                    const own = 0.7 * Math.sin(t * 0.11 * slot.rate + slot.phase * 2);
                    const fx = surge.x * Math.cos(own) - surge.z * Math.sin(own);
                    const fz = surge.x * Math.sin(own) + surge.z * Math.cos(own);
                    const k = Math.min(Math.max((speed - 0.06) / 0.2, 0), 1);
                    const flip = Math.sin(t * 0.04 + slot.phase) > 0.35 ? -1 : 1;
                    vx = vx * k + fx * flip * (1 - k) * 0.2;
                    vz = vz * k + fz * flip * (1 - k) * 0.2;
                }
                const flat = Math.hypot(vx, vz);
                this.euler.set(Math.max(Math.min(-Math.atan2(vy, flat + 1e-4), 0.5), -0.5) * (surge ? 0.3 : 1), Math.atan2(vx, vz), 0);
                this.rotation.setFromEuler(this.euler);
                const size = look.length * (0.85 + 0.3 * ((slot.phase * 0.159) % 1));
                this.matrix.compose(this.at.set(p.x, p.y, p.z), this.rotation, this.scale.setScalar(size));
                const index = near ? entry.nearCount++ : entry.farCount++;
                this.matrix.toArray(matrices, index * 16);
                // The tail beat: a steady rhythm per fish (continuous on the shared clock), stronger when it swims fast.
                const frequency = look.beat * (0.8 + 0.4 * slot.rate);
                beats[index * 2] = ((t * frequency) % 1) * Math.PI * 2;
                beats[index * 2 + 1] = 0.45 + Math.min(speed / Math.max(look.length * 4, 0.1), 1.2);
            }
        }
        let triangles = 0;
        this.kinds.forEach((entry) => {
            for (const [mesh, count, per] of [[entry.near, entry.nearCount, entry.nearTriangles], [entry.far, entry.farCount, entry.farTriangles]] as const) {
                mesh.count = count;
                mesh.visible = count > 0;
                if (count > 0) {
                    mesh.instanceMatrix.needsUpdate = true;
                    (mesh.geometry.getAttribute("arkFish") as InstancedBufferAttribute).needsUpdate = true;
                }
                triangles += count * per;
            }
        });
        this.triangleCount = triangles;
    }

    dispose() {
        for (const mesh of this.meshes) {
            mesh.geometry.dispose();
            mesh.dispose();
        }
        this.materials.forEach((material) => material.dispose());
    }
}
