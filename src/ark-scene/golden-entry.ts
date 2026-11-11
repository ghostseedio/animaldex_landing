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
import * as arkSampler from "@/ark-scene/sampler";
import {attachPointAt, attachPoints, place, type AttachPoint} from "@/ark-scene/sampler";
import {displayLength} from "@/ark-scene/sizes";
import {arkBody, bodyAxisExtent} from "@/ark-scene/stats";
import {microDrawnLength} from "@/ark-scene/micro";
import {ARK_TIME, ARK_WIND} from "@/ark-scene/glsl";
import {Box3, Group, Quaternion, Raycaster, Vector3, type InstancedMesh, type Mesh, type Object3D, type PerspectiveCamera, type Scene} from "three";
import {GLTFLoader} from "three/examples/jsm/loaders/GLTFLoader.js";
import {MeshoptDecoder} from "three/examples/jsm/libs/meshopt_decoder.module.js";
import {LAKE, RIVER, ZONE_SITES, heightAt, regionCentre, sampleGround, zoneAt} from "@/ark-scene/world";
import {worldDecor} from "@/ark-scene/decor";
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
        forestClearing: () => ZONE_SITES.woodland,
        obstacles: () => goldenObstacles(),
        cropField: () => goldenCropField()
    };
}

/** Calm weather at mean tide: every golden shot unless it names its own (GOLDEN_WEATHER). */
const CALM_SHOT = {seaLevel: 0, wetness: 0, snow: 0, wind: 0.35, storm: 0, windDirection: 0.41, cloud: 0.35};

type Debug = {scene: Scene; camera: PerspectiveCamera; controls: {minDistance: number}; lighting?: {sun?: {position: Vector3; target: {position: Vector3}}}};

/** The micro shot on screen: its animal, the closest the camera may come, and how to stop it following its leaf. */
type Holder = {current: Object3D | null; minDistance: number; stop: (() => void) | null; chosen: Map<string, {point: AttachPoint; out: Vector3; checked: string}>};

const nextFrames = async (count: number) => {
    for (let i = 0; i < count; i++) await new Promise((resolve) => requestAnimationFrame(resolve));
};

/** The view onto a point from out along its surface, `distance` away, looking at `lift` above it. */
function viewOnto(point: AttachPoint, out: Vector3, distance: number, lift: number): ArkCameraView {
    const n = point.normal;
    return {
        target: {x: point.position.x + n.x * lift, y: point.position.y + n.y * lift, z: point.position.z + n.z * lift},
        distance,
        polar: Math.acos(Math.min(Math.max(out.y, -1), 1)),
        azimuth: Math.atan2(out.x, out.z)
    };
}

/** Out from a tree's point: along its normal, away from the trunk, and (for a leaf) from above. */
function treeOut(point: AttachPoint): Vector3 {
    const n = new Vector3(point.normal.x, point.normal.y, point.normal.z);
    const root = point.wind?.root ?? point.position;
    const away = new Vector3(point.position.x - root.x, 0, point.position.z - root.z);
    if (away.lengthSq() > 1e-4) away.normalize();
    // A leaf from outside the crown and above; bark from beside the trunk, so the trunk runs off to one side.
    const side = new Vector3(-n.z, 0, n.x);
    const out = point.tag === "leaf" ? n.clone().addScaledVector(away, 0.8) : n.clone().addScaledVector(side, 1.1);
    out.y += point.tag === "leaf" ? 0.25 : 0.35;
    // Never steeper than the controls allow (they keep the camera 0.12–1.36 rad from straight down).
    out.normalize();
    const polar = Math.min(Math.max(Math.acos(out.y), 0.2), 1.3);
    const azimuth = Math.atan2(out.x, out.z);
    return new Vector3(Math.sin(polar) * Math.sin(azimuth), Math.cos(polar), Math.sin(polar) * Math.cos(azimuth));
}

