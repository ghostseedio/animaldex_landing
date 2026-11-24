/**
 * The open sea's boats, drawn (graphics pass 2, lane OCEAN; routes in `ocean-traffic.ts`): one instanced mesh per hull
 * (three speedboats, a yacht, a ferry: 3 draw calls) and one for every wake (1 draw call, transparent), their matrices
 * written each frame from the shared clock (5 + 5 instances: no allocation per frame). The hulls are the town's boat kit
 * (`islands/town/render/boats.ts` hull, its floating material: on the sea's tide, rocking a few centimetres in the vertex
 * shader); the wake is a Kelvin wedge (two arms at 19.5° and the propeller's churn between them), white foam fading aft.
 *
 * Triangles: speedboat 248, yacht 240, ferry 344, wake 360 (three speedboats, one yacht, one ferry, five wakes: about 3,100 triangles in all).
 */

import {BufferAttribute, BufferGeometry, Euler, Group, InstancedMesh, Matrix4, MeshLambertMaterial, Quaternion, Vector3, type MeshStandardMaterial} from "three";
import {ARK_ENV} from "@/ark-scene/glsl";
import {hull, floatingMaterial, type Band, type Station} from "@/ark-scene/islands/town/render/boats";
import {propMaterial} from "@/ark-scene/islands/town/render/instanced";
import {Geo, tone, type Frame} from "@/ark-scene/islands/town/render/kit";
import {BOAT_ROUTES, BOAT_SIZE, boatFix, type BoatKind} from "@/ark-scene/ocean-traffic";

const F: Frame = {x: 0, y: 0, z: 0, rot: 0};

/** A planing speedboat, 6.4 m along +z (waterline at its origin): a deep-V white hull, red stripe, a console and screen, an outboard. */
export function speedboatGeometry(): BufferGeometry {
    const g = new Geo();
    const stations: Station[] = [
        {z: -3.2, deck: 1.08, keel: 0.24, top: 0.72, bottom: -0.32},
        {z: -1.5, deck: 1.14, keel: 0.18, top: 0.76, bottom: -0.38},
        {z: 0.5, deck: 1.06, keel: 0.1, top: 0.84, bottom: -0.36},
        {z: 2.0, deck: 0.74, keel: 0.05, top: 0.94, bottom: -0.24},
        {z: 2.9, deck: 0.3, keel: 0.02, top: 1.02, bottom: 0.02},
        {z: 3.25, deck: 0.03, keel: 0.01, top: 1.06, bottom: 0.36}
    ];
    const bands: Band[] = [
        [-2, 0.05, tone("#26323e")],
        [0.05, 0.42, tone("#f4f2ec")],
        [0.42, 0.56, tone("#c8322a")],
        [0.56, 2, tone("#f4f2ec")]
    ];
    hull(g, stations, bands, tone("#d9d2c4"), 0.1, tone("#ecebe6"));
    const deck = 0.78;
    // The console, its screen (tinted, raked back) and the helm seats behind it; the stern's bench.
    g.box(F, 0, deck, 0.35, 0.9, 0.78, 0.7, tone("#f2f0ea"));
    g.box(F, 0, deck + 0.78, 0.62, 1.0, 0.36, 0.08, tone("#2a3a46"));
    g.box(F, -0.32, deck, -0.55, 0.5, 0.5, 0.5, tone("#e8e2d4"));
    g.box(F, 0.32, deck, -0.55, 0.5, 0.5, 0.5, tone("#e8e2d4"));
    g.box(F, 0, deck, -2.5, 1.8, 0.42, 0.55, tone("#e8e2d4"));
    // The outboard on the transom: its leg into the water, its cowling above.
    g.box(F, 0, -0.6, -3.45, 0.22, 1.3, 0.3, tone("#2b2d30"));
    g.box(F, 0, 0.66, -3.5, 0.5, 0.72, 0.62, tone("#1e2124"));
    return g.toGeometry();
}

