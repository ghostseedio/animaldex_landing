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
import {GOLDEN_MICRO, GOLDEN_PLACES, GOLDEN_TIMES, goldenView, type GoldenPlace, type GoldenTime, type GoldenWorld} from "@/ark-scene/golden-shots";
import {attachPoints, place, type AttachPoint} from "@/ark-scene/sampler";
import {displayLength} from "@/ark-scene/sizes";
import {Box3, BufferGeometry, DoubleSide, Float32BufferAttribute, Group, Mesh as ThreeMesh, MeshStandardMaterial, Quaternion, Vector3, type Mesh, type Object3D, type PerspectiveCamera, type Scene} from "three";
import {GLTFLoader} from "three/examples/jsm/loaders/GLTFLoader.js";
import {MeshoptDecoder} from "three/examples/jsm/libs/meshopt_decoder.module.js";
import {LAKE, RIVER, ZONE_SITES, heightAt, regionCentre, sampleGround, zoneAt} from "@/ark-scene/world";
import {worldDecor} from "@/ark-scene/decor";
import {COTTAGE, microCorner} from "@/ark-scene/micro-decor";
import fixture from "@/ark-scene/fixtures/snapshot-v2.json";
import {mountArtStudy, type ArtStudyHandle} from "@/ark-scene/study/art-study";

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
        reef: () => ZONE_SITES.coral_reef
    };
}

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
        if (shot.tag === "leaf") return p.y - Math.hypot(point.normal.x, point.normal.z) * 4 + (point.hostKind === "broadleaf" || point.hostKind === "orchard" ? 0 : 20);
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
    if (shot.tag === "leaf") out.set(n.x * 3, 0.6, n.z * 3);
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
/**
 * The world moment every animal close-up starts from (its schedules, so before and after match): island midday,
 * awake animals and no dawn mist (the mist pools by the world clock's hour, not the pinned light).
 */
