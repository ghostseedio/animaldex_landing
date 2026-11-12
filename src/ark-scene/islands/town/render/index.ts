/**
 * The town, countryside and zoo island as a three.js group (docs/ark/town-island.md), built for Part B's streaming:
 * every chunk of the 9 × 9 grid is its own group (its ground tile and its merged decal, solid, glass and net meshes),
 * the instanced trees and props keep their chunks, and `setDrawn` takes the streamer's answer for which chunks are
 * drawn. Nothing is placed by the camera: every position is a pure function of the plan and the island clock.
 *
 * `update(clock)` moves what implied people move (once an island minute): lit windows, cars, bins, washing, boats,
 * the market's stalls, the street lamps, the church clock's hands.
 */

import {BufferAttribute, BufferGeometry, Color, DoubleSide, Group, InstancedMesh, Matrix4, Mesh, MeshStandardMaterial, type Material, type WebGLRenderer} from "three";
import {hashText, local, rng} from "@/ark-scene/islands/town/geom";
import {sampleTownGround, TOWN_SURFACES, townSurfaceWeights, type TownSurface} from "@/ark-scene/islands/town/ground";
import {TOWN_HALF, TOWN_SEGMENTS, townPlan, type TownPlan} from "@/ark-scene/islands/town/plan";
import {TOWN_CHUNK_COUNT, TOWN_GRID, townChunkOf, type TownChunkSpan} from "@/ark-scene/islands/town/chunks";
import {binSpots, carSpots, launchEnclosures, zooLayout} from "@/ark-scene/islands/town/areas";
import {binsOut, boatIn, CAR_COLOURS, carAt, clockHands, lampsOn, marketDay, washingOut, windowLit, type TownClock} from "@/ark-scene/islands/town/people";
import {buildBuilding, clockFaces, type BuildingChunk, type WindowRecord} from "@/ark-scene/islands/town/render/buildings";
import {buildScenery, buildZooScenery, type SceneryOut} from "@/ark-scene/islands/town/render/scenery";
import {binGeometry, boatGeometry, carGeometry, narrowboatGeometry, NARROWBOAT_LIVERIES, ChunkedSet, placeMatrix, propMaterial, stallGeometry, treeGeometry, washingGeometry} from "@/ark-scene/islands/town/render/instanced";
import {lampGlow, lampMapTexture, lightsGeometry, lightsMaterial} from "@/ark-scene/islands/town/render/furniture";
import {buildTownNear} from "@/ark-scene/islands/town/render/near";
import {buildTownWater, seaDepthMap, type TownWater} from "@/ark-scene/islands/town/render/water";
import {Geo, tone} from "@/ark-scene/islands/town/render/kit";
import {TOWN_ASSET_REACH, TownAssets, type TownAssetPlacement} from "@/ark-scene/islands/town/render/assets";
import {foliageMaterial, townPlantings} from "@/ark-scene/islands/town/render/nature";
import {primeTownTrees, townTrees, townZooTrees, type TownTree} from "@/ark-scene/islands/town/trees";
import {townGroundMaterial, townPavingMaterial} from "@/ark-scene/islands/town/render/surfaces";
import {townWeather, TOWN_LIGHT} from "@/ark-scene/islands/town/render/materials";
import {loadTownTextures} from "@/ark-scene/islands/town/render/textures";

export type TownTier = "high" | "medium" | "low";

/**
 * Per tier: the share of small props drawn, how far the trees' detail reaches (lane GC: every tree is drawn on every
 * tier, as it carries perches and a collider; the tier pulls its levels of detail in instead), shadows. (The render
 * distance is Part B's.)
 */
export const TOWN_TIERS: Record<TownTier, {trees: number; reach: number; props: number; shadows: number; pixelRatio: number; /** The paving's normal maps and close-up grain (lane GA). */ paveNormals: boolean; anisotropy: number}> = {
    high: {trees: 1, reach: TOWN_ASSET_REACH.high, props: 1, shadows: 2048, pixelRatio: 2, paveNormals: true, anisotropy: 8},
    medium: {trees: 1, reach: TOWN_ASSET_REACH.medium, props: 1, shadows: 1024, pixelRatio: 1.5, paveNormals: true, anisotropy: 4},
    low: {trees: 1, reach: TOWN_ASSET_REACH.low, props: 0.5, shadows: 0, pixelRatio: 1, paveNormals: false, anisotropy: 4}
};

/** The close-up detail's share per tier (as the wild island's near detail: 1 / 0.6 / 0.35). */
const NEAR_SHARE: Record<TownTier, number> = {high: 1, medium: 0.6, low: 0.35};

export type TownIsland = {
    root: Group;
    /** Part B: the grid, each chunk's vertical reach, which chunks hold content. */
    grid: typeof TOWN_GRID;
    spans: TownChunkSpan[];
    content: Uint8Array;
    /** Part B's streamer says which chunks are drawn (null: all). */
    setDrawn: (drawn: ((chunk: number) => boolean) | null) => void;
    /**
     * The open zoo enclosures (the snapshot's `enclosure` names, `areas.ts` enclosuresIn): each drawn on its plot,
     * every other plot landscaped. Rebuilds only the zoo's meshes; call when the set changes.
     */
    setZooOpen: (enclosures: readonly string[]) => void;
    /** The people-implied things and the clocks, on the island clock (call every frame; work happens once a minute). */
    update: (clock: TownClock) => void;
    setShadows: (on: boolean) => void;
    setTier: (tier: TownTier) => void;
    heightAt: (x: number, z: number) => number;
    /** Resolves once the library's trees, shrubs and reeds are loaded and drawn (the procedural stand-ins until then). */
    assetsReady: () => Promise<void>;
    stats: () => {chunks: number; drawnChunks: number; triangles: number; drawCalls: number; instances: Record<string, number>; windows: number; litWindows: number; zooOpen: number};
    dispose: () => void;
};