/** A sailing yacht, 9 m along +z: a white hull with a navy stripe, a low cabin, a mast and boom, a mainsail and a jib. */
export function sailboatGeometry(): BufferGeometry {
    const g = new Geo();
    const stations: Station[] = [
        {z: -4.4, deck: 1.1, keel: 0.5, top: 0.8, bottom: -0.2},
        {z: -2.5, deck: 1.38, keel: 0.42, top: 0.82, bottom: -0.5},
        {z: 0.4, deck: 1.42, keel: 0.3, top: 0.88, bottom: -0.6},
        {z: 2.6, deck: 1.0, keel: 0.12, top: 0.98, bottom: -0.45},
        {z: 4.0, deck: 0.38, keel: 0.03, top: 1.08, bottom: -0.1},
        {z: 4.55, deck: 0.03, keel: 0.01, top: 1.12, bottom: 0.3}
    ];
    const bands: Band[] = [
        [-2, 0.04, tone("#30343a")],
        [0.04, 0.5, tone("#f6f4ee")],
        [0.5, 0.62, tone("#23395d")],
        [0.62, 2, tone("#f6f4ee")]
    ];
    hull(g, stations, bands, tone("#c4ab84"), 0.12, tone("#e9e6dc"));
    const deck = 0.86;
    g.box(F, 0, deck, 0.2, 1.7, 0.5, 3.0, tone("#f1efe8"), 0, {top: tone("#e2ddd0")});
    g.box(F, 0, deck + 0.22, 1.2, 1.74, 0.16, 0.9, tone("#2a3a46"));
    // The keel's fin under it (seen from under the sea).
    g.box(F, 0, -1.6, -0.2, 0.14, 1.1, 1.4, tone("#30343a"));
    // Mast and boom.
    g.cylinder(F, 0, deck, 1.4, 0.07, 0.05, 11, tone("#d4d6d8"), 6);
    g.box(F, 0, deck + 1.42, -0.95, 0.09, 0.09, 4.7, tone("#c9cbcd"));
    // The sails, both faces (each a pair of triangles wound both ways), off-white.
    const sail = tone("#f3efe4");
    const shade = tone("#dcd6c8");
    const main: Array<[number, number, number]> = [[0.02, deck + 1.55, 1.3], [0.02, deck + 11, 1.38], [0.02, deck + 1.55, -3.2]];
    g.tri(main[0], main[1], main[2], sail);
    g.tri(main[0], main[2], main[1], shade);
    const jib: Array<[number, number, number]> = [[0, deck + 0.2, 4.3], [0, deck + 9.2, 1.45], [-0.25, deck + 0.4, 1.7]];
    g.tri(jib[0], jib[1], jib[2], sail);
    g.tri(jib[0], jib[2], jib[1], shade);
    return g.toGeometry();
}

/** A small passenger ferry, 22 m along +z: a navy hull, white upper works, a saloon with windows all round, a wheelhouse, a funnel. */
export function ferryGeometry(): BufferGeometry {
    const g = new Geo();
    const stations: Station[] = [
        {z: -11, deck: 3.2, keel: 2.2, top: 1.6, bottom: -0.9},
        {z: -7, deck: 3.5, keel: 2.4, top: 1.6, bottom: -1.3},
        {z: 2, deck: 3.5, keel: 2.2, top: 1.7, bottom: -1.4},
        {z: 7, deck: 2.7, keel: 1.0, top: 1.9, bottom: -1.0},
        {z: 9.8, deck: 1.2, keel: 0.15, top: 2.15, bottom: -0.3},
        {z: 11.1, deck: 0.05, keel: 0.02, top: 2.3, bottom: 0.6}
    ];
    const bands: Band[] = [
        [-3, 0.05, tone("#8a2a24")],
        [0.05, 0.25, tone("#1c1c1c")],
        [0.25, 1.15, tone("#1f3b63")],
        [1.15, 3, tone("#f2f0ea")]
    ];
    hull(g, stations, bands, tone("#9aa0a4"), 0.9, tone("#f2f0ea"));
    const deck = 1.62;
    const white = tone("#f4f2ec");
    const glass = tone("#1d2a33");
    // The saloon: white, its windows a dark band proud of its sides and ends; the upper deck on its roof.
    g.box(F, 0, deck, -1.5, 5.8, 2.4, 13, white, 0, {top: tone("#c9ccce")});
    g.box(F, 0, deck + 1.0, -1.5, 5.9, 0.95, 12.4, glass);
    g.box(F, 0, deck + 1.0, -1.5, 5.4, 0.95, 13.1, glass);
    // The wheelhouse forward on the upper deck, its windows round; the funnel aft, red with a black top.
    g.box(F, 0, deck + 2.4, 2.6, 4.2, 1.9, 3.4, white, 0, {top: tone("#d8dadc")});
    g.box(F, 0, deck + 3.25, 2.6, 4.3, 0.75, 3.0, glass);
    g.box(F, 0, deck + 3.25, 2.6, 3.8, 0.75, 3.5, glass);
    g.cylinder(F, 0, deck + 2.4, -5.5, 0.75, 0.65, 2.3, tone("#c13a2c"), 10);
    g.cylinder(F, 0, deck + 4.7, -5.5, 0.66, 0.66, 0.35, tone("#1c1c1c"), 10);
    // The upper deck's rail (a low white wall round its edge) and the mast with its light.
    for (const side of [-1, 1]) g.box(F, side * 2.85, deck + 2.4, -2.8, 0.06, 0.55, 10.4, white);
    g.box(F, 0, deck + 2.4, -8.0, 5.7, 0.55, 0.06, white);
    g.cylinder(F, 0, deck + 4.3, 3.6, 0.06, 0.05, 2.4, tone("#d8d4cc"), 6);
    return g.toGeometry();
}