/** Where the camera stands, seen from the point: out from a tree (`treeOut`); else out along the surface's normal, lifted a little. */
function outFrom(point: AttachPoint): Vector3 {
    if (point.wind) return treeOut(point);
    const out = new Vector3(point.normal.x, point.normal.y, point.normal.z);
    out.y = Math.max(out.y, 0) * 0.55 + 0.35;
    if (Math.hypot(out.x, out.z) < 0.25) out.set(Math.sin(point.yaw + 0.6) * 0.8, out.y, Math.cos(point.yaw + 0.6) * 0.8);
    return out.normalize();
}

/** Nothing drawn between the camera and the point (any visible mesh: trees, canopy crowns, rocks, the house). */
function clearSight(debug: Debug, view: ArkCameraView, point: AttachPoint, skip: Object3D | null): string | null {
    const meshes: Object3D[] = [];
    debug.scene.traverseVisible((object) => {
        const mesh = object as Mesh;
        if (!mesh.isMesh || object === skip) return;
        // Instance counts change with the camera: bound them afresh.
        if ((object as InstancedMesh).isInstancedMesh) (object as InstancedMesh).boundingSphere = null;
        meshes.push(object);
    });
    const from = new Vector3().setFromSphericalCoords(view.distance, view.polar, view.azimuth).add(new Vector3(view.target.x, view.target.y, view.target.z));
    const to = new Vector3(point.position.x, point.position.y, point.position.z);
    const length = from.distanceTo(to);
    const toward = to.clone().sub(from).normalize();
    const there = new Raycaster(from, toward, 0, Math.max(length - 0.012, 0)).intersectObjects(meshes, false)[0];
    // And back from just off the point: one-sided surfaces (a rock) are only seen from outside.
    const back = new Raycaster(to.clone().addScaledVector(toward, -0.012), toward.clone().negate(), 0, Math.max(length - 0.012, 0)).intersectObjects(meshes, false)[0];
    const hit = there ?? back;
    return hit ? String(hit.object.userData.kind ?? hit.object.name ?? hit.object.type) : null;
}

/** The share of the picture (a 7 × 5 grid over its middle 80 %) with something drawn well in front of the subject. */
function clutterOf(debug: Debug, view: ArkCameraView): number {
    const meshes: Object3D[] = [];
    debug.scene.traverseVisible((object) => {
        if ((object as Mesh).isMesh) meshes.push(object);
    });
    const target = new Vector3(view.target.x, view.target.y, view.target.z);
    const from = new Vector3().setFromSphericalCoords(view.distance, view.polar, view.azimuth).add(target);
    const forward = target.clone().sub(from).normalize();
    const right = new Vector3().crossVectors(forward, new Vector3(0, 1, 0)).normalize();
    const up = new Vector3().crossVectors(right, forward);
    const tanY = Math.tan((debug.camera.fov * Math.PI) / 360);
    const tanX = tanY * debug.camera.aspect;
    let hits = 0;
    let rays = 0;
    for (let i = 0; i < 7; i++) {
        for (let j = 0; j < 5; j++) {
            const x = (i / 6 - 0.5) * 1.6 * tanX;
            const y = (j / 4 - 0.5) * 1.6 * tanY;
            const dir = forward.clone().addScaledVector(right, x).addScaledVector(up, y).normalize();
            rays++;
            if (new Raycaster(from, dir, 0, view.distance * 0.8).intersectObjects(meshes, false).length) hits++;
        }
    }
    return hits / rays;
}

/** Something drawn between the point and the sun (a crown overhead, a neighbour): the point is in shade. */
function inShade(debug: Debug, point: AttachPoint, sun: Vector3): boolean {
    const meshes: Object3D[] = [];
    debug.scene.traverseVisible((object) => {
        const mesh = object as Mesh;
        if (!mesh.isMesh) return;
        // Not the sky, cloud dome or the whole island's ground: only what can stand between a leaf and the sun.
        const geometry = mesh.geometry;
        if (!geometry.boundingSphere) geometry.computeBoundingSphere();
        if ((geometry.boundingSphere?.radius ?? 0) > 120 && !(object as InstancedMesh).isInstancedMesh) return;
        meshes.push(object);
    });
    const from = new Vector3(point.position.x + point.normal.x * 0.01, point.position.y + point.normal.y * 0.01, point.position.z + point.normal.z * 0.01);
    return new Raycaster(from, sun, 0, 60).intersectObjects(meshes, false).length > 0;
}

