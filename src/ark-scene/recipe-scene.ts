/**
 * What a behaviour recipe shows near the camera (`behaviour-recipes.ts`), drawn only close by: the catch or the
 * nest material it carries (in its beak, mouth or feet, on its chest), the splash, dirt or dust it throws up,
 * the holes, mounds and hollows it leaves (fading), a nest growing (only until the props lane's nests are wired),
 * the ambient fish it chases (a small school that splits round it) and insects it snaps at, and a murmuration's
 * ambient flockmates round the catalogue starlings. Every animal's position is the schedule's (the same far
 * away); this only adds detail.
 *
 * Ambient creatures only: the fish, insects and flockmates here are decoration, never catalogue animals.
 */

import {
    BufferAttribute,
    BufferGeometry,
    Color,
    CylinderGeometry,
    DynamicDrawUsage,
    Euler,
    Group,
    InstancedMesh,
    Matrix4,
    MeshStandardMaterial,
    NormalBlending,
    Points,
    PointsMaterial,
    Quaternion,
    SphereGeometry,
    Vector3
} from "three";
import {MARK_SECONDS, MURMURATION_AMBIENT, murmurationPoint, type RecipeAct, type RecipeMark} from "@/ark-scene/behaviour-recipes";
import {hashString} from "@/ark-scene/world";

export type RecipeActor = {id: string; x: number; y: number; z: number; yaw: number; pitch: number; length: number; height: number; act: RecipeAct};
export type RecipeNest = {id: string; x: number; y: number; z: number; size: number; stage: number; material: string};

const ITEM_KINDS = ["fish", "twig", "grass", "clump", "nut", "stone", "worm", "insect", "shellfish"] as const;
type ItemKind = (typeof ITEM_KINDS)[number];
const ITEM_COLOURS: Record<ItemKind, string> = {fish: "#b9c4cc", twig: "#6e5235", grass: "#c9b46a", clump: "#5e4630", nut: "#7a4e2a", stone: "#8d8a84", worm: "#b97a6f", insect: "#2b2620", shellfish: "#6f5d6e"};
const MATERIAL_ITEM: Record<string, ItemKind> = {twigs: "twig", bark: "twig", reeds: "grass", grass: "grass", mud: "clump", moss: "clump", leaves: "clump", hair: "clump", feathers: "clump", seaweed: "clump", lichen: "clump", saliva: "clump", silk: "clump", sand: "clump", pebbles: "stone", bubbles: "clump"};
const MATERIAL_COLOURS: Record<string, string> = {twigs: "#6e5235", bark: "#6b4a2f", reeds: "#9c9a52", grass: "#c2ad62", mud: "#5c4630", moss: "#5d7040", leaves: "#6a7a3a", hair: "#7b6650", feathers: "#e6e0d4", seaweed: "#4c5a2e", lichen: "#a9b48c", saliva: "#d8cfb8", silk: "#e8e8e0", sand: "#cdb98a", pebbles: "#8d8a84", bubbles: "#e9f2f2"};
const FX_COLOURS: Record<string, string> = {splash: "#eef6f8", spray: "#f2f8fa", bubbles: "#dff0f4", dirt: "#6b5236", dust: "#c9b08a", mud: "#4e3b28", chips: "#d8c49c", sand: "#d9c595"};

const MAX_ITEMS = 48;
const MAX_FISH = 160;
const MAX_MARKS = 96;
const MAX_TWIGS = 600;
const MAX_FLOCK = MURMURATION_AMBIENT * 2;
const MAX_PARTICLES = 900;
const NEST_TWIGS = 44;

/** A small bird in flight: a body and two swept wings, about 1 m across (scaled to a starling's size). */
function chevronGeometry(): BufferGeometry {
    const g = new BufferGeometry();
    // Wings (two triangles) and a thin body: nose along +z.
    const p = [0, 0, 0.5, -0.55, 0.02, -0.15, 0, 0, -0.05, 0, 0, 0.5, 0, 0, -0.05, 0.55, 0.02, -0.15, 0, 0.03, 0.45, 0, -0.03, -0.45, 0.06, 0, 0];
    g.setAttribute("position", new BufferAttribute(new Float32Array(p), 3));
    g.computeVertexNormals();
    return g;
}

