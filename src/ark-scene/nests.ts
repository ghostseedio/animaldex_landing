/**
 * Eggs on the Ark (owner decision A9): an egg-layer lays a clutch, and the
 * young hatch from it. Acted out only from the server's log (`laid`, then
 * `birth` with `payload.from_egg`): a nest (a bird's), a clutch in a scrape
 * on the ground (a reptile's, an insect's), or spawn in the water (a fish's,
 * a frog's) appears beside the parent, the eggs pop in one by one; at the
 * hatch they rock, split and are gone, and the young stand up out of it.
 * Eggs are never food: nothing here is ever eaten.
 *
 * One small group of meshes per nest, only while a replay shows it.
 */

import {
    Color,
    CylinderGeometry,
    Group,
    InstancedMesh,
    Matrix4,
    Mesh,
    MeshStandardMaterial,
    Quaternion,
    SphereGeometry,
    TorusGeometry,
    Vector3
} from "three";

export type NestKind = "nest" | "scrape" | "spawn";

/** Which kind suits the parent: a bird's nest, spawn in the water, else a clutch in a scrape. */
export function nestKind(input: {plan: string | null | undefined; slug: string; water: boolean}): NestKind {
    if (input.water || /^(fish|eel|ray|shark)$/.test(input.plan ?? "") || /(frog|toad|newt|salamander|salmon|trout|carp|herring|cod)/.test(input.slug)) return "spawn";
    if (input.plan === "bird") return "nest";
    return "scrape";
}

/** How many eggs are drawn: the server's count (a clutch of thousands reads as a mass of spawn), at most 9. */
export function drawnEggs(kind: NestKind, eggs: number | null): number {
    if (kind === "spawn") return Math.min(Math.max(eggs ?? 14, 8), 18);
    return Math.min(Math.max(eggs ?? 3, 1), 9);
}

type Nest = {
    group: Group;
    eggs: InstancedMesh;
    count: number;
    size: number;
    kind: NestKind;
    laidAt: number;
    hatchAt: number | null;
    /** Seconds over which the eggs pop in. */
    layingSeconds: number;
    basePositions: Vector3[];
};

const SHELL = new Color("#f2eadb");
const SPECKLED = new Color("#d9e3d0");
const SPAWN = new Color("#e7efe3");
const TWIGS = new Color("#7d6448");
const SCRAPE = new Color("#9d8466");

const LAY_SECONDS = 0.45;
const HATCH_ROCK = 0.9;
const HATCH_GONE = 1.5;
const NEST_FADE = 2.6;

export class ArkNests {
    readonly root = new Group();
    private readonly nests = new Map<string, Nest>();
    private readonly eggGeometry = new SphereGeometry(0.5, 10, 8);
    private readonly ringGeometry = new TorusGeometry(0.5, 0.16, 6, 16);
    private readonly scrapeGeometry = new CylinderGeometry(0.55, 0.62, 0.06, 18, 1);
    private readonly matrix = new Matrix4();
    private readonly quaternion = new Quaternion();
    private readonly scale = new Vector3();
    private readonly position = new Vector3();

    constructor() {
        this.eggGeometry.scale(0.8, 1, 0.8);
        this.ringGeometry.rotateX(Math.PI / 2);
    }

    has(id: string): boolean {
        return this.nests.has(id);
    }

    /** Where a nest is (its middle on the ground), for the camera and the young. */
    where(id: string): {x: number; y: number; z: number; size: number} | null {
        const nest = this.nests.get(id);
        return nest ? {x: nest.group.position.x, y: nest.group.position.y, z: nest.group.position.z, size: nest.size} : null;
    }

