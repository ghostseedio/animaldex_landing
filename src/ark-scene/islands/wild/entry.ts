/**
 * The wild island's own page (docs/ark/wild-island.md): the island alone under the Ark's sky and light, for the stills,
 * the flythrough, the visual check and the per-tier measurements (`scripts/ark-wild.mts`). The scene mounts the island
 * through `islands/wild/index.ts`; this page is its workbench.
 *
 *   ?quality=high|medium|low   the tier (Part B's render distance and the island's own shares)
 *   ?hours=11                  the hour (pinned)
 *   ?sky=0                     without the photographed day sky (the visual check: nothing loads after mount but the assets)
 */

import {ACESFilmicToneMapping, Fog, PCFSoftShadowMap, PerspectiveCamera, Scene, Vector3, WebGLRenderer} from "three";
import {ArkLighting} from "@/ark-scene/lighting";
import {ArkPost} from "@/ark-scene/post";
import {ARK_TIME} from "@/ark-scene/glsl";
import {loadGroundTextures} from "@/ark-scene/ground-textures";
import {buildWildIsland, WILD_TIERS, type WildTier} from "@/ark-scene/islands/wild/render/index";
import {WILD_CHUNK_COUNT, wildChunkDistance} from "@/ark-scene/islands/wild/frame";

/** Part B's render distance and hysteresis per tier (`streaming/tiers.ts`); the map view from 150 m. */
const STREAM = {high: {distance: 960, hysteresis: 40}, medium: {distance: 640, hysteresis: 32}, low: {distance: 440, hysteresis: 26}} as const;

/** A shot: `eye` and `target` heights are above the ground under them (`ground: true`) or absolute (m). */
export type WildShot = {id: string; eye: [number, number, number]; target: [number, number, number]; hours: number; fov?: number; ground?: boolean};

export const WILD_SHOTS: WildShot[] = [
    {id: "island_far", eye: [0, 230, 560], target: [0, 8, -30], hours: 11},
    {id: "island_north", eye: [40, 150, -520], target: [10, 20, -40], hours: 15},
    {id: "town_side", eye: [360, 46, -150], target: [150, 6, -55], hours: 9},
    {id: "cove_peaks", eye: [30, 34, -300], target: [10, 30, -140], hours: 10.5},
    {id: "lagoon_rainforest", eye: [-250, 42, 250], target: [-130, 6, 90], hours: 10},
    {id: "savanna", eye: [120, 4, 110], target: [60, 3, 20], hours: 16.5, ground: true},
    {id: "desert_dunes", eye: [150, 5, -10], target: [110, 3, -70], hours: 17.5, ground: true},
    {id: "lake_river", eye: [-45, 6, 5], target: [-66, 1, -18], hours: 9.5, ground: true},
    {id: "wetland_estuary", eye: [-20, 34, 215], target: [-60, 1, 130], hours: 8.5},
    {id: "woodland_valley", eye: [-78, 9, -8], target: [-100, 6, -60], hours: 13, ground: true},
    {id: "ecotone_edge", eye: [30, 3, 60], target: [-20, 4, 20], hours: 14, ground: true},
    {id: "mountain_meadow", eye: [-18, 42, -48], target: [-58, 40, -124], hours: 11.5},
    {id: "island_dusk", eye: [0, 230, 560], target: [0, 8, -30], hours: 18.4}
];

declare global {
    interface Window {
        __arkWild?: {
            ready: boolean;
            assetsReady: () => boolean;
            shots: WildShot[];
            mountMs: number;
            view: (eye: [number, number, number], target: [number, number, number], hours: number, fov?: number) => void;
            shot: (id: string) => void;
            render: (frames?: number) => void;
            stats: () => unknown;
            perf: (seconds: number) => Promise<unknown>;
            flyPose: (t: number) => {eye: [number, number, number]; target: [number, number, number]; hours: number};
        };
    }
}