/**
 * A wake, one unit long (scaled by its length both ways), trailing aft (−z) from the stern at its origin: the two arms
 * of the Kelvin wedge (19.5° each side, widening as they go) and the propeller's churn between them. Each strip is soft
 * across (clear at its edges, foam along its middle) and broken along its length (streaks of more and less foam, a
 * fixed pattern), white with an alpha fading to nothing at its end. RGBA vertex colours, normals up. `churn` false: the
 * two arms only (an animal's wake, which has no propeller).
 */
export function wakeGeometry(churn = true): BufferGeometry {
    const pos: number[] = [];
    const col: number[] = [];
    const nor: number[] = [];
    const steps = 20;
    // (Across a strip: its edge, two foam lines, its other edge; the foam's share of the alpha at each.)
    const across = [-1, -0.35, 0.35, 1];
    const soft = [0, 1, 1, 0];
    const strip = (seed: number, centre: (d: number) => number, width: (d: number) => number, alpha: (d: number) => number) => {
        const vertex = (d: number, k: number, x: number) => {
            pos.push(x, 0, -d);
            // (Streaks: a fixed ripple of the foam along the strip, a different one on each foam line.)
            const streak = 0.6 + 0.4 * Math.sin(d * 61 + seed * 5.1 + k * 2.3) * Math.sin(d * 17 + seed + k);
            col.push(1, 1, 1, Math.max(0, alpha(d) * soft[k] * streak));
            nor.push(0, 1, 0);
        };
        for (let i = 0; i < steps; i++) {
            const d0 = i / steps;
            const d1 = (i + 1) / steps;
            for (let k = 0; k < across.length - 1; k++) {
                const x = (d: number, j: number) => centre(d) + (across[j] * width(d)) / 2;
                // (Wound to face up, +y.)
                vertex(d0, k, x(d0, k));
                vertex(d0, k + 1, x(d0, k + 1));
                vertex(d1, k + 1, x(d1, k + 1));
                vertex(d0, k, x(d0, k));
                vertex(d1, k + 1, x(d1, k + 1));
                vertex(d1, k, x(d1, k));
            }
        }
    };
    const spread = Math.tan((19.5 * Math.PI) / 180);
    const fade = (d: number) => Math.max(0, 1 - d) ** 2;
    for (const side of [-1, 1]) strip(side + 2, (d) => side * (0.035 + spread * d), (d) => 0.02 + 0.07 * d, (d) => 0.7 * fade(d));
    if (churn) strip(0, () => 0, (d) => 0.07 + 0.16 * d, (d) => 0.9 * Math.max(0, 1 - d * 1.6) ** 1.5);
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(new Float32Array(pos), 3));
    geometry.setAttribute("normal", new BufferAttribute(new Float32Array(nor), 3));
    geometry.setAttribute("color", new BufferAttribute(new Float32Array(col), 4));
    geometry.computeBoundingSphere();
    return geometry;
}

