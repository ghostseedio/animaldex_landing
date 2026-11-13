/**
 * The town's library assets in the scene (lane GC): its trees and shrubs (`islands/town/trees.ts`) and its reeds and
 * lily pads (`islands/town/plantings.ts`), each instanced per asset and level of detail, as the wild island's trees are
 * (`asset-trees.ts`): the full tree near the camera, lighter ones further out, the crossed card far away; re-sorted a
 * few times a second as the camera moves, each tier pulling the hand-overs in (the wild island's reach: 1 / 0.45 / 0.3).
 * Every instance keeps its Part B chunk: only drawn chunks' instances are written.
 *
 * The wind is the wild island's (`windMaterial`: the assets' own sway weights, trunk a little, branches more, leaves
 * most, stronger in wind and storms), and the tree round the camera fades beside the lens as there.
 *
 * The camera comes from the render itself (`onBeforeRender` of a probe in the group), in the town's own frame, so the
 * town's `update` keeps its signature. Until every asset's farthest level is loaded, nothing is drawn here and `ready()`
 * is false; the town's procedural stand-ins (`instanced.ts` treeGeometry) are shown meanwhile.
 *
 * Town performance lane: only each asset's farthest level (the crossed card, a plant's lightest level) is read at once,
 * ~0.2 MB for the whole town; the nearer levels (~4.3 MB) are read as the camera comes within `LEVEL_LEAD` m of where an
 * instance takes them (from across the strait, never). Until a level is in, its instances draw the next level out.
 */

import {BufferAttribute, BufferGeometry, Color, Float32BufferAttribute, Group, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, Quaternion, Vector3, type Camera, type Material} from "three";
import {GLTFLoader} from "three/examples/jsm/loaders/GLTFLoader.js";
import {MeshoptDecoder} from "three/examples/jsm/libs/meshopt_decoder.module.js";
import {windMaterial} from "@/ark-scene/asset-trees";
import {ASSETS, ASSET_BASE} from "@/ark-scene/tree-pick";
import {NEAR_FADE_MAX} from "@/ark-scene/near-fade";
import {townChunkOf} from "@/ark-scene/islands/town/chunks";
import {townWeather} from "@/ark-scene/islands/town/render/materials";

const LEVELS = ["lod0", "lod1", "lod2", "card"] as const;
type Level = (typeof LEVELS)[number];

/** One placed asset: its foot (the town's frame), turn and scale; `cull`: past this many metres it is not drawn (small plants). */
export type TownAssetPlacement = {asset: string; x: number; y: number; z: number; rotation: number; scale: number; shade?: number; cull?: number};

type Instance = {x: number; y: number; z: number; scale: number; height: number; radius: number; chunk: number; matrix: Matrix4; tint: Color; cull: number};
type Entry = {instances: Instance[]; meshes: Partial<Record<Level, InstancedMesh>>; near?: InstancedMesh; distances: [number, number, number]; crown: number; height: number; conifer: boolean; doubleSided: Record<string, boolean>};

/** The reach of each tier's hand-overs (the wild island's trees, `index.ts`). */
export const TOWN_ASSET_REACH = {high: 1, medium: 0.45, low: 0.3} as const;
/** The least reach of the far (lod2 → card) hand-over (`asset-trees.ts` CARD_REACH_MIN). */
const CARD_REACH_MIN = 0.45;
/** A nearer level is read once an instance is within its hand-over plus this (m): ahead of the camera coming in. */
export const LEVEL_LEAD = 100;

export class TownAssets {
    readonly group = new Group();
    private readonly byAsset = new Map<string, Entry>();
    private loaded = false;
    private reach = 1;
    private shadows = true;
    private drawn: ((chunk: number) => boolean) | null = null;
    private readonly camera = new Vector3(Infinity, 0, 0);
    private readonly lastAt = new Vector3(Infinity, 0, 0);
    private framesSince = 0;
    private readonly materials: Record<string, Material> = {};
    private onReady: Array<() => void> = [];
    private readonly probe: Mesh;
    private readonly scratch = new Vector3();
    /** The levels asked for (`asset:level`), and those still being read. */
    private readonly asked = new Set<string>();
    private reading = 0;
    private onSettled: Array<() => void> = [];

