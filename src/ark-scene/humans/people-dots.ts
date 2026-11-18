/**
 * The far level of the Ark's people (humans polish, 2026-11-18). Past `HUMAN_FAR` (250 m) a person was not drawn at all,
 * so the whole-island overview, 400 to 900 m off, showed no one. Here each person out of doors is a small standing
 * figure (legs, a top, a head in the seeded look's own colours: no face, no photo), drawn instanced in one draw call
 * and grown with the distance (`dotGrowth`) so it stays about fifteen pixels tall instead of vanishing: from the true size at
 * 250 m where the coarse body leaves off, to seven metres at 500 m and twelve at 900 m. Indoors (a flat's sofa or bed), in a car
 * or a boat they are not drawn: they would stand on the roof. Lit as the bodies are (the scene's lights, and the street
 * lamps' glow at night), written into preallocated arrays each frame (no allocation).
 */

import {BufferAttribute, BufferGeometry, Group, InstancedBufferAttribute, InstancedMesh, MeshStandardMaterial, type WebGLProgramParametersWithUniforms} from "three";
import {BASE_HEIGHT, HUMAN_FAR, HUMAN_LINEAR_GLSL, type HumanInstance} from "@/ark-scene/humans/figures";

/** Nothing past this distance (m). */
export const DOT_FAR = 5000;
/**
 * How big a figure is drawn. At `HUMAN_FAR` the true size, where the coarse body leaves off (about 0.007 rad, 6 px on a
 * phone's screen); from there it grows with the distance until it spans `DOT_ANGLE` rad (about 16 px on a desktop's screen: the overview's
 * 400–900 m), and stays that angle farther out, to at most `DOT_GROWTH_MAX` × its true size.
 */
const DOT_ANGLE = 0.014;
/** The distance (m) over which the angle grows from the true size's to `DOT_ANGLE`. */
const DOT_RAMP = 250;
/** The most a figure is grown (× its true size). */
const DOT_GROWTH_MAX = 8;
/** Lying (a sunbather, in bed): lower and wider. */
const LYING = new Set<string>(["lie", "sunback", "sunside", "sleep"]);

/** A figure's growth (× its true size) at a distance (m). */
export function dotGrowth(distance: number): number {
    if (distance <= HUMAN_FAR) return 1;
    const angle = BASE_HEIGHT / HUMAN_FAR + (DOT_ANGLE - BASE_HEIGHT / HUMAN_FAR) * Math.min((distance - HUMAN_FAR) / DOT_RAMP, 1);
    return Math.min(Math.max((angle * distance) / BASE_HEIGHT, 1), DOT_GROWTH_MAX);
}

/** The figure's height (m) at a distance (m) for a person of true height `height`. */
export function dotHeight(height: number, distance: number): number {
    return height * dotGrowth(distance);
}

/** Whether a person is a figure out of doors (not at home in a flat, asleep, in a car or at a boat's helm). */
export function dotted(h: HumanInstance): boolean {
    const t = h as HumanInstance & {what?: string; face?: number};
    return t.face === undefined && t.what !== "home" && t.what !== "sleep" && t.what !== "car" && t.what !== "boat";
}

const GLSL = /* glsl */ `
attribute float dotPart;
attribute vec4 iSkin;
attribute vec3 iTop;
attribute vec3 iBottom;
varying vec3 vDotColour;
varying float vDotLight;
${HUMAN_LINEAR_GLSL}
`;

function dotShader(shader: WebGLProgramParametersWithUniforms) {
    shader.vertexShader = shader.vertexShader
        .replace("#include <common>", `#include <common>\n${GLSL}`)
        .replace("#include <color_vertex>", "#include <color_vertex>\nvDotColour = dotPart < 0.5 ? humanSkinLinear(iSkin.rgb) : dotPart < 1.5 ? humanLinear(iTop) : humanLinear(iBottom);\nvDotLight = iSkin.a;");
    shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", "#include <common>\nvarying vec3 vDotColour;\nvarying float vDotLight;")
        .replace("vec4 diffuseColor = vec4( diffuse, opacity );", "vec4 diffuseColor = vec4( diffuse * vDotColour, opacity );")
        .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\ntotalEmissiveRadiance += vDotColour * (0.12 + vDotLight) * vec3(0.5, 0.47, 0.44);");
}