/** A boat's trim under way (radians, bow up) at full speed, and how far it heels (a yacht's lean). */
const TRIM: Record<BoatKind, number> = {speedboat: 0.09, sailboat: 0.01, ferry: 0.012};
const HEEL: Record<BoatKind, number> = {speedboat: 0, sailboat: 0.16, ferry: 0};

export class OceanTrafficView {
    readonly group = new Group();
    private readonly hulls = new Map<BoatKind, InstancedMesh>();
    private readonly material: MeshStandardMaterial;
    private readonly wakes: InstancedMesh;
    private readonly matrix = new Matrix4();
    private readonly position = new Vector3();
    private readonly scale = new Vector3();
    private readonly quaternion = new Quaternion();
    private readonly euler = new Euler(0, 0, 0, "YXZ");

    constructor() {
        this.group.name = "ocean-traffic";
        const counts = new Map<BoatKind, number>();
        for (const route of BOAT_ROUTES) counts.set(route.kind, (counts.get(route.kind) ?? 0) + 1);
        const material = (this.material = floatingMaterial(propMaterial(), true));
        const geometries: Record<BoatKind, () => BufferGeometry> = {speedboat: speedboatGeometry, sailboat: sailboatGeometry, ferry: ferryGeometry};
        for (const [kind, count] of Array.from(counts)) {
            const mesh = new InstancedMesh(geometries[kind](), material, count);
            mesh.name = `ocean-${kind}`;
            mesh.frustumCulled = false;
            mesh.castShadow = false;
            mesh.receiveShadow = false;
            this.hulls.set(kind, mesh);
            this.group.add(mesh);
        }
        this.wakes = new InstancedMesh(wakeGeometry(), new MeshLambertMaterial({vertexColors: true, emissive: 0x2a3034, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2}), BOAT_ROUTES.length);
        this.wakes.name = "ocean-wakes";
        this.wakes.frustumCulled = false;
        // (After the sea's surface, renderOrder 2: foam on the water.)
        this.wakes.renderOrder = 3;
        this.group.add(this.wakes);
    }

    /** Every frame: each boat where the shared clock has it (`seconds`, epoch), its wake behind it on the water. */
    step(seconds: number, visible: boolean): void {
        this.group.visible = visible;
        if (!visible) return;
        const used = new Map<BoatKind, number>();
        const sea = ARK_ENV.seaLevel.value;
        BOAT_ROUTES.forEach((route, i) => {
            const fix = boatFix(route, seconds);
            const kind = route.kind;
            const k = used.get(kind) ?? 0;
            used.set(kind, k + 1);
            const pace = Math.min(fix.speed / route.speed, 1);
            // (The hull's waterline at y = 0: the floating material lifts it onto the tide. Trim bow-up with speed.)
            this.euler.set(-TRIM[kind] * pace, fix.yaw, HEEL[kind]);
            this.quaternion.setFromEuler(this.euler);
            this.matrix.compose(this.position.set(fix.x, kind === "speedboat" ? 0.12 * pace : 0, fix.z), this.quaternion, this.scale.set(1, 1, 1));
            this.hulls.get(kind)!.setMatrixAt(k, this.matrix);
            // The wake from the stern, its length with the speed, flat on the sea (none at a standstill).
            const size = BOAT_SIZE[kind];
            const length = Math.max(size.wake * pace, 0.001);
            const sternX = fix.x - Math.sin(fix.yaw) * size.length * 0.48;
            const sternZ = fix.z - Math.cos(fix.yaw) * size.length * 0.48;
            this.quaternion.setFromEuler(this.euler.set(0, fix.yaw, 0));
            this.matrix.compose(this.position.set(sternX, sea + 0.04, sternZ), this.quaternion, this.scale.set(length, 1, length));
            this.wakes.setMatrixAt(i, this.matrix);
        });
        for (const mesh of Array.from(this.hulls.values())) mesh.instanceMatrix.needsUpdate = true;
        this.wakes.instanceMatrix.needsUpdate = true;
    }

    dispose(): void {
        for (const mesh of Array.from(this.hulls.values())) mesh.geometry.dispose();
        this.material.dispose();
        this.wakes.geometry.dispose();
        (this.wakes.material as MeshLambertMaterial).dispose();
        this.group.removeFromParent();
    }
}