/** The flythrough: round the island from the south, over the lagoon, up the river to the lake, past the peaks and the cove, down the dry east, back over the savanna. */
const PATH = [
    {eye: [0, 230, 560], target: [0, 8, -30], hours: 8.5},
    {eye: [-180, 70, 330], target: [-120, 4, 140], hours: 9},
    {eye: [-210, 30, 170], target: [-110, 6, 80], hours: 9.5},
    {eye: [-90, 22, 175], target: [-50, 2, 110], hours: 10},
    {eye: [-30, 18, 95], target: [-45, 3, 30], hours: 10.5},
    {eye: [-40, 22, 20], target: [-70, 8, -40], hours: 11},
    {eye: [-110, 40, -40], target: [-60, 30, -120], hours: 11.5},
    {eye: [-90, 70, -170], target: [20, 30, -150], hours: 12.5},
    {eye: [10, 50, -290], target: [20, 15, -160], hours: 13.5},
    {eye: [140, 60, -200], target: [110, 10, -60], hours: 14.5},
    {eye: [230, 40, -40], target: [120, 4, 10], hours: 15.5},
    {eye: [200, 30, 140], target: [60, 6, 40], hours: 16.5},
    {eye: [60, 60, 300], target: [0, 8, 40], hours: 17.5},
    {eye: [0, 230, 560], target: [0, 8, -30], hours: 18.5}
] as const;

const catmull = (p0: number, p1: number, p2: number, p3: number, t: number) => 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t);

export function wildFlyPose(t: number): {eye: [number, number, number]; target: [number, number, number]; hours: number} {
    const n = PATH.length - 1;
    const x = Math.min(Math.max(t, 0), 0.99999) * n;
    const i = Math.floor(x);
    const f = x - i;
    const p = (k: number) => PATH[Math.min(Math.max(k, 0), n)];
    const lerp3 = (key: "eye" | "target") => [0, 1, 2].map((c) => catmull(p(i - 1)[key][c], p(i)[key][c], p(i + 1)[key][c], p(i + 2)[key][c], f)) as [number, number, number];
    return {eye: lerp3("eye"), target: lerp3("target"), hours: p(i).hours + (p(i + 1).hours - p(i).hours) * f};
}

