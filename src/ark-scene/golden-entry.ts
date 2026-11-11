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
import {ARK_TIME, ARK_WIND} from "@/ark-scene/glsl";
import {Box3, Group, Mesh as ThreeMesh, MeshStandardMaterial, Quaternion, Raycaster, SphereGeometry, Vector3, type InstancedMesh, type Mesh, type Object3D, type PerspectiveCamera, type Scene} from "three";
import {GLTFLoader} from "three/examples/jsm/loaders/GLTFLoader.js";
import {MeshoptDecoder} from "three/examples/jsm/libs/meshopt_decoder.module.js";
import {LAKE, RIVER, ZONE_SITES, heightAt, regionCentre, sampleGround, zoneAt} from "@/ark-scene/world";
import {worldDecor} from "@/ark-scene/decor";
import {kelpStandSpot, reefCloseupSpot} from "@/ark-scene/reef";
import {fishSchoolAt, fishSchools, pinSeaClock, type FishChaser} from "@/ark-scene/fish-schools";
import {setFishChasers} from "@/ark-scene/fish-render";
import {COTTAGE, microCorner} from "@/ark-scene/micro-decor";
import fixture from "@/ark-scene/fixtures/snapshot-v2.json";
import {mountArtStudy, type ArtStudyHandle} from "@/ark-scene/study/art-study";
import {propsFixture, propsShot, type PropsShot} from "@/ark-scene/props/golden-props";
import type {createPropsModule} from "@/ark-scene/props";
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
        if (shot.tag === "house_wall") {
            // Off the side windows (micro-scene.ts: centred 0.4 m off the middle, 1.4 m up, 0.8 × 0.7 m), with a margin:
            // a gecko half hidden by a window frame is no shot (graphics batch 5).
            const side = Math.sign(p.x - COTTAGE.x);
            const windowZ = COTTAGE.z + (side > 0 ? 0.4 : -0.4);
            const onWindow = Math.abs(p.z - windowZ) < 0.75 && Math.abs(p.y - (COTTAGE.floor + 1.4)) < 0.65;
            return (Math.abs(point.normal.x) > 0.5 ? 0 : 10) + Math.abs(p.y - (COTTAGE.floor + 1.4)) + (onWindow ? 20 : 0);
        }
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
            // The camera above the ground (graphics batch 5: a rock's face can look up a beach, into the sand).
            const eye = new Vector3().setFromSphericalCoords(view.distance, view.polar, view.azimuth).add(new Vector3(view.target.x, view.target.y, view.target.z));
            const blocked = eye.y < heightAt(eye.x, eye.z) + 0.15 ? "ground" : clearSight(debug, view, candidate, holder.current);
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
        // True to size (motion pass §3), as the scene draws it.
        const drawn = displayLength(shot.slug);
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
    // Scale runs (scripts/ark-scale-run.mjs): ?population=<file> loads a synthetic snapshot instead of the fixture.
    const population = params.get("population");
    const fetchStarted = performance.now();
    const raw = population ? await (await fetch(population)).json() : fixture;
    const decodeStarted = performance.now();
    const decoded = decodeArkSnapshot(raw);
    if (!decoded) throw new Error("fixture did not decode");
    // The props lane's close-ups (`?props=1`): the props' species aboard, in the breeding season, clutches in.
    const snapshot = params.get("props") ? propsFixture(decoded) : decoded;
    const timing: Record<string, number> = {fetchMs: decodeStarted - fetchStarted, decodeMs: performance.now() - decodeStarted};
    const mountStarted = performance.now();
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
            timing.readyMs = performance.now() - mountStarted;
        }
    });
    timing.mountMs = performance.now() - mountStarted;
    // Every golden shot in the same calm weather at mean tide, whatever the island clock says today.
    handle.setEnvironment(CALM_SHOT);
    const canvas = el.querySelector("canvas") as HTMLCanvasElement;
    const world = goldenWorld(handle);
    const holder: Holder = {current: null, minDistance: 0.3, stop: null, chosen: new Map()};
    let chaserBody: ThreeMesh | null = null;

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
        /** The scene itself (the liveliness clips pin the weather, the tide and the camera through it). */
        handle,
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
            pinSeaClock(GOLDEN_SEA_EPOCH);
            // A golden-only camera (graphics batch 5): the shot's own limits, for this shot only.
            (window as unknown as {__arkGoldenCamera?: unknown}).__arkGoldenCamera = "camera" in shot ? (shot as {camera?: unknown}).camera : undefined;
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
        /** A props close-up (`props/golden-props.ts`): framed on where the props module says the thing is, in its light and weather. */
        shootProps: async (name: PropsShot) => {
            const props = (globalThis as {__arkPropsModule?: ReturnType<typeof createPropsModule>}).__arkPropsModule;
            if (!props) return {anchor: "no props module", asked: null, actual: handle.view() as ArkCameraView};
            const plan = propsShot(name, props.marks(), props.stats(), (id) => handle.locate(id));
            if (!plan) return {anchor: `missing ${name}`, asked: null, actual: handle.view() as ArkCameraView};
            if (holder.current) {
                (window as unknown as {__arkDebug?: Debug}).__arkDebug?.scene.remove(holder.current);
                holder.current = null;
            }
            const debug = (window as unknown as {__arkDebug?: Debug}).__arkDebug;
            if (debug) debug.controls.minDistance = plan.minDistance ?? 4;
            (globalThis as {__arkPropsWeather?: unknown}).__arkPropsWeather = plan.weather;
            handle.setEnvironment({seaLevel: 0, storm: 0, windDirection: 0.41, wetness: 0, snow: 0, wind: 0.35, ...plan.environment});
            handle.setHours(plan.hours);
            handle.setView(plan.view);
            for (let i = 0; i < 24; i++) {
                await nextFrame();
                if (i < 8) handle.setView(plan.view);
            }
            await settle(900, 30_000);
            return {anchor: plan.anchor, asked: plan.view, actual: handle.view() as ArkCameraView, props: props.stats().drawn};
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
        /** The visual CI (scripts/ark-visual.mts): forget transient state when its clock freezes. */
        resetTransients: () => {
            handle.resetTransients?.();
            // The sea's clock runs from its pin on the page's clock: pinned again at the frozen instant, so the fish too
            // are a function of the shot's time.
            pinSeaClock(GOLDEN_SEA_EPOCH);
        },
        /**
         * The contact-shadow audit (development): the scene running, every drawn animal whose home spot's ground (where
         * its shadow used to lie) is off the ground under it now by more than 25 cm, worst first. The schedule walks
         * them off their spot; a shadow left at the home's height floated over one that had walked downhill.
         */
        shadowAudit: async (seconds: number) => {
            handle.setReducedMotion(false);
            handle.setClockScale(1, GOLDEN_WORLD_MS);
            const until = performance.now() + seconds * 1000;
            while (performance.now() < until) await nextFrame();
            const debug = (window as unknown as {__arkDebug?: {entries: () => Array<{animal: {id: string; model_slug: string}; place: {ground: number}; middle?: {x: number; y: number; z: number} | null; drawnHeight: number; air: number}>}}).__arkDebug;
            const rows: Array<{id: string; slug: string; home: number; ground: number; feet: number; off: number}> = [];
            for (const entry of debug?.entries() ?? []) {
                if (!entry.middle) continue;
                const ground = Math.max(heightAt(entry.middle.x, entry.middle.z), 0);
                const home = Math.max(entry.place.ground, 0);
                const feet = entry.middle.y - entry.drawnHeight / 2;
                if (Math.abs(home - ground) > 0.25 && Math.abs(feet - ground) < 0.3 && entry.air < 0.5) {
                    rows.push({id: entry.animal.id, slug: entry.animal.model_slug, home, ground, feet, off: home - ground});
                }
            }
            return rows.sort((a, b) => Math.abs(b.off) - Math.abs(a.off));
        },
        /** Clips (development): hold the camera on this view. */
        setView: (view: ArkCameraView) => handle.setView(view),
        /** Clips (development): run the sea's clock from this epoch second. */
        pinSea: (epochSeconds: number) => pinSeaClock(epochSeconds),
        /** Clips: a school now (by id), at the sea's clock. */
        school: (id: string) => {
            const school = fishSchools().find((each) => each.id === id);
            return school ? fishSchoolAt(school) : null;
        },
        /**
         * Clips: one chaser the fish split round (`setFishChasers`), drawn as a plain dark body `length` long heading
         * `yaw`; null clears it. Stands in for the recipes lane's hunters.
         */
        setChaser: (chaser: (FishChaser & {length: number; yaw: number}) | null) => {
            const debug = (window as unknown as {__arkDebug?: Debug}).__arkDebug;
            if (!chaser) {
                setFishChasers(null);
                if (chaserBody && debug) debug.scene.remove(chaserBody);
                return;
            }
            const list: FishChaser[] = [{x: chaser.x, y: chaser.y, z: chaser.z, r: chaser.r}];
            setFishChasers(() => list);
            if (!chaserBody) {
                const body = new SphereGeometry(0.5, 18, 10);
                body.scale(0.32, 0.3, 1);
                chaserBody = new ThreeMesh(body, new MeshStandardMaterial({color: "#4a4844", roughness: 0.45}));
            }
            chaserBody.scale.setScalar(chaser.length);
            chaserBody.position.set(chaser.x, chaser.y, chaser.z);
            chaserBody.rotation.set(0, chaser.yaw, 0);
            if (debug && !chaserBody.parent) debug.scene.add(chaserBody);
        },
        /** Scale runs: the load timings, the animals given, and the JS heap. */
        timing: () => ({...timing, animals: snapshot.animals.length, heapMb: Math.round(((performance as unknown as {memory?: {usedJSHeapSize: number}}).memory?.usedJSHeapSize ?? 0) / 1048576)}),
        /** Scale runs: resolves once nothing is loading for quietMs (or after maxMs), with the time it took. */
        settle: async (quietMs = 1500, maxMs = 120_000) => {
            const started = performance.now();
            const settled = await settle(quietMs, maxMs);
            return {settled, ms: Math.round(performance.now() - started)};
        },
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
        animal: async (slug: string, time: GoldenTime, options: {look: boolean; wetness?: number; still?: boolean; distance?: number; turn?: number; detail?: boolean; id?: string}) => {
            // One animal by id (the shadow audit's), else every one of the species to choose from.
            const kin = snapshot.animals.filter((row) => row.model_slug === slug && (!options.id || row.id === options.id));
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
            // The trunks, lamps and buildings the golden cameras stand clear of (`golden-world.ts`), near this species.
            const firstAt = handle.locate(kin[0].id);
            const trunks = goldenObstacles().filter((o) => !firstAt || Math.hypot(o.x - firstAt.x, o.z - firstAt.z) < 40);
            /** Nothing between the camera and the animal: no trunk or wall, no other animal's body, the ground below the line. */
            const clear = (id: string, at: NonNullable<ReturnType<typeof handle.locate>>, azimuth: number) => {
                const target = targetOf(at);
                const distance = distanceFor(sizeOf(at));
                const polar = polarFor(at);
                const camera = {x: target.x + distance * Math.sin(polar) * Math.sin(azimuth), y: target.y + distance * Math.cos(polar), z: target.z + distance * Math.sin(polar) * Math.cos(azimuth)};
                // The whole sight line (a trunk anywhere on it hides the animal), with a margin at the lens.
                for (let t = 0; t < 0.97; t += 0.04) {
                    const x = camera.x + (target.x - camera.x) * t;
                    const z = camera.z + (target.z - camera.z) * t;
                    const margin = t < 0.15 ? 0.35 : 0.05;
                    for (const o of trunks) if (Math.hypot(o.x - x, o.z - z) < o.radius + margin) return false;
                }
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
            const turns = options.turn !== undefined ? [options.turn] : [0.55, -0.55, 0.95, -0.95, 0.2, -0.2, 1.4, -1.4, 1.9, -1.9, 2.5, -2.5];
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
        },
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
