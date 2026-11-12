/**
 * The wild island as a three.js group (docs/ark/wild-island.md), built for Part B's streaming: the Ark's own ground
 * material and water over the island's ground arrays, tiled by chunk (`streaming/ground-tiles.ts` GroundTiles); the
 * lake's and the river's water at their own levels; the asset library's trees, rocks, plants, logs, reeds, kelp and
 * seagrass instanced and sorted by distance (`asset-rocks.ts` AssetInstances), each instance belonging to its chunk;
 * the coral heads, the cove's floes and the termite mounds as small instanced shapes. Nothing is placed by the camera.
 */

import {BufferAttribute, BufferGeometry, Color, ConeGeometry, CylinderGeometry, DoubleSide, FrontSide, Group, IcosahedronGeometry, InstancedMesh, Matrix4, Mesh, MeshStandardMaterial, Quaternion, Vector3, type ShaderMaterial} from "three";
import manifest from "@/ark-scene/assets-manifest.json";
import {buildLandscape, primeGround} from "@/ark-scene/terrain";
import {GroundTiles} from "@/ark-scene/streaming/ground-tiles";
import {STATE_IN, STATE_OUT} from "@/ark-scene/streaming/chunks";
import {AssetInstances, type AssetPlacement} from "@/ark-scene/asset-rocks";
import {ASSET_BASE} from "@/ark-scene/tree-assets";
import {wildGroundArrays, type WildGround} from "@/ark-scene/islands/wild/render/ground";
import {sceneryCounts, wildScenery, type WildItem} from "@/ark-scene/islands/wild/scenery";
import {wildHeight} from "@/ark-scene/islands/wild/ground";
import {WILD_CHUNK_COUNT, WILD_GRID, WILD_HALF, WILD_SEGMENTS, wildChunkOf, type WildChunkSpan} from "@/ark-scene/islands/wild/frame";

export type WildTier = "high" | "medium" | "low";

/** Per tier: how far each asset level reaches (Part B's share), the plants' share, shadows, the pixel ratio. */
export const WILD_TIERS: Record<WildTier, {reach: number; plants: number; shadows: number; pixelRatio: number}> = {
    high: {reach: 1, plants: 1, shadows: 2048, pixelRatio: 2},
    medium: {reach: 0.7, plants: 0.7, shadows: 1024, pixelRatio: 1.5},
    low: {reach: 0.5, plants: 0.4, shadows: 0, pixelRatio: 1}
};

/** The snow line on the wild island's taller mountains (the Ark ground material's own is 27 m, for today's peaks). */
export const WILD_SNOW_LINE = 52;

type AssetInfo = {kind: string; height: number; lod_distances: [number, number, number]; lods: Array<{level: string; file: string; doubleSided: boolean}>};
const ASSETS = (manifest as unknown as {assets: Record<string, AssetInfo>}).assets;

export type WildIsland = {
    root: Group;
    /** The sea plane (the Ark's water over this island's depth map); the world's own sea may drop it (decision 143). */
    sea: Mesh;
    /**
     * The water's depth field over the island's square, as the Ark's water reads it (RGBA per ground vertex, `size` ×
     * `size` over ±`half` m): r depth/12 m, g reef, b fresh water, a the river's flow.
     */
    depth: {data: Uint8Array; size: number; half: number};
    grid: typeof WILD_GRID;
    spans: WildChunkSpan[];
    content: Uint8Array;
    setDrawn: (drawn: ((chunk: number) => boolean) | null) => void;
    /** Every frame: the camera's position (the assets' levels re-sort as it moves). */
    update: (camera: Vector3) => void;
    setShadows: (on: boolean) => void;
    setTier: (tier: WildTier) => void;
    heightAt: (x: number, z: number) => number;
    ready: () => boolean;
    stats: () => {chunks: number; drawnChunks: number; scenery: Record<string, number>; groundVertices: number};
    dispose: () => void;
};

function plainMaterial(side: typeof FrontSide | typeof DoubleSide, key: string, lift = 1): MeshStandardMaterial {
    const material = new MeshStandardMaterial({vertexColors: true, roughness: 0.88, metalness: 0, side});
    material.customProgramCacheKey = () => `ark-wild-${key}`;
    if (lift !== 1) {
        material.onBeforeCompile = (shader) => {
            shader.fragmentShader = shader.fragmentShader.replace("#include <color_fragment>", `#include <color_fragment>\ndiffuseColor.rgb = diffuseColor.rgb * ${lift.toFixed(2)} + 0.012;`);
        };
    }
    return material;
}