// MARK: - Ground colours

const SURFACE_COLOUR: Record<TownSurface, string> = {
    sea: "#b5a37c",
    sand: "#d8c69c",
    shore: "#97a466",
    grass: "#7c9c52",
    lawn: "#6c9a46",
    park: "#71a04a",
    meadow: "#8da858",
    wood: "#56763a",
    field: "#8a9a58",
    orchard: "#7c9e4e",
    paddock: "#86a454",
    farmyard: "#9b8a66",
    zoo: "#76a04c",
    allotment: "#6f8a48",
    churchyard: "#6a9448",
    square: "#a39a8b",
    bank: "#6c8a4c",
    water: "#5a6446"
};

export type GroundGrid = {size: number; heights: Float32Array; colours: Float32Array; /** 8 bytes a vertex: what the ground shows of its texture layers (`ground.ts` townSurfaceWeights). */ surfaces: Uint8Array};

/** The ground's heights and colours at every vertex of the 1.1 m grid (433 × 433). */
export function groundGrid(): GroundGrid {
    const size = TOWN_SEGMENTS + 1;
    const step = (TOWN_HALF * 2) / TOWN_SEGMENTS;
    const heights = new Float32Array(size * size);
    const colours = new Float32Array(size * size * 3);
    const surfaceIndex = new Uint8Array(size * size);
    // (Each surface's colour parsed once, not at every vertex: the same numbers.)
    const parsed = new Map<TownSurface, Color>();
    for (let row = 0; row < size; row++) {
        const z = -TOWN_HALF + row * step;
        for (let column = 0; column < size; column++) {
            const x = -TOWN_HALF + column * step;
            const g = sampleTownGround(x, z);
            const i = row * size + column;
            heights[i] = g.height;
            let c = parsed.get(g.surface);
            if (!c) parsed.set(g.surface, (c = new Color().set(SURFACE_COLOUR[g.surface])));
            surfaceIndex[i] = Math.max(TOWN_SURFACES.indexOf(g.surface), 0);
            // Mottling, and the sea floor darker with depth. (Lane GA: no per-vertex random shade any more; each
            // vertex's own made a 1.1 m speckle. The textures carry the grain.)
            const n = 0.9 + 0.2 * (Math.sin(x * 0.37 + z * 0.11) * 0.5 + Math.sin(x * 0.07 - z * 0.23) * 0.5) * 0.5;
            const deep = g.height < 0 ? Math.max(0.45, 1 + g.height * 0.05) : 1;
            colours[i * 3] = c.r * n * deep;
            colours[i * 3 + 1] = c.g * n * deep;
            colours[i * 3 + 2] = c.b * n * deep;
        }
    }
    return {size, heights, colours, surfaces: townSurfaceWeights(size, surfaceIndex)};
}

/** One chunk's ground tile: the grid's vertices inside the chunk (shared edges), indexed, with normals from the whole grid. */
function groundTile(grid: GroundGrid, key: number): BufferGeometry | null {
    const per = TOWN_GRID.segments;
    const col0 = (key % TOWN_GRID.columns) * per;
    const row0 = Math.floor(key / TOWN_GRID.columns) * per;
    const n = per + 1;
    const step = (TOWN_HALF * 2) / TOWN_SEGMENTS;
    const positions = new Float32Array(n * n * 3);
    const normals = new Float32Array(n * n * 3);
    const colours = new Float32Array(n * n * 3);
    const surf = new Uint8Array(n * n * 4);
    const surf2 = new Uint8Array(n * n * 4);
    let highest = -Infinity;
    for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
            const row = row0 + r;
            const column = col0 + c;
            const i = row * grid.size + column;
            const j = r * n + c;
            const h = grid.heights[i];
            highest = Math.max(highest, h);
            positions[j * 3] = -TOWN_HALF + column * step;
            positions[j * 3 + 1] = h;
            positions[j * 3 + 2] = -TOWN_HALF + row * step;
            const left = grid.heights[row * grid.size + Math.max(column - 1, 0)];
            const right = grid.heights[row * grid.size + Math.min(column + 1, grid.size - 1)];
            const up = grid.heights[Math.max(row - 1, 0) * grid.size + column];
            const down = grid.heights[Math.min(row + 1, grid.size - 1) * grid.size + column];
            const nx = left - right;
            const nz = up - down;
            const ny = 2 * step;
            const l = Math.hypot(nx, ny, nz);
            normals[j * 3] = nx / l;
            normals[j * 3 + 1] = ny / l;
            normals[j * 3 + 2] = nz / l;
            colours[j * 3] = grid.colours[i * 3];
            colours[j * 3 + 1] = grid.colours[i * 3 + 1];
            colours[j * 3 + 2] = grid.colours[i * 3 + 2];
            for (let k = 0; k < 4; k++) {
                surf[j * 4 + k] = grid.surfaces[i * 8 + k];
                surf2[j * 4 + k] = grid.surfaces[i * 8 + 4 + k];
            }
        }
    }
    // Deep sea only: no tile (the water's own depth colour covers it).
    if (highest < -11) return null;
    const index: number[] = [];
    for (let r = 0; r < per; r++) {
        for (let c = 0; c < per; c++) {
            const a = r * n + c;
            const b = a + 1;
            const d = a + n;
            const e = d + 1;
            index.push(a, d, b, b, d, e);
        }
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(positions, 3));
    geometry.setAttribute("normal", new BufferAttribute(normals, 3));
    geometry.setAttribute("color", new BufferAttribute(colours, 3));
    geometry.setAttribute("aTownSurf", new BufferAttribute(surf, 4, true));
    geometry.setAttribute("aTownSurf2", new BufferAttribute(surf2, 4, true));
    geometry.setIndex(index);
    geometry.computeBoundingSphere();
    return geometry;
}

