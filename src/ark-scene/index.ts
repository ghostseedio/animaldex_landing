/**
 * The shared Ark, drawn: `mountArk(el, options)` (Ark v1 contract, section 5).
 *
 * Framework-free: TypeScript and three.js only, so the website's /ark page
 * imports it and `scripts/build-ark-bundle.mjs` packs it for the apps'
 * WebView (`public/ark/embed.html`).
 *
 * A miniature world at golden hour: a physically based sky that also lights
 * every surface (`lighting.ts`), a low sun with soft shadows, one terrain
 * and one water shader (`terrain.ts`), instanced vegetation and props that
 * sway in the wind (`vegetation.ts`), drifting cloud shadows and pollen
 * (`life.ts`), and a finish in three tiers (`post.ts`), picked for the
 * device and dropped a tier if frames run long.
 *
 * Each species is one InstancedMesh per level of detail: the near model
 * (~3,000 triangles, moving on its own) within about 25 m of the camera and
 * the far one (~600) beyond, at every distance — seen from far they are
 * drawn a little larger, like figures on a model. Only past ~150 animals in
 * view do the farthest become icons (`icons.ts`). Birds of the air circle
 * above their zone, sea animals swim slow loops; a tapped one comes to rest
 * and lifts a little in a ring of light.
 */

import {
    ACESFilmicToneMapping,
    Color,
    DynamicDrawUsage,
    Fog,
    Frustum,
    InstancedBufferAttribute,
    InstancedMesh,
    Matrix4,
    PCFSoftShadowMap,
    PerspectiveCamera,
    Quaternion,
    Scene,
    Sphere,
    Spherical,
    Vector3,
    WebGLRenderer,
    Euler,
    type MeshStandardMaterial
} from "three";
import {OrbitControls} from "three/examples/jsm/controls/OrbitControls.js";
import {animalMaterial, ARK_CLOCK} from "@/ark-scene/animal-material";
import {ARK_TIME} from "@/ark-scene/glsl";
import {IconTokens, type TokenInstance} from "@/ark-scene/icons";
import {buildMotes} from "@/ark-scene/life";
import {ArkLighting} from "@/ark-scene/lighting";
import {ContactShadows, GroundRings, type Ring, type Shadow} from "@/ark-scene/marks";
import {ModelLibrary, type SpeciesModel} from "@/ark-scene/models";
import {placeAnimals, type Placement} from "@/ark-scene/placement";
import {ArkPost, lowerTier, tierFor, type QualityTier} from "@/ark-scene/post";
import {displayLength, SWIMMING_PLANS} from "@/ark-scene/sizes";
import {buildLandscape} from "@/ark-scene/terrain";
import {buildVegetation} from "@/ark-scene/vegetation";
import {
    ARK_REGIONS,
    type ArkAnimal,
    type ArkRegion,
    type ArkSceneHandle,
    type ArkSceneOptions,
    type ArkSceneStats,
    type ArkSnapshot
} from "@/ark-scene/types";
import {heightAt, regionCentre, regionLabelAnchor, WORLD_RADIUS, ZONE_SITES} from "@/ark-scene/world";

export * from "@/ark-scene/types";
export {decodeArkSnapshot} from "@/ark-scene/snapshot";

/** Near level within this distance (m), far beyond it. */
const NEAR_DISTANCE = 25;
const HYSTERESIS = 2.5;
const NEAR_INSTANCE_CAP = 150;
const NEAR_SPECIES_CAP = 60;
/** Past this many animals in view, the farthest are drawn as icons. */
const MODEL_CAP = 150;
const LOAD_NEAR_WITHIN = 48;
const FOV = 38;
const MAX_DISTANCE = 340;
const ENTRANCE_SECONDS = 1.6;
const RIPPLE_SECONDS = 2.6;
/** Close to an animal the camera looks more across the ground than down on it (radians from straight down). */
const CLOSE_POLAR = 1.13;
/** Seconds without a touch before the view starts to drift. */
const IDLE_DRIFT_AFTER = 9;
const OPENING_SECONDS = 4.6;

/** Birds that take to the air above their zone. */
const FLYERS = new Set(["golden-eagle", "red-tailed-hawk", "african-fish-eagle", "barn-owl", "scarlet-macaw", "grey-heron", "atlantic-puffin"]);

/** Per tier: shadow map size, grass tufts, pixel-ratio cap. */
const TIER_SETTINGS: Record<QualityTier, {shadows: number; grass: number; pixelRatio: number}> = {
    high: {shadows: 2048, grass: 26000, pixelRatio: 2},
    medium: {shadows: 1024, grass: 12000, pixelRatio: 1.5},
    low: {shadows: 0, grass: 0, pixelRatio: 1}
};
const MAX_GRASS = TIER_SETTINGS.high.grass;

type Level = "near" | "far" | "token";

type Entry = {
    animal: ArkAnimal;
    place: Placement;
    length: number;
    arrivedAt: number | null;
    level: Level;
    phase: number;
    /** Where it was drawn this frame (its middle), for picking; null when not drawn. */
    middle: Vector3 | null;
    drawnHeight: number;
    /** 0 on the ground, 1 aloft (flyers); eased. */
    air: number;
    /** 0…1 the selected lift, eased. */
    lift: number;
};

type SpeciesMeshes = {
    near: InstancedMesh | null;
    far: InstancedMesh | null;
    nearMaterial: MeshStandardMaterial | null;
    farMaterial: MeshStandardMaterial | null;
};

const MINE = new Color("#b9f75a");
const SELECTED = new Color("#fff4dc");
const ARRIVAL = new Color("#fff3d6");