export function mountWild(el: HTMLElement) {
    const started = performance.now();
    const params = new URLSearchParams(location.search);
    const tier = (["high", "medium", "low"].includes(params.get("quality") ?? "") ? params.get("quality") : "high") as WildTier;
    const renderer = new WebGLRenderer({antialias: tier === "low", powerPreference: "high-performance", preserveDrawingBuffer: true});
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.66;
    renderer.shadowMap.type = PCFSoftShadowMap;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, WILD_TIERS[tier].pixelRatio));
    renderer.info.autoReset = false;
    el.appendChild(renderer.domElement);
    renderer.domElement.style.display = "block";
    const scene = new Scene();
    const camera = new PerspectiveCamera(45, 1, 0.5, 6000);
    let hours = Number(params.get("hours") ?? 11);
    const lighting = new ArkLighting(renderer, scene, hours);
    const fog = new Fog(lighting.horizon, 520, 2000);
    scene.fog = fog;
    if (params.get("sky") !== "0") lighting.loadDaySky("/ark/graphics/sky-day.hdr");
    void loadGroundTextures("/ark/graphics");
    lighting.setShadows(renderer, WILD_TIERS[tier].shadows);
    const island = buildWildIsland({tier, base: "/ark/assets/v1"});
    scene.add(island.root);
    const post = new ArkPost(renderer, scene, camera, tier);
    (window as unknown as {__arkWildScene?: Scene}).__arkWildScene = scene;
    const target = new Vector3();
    const states = new Uint8Array(WILD_CHUNK_COUNT).fill(1);

    const resize = () => {
        const w = el.clientWidth || window.innerWidth;
        const h = el.clientHeight || window.innerHeight;
        renderer.setSize(w, h);
        post.setSize(w, h, renderer.getPixelRatio());
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
    };
    resize();
    window.addEventListener("resize", resize);

    /** Part B's chunk states for this eye (in within the distance, kept within the hysteresis; the map view draws all). */
    let drawnCount = WILD_CHUNK_COUNT;
    const stream = () => {
        const s = STREAM[tier];
        const toTarget = camera.position.distanceTo(target);
        let changed = false;
        for (let key = 0; key < WILD_CHUNK_COUNT; key++) {
            const d = wildChunkDistance(key, camera.position.x, camera.position.y, camera.position.z, island.spans[key]);
            const next = d <= s.distance || (states[key] === 1 && d <= s.distance + s.hysteresis) || toTarget >= 150 ? 1 : 0;
            if (next !== states[key]) changed = true;
            states[key] = next;
        }
        if (changed) {
            drawnCount = states.reduce((sum, v) => sum + v, 0);
            island.setDrawn((key) => states[key] === 1);
        }
    };

    const frame = () => {
        lighting.setHours(hours, fog);
        lighting.fitShadow(target, camera.position.distanceTo(target));
        stream();
        island.update(camera.position);
        renderer.info.reset();
        post.render();
    };

    const view = (eye: [number, number, number], at: [number, number, number], h: number, fov = 45) => {
        camera.position.set(...eye);
        target.set(...at);
        camera.fov = fov;
        camera.updateProjectionMatrix();
        camera.lookAt(target);
        hours = h;
    };

    window.__arkWild = {
        ready: true,
        assetsReady: () => island.ready(),
        shots: WILD_SHOTS,
        mountMs: performance.now() - started,
        view: (eye, at, h, fov) => {
            view(eye, at, h, fov);
            island.prepare(camera.position);
            frame();
        },
        shot: (id) => {
            const s = WILD_SHOTS.find((x) => x.id === id);
            if (!s) throw new Error(`no shot ${id}`);
            ARK_TIME.value = 120;
            const lift = (p: [number, number, number]): [number, number, number] => (s.ground ? [p[0], Math.max(island.heightAt(p[0], p[2]), 0) + p[1], p[2]] : p);
            view(lift(s.eye), lift(s.target), s.hours, s.fov);
            island.prepare(camera.position);
            frame();
        },
        render: (frames = 1) => {
            for (let i = 0; i < frames; i++) frame();
        },
        stats: () => ({tier, island: island.stats(), drawnChunks: drawnCount, render: {calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures}, heapMB: heapMB(), gpuMB: gpuEstimateMB(scene)}),
        perf: async (seconds) => {
            const intervals: number[] = [];
            let last = performance.now();
            const end = last + seconds * 1000;
            let peakHeap = heapMB() ?? 0;
            let peakCalls = 0;
            let peakTriangles = 0;
            while (performance.now() < end) {
                await new Promise((resolve) => requestAnimationFrame(resolve));
                const now = performance.now();
                intervals.push(now - last);
                last = now;
                const pose = wildFlyPose(1 - (end - now) / (seconds * 1000));
                ARK_TIME.value = (now / 1000) % 600;
                view(pose.eye, pose.target, pose.hours);
                frame();
                peakHeap = Math.max(peakHeap, heapMB() ?? 0);
                peakCalls = Math.max(peakCalls, renderer.info.render.calls);
                peakTriangles = Math.max(peakTriangles, renderer.info.render.triangles);
            }
            intervals.sort((a, b) => a - b);
            const q = (p: number) => intervals[Math.min(intervals.length - 1, Math.floor(intervals.length * p))];
            return {frames: intervals.length, fps: intervals.length / seconds, median: q(0.5), p95: q(0.95), p99: q(0.99), peakHeapMB: peakHeap, gpuMB: gpuEstimateMB(scene), peakCalls, peakTriangles};
        },
        flyPose: wildFlyPose
    };
    frame();
}

function heapMB(): number | null {
    const memory = (performance as Performance & {memory?: {usedJSHeapSize: number}}).memory;
    return memory ? Math.round((memory.usedJSHeapSize / 1048576) * 10) / 10 : null;
}

/** The scene's GPU memory, estimated: every geometry's buffers and every instance buffer. */
function gpuEstimateMB(scene: Scene): number {
    let bytes = 0;
    const seen = new Set<unknown>();
    scene.traverse((o) => {
        const mesh = o as unknown as {geometry?: {attributes: Record<string, {array: {byteLength: number}}>; index: {array: {byteLength: number}} | null}; instanceMatrix?: {array: {byteLength: number}}};
        if (mesh.geometry && !seen.has(mesh.geometry)) {
            seen.add(mesh.geometry);
            for (const name of Object.keys(mesh.geometry.attributes)) bytes += mesh.geometry.attributes[name].array.byteLength;
            if (mesh.geometry.index) bytes += mesh.geometry.index.array.byteLength;
        }
        if (mesh.instanceMatrix) bytes += mesh.instanceMatrix.array.byteLength;
    });
    return Math.round((bytes / 1048576) * 10) / 10;
}

const el = document.getElementById("ark-wild");
if (el) mountWild(el);