    constructor(placements: readonly TownAssetPlacement[], base = ASSET_BASE, private readonly label = "town-asset", private readonly materialFor: (doubleSided: boolean, near: boolean, conifer: boolean) => Material = cachedWind) {
        this.group.name = label;
        this.setPlacements(placements);
        // The camera, read as the frame is drawn (the probe is a single empty triangle, never culled).
        const geometry = new BufferGeometry();
        geometry.setAttribute("position", new Float32BufferAttribute([0, -1000, 0, 0, -1000, 0, 0, -1000, 0], 3));
        this.probe = new Mesh(geometry, new MeshBasicMaterial({colorWrite: false, depthWrite: false}));
        this.probe.frustumCulled = false;
        this.probe.name = `${label}:camera-probe`;
        this.probe.onBeforeRender = (_renderer, _scene, camera: Camera) => {
            this.scratch.setFromMatrixPosition(camera.matrixWorld);
            this.group.worldToLocal(this.scratch);
            this.look(this.scratch.x, this.scratch.y, this.scratch.z);
        };
        this.group.add(this.probe);
        void this.load(base.replace(/\/+$/, ""));
    }

    /** Replaces the placements (the zoo's trees when its enclosures change); meshes are kept per asset. */
    setPlacements(placements: readonly TownAssetPlacement[]) {
        const position = new Vector3();
        const rotation = new Quaternion();
        const size = new Vector3();
        const up = new Vector3(0, 1, 0);
        this.byAsset.forEach((entry) => {
            entry.instances = [];
        });
        for (const p of placements) {
            const info = ASSETS[p.asset];
            if (!info) continue;
            let entry = this.byAsset.get(p.asset);
            if (!entry) {
                entry = {instances: [], meshes: {}, distances: info.lod_distances, crown: info.crown_radius, height: info.height, conifer: info.kind === "pine" || info.kind === "spruce" || info.kind === "yew", doubleSided: Object.fromEntries(info.lods.map((l) => [l.level, l.doubleSided]))};
                this.byAsset.set(p.asset, entry);
                if (this.loaded) void this.loadOne(p.asset, entry);
            }
            const shade = p.shade ?? 1;
            entry.instances.push({
                x: p.x, y: p.y, z: p.z, scale: p.scale, height: info.height * p.scale, radius: info.crown_radius * p.scale, chunk: townChunkOf(p.x, p.z),
                matrix: new Matrix4().compose(position.set(p.x, p.y, p.z), rotation.setFromAxisAngle(up, p.rotation), size.setScalar(p.scale)),
                tint: new Color(shade, shade * (0.97 + 0.06 * frac(p.z * 5.3)), shade),
                cull: p.cull ?? Infinity
            });
        }
        // Capacity: an asset with more instances than its meshes hold is rebuilt at the next load of it.
        this.byAsset.forEach((entry, id) => {
            const mesh = entry.meshes.lod0 ?? entry.meshes.lod1 ?? entry.meshes.lod2;
            if (mesh && mesh.instanceMatrix.count < entry.instances.length) void this.grow(id, entry);
        });
        this.lastAt.set(Infinity, 0, 0);
    }

    private loader: GLTFLoader | null = null;
    private base = "";

    private async load(base: string) {
        this.base = base;
        this.loader = new GLTFLoader();
        this.loader.setMeshoptDecoder(MeshoptDecoder);
        const jobs: Array<Promise<void>> = [];
        this.byAsset.forEach((entry, id) => jobs.push(this.loadOne(id, entry)));
        await Promise.all(jobs);
        this.loaded = true;
        this.lastAt.set(Infinity, 0, 0);
        const waiting = this.onReady;
        this.onReady = [];
        for (const f of waiting) f();
    }

    /** An asset's farthest level, read at once (the rest as the camera comes near: `ask`). */
    private async loadOne(id: string, entry: Entry) {
        const info = ASSETS[id];
        if (!info || !this.loader) return;
        const far = info.lods[info.lods.length - 1];
        if (far) await this.loadLevel(id, entry, far.level as Level);
    }

    /** A nearer level wanted by an instance (or soon): read once, then the levels are sorted again. */
    private ask(id: string, entry: Entry, level: Level) {
        const key = `${id}:${level}`;
        if (this.asked.has(key) || !this.loader) return;
        if (!ASSETS[id]?.lods.some((lod) => lod.level === level)) return;
        this.reading++;
        void this.loadLevel(id, entry, level).finally(() => {
            this.reading--;
            this.lastAt.set(Infinity, 0, 0);
            if (this.reading === 0) {
                const waiting = this.onSettled;
                this.onSettled = [];
                for (const f of waiting) f();
            }
        });
    }

    /** The camera (the town's frame), as drawn: the levels sorted for it, and the nearer ones it will want asked for. */
    look(x: number, y: number, z: number) {
        this.camera.set(x, y, z);
        this.update();
    }

    /** The levels asked for so far (`asset:level`), the farthest ones included. */
    levelsAsked(): string[] {
        return Array.from(this.asked);
    }

    /** Resolves once no level asked for is still being read (the workbench's stills wait for it). */
    settled(): Promise<void> {
        return this.reading === 0 ? Promise.resolve() : new Promise((resolve) => this.onSettled.push(resolve));
    }