/**
 * A micro shot: the species' near model at its true size on the chosen attach point (its up along the point's
 * normal, facing along the surface), following the point's sway in the wind, and the view onto it.
 */
async function microShot(handle: ArkSceneHandle, shot: NonNullable<(typeof GOLDEN_MICRO)[GoldenPlace]>, holder: Holder): Promise<{view: ArkCameraView; anchor: string}> {
    const debug = (window as unknown as {__arkDebug?: Debug}).__arkDebug;
    const near = place(shot.near);
    const length = arkBody({model_slug: shot.slug} as never).metres;
    // As the scene frames a small animal you tap (index.ts: its length × 6, 0.12–3 m), unless the shot says.
    const distance = shot.distance ?? Math.min(Math.max(length * 6, 0.12), 3);
    holder.minDistance = Math.min(0.3, distance * 0.7);
    // The scene eases its closest distance back out every frame when none of ITS small animals is near the target
    // (this one is the page's): hold it at the shot's while the shot is up, or the camera drifts out before the picture.
    const controls = debug?.controls;
    if (controls && !Object.getOwnPropertyDescriptor(controls, "minDistance")?.get) {
        Object.defineProperty(controls, "minDistance", {configurable: true, get: () => holder.minDistance, set: () => {}});
    }
    // Where the sun is (the shot's own hour comes later, but the morning sun is the same side): lit faces score better.
    const sunNow = () => {
        const sunLight = debug?.lighting?.sun;
        return sunLight ? sunLight.position.clone().sub(sunLight.target.position).normalize() : new Vector3(0.5, 0.7, 0.5).normalize();
    };
    let sun = sunNow();
    // The point is chosen in the morning light whatever the shot's own hour (set after this), so it is the same in all three.
    if (!holder.chosen.has(shot.slug + shot.tag)) {
        handle.setHours(GOLDEN_TIMES.day);
        await nextFrames(2);
        sun = sunNow();
    }
    const lit = (point: AttachPoint) => Math.max(point.normal.x * sun.x + point.normal.y * sun.y + point.normal.z * sun.z, 0);
    const tree = shot.tag === "leaf" || shot.tag === "bark";
    const candidates = attachPoints({tag: shot.tag, near: {x: near.x, z: near.z, radius: tree ? 40 : 18}})
        .filter((point) => !tree || (length >= point.size[0] && length <= point.size[1] * 1.2));
    // A leaf or bark in the open, on a broadleaf tree's crown or trunk, near the forest floor; a side wall of the
    // house at eye height (the front is the porch); a low, sea-wet rock face that faces the sky a little (a
    // limpet's); else the nearest.
    const score = (point: AttachPoint) => {
        const p = point.position;
        const broadleaf = point.hostKind === "broadleaf" || point.hostKind === "orchard" ? 0 : 20;
        const asset = point.asset ?? "";
        if (shot.tag === "leaf") {
            // A single leaf a hand long (10–23 cm: a caterpillar's leaf, not a 30 cm stylised oak leaf), in the open and the sun.
            const handsome = point.size[1] >= 0.06 && point.size[1] <= 0.14 ? 0 : 25;
            return broadleaf + handsome + (point.leaf === "blade" ? 0 : 15) + (1 - (point.open ?? 0)) * 30 + (1 - point.normal.y) * 6 - lit(point) * 8 + Math.hypot(p.x - near.x, p.z - near.z) * 0.05;
        }
        // Pale bark (birch, beech) in the sun, about chest height, so a black ant shows on it.
        if (shot.tag === "bark") return broadleaf + (/^birch/.test(asset) ? 0 : /^beech/.test(asset) ? 4 : 12) + (1 - (point.open ?? 0)) * 30 - lit(point) * 10 + Math.abs(p.y - heightAt(p.x, p.z) - 1.3) * 2 + Math.hypot(p.x - near.x, p.z - near.z) * 0.02;
        if (shot.tag === "house_wall") return (Math.abs(point.normal.x) > 0.5 ? 0 : 10) + Math.abs(p.y - (COTTAGE.floor + 1.4));
        if (shot.tag === "rock_face") {
            // Seaward (the camera stands in the shallows), low and wet, near the shore rocks.
            const seaward = (point.normal.x * p.x + point.normal.z * p.z) / (Math.hypot(p.x, p.z) || 1);
            return (p.y > 0.5 || p.y < 0 ? 10 : 0) + (seaward < 0.3 ? 8 : 0) + (point.normal.y > 0.8 ? 4 : 0) + Math.hypot(p.x - near.x, p.z - near.z) * 0.2;
        }
        return Math.hypot(p.x - near.x, p.z - near.z);
    };
    const ranked = candidates.map((point) => ({point, score: score(point)})).sort((a, b) => a.score - b.score).map(({point}) => point);
    if (!ranked.length || !debug) return {view: handle.homeView(), anchor: `missing ${shot.tag}`};
    if (holder.current) debug.scene.remove(holder.current);
    holder.stop?.();
    holder.stop = null;
    holder.current = null;
    const lift = Math.max(length * 0.35, 0.004);
    let point = ranked[0];
    let out = outFrom(point);
    let checked = "";
    // The same point in every light: chosen once per shot, in the morning (the shot's own hour is set after this).
    const known = holder.chosen.get(shot.slug + shot.tag);
    if (known) {
        point = known.point;
        out = known.out;
        checked = known.checked;
    } else {
        // Of the best few, one seen from where the camera will be with nothing in between (either way along the sight
        // line: a camera inside a rock sees nothing of it); on a tree, in the sun if any is (nothing between it and
        // the sun), then with the least foreground clutter (leaves right in front of the lens).
        type Option = {point: AttachPoint; out: Vector3; sunlit: boolean; clutter: number; rank: number};
        const options: Option[] = [];
        const blockers: string[] = [];
        let rank = 0;
        for (const candidate of ranked.slice(0, tree ? 16 : 8)) {
            rank++;
            const o = outFrom(candidate);
            const view = viewOnto(candidate, o, distance, lift);
            debug.controls.minDistance = holder.minDistance;
            handle.setView(view);
            await nextFrames(3);
            const blocked = clearSight(debug, view, candidate, holder.current);
            if (blocked) {
                blockers.push(blocked);
                continue;
            }
            options.push({point: candidate, out: o, sunlit: tree && lit(candidate) > 0.15 && !inShade(debug, candidate, sun), clutter: tree ? clutterOf(debug, view) : 0, rank});
            if (!tree) break;
        }
        options.sort((x, y) => Number(y.sunlit) - Number(x.sunlit) || Math.round(x.clutter * 10) - Math.round(y.clutter * 10) || x.rank - y.rank);
        const pick = options[0] ?? null;
        if (pick) {
            point = pick.point;
            out = pick.out;
        }
        const skipped = blockers.length ? ` (skipped ${blockers.length}: ${Array.from(new Set(blockers)).join("/")})` : "";
        checked = pick ? `, clear sight${tree ? `${pick.sunlit ? ", in the sun" : ", in shade"}, clutter ${pick.clutter.toFixed(2)}` : ""}${skipped}` : `, no clear sight in the best ${rank}`;
        holder.chosen.set(shot.slug + shot.tag, {point, out, checked});
    }
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
        // True to size close by, never under the scene's 16 pixels (index.ts microDrawnLength), as a tapped animal is.
        const drawn = microDrawnLength(length, displayLength(shot.slug), distance, window.innerHeight || 900, debug.camera.fov, 16);
        model.scale.setScalar(drawn / bodyAxisExtent(shot.slug, null, size));
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
    const n = new Vector3(point.normal.x, point.normal.y, point.normal.z).normalize();
    group.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), n).multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), point.yaw));
    group.position.set(point.position.x, point.position.y, point.position.z);
    debug.scene.add(group);
    holder.current = group;
    // On a leaf or a trunk it rides the tree's sway (sampler attachPointAt: the tree shader's own motion), set just
    // before each frame is drawn so it never lags its leaf.
    if (point.wind) {
        const chosen = point;
        const scene = debug.scene;
        const before = scene.onBeforeRender;
        scene.onBeforeRender = (...args) => {
            before.apply(scene, args);
            const at = attachPointAt(chosen, ARK_TIME.value, ARK_WIND.value);
            group.position.set(at.x, at.y, at.z);
            group.updateMatrixWorld(true);
        };
        holder.stop = () => {
            scene.onBeforeRender = before;
        };
    }
    debug.controls.minDistance = holder.minDistance;
    return {view: viewOnto(point, out, distance, lift), anchor: `${point.id}${point.asset ? ` ${point.asset}` : ""}${point.open !== undefined ? ` open ${point.open}` : ""} (${shot.slug}, ${(length * 100).toFixed(1)} cm at ${distance.toFixed(2)} m${checked})`};
}

