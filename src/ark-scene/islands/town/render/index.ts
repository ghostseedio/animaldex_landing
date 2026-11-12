/**
 * The town, countryside and zoo island as a three.js group (docs/ark/town-island.md), built for Part B's streaming:
 * every chunk of the 9 × 9 grid is its own group (its ground tile and its merged decal, solid, glass and net meshes),
 * the instanced trees and props keep their chunks, and `setDrawn` takes the streamer's answer for which chunks are
 * drawn. Nothing is placed by the camera: every position is a pure function of the plan and the island clock.
 *
 * `update(clock)` moves what implied people move (once an island minute): lit windows, cars, bins, washing, boats,
 * the market's stalls, the street lamps, the church clock's hands.
 */

import {BufferAttribute, BufferGeometry, Color, DoubleSide, Group, InstancedMesh, Matrix4, Mesh, MeshStandardMaterial, type Material} from "three";
import {hashText, local, rng} from "@/ark-scene/islands/town/geom";
import {sampleTownGround, type TownSurface} from "@/ark-scene/islands/town/ground";
import {TOWN_HALF, TOWN_SEGMENTS, townPlan, type TownPlan} from "@/ark-scene/islands/town/plan";
import {TOWN_CHUNK_COUNT, TOWN_GRID, townChunkOf, type TownChunkSpan} from "@/ark-scene/islands/town/chunks";
import {binSpots, launchEnclosures, zooLayout} from "@/ark-scene/islands/town/areas";
import {binsOut, boatIn, clockHands, lampsOn, marketDay, washingOut, windowLit, type TownClock} from "@/ark-scene/islands/town/people";
import {buildBuilding, clockFaces, type BuildingChunk, type WindowRecord} from "@/ark-scene/islands/town/render/buildings";
import {buildScenery, buildZooScenery, type SceneryOut} from "@/ark-scene/islands/town/render/scenery";
import {binGeometry, boatGeometry, ChunkedSet, lampGeometry, placeMatrix, propMaterial, stallGeometry, treeGeometry, washingGeometry} from "@/ark-scene/islands/town/render/instanced";
import {loadVehicles, TownVehicles, type TrafficAnimals, type VehicleModel} from "@/ark-scene/islands/town/render/vehicles";
import {buildTownWater, seaDepthMap, type TownWater} from "@/ark-scene/islands/town/render/water";
import {Geo, tone} from "@/ark-scene/islands/town/render/kit";

export type TownTier = "high" | "medium" | "low";

/** Per tier: the share of trees and small props drawn, shadows. (The render distance is Part B's.) */
export const TOWN_TIERS: Record<TownTier, {trees: number; props: number; shadows: number; pixelRatio: number}> = {
    high: {trees: 1, props: 1, shadows: 2048, pixelRatio: 2},
    medium: {trees: 1, props: 1, shadows: 1024, pixelRatio: 1.5},
    low: {trees: 0.6, props: 0.5, shadows: 0, pixelRatio: 1}
};

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
    /**
     * The scene's answer for the moving cars (lane GB): the animals near a point at a moment, in the town's frame and on
     * the island clock's seconds (`render/vehicles.ts` TrafficAnimals). Null: no animals (the town's own page).
     */
    setTrafficAnimals: (query: TrafficAnimals | null) => void;
    /** The cars and bicycles (parked, moving, by level). */
    vehicles: TownVehicles;
    heightAt: (x: number, z: number) => number;
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

export type GroundGrid = {size: number; heights: Float32Array; colours: Float32Array};

/** The ground's heights and colours at every vertex of the 1.1 m grid (433 × 433). */
export function groundGrid(): GroundGrid {
    const size = TOWN_SEGMENTS + 1;
    const step = (TOWN_HALF * 2) / TOWN_SEGMENTS;
    const heights = new Float32Array(size * size);
    const colours = new Float32Array(size * size * 3);
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
            // Mottling, and the sea floor darker with depth.
            const n = 0.9 + 0.2 * (Math.sin(x * 0.37 + z * 0.11) * 0.5 + Math.sin(x * 0.07 - z * 0.23) * 0.5) * 0.5 + ((hashText(`${column}|${row}`) % 100) / 100 - 0.5) * 0.05;
            const deep = g.height < 0 ? Math.max(0.45, 1 + g.height * 0.05) : 1;
            colours[i * 3] = c.r * n * deep;
            colours[i * 3 + 1] = c.g * n * deep;
            colours[i * 3 + 2] = c.b * n * deep;
        }
    }
    return {size, heights, colours};
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
    geometry.setIndex(index);
    geometry.computeBoundingSphere();
    return geometry;
}