    private async loadLevel(id: string, entry: Entry, level: Level) {
        const info = ASSETS[id];
        const key = `${id}:${level}`;
        if (!info || !this.loader || this.asked.has(key)) return;
        this.asked.add(key);
        await Promise.all(info.lods.filter((lod) => lod.level === level).map((lod) => this.loader!.loadAsync(`${this.base}/${lod.file}`).then((gltf) => {
            let geometry: BufferGeometry | null = null;
            gltf.scene.traverse((object) => {
                if (!geometry && (object as Mesh).isMesh) geometry = (object as Mesh).geometry as BufferGeometry;
            });
            if (!geometry) return;
            const g = geometry as BufferGeometry;
            // (The flowers' and lily pads' morph targets are their own sway, not drawn instanced.)
            if (Object.keys(g.morphAttributes).length) g.morphAttributes = {};
            // Nothing reads a tree's arrays back (no culling by bounds, no picking): the page's copies go once on the GPU.
            for (const name of Object.keys(g.attributes)) {
                const attribute = g.attributes[name];
                if (attribute instanceof BufferAttribute) attribute.onUpload(releaseArray);
            }
            g.index?.onUpload(releaseArray);
            this.makeMeshes(entry, lod.level as Level, g, lod.doubleSided, id);
        }).catch(() => {})));
    }

    private makeMeshes(entry: Entry, level: Level, geometry: BufferGeometry, doubleSided: boolean, id: string) {
        const capacity = Math.max(entry.instances.length, 1);
        const mesh = new InstancedMesh(geometry, this.materialFor(doubleSided, false, entry.conifer), capacity);
        // (The instance colours exist from the start, so the first program made for a mesh is the one it keeps.)
        mesh.setColorAt(0, WHITE);
        mesh.count = 0;
        mesh.frustumCulled = false;
        mesh.castShadow = level !== "card" && this.shadows;
        mesh.receiveShadow = true;
        mesh.userData.kind = this.label;
        mesh.name = `${this.label}:${id}:${level}`;
        entry.meshes[level] = mesh;
        this.group.add(mesh);
        if (level === "lod0") {
            const near = new InstancedMesh(geometry, this.materialFor(doubleSided, true, entry.conifer), capacity);
            near.setColorAt(0, WHITE);
            near.count = 0;
            near.visible = false;
            near.frustumCulled = false;
            near.castShadow = this.shadows;
            near.receiveShadow = true;
            near.userData.kind = this.label;
            near.name = `${this.label}:${id}:near`;
            entry.near = near;
            this.group.add(near);
        }
    }

    private async grow(id: string, entry: Entry) {
        if (entry.near) {
            this.group.remove(entry.near);
            entry.near.dispose();
            entry.near = undefined;
        }
        for (const level of LEVELS) {
            const mesh = entry.meshes[level];
            if (!mesh) continue;
            this.group.remove(mesh);
            mesh.dispose();
            this.makeMeshes(entry, level, mesh.geometry, entry.doubleSided[level] ?? true, id);
        }
        this.lastAt.set(Infinity, 0, 0);
    }

    /** Every asset loaded (or failed): from then on the assets are drawn. */
    ready(): boolean {
        return this.loaded;
    }

    whenReady(): Promise<void> {
        return this.loaded ? Promise.resolve() : new Promise((resolve) => this.onReady.push(resolve));
    }

    setTier(reach: number, shadows: boolean) {
        this.reach = reach;
        this.shadows = shadows;
        this.byAsset.forEach((entry) => {
            for (const level of LEVELS) {
                const mesh = entry.meshes[level];
                if (mesh) mesh.castShadow = shadows && level !== "card";
            }
            if (entry.near) entry.near.castShadow = shadows;
        });
        this.lastAt.set(Infinity, 0, 0);
    }

    setShadows(on: boolean) {
        this.setTier(this.reach, on);
    }

    /** Part B: which chunks are drawn (null: all). */
    setDrawn(drawn: ((chunk: number) => boolean) | null) {
        this.drawn = drawn;
        this.lastAt.set(Infinity, 0, 0);
    }

