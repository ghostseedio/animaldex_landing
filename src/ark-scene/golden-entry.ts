/**
 * The golden-shot page's script (development only; scripts/ark-golden-shots.mjs
 * builds it into `.ark-golden/` and serves it, nothing deploys it).
 *
 *   golden.html                      the live scene on the v2 fixture, as `window.__arkGolden`
 *   golden.html?quality=high|medium|low   the tier pinned (`__arkQuality`); default: the device decides
 *   golden.html?study=<direction>    an art-direction study instead (`study/art-study.ts`)
 *
 * The world adapter below is the one place that knows today's map modules:
 * when the map build changes them, update `goldenWorld` and the shots
 * (`golden-shots.ts`) keep their names and framing.
 */

import {decodeArkSnapshot, mountArk} from "@/ark-scene";
import type {ArkCameraView, ArkSceneHandle} from "@/ark-scene/types";
import {GOLDEN_MICRO, GOLDEN_PLACES, GOLDEN_TIMES, GOLDEN_WEATHER, goldenView, type GoldenPlace, type GoldenTime, type GoldenWorld} from "@/ark-scene/golden-shots";
import {attachPoints, place, type AttachPoint} from "@/ark-scene/sampler";
import {displayLength} from "@/ark-scene/sizes";
import {Box3, BufferGeometry, DoubleSide, Float32BufferAttribute, Group, Mesh as ThreeMesh, MeshStandardMaterial, Quaternion, Vector3, type Mesh, type Object3D, type PerspectiveCamera, type Scene} from "three";
import {GLTFLoader} from "three/examples/jsm/loaders/GLTFLoader.js";
import {MeshoptDecoder} from "three/examples/jsm/libs/meshopt_decoder.module.js";
import {LAKE, RIVER, ZONE_SITES, heightAt, regionCentre, sampleGround, zoneAt} from "@/ark-scene/world";
import {worldDecor} from "@/ark-scene/decor";
import {kelpStandSpot, reefCloseupSpot} from "@/ark-scene/reef";
import {pinSeaClock} from "@/ark-scene/fish-schools";
import {COTTAGE, microCorner} from "@/ark-scene/micro-decor";
import fixture from "@/ark-scene/fixtures/snapshot-v2.json";
import {mountArtStudy, type ArtStudyHandle} from "@/ark-scene/study/art-study";
import {goldenCropField, goldenObstacles} from "@/ark-scene/golden-world";

const MODELS = "https://wwhsdzpczekgdlobwaej.supabase.co/storage/v1/object/public/talking-models/v1/ark";
const ICONS = "https://wwhsdzpczekgdlobwaej.supabase.co/storage/v1/object/public/animals/";

function goldenWorld(handle: ArkSceneHandle): GoldenWorld {
    return {
        homeView: () => handle.homeView(),
        groundAt: (x, z) => heightAt(x, z),
        beach: () => ZONE_SITES.seashore,
        // Rocks at the waterline on open shore, not under a sea cliff (the beach's kind of coast).
        shoreRocks: () => worldDecor().filter((item) => item.kind === "rock" && item.y < 0.2 && item.y > -0.9 && sampleGround(item.x, item.z).cliff < 0.25 && Math.hypot(item.x - ZONE_SITES.seashore.x, item.z - ZONE_SITES.seashore.z) < 75 && zoneAt(sampleGround(item.x, item.z)) !== "polar").map((item) => ({x: item.x, z: item.z, scale: item.scale})),
        forestFloor: () => microCorner("woodland"),
        house: () => ({x: COTTAGE.x, z: COTTAGE.z}),
        fields: () => ZONE_SITES.farm_garden,
        lake: () => ({x: LAKE.x, z: LAKE.z}),
        river: () => RIVER.map(([x, z]) => ({x, z})),
        mountainArea: () => {
            const centre = regionCentre("high_cold");
            const site = ZONE_SITES.mountains;
            return {x: site.x, z: site.z - 6, radius: Math.max(centre.radius * 0.5, 26)};
        },
        reef: () => ZONE_SITES.coral_reef,
        reefCloseup: () => reefCloseupSpot(),
        kelpStand: () => kelpStandSpot(),
        forestClearing: () => ZONE_SITES.woodland,
        obstacles: () => goldenObstacles(),
        cropField: () => goldenCropField()
    };
}