/** A box's 24 vertices (flat normals) and 12 triangles, appended; `part`: 0 skin, 1 top, 2 bottom. */
function box(into: {p: number[]; n: number[]; part: number[]; i: number[]}, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, part: number) {
    const faces: Array<[number[], number[]]> = [
        [[1, 0, 0], [x1, y0, z0, x1, y1, z0, x1, y1, z1, x1, y0, z1]],
        [[-1, 0, 0], [x0, y0, z1, x0, y1, z1, x0, y1, z0, x0, y0, z0]],
        [[0, 1, 0], [x0, y1, z0, x0, y1, z1, x1, y1, z1, x1, y1, z0]],
        [[0, -1, 0], [x0, y0, z1, x0, y0, z0, x1, y0, z0, x1, y0, z1]],
        [[0, 0, 1], [x1, y0, z1, x1, y1, z1, x0, y1, z1, x0, y0, z1]],
        [[0, 0, -1], [x0, y0, z0, x0, y1, z0, x1, y1, z0, x1, y0, z0]]
    ];
    for (const [normal, corners] of faces) {
        const base = into.p.length / 3;
        for (let k = 0; k < 4; k++) {
            into.p.push(corners[k * 3], corners[k * 3 + 1], corners[k * 3 + 2]);
            into.n.push(normal[0], normal[1], normal[2]);
            into.part.push(part);
        }
        into.i.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
}

/** The figure at the body's height (1.75 m, `BASE_HEIGHT`), feet at the origin: legs, a top, a head (a little broad, to read small). */
export function dotGeometry(): BufferGeometry {
    const into = {p: [] as number[], n: [] as number[], part: [] as number[], i: [] as number[]};
    box(into, -0.28, 0.28, 0, 0.86, -0.2, 0.2, 2);
    box(into, -0.42, 0.42, 0.86, 1.5, -0.24, 0.24, 1);
    box(into, -0.22, 0.22, 1.5, 1.8, -0.2, 0.2, 0);
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(new Float32Array(into.p), 3));
    g.setAttribute("normal", new BufferAttribute(new Float32Array(into.n), 3));
    g.setAttribute("dotPart", new BufferAttribute(new Float32Array(into.part), 1));
    g.setIndex(new BufferAttribute(new Uint16Array(into.i), 1));
    g.computeBoundingSphere();
    return g;
}

const noRaycast = () => {};

export class PeopleDots {
    readonly group = new Group();
    /** How many are drawn at the last frame. */
    drawn = 0;
    readonly geometry = dotGeometry();
    private readonly material: MeshStandardMaterial;
    private mesh!: InstancedMesh;
    private skin!: InstancedBufferAttribute;
    private top!: InstancedBufferAttribute;
    private bottom!: InstancedBufferAttribute;
    private attrs: InstancedBufferAttribute[] = [];
    private capacity = 0;

    constructor() {
        this.group.name = "humans:dots";
        this.material = new MeshStandardMaterial({color: 0xffffff, roughness: 0.9, metalness: 0});
        this.material.customProgramCacheKey = () => "ark-people-dots";
        this.material.onBeforeCompile = dotShader;
        this.grow(160);
    }

    /** The instanced mesh (replaced when the roster outgrows it). */
    get instances(): InstancedMesh {
        return this.mesh;
    }