type Particle = {x: number; y: number; z: number; vx: number; vy: number; vz: number; born: number; life: number; colour: Color; size: number};

export class RecipeScene {
    readonly root = new Group();
    private readonly items: Record<ItemKind, InstancedMesh>;
    private readonly fish: InstancedMesh;
    private readonly marks: {hole: InstancedMesh; mound: InstancedMesh; hollow: InstancedMesh};
    private readonly twigs: InstancedMesh;
    private readonly flock: InstancedMesh;
    private readonly points: Points;
    private readonly particles: Particle[] = [];
    private readonly emitted = new Map<string, number>();
    private readonly matrix = new Matrix4();
    private readonly quat = new Quaternion();
    private readonly euler = new Euler(0, 0, 0, "YXZ");
    private readonly v = new Vector3();
    private readonly s = new Vector3();
    private readonly colour = new Color();
    /** Where chasers are now (for the reef lane's schools to split round): position and reach. */
    chasers: Array<{x: number; y: number; z: number; r: number}> = [];

    constructor() {
        this.root.name = "ark-recipes";
        const make = (geometry: BufferGeometry, colour: string, count: number, roughness = 0.7) => {
            const mesh = new InstancedMesh(geometry, new MeshStandardMaterial({color: colour, roughness, metalness: 0}), count);
            mesh.instanceMatrix.setUsage(DynamicDrawUsage);
            mesh.count = 0;
            mesh.frustumCulled = false;
            this.root.add(mesh);
            return mesh;
        };
        const sphere = new SphereGeometry(0.5, 10, 6);
        const rod = new CylinderGeometry(0.5, 0.5, 1, 5, 1).rotateX(Math.PI / 2);
        this.items = {
            fish: make(sphere, ITEM_COLOURS.fish, MAX_ITEMS, 0.35),
            twig: make(rod, ITEM_COLOURS.twig, MAX_ITEMS),
            grass: make(rod, ITEM_COLOURS.grass, MAX_ITEMS),
            clump: make(sphere, ITEM_COLOURS.clump, MAX_ITEMS, 0.9),
            nut: make(sphere, ITEM_COLOURS.nut, MAX_ITEMS),
            stone: make(sphere, ITEM_COLOURS.stone, MAX_ITEMS),
            worm: make(rod, ITEM_COLOURS.worm, MAX_ITEMS),
            insect: make(sphere, ITEM_COLOURS.insect, MAX_ITEMS),
            shellfish: make(sphere, ITEM_COLOURS.shellfish, MAX_ITEMS)
        };
        this.fish = make(sphere, "#b8c6cf", MAX_FISH, 0.35);
        const disc = new CylinderGeometry(0.5, 0.5, 0.02, 14, 1);
        const dome = new SphereGeometry(0.5, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2);
        this.marks = {hole: make(disc, "#2a2118", MAX_MARKS, 1), mound: make(dome, "#6a5236", MAX_MARKS, 1), hollow: make(disc, "#8a7556", MAX_MARKS, 1)};
        this.twigs = make(rod, "#6e5235", MAX_TWIGS, 0.95);
        this.flock = make(chevronGeometry(), "#1f2024", MAX_FLOCK, 0.8);
        (this.flock.material as MeshStandardMaterial).side = 2;
        const geometry = new BufferGeometry();
        geometry.setAttribute("position", new BufferAttribute(new Float32Array(MAX_PARTICLES * 3), 3).setUsage(DynamicDrawUsage));
        geometry.setAttribute("color", new BufferAttribute(new Float32Array(MAX_PARTICLES * 3), 3).setUsage(DynamicDrawUsage));
        geometry.setDrawRange(0, 0);
        this.points = new Points(geometry, new PointsMaterial({size: 0.05, vertexColors: true, transparent: true, opacity: 0.85, depthWrite: false, blending: NormalBlending, sizeAttenuation: true}));
        this.points.frustumCulled = false;
        this.root.add(this.points);
    }

    private put(mesh: InstancedMesh, x: number, y: number, z: number, yaw: number, pitch: number, roll: number, sx: number, sy: number, sz: number, colour?: string) {
        const i = mesh.count;
        if (i >= mesh.instanceMatrix.count) return;
        this.euler.set(pitch, yaw, roll);
        this.quat.setFromEuler(this.euler);
        this.matrix.compose(this.v.set(x, y, z), this.quat, this.s.set(sx, sy, sz));
        mesh.setMatrixAt(i, this.matrix);
        if (colour) mesh.setColorAt(i, this.colour.set(colour));
        mesh.count = i + 1;
    }

