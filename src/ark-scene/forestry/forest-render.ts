/**
 * What logging leaves on the ground (p5 humans; AnimalDex decision 379): the stumps of the felled trees (until the
 * planters grub them out) and the stand's
 * bared earth (churned soil and sawdust, greening back as the saplings grow). One instanced draw for every stump and one
 * small mesh per stand in play (at most two or three at a time), built when a stand comes into play and dropped after.
 * The trees themselves (falling, felled, saplings) are `forest-trees.ts`, through `AssetTrees.setOverride`.
 */

import {BufferAttribute, BufferGeometry, Color, CylinderGeometry, DoubleSide, Group, InstancedMesh, Matrix4, Mesh, MeshStandardMaterial, Quaternion, Vector3} from "three";
import {inStand, type Logging} from "@/ark-scene/positions/forestry";
import {bareness, treeFate} from "@/ark-scene/forestry/forest-state";

/** Stumps drawn at most (the stands in play hold a few dozen trees between them). */
const MAX_STUMPS = 160;
/** A stump's height (m). */
const STUMP_H = 0.42;

export type StandTree = {x: number; y: number; z: number; radius: number};

function stumpGeometry(): BufferGeometry {
    // A short tapered cylinder: bark on the side, the pale cut on top with its rings darker toward the bark.
    const g = new CylinderGeometry(0.92, 1.08, 1, 9, 1, false);
    g.translate(0, 0.5, 0);
    const pos = g.getAttribute("position");
    const colours = new Float32Array(pos.count * 3);
    const bark = new Color("#5a4632");
    const cut = new Color("#c9a978");
    const c = new Color();
    for (let i = 0; i < pos.count; i++) {
        const y = pos.getY(i);
        const r = Math.hypot(pos.getX(i), pos.getZ(i));
        if (y > 0.99) c.copy(cut).lerp(bark, Math.max(0, r - 0.7) * 1.6);
        else c.copy(bark).multiplyScalar(0.8 + 0.25 * y);
        colours.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute("color", new BufferAttribute(colours, 3));
    return g;
}

/** The ground's height under a point (the scene's own ground: `standGround`). */
export type GroundAt = (x: number, z: number) => number;

/** A stand's bare earth: a disc over the ground, its rim fading into the forest floor. */
function earthGeometry(g: Logging, ground: GroundAt): BufferGeometry {
    const rings = 7;
    const spokes = 28;
    const reach = g.stand.r + 1.6;
    const positions: number[] = [];
    const colours: number[] = [];
    const index: number[] = [];
    // Churned forest soil with paler sawdust in it: darker than the beaches' sand, lighter than the leaf litter.
    const soil = new Color("#4f3d2a");
    const dust = new Color("#7a6243");
    const c = new Color();
    positions.push(g.stand.x, ground(g.stand.x, g.stand.z) + 0.05, g.stand.z);
    colours.push(soil.r, soil.g, soil.b, 1);
    for (let ring = 1; ring <= rings; ring++) {
        const rr = (ring / rings) * reach;
        for (let s = 0; s < spokes; s++) {
            const a = (s / spokes) * Math.PI * 2;
            const wobble = 1 + 0.08 * Math.sin(a * 3 + g.k) + 0.05 * Math.sin(a * 7 + g.k * 1.7);
            const x = g.stand.x + Math.cos(a) * rr * wobble;
            const z = g.stand.z + Math.sin(a) * rr * wobble;
            positions.push(x, ground(x, z) + 0.05, z);
            c.copy(soil).lerp(dust, 0.35 + 0.35 * Math.sin(a * 5 + ring * 2.3 + g.k));
            const edge = ring / rings;
            colours.push(c.r, c.g, c.b, edge > 0.72 ? Math.max(0, 1 - (edge - 0.72) / 0.28) : 1);
        }
    }
    for (let s = 0; s < spokes; s++) index.push(0, 1 + ((s + 1) % spokes), 1 + s);
    for (let ring = 1; ring < rings; ring++) {
        for (let s = 0; s < spokes; s++) {
            const a = 1 + (ring - 1) * spokes + s;
            const b = 1 + (ring - 1) * spokes + ((s + 1) % spokes);
            const a2 = a + spokes;
            const b2 = b + spokes;
            index.push(a, b, b2, a, b2, a2);
        }
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
    geometry.setAttribute("color", new BufferAttribute(new Float32Array(colours), 4));
    geometry.setIndex(index);
    geometry.computeVertexNormals();
    return geometry;
}

const matrix = new Matrix4();
const position = new Vector3();
const scale = new Vector3();
const turn = new Quaternion();
const up = new Vector3(0, 1, 0);

export class ForestGround {
    readonly group = new Group();
    private readonly stumps: InstancedMesh;
    private readonly earthMaterial = new MeshStandardMaterial({vertexColors: true, transparent: true, depthWrite: false, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, side: DoubleSide});
    private readonly earths = new Map<number, Mesh>();

    constructor(private readonly ground: GroundAt) {
        this.stumps = new InstancedMesh(stumpGeometry(), new MeshStandardMaterial({vertexColors: true, roughness: 0.9}), MAX_STUMPS);
        this.stumps.count = 0;
        this.stumps.frustumCulled = false;
        this.stumps.castShadow = true;
        this.stumps.receiveShadow = true;
        this.stumps.name = "forest-stumps";
        this.group.add(this.stumps);
    }

    /** A frame: the stands in play at `day` and the trees in them (their feet and trunk radii). */
    update(loggings: readonly Logging[], trees: readonly StandTree[], day: number) {
        // The bared earth: one disc per stand in play, faded by how bare it is now.
        const live = new Set<number>();
        for (const g of loggings) {
            live.add(g.k);
            let earth = this.earths.get(g.k);
            if (!earth) {
                earth = new Mesh(earthGeometry(g, this.ground), this.earthMaterial.clone());
                earth.name = `forest-earth:${g.k}`;
                earth.receiveShadow = true;
                earth.renderOrder = 1;
                this.earths.set(g.k, earth);
                this.group.add(earth);
            }
            const bare = bareness(g, day);
            (earth.material as MeshStandardMaterial).opacity = 0.8 * bare;
            earth.visible = bare > 0.01;
        }
        this.earths.forEach((earth, k) => {
            if (live.has(k)) return;
            earth.geometry.dispose();
            (earth.material as MeshStandardMaterial).dispose();
            this.group.remove(earth);
            this.earths.delete(k);
        });
        // The stumps: every tree past its cut whose sapling has not yet grown.
        let n = 0;
        for (const t of trees) {
            if (n >= MAX_STUMPS) break;
            let g: Logging | null = null;
            for (const l of loggings) if (inStand(l, t.x, t.z)) g = l;
            if (!g) continue;
            const fate = treeFate(g, t.x, t.z, day);
            const stump = fate.state === "log" || fate.state === "stump" || (fate.state === "falling" && fate.fall > 0.02);
            if (!stump) continue;
            const r = Math.min(Math.max(t.radius, 0.15), 2.2);
            turn.setFromAxisAngle(up, (t.x * 7.1 + t.z * 3.3) % (Math.PI * 2));
            matrix.compose(position.set(t.x, this.ground(t.x, t.z) - 0.05, t.z), turn, scale.set(r, STUMP_H * (r > 1 ? 1.8 : 1), r));
            this.stumps.setMatrixAt(n++, matrix);
        }
        this.stumps.count = n;
        this.stumps.visible = n > 0;
        this.stumps.instanceMatrix.needsUpdate = true;
    }

    dispose() {
        this.stumps.geometry.dispose();
        (this.stumps.material as MeshStandardMaterial).dispose();
        this.earths.forEach((earth) => {
            earth.geometry.dispose();
            (earth.material as MeshStandardMaterial).dispose();
        });
        this.earthMaterial.dispose();
    }
}