function easeOutBack(t: number): number {
    const c = 1.4;
    return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2;
}

function easeInOut(t: number): number {
    return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

function phaseOf(id: string): number {
    let h = 2166136261;
    for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
    return ((h >>> 0) % 10000) / 10000;
}

/** A development override for measuring each tier (`window.__arkQuality = "low"` before mounting). */
function forcedTier(): QualityTier | null {
    const asked = (globalThis as {__arkQuality?: string}).__arkQuality;
    return asked === "high" || asked === "medium" || asked === "low" ? asked : null;
}

export function mountArk(el: HTMLElement, options: ArkSceneOptions): ArkSceneHandle {
    const forced = forcedTier();
    let tier: QualityTier = forced ?? tierFor();
    const renderer = new WebGLRenderer({antialias: tier === "low", powerPreference: "high-performance"});
    // One frame is several passes: count them all (reset at the frame's start).
    renderer.info.autoReset = false;
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.62;
    renderer.shadowMap.type = PCFSoftShadowMap;
    let pixelRatio = Math.min(window.devicePixelRatio || 1, TIER_SETTINGS[tier].pixelRatio);
    renderer.setPixelRatio(pixelRatio);
    const canvas = renderer.domElement;
    canvas.style.display = "block";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.touchAction = "none";
    canvas.style.outline = "none";
    canvas.tabIndex = 0;
    if (getComputedStyle(el).position === "static") el.style.position = "relative";
    el.appendChild(canvas);

    const labelLayer = document.createElement("div");
    labelLayer.setAttribute("aria-hidden", "true");
    Object.assign(labelLayer.style, {position: "absolute", inset: "0", pointerEvents: "none", overflow: "hidden"});
    el.appendChild(labelLayer);

    const reducedMotion = Boolean(options.reducedMotion);
    const scene = new Scene();
    const lighting = new ArkLighting(renderer, scene);
    scene.fog = new Fog(lighting.horizon, 420, 1700);

    const landscape = buildLandscape();
    scene.add(landscape.ground, landscape.water);
    const vegetation = buildVegetation(MAX_GRASS);
    for (const mesh of vegetation.meshes) scene.add(mesh);
    scene.add(vegetation.grass);
    const motes = buildMotes(reducedMotion ? 0 : 260);
    scene.add(motes.points);

    const camera = new PerspectiveCamera(FOV, 1, 0.4, 9000);
    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.075;
    controls.minDistance = 4;
    controls.maxDistance = MAX_DISTANCE;
    controls.minPolarAngle = 0.12;
    controls.maxPolarAngle = 1.36;
    controls.rotateSpeed = 0.55;
    controls.zoomSpeed = 1.1;
    controls.panSpeed = 0.9;
    controls.screenSpacePanning = false;
    controls.zoomToCursor = true;
    controls.autoRotateSpeed = 0.18;

    const shadows = new ContactShadows();
    const rings = new GroundRings();
    const tokens = new IconTokens(options.iconUrl);
    scene.add(shadows.mesh, rings.mesh, tokens.mesh);

    const post = new ArkPost(renderer, scene, camera, tier);
    const applyTier = (next: QualityTier) => {
        tier = next;
        const settings = TIER_SETTINGS[tier];
        lighting.setShadows(renderer, settings.shadows);
        vegetation.setShadows(settings.shadows > 0);
        shadows.setStrength(settings.shadows > 0 ? 0.14 : 0.3);
        vegetation.setGrassCount(settings.grass);
        species.forEach((meshes) => {
            for (const mesh of [meshes.near, meshes.far]) if (mesh) mesh.castShadow = settings.shadows > 0;
        });
        post.setTier(tier);
        pixelRatio = Math.min(window.devicePixelRatio || 1, settings.pixelRatio);
        renderer.setPixelRatio(pixelRatio);
        resize();
    };

    const library = new ModelLibrary(options.modelBase, 4);
    const species = new Map<string, SpeciesMeshes>();
    let entries: Entry[] = [];
    let entryById = new Map<string, Entry>();
    let mineOnly = Boolean(options.mineOnly);
    let selectedId: string | null = null;
    let disposed = false;
    let width = 1;
    let height = 1;
    let onScreen = true;
    const started = performance.now();

    // MARK: Labels

    const labels = new Map<ArkRegion, HTMLSpanElement>();
    for (const region of ARK_REGIONS) {
        const text = options.regionLabels?.[region];
        if (!text) continue;
        const label = document.createElement("span");
        label.textContent = text;
        Object.assign(label.style, {
            position: "absolute",
            left: "0",
            top: "0",
            transform: "translate(-50%, -50%)",
            whiteSpace: "nowrap",
            font: "600 11px/1 var(--font-sans, ui-sans-serif, system-ui, sans-serif)",
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: "rgba(255, 252, 244, 0.95)",
            textShadow: "0 1px 2px rgba(30, 24, 12, 0.5), 0 0 16px rgba(30, 24, 12, 0.4)",
            opacity: "0",
            transition: "opacity 400ms ease",
            willChange: "transform"
        });
        labelLayer.appendChild(label);
        labels.set(region, label);
    }
    const labelPoint = new Vector3();
    const tokenPoint = new Vector3();
    const labelSizes = new Map<ArkRegion, {w: number; h: number}>();
    /** Nudges tried in turn, in CSS pixels: on the spot, then above, below and beside it, further each time. */
    const NUDGES: Array<[number, number]> = [[0, 0], [0, -26], [0, 26], [0, -44], [0, 44], [-1, 0], [1, 0], [0, -64], [0, 64], [-1, -30], [1, -30], [-1, 30], [1, 30], [0, -88], [0, 88]];
    type Box = [number, number, number, number];
    const overlap = (a: Box, b: Box) => Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0])) * Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
    const placeLabels = () => {
        const distance = camera.position.distanceTo(controls.target);
        const show = distance > 95;
        // What the names keep clear of: every animal (or icon) on screen.
        const taken: Box[] = [];
        if (show) {
            for (const entry of entries) {
                if (!entry.middle) continue;
                tokenPoint.copy(entry.middle).project(camera);
                if (tokenPoint.z > 1) continue;
                const sx = (tokenPoint.x + 1) / 2 * width;
                const sy = (1 - tokenPoint.y) / 2 * height;
                const pixels = entry.level === "token" ? tokens.pixelSize(Math.max(entry.length * 1.1, 1.6), camera.position.distanceTo(entry.middle)) : 16;
                taken.push([sx - pixels / 2, sy - pixels, sx + pixels / 2, sy + 4]);
            }
        }
        labels.forEach((label, region) => {
            const anchor = regionLabelAnchor(region);
            labelPoint.set(anchor.x, Math.max(heightAt(anchor.x, anchor.z), 0) + (region === "high_cold" ? 14 : 0), anchor.z).project(camera);
            const visible = show && labelPoint.z < 1 && Math.abs(labelPoint.x) < 1.05 && Math.abs(labelPoint.y) < 1.05;
            label.style.opacity = visible ? "1" : "0";
            if (!visible) return;
            let size = labelSizes.get(region);
            if (!size || !size.w) {
                size = {w: label.offsetWidth, h: label.offsetHeight};
                labelSizes.set(region, size);
            }
            const ax = (labelPoint.x + 1) / 2 * width;
            const ay = (1 - labelPoint.y) / 2 * height;
            let best: Box | null = null;
            let bestCost = Infinity;
            for (const [dx, dy] of NUDGES) {
                const cx = Math.min(Math.max(ax + dx * (size.w / 2 + 30), size.w / 2 + 10), width - size.w / 2 - 10);
                const cy = ay + dy;
                const box: Box = [cx - size.w / 2 - 6, cy - size.h / 2 - 4, cx + size.w / 2 + 6, cy + size.h / 2 + 4];
                const cost = taken.reduce((sum, other) => sum + overlap(box, other), 0);
                if (cost < bestCost) {
                    best = box;
                    bestCost = cost;
                }
                if (cost === 0) break;
            }
            const box = best!;
            taken.push([box[0] - 8, box[1] - 12, box[2] + 8, box[3] + 12]);
            label.style.transform = `translate(${((box[0] + box[2]) / 2).toFixed(1)}px, ${((box[1] + box[3]) / 2).toFixed(1)}px) translate(-50%, -50%)`;
        });
    };

    // MARK: Snapshot

    const setSnapshot = (snapshot: ArkSnapshot, entrances: boolean) => {
        const now = performance.now() / 1000;
        const places = placeAnimals(snapshot.animals);
        const next: Entry[] = [];
        const nextById = new Map<string, Entry>();
        for (const animal of snapshot.animals) {
            const place = places.get(animal.id)!;
            const before = entryById.get(animal.id);
            const entry: Entry = before
                ? {...before, animal, place}
                : {
                    animal,
                    place,
                    length: displayLength(animal.model_slug, null),
                    arrivedAt: entrances ? now : null,
                    level: "far",
                    phase: phaseOf(animal.id),
                    middle: null,
                    drawnHeight: 1,
                    air: FLYERS.has(animal.model_slug) && ZONE_SITES[animal.zone]?.kind !== "sea" ? 1 : 0,
                    lift: 0
                };
            next.push(entry);
            nextById.set(animal.id, entry);
            tokens.ensure(animal.model_slug);
        }
        entries = next;
        entryById = nextById;
        if (selectedId && !entryById.has(selectedId)) {
            selectedId = null;
            options.onSelect?.(null);
        }
        // Every species' far model, nearest first, so the whole Ark fills in from where the camera is.
        const byDistance = Array.from(new Set(next.map((entry) => entry.animal.model_slug)));
        library.ready().then(() => {
            for (const slug of byDistance) if (library.has(slug)) library.request(slug, "far");
        });
    };

    // MARK: Models

    const speciesMeshes = (slug: string): SpeciesMeshes => {
        let meshes = species.get(slug);
        if (!meshes) {
            meshes = {near: null, far: null, nearMaterial: null, farMaterial: null};
            species.set(slug, meshes);
        }
        return meshes;
    };

    const instancedFor = (model: SpeciesModel, level: "near" | "far", needed: number): InstancedMesh | null => {
        const source = level === "near" ? model.near : model.far;
        if (!source) return null;
        const meshes = speciesMeshes(model.slug);
        let mesh = level === "near" ? meshes.near : meshes.far;
        if (mesh && mesh.instanceMatrix.count >= needed) return mesh;
        const capacity = Math.max(needed, 4, mesh ? mesh.instanceMatrix.count * 2 : 0);
        let material = level === "near" ? meshes.nearMaterial : meshes.farMaterial;
        if (!material) {
            const box = source.geometry.boundingBox!;
            material = animalMaterial({map: source.map, behaviour: model.behaviour, minY: box.min.y, maxY: box.max.y, animated: level === "near" && !reducedMotion});
            if (level === "near") meshes.nearMaterial = material;
            else meshes.farMaterial = material;
        }
        if (mesh) {
            scene.remove(mesh);
            mesh.dispose();
        }
        mesh = new InstancedMesh(source.geometry, material, capacity);
        mesh.instanceMatrix.setUsage(DynamicDrawUsage);
        const instance = new InstancedBufferAttribute(new Float32Array(capacity * 2), 2);
        instance.setUsage(DynamicDrawUsage);
        source.geometry.setAttribute("arkInstance", instance);
        mesh.frustumCulled = false;
        mesh.castShadow = TIER_SETTINGS[tier].shadows > 0;
        mesh.receiveShadow = true;
        mesh.count = 0;
        scene.add(mesh);
        if (level === "near") meshes.near = mesh;
        else meshes.far = mesh;
        return mesh;
    };

    library.onLoad = (slug) => {
        const model = library.get(slug);
        if (model?.behaviour?.plan) {
            for (const entry of entries) {
                if (entry.animal.model_slug === slug) entry.length = displayLength(slug, model.behaviour.plan);
            }
        }
    };

    // MARK: Per frame

    const frustum = new Frustum();
    const projection = new Matrix4();
    const sphere = new Sphere();
    const matrix = new Matrix4();
    const rotation = new Quaternion();
    const euler = new Euler(0, 0, 0, "YXZ");
    const scale = new Vector3();
    const position = new Vector3();
    let counts = {near: 0, far: 0, token: 0};

    /** Where an animal is this moment: its spot, or its loop in the water, or its circle in the sky. */
    type Pose = {x: number; z: number; base: number; yaw: number; pitch: number; roll: number; afloat: boolean};
    const pose = (entry: Entry, model: SpeciesModel | undefined, modelHeight: number, time: number): Pose => {
        const place = entry.place;
        const plan = model?.behaviour?.plan ?? "";
        const t = reducedMotion ? 0 : time;
        const site = ZONE_SITES[entry.animal.zone];
        // The sea's swimmers: slow loops about their spot, the reef's under the clear shallows.
        if (site?.kind === "sea" && SWIMMING_PLANS.has(plan)) {
            const radius = 2.2 + entry.phase * 3 + entry.length * 0.6;
            const speed = (0.05 + entry.phase * 0.05) * (entry.phase > 0.5 ? 1 : -1);
            const angle = entry.phase * Math.PI * 2 + t * speed;
            const x = place.x + Math.cos(angle) * radius;
            const z = place.z + Math.sin(angle) * radius;
            const reef = entry.animal.zone === "coral_reef";
            const depth = reef ? 0.55 + 0.35 * entry.phase + modelHeight * 0.5 : modelHeight * (0.38 + 0.12 * Math.sin(t * 0.3 + entry.phase * 9));
            // Tangent to the loop: model heads face +z.
            const yaw = Math.atan2(-Math.sin(angle) * Math.sign(speed), Math.cos(angle) * Math.sign(speed));
            return {x, z, base: -depth, yaw, pitch: 0, roll: 0, afloat: true};
        }
        // Birds of the air: a wide circle above their zone, banked into the turn.
        if (entry.air > 0.001) {
            const radius = 6 + entry.phase * 6;
            const speed = 0.16 + entry.phase * 0.08;
            const angle = entry.phase * Math.PI * 2 + t * speed;
            const altitude = 9 + entry.phase * 6 + Math.sin(t * 0.4 + entry.phase * 7) * 0.8;
            const ax = place.x + Math.cos(angle) * radius - radius;
            const az = place.z + Math.sin(angle) * radius;
            const ground = Math.max(place.ground, 0);
            const yawAir = Math.atan2(-Math.sin(angle), Math.cos(angle));
            const k = easeInOut(entry.air);
            return {
                x: place.x + (ax - place.x) * k,
                z: place.z + (az - place.z) * k,
                base: ground + (altitude) * k,
                yaw: place.yaw + (yawAir - place.yaw) * k,
                pitch: 0.95 * k,
                roll: -0.35 * k,
                afloat: k > 0.5
            };
        }
        let base = place.ground;
        if (place.water && place.ground < -0.45) base = -(SWIMMING_PLANS.has(plan) ? 0.5 : 0.28) * modelHeight;
        else if (place.water) base = Math.max(place.ground, -0.3);
        return {x: place.x, z: place.z, base, yaw: place.yaw, pitch: 0, roll: 0, afloat: base < Math.max(place.ground, 0) - 0.01 || place.ground < 0};
    };

    const updateInstances = (now: number) => {
        projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
        frustum.setFromProjectionMatrix(projection);
        const cameraPosition = camera.position;
        const viewDistance = cameraPosition.distanceTo(controls.target);
        // Seen from far, animals are drawn a little larger, like figures on a model; close up, true to size.
        const exaggerate = 1 + Math.min(Math.max((viewDistance - 40) / 120, 0), 1.3);

        type Candidate = {entry: Entry; distance: number; model: SpeciesModel | undefined; visible: boolean; pose: Pose; modelHeight: number; modelScale: number};
        const candidates: Candidate[] = [];
        for (const entry of entries) {
            const slug = entry.animal.model_slug;
            const model = library.get(slug);
            // A flyer that is selected comes down to its spot; otherwise takes to the air again.
            if (FLYERS.has(slug) && ZONE_SITES[entry.animal.zone]?.kind !== "sea") {
                const target = selectedId === entry.animal.id || reducedMotion ? 0 : 1;
                entry.air += (target - entry.air) * 0.02;
            }
            entry.lift += ((selectedId === entry.animal.id ? 1 : 0) - entry.lift) * 0.08;
            const modelScale = model ? entry.length / model.length : 1;
            const modelHeight = model ? model.height * modelScale : entry.length * 0.6;
            const where = pose(entry, model, modelHeight, now);
            position.set(where.x, Math.max(where.base, 0), where.z);
            const distance = cameraPosition.distanceTo(position);
            if (distance < LOAD_NEAR_WITHIN && library.has(slug)) library.request(slug, "near");
            sphere.center.copy(position);
            sphere.radius = entry.length * 2 + 3;
            candidates.push({entry, distance, model, visible: frustum.intersectsSphere(sphere), pose: where, modelHeight, modelScale});
        }

        const nearWanted = candidates
            .filter((c) => c.visible && c.model?.near && c.distance < NEAR_DISTANCE + (c.entry.level === "near" ? HYSTERESIS : 0))
            .sort((a, b) => a.distance - b.distance);
        const nearIds = new Set<string>();
        const nearSpecies = new Set<string>();
        for (const candidate of nearWanted) {
            if (nearIds.size >= NEAR_INSTANCE_CAP) break;
            const slug = candidate.entry.animal.model_slug;
            if (!nearSpecies.has(slug) && nearSpecies.size >= NEAR_SPECIES_CAP) continue;
            nearSpecies.add(slug);
            nearIds.add(candidate.entry.animal.id);
        }
        // Models for the nearest MODEL_CAP in view; past that, icons.
        const modelled = new Set(candidates.filter((c) => c.visible && c.model?.far).sort((a, b) => a.distance - b.distance).slice(0, MODEL_CAP).map((c) => c.entry.animal.id));

        const perMesh = new Map<InstancedMesh, number>();
        const used = new Set<InstancedMesh>();
        const tokenList: TokenInstance[] = [];
        const shadowList: Shadow[] = [];
        const ringList: Ring[] = [];
        counts = {near: 0, far: 0, token: 0};

        const needs = new Map<string, {near: number; far: number}>();
        for (const candidate of candidates) {
            const {entry} = candidate;
            const level: Level = nearIds.has(entry.animal.id) ? "near" : modelled.has(entry.animal.id) ? "far" : "token";
            entry.level = level;
            if (!candidate.visible || level === "token") continue;
            const need = needs.get(entry.animal.model_slug) ?? {near: 0, far: 0};
            need[level]++;
            needs.set(entry.animal.model_slug, need);
        }
        needs.forEach((need, slug) => {
            const model = library.get(slug)!;
            if (need.near) instancedFor(model, "near", need.near);
            if (need.far) instancedFor(model, "far", need.far);
        });

        for (const candidate of candidates) {
            const {entry, model, pose: where} = candidate;
            const level = entry.level;
            const animal = entry.animal;
            const dim = mineOnly && !animal.mine ? 1 : 0;
            let grow = 1;
            if (entry.arrivedAt !== null) {
                const t = (now - entry.arrivedAt) / ENTRANCE_SECONDS;
                if (t < 1 && !reducedMotion) grow = Math.max(easeOutBack(Math.max(t, 0)), 0.001);
                const ripple = (now - entry.arrivedAt) / RIPPLE_SECONDS;
                if (ripple < 1 && !reducedMotion) {
                    ringList.push({x: where.x, y: Math.max(entry.place.ground, 0), z: where.z, radius: entry.length * (0.8 + 2.6 * ripple), color: ARRIVAL, alpha: 0.9 * (1 - ripple) ** 1.5});
                }
            }
            // Big animals need less help to be seen: a whale isn't blown up like a sparrow.
            const sizeUp = level !== "near" ? 1 + (exaggerate - 1) * Math.min(Math.max(1.6 / entry.length, 0.25), 1) : 1;
            const modelHeight = candidate.modelHeight * sizeUp;
            entry.drawnHeight = modelHeight;
            if (!candidate.visible) {
                entry.middle = null;
                continue;
            }
            const lift = entry.lift * modelHeight * 0.12;
            entry.middle = (entry.middle ?? new Vector3()).set(where.x, where.base + lift + modelHeight / 2, where.z);
            const rest = Math.max(entry.place.ground, 0);
            const marked = selectedId === animal.id ? 2 : mineOnly && animal.mine ? 1 : 0;

            if (level === "token") {
                counts.token++;
                tokenList.push({slug: animal.model_slug, x: where.x, y: Math.max(where.base + modelHeight * 0.75, rest + 0.4), z: where.z, size: Math.max(entry.length * 1.1, 1.6), dim, ring: marked, grow});
                continue;
            }

            const mesh = (level === "near" ? species.get(animal.model_slug)?.near : species.get(animal.model_slug)?.far) ?? null;
            if (!mesh || !model) continue;
            const index = perMesh.get(mesh) ?? 0;
            perMesh.set(mesh, index + 1);
            used.add(mesh);
            if (level === "near") counts.near++;
            else counts.far++;
            const s = candidate.modelScale * sizeUp * grow;
            euler.set(where.pitch, where.yaw, where.roll);
            rotation.setFromEuler(euler);
            position.set(where.x, where.base + lift - model.minY * s - (1 - Math.min(grow, 1)) * modelHeight * 0.3, where.z);
            matrix.compose(position, rotation, scale.set(s, s, s));
            mesh.setMatrixAt(index, matrix);
            (mesh.geometry.getAttribute("arkInstance") as InstancedBufferAttribute).setXY(index, entry.phase, dim);

            if (!where.afloat) {
                const box = (level === "near" ? model.near : model.far)!.geometry.boundingBox!;
                shadowList.push({
                    x: where.x,
                    y: rest,
                    z: where.z,
                    width: Math.max((box.max.x - box.min.x) * candidate.modelScale * sizeUp * 1.15, 0.4),
                    length: model.length * candidate.modelScale * sizeUp * 1.0,
                    yaw: where.yaw,
                    strength: grow * (1 - entry.lift * 0.3)
                });
            }
            if (marked) {
                ringList.push({x: where.x, y: where.afloat ? 0 : rest, z: where.z, radius: Math.max(entry.length * sizeUp * 0.8, 0.7), color: marked === 2 ? SELECTED : MINE, alpha: 1});
            }
        }

        species.forEach((meshes) => {
            for (const mesh of [meshes.near, meshes.far]) {
                if (!mesh) continue;
                const count = used.has(mesh) ? perMesh.get(mesh) ?? 0 : 0;
                mesh.count = count;
                mesh.visible = count > 0;
                if (count) {
                    mesh.instanceMatrix.needsUpdate = true;
                    (mesh.geometry.getAttribute("arkInstance") as InstancedBufferAttribute).needsUpdate = true;
                }
            }
        });
        tokens.set(tokenList, camera);
        shadows.set(shadowList);
        rings.set(ringList);
    };

    // MARK: Camera

    /** A flight eases the target, the distance, and (when given) the angle from straight down and the bearing. */
    type Flight = {from: Vector3; to: Vector3; fromDistance: number; toDistance: number; fromPolar: number; toPolar: number; fromAzimuth: number; toAzimuth: number; start: number; seconds: number; then?: () => void};
    let flight: Flight | null = null;
    const offset = new Vector3();
    const spherical = new Spherical();

    const fly = (target: Vector3, distance: number, seconds = 1.1, polar?: number, azimuth?: number, then?: () => void) => {
        distance = Math.min(Math.max(distance, controls.minDistance), MAX_DISTANCE);
        spherical.setFromVector3(offset.copy(camera.position).sub(controls.target));
        const toPolar = polar ?? spherical.phi;
        let toAzimuth = azimuth ?? spherical.theta;
        // The short way round.
        while (toAzimuth - spherical.theta > Math.PI) toAzimuth -= Math.PI * 2;
        while (toAzimuth - spherical.theta < -Math.PI) toAzimuth += Math.PI * 2;
        if (reducedMotion || seconds <= 0) {
            spherical.radius = distance;
            spherical.phi = toPolar;
            spherical.theta = toAzimuth;
            controls.target.copy(target);
            camera.position.copy(target).add(offset.setFromSpherical(spherical));
            controls.update();
            then?.();
            return;
        }
        flight = {from: controls.target.clone(), to: target.clone(), fromDistance: spherical.radius, toDistance: distance, fromPolar: spherical.phi, toPolar, fromAzimuth: spherical.theta, toAzimuth, start: performance.now() / 1000, seconds, then};
    };

    const stepFlight = (now: number) => {
        if (!flight) return;
        const t = Math.min((now - flight.start) / flight.seconds, 1);
        const k = easeInOut(t);
        controls.target.lerpVectors(flight.from, flight.to, k);
        spherical.radius = flight.fromDistance + (flight.toDistance - flight.fromDistance) * k;
        spherical.phi = flight.fromPolar + (flight.toPolar - flight.fromPolar) * k;
        spherical.theta = flight.fromAzimuth + (flight.toAzimuth - flight.fromAzimuth) * k;
        camera.position.copy(controls.target).add(offset.setFromSpherical(spherical));
        if (t >= 1) {
            const then = flight.then;
            flight = null;
            then?.();
        }
    };
    let lastTouch = performance.now() / 1000;
    controls.addEventListener("start", () => {
        flight = null;
        lastTouch = performance.now() / 1000;
        controls.autoRotate = false;
    });
    controls.addEventListener("end", () => {
        lastTouch = performance.now() / 1000;
    });

    /** The whole world in view, from the south and above. */
    const homeView = () => {
        const aspect = width / Math.max(height, 1);
        const vertical = FOV * Math.PI / 180;
        const horizontal = 2 * Math.atan(Math.tan(vertical / 2) * aspect);
        const fit = Math.min(vertical, horizontal);
        const radius = aspect < 0.8 ? 84 : 82;
        const distance = Math.min(radius / Math.sin(fit / 2) * 0.8, MAX_DISTANCE);
        // Low enough to see the horizon over the island's far shore.
        return {target: new Vector3(0, 0, aspect < 0.8 ? 12 : 2), distance: distance * 0.94, polar: 1.06, azimuth: 0};
    };

    // Keep the view over the world and above the ground.
    const keepInWorld = () => {
        const target = controls.target;
        const reach = Math.hypot(target.x, target.z);
        if (reach > WORLD_RADIUS) {
            const pull = WORLD_RADIUS / reach;
            const dx = target.x * pull - target.x;
            const dz = target.z * pull - target.z;
            target.x += dx;
            target.z += dz;
            camera.position.x += dx;
            camera.position.z += dz;
        }
        const groundUnderTarget = Math.max(heightAt(target.x, target.z), 0);
        const lift = (groundUnderTarget - target.y) * 0.15;
        if (Math.abs(lift) > 0.001) {
            target.y += lift;
            camera.position.y += lift;
        }
        const floor = Math.max(heightAt(camera.position.x, camera.position.z), 0) + 1.2;
        if (camera.position.y < floor) camera.position.y = floor;
    };

    // MARK: Picking

    const projected = new Vector3();
    const pick = (clientX: number, clientY: number): Entry | null => {
        const rect = canvas.getBoundingClientRect();
        const x = clientX - rect.left;
        const y = clientY - rect.top;
        let best: Entry | null = null;
        let bestScore = Infinity;
        for (const entry of entries) {
            if (!entry.middle) continue;
            projected.copy(entry.middle).project(camera);
            if (projected.z > 1) continue;
            const sx = (projected.x + 1) / 2 * width;
            const sy = (1 - projected.y) / 2 * height;
            const distance = camera.position.distanceTo(entry.middle);
            let radius: number;
            if (entry.level === "token") {
                const pixels = tokens.pixelSize(Math.max(entry.length * 1.1, 1.6), distance);
                radius = pixels / 2 + 4;
                const d = Math.hypot(x - sx, y - (sy - pixels / 4));
                if (d < radius && d / radius < bestScore) {
                    best = entry;
                    bestScore = d / radius;
                }
                continue;
            }
            const perPixel = 2 * Math.tan(FOV * Math.PI / 360) * distance / height;
            radius = Math.max(Math.max(entry.length, entry.drawnHeight) / perPixel / 2, 20);
            const d = Math.hypot(x - sx, y - sy);
            if (d < radius && d / radius < bestScore) {
                best = entry;
                bestScore = d / radius;
            }
        }
        return best;
    };

    const select = (id: string | null, flyTo: boolean) => {
        selectedId = id;
        const entry = id ? entryById.get(id) : null;
        options.onSelect?.(entry?.animal ?? null);
        if (entry && flyTo) {
            controls.autoRotate = false;
            lastTouch = performance.now() / 1000;
            const distance = camera.position.distanceTo(controls.target);
            // Where it will rest: its own spot (a flyer lands; a swimmer is followed).
            const target = new Vector3(entry.place.x, Math.max(entry.place.ground, 0) + entry.drawnHeight * 0.4, entry.place.z);
            const close = distance > 40 ? 10 + entry.length * 4 : Math.min(distance, 10 + entry.length * 6);
            fly(target, close, 1.3, CLOSE_POLAR);
        }
    };

    let down: {x: number; y: number; time: number; id: number} | null = null;
    let pointers = 0;
    const onPointerDown = (event: PointerEvent) => {
        pointers++;
        lastTouch = performance.now() / 1000;
        if (opening) {
            // The first touch skips the opening.
            opening = false;
            flight = null;
        }
        down = pointers === 1 ? {x: event.clientX, y: event.clientY, time: performance.now(), id: event.pointerId} : null;
    };
    const onPointerUp = (event: PointerEvent) => {
        pointers = Math.max(pointers - 1, 0);
        if (!down || down.id !== event.pointerId) return;
        const moved = Math.hypot(event.clientX - down.x, event.clientY - down.y);
        const quick = performance.now() - down.time < 500;
        down = null;
        if (moved > 8 || !quick) return;
        const hit = pick(event.clientX, event.clientY);
        select(hit ? hit.animal.id : null, Boolean(hit));
    };
    const onPointerCancel = () => {
        pointers = Math.max(pointers - 1, 0);
        down = null;
    };
    const onWheel = () => {
        lastTouch = performance.now() / 1000;
        if (opening) {
            opening = false;
            flight = null;
        }
    };
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerCancel);
    canvas.addEventListener("wheel", onWheel, {passive: true});

    // MARK: Size

    let inset = 0;
    let insetTarget = 0;
    const applyInset = () => {
        if (inset < 0.5) camera.clearViewOffset();
        else camera.setViewOffset(width, height, 0, inset / 2, width, height);
        camera.updateProjectionMatrix();
    };
    const stepInset = () => {
        if (inset === insetTarget) return;
        inset += (insetTarget - inset) * (reducedMotion ? 1 : 0.18);
        if (Math.abs(insetTarget - inset) < 0.5) inset = insetTarget;
        applyInset();
    };

    const resize = () => {
        const rect = el.getBoundingClientRect();
        width = Math.max(1, Math.round(rect.width));
        height = Math.max(1, Math.round(rect.height));
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        applyInset();
        tokens.setViewport(FOV, height, width < 640);
        post.setSize(width, height, pixelRatio);
        motes.setPixelRatio(pixelRatio);
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(el);
    resize();
    const visibility = new IntersectionObserver(([seen]) => {
        onScreen = seen?.isIntersecting ?? true;
    });
    visibility.observe(el);
    applyTier(tier);

    // MARK: First view

    setSnapshot(options.snapshot, false);
    const home = homeView();
    let opening = !reducedMotion;
    const newest = [...options.snapshot.animals].sort((a, b) => b.arrived_at.localeCompare(a.arrived_at))[0];
    const afterOpening = () => {
        opening = false;
        // A beginning Ark (a few animals): go on to the newest arrival.
        if (!newest || options.snapshot.animals.length > 3 || disposed) return;
        const entry = entryById.get(newest.id);
        if (!entry) return;
        // From the island's edge looking in, so the world (the lake, the trees, the mountain) stands behind it.
        fly(new Vector3(entry.place.x, Math.max(entry.place.ground, 0) + 0.6, entry.place.z), 9 + entry.length * 2.6, 2.8, 1.22, Math.atan2(entry.place.x, entry.place.z));
    };
    if (opening) {
        // The opening: from high over the sea, a slow descent and arc onto the island.
        controls.target.copy(home.target).add(new Vector3(0, 0, -10));
        spherical.set(MAX_DISTANCE * 0.98, 0.62, -0.95);
        camera.position.copy(controls.target).add(offset.setFromSpherical(spherical));
        controls.update();
        fly(home.target, home.distance, OPENING_SECONDS, home.polar, home.azimuth, afterOpening);
    } else {
        spherical.set(home.distance, home.polar, home.azimuth);
        controls.target.copy(home.target);
        camera.position.copy(home.target).add(offset.setFromSpherical(spherical));
        controls.update();
        afterOpening();
    }

    // MARK: Loop

    const frameTimes: number[] = [];
    const frameIntervals: number[] = [];
    let lastDrawn = 0;
    let ready = false;
    let raf = 0;
    let lastTracked: Vector3 | null = null;
    /** The tier check: frames over two seconds once the models are in; a tier lower if they run long. */
    let measureFrom = 0;
    const measured: number[] = [];

    const frame = () => {
        raf = requestAnimationFrame(frame);
        if (!onScreen || disposed || document.hidden) return;
        const startedAt = performance.now();
        const now = startedAt / 1000;
        const elapsed = (startedAt - started) / 1000;
        ARK_TIME.value = elapsed;
        if (!reducedMotion) ARK_CLOCK.value = elapsed % 3600;
        stepFlight(now);
        stepInset();
        // Idle: after a while untouched, the view drifts slowly round.
        if (!reducedMotion && !flight && !selectedId && !opening && now - lastTouch > IDLE_DRIFT_AFTER) controls.autoRotate = true;
        controls.update();
        keepInWorld();
        updateInstances(elapsed);
        // Follow a selected animal that moves (a swimmer's loop).
        const tracked = selectedId ? entryById.get(selectedId)?.middle : null;
        if (tracked && !flight && pointers === 0) {
            if (lastTracked) {
                const dx = tracked.x - lastTracked.x;
                const dz = tracked.z - lastTracked.z;
                if (Math.abs(dx) + Math.abs(dz) < 2) {
                    controls.target.x += dx;
                    controls.target.z += dz;
                    camera.position.x += dx;
                    camera.position.z += dz;
                }
            }
            lastTracked = (lastTracked ?? new Vector3()).copy(tracked);
        } else {
            lastTracked = null;
        }
        const viewDistance = camera.position.distanceTo(controls.target);
        lighting.fitShadow(controls.target, viewDistance);
        // The miniature's soft top and bottom, gentler on a tall phone screen where it covers more of the picture.
        post.setTiltShift(Math.min(Math.max((viewDistance - 90) / 200, 0), width < height ? 0.3 : 0.55));
        renderer.info.reset();
        post.render();
        placeLabels();

        const spent = performance.now() - startedAt;
        frameTimes.push(spent);
        if (frameTimes.length > 60) frameTimes.shift();
        if (lastDrawn) {
            const interval = startedAt - lastDrawn;
            if (interval < 250) {
                frameIntervals.push(interval);
                if (frameIntervals.length > 60) frameIntervals.shift();
                if (!forced && tier !== "low" && measureFrom && startedAt > measureFrom) {
                    measured.push(interval);
                    if (startedAt - measureFrom > 2000) {
                        const sorted = [...measured].sort((a, b) => a - b);
                        const typical = sorted[Math.floor(sorted.length * 0.5)];
                        measured.length = 0;
                        if (typical > 21) {
                            applyTier(lowerTier(tier));
                            measureFrom = performance.now() + 600;
                        } else {
                            measureFrom = 0;
                        }
                    }
                }
            }
        }
        lastDrawn = startedAt;
        if (!ready) {
            ready = true;
            measureFrom = performance.now() + 1500;
            options.onReady?.();
        }
    };
    raf = requestAnimationFrame(frame);

    const mean = (values: number[]) => (values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : 0);
    if (typeof window !== "undefined") (window as unknown as {__arkTier?: () => QualityTier}).__arkTier = () => tier;

    return {
        update: (snapshot) => setSnapshot(snapshot, true),
        setMineOnly: (value) => {
            mineOnly = value;
        },
        select: (id) => select(id, true),
        setViewInset: (bottomPixels) => {
            insetTarget = Math.max(0, Math.min(bottomPixels, height * 0.6));
        },
        focusRegion: (region) => {
            controls.autoRotate = false;
            lastTouch = performance.now() / 1000;
            if (!region) {
                const view = homeView();
                fly(view.target, view.distance, 1.6, view.polar);
                return;
            }
            const centre = regionCentre(region);
            fly(new Vector3(centre.x, Math.max(heightAt(centre.x, centre.z), 0), centre.z), Math.min(Math.max(centre.radius * 1.9, 48), 150), 1.6);
        },
        stats: (): ArkSceneStats => ({
            drawCalls: renderer.info.render.calls,
            triangles: renderer.info.render.triangles,
            frameMs: Math.round(mean(frameTimes) * 100) / 100,
            intervalMs: Math.round(mean(frameIntervals) * 100) / 100,
            near: counts.near,
            far: counts.far,
            sprites: counts.token,
            pixelRatio,
            modelsLoaded: library.loadedCount
        }),
        dispose: () => {
            disposed = true;
            cancelAnimationFrame(raf);
            resizeObserver.disconnect();
            visibility.disconnect();
            canvas.removeEventListener("pointerdown", onPointerDown);
            canvas.removeEventListener("pointerup", onPointerUp);
            canvas.removeEventListener("pointercancel", onPointerCancel);
            canvas.removeEventListener("wheel", onWheel);
            controls.dispose();
            species.forEach((meshes) => {
                meshes.near?.dispose();
                meshes.far?.dispose();
                meshes.nearMaterial?.dispose();
                meshes.farMaterial?.dispose();
            });
            library.dispose();
            tokens.dispose();
            shadows.dispose();
            rings.dispose();
            landscape.dispose();
            vegetation.dispose();
            motes.dispose();
            lighting.dispose();
            post.dispose();
            renderer.dispose();
            renderer.forceContextLoss();
            canvas.remove();
            labelLayer.remove();
        }
    };
}
