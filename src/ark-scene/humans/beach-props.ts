/**
 * Quality pass (p5 humans): the sunbathers' towels and parasols on the town's beach (`TownHumans.beach`, world frame).
 * Instanced: a striped towel (white bands on its colour, a little fringe of thickness) and a parasol (a pole and an
 * eight-gore canopy, its gores alternately white and its colour). A vertex colour's red is the white flag: the cloth is
 * the instance's colour or white; no textures; written into preallocated instances each frame.
 */

import {BufferAttribute, BufferGeometry, Color, CylinderGeometry, Group, InstancedMesh, Matrix4, MeshStandardMaterial, Quaternion, Vector3} from "three";
import type {BeachProp} from "@/ark-scene/humans/town-humans";

/** At most this many of each drawn. */
export const BEACH_PROPS_MAX = 64;

/** A towel 0.9 × 1.9 m, five bands along it (white at the ends and the middle band's edges), lying on the sand. */
export function towelGeometry(): BufferGeometry {
    const positions: number[] = [];
    const colours: number[] = [];
    const indices: number[] = [];
    const w = 0.45;
    const bands = [-0.95, -0.8, -0.72, 0.72, 0.8, 0.95];
    for (let i = 0; i + 1 < bands.length; i++) {
        const white = i === 1 || i === 3;
        const base = positions.length / 3;
        for (const [x, z] of [[-w, bands[i]], [w, bands[i]], [w, bands[i + 1]], [-w, bands[i + 1]]]) {
            positions.push(x, 0, z);
            const c = white ? [1, 1, 1] : [0, 0, 0];
            colours.push(...c);
        }
        indices.push(base, base + 2, base + 1, base, base + 3, base + 2);
    }
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
    g.setAttribute("color", new BufferAttribute(new Float32Array(colours), 3));
    g.setIndex(indices);
    g.computeVertexNormals();
    return g;
}

/** A parasol: a 2.1 m pole and a 1.1 m canopy of eight gores (a shallow cone with a fold at each rib), a finial. */
export function parasolGeometry(): BufferGeometry {
    const positions: number[] = [];
    const colours: number[] = [];
    const ribs = 8;
    const top = 2.15;
    const rim = 1.82;
    const r = 1.1;
    for (let k = 0; k < ribs; k++) {
        const a0 = (k / ribs) * Math.PI * 2;
        const a1 = ((k + 1) / ribs) * Math.PI * 2;
        const am = (a0 + a1) / 2;
        // Each gore sags a little between its ribs (the cloth's middle a touch lower than the ribs' line).
        const p0 = [Math.cos(a0) * r, rim, Math.sin(a0) * r];
        const p1 = [Math.cos(a1) * r, rim, Math.sin(a1) * r];
        const pm = [Math.cos(am) * r * 0.93, rim - 0.04, Math.sin(am) * r * 0.93];
        const white = k % 2 === 0;
        const c = white ? [1, 1, 1] : [0, 0, 0];
        for (const [a, b] of [[p0, pm], [pm, p1]]) {
            // Upper face and its underside (the canopy is seen from below too).
            positions.push(0, top, 0, ...b, ...a, 0, top - 0.01, 0, ...a, ...b);
            for (let v = 0; v < 6; v++) colours.push(...c);
        }
    }
    const canopy = new BufferGeometry();
    canopy.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
    canopy.setAttribute("color", new BufferAttribute(new Float32Array(colours), 3));
    canopy.computeVertexNormals();
    // The pole (pale wood) as part of the same mesh: flagged white.
    const pole = new CylinderGeometry(0.022, 0.026, top + 0.3, 6, 1, false).toNonIndexed();
    pole.translate(0, (top + 0.3) / 2 - 0.3, 0);
    const pc = new Float32Array(pole.getAttribute("position").count * 3).fill(1);
    pole.setAttribute("color", new BufferAttribute(pc, 3));
    const merged = new BufferGeometry();
    const pa = canopy.getAttribute("position").array as Float32Array;
    const pb = pole.getAttribute("position").array as Float32Array;
    const na = canopy.getAttribute("normal").array as Float32Array;
    const nb = pole.getAttribute("normal").array as Float32Array;
    const ca = canopy.getAttribute("color").array as Float32Array;
    const join = (x: Float32Array, y: Float32Array) => {
        const out = new Float32Array(x.length + y.length);
        out.set(x);
        out.set(y, x.length);
        return out;
    };
    merged.setAttribute("position", new BufferAttribute(join(pa, pb), 3));
    merged.setAttribute("normal", new BufferAttribute(join(na, nb), 3));
    merged.setAttribute("color", new BufferAttribute(join(ca, pc), 3));
    merged.computeBoundingSphere();
    canopy.dispose();
    pole.dispose();
    return merged;
}

