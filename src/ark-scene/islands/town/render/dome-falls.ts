/**
 * The free-flight dome's waterfall as moving water (ark-world round 2; the owner: "the dome waterfall is flat strips").
 * It was drawn in the zoo's solids: a backing sheet and eighteen strands of fixed colour, so it never moved and read as
 * white ribbons hung on the rock. Now it is a sheet of the wild island's falling water (`islands/falls-water.ts`: streaks
 * scrolling at the speed of the fall, frayed edges, white toward its foot) on the same thrown arc from the cliff's notch
 * into the lagoon (`dome.ts` DOME_CLIFF): a curtain and a thinner veil in front of it. One draw call, ~1.2k triangles,
 * built only while the dome is open. Drawing only: the cliff's rocks, colliders and perches are the dressing's.
 */

import {BufferAttribute, BufferGeometry, Mesh} from "three";
import {ARK_TIME} from "@/ark-scene/glsl";
import {fallsWaterMaterial} from "@/ark-scene/islands/falls-water";
import {townHeight} from "@/ark-scene/islands/town/ground";
import {DOME, DOME_CLIFF} from "@/ark-scene/islands/town/dome";

/**
 * The fall's arc from the notch (its lip) to the lagoon, in the cliff's frame: [out from the cliff's inner face toward the
 * dome's middle (m), height over the dome's floor (m)], top to foot. The dressing's spine (`zoo-habitat.ts`), unchanged.
 */
const SPINE: Array<[number, number]> = [[-3.3, 7.25], [-2.3, 7.0], [-1.5, 6.6], [-0.9, 5.6], [-0.5, 4.2], [-0.15, 2.7], [0.1, 1.2], [0.35, 0.05]];
/** The curtain's width at the lip (m); it spreads a fifth as it falls. */
export const DOME_FALL_SPAN = 3.5;
/** Time of flight the shader is given at the foot (s): the wild fall's look, white and frayed as it lands. */
const FLIGHT = 2.4;

function spineAt(t: number, drift: number): {out: number; y: number} {
    const f = t * (SPINE.length - 1);
    const i = Math.min(Math.floor(f), SPINE.length - 2);
    const k = f - i;
    return {out: SPINE[i][0] + (SPINE[i + 1][0] - SPINE[i][0]) * k + drift * Math.sin(t * Math.PI) * 0.5, y: SPINE[i][1] + (SPINE[i + 1][1] - SPINE[i][1]) * k};
}

/**
 * The sheets in the fall's own frame: local x across the curtain, y up from the dome's floor, z out from the cliff's
 * inner face toward the dome's middle (the material sways a sheet along its z). `aFlow`/`aEdge` as `falls-water.ts`.
 */
export function domeFallsGeometry(): BufferGeometry {
    const positions: number[] = [];
    const flows: number[] = [];
    const edges: number[] = [];
    const index: number[] = [];
    const sheet = (kind: number, nu: number, nv: number, inset: number, drift: number, out: number) => {
        const base = positions.length / 3;
        for (let j = 0; j <= nv; j++) {
            const t = j / nv;
            const p = spineAt(t, drift);
            for (let i = 0; i <= nu; i++) {
                const u01 = inset + (i / nu) * (1 - 2 * inset);
                const across = (u01 - 0.5) * DOME_FALL_SPAN * (1 + 0.22 * t);
                positions.push(across, p.y, p.out + out * Math.min(t * 4, 1));
                flows.push(across, t < 0.06 ? 0 : ((t - 0.06) / 0.94) * FLIGHT, kind);
                edges.push(Math.min(u01, 1 - u01) * 2);
            }
        }
        for (let j = 0; j < nv; j++) {
            for (let i = 0; i < nu; i++) {
                const a = base + j * (nu + 1) + i;
                index.push(a, a + nu + 1, a + 1, a + 1, a + nu + 1, a + nu + 2);
            }
        }
    };
    sheet(0, 22, 20, 0, 0.4, 0);
    sheet(1, 16, 16, 0.06, 0.55, 0.22);
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
    geometry.setAttribute("aFlow", new BufferAttribute(new Float32Array(flows), 3));
    geometry.setAttribute("aEdge", new BufferAttribute(new Float32Array(edges), 1));
    geometry.setIndex(index);
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();
    return geometry;
}

/** The fall's frame in the town: at the cliff's inner face under the notch, on the dome's floor, turned so +z faces in. */
export function domeFallsFrame(): {x: number; y: number; z: number; turn: number} {
    const f = DOME_CLIFF.fall;
    // (three's turn about y takes local x to (cos, -sin) and local z to (sin, cos): x along the cliff, z toward the middle.)
    return {x: DOME.x + Math.cos(f) * DOME_CLIFF.inner, y: townHeight(DOME.x, DOME.z), z: DOME.z + Math.sin(f) * DOME_CLIFF.inner, turn: Math.atan2(-Math.cos(f), -Math.sin(f))};
}

/** One material for every rebuild of the zoo (the zoo's meshes free their geometry only). */
let material: ReturnType<typeof fallsWaterMaterial> | null = null;

/** The fall as a mesh in the town's frame (the zoo's root). */
export function domeFallsMesh(): Mesh {
    material ??= fallsWaterMaterial(ARK_TIME);
    const mesh = new Mesh(domeFallsGeometry(), material);
    const frame = domeFallsFrame();
    mesh.position.set(frame.x, frame.y, frame.z);
    mesh.rotation.y = frame.turn;
    mesh.name = "zoo:dome-falls";
    mesh.renderOrder = 3;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    return mesh;
}