    private grow(capacity: number) {
        const old = this.mesh;
        const attr = (size: number, was?: InstancedBufferAttribute) => {
            const a = new InstancedBufferAttribute(new Float32Array(capacity * size), size);
            a.setUsage(35048); // DynamicDrawUsage
            if (was) (a.array as Float32Array).set(was.array as Float32Array);
            return a;
        };
        this.skin = attr(4, this.skin);
        this.top = attr(3, this.top);
        this.bottom = attr(3, this.bottom);
        // (One geometry per mesh over the shared vertex attributes: the per-instance attributes are set on it.)
        const g = new BufferGeometry();
        for (const key of Object.keys(this.geometry.attributes)) g.setAttribute(key, this.geometry.getAttribute(key));
        g.setIndex(this.geometry.getIndex());
        g.boundingSphere = this.geometry.boundingSphere;
        g.setAttribute("iSkin", this.skin);
        g.setAttribute("iTop", this.top);
        g.setAttribute("iBottom", this.bottom);
        const mesh = new InstancedMesh(g, this.material, capacity);
        mesh.name = "humans:dots";
        mesh.count = 0;
        mesh.visible = false;
        mesh.frustumCulled = false;
        mesh.castShadow = false;
        mesh.receiveShadow = false;
        mesh.userData.kind = "human";
        // (The high tier's ambient occlusion draws every object with one plain material: not these.)
        mesh.userData.gtaoSkip = true;
        mesh.raycast = noRaycast;
        if (old) {
            (mesh.instanceMatrix.array as Float32Array).set(old.instanceMatrix.array as Float32Array);
            old.removeFromParent();
            old.geometry.dispose();
            old.dispose();
        }
        this.mesh = mesh;
        this.attrs = [this.skin, this.top, this.bottom];
        this.capacity = capacity;
        this.group.add(mesh);
    }

    /** The people out of doors beyond `HUMAN_FAR` (and within `DOT_FAR`) of the camera, as figures; how many. */
    setFrame(list: readonly HumanInstance[], camera: {x: number; y: number; z: number}): number {
        if (list.length > this.capacity) this.grow(Math.max(list.length, this.capacity * 2));
        const m = this.mesh.instanceMatrix.array as Float32Array;
        let n = 0;
        for (let i = 0; i < list.length; i++) {
            const h = list[i];
            const d = Math.sqrt((h.x - camera.x) ** 2 + (h.y - camera.y) ** 2 + (h.z - camera.z) ** 2);
            if (d < HUMAN_FAR || d > DOT_FAR || !dotted(h)) continue;
            const s = ((h.look.height * (h.scale ?? 1)) / BASE_HEIGHT) * dotGrowth(d);
            const lying = LYING.has(h.pose);
            const sx = lying ? s * 1.6 : s;
            const sy = lying ? s * 0.4 : s;
            const o = n * 16;
            m[o] = sx;
            m[o + 1] = 0;
            m[o + 2] = 0;
            m[o + 3] = 0;
            m[o + 4] = 0;
            m[o + 5] = sy;
            m[o + 6] = 0;
            m[o + 7] = 0;
            m[o + 8] = 0;
            m[o + 9] = 0;
            m[o + 10] = sx;
            m[o + 11] = 0;
            m[o + 12] = h.x;
            m[o + 13] = h.y;
            m[o + 14] = h.z;
            m[o + 15] = 1;
            const look = h.look;
            this.skin.setXYZW(n, look.skin[0], look.skin[1], look.skin[2], h.light ?? 0);
            this.top.setXYZ(n, look.top[0], look.top[1], look.top[2]);
            this.bottom.setXYZ(n, look.bottom[0], look.bottom[1], look.bottom[2]);
            n++;
        }
        const mesh = this.mesh;
        mesh.count = n;
        mesh.visible = n > 0;
        if (n > 0) {
            mesh.instanceMatrix.needsUpdate = true;
            mesh.instanceMatrix.clearUpdateRanges();
            mesh.instanceMatrix.addUpdateRange(0, n * 16);
            for (const a of this.attrs) {
                a.needsUpdate = true;
                a.clearUpdateRanges();
                a.addUpdateRange(0, n * a.itemSize);
            }
        }
        this.drawn = n;
        return n;
    }

    dispose(): void {
        this.mesh.geometry.dispose();
        this.mesh.dispose();
        this.geometry.dispose();
        this.material.dispose();
        this.group.removeFromParent();
    }
}