    /** Re-sorts the levels for the camera (the town's frame) when it has moved 1.5 m, or every half second. */
    private update() {
        if (!this.loaded) return;
        const camera = this.camera;
        this.framesSince++;
        if (camera.distanceToSquared(this.lastAt) < 2.25 && this.framesSince < 30) return;
        this.framesSince = 0;
        this.lastAt.copy(camera);
        const margin = NEAR_FADE_MAX + 1.6;
        this.byAsset.forEach((entry, id) => {
            const counts: Record<Level, number> = {lod0: 0, lod1: 0, lod2: 0, card: 0};
            let nearCount = 0;
            const [d0, d1] = entry.distances.map((d) => d * this.reach);
            const d2 = entry.distances[2] * Math.max(this.reach, CARD_REACH_MIN);
            for (const instance of entry.instances) {
                if (this.drawn && !this.drawn(instance.chunk)) continue;
                const size = Math.sqrt(Math.max(instance.scale, 1));
                const dist = Math.hypot(instance.x - camera.x, instance.y - camera.y, instance.z - camera.z);
                if (dist > instance.cull * Math.max(this.reach, 0.5)) continue;
                if (entry.near) {
                    const across = Math.hypot(instance.x - camera.x, instance.z - camera.z);
                    const above = camera.y - instance.y;
                    if (across < instance.radius + margin && above < instance.height + margin && above > -margin) {
                        entry.near.setMatrixAt(nearCount, instance.matrix);
                        entry.near.setColorAt(nearCount, instance.tint);
                        nearCount++;
                        continue;
                    }
                }
                const d = dist / size;
                let index = d < d0 ? 0 : d < d1 ? 1 : d < d2 ? 2 : 3;
                // (The levels it takes now and soon, read if they are not yet: from the wanted one out.)
                const lead = (dist - LEVEL_LEAD) / size;
                for (let want = lead < d0 ? 0 : lead < d1 ? 1 : lead < d2 ? 2 : 3; want < LEVELS.length - 1 && !entry.meshes[LEVELS[want]]; want++) this.ask(id, entry, LEVELS[want]);
                while (index < LEVELS.length - 1 && !entry.meshes[LEVELS[index]]) index++;
                // (Plants have no card: their farthest level stands in.)
                while (index > 0 && !entry.meshes[LEVELS[index]]) index--;
                const level = LEVELS[index];
                const mesh = entry.meshes[level];
                if (!mesh) continue;
                mesh.setMatrixAt(counts[level], instance.matrix);
                mesh.setColorAt(counts[level], instance.tint);
                counts[level]++;
            }
            for (const level of LEVELS) {
                const mesh = entry.meshes[level];
                if (!mesh) continue;
                mesh.count = counts[level];
                mesh.visible = counts[level] > 0;
                mesh.instanceMatrix.needsUpdate = true;
                if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
            }
            if (entry.near) {
                entry.near.count = nearCount;
                entry.near.visible = nearCount > 0;
                entry.near.instanceMatrix.needsUpdate = true;
                if (entry.near.instanceColor) entry.near.instanceColor.needsUpdate = true;
            }
        });
    }

    /** Instances per asset (all placed) and how many draw calls the levels in use take now. */
    stats(): {instances: Record<string, number>; drawCalls: number; triangles: number} {
        const instances: Record<string, number> = {};
        let drawCalls = 0;
        let triangles = 0;
        this.byAsset.forEach((entry, id) => {
            instances[id] = entry.instances.length;
            for (const mesh of [...LEVELS.map((l) => entry.meshes[l]), entry.near]) {
                if (!mesh || !mesh.visible || mesh.count === 0) continue;
                drawCalls++;
                const index = mesh.geometry.index;
                triangles += ((index ? index.count : mesh.geometry.getAttribute("position").count) / 3) * mesh.count;
            }
        });
        return {instances, drawCalls, triangles};
    }

    dispose() {
        const geometries = new Set<BufferGeometry>();
        this.byAsset.forEach((entry) => {
            for (const level of LEVELS) {
                const mesh = entry.meshes[level];
                if (!mesh) continue;
                geometries.add(mesh.geometry);
                mesh.dispose();
            }
            entry.near?.dispose();
        });
        geometries.forEach((g) => g.dispose());
        this.probe.geometry.dispose();
        (this.probe.material as Material).dispose();
    }
}

const WHITE = new Color(1, 1, 1);

/** `BufferAttribute.onUpload`: drop the CPU copy once the GPU has it (three's own pattern for static geometry). */
function releaseArray(this: {array: ArrayLike<number>}) {
    this.array = new Float32Array(0);
}

function frac(value: number): number {
    return value - Math.floor(value);
}

/** The wind materials, one per kind of side, fade and needles, shared by every town asset set. */
const windCache = new Map<string, Material>();
function cachedWind(doubleSided: boolean, near: boolean, conifer: boolean): Material {
    const key = `${doubleSided}|${near}|${conifer}`;
    let m = windCache.get(key);
    // (The town's weather on them too, lane GA's kit: rain darkens and glosses the bark and leaves, cloud shade, the lamps.)
    if (!m) windCache.set(key, (m = townWeather(windMaterial(doubleSided, near, conifer), {soak: 0.3})));
    return m;
}