// MARK: - Materials

function groundMaterial(): MeshStandardMaterial {
    const material = new MeshStandardMaterial({vertexColors: true, roughness: 0.96, metalness: 0});
    material.onBeforeCompile = (shader) => {
        shader.vertexShader = shader.vertexShader.replace("#include <common>", "#include <common>\nvarying vec3 vTownWorld;").replace("#include <worldpos_vertex>", "#include <worldpos_vertex>\nvTownWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;");
        shader.fragmentShader = shader.fragmentShader
            .replace("#include <common>", "#include <common>\nvarying vec3 vTownWorld;\nfloat townHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }\nfloat townNoise(vec2 p) { vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f); return mix(mix(townHash(i), townHash(i + vec2(1.0, 0.0)), u.x), mix(townHash(i + vec2(0.0, 1.0)), townHash(i + vec2(1.0, 1.0)), u.x), u.y); }")
            .replace("#include <color_fragment>", "#include <color_fragment>\nfloat townGrain = townNoise(vTownWorld.xz * 1.7) * 0.6 + townNoise(vTownWorld.xz * 0.23) * 0.4;\ndiffuseColor.rgb *= 0.86 + 0.26 * townGrain;");
    };
    return material;
}

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

function netMaterial(): MeshStandardMaterial {
    const material = new MeshStandardMaterial({vertexColors: true, roughness: 0.7, metalness: 0.2, transparent: true, side: DoubleSide, depthWrite: false});
    material.onBeforeCompile = (shader) => {
        shader.vertexShader = shader.vertexShader.replace("#include <common>", "#include <common>\nvarying vec3 vNetWorld;").replace("#include <worldpos_vertex>", "#include <worldpos_vertex>\nvNetWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;");
        shader.fragmentShader = shader.fragmentShader
            .replace("#include <common>", "#include <common>\nvarying vec3 vNetWorld;")
            .replace("#include <alphatest_fragment>", "vec3 netCell = abs(fract(vNetWorld * 3.0) - 0.5);\nfloat netWire = step(0.42, max(max(netCell.x, netCell.y), netCell.z));\ndiffuseColor.a = mix(0.06, 0.75, netWire);\n#include <alphatest_fragment>");
    };
    return material;
}

// MARK: - Building it

type ChunkMeshes = {group: Group; meshes: Mesh[]; glass: {attribute: BufferAttribute; windows: WindowRecord[]} | null};

/**
 * The town's heavy, pure part (decision 153: built in the town's prebuild worker, off the page's main thread): the
 * ground's grid, the scenery with every building in its chunk, and the zoo's scenery for the open enclosures.
 */
export type TownBuildData = {grid: GroundGrid; scenery: SceneryOut; perChunk: Map<number, BuildingChunk>; zoo: SceneryOut; zooOpen: string[]};

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
    return {grid, scenery, perChunk, zoo, zooOpen: [...zooOpen]};
}

/** `vehicles`: the car models already read (null: proxies only); left out, they are read from `VEHICLE_FILE`. */
type TownIslandOptions = {tier?: TownTier; zooOpen?: readonly string[]; built?: TownBuildData; vehicles?: Map<string, VehicleModel> | null};