/** The sea's clock for every shot (2026-11-11 10:00 UTC): the fish and the surge start from the same moment each time. */
const GOLDEN_SEA_EPOCH = 1_794_391_200;

/** Calm weather at mean tide: every golden shot unless it names its own (GOLDEN_WEATHER). */
const CALM_SHOT = {seaLevel: 0, wetness: 0, snow: 0, wind: 0.35, storm: 0, windDirection: 0.41, cloud: 0.35};

type Debug = {scene: Scene; camera: PerspectiveCamera; controls: {minDistance: number}};

/** A micro shot: the species' near model on the chosen attach point (its up along the point's normal), and the view onto it. */
async function microShot(handle: ArkSceneHandle, shot: NonNullable<(typeof GOLDEN_MICRO)[GoldenPlace]>, holder: {current: Object3D | null}): Promise<{view: ArkCameraView; anchor: string}> {
    const debug = (window as unknown as {__arkDebug?: Debug}).__arkDebug;
    const near = place(shot.near);
    const candidates = attachPoints({tag: shot.tag, near: {x: near.x, z: near.z, radius: shot.tag === "leaf" ? 40 : 18}});
    // The lowest leaf (closest to the camera's reach), the front wall (facing +z, toward the default camera), else the nearest.
    // The lowest leaf; a side wall of the house at eye height (the front is the porch); a low, sea-wet rock face that
    // faces the sky a little (a limpet's); else the nearest.
    const score = (point: AttachPoint) => {
        const p = point.position;
        // A leaf on top of an orchard tree's crown (its outside, in reach of a close camera).
        if (shot.tag === "leaf") return (point.hostKind === "orchard" ? 0 : point.hostKind === "broadleaf" ? 30 : 60) - point.normal.y * 5 + p.y * 0.2;
        if (shot.tag === "house_wall") return (Math.abs(point.normal.x) > 0.5 ? 0 : 10) + Math.abs(p.y - (COTTAGE.floor + 1.4));
        if (shot.tag === "rock_face") {
            // Seaward (the camera stands in the shallows), low and wet, near the shore rocks.
            const seaward = (point.normal.x * p.x + point.normal.z * p.z) / (Math.hypot(p.x, p.z) || 1);
            return (p.y > 0.5 || p.y < 0 ? 10 : 0) + (seaward < 0.3 ? 8 : 0) + (point.normal.y > 0.8 ? 4 : 0) + Math.hypot(p.x - near.x, p.z - near.z) * 0.2;
        }
        return Math.hypot(p.x - near.x, p.z - near.z);
    };
    const scored = candidates.map((point) => ({point, score: score(point)}));
    scored.sort((a, b) => a.score - b.score);
    const point: AttachPoint | undefined = scored[0]?.point;
    if (!point || !debug) return {view: handle.homeView(), anchor: `missing ${shot.tag}`};
    if (holder.current) debug.scene.remove(holder.current);
    const manifest = await (await fetch(`${MODELS}/manifest.json`)).json() as {models: Record<string, string>};
    const version = manifest.models[shot.slug];
    const group = new Group();
    if (version) {
        const loader = new GLTFLoader();
        loader.setMeshoptDecoder(MeshoptDecoder);
        const gltf = await loader.loadAsync(`${MODELS}/${shot.slug}/${version}.near.glb`);
        const model = gltf.scene;
        const box = new Box3().setFromObject(model);
        const size = box.getSize(new Vector3());
        const length = displayLength(shot.slug);
        model.scale.setScalar(length / Math.max(size.z, size.x, 1e-3));
        model.position.y = -box.min.y * model.scale.y;
        model.traverse((object) => {
            const mesh = object as Mesh;
            if (mesh.isMesh) {
                mesh.castShadow = true;
                mesh.receiveShadow = true;
            }
        });
        group.add(model);
    }
    if (shot.tag === "leaf") group.add(nearLeaf());
    const n = new Vector3(point.normal.x, point.normal.y, point.normal.z).normalize();
    group.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), n).multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), point.yaw));
    group.position.set(point.position.x, point.position.y, point.position.z);
    debug.scene.add(group);
    holder.current = group;
    debug.controls.minDistance = 0.3;
    // The camera out along the surface's normal, lifted a little: it looks at the animal on its surface, from outside it.
    const out = n.clone();
    if (shot.tag === "leaf") out.set(n.x + 0.35, 1.6, n.z + 0.35);
    else out.y = Math.max(out.y, 0) * 0.55 + 0.35;
    if (Math.hypot(out.x, out.z) < 0.25) out.set(Math.sin(point.yaw + 0.6) * 0.8, out.y, Math.cos(point.yaw + 0.6) * 0.8);
    out.normalize();
    const view: ArkCameraView = {
        target: {x: point.position.x + n.x * 0.05, y: point.position.y + n.y * 0.05, z: point.position.z + n.z * 0.05},
        distance: shot.distance,
        polar: Math.acos(Math.min(Math.max(out.y, -1), 1)),
        azimuth: Math.atan2(out.x, out.z)
    };
    return {view, anchor: `${point.id} (${shot.slug})`};
}