    /**
     * This frame's actors (animals in a recipe act close by, with where they are drawn), the marks and nests near the
     * camera, the render clock (s) and the world clock (epoch s).
     */
    update(actors: RecipeActor[], marks: RecipeMark[], nests: RecipeNest[], now: number, epoch: number, camera: {x: number; y: number; z: number}) {
        for (const kind of ITEM_KINDS) this.items[kind].count = 0;
        this.fish.count = 0;
        this.twigs.count = 0;
        this.flock.count = 0;
        for (const m of Object.values(this.marks)) m.count = 0;
        this.chasers = [];
        const flocks = new Map<string, NonNullable<RecipeAct["flock"]>>();
        for (const a of actors) {
            const act = a.act;
            const fx = Math.sin(a.yaw);
            const fz = Math.cos(a.yaw);
            if (act.flock) flocks.set(`${act.flock.seed}#${act.flock.t0}`, act.flock);
            // What it carries.
            if (act.carry) {
                const kind: ItemKind = act.carry.item === "material" ? MATERIAL_ITEM[act.carry.material ?? "twigs"] ?? "twig" : act.carry.item === "seed" ? "nut" : act.carry.item === "stick" ? "twig" : (act.carry.item as ItemKind);
                const colour = act.carry.item === "material" ? MATERIAL_COLOURS[act.carry.material ?? "twigs"] : undefined;
                const at = act.carry.at;
                const reach = at === "feet" ? 0.1 : at === "back" || at === "chest" ? 0 : 0.52;
                const up = at === "feet" ? -0.05 : at === "back" ? 1 : at === "chest" ? 0.5 : 0.55;
                const x = a.x + fx * a.length * reach;
                const z = a.z + fz * a.length * reach;
                const y = a.y + a.height * up - Math.sin(a.pitch) * a.length * reach;
                const l = a.length;
                const wiggle = kind === "fish" || kind === "worm" ? Math.sin(now * 14 + hashString(a.id)) * 0.35 : 0;
                if (kind === "fish") this.put(this.items.fish, x, y, z, a.yaw + Math.PI / 2 + wiggle, 0, 0, Math.min(Math.max(l * 0.09, 0.012), 0.12), Math.min(Math.max(l * 0.12, 0.016), 0.16), Math.min(Math.max(l * 0.38, 0.05), 0.6));
                else if (kind === "twig" || kind === "grass") this.put(this.items[kind], x, y, z, a.yaw + Math.PI / 2 + 0.3, 0.2, 0, Math.max(l * 0.025, 0.004), Math.max(l * 0.025, 0.004), Math.min(Math.max(l * 0.7, 0.08), 1.2), colour);
                else if (kind === "worm") this.put(this.items.worm, x, y - l * 0.06, z, a.yaw + wiggle, 1.1, 0, Math.max(l * 0.02, 0.004), Math.max(l * 0.02, 0.004), Math.max(l * 0.35, 0.05));
                else this.put(this.items[kind], x, y, z, a.yaw, 0, 0, Math.max(l * 0.12, 0.015), Math.max(l * 0.1, 0.012), Math.max(l * 0.12, 0.015), colour);
            }
            // The ambient prey round it: a small school that splits round the chaser, or insects in the air.
            if (act.prey && !(act.catch?.ok && act.u > 0.6)) {
                const p = act.prey.at;
                const seed = hashString(`${act.episode}#prey`);
                if (act.prey.kind === "fish" || act.prey.kind === "shellfish") {
                    this.chasers.push({x: a.x, y: a.y, z: a.z, r: Math.max(a.length * 2.5, 0.8)});
                    const count = act.prey.kind === "fish" ? 14 : 5;
                    const size = Math.min(Math.max(a.length * 0.22, 0.05), 0.3);
                    for (let i = 0; i < count; i++) {
                        const angle = (i / count) * Math.PI * 2 + now * (0.6 + (seed % 7) * 0.05) + (i % 3) * 0.4;
                        const ring = size * (2.2 + (i % 4) * 0.8);
                        let x = p.x + Math.cos(angle) * ring;
                        let y = p.y + Math.sin(angle * 2 + i) * size * 1.2;
                        let z = p.z + Math.sin(angle) * ring;
                        // The school splits round the chaser: each fish pushed away from it, more the closer it is.
                        const dx = x - a.x;
                        const dy = y - a.y;
                        const dz = z - a.z;
                        const d = Math.hypot(dx, dy, dz) || 1;
                        const push = Math.max(1.6 * Math.max(a.length, 0.3) - d, 0) / d;
                        x += dx * push;
                        y += dy * push * 0.5;
                        z += dz * push;
                        if (act.prey.kind === "shellfish") y = Math.min(y, p.y);
                        this.put(this.fish, x, y, z, angle + Math.PI, 0, 0, size * 0.25, size * 0.35, size, act.prey.kind === "shellfish" ? "#6f5d6e" : undefined);
                    }
                } else if (act.prey.kind === "insect") {
                    for (let i = 0; i < 6; i++) {
                        const t = now * (2 + i * 0.3) + i;
                        this.put(this.items.insect, p.x + Math.sin(t) * 0.25, p.y + Math.sin(t * 1.7) * 0.15, p.z + Math.cos(t * 1.3) * 0.25, 0, 0, 0, 0.012, 0.012, 0.012);
                    }
                }
            }
            // Splashes, dirt and dust: once at a step's start or end, a stream while it lasts.
            if (act.fx) {
                const f = act.fx;
                const last = this.emitted.get(f.id);
                const due = f.when === "during" ? last === undefined || now - last > 0.12 : last === undefined && (f.when === "start" || act.u > 0.9);
                if (due) {
                    this.emitted.set(f.id, now);
                    const at = f.during ? {x: a.x + fx * a.length * 0.3, y: Math.max(a.y, f.kind === "splash" || f.kind === "spray" ? 0 : a.y), z: a.z + fz * a.length * 0.3} : f.at;
                    this.burst(f.kind, at.x, at.y, at.z, a.length, f.during ? 4 : 18, now, hashString(f.id));
                }
            }
        }
        if (this.emitted.size > 400) {
            const stale: string[] = [];
            this.emitted.forEach((t, k) => {
                if (now - t > 30) stale.push(k);
            });
            for (const k of stale) this.emitted.delete(k);
        }
        // Holes, mounds and hollows: shrinking into the ground over their time.
        for (const m of marks) {
            const left = (m.to - epoch) / MARK_SECONDS;
            if (left <= 0 || epoch < m.from) continue;
            const k = Math.min(left * 1.5, 1);
            const size = m.size * (0.6 + 0.4 * k);
            if (m.kind === "mound" || m.kind === "pit") this.put(this.marks.mound, m.x, m.y - 0.01, m.z, 0, 0, 0, size, size * 0.35 * k, size);
            else this.put(this.marks[m.kind === "hole" ? "hole" : "hollow"], m.x, m.y + 0.004, m.z, 0, 0, 0, size, 1, size);
        }
        // Nests growing (until the props lane's own are wired): twigs laid round a bowl, base first, in build order.
        for (const n of nests) {
            const count = Math.round(NEST_TWIGS * Math.min(Math.max(n.stage, 0), 1));
            const seed = hashString(n.id);
            for (let i = 0; i < count; i++) {
                const f = i / NEST_TWIGS;
                const angle = i * 2.39996 + (seed % 100) * 0.01;
                const r = n.size * (0.25 + 0.75 * Math.min(f * 1.6, 1));
                const y = n.y + n.size * 0.35 * Math.max(f - 0.35, 0);
                this.put(this.twigs, n.x + Math.cos(angle) * r, y, n.z + Math.sin(angle) * r, angle + 1.2 + ((seed >> (i % 16)) & 3) * 0.2, 0.15 - 0.3 * ((i * 7) % 3) * 0.5, 0, n.size * 0.07, n.size * 0.07, n.size * (0.9 + 0.3 * ((i * 13) % 5) / 5), MATERIAL_COLOURS[n.material] ?? MATERIAL_COLOURS.twigs);
            }
        }
        // A murmuration's ambient flockmates, round the catalogue starlings in it (only near enough to see).
        let drawn = 0;
        for (const flock of Array.from(flocks.values())) {
            if (Math.hypot(flock.centre.x - camera.x, flock.centre.z - camera.z) > 260) continue;
            const k = Math.min(Math.min(epoch - flock.t0, flock.t1 - epoch) / 40, 1);
            for (let i = 0; i < MURMURATION_AMBIENT && drawn < MAX_FLOCK; i++, drawn++) {
                const p = murmurationPoint(flock.centre, flock.seed, 1000 + i, epoch);
                const q = murmurationPoint(flock.centre, flock.seed, 1000 + i, epoch + 0.15);
                // In from the roost and back down to it at the window's ends.
                const y = flock.centre.y + (p.y - flock.centre.y) * k;
                const flap = 0.55 + 0.45 * Math.sin(now * 16 + i);
                this.put(this.flock, p.x, y, p.z, Math.atan2(q.x - p.x, q.z - p.z), -Math.atan2(q.y - p.y, Math.hypot(q.x - p.x, q.z - p.z) || 1e-3), Math.sin(now * 0.9 + i) * 0.3, 0.2 * (0.6 + 0.4 * flap), 0.2, 0.2);
            }
        }
        for (const mesh of [...Object.values(this.items), this.fish, this.twigs, this.flock, ...Object.values(this.marks)]) {
            mesh.instanceMatrix.needsUpdate = true;
            if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        }
    }