export function buildTownIsland(options: TownIslandOptions = {}): TownIsland {
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
export function* townIslandSteps(options: TownIslandOptions = {}): Generator<void, TownIsland> {
    const plan = townPlan();
    let tier: TownTier = options.tier ?? "high";
    const root = new Group();
    root.name = "island:town";
    const built = options.built ?? null;
    const grid = built?.grid ?? groundGrid();
    yield;
    const materials = {ground: groundMaterial(), decal: new MeshStandardMaterial({vertexColors: true, roughness: 0.92, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2}), solid: new MeshStandardMaterial({vertexColors: true, roughness: 0.84, metalness: 0}), glass: glassMaterial(), net: netMaterial(), prop: propMaterial(), tree: new MeshStandardMaterial({vertexColors: true, roughness: 0.9}), lampHead: new MeshStandardMaterial({color: new Color("#fff1c4"), emissive: new Color("#ffc878"), emissiveIntensity: 0, roughness: 0.4})};

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
        add(sc?.decal, materials.decal, "decal", false);
        add(bc?.solid ?? sc?.solid, materials.solid, "solid", true);
        add(sc?.net, materials.net, "net", false);
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
    const buildZoo = (open: readonly string[]) => {
        for (const {mesh} of zooMeshes) {
            mesh.geometry.dispose();
            zooRoot.remove(mesh);
        }
        zooMeshes = [];
        // (The prebuild's zoo scenery when it was worked out for these very enclosures.)
        const zoo = built && built.zooOpen.join(",") === open.join(",") ? built.zoo : buildZooScenery(zooLayout(open, plan));
        zoo.chunks.forEach((c, key) => {
            const parts: Array<[Geo, Material, string]> = [[c.decal, materials.decal, "decal"], [c.solid, materials.solid, "solid"], [c.glass, materials.glass, "glass"], [c.net, materials.net, "net"]];
            for (const [geo, material, name] of parts) {
                if (!geo.triangles) continue;
                const geometry = geo.toGeometry();
                if (name === "glass") geometry.setAttribute("aLit", new BufferAttribute(new Float32Array(geo.pos.length / 3), 1));
                const mesh = new Mesh(geometry, material);
                mesh.name = `zoo:${name}`;
                mesh.castShadow = name === "solid";
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
    // Trees: one set per kind.
    const treeSets = new Map<string, ChunkedSet>();
    const byKind = new Map<string, typeof scenery.trees>();
    for (const t of scenery.trees) {
        const list = byKind.get(t.kind) ?? [];
        list.push(t);
        byKind.set(t.kind, list);
    }
    const treeShare = (seed: number) => (seed % 1000) / 1000;
    byKind.forEach((list, kind) => {
        const set = new ChunkedSet(treeGeometry(kind), materials.tree, list.length);
        set.mesh.castShadow = true;
        set.mesh.receiveShadow = true;
        set.mesh.name = `trees:${kind}`;
        list.forEach((t, i) => set.set(i, placeMatrix(t.x, sampleTownGround(t.x, t.z).height - 0.1, t.z, (t.seed % 628) / 100, t.scale), treeShare(t.seed) < TOWN_TIERS[tier].trees));
        set.write();
        treeSets.set(kind, set);
        root.add(set.mesh);
    });

    yield;
    // People-implied props.
    // The cars and bicycles (lane GB: `render/vehicles.ts`), parked and moving, their models read once for the page.
    const vehicles = new TownVehicles(plan, tier);
    root.add(vehicles.group);
    let disposed = false;
    if (options.vehicles !== undefined) vehicles.setModels(options.vehicles);
    else void loadVehicles().then((models) => {
        if (!disposed) vehicles.setModels(models);
    });
    const bins = binSpots(plan);
    const washingLines = plan.parcels.filter((p) => (p.kind === "house" || p.kind === "terrace_home") && p.back && p.back.d > 4);
    const stallSpots = Array.from({length: 10}, (_, i) => local(plan.square, -plan.square.w / 2 + 5 + (i % 5) * 7, i < 5 ? -6 : 6));
    const binSet = new ChunkedSet(binGeometry(), materials.prop, bins.length, true);
    const washSet = new ChunkedSet(washingGeometry(), materials.prop, washingLines.length);
    const boatSet = new ChunkedSet(boatGeometry(), materials.prop, plan.moorings.length, true);
    const stallSet = new ChunkedSet(stallGeometry(), materials.prop, stallSpots.length, true);
    const lamp = lampGeometry();
    const lampSet = new ChunkedSet(lamp.post, materials.solid, scenery.lamps.length);
    const lampHeadSet = new ChunkedSet(lamp.head, materials.lampHead, scenery.lamps.length);
    for (const [name, set] of [["bins", binSet], ["washing", washSet], ["boats", boatSet], ["stalls", stallSet], ["lamps", lampSet], ["lamp_heads", lampHeadSet]] as const) {
        set.mesh.name = `props:${name}`;
        set.mesh.castShadow = name !== "lamp_heads";
        set.mesh.receiveShadow = true;
        root.add(set.mesh);
    }
    const colour = new Color();
    scenery.lamps.forEach((l, i) => {
        const turn = (hashText(`${l.x}|${l.z}`) % 628) / 100;
        lampSet.set(i, placeMatrix(l.x, l.y, l.z, turn));
        lampHeadSet.set(i, placeMatrix(l.x, l.y, l.z, turn));
    });
    lampSet.write();
    lampHeadSet.write();
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
        // The cars every frame (the moving ones on the island clock's seconds; the parked once a minute inside).
        vehicles.update(clock, ((clock.day - 4) * 24 + clock.hours) * 3600);
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
            colour.set(["#ffffff", "#2c4a7a", "#8a2a2a", "#2f5a3a", "#d8b84a"][m.seed % 5]);
            const scale = m.length / 7;
            boatSet.set(i, placeMatrix(m.x, m.harbour ? 0.15 : 1.25, m.z, m.turn, scale), boatIn(`${m.seed}`, m.harbour, clock), colour);
        });
        boatSet.write();
        const market = marketDay(clock);
        stallSpots.forEach((p, i) => {
            colour.set(["#2f6a4a", "#8a2f2f", "#2f4a7a", "#c9a23c", "#6a3a6a"][i % 5]);
            stallSet.set(i, placeMatrix(p.x, ground(p.x, p.z) + 0.1, p.z, plan.square.rot + (i < 5 ? 0 : Math.PI)), market, colour);
        });
        stallSet.write();
        materials.lampHead.emissiveIntensity = lampsOn(clock) * 2.4;
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
        for (const set of [...Array.from(treeSets.values()), binSet, washSet, boatSet, stallSet, lampSet, lampHeadSet]) set.setDrawn(next);
        vehicles.setDrawn(next);
        for (const {key, mesh} of zooMeshes) if (key >= 0) mesh.visible = !next || next(key);
    };

    const setShadows = (on: boolean) => {
        for (const c of chunks) if (c) for (const mesh of c.meshes) if (mesh.name === "solid") mesh.castShadow = on;
        treeSets.forEach((set) => {
            set.mesh.castShadow = on;
        });
    };

    const setTier = (next: TownTier) => {
        tier = next;
        treeSets.forEach((set, kind) => {
            const list = byKind.get(kind)!;
            list.forEach((t, i) => set.setShown(i, treeShare(t.seed) < TOWN_TIERS[tier].trees));
            set.write();
        });
        lastMinute = -1;
        vehicles.setTier(tier);
        setShadows(TOWN_TIERS[tier].shadows > 0);
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
        for (const [name, set] of [["bins", binSet], ["washing", washSet], ["boats", boatSet], ["stalls", stallSet], ["lamps", lampSet]] as const) {
            instances[name] = set.shown;
            drawCalls++;
        }
        const traffic = vehicles.stats();
        instances.cars = traffic.parked;
        instances.moving_cars = traffic.moving;
        instances.bikes = traffic.bikes;
        drawCalls += traffic.drawCalls;
        drawCalls += zooMeshes.filter(({key, mesh}) => key < 0 || mesh.visible).length;
        return {chunks: chunks.filter(Boolean).length, drawnChunks, triangles, drawCalls: drawCalls + 4, instances, windows: windowCount, litWindows: litCount, zooOpen: zooOpenNow.length};
    };

    yield;
    buildZoo(zooOpenNow);
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
        setTrafficAnimals: (query) => vehicles.setAnimals(query),
        vehicles,
        heightAt: ground,
        stats,
        dispose: () => {
            disposed = true;
            vehicles.dispose();
            root.traverse((o) => {
                const mesh = o as Mesh;
                if (mesh.isMesh && mesh.geometry) mesh.geometry.dispose();
            });
            Object.values(materials).forEach((m) => m.dispose());
            depth.dispose();
            water.dispose();
            hands.dispose();
        }
    };
}

export type {TownPlan};
