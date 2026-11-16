/**
 * Underwater caves, drawn (3.3 batch, lane E; sites and rocks in `sea-caves.ts`). Every cave's rocks are fitted from
 * the island's own rock kit (`rock-shapes.ts`) and merged into ONE mesh (one draw call; 88,640 triangles for
 * nine caves on the high tier, 22,160 on the others), with a second small mesh for the dark of each cave's floor
 * and three veils of dark across its cavern (one draw call, 54 triangles a cave). The dark inside is baked into the rocks' colours: what faces the cavern is
 * dimmed, more the further in. Owned by `SeaLookView`: built on the first dive, let go after surfacing.
 */

import {BufferAttribute, BufferGeometry, DoubleSide, Mesh, MeshBasicMaterial, MeshStandardMaterial, type Object3D} from "three";
import type {QualityTier} from "@/ark-scene/post";
import {cachedRock} from "@/ark-scene/rock-shapes";
import {seaCaves, type SeaCave} from "@/ark-scene/sea-caves";
import {sampleGround} from "@/ark-scene/world";

/** The kit's mesh detail by tier (`rock-shapes.ts`: 2 → 320 triangles a lobe, 1 → 80). */
const DETAIL: Record<QualityTier, number> = {high: 2, medium: 1, low: 1};

/** How far inside the cavern a point is: 0 outside it or at its mouth, 1 deep in (for the baked dark). */
function inside(cave: SeaCave, x: number, y: number, z: number): number {
    const dx = x - cave.x;
    const dz = z - cave.z;
    const sin = Math.sin(cave.yaw);
    const cos = Math.cos(cave.yaw);
    const across = cos * dx - sin * dz;
    const out = sin * dx + cos * dz;
    if (out > 0.5 || out < -cave.length - 1.2 || Math.abs(across) > cave.width / 2 + 0.9 || y > cave.floor + cave.height + 1.1) return 0;
    const deep = Math.min(Math.max((0.5 - out) / (cave.length * 0.3), 0), 1);
    const centred = 1 - Math.min(Math.max((Math.abs(across) - cave.width / 2) / 0.9, 0), 1);
    // (Fading out up through the roof's own thickness: never a hard line across a rock.)
    const under = 1 - Math.min(Math.max((y - cave.floor - cave.height - 0.3) / 0.8, 0), 1);
    return deep * centred * under;
}

export class SeaCavesView {
    private readonly rocks: Mesh;
    private readonly shade: Mesh;
    readonly triangles: number;
    readonly count: number;