export class BeachProps {
    readonly group = new Group();
    private readonly towels: InstancedMesh;
    private readonly parasols: InstancedMesh;
    private readonly m = new Matrix4();
    private readonly q = new Quaternion();
    private readonly q2 = new Quaternion();
    private readonly p = new Vector3();
    private readonly one = new Vector3(1, 1, 1);
    private readonly up = new Vector3(0, 1, 0);
    private readonly across = new Vector3(1, 0, 0);
    private readonly c = new Color();

    constructor() {
        this.group.name = "humans:beach";
        const cloth = (rough: number) => {
            const material = new MeshStandardMaterial({color: 0xffffff, vertexColors: true, roughness: rough, metalness: 0});
            material.customProgramCacheKey = () => "ark-beach-cloth";
            material.onBeforeCompile = (shader) => {
                shader.vertexShader = shader.vertexShader.replace("#include <color_vertex>", "#include <color_vertex>\n#ifdef USE_INSTANCING_COLOR\nvColor.xyz = mix(instanceColor.xyz, vec3(0.93, 0.91, 0.86), color.r);\n#endif");
            };
            return material;
        };
        this.towels = new InstancedMesh(towelGeometry(), cloth(0.95), BEACH_PROPS_MAX);
        this.parasols = new InstancedMesh(parasolGeometry(), cloth(0.8), BEACH_PROPS_MAX);
        for (const mesh of [this.towels, this.parasols]) {
            mesh.count = 0;
            mesh.frustumCulled = false;
            mesh.receiveShadow = true;
            mesh.visible = false;
            this.group.add(mesh);
        }
        this.parasols.castShadow = true;
        this.towels.name = "humans:towels";
        this.parasols.name = "humans:parasols";
    }

    setFrame(props: readonly BeachProp[]): void {
        let t = 0;
        let s = 0;
        for (const prop of props) {
            const mesh = prop.kind === "towel" ? this.towels : this.parasols;
            const k = prop.kind === "towel" ? t : s;
            if (k >= BEACH_PROPS_MAX) continue;
            this.q.setFromAxisAngle(this.up, prop.yaw);
            // A towel follows the sand's slope (its head's end up by `tilt`); a parasol leans by it toward the sea.
            this.q.multiply(this.q2.setFromAxisAngle(this.across, prop.tilt));
            this.p.set(prop.x, prop.y, prop.z);
            this.m.compose(this.p, this.q, this.one);
            mesh.setMatrixAt(k, this.m);
            mesh.setColorAt(k, this.c.setRGB(prop.colour[0], prop.colour[1], prop.colour[2]));
            if (prop.kind === "towel") t++;
            else s++;
        }
        this.towels.count = t;
        this.parasols.count = s;
        for (const mesh of [this.towels, this.parasols]) {
            mesh.visible = mesh.count > 0;
            mesh.instanceMatrix.needsUpdate = true;
            if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        }
    }

    dispose(): void {
        for (const mesh of [this.towels, this.parasols]) {
            mesh.geometry.dispose();
            (mesh.material as MeshStandardMaterial).dispose();
        }
        this.group.removeFromParent();
    }
}