/** A real leaf to sit on (the near version of a crown's leaf: graphics pass), 14 cm long, curved, with a midrib. */
function nearLeaf(): Mesh {
    const shape: number[] = [];
    const steps = 8;
    for (let i = 0; i < steps; i++) {
        for (const side of [-1, 1]) {
            const t0 = i / steps;
            const t1 = (i + 1) / steps;
            const w0 = 0.045 * Math.sin(Math.PI * t0) ** 0.8 * side;
            const w1 = 0.045 * Math.sin(Math.PI * t1) ** 0.8 * side;
            const z0 = (t0 - 0.5) * 0.14;
            const z1 = (t1 - 0.5) * 0.14;
            const c = (t: number, w: number) => -0.012 * Math.sin(Math.PI * t) + Math.abs(w) * 0.25;
            shape.push(0, c(t0, 0), z0, w0, c(t0, w0), z0, w1, c(t1, w1), z1, 0, c(t0, 0), z0, w1, c(t1, w1), z1, 0, c(t1, 0), z1);
        }
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new Float32BufferAttribute(shape, 3));
    geometry.computeVertexNormals();
    const mesh = new ThreeMesh(geometry, new MeshStandardMaterial({color: "#5d8a35", roughness: 0.6, side: DoubleSide}));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.position.y = -0.004;
    return mesh;
}

type Measure = {
    /** Wall time between drawn frames (what the reader sees), ms. */
    intervalP50: number;
    intervalP95: number;
    fps: number;
    /** The scene's own CPU time per frame (update + render submit), ms. */
    cpuMs: number;
    /** Extra wait for the GPU to finish the frame (a 1-pixel readPixels after it), ms. */
    gpuDrainMs: number;
    drawCalls: number;
    triangles: number;
    tier: string;
    lite: boolean;
    pixelRatio: number;
    near: number;
    far: number;
    modelsLoaded: number;
};

const percentile = (values: number[], p: number) => {
    if (!values.length) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
};
const round = (value: number) => Math.round(value * 100) / 100;
const nextFrame = () => new Promise<number>((resolve) => requestAnimationFrame(resolve));

/** Frames for `ms`: intervals free-running, then (for half as long) each frame drained with a 1-pixel read. */
async function measureFrames(canvas: HTMLCanvasElement, ms: number): Promise<{intervals: number[]; drains: number[]}> {
    const gl = (canvas.getContext("webgl2") ?? canvas.getContext("webgl")) as WebGLRenderingContext | null;
    const pixel = new Uint8Array(4);
    const intervals: number[] = [];
    const drains: number[] = [];
    let last = await nextFrame();
    const until = performance.now() + ms;
    while (performance.now() < until) {
        const now = await nextFrame();
        intervals.push(now - last);
        last = now;
    }
    const drainUntil = performance.now() + ms / 2;
    while (gl && performance.now() < drainUntil) {
        await nextFrame();
        const started = performance.now();
        gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
        drains.push(performance.now() - started);
    }
    return {intervals, drains};
}