/** The lake's and the river's water: the ground's quads with fresh water over them, at each vertex's own level. */
function freshGeometry(ground: WildGround): BufferGeometry {
    const size = ground.size;
    const positions: number[] = [];
    const level = (i: number) => ground.freshLevels[i];
    for (let row = 0; row < size - 1; row++) {
        for (let column = 0; column < size - 1; column++) {
            const corners = [row * size + column, row * size + column + 1, (row + 1) * size + column + 1, (row + 1) * size + column];
            const levels = corners.map(level);
            if (levels.every((l) => Number.isNaN(l))) continue;
            const top = Math.max(...levels.filter((l) => !Number.isNaN(l)));
            const at = corners.map((i, k) => [ground.positions[i * 3], Number.isNaN(levels[k]) ? top : levels[k], ground.positions[i * 3 + 2]]);
            positions.push(...at[0], ...at[3], ...at[1], ...at[3], ...at[2], ...at[1]);
        }
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
    return geometry;
}

export function buildWildIsland(options: {tier: WildTier; base?: string}): WildIsland {
    const tier = options.tier;
    const root = new Group();
    root.name = "ark-wild-island";
    const ground = wildGroundArrays();
    // The Ark's ground material and water (terrain.ts), from these arrays: a grid of no chunks builds no tiles of its own
    // (its tiles assume today's 240 segments), so the island's tiles are made here on its own 480.
    primeGround(ground);
    const landscape = buildLandscape({originX: -WILD_HALF, originZ: -WILD_HALF, size: WILD_GRID.size, columns: 0, rows: 0, segments: WILD_GRID.segments});
    primeGround(null);
    const material = landscape.groundMaterial;
    const base = material.onBeforeCompile;
    material.onBeforeCompile = (shader, renderer) => {
        base.call(material, shader, renderer);
        shader.fragmentShader = shader.fragmentShader.replace("float snowLine = 27.0 - 12.0 * envSnow;", `float snowLine = ${WILD_SNOW_LINE.toFixed(1)} - 12.0 * envSnow;`);
    };
    material.customProgramCacheKey = () => "ark-ground-3-wild";
    const tiles = new GroundTiles(ground, WILD_GRID, material, WILD_SEGMENTS);
    root.add(tiles.group);
    const water = landscape.water;
    (water.material as ShaderMaterial).uniforms.halfSize.value = WILD_HALF;
    root.add(water);
    const fresh = landscape.ground.getObjectByName("ark-fresh-water") as Mesh | undefined;
    if (fresh) {
        fresh.geometry.dispose();
        fresh.geometry = freshGeometry(ground);
        (fresh.material as ShaderMaterial).uniforms.halfSize.value = WILD_HALF;
        // A clearer, lighter teal than today's small lake: seen from above, the island's bigger lake read as ink.
        (fresh.material as ShaderMaterial).uniforms.lake.value = new Color(0.16, 0.42, 0.36);
        fresh.frustumCulled = false;
        root.add(fresh);
    }

    // Spans and content per chunk.
    const spans: WildChunkSpan[] = Array.from({length: WILD_CHUNK_COUNT}, () => ({minY: Infinity, maxY: -Infinity}));
    const content = new Uint8Array(WILD_CHUNK_COUNT);
    for (let i = 0; i < ground.size * ground.size; i++) {
        const x = ground.positions[i * 3];
        const y = ground.positions[i * 3 + 1];
        const z = ground.positions[i * 3 + 2];
        const key = wildChunkOf(x - 1e-3, z - 1e-3);
        spans[key].minY = Math.min(spans[key].minY, y);
        spans[key].maxY = Math.max(spans[key].maxY, y + 30);
        if (y > -3) content[key] = 1;
    }
    const items = wildScenery();
    for (const item of items) {
        spans[item.chunk].maxY = Math.max(spans[item.chunk].maxY, item.y + item.height);
        content[item.chunk] = 1;
    }

    // The asset library's scenery, by material.
    const assetBase = options.base ?? ASSET_BASE;
    const meanScale = new Map<string, {sum: number; n: number}>();
    for (const item of items) {
        if (!item.asset) continue;
        const m = meanScale.get(item.asset) ?? {sum: 0, n: 0};
        m.sum += item.scale;
        m.n++;
        meanScale.set(item.asset, m);
    }
    /** An asset's levels reach as far as its drawn size asks (a tree drawn at twice its size keeps detail twice as far). */
    const infoFor = (id: string): AssetInfo => {
        const info = ASSETS[id];
        const m = meanScale.get(id);
        const k = m ? Math.max(m.sum / m.n, 0.5) : 1;
        return {...info, lod_distances: info.lod_distances.map((d) => d * k) as [number, number, number], lods: info.lods.filter((l) => l.level !== "card")};
    };
    const placements = (kinds: ReadonlyArray<WildItem["kind"]>, share = 1): AssetPlacement[] => items.filter((it) => it.asset && kinds.includes(it.kind)).filter((it, k) => share >= 1 || ((k * 0.618034) % 1) < share).map((it) => ({id: it.asset!, x: it.x, y: it.y, z: it.z, yaw: it.yaw, scale: it.scale, shade: it.shade, ...(it.up ? {up: it.up} : {})}));
    const sets: AssetInstances[] = [];
    const treeMaterial = {front: plainMaterial(FrontSide, "tree"), double: plainMaterial(DoubleSide, "tree2")};
    sets.push(new AssetInstances(placements(["tree"]), infoFor, treeMaterial, assetBase, "wild-tree"));
    const rockMaterial = plainMaterial(FrontSide, "rock", 1.45);
    sets.push(new AssetInstances(placements(["rock", "cave", "log"]), infoFor, {front: rockMaterial, double: rockMaterial}, assetBase, "wild-rock"));
    const plantShare = WILD_TIERS[tier].plants;
    sets.push(new AssetInstances(placements(["shrub", "plant", "grass", "reed", "lily", "kelp", "seagrass"], plantShare), infoFor, {front: plainMaterial(FrontSide, "plant"), double: plainMaterial(DoubleSide, "plant2")}, assetBase, "wild-plant"));
    for (const set of sets) {
        set.setTier(WILD_TIERS[tier].reach, WILD_TIERS[tier].shadows > 0);
        root.add(set.group);
    }

    // Coral heads, floes and termite mounds: small instanced shapes.
    const shapes: InstancedMesh[] = [];
    const shape = (kind: WildItem["kind"], geometry: BufferGeometry, colours: string[], squash: [number, number, number]) => {
        const list = items.filter((it) => it.kind === kind);
        if (!list.length) return;
        const mesh = new InstancedMesh(geometry, new MeshStandardMaterial({roughness: 0.85, metalness: 0}), list.length);
        const m = new Matrix4();
        const q = new Quaternion();
        const up = new Vector3(0, 1, 0);
        const c = new Color();
        list.forEach((it, k) => {
            m.compose(new Vector3(it.x, it.y, it.z), q.setFromAxisAngle(up, it.yaw), new Vector3(it.scale * squash[0], it.scale * squash[1], it.scale * squash[2]));
            mesh.setMatrixAt(k, m);
            mesh.setColorAt(k, c.set(colours[k % colours.length]).multiplyScalar(it.shade));
        });
        mesh.castShadow = kind === "mound";
        mesh.receiveShadow = true;
        mesh.userData.items = list;
        shapes.push(mesh);
        root.add(mesh);
    };
    shape("coral", new IcosahedronGeometry(0.5, 1), ["#e0806c", "#d9a35b", "#c76d8e", "#e6c56a", "#9ab86a", "#d48a5a"], [1, 0.62, 1]);
    shape("floe", new CylinderGeometry(1, 1.1, 0.35, 7), ["#f4f8fa", "#e6eef3"], [1, 1, 0.75]);
    shape("mound", new ConeGeometry(0.75, 2.4, 7).translate(0, 1.2, 0), ["#a2724a", "#9a6a44"], [1, 1, 1]);

    let drawn: ((chunk: number) => boolean) | null = null;
    let settled = false;
    const states = new Uint8Array(WILD_CHUNK_COUNT).fill(STATE_IN);
    const applyDrawn = () => {
        for (let k = 0; k < WILD_CHUNK_COUNT; k++) states[k] = !drawn || drawn(k) ? STATE_IN : STATE_OUT;
        tiles.apply(states, performance.now() / 1000);
        for (const set of sets) set.setDrawn(drawn ? (x, z) => drawn!(wildChunkOf(x, z)) : null);
        for (const mesh of shapes) mesh.visible = true;
    };

    return {
        root,
        sea: water,
        depth: {data: ground.depth, size: ground.size, half: WILD_HALF},
        grid: WILD_GRID,
        spans,
        content,
        setDrawn: (next) => {
            drawn = next;
            applyDrawn();
        },
        update: (camera) => {
            // The library's flowers and lily pads carry morph targets (their own sway) that instancing does not draw: dropped
            // as each loads.
            if (!settled) {
                settled = sets.every((set) => set.ready);
                for (const set of sets) {
                    for (const child of set.group.children) {
                        const geometry = (child as Mesh).geometry;
                        if (geometry && Object.keys(geometry.morphAttributes).length) geometry.morphAttributes = {};
                    }
                }
            }
            for (const set of sets) set.update(camera);
            tiles.release(performance.now() / 1000);
        },
        setShadows: (on) => {
            for (const set of sets) set.setTier(WILD_TIERS[tier].reach, on);
        },
        setTier: (next) => {
            for (const set of sets) set.setTier(WILD_TIERS[next].reach, WILD_TIERS[next].shadows > 0);
        },
        heightAt: wildHeight,
        ready: () => sets.every((set) => set.ready),
        stats: () => ({chunks: WILD_CHUNK_COUNT, drawnChunks: drawn ? Array.from({length: WILD_CHUNK_COUNT}, (_, k) => k).filter((k) => drawn!(k)).length : WILD_CHUNK_COUNT, scenery: sceneryCounts(), groundVertices: ground.size * ground.size}),
        dispose: () => {
            tiles.dispose();
            landscape.dispose();
            for (const set of sets) set.dispose();
            for (const mesh of shapes) {
                mesh.geometry.dispose();
                (mesh.material as MeshStandardMaterial).dispose();
            }
        }
    };
}