const GOLDEN_WORLD_MS = Date.UTC(2026, 10, 11, 12, 30);
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
        // The animal-look pass: `?look=0` starts with it off; `?closeup=<url>` serves the close-up skins (the harness's local build).
        animalLook: params.get("look") !== "0",
        closeUpBase: params.get("closeup") || undefined,
        onReady: () => {
            ready = true;
        }
    });
    // Every golden shot in the same calm weather at mean tide, whatever the island clock says today.
    handle.setEnvironment({seaLevel: 0, wetness: 0, snow: 0, wind: 0.35, storm: 0, windDirection: 0.41, cloud: 0.35});
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
            handle.setView(shot.view);
            // The view keeps itself over the ground for a few frames (setView, then the scene's own limits): hold it there.
            for (let i = 0; i < 20; i++) {
                await nextFrame();
                if (i < 6) handle.setView(shot.view);
            }
            await settle(700, 30_000);
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
         * The animal-look pass's close-ups (docs/ark/animal-look.md): one animal of the species, face to face from
         * three-quarters in front, as close as a viewer can come (the scene's 4 m floor; a small animal's own close
         * distance), from the first bearing where no other animal and no ground stands between, in the named light,
         * the pass on or off, dry or in the rain. Still (reduced motion: before and after are the same pose), or
         * `moving` (the rig plays: a rigged animal, so the look is checked on skinned meshes). `detail` comes closer
         * than a viewer can (development only: the 4 m floor held down) to judge the surface itself. The world clock
         * restarts from one fixed moment for every shot, so before and after catch the animal in the same place.
         * Resolves once its close-up skin is in and the frame is quiet.
         */
        animal: async (slug: string, time: GoldenTime, options: {look: boolean; wetness?: number; still?: boolean; distance?: number; turn?: number; detail?: boolean}) => {
            const kin = snapshot.animals.filter((row) => row.model_slug === slug);
            if (!kin.length) return {found: false as const};
            const moving = options.still === false;
            const debug = (window as unknown as {__arkDebug?: Debug}).__arkDebug;
            // A small animal needs no pin (the scene drops its floor to 8 cm round one; 0.3 m would only push the camera back).
            let pinning = Boolean((options.detail || moving) && debug && (handle.locate(kin[0].id)?.length ?? 1) >= 0.3);
            const pin = () => {
                if (!pinning || !debug) return;
                debug.controls.minDistance = 0.3;
                requestAnimationFrame(pin);
            };
            pin();
            const restart = () => handle.setClockScale(1, GOLDEN_WORLD_MS);
            // Twice, with frames between, so every animal's trip is planned from the same moment whatever came before.
            restart();
            for (let i = 0; i < 30; i++) await nextFrame();
            restart();
            handle.setReducedMotion(!moving);
            // Swims timed by a fixed island moment, so the same animals are wet from a swim in every run.
            handle.setAnimalLook(options.look, {islandMs: Date.UTC(2026, 10, 11, 10, 7)});
            const wet = options.wetness ?? 0;
            handle.setEnvironment({seaLevel: 0, wetness: wet, rain: wet, snow: 0, wind: 0.35, storm: 0, windDirection: 0.41});
            handle.setHours(GOLDEN_TIMES[time]);
            for (let i = 0; i < 4; i++) await nextFrame();
            const others = snapshot.animals.map((row) => ({id: row.id, at: handle.locate(row.id)}));
            // A small animal: the scene's own close distance (about six lengths); the rest as close as the 4 m floor allows.
            const distanceFor = (length: number) =>
                options.distance ??
                (length < 0.3 ? (options.detail || moving ? Math.max(0.06, length * 3) : Math.max(0.12, length * 6)) : options.detail || moving ? Math.max(0.35, length * 1.35 + 0.3) : Math.max(4, length * 1.2 + 1.5));
            // Its size for framing: the longer of length and height (a penguin stands taller than it is long).
            const sizeOf = (at: NonNullable<ReturnType<typeof handle.locate>>) => Math.max(at.length, at.height);
            // Under the sea, level with it (as the scene dives to a swimmer), so the camera is under the surface too.
            const polarFor = (at: NonNullable<ReturnType<typeof handle.locate>>) => (at.y < -0.3 ? 1.52 : 1.3);
            // Its middle where it is now (`ground` is its home spot's, not where a walk has taken it).
            const targetOf = (at: NonNullable<ReturnType<typeof handle.locate>>) => ({x: at.x, y: at.y - at.height * 0.05, z: at.z});
            /** Nothing between the camera and the animal: no other animal's body, and the ground below the line. */
            const clear = (id: string, at: NonNullable<ReturnType<typeof handle.locate>>, azimuth: number) => {
                const target = targetOf(at);
                const distance = distanceFor(sizeOf(at));
                const polar = polarFor(at);
                const camera = {x: target.x + distance * Math.sin(polar) * Math.sin(azimuth), y: target.y + distance * Math.cos(polar), z: target.z + distance * Math.sin(polar) * Math.cos(azimuth)};
                for (let t = 0.1; t < 0.95; t += 0.1) {
                    const x = camera.x + (target.x - camera.x) * t;
                    const z = camera.z + (target.z - camera.z) * t;
                    if (camera.y + (target.y - camera.y) * t < handle.heightAt(x, z) + 0.05) return false;
                }
                for (const other of others) {
                    if (other.id === id || !other.at) continue;
                    const radius = Math.max(other.at.length * 0.55, other.at.height * 0.6) + 0.15;
                    const dx = target.x - camera.x;
                    const dy = target.y - camera.y;
                    const dz = target.z - camera.z;
                    const t = ((other.at.x - camera.x) * dx + (other.at.y - camera.y) * dy + (other.at.z - camera.z) * dz) / (dx * dx + dy * dy + dz * dz);
                    if (t <= 0 || t >= 1) continue;
                    const px = camera.x + dx * t - other.at.x;
                    const py = camera.y + dy * t - other.at.y;
                    const pz = camera.z + dz * t - other.at.z;
                    if (px * px + py * py + pz * pz < radius * radius) return false;
                }
                return true;
            };
            const turns = options.turn !== undefined ? [options.turn] : [0.55, -0.55, 0.95, -0.95, 0.2, -0.2, 1.4, -1.4];
            let chosen: {id: string; turn: number} | null = null;
            for (const turn of turns) {
                for (const row of kin) {
                    const at = handle.locate(row.id);
                    if (at && clear(row.id, at, at.yaw + turn)) {
                        chosen = {id: row.id, turn};
                        break;
                    }
                }
                if (chosen) break;
            }
            const pick = chosen ?? {id: kin[0].id, turn: options.turn ?? 0.55};
            let at = handle.locate(pick.id);
            if (!at) {
                pinning = false;
                return {found: false as const};
            }
            const frame = () => {
                at = handle.locate(pick.id) ?? at;
                const located = at!;
                const view: ArkCameraView = {target: targetOf(located), distance: distanceFor(sizeOf(located)), polar: polarFor(located), azimuth: located.yaw + pick.turn};
                handle.setView(view);
                return view;
            };
            let view = frame();
            for (let i = 0; i < 24; i++) {
                await nextFrame();
                if (i < 8 || moving) view = frame();
            }
            // The close-up skin (when served), its rig (moving) and any new shader in before the shot.
            const until = performance.now() + 9000;
            while (performance.now() < until) {
                await new Promise((resolve) => setTimeout(resolve, 120));
                if (moving) view = frame();
                const stats = handle.stats();
                const skinIn = !options.look || (stats.closeUpSkins ?? 0) > 0 || !params.get("closeup");
                if (skinIn && (!moving || stats.rigged > 0)) break;
            }
            if (!moving) await settle(500, 20_000);
            // Everything is in: the clock back to the fixed moment and the same number of frames for every shot, so
            // before and after catch the animal at the same place (and a moving one mid-stride).
            restart();
            for (let i = 0; i < 30; i++) {
                await nextFrame();
                view = frame();
            }
            pinning = false;
            const stats = handle.stats();
            return {found: true as const, id: pick.id, clear: Boolean(chosen), view, located: at, closeUpSkins: stats.closeUpSkins ?? 0, furShells: stats.furShells ?? 0, rigged: stats.rigged};
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