async function mountGolden(el: HTMLElement) {
    const params = new URLSearchParams(location.search);
    const quality = params.get("quality");
    if (quality === "high" || quality === "medium" || quality === "low") (globalThis as {__arkQuality?: string}).__arkQuality = quality;
    const snapshot = decodeArkSnapshot(fixture);
    if (!snapshot) throw new Error("fixture did not decode");
    let ready = false;
    const handle = mountArk(el, {
        snapshot,
        modelBase: MODELS,
        iconUrl: (slug) => ICONS + encodeURIComponent(slug) + ".webp",
        recording: true,
        hours: GOLDEN_TIMES.day,
        onReady: () => {
            ready = true;
        }
    });
    // Every golden shot in the same calm weather at mean tide, whatever the island clock says today.
    handle.setEnvironment(CALM_SHOT);
    const canvas = el.querySelector("canvas") as HTMLCanvasElement;
    const world = goldenWorld(handle);
    const holder: {current: Object3D | null} = {current: null};

    const settle = async (quietMs: number, maxMs = 90_000) => {
        const until = performance.now() + maxMs;
        let quietSince = 0;
        while (performance.now() < until) {
            await new Promise((resolve) => setTimeout(resolve, 80));
            if (!ready || handle.loading()) quietSince = 0;
            else if (!quietSince) quietSince = performance.now();
            else if (performance.now() - quietSince > quietMs) return true;
        }
        return false;
    };

    // The flythrough's route: the golden places in turn, eased, pulling back between them; morning to night.
    const route: GoldenPlace[] = ["island_far", "coast_rocks", "waves_beach", "river_pond", "house_fields", "forest_floor", "mountain", "island_far"];
    let routeViews: ArkCameraView[] | null = null;
    const flyAt = (t: number) => {
        const views = routeViews ?? (routeViews = route.map((where) => goldenView(where, world).view));
        const ease = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2);
        const angle = (a: number, b: number, k: number) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * k;
        t = Math.min(Math.max(t, 0), 1);
        const leg = Math.min(Math.floor(t * (views.length - 1)), views.length - 2);
        const k = ease(Math.min(t * (views.length - 1) - leg, 1));
        const a = views[leg];
        const b = views[leg + 1];
        const lift = Math.sin(Math.PI * k) * 0.6;
        handle.setView({
            target: {x: a.target.x + (b.target.x - a.target.x) * k, y: a.target.y + (b.target.y - a.target.y) * k, z: a.target.z + (b.target.z - a.target.z) * k},
            distance: (a.distance + (b.distance - a.distance) * k) * (1 + lift * 2.5),
            polar: a.polar + (b.polar - a.polar) * k - lift * 0.25,
            azimuth: angle(a.azimuth, b.azimuth, k)
        });
        handle.setHours(10.5 + 11.5 * t);
    };

    return {
        places: GOLDEN_PLACES,
        times: GOLDEN_TIMES,
        /** Every species' models in, before the first shot (so nothing pops in). */
        prepare: async () => {
            await settle(200);
            await handle.preload(Array.from(new Set(snapshot.animals.map((animal) => animal.model_slug))));
            const settled = await settle(1500, 150_000);
            return {settled, stats: handle.stats()};
        },
        /** Frame the named place in the named light; resolves once it is drawn and quiet. */
        shoot: async (where: GoldenPlace, time: GoldenTime) => {
            const micro = GOLDEN_MICRO[where];
            const shot = micro ? {...(await microShot(handle, micro, holder)), place: where} : goldenView(where, world);
            if (!micro && holder.current) {
                (window as unknown as {__arkDebug?: Debug}).__arkDebug?.scene.remove(holder.current);
                holder.current = null;
            }
            handle.setHours(GOLDEN_TIMES[time]);
            handle.setEnvironment({...CALM_SHOT, ...(GOLDEN_WEATHER[where] ?? {})});
            pinSeaClock(GOLDEN_SEA_EPOCH);
            // A golden-only camera (batch 5): the shot's own limits, for this shot only.
            (window as unknown as {__arkGoldenCamera?: unknown}).__arkGoldenCamera = "camera" in shot ? shot.camera : undefined;
            handle.setView(shot.view);
            // The view keeps itself over the ground for a few frames (setView, then the scene's own limits): hold it there.
            for (let i = 0; i < 20; i++) {
                await nextFrame();
                if (i < 6) handle.setView(shot.view);
            }
            await settle(700, 30_000);
            if (micro) {
                // The scene eases its closest distance back out each frame when nothing is selected: hold the close-up.
                const debug = (window as unknown as {__arkDebug?: Debug}).__arkDebug;
                for (let i = 0; i < 3; i++) {
                    if (debug) debug.controls.minDistance = 0.3;
                    handle.setView(shot.view);
                    await nextFrame();
                }
            }
            return {anchor: shot.anchor, asked: shot.view, actual: handle.view() as ArkCameraView};
        },
        measure: async (ms = 3000): Promise<Measure> => {
            const {intervals, drains} = await measureFrames(canvas, ms);
            const stats = handle.stats();
            const p50 = percentile(intervals, 0.5);
            return {
                intervalP50: round(p50),
                intervalP95: round(percentile(intervals, 0.95)),
                fps: round(intervals.length / (intervals.reduce((sum, value) => sum + value, 0) / 1000)),
                cpuMs: round(stats.frameMs),
                gpuDrainMs: round(percentile(drains, 0.5)),
                drawCalls: stats.drawCalls,
                triangles: stats.triangles,
                tier: stats.tier,
                lite: stats.lite,
                pixelRatio: stats.pixelRatio,
                near: stats.near,
                far: stats.far,
                modelsLoaded: stats.modelsLoaded
            };
        },
        stats: () => handle.stats(),
        /**
         * The flythrough (graphics pass): `seconds` of flight through the golden places in turn, eased, the hour going
         * from morning through dusk to night, in real time. Returns the frame intervals over the whole flight.
         */
        /** The flythrough's view and hour at `t` (0…1): for a frame-by-frame video. */
        flyAt: (t: number) => flyAt(t),
        flythrough: async (seconds = 60) => {
            const intervals: number[] = [];
            const start = performance.now();
            let last = start;
            for (;;) {
                const now = await nextFrame();
                intervals.push(now - last);
                last = now;
                const t = Math.min((now - start) / 1000 / seconds, 1);
                flyAt(t);
                if (t >= 1) break;
            }
            const sorted = [...intervals].sort((x, y) => x - y);
            return {frames: intervals.length, p50: round(sorted[Math.floor(sorted.length * 0.5)]), p95: round(sorted[Math.floor(sorted.length * 0.95)]), p99: round(sorted[Math.floor(sorted.length * 0.99)]), fps: round(intervals.length / seconds), stats: handle.stats()};
        }
    };
}

type GoldenApi = Awaited<ReturnType<typeof mountGolden>>;

declare global {
    interface Window {
        __arkGolden?: GoldenApi;
        __arkStudy?: ArtStudyHandle & {measure: (ms?: number) => Promise<{intervalP50: number; intervalP95: number; fps: number; gpuDrainMs: number}>};
        __arkGoldenError?: string;
    }
}

(async () => {
    const el = document.getElementById("ark") as HTMLElement;
    const study = new URLSearchParams(location.search).get("study");
    try {
        if (study) {
            const handle = await mountArtStudy(el, study);
            window.__arkStudy = {
                ...handle,
                measure: async (ms = 3000) => {
                    const {intervals, drains} = await measureFrames(handle.canvas, ms);
                    return {
                        intervalP50: round(percentile(intervals, 0.5)),
                        intervalP95: round(percentile(intervals, 0.95)),
                        fps: round(intervals.length / (intervals.reduce((sum, value) => sum + value, 0) / 1000)),
                        gpuDrainMs: round(percentile(drains, 0.5))
                    };
                }
            };
        } else {
            window.__arkGolden = await mountGolden(el);
        }
    } catch (error) {
        window.__arkGoldenError = String((error as Error)?.stack ?? error);
    }
})();