// MARK: - Materials

function glassMaterial(): MeshStandardMaterial {
    const material = new MeshStandardMaterial({vertexColors: true, roughness: 0.12, metalness: 0.35});
    material.onBeforeCompile = (shader) => {
        shader.vertexShader = shader.vertexShader.replace("#include <common>", "#include <common>\nattribute float aLit;\nvarying float vLit;").replace("#include <begin_vertex>", "#include <begin_vertex>\nvLit = aLit;");
        shader.fragmentShader = shader.fragmentShader
            .replace("#include <common>", "#include <common>\nvarying float vLit;")
            .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\ntotalEmissiveRadiance += vec3(1.0, 0.72, 0.4) * vLit * 3.2;\ndiffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0, 0.8, 0.55), vLit * 0.6);");
    };
    return material;
}

/**
 * The zoo's mesh, netting and clear panels (lane GC, `render/zoo-barriers.ts`; the net channel's `aTag`: 0 welded mesh
 * on a 5 cm grid, 1 an aviary's fine stainless netting on 2.5 cm, 2 clear glass). The wires are drawn at their real
 * thickness in the plane's own coordinates and anti-aliased by their screen size, so close up they are wires and far
 * away the mesh becomes the faint veil of its coverage: what is behind (the birds in an aviary) is seen through it.
 */
function netMaterial(): MeshStandardMaterial {
    const material = new MeshStandardMaterial({vertexColors: true, roughness: 0.55, metalness: 0.35, transparent: true, side: DoubleSide, depthWrite: false});
    material.customProgramCacheKey = () => "town-net-2";
    material.onBeforeCompile = (shader) => {
        shader.vertexShader = shader.vertexShader
            .replace("#include <common>", "#include <common>\nattribute float aTag;\nvarying vec3 vNetWorld;\nvarying vec3 vNetNormal;\nvarying float vNetKind;")
            .replace("#include <worldpos_vertex>", "#include <worldpos_vertex>\nvNetWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvNetNormal = normalize(mat3(modelMatrix) * objectNormal);\nvNetKind = aTag;");
        shader.fragmentShader = shader.fragmentShader
            .replace("#include <common>", "#include <common>\nvarying vec3 vNetWorld;\nvarying vec3 vNetNormal;\nvarying float vNetKind;")
            .replace(
                "#include <alphatest_fragment>",
                `{
    if (vNetKind > 1.5) {
        // Clear glass: a faint tint, brighter at a grazing angle.
        float facing = abs(dot(normalize(vNetNormal), normalize(cameraPosition - vNetWorld)));
        diffuseColor.a = mix(0.42, 0.1, facing);
    } else {
        vec3 n = normalize(vNetNormal);
        vec3 t = abs(n.y) > 0.8 ? vec3(1.0, 0.0, 0.0) : normalize(cross(vec3(0.0, 1.0, 0.0), n));
        vec3 b = cross(n, t);
        float cells = vNetKind > 0.5 ? 40.0 : 20.0;
        float thick = vNetKind > 0.5 ? 0.06 : 0.08;
        vec2 uv = vec2(dot(vNetWorld, t), dot(vNetWorld, b)) * cells;
        vec2 d = abs(fract(uv) - 0.5);
        vec2 w = max(fwidth(uv), vec2(1e-4));
        vec2 wire = 1.0 - smoothstep(vec2(thick * 0.5) - w, vec2(thick * 0.5) + w, 0.5 - d);
        float near = max(wire.x, wire.y);
        float cover = 1.0 - (1.0 - thick) * (1.0 - thick);
        // Far away (a wire under a pixel): its coverage, a faint veil.
        float far = smoothstep(0.25, 0.7, max(w.x, w.y));
        diffuseColor.a = mix(near * 0.95, cover * 1.6 + 0.04, far);
    }
}
#include <alphatest_fragment>`
            );
    };
    return townWeather(material, {soak: 0, cloud: false});
}

// MARK: - Building it

type ChunkMeshes = {group: Group; meshes: Mesh[]; glass: {attribute: BufferAttribute; windows: WindowRecord[]} | null};