    /** A clutch laid at (x, y, z), `size` across (from the parent's length), its eggs popping in from `now`. */
    lay(id: string, at: {x: number; y: number; z: number}, size: number, kind: NestKind, eggs: number | null, now: number) {
        if (this.nests.has(id)) return;
        const group = new Group();
        group.position.set(at.x, at.y, at.z);
        const count = drawnEggs(kind, eggs);
        if (kind !== "spawn") {
            const base = new Mesh(kind === "nest" ? this.ringGeometry : this.scrapeGeometry, new MeshStandardMaterial({color: kind === "nest" ? TWIGS : SCRAPE, roughness: 1, metalness: 0}));
            base.scale.setScalar(size);
            if (kind === "nest") base.scale.y = size * 0.55;
            base.position.y = kind === "nest" ? size * 0.05 : 0.01;
            base.receiveShadow = true;
            group.add(base);
        }
        const material = new MeshStandardMaterial({
            color: kind === "spawn" ? SPAWN : kind === "nest" ? SPECKLED : SHELL,
            roughness: kind === "spawn" ? 0.25 : 0.55,
            metalness: 0,
            transparent: kind === "spawn",
            opacity: kind === "spawn" ? 0.72 : 1
        });
        const mesh = new InstancedMesh(this.eggGeometry, material, count);
        mesh.castShadow = kind !== "spawn";
        mesh.frustumCulled = false;
        group.add(mesh);
        // The eggs in a little heap, the same for every viewer (from the id).
        let seed = 0;
        for (let i = 0; i < id.length; i++) seed = (seed * 31 + id.charCodeAt(i)) >>> 0;
        const basePositions: Vector3[] = [];
        for (let i = 0; i < count; i++) {
            const angle = i * 2.39996 + (seed % 628) / 100;
            const radius = count === 1 ? 0 : size * (kind === "spawn" ? 0.42 : 0.2) * Math.sqrt((i + 0.5) / count);
            basePositions.push(new Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius));
        }
        this.root.add(group);
        this.nests.set(id, {group, eggs: mesh, count, size, kind, laidAt: now, hatchAt: null, layingSeconds: Math.min(LAY_SECONDS * count, 1.8), basePositions});
        this.draw(this.nests.get(id)!, now);
    }

    /** The eggs hatch from `now`: they rock, split and are gone; the nest fades after. */
    hatch(id: string, now: number) {
        const nest = this.nests.get(id);
        if (nest && nest.hatchAt === null) nest.hatchAt = now;
    }

    /** Seconds after the hatch began at which the young should appear (the eggs have split). */
    static readonly YOUNG_AFTER = HATCH_ROCK;

    step(now: number) {
        this.nests.forEach((nest, id) => {
            if (nest.hatchAt !== null && now - nest.hatchAt > NEST_FADE) {
                this.remove(id);
                return;
            }
            this.draw(nest, now);
        });
    }

    private draw(nest: Nest, now: number) {
        const eggSize = nest.size * (nest.kind === "spawn" ? 0.11 : 0.22);
        const since = now - nest.laidAt;
        const hatch = nest.hatchAt === null ? -1 : now - nest.hatchAt;
        for (let i = 0; i < nest.count; i++) {
            const base = nest.basePositions[i];
            // Popping in, one after another.
            const own = (since - (i / Math.max(nest.count, 1)) * nest.layingSeconds) / 0.3;
            let s = own <= 0 ? 0 : own >= 1 ? 1 : 1 + 0.25 * Math.sin(own * Math.PI);
            let roll = 0;
            let lift = 0;
            if (hatch >= 0) {
                // A rock, then split and gone.
                roll = hatch < HATCH_ROCK ? Math.sin(hatch * 22 + i) * 0.35 * (hatch / HATCH_ROCK) : 0;
                if (hatch >= HATCH_ROCK) {
                    const k = Math.min((hatch - HATCH_ROCK) / (HATCH_GONE - HATCH_ROCK), 1);
                    s *= 1 - k;
                    lift = k * eggSize * 0.4;
                }
            }
            this.quaternion.setFromAxisAngle(this.position.set(1, 0, 0.4).normalize(), roll);
            this.position.set(base.x, eggSize * 0.45 + (nest.kind === "nest" ? nest.size * 0.06 : 0) + lift, base.z);
            const size = Math.max(eggSize * s, 0.0001);
            this.matrix.compose(this.position, this.quaternion, this.scale.set(size, size, size));
            nest.eggs.setMatrixAt(i, this.matrix);
        }
        nest.eggs.instanceMatrix.needsUpdate = true;
        // The nest itself fades out once the young are out.
        if (hatch > HATCH_GONE) {
            const k = Math.min((hatch - HATCH_GONE) / (NEST_FADE - HATCH_GONE), 1);
            nest.group.children.forEach((child) => {
                const material = (child as Mesh).material as MeshStandardMaterial;
                material.transparent = true;
                material.opacity = (nest.kind === "spawn" ? 0.72 : 1) * (1 - k);
            });
        }
    }

    private remove(id: string) {
        const nest = this.nests.get(id);
        if (!nest) return;
        this.root.remove(nest.group);
        nest.group.children.forEach((child) => ((child as Mesh).material as MeshStandardMaterial).dispose());
        nest.eggs.dispose();
        this.nests.delete(id);
    }

    /** Every nest gone (the replay is over or skipped: the Ark as it is now). */
    clear() {
        Array.from(this.nests.keys()).forEach((id) => this.remove(id));
    }

    dispose() {
        this.clear();
        this.eggGeometry.dispose();
        this.ringGeometry.dispose();
        this.scrapeGeometry.dispose();
    }
}
