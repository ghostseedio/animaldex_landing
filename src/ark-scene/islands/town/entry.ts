/**
 * The town island's own page (docs/ark/town-island.md): the island alone under the Ark's sky and light, for the
 * stills, the flythrough, the visual check and the per-tier measurements (`scripts/ark-town.mts`). The islands lane
 * mounts the town in the Ark's page through `islands/index.ts` `loadIsland`; this page is the town's workbench.
 *
 *   ?quality=high|medium|low   the tier (Part B's render distance and the town's own shares)
 *   ?hours=17                  the island clock's hour (pinned); ?day=<n> the day
 *   ?sky=0                     without the photographed day sky (the visual check: nothing loads after mount)
 */

import {ACESFilmicToneMapping, Fog, PCFSoftShadowMap, PerspectiveCamera, Scene, Vector3, WebGLRenderer} from "three";
import {ArkLighting} from "@/ark-scene/lighting";
import {ArkPost} from "@/ark-scene/post";
import {ARK_TIME} from "@/ark-scene/glsl";
import {buildTownIsland, TOWN_TIERS, type TownTier} from "@/ark-scene/islands/town/render/index";
import {townPlan} from "@/ark-scene/islands/town/plan";
import {townChunkDistance, TOWN_CHUNK_COUNT} from "@/ark-scene/islands/town/chunks";
import {local} from "@/ark-scene/islands/town/geom";
import type {TownClock} from "@/ark-scene/islands/town/people";

/** Part B's render distance and hysteresis per tier (`streaming/tiers.ts`); the map view from 150 m. */
const STREAM = {high: {distance: 960, hysteresis: 40}, medium: {distance: 640, hysteresis: 32}, low: {distance: 440, hysteresis: 26}} as const;

type Shot = {id: string; eye: [number, number, number]; target: [number, number, number]; hours: number; fov?: number; day?: number};

function shots(): Shot[] {
    const plan = townPlan();
    const slot = (id: string) => plan.zoo.slots.find((s) => s.id === id)!;
    const penguins = slot("penguin_seal_pools-1").at;
    const savanna = slot("savanna_paddocks-1").at;
    const aviary = slot("aviaries-1").at;
    const sq = plan.square;
    const pFront = local(penguins, 3, penguins.d / 2 + 3.2);
    const aFront = local(aviary, -10, aviary.d / 2 + 7);
    const farm = plan.farms.find((f) => f.id === "farmstead-0")!.at;
    return [
        {id: "island_far", eye: [70, 230, 470], target: [0, 0, -15], hours: 11},
        {id: "old_town", eye: [-6, 34, 92], target: [-18, 4, 2], hours: 10.5},
        {id: "high_street", eye: [-58, 6.5, 33], target: [-10, 4.5, 26], hours: 12},
        {id: "canal", eye: [9.5, 5, 82], target: [5, 2.5, 18], hours: 16},
        {id: "homes", eye: [155, 42, 125], target: [92, 2, 22], hours: 9.5},
        {id: "gardens", eye: [104, 13, -22], target: [86, 2, -40], hours: 14},
        {id: "farmland", eye: [150, 62, -70], target: [40, 6, -150], hours: 15},
        {id: "farm_close", eye: [farm.x + 22, 28, farm.z + 40], target: [farm.x, 3, farm.z], hours: 8.5},
        {id: "zoo", eye: [-40, 95, 70], target: [-125, 0, -60], hours: 11.5},
        {id: "zoo_savanna", eye: [savanna.x + 6, 14, savanna.z + 40], target: [savanna.x - 10, 2, savanna.z - 4], hours: 13},
        {id: "zoo_penguins", eye: [pFront.x, 5.5, pFront.z], target: [penguins.x, 2.4, penguins.z], hours: 11},
        {id: "zoo_aviary", eye: [aFront.x, 19, aFront.z], target: [aviary.x + 6, 1.5, aviary.z - 3], hours: 9},
        {id: "harbour", eye: [26, 32, 215], target: [14, 2, 128], hours: 17.5},
        {id: "square_market", eye: [sq.x + 26, 16, sq.z + 30], target: [sq.x, 3, sq.z], hours: 10, day: 20408},
        {id: "town_dusk", eye: [70, 160, 330], target: [10, 0, -10], hours: 18.6},
        {id: "town_night", eye: [-6, 34, 92], target: [-18, 4, 2], hours: 22.3},
        {id: "homes_night", eye: [155, 42, 125], target: [92, 2, 22], hours: 21.5}
    ];
}