    constructor(private readonly parent: Object3D, tier: QualityTier) {
        const caves = seaCaves();
        this.count = caves.length;
        const detail = DETAIL[tier];
        let vertices = 0;
        let indices = 0;
        for (const cave of caves) {
            for (const rock of cave.rocks) {
                const mesh = cachedRock(rock.style, rock.variant, detail, true);
                vertices += mesh.positions.length / 3;
                indices += mesh.index.length;
            }
        }
        const positions = new Float32Array(vertices * 3);
        const normals = new Float32Array(vertices * 3);
        const colors = new Float32Array(vertices * 4);
        const index = new Uint32Array(indices);
        let v = 0;
        let i = 0;
        for (const cave of caves) {
            for (const rock of cave.rocks) {
                const mesh = cachedRock(rock.style, rock.variant, detail, true);
                const {min, max} = mesh.bounds;
                const kx = rock.sx / Math.max(max[0] - min[0], 0.01);
                const ky = rock.sy / Math.max(max[1] - min[1], 0.01);
                const kz = rock.sz / Math.max(max[2] - min[2], 0.01);
                const mx = (min[0] + max[0]) / 2;
                const mz = (min[2] + max[2]) / 2;
                const cy = Math.cos(rock.yaw);
                const sy = Math.sin(rock.yaw);
                const cl = Math.cos(rock.lean);
                const sl = Math.sin(rock.lean);
                const n = mesh.positions.length / 3;
                for (let k = 0; k < n; k++) {
                    // Fitted to its size, leaned about its own x, turned about y, set on its base.
                    const px = (mesh.positions[k * 3] - mx) * kx;
                    const py0 = (mesh.positions[k * 3 + 1] - min[1]) * ky;
                    const pz0 = (mesh.positions[k * 3 + 2] - mz) * kz;
                    const py = py0 * cl - pz0 * sl;
                    const pz = py0 * sl + pz0 * cl;
                    const wx = rock.x + px * cy + pz * sy;
                    const wy = rock.y + py;
                    const wz = rock.z - px * sy + pz * cy;
                    positions[(v + k) * 3] = wx;
                    positions[(v + k) * 3 + 1] = wy;
                    positions[(v + k) * 3 + 2] = wz;
                    // (The normal by the inverse of the fit, then the same turns.)
                    const nx0 = mesh.normals[k * 3] / kx;
                    const ny0 = mesh.normals[k * 3 + 1] / ky;
                    const nz0 = mesh.normals[k * 3 + 2] / kz;
                    const ny1 = ny0 * cl - nz0 * sl;
                    const nz1 = ny0 * sl + nz0 * cl;
                    const nx = nx0 * cy + nz1 * sy;
                    const nz = -nx0 * sy + nz1 * cy;
                    const length = Math.hypot(nx, ny1, nz) || 1;
                    normals[(v + k) * 3] = nx / length;
                    normals[(v + k) * 3 + 1] = ny1 / length;
                    normals[(v + k) * 3 + 2] = nz / length;
                    // The stone's own shading, the water taking the red out with depth (as it does the sea bed's,
                    // terrain.ts), weed on what faces up, and the dark of the cavern on what is inside it.
                    const depth = Math.max(-wy, 0);
                    const within = inside(cave, wx, wy, wz);
                    const dark = 1 - 0.9 * within;
                    const weed = Math.max(ny1 / length, 0) * 0.35;
                    const tone = 0.62;
                    colors[(v + k) * 4] = mesh.colors[k * 3] * tone * (1 - weed * 0.5) * Math.exp(-depth * 0.3) * dark;
                    colors[(v + k) * 4 + 1] = mesh.colors[k * 3 + 1] * tone * (1 + weed * 0.25) * Math.exp(-depth * 0.1) * dark;
                    colors[(v + k) * 4 + 2] = mesh.colors[k * 3 + 2] * tone * Math.exp(-depth * 0.07) * dark;
                    // (The fourth: how much of the water's haze it takes. The cavern's inside takes little, so it stays dark
                    // from across the bay instead of washing out to the open sea's blue.)
                    colors[(v + k) * 4 + 3] = 1 - 0.85 * within;
                }
                for (let k = 0; k < mesh.index.length; k++) index[i + k] = mesh.index[k] + v;
                v += n;
                i += mesh.index.length;
            }
        }
        const geometry = new BufferGeometry();
        geometry.setAttribute("position", new BufferAttribute(positions, 3));
        geometry.setAttribute("normal", new BufferAttribute(normals, 3));
        geometry.setAttribute("color", new BufferAttribute(colors, 4));
        geometry.setIndex(new BufferAttribute(index, 1));
        geometry.computeBoundingSphere();
        this.triangles = indices / 3;
        const material = new MeshStandardMaterial({vertexColors: true, roughness: 0.96, metalness: 0});
        material.onBeforeCompile = (shader) => {
            shader.fragmentShader = shader.fragmentShader.replace("#include <fog_fragment>", `#ifdef USE_FOG
    #ifdef FOG_EXP2
        float caveFog = 1.0 - exp(-fogDensity * fogDensity * vFogDepth * vFogDepth);
    #else
        float caveFog = smoothstep(fogNear, fogFar, vFogDepth);
    #endif
    #ifdef USE_COLOR_ALPHA
        caveFog *= vColor.a;
    #endif
    gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, caveFog);
#endif`);
        };
        this.rocks = new Mesh(geometry, material);
        this.rocks.name = "sea-caves";
        parent.add(this.rocks);

        // The dark of each cave: a strip of the bed from just outside the mouth to the back, black, fading at its edges
        // and out of the mouth (its alpha per vertex); and three veils of dark across the cavern, one behind the other
        // (the water's haze would else wash the inside out to the same blue as the open sea: the veils are not hazed).
        const ACROSS = 4;
        const ALONG = 6;
        const VEILS = [0.3, 0.55, 0.8];
        const shadePositions = new Float32Array(caves.length * ((ACROSS + 1) * (ALONG + 1) + VEILS.length * 4) * 3);
        const shadeColors = new Float32Array(caves.length * ((ACROSS + 1) * (ALONG + 1) + VEILS.length * 4) * 4);
        const shadeIndex = new Uint16Array(caves.length * (ACROSS * ALONG + VEILS.length * 2) * 6);
        let sv = 0;
        let si = 0;
        for (const cave of caves) {
            const sin = Math.sin(cave.yaw);
            const cos = Math.cos(cave.yaw);
            const first = sv;
            for (let a = 0; a <= ALONG; a++) {
                const out = 1.4 - (cave.length + 1.6) * (a / ALONG);
                for (let c = 0; c <= ACROSS; c++) {
                    const across = (c / ACROSS - 0.5) * (cave.width + 1.2);
                    const x = cave.x + cos * across + sin * out;
                    const z = cave.z - sin * across + cos * out;
                    shadePositions.set([x, sampleGround(x, z).height + 0.03, z], sv * 3);
                    const edge = c === 0 || c === ACROSS ? 0 : 1;
                    const depth = Math.min(Math.max((1.4 - out) / 2.2, 0), 1);
                    shadeColors.set([0, 0.012, 0.018, 0.85 * edge * depth], sv * 4);
                    sv++;
                }
            }
            for (let a = 0; a < ALONG; a++) {
                for (let c = 0; c < ACROSS; c++) {
                    const p = first + a * (ACROSS + 1) + c;
                    shadeIndex.set([p, p + ACROSS + 1, p + 1, p + 1, p + ACROSS + 1, p + ACROSS + 2], si);
                    si += 6;
                }
            }
            // The veils: from wall to wall and from the floor into the roof (their edges are in the rock).
            for (const share of VEILS) {
                const out = -cave.length * share;
                const p = sv;
                for (const [side, up] of [[-1, 0], [1, 0], [1, 1], [-1, 1]]) {
                    const across = side * (cave.width / 2 + 0.7);
                    const x = cave.x + cos * across + sin * out;
                    const z = cave.z - sin * across + cos * out;
                    shadePositions.set([x, up ? cave.floor + cave.height + 0.5 : sampleGround(x, z).height - 0.2, z], sv * 3);
                    shadeColors.set([0, 0.012, 0.018, 0.22], sv * 4);
                    sv++;
                }
                shadeIndex.set([p, p + 1, p + 2, p, p + 2, p + 3], si);
                si += 6;
            }
        }
        const shadeGeometry = new BufferGeometry();
        shadeGeometry.setAttribute("position", new BufferAttribute(shadePositions, 3));
        shadeGeometry.setAttribute("color", new BufferAttribute(shadeColors, 4));
        shadeGeometry.setIndex(new BufferAttribute(shadeIndex, 1));
        shadeGeometry.computeBoundingSphere();
        this.shade = new Mesh(shadeGeometry, new MeshBasicMaterial({vertexColors: true, transparent: true, depthWrite: false, fog: false, side: DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2}));
        this.shade.name = "sea-caves-shade";
        this.shade.renderOrder = 1;
        parent.add(this.shade);
    }

    setVisible(visible: boolean): void {
        this.rocks.visible = visible;
        this.shade.visible = visible;
    }

    dispose(): void {
        for (const mesh of [this.rocks, this.shade]) {
            this.parent.remove(mesh);
            mesh.geometry.dispose();
            (mesh.material as MeshBasicMaterial | MeshStandardMaterial).dispose();
        }
    }
}