/**
 * The town's heavy, pure part (decision 153: built in the town's prebuild worker, off the page's main thread): the
 * ground's grid, the scenery with every building in its chunk, and the zoo's scenery for the open enclosures.
 */
export type TownBuildData = {grid: GroundGrid; scenery: SceneryOut; perChunk: Map<number, BuildingChunk>; zoo: SceneryOut; zooOpen: string[]; /** The trees as settled (lane GC). */ trees: TownTree[]};

export function townBuildData(zooOpen: readonly string[] = launchEnclosures(), steps?: Record<string, number>): TownBuildData {
    const plan = townPlan();
    // (`steps`: each part's time (ms), for the worker's measurements.)
    let mark = performance.now();
    const took = (name: string) => {
        if (!steps) return;
        const now = performance.now();
        steps[name] = Math.round(now - mark);
        mark = now;
    };
    const grid = groundGrid();
    took("ground");
    const scenery = buildScenery(plan);
    took("scenery");
    const perChunk = new Map<number, BuildingChunk>();
    for (const b of plan.buildings) {
        const key = townChunkOf(b.at.x, b.at.z);
        let c = perChunk.get(key);
        if (!c) {
            const sc = scenery.chunks.get(key);
            c = {solid: sc?.solid ?? new Geo(), glass: sc?.glass ?? new Geo(), windows: []};
            perChunk.set(key, c);
        }
        buildBuilding(c, b);
    }
    took("buildings");
    const zoo = buildZooScenery(zooLayout(zooOpen, plan));
    took("zoo");
    return {grid, scenery, perChunk, zoo, zooOpen: [...zooOpen], trees: townTrees(plan)};
}

export function buildTownIsland(options: {tier?: TownTier; zooOpen?: readonly string[]; built?: TownBuildData; assetBase?: string} = {}): TownIsland {
    const steps = townIslandSteps(options);
    for (;;) {
        const next = steps.next();
        if (next.done) return next.value;
    }
}

/**
 * The town's build as steps (decision 153): each yield is a point the page may draw a frame at, so a caller can spread
 * the build over idle slices (`islands/scene.ts`); `buildTownIsland` runs them all at once, exactly as before.
 * `built`: the heavy part already worked out (the prebuild worker's `townBuildData`).
 */