    private burst(kind: string, x: number, y: number, z: number, length: number, count: number, now: number, seed: number) {
        const colour = new Color(FX_COLOURS[kind] ?? FX_COLOURS.dust);
        const scale = Math.min(Math.max(length, 0.1), 2);
        let s = seed >>> 0 || 1;
        const random = () => {
            s ^= s << 13;
            s ^= s >>> 17;
            s ^= s << 5;
            return ((s >>> 0) % 10007) / 10007;
        };
        for (let i = 0; i < count; i++) {
            if (this.particles.length >= MAX_PARTICLES) this.particles.shift();
            const a = random() * Math.PI * 2;
            const out = (0.4 + random()) * scale;
            const wet = kind === "splash" || kind === "spray";
            const rise = kind === "bubbles" ? 0.3 : wet ? (1.6 + random() * 1.6) * Math.sqrt(scale) : kind === "dust" ? 0.3 + random() * 0.3 : (0.8 + random()) * Math.sqrt(scale);
            this.particles.push({x, y, z, vx: Math.cos(a) * out * (wet ? 0.8 : 0.5), vy: rise, vz: Math.sin(a) * out * (wet ? 0.8 : 0.5), born: now, life: kind === "dust" ? 1.6 : kind === "bubbles" ? 2 : 0.9, colour, size: scale});
        }
    }