declare global {
    interface Window {
        __arkTown?: {
            ready: boolean;
            shots: Shot[];
            mountMs: number;
            view: (eye: [number, number, number], target: [number, number, number], hours: number, day?: number, fov?: number) => void;
            shot: (id: string, day?: number) => void;
            render: (frames?: number) => void;
            stats: () => unknown;
            perf: (seconds: number) => Promise<unknown>;
            fly: (seconds: number, fps: number) => Promise<unknown>;
            flyPose: (t: number) => {eye: [number, number, number]; target: [number, number, number]; hours: number};
        };
    }
}

export function mountTown(el: HTMLElement) {
    const started = performance.now();
    const params = new URLSearchParams(location.search);
    const tier = (["high", "medium", "low"].includes(params.get("quality") ?? "") ? params.get("quality") : "high") as TownTier;
    const renderer = new WebGLRenderer({antialias: tier === "low", powerPreference: "high-performance", preserveDrawingBuffer: true});
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.66;
    renderer.shadowMap.type = PCFSoftShadowMap;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, TOWN_TIERS[tier].pixelRatio));
    renderer.info.autoReset = false;
    el.appendChild(renderer.domElement);
    renderer.domElement.style.display = "block";
    const scene = new Scene();
    const camera = new PerspectiveCamera(45, 1, 0.5, 5000);
    const hours0 = Number(params.get("hours") ?? 11);
    const lighting = new ArkLighting(renderer, scene, hours0);
    const fog = new Fog(lighting.horizon, 420, 1700);
    scene.fog = fog;
    // The photographed day sky loads after mount; the visual check leaves it out (`?sky=0`) so a shot never races it.
    if (params.get("sky") !== "0") lighting.loadDaySky("/ark/graphics/sky-day.hdr");
    lighting.setShadows(renderer, TOWN_TIERS[tier].shadows);
    const town = buildTownIsland({tier});
    scene.add(town.root);
    const post = new ArkPost(renderer, scene, camera, tier);
    let clock: TownClock = {hours: hours0, day: Number(params.get("day") ?? 20406)};
    const target = new Vector3();
    const states = new Uint8Array(TOWN_CHUNK_COUNT).fill(1);

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

    /** Part B's chunk states for this eye (in within the distance, kept within the hysteresis), then the town draws them. */
    const stream = () => {
        const s = STREAM[tier];
        const toTarget = camera.position.distanceTo(target);
        let changed = false;
        for (let key = 0; key < TOWN_CHUNK_COUNT; key++) {
            const d = townChunkDistance(key, camera.position.x, camera.position.y, camera.position.z, town.spans[key]);
            const next = d <= s.distance || (states[key] === 1 && d <= s.distance + s.hysteresis) || toTarget >= 150 ? 1 : 0;
            if (next !== states[key]) changed = true;
            states[key] = next;
        }
        if (changed) town.setDrawn((key) => states[key] === 1);
    };

    const frame = () => {
        lighting.setHours(clock.hours, fog);
        lighting.fitShadow(target, camera.position.distanceTo(target));
        town.update(clock);
        stream();
        renderer.info.reset();
        post.render();
    };

    const view = (eye: [number, number, number], at: [number, number, number], hours: number, day = clock.day, fov = 45) => {
        camera.position.set(...eye);
        target.set(...at);
        camera.fov = fov;
        camera.updateProjectionMatrix();
        camera.lookAt(target);
        clock = {hours, day};
    };

    // The flythrough: a smooth path through the places, morning to night.
    const path = [
        {eye: [70, 230, 470], target: [0, 0, -15], hours: 8.5},
        {eye: [20, 40, 170], target: [14, 2, 120], hours: 9.5},
        {eye: [10, 8, 76], target: [4, 2.5, 6], hours: 10.2},
        {eye: [6, 13, 44], target: [-20, 4, 28], hours: 10.8},
        {eye: [-12, 10, 29], target: [-58, 4, 30], hours: 11.3},
        {eye: [-46, 8, 30], target: [-30, 4, 10], hours: 11.8},
        {eye: [-30, 30, 22], target: [-30, 3, -12], hours: 12.5},
        {eye: [-70, 60, -10], target: [-120, 2, -50], hours: 13.5},
        {eye: [-120, 40, -110], target: [-130, 2, -130], hours: 14.5},
        {eye: [-30, 40, -140], target: [30, 4, -150], hours: 15.5},
        {eye: [110, 45, -130], target: [100, 4, -60], hours: 16.5},
        {eye: [160, 40, -10], target: [90, 2, 20], hours: 17.5},
        {eye: [150, 70, 150], target: [60, 2, 40], hours: 18.8},
        {eye: [70, 160, 330], target: [10, 0, -10], hours: 20.2},
        {eye: [-6, 34, 92], target: [-18, 4, 2], hours: 21.5}
    ] as const;
    const catmull = (p0: number, p1: number, p2: number, p3: number, t: number) => 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t);
    const flyPose = (t: number) => {
        const n = path.length - 1;
        const x = Math.min(Math.max(t, 0), 0.99999) * n;
        const i = Math.floor(x);
        const f = x - i;
        const p = (k: number) => path[Math.min(Math.max(k, 0), n)];
        const lerp3 = (key: "eye" | "target") => [0, 1, 2].map((c) => catmull(p(i - 1)[key][c], p(i)[key][c], p(i + 1)[key][c], p(i + 2)[key][c], f)) as [number, number, number];
        return {eye: lerp3("eye"), target: lerp3("target"), hours: p(i).hours + (p(i + 1).hours - p(i).hours) * f};
    };

    const list = shots();
    window.__arkTown = {
        ready: true,
        shots: list,
        mountMs: performance.now() - started,
        view: (eye, at, hours, day, fov) => {
            view(eye, at, hours, day, fov);
            frame();
        },
        shot: (id, day) => {
            const s = list.find((x) => x.id === id);
            if (!s) throw new Error(`no shot ${id}`);
            ARK_TIME.value = 120;
            view(s.eye, s.target, s.hours, day ?? s.day ?? clock.day, s.fov);
            frame();
        },
        render: (frames = 1) => {
            for (let i = 0; i < frames; i++) frame();
        },
        stats: () => ({tier, town: town.stats(), render: {calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures}, heapMB: heapMB(), gpuMB: gpuEstimateMB(scene)}),
        perf: async (seconds) => {
            const intervals: number[] = [];
            let last = performance.now();
            const end = last + seconds * 1000;
            let peakHeap = heapMB() ?? 0;
            while (performance.now() < end) {
                await new Promise((resolve) => requestAnimationFrame(resolve));
                const now = performance.now();
                intervals.push(now - last);
                last = now;
                const t = 1 - (end - now) / (seconds * 1000);
                const pose = flyPose(t);
                ARK_TIME.value = (now / 1000) % 600;
                view(pose.eye, pose.target, pose.hours);
                frame();
                peakHeap = Math.max(peakHeap, heapMB() ?? 0);
            }
            intervals.sort((a, b) => a - b);
            const q = (p: number) => intervals[Math.min(intervals.length - 1, Math.floor(intervals.length * p))];
            return {frames: intervals.length, fps: intervals.length / seconds, median: q(0.5), p95: q(0.95), p99: q(0.99), peakHeapMB: peakHeap, gpuMB: gpuEstimateMB(scene), calls: renderer.info.render.calls, triangles: renderer.info.render.triangles};
        },
        fly: async () => ({}),
        flyPose
    };
    frame();
}

function heapMB(): number | null {
    const memory = (performance as Performance & {memory?: {usedJSHeapSize: number}}).memory;
    return memory ? Math.round((memory.usedJSHeapSize / 1048576) * 10) / 10 : null;
}

/** The scene's GPU memory, estimated: every geometry's buffers and every texture's pixels. */
function gpuEstimateMB(scene: Scene): number {
    let bytes = 0;
    const seen = new Set<unknown>();
    scene.traverse((o) => {
        const mesh = o as unknown as {geometry?: {attributes: Record<string, {array: ArrayLike<number> & {byteLength: number}}>; index: {array: {byteLength: number}} | null}; instanceMatrix?: {array: {byteLength: number}}};
        if (mesh.geometry && !seen.has(mesh.geometry)) {
            seen.add(mesh.geometry);
            for (const name of Object.keys(mesh.geometry.attributes)) bytes += mesh.geometry.attributes[name].array.byteLength;
            if (mesh.geometry.index) bytes += mesh.geometry.index.array.byteLength;
        }
        if (mesh.instanceMatrix) bytes += mesh.instanceMatrix.array.byteLength;
    });
    return Math.round((bytes / 1048576) * 10) / 10;
}

const el = document.getElementById("ark-town");
if (el) mountTown(el);