const debugOf = () => (window as unknown as {__arkDebug?: Debug}).__arkDebug;

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
    /** The camera's near plane (m) and how far it is from what it looks at. */
    cameraNear: number;
    cameraDistance: number;
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
    const holder: Holder = {current: null, minDistance: 0.3, stop: null, chosen: new Map()};

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
        /**
         * The attach points' build as the scene's mount pays for it (the decor already built): the synchronous build's
         * one long task, and (where the sampler offers it) the sliced build's longest slice. Each from a fresh start.
         */
        attachTiming: async () => {
            const sampler = arkSampler as unknown as {resetAttachPoints: () => void; allAttachPoints: () => unknown[]; prepareAttachPoints?: (sliceMs?: number) => Promise<unknown[]>; attachBuildSlices?: () => number[]};
            const runs: number[] = [];
            for (let i = 0; i < 3; i++) {
                sampler.resetAttachPoints();
                await nextFrame();
                const started = performance.now();
                sampler.allAttachPoints();
                runs.push(Math.round((performance.now() - started) * 10) / 10);
            }
            let sliced: {total: number; longest: number; slices: number} | null = null;
            if (sampler.prepareAttachPoints && sampler.attachBuildSlices) {
                sampler.resetAttachPoints();
                await nextFrame();
                const started = performance.now();
                await sampler.prepareAttachPoints(6);
                const slices = sampler.attachBuildSlices();
                sliced = {total: Math.round((performance.now() - started) * 10) / 10, longest: Math.round(Math.max(...slices) * 10) / 10, slices: slices.length};
            }
            return {syncMs: runs, points: sampler.allAttachPoints().length, sliced};
        },
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
                const debug = (window as unknown as {__arkDebug?: Debug}).__arkDebug;
                debug?.scene.remove(holder.current);
                holder.current = null;
                holder.stop?.();
                holder.stop = null;
                // The scene has its closest distance back.
                if (debug) Object.defineProperty(debug.controls, "minDistance", {configurable: true, enumerable: true, writable: true, value: 4});
            }
            handle.setHours(GOLDEN_TIMES[time]);
            handle.setEnvironment({...CALM_SHOT, ...(GOLDEN_WEATHER[where] ?? {})});
            const debugNow = (window as unknown as {__arkDebug?: Debug}).__arkDebug;
            const hold = () => {
                if (micro && debugNow) debugNow.controls.minDistance = holder.minDistance;
                handle.setView(shot.view);
            };
            hold();
            // The view keeps itself over the ground for a few frames (setView, then the scene's own limits): hold it there.
            for (let i = 0; i < 20; i++) {
                await nextFrame();
                if (i < 6) hold();
            }
            await settle(700, 30_000);
            if (micro) {
                // The scene eases its closest distance back out each frame when nothing is selected: hold the close-up.
                const debug = (window as unknown as {__arkDebug?: Debug}).__arkDebug;
                for (let i = 0; i < 3; i++) {
                    if (debug) debug.controls.minDistance = holder.minDistance;
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
                cameraNear: Math.round((debugOf()?.camera.near ?? 0) * 1e5) / 1e5,
                cameraDistance: Math.round((debugOf()?.camera.position.distanceTo(new Vector3(handle.view().target.x, handle.view().target.y, handle.view().target.z)) ?? 0) * 1e4) / 1e4,
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