    /** Moves the particles (render clock seconds). */
    step(now: number) {
        const position = this.points.geometry.getAttribute("position") as BufferAttribute;
        const color = this.points.geometry.getAttribute("color") as BufferAttribute;
        let n = 0;
        for (let i = this.particles.length - 1; i >= 0; i--) if (now - this.particles[i].born > this.particles[i].life) this.particles.splice(i, 1);
        for (const p of this.particles) {
            const t = now - p.born;
            const fall = p.vy > 0.5 ? 4.9 : 0.4;
            position.setXYZ(n, p.x + p.vx * t, p.y + p.vy * t - fall * t * t, p.z + p.vz * t);
            const fade = 1 - t / p.life;
            color.setXYZ(n, p.colour.r * fade + (1 - fade) * 0.5, p.colour.g * fade + (1 - fade) * 0.5, p.colour.b * fade + (1 - fade) * 0.5);
            n++;
        }
        position.needsUpdate = true;
        color.needsUpdate = true;
        this.points.geometry.setDrawRange(0, n);
        (this.points.material as PointsMaterial).size = 0.06;
    }

    clear() {
        this.particles.length = 0;
        this.emitted.clear();
        for (const mesh of [...Object.values(this.items), this.fish, this.twigs, this.flock, ...Object.values(this.marks)]) mesh.count = 0;
    }

    dispose() {
        for (const mesh of [...Object.values(this.items), this.fish, this.twigs, this.flock, ...Object.values(this.marks)]) {
            mesh.geometry.dispose();
            (mesh.material as MeshStandardMaterial).dispose();
            mesh.dispose();
        }
        this.points.geometry.dispose();
        (this.points.material as PointsMaterial).dispose();
    }
}