export function* townIslandSteps(options: {tier?: TownTier; zooOpen?: readonly string[]; built?: TownBuildData; /** The asset library's base (`ArkMountOptions.assetBase`). */ assetBase?: string} = {}): Generator<void, TownIsland> {
    const plan = townPlan();
    let tier: TownTier = options.tier ?? "high";
    const root = new Group();
    root.name = "island:town";
    const built = options.built ?? null;
    if (built?.trees) primeTownTrees(plan, built.trees);
    const grid = built?.grid ?? groundGrid();
    yield;
    // (Lane GA: the ground and the paving are tiled PBR, `surfaces.ts`; the solids, props and trees answer the rain,
    // the cloud shade and the street lamps through the town's kit, `materials.ts`.)
    const materials = {ground: townGroundMaterial(), decal: townPavingMaterial(), solid: townWeather(new MeshStandardMaterial({vertexColors: true, roughness: 0.84, metalness: 0}), {soak: 0.35}), glass: glassMaterial(), net: netMaterial(), prop: townWeather(propMaterial(), {soak: 0.1, wetRoughness: 0.2}), tree: townWeather(new MeshStandardMaterial({vertexColors: true, roughness: 0.9}), {soak: 0.3, wetRoughness: 0.45}), foliage: foliageMaterial()};

    // Scenery and buildings, chunk by chunk (worked out already when `built` is given).
    const scenery = built?.scenery ?? buildScenery(plan);
    if (!built) yield;
    const chunks: Array<ChunkMeshes | null> = new Array(TOWN_CHUNK_COUNT).fill(null);
    const perChunk = built?.perChunk ?? new Map<number, BuildingChunk>();
    if (!built) {
        for (const b of plan.buildings) {
            const key = townChunkOf(b.at.x, b.at.z);
            let c = perChunk.get(key);
            if (!c) {
                const sc = scenery.chunks.get(key);
                c = {solid: sc?.solid ?? new Geo(), glass: sc?.glass ?? new Geo(), windows: []};
                perChunk.set(key, c);
            }
            buildBuilding(c, b);
        }
        yield;
    }
    const content = new Uint8Array(TOWN_CHUNK_COUNT);
    const spans: TownChunkSpan[] = [];
    let triangles = 0;
    // The paving textures load when the town is first drawn (the renderer is known then), for the tier's needs.
    let seenRenderer: WebGLRenderer | null = null;
    const askTextures = (renderer: WebGLRenderer) => {
        if (seenRenderer) return;
        seenRenderer = renderer;
        loadTownTextures(renderer, {normals: TOWN_TIERS[tier].paveNormals, anisotropy: TOWN_TIERS[tier].anisotropy});
    };
    for (let key = 0; key < TOWN_CHUNK_COUNT; key++) {
        const group = new Group();
        group.name = `town:chunk:${key}`;
        const meshes: Mesh[] = [];
        const tile = groundTile(grid, key);
        let minY = 0;
        let maxY = 0;
        if (tile) {
            const mesh = new Mesh(tile, materials.ground);
            mesh.receiveShadow = true;
            mesh.name = "ground";
            mesh.onBeforeRender = (renderer) => askTextures(renderer);
            meshes.push(mesh);
            tile.computeBoundingBox();
            minY = Math.min(minY, tile.boundingBox!.min.y);
            maxY = Math.max(maxY, tile.boundingBox!.max.y);
            if (tile.boundingBox!.max.y > 0.2) content[key] = 1;
            triangles += tile.index!.count / 3;
        }
        const sc = scenery.chunks.get(key);
        const bc = perChunk.get(key);
        let glass: ChunkMeshes["glass"] = null;
        const add = (geo: Geo | undefined, material: Material, name: string, shadows: boolean, extra = false) => {
            if (!geo || geo.triangles === 0) return null;
            const geometry = geo.toGeometry(extra);
            const mesh = new Mesh(geometry, material);
            mesh.name = name;
            mesh.castShadow = shadows;
            mesh.receiveShadow = true;
            meshes.push(mesh);
            triangles += geo.triangles;
            content[key] = 1;
            geometry.computeBoundingBox();
            maxY = Math.max(maxY, geometry.boundingBox!.max.y);
            return geometry;
        };
        // (Decals carry their surface tag: `surface-tags.ts`, lane GA.)
        add(sc?.decal, materials.decal, "decal", false, true);
        add(bc?.solid ?? sc?.solid, materials.solid, "solid", true);
        add(sc?.net, materials.net, "net", false, true);
        // Hedges, flower beds and crops (lane GC, `render/nature.ts`): their sway weight rides in `aTag`. Nothing reads
        // their arrays back, so the page's copies go once they are on the GPU (phone heap).
        const foliage = add(sc?.foliage, materials.foliage, "foliage", true, true);
        if (foliage) for (const name of Object.keys(foliage.attributes)) foliage.attributes[name].onUpload(releaseArray);
        const glassGeo = bc?.glass ?? sc?.glass;
        if (glassGeo && glassGeo.triangles > 0) {
            const geometry = glassGeo.toGeometry();
            const lit = new BufferAttribute(new Float32Array(glassGeo.pos.length / 3), 1);
            geometry.setAttribute("aLit", lit);
            const mesh = new Mesh(geometry, materials.glass);
            mesh.name = "glass";
            meshes.push(mesh);
            triangles += glassGeo.triangles;
            glass = {attribute: lit, windows: bc?.windows ?? []};
        }
        for (const mesh of meshes) group.add(mesh);
        spans.push({minY: Math.min(minY, -4), maxY: maxY + 6});
        if (meshes.length) {
            root.add(group);
            chunks[key] = {group, meshes, glass};
        }
        // (Lane GC, phone heap: the chunk's arrays are in its meshes now; the worker's copies are let go.)
        scenery.chunks.delete(key);
        perChunk.delete(key);
        yield;
    }

    let drawn: ((chunk: number) => boolean) | null = null;
    yield;
    // Water: the sea round the island and in the harbour, the fresh water.
    const depth = seaDepthMap(grid.heights, grid.size);
    const water: TownWater = buildTownWater(depth, scenery.fresh.triangles ? scenery.fresh.toGeometry() : null);
    root.add(water.sea);
    if (water.fresh) root.add(water.fresh);
    if (!water.fresh) throw new Error("the town's fresh water is missing");

    // The zoo: its own meshes, rebuilt when enclosures open.
    const zooRoot = new Group();
    zooRoot.name = "town:zoo";
    root.add(zooRoot);
    let zooMeshes: Array<{key: number; mesh: Mesh}> = [];
    let zooOpenNow: readonly string[] = options.zooOpen ?? launchEnclosures();
    let assetsMade = false;
    const buildZoo = (open: readonly string[]) => {
        for (const {mesh} of zooMeshes) {
            mesh.geometry.dispose();
            zooRoot.remove(mesh);
        }
        zooMeshes = [];
        // (The prebuild's zoo scenery when it was worked out for these very enclosures.)
        const zoo = built && built.zooOpen.join(",") === open.join(",") ? built.zoo : buildZooScenery(zooLayout(open, plan));
        if (assetsMade) assets.setPlacements([...planTrees, ...zooTreesFor(open)]);
        zoo.chunks.forEach((c, key) => {
            const parts: Array<[Geo, Material, string]> = [[c.decal, materials.decal, "decal"], [c.solid, materials.solid, "solid"], [c.glass, materials.glass, "glass"], [c.net, materials.net, "net"], ...(c.foliage ? [[c.foliage, materials.foliage, "foliage"] as [Geo, Material, string]] : [])];
            for (const [geo, material, name] of parts) {
                if (!geo.triangles) continue;
                const geometry = geo.toGeometry(name === "decal" || name === "foliage" || name === "net");
                if (name === "glass") geometry.setAttribute("aLit", new BufferAttribute(new Float32Array(geo.pos.length / 3), 1));
                const mesh = new Mesh(geometry, material);
                mesh.name = `zoo:${name}`;
                mesh.castShadow = name === "solid" || name === "foliage";
                mesh.receiveShadow = true;
                mesh.visible = !drawn || drawn(key);
                zooRoot.add(mesh);
                zooMeshes.push({key, mesh});
            }
        });
        if (zoo.fresh.triangles && water.fresh) {
            const mesh = new Mesh(zoo.fresh.toGeometry(), water.fresh.material as Material);
            mesh.name = "zoo:pools";
            mesh.renderOrder = 2;
            zooRoot.add(mesh);
            zooMeshes.push({key: -1, mesh});
        }
    };

    yield;
    // Trees and shrubs (lane GC): the asset library's, settled by L6's spacing (`trees.ts`), instanced per asset and level
    // of detail (`render/assets.ts`); the zoo's own with its enclosures. Until they load, the procedural stand-ins.
    const placementOf = (t: TownTree): TownAssetPlacement => ({asset: t.asset, x: t.x, y: t.y, z: t.z, rotation: t.rotation, scale: t.scale, shade: 0.9 + 0.2 * (((t.seed >>> 5) % 1000) / 1000)});
    // (With them, the millpond's and the farm pond's reeds and lily pads, `render/nature.ts`.)
    const planTrees = [...townTrees(plan).map(placementOf), ...townPlantings(plan)];
    const zooTreesFor = (open: readonly string[]) => townZooTrees(zooLayout(open, plan), plan).map(placementOf);
    const assets = new TownAssets([...planTrees, ...zooTreesFor(options.zooOpen ?? launchEnclosures())], options.assetBase, "town:trees");
    assets.setTier(TOWN_TIERS[tier].reach, TOWN_TIERS[tier].shadows > 0);
    root.add(assets.group);
    const treeSets = new Map<string, ChunkedSet>();
    const byKind = new Map<string, TownTree[]>();
    for (const t of townTrees(plan)) {
        const list = byKind.get(t.kind) ?? [];
        list.push(t);
        byKind.set(t.kind, list);
    }
    byKind.forEach((list, kind) => {
        const set = new ChunkedSet(treeGeometry(kind), materials.tree, list.length);
        set.mesh.castShadow = true;
        set.mesh.receiveShadow = true;
        set.mesh.name = `trees:${kind}`;
        // (The stand-in drawn at the settled tree's height: the procedural shapes are about 11 m at scale 1.)
        list.forEach((t, i) => set.set(i, placeMatrix(t.x, t.y, t.z, t.rotation, t.height / standInHeight(kind))));
        set.write();
        treeSets.set(kind, set);
        root.add(set.mesh);
    });
    const assetsReady = assets.whenReady().then(() => {
        treeSets.forEach((set) => {
            root.remove(set.mesh);
            set.dispose();
        });
        treeSets.clear();
    });

    yield;
    // People-implied props.
    const cars = carSpots(plan);
    const bins = binSpots(plan);
    const washingLines = plan.parcels.filter((p) => (p.kind === "house" || p.kind === "terrace_home") && p.back && p.back.d > 4);
    const stallSpots = Array.from({length: 10}, (_, i) => local(plan.square, -plan.square.w / 2 + 5 + (i % 5) * 7, i < 5 ? -6 : 6));
    const carSet = new ChunkedSet(carGeometry(), materials.prop, cars.length, true);
    const binSet = new ChunkedSet(binGeometry(), materials.prop, bins.length, true);
    const washSet = new ChunkedSet(washingGeometry(), materials.prop, washingLines.length);
    // The harbour's fishing boats; the canal's narrowboats in four liveries (one set each: their colours are painted on, lane GC).
    const boatSet = new ChunkedSet(boatGeometry(), materials.prop, plan.moorings.length, true);
    const narrowboatSets = NARROWBOAT_LIVERIES.map((livery) => new ChunkedSet(narrowboatGeometry(livery), materials.prop, plan.moorings.length, true));
    const stallSet = new ChunkedSet(stallGeometry(), materials.prop, stallSpots.length, true);
    for (const [name, set] of [["cars", carSet], ["bins", binSet], ["washing", washSet], ["boats", boatSet], ["stalls", stallSet], ...narrowboatSets.map((nb, k) => [`narrowboats${k}`, nb] as const)] as const) {
        set.mesh.name = `props:${name}`;
        set.mesh.castShadow = true;
        set.mesh.receiveShadow = true;
        root.add(set.mesh);
    }
    const colour = new Color();
    // The street lamps and furniture (lane GA, `furniture.ts`): their bodies are in the chunks' solids; here the
    // lights (lamps, signals, beacons), the glow round each lit lamp, and the lamp map that lights the town at night.
    const furniture = scenery.furniture ?? null;
    const lightsMesh = furniture && furniture.lights.triangles ? new Mesh(lightsGeometry(furniture.lights), lightsMaterial()) : null;
    if (lightsMesh) {
        lightsMesh.name = "town:lights";
        root.add(lightsMesh);
    }
    const glow = furniture && furniture.heads.length ? lampGlow(furniture.heads) : null;
    if (glow) root.add(glow);
    if (furniture) TOWN_LIGHT.lampMap.value = lampMapTexture(furniture.lampMap);
    // Close up: leaves, weeds, grit, daisies and the odd scrap round the camera when it comes down to the street.
    const near = buildTownNear(plan, scenery.trees);
    near.setShare(NEAR_SHARE[tier]);
    root.add(near.group);
    const binColours = ["#2b4a2f", "#3a3d40", "#2a4a7a", "#7a4a2a"];
    const ground = (x: number, z: number) => sampleTownGround(x, z).height;

    yield;
    // The church's and the town hall's clock hands.
    const faces = plan.buildings.flatMap((b) => clockFaces(b));
    const handGeo = new Geo();
    handGeo.box({x: 0, y: 0, z: 0, rot: 0}, 0, 0, 0, 0.09, 1, 0.04, tone("#1c1c1c"));
    const hands = new InstancedMesh(handGeo.toGeometry(), materials.solid, Math.max(faces.length * 2, 1));
    hands.name = "town:clock-hands";
    hands.count = faces.length * 2;
    root.add(hands);

    let lastMinute = -1;
    let litCount = 0;
    let windowCount = 0;
    chunks.forEach((c) => {
        if (c?.glass) windowCount += c.glass.windows.length;
    });

    const update = (clock: TownClock) => {
        // The town's frame in the world, for the paving and the lamps (`materials.ts` TOWN_LIGHT.origin).
        TOWN_LIGHT.origin.value.set(root.matrixWorld.elements[12], root.matrixWorld.elements[14]);
        const minute = Math.floor(clock.day * 1440 + clock.hours * 60);
        if (minute === lastMinute) return;
        lastMinute = minute;
        const share = TOWN_TIERS[tier].props;
        // Lit windows.
        litCount = 0;
        for (const c of chunks) {
            if (!c?.glass) continue;
            const array = c.glass.attribute.array as Float32Array;
            for (const w of c.glass.windows) {
                const lit = windowLit(w, clock);
                if (lit > 0) litCount++;
                for (let v = w.start; v < w.start + w.count; v++) array[v] = lit;
            }
            c.glass.attribute.needsUpdate = true;
        }
        // Cars: on the spot, nose along the street (kerbs) or towards the house (drives).
        cars.forEach((spot, i) => {
            const car = carAt(spot, clock);
            colour.set(CAR_COLOURS[car.colour]);
            carSet.set(i, placeMatrix(spot.x, ground(spot.x, spot.z) + 0.12, spot.z, spot.turn), car.parked && (hashText(spot.id) % 1000) / 1000 < Math.max(share, 0.6), colour);
        });
        carSet.write();
        bins.forEach((b, i) => {
            const out = binsOut(b.street, b.id, clock);
            const p = out ? b.kerb : b.home;
            colour.set(binColours[hashText(b.id) % binColours.length]);
            binSet.set(i, placeMatrix(p.x, ground(p.x, p.z) + 0.12, p.z, b.turn + (out ? Math.PI : 0)), true, colour);
        });
        binSet.write();
        washingLines.forEach((p, i) => {
            const at = local(p.back!, 0, -p.back!.d / 4);
            washSet.set(i, placeMatrix(at.x, ground(at.x, at.z), at.z, p.at.rot), washingOut(p.id, clock) && (p.seed % 1000) / 1000 < share);
        });
        washSet.write();
        plan.moorings.forEach((m, i) => {
            const shown = boatIn(`${m.seed}`, m.harbour, clock);
            colour.set(1, 1, 1);
            if (m.harbour) {
                // (A fishing boat at its true size: 6–10 m.)
                boatSet.set(i, placeMatrix(m.x, 0.15, m.z, m.turn, m.length / 7), shown, colour);
                narrowboatSets.forEach((set) => set.set(i, placeMatrix(m.x, 1.25, m.z, m.turn), false, colour));
                return;
            }
            boatSet.set(i, placeMatrix(m.x, 1.25, m.z, m.turn), false, colour);
            // A narrowboat at its true beam (2.08 m), its length the mooring's (12–18 m).
            narrowboatSets.forEach((set, k) => set.set(i, placeMatrix(m.x, 1.25, m.z, m.turn, 1, undefined, m.length / 15), shown && m.seed % narrowboatSets.length === k, colour));
        });
        boatSet.write();
        for (const set of narrowboatSets) set.write();
        const market = marketDay(clock);
        stallSpots.forEach((p, i) => {
            colour.set(["#2f6a4a", "#8a2f2f", "#2f4a7a", "#c9a23c", "#6a3a6a"][i % 5]);
            stallSet.set(i, placeMatrix(p.x, ground(p.x, p.z) + 0.1, p.z, plan.square.rot + (i < 5 ? 0 : Math.PI)), market, colour);
        });
        stallSet.write();
        TOWN_LIGHT.lampOn.value = lampsOn(clock);
        if (glow) glow.visible = lampsOn(clock) > 0;
        // Clock hands: hour (short, thick) and minute (long), turned in each face's plane.
        const {hour, minute: min} = clockHands(clock);
        const m = new Matrix4();
        faces.forEach((f, i) => {
            for (const [k, angle, length] of [[0, hour, f.r * 0.55], [1, min, f.r * 0.85]] as const) {
                // The face's plane: its right is (nz, -nx) seen from the front; a hand points up at 0 and turns clockwise.
                const rx = f.nz;
                const rz = -f.nx;
                const dx = Math.sin(angle) * rx;
                const dz = Math.sin(angle) * rz;
                const dy = Math.cos(angle);
                const cx = f.x + f.nx * (0.05 + k * 0.03);
                const cy = f.y;
                const cz = f.z + f.nz * (0.05 + k * 0.03);
                // Basis: y along the hand, z out of the face, x = y × z.
                const yx = dx;
                const yy = dy;
                const yz = dz;
                const zx = f.nx;
                const zz = f.nz;
                const xx = yy * zz - 0;
                const xy = yz * zx - yx * zz;
                const xz = 0 - yy * zx;
                m.set(xx * (k ? 1 : 1.6), yx * length, zx, cx, xy * (k ? 1 : 1.6), yy * length, 0, cy, xz * (k ? 1 : 1.6), yz * length, zz, cz, 0, 0, 0, 1);
                hands.setMatrixAt(i * 2 + k, m);
            }
        });
        hands.instanceMatrix.needsUpdate = true;
    };

    const setDrawn = (next: ((chunk: number) => boolean) | null) => {
        drawn = next;
        chunks.forEach((c, key) => {
            if (c) c.group.visible = !next || next(key);
        });
        for (const set of [...Array.from(treeSets.values()), carSet, binSet, washSet, boatSet, stallSet, ...narrowboatSets]) set.setDrawn(next);
        assets.setDrawn(next);
        for (const {key, mesh} of zooMeshes) if (key >= 0) mesh.visible = !next || next(key);
    };

    const setShadows = (on: boolean) => {
        for (const c of chunks) if (c) for (const mesh of c.meshes) if (mesh.name === "solid" || mesh.name === "foliage") mesh.castShadow = on;
        treeSets.forEach((set) => {
            set.mesh.castShadow = on;
        });
        assets.setShadows(on);
    };

    const setTier = (next: TownTier) => {
        tier = next;
        assets.setTier(TOWN_TIERS[tier].reach, TOWN_TIERS[tier].shadows > 0);
        lastMinute = -1;
        setShadows(TOWN_TIERS[tier].shadows > 0);
        if (seenRenderer) loadTownTextures(seenRenderer, {normals: TOWN_TIERS[tier].paveNormals, anisotropy: TOWN_TIERS[tier].anisotropy});
        near.setShare(NEAR_SHARE[tier]);
    };

    const stats = () => {
        let drawnChunks = 0;
        let drawCalls = 0;
        chunks.forEach((c, key) => {
            if (!c) return;
            if (!drawn || drawn(key)) {
                drawnChunks++;
                drawCalls += c.meshes.length;
            }
        });
        const instances: Record<string, number> = {};
        treeSets.forEach((set, kind) => {
            instances[`tree:${kind}`] = set.shown;
            drawCalls++;
        });
        const trees = assets.stats();
        for (const [id, n] of Object.entries(trees.instances)) instances[`tree:${id}`] = n;
        drawCalls += trees.drawCalls;
        instances.lamps = furniture ? furniture.heads.length / 4 : 0;
        for (const [name, set] of [["cars", carSet], ["bins", binSet], ["washing", washSet], ["boats", boatSet], ["stalls", stallSet]] as const) {
            instances[name] = set.shown;
            drawCalls++;
        }
        drawCalls += zooMeshes.filter(({key, mesh}) => key < 0 || mesh.visible).length;
        return {chunks: chunks.filter(Boolean).length, drawnChunks, triangles, drawCalls: drawCalls + 4 + (lightsMesh ? 1 : 0) + (glow?.visible ? 1 : 0), instances, windows: windowCount, litWindows: litCount, zooOpen: zooOpenNow.length};
    };

    yield;
    buildZoo(zooOpenNow);
    assetsMade = true;
    yield;
    void rng;
    return {
        setZooOpen: (enclosures) => {
            const next = Array.from(new Set(enclosures)).sort();
            if (next.join() === Array.from(zooOpenNow).sort().join()) return;
            zooOpenNow = next;
            buildZoo(next);
        },
        root,
        grid: TOWN_GRID,
        spans,
        content,
        setDrawn,
        update,
        setShadows,
        setTier,
        heightAt: ground,
        assetsReady: () => assetsReady,
        stats,
        dispose: () => {
            root.traverse((o) => {
                const mesh = o as Mesh;
                if (mesh.isMesh && mesh.geometry) mesh.geometry.dispose();
            });
            near.dispose();
            (lightsMesh?.material as Material | undefined)?.dispose();
            (glow?.material as Material | undefined)?.dispose();
            if (furniture && TOWN_LIGHT.lampMap.value) {
                TOWN_LIGHT.lampMap.value.dispose();
                TOWN_LIGHT.lampMap.value = null;
            }
            Object.values(materials).forEach((m) => m.dispose());
            depth.dispose();
            water.dispose();
            assets.dispose();
            hands.dispose();
        }
    };
}

export type {TownPlan};

/** `BufferAttribute.onUpload`: drop the CPU copy once the GPU has it (three's own pattern for static geometry). */
function releaseArray(this: {array: ArrayLike<number>}) {
    this.array = new Float32Array(0);
}

/** The procedural stand-ins' height at scale 1 (`instanced.ts` treeGeometry), for drawing them at a settled tree's height. */
function standInHeight(kind: string): number {
    return kind === "pine" ? 13 : kind === "poplar" ? 16.5 : kind === "yew" ? 7 : kind === "willow" ? 9.8 : kind === "birch" ? 12.3 : kind === "apple" || kind === "cherry" ? 5.3 : kind === "acacia" ? 7.2 : kind === "palm" ? 8.3 : kind === "hedge_shrub" ? 2 : 12;
}
