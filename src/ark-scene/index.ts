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
 *
 * Life v2: the light follows the viewer's clock (`lib/ark-daylight.ts`) and
 * animals sleep by their species' activity (still, the head lowered); near
 * ones look round, startle, shake, bob and doze now and then (the talking
 * models' idles, as root motion); a herd or a school keeps together; the
 * camera can follow one animal; and `play` acts out the server's events
 * since the last visit (`acts.ts`). The scene decides nothing that happens.
 *
 * The species' stats (`stats.ts`) shape looks and behaviour only: size sets
 * how big it is drawn (an animal at the size floor, or a few pixels across
 * from far, gets a soft dot so it can be found, and its icon once tapped),
 * speed its pace, dominance and rarity where it stands in its zone
 * (`placement.ts`), intelligence how varied its idles are and how often it
 * glances at a camera close by.
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
    BoxGeometry,
    CylinderGeometry,
    Group,
    Mesh,
    MeshStandardMaterial,
    type BufferGeometry
} from "three";
import {OrbitControls} from "three/examples/jsm/controls/OrbitControls.js";
import {DEATH_SECONDS, ARRIVAL_SECONDS, BIRTH_SECONDS, EXTINCTION_SECONDS, chaseKind, deathPose, mealStage, type ActBody, type ActPose, type MealStage} from "@/ark-scene/acts";
import {animalMaterial, ARK_CLOCK} from "@/ark-scene/animal-material";
import {DustPuffs} from "@/ark-scene/dust";
import {ARK_TIME} from "@/ark-scene/glsl";
import {IconTokens, type TokenInstance} from "@/ark-scene/icons";
import {buildMotes} from "@/ark-scene/life";
import {ArkLighting} from "@/ark-scene/lighting";
import {ContactShadows, FindDots, GroundRings, type FindDot, type Ring, type Shadow} from "@/ark-scene/marks";
import {ModelLibrary, type SpeciesModel} from "@/ark-scene/models";
import {placeAnimals, type Placement} from "@/ark-scene/placement";
import {ArkPost, lowerTier, tierFor, type QualityTier} from "@/ark-scene/post";
import {displayLength, SWIMMING_PLANS} from "@/ark-scene/sizes";
import {arkBody, arkIdleBehaviour, bodyAxisExtent, arkStats, glance, loopPace, moveSpeed, type ArkStats} from "@/ark-scene/stats";
import {buildLandscape} from "@/ark-scene/terrain";
import {buildVegetation} from "@/ark-scene/vegetation";
import {TalkingActor, talkingSource, TextMouth, type TalkingModelSource} from "@/ark-scene/talking";
import {isAwake, localHours} from "@/lib/ark-daylight";
import type {ArkAct, ArkEventAnimal} from "@/lib/ark-life";
import {BehaviourDirector, BehaviourRandom} from "@/lib/talking-models/behaviour";
import {
    ARK_REGIONS,
    type ArkAnimal,
    type ArkReplayRun,
    type ArkRegion,
    type ArkSceneHandle,
    type ArkSceneOptions,
    type ArkSceneStats,
    type ArkSnapshot,
    type ArkTalking,
    type ArkVisitor
} from "@/ark-scene/types";
import {heightAt, regionCentre, regionLabelAnchor, VISITOR_LANDING, WORLD_RADIUS, ZONE_SITES} from "@/ark-scene/world";

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
/** Within this distance (m) an animal glances at the camera now and then (more often the sharper it is). */
const GLANCE_WITHIN = 14;
/** Drawn smaller than this on screen (CSS px), an animal also gets a marker so it can be found. */
const MARKER_BELOW_PIXELS = 5;

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
    /** Its drawn body length (m, head to tail): from its stored length or its size stat (`stats.ts`). */
    length: number;
    /** The species' stats: looks and behaviour only. */
    stats: ArkStats;
    /** At the size floor: drawn with a marker so it can be found. */
    floor: boolean;
    /** Its idle loops' pace (a swimmer's, a flyer's), from its speed. */
    pace: number;
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
    /** The chat's animal visiting (never one of the Ark's). */
    visitor?: boolean;
    /** Which way it faced when last drawn. */
    yawNow?: number;
    /** Awake by its species' activity and the hour; `rest` eases to 1 asleep. */
    awake: boolean;
    rest: number;
    /** The loop's angle now, for a swimmer or a flyer (it slows asleep). */
    loop: number;
    /** The group's or pair's first one, which a school or a flock keeps to. */
    leader?: Entry | null;
    /** The near level's idle behaviours (look, startle, shake, bob, doze), made when first near. */
    director?: BehaviourDirector | null;
    /** Held back until its act in a replay (it arrived, or was born, since the last visit). */
    held?: boolean;
    /** In a replay only: an animal that is gone now (eaten, or died), standing in until its act. */
    ghost?: boolean;
    /** An act's pose, drawn in place of its own. */
    act?: ActPose | null;
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
    // The hour: pinned by the page (development's `?hour=`), or the viewer's own clock.
    let pinnedHours = typeof options.hours === "number" && Number.isFinite(options.hours) ? options.hours : null;
    const hoursNow = () => pinnedHours ?? localHours(new Date());
    const lighting = new ArkLighting(renderer, scene, hoursNow());
    const fog = new Fog(lighting.horizon, 420, 1700);
    scene.fog = fog;
    const dust = new DustPuffs();
    scene.add(dust.points);

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
    const dots = new FindDots();
    scene.add(shadows.mesh, rings.mesh, tokens.mesh, dots.mesh);

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
    // The visitor (a panel beside a chat only): drawn and pickable, never counted.
    let visitor: Entry | null = null;
    let visitorLabel: HTMLSpanElement | null = null;
    let jetty: Group | null = null;
    /** A replay's stand-ins for animals that are gone now. */
    let ghosts: Entry[] = [];
    const allEntries = () => (visitor || ghosts.length ? [...entries, ...ghosts, ...(visitor ? [visitor] : [])] : entries);
    const findEntry = (id: string | null) => (id ? entryById.get(id) ?? (visitor?.animal.id === id ? visitor : null) : null);
    /** The animal the camera follows (until any drag). */
    let followId: string | null = null;
    // Who is talking, and the full model that stands in for them.
    const talking = {
        target: null as ArkTalking | null,
        actor: null as TalkingActor | null,
        mouth: new TextMouth(),
        pulse: 0,
        pulseAt: 0,
        lastActive: 0,
        open: 0,
        weight: 0
    };
    let talkingModels: TalkingModelSource | null = null;
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
            for (const entry of allEntries()) {
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

    const newEntry = (animal: ArkAnimal, place: Placement, arrivedAt: number | null): Entry => {
        const phase = phaseOf(animal.id);
        const body = arkBody(animal, library.get(animal.model_slug)?.behaviour?.plan);
        return {
            animal,
            place,
            length: body.display,
            stats: arkStats(animal),
            floor: body.floor,
            pace: loopPace(animal),
            arrivedAt,
            level: "far",
            phase,
            middle: null,
            drawnHeight: 1,
            air: FLYERS.has(animal.model_slug) && ZONE_SITES[animal.zone]?.kind !== "sea" ? 1 : 0,
            lift: 0,
            awake: true,
            rest: 0,
            loop: phase * Math.PI * 2
        };
    };

    /** Who is asleep this hour: from the species' activity only (none known: awake by day). */
    let sunElevation = lighting.daylight.elevation;
    const applyHours = () => {
        sunElevation = lighting.daylight.elevation;
        for (const entry of allEntries()) {
            entry.awake = entry.visitor ? true : isAwake(entry.animal.activity ?? null, sunElevation);
            if (reducedMotion) entry.rest = entry.awake ? 0 : 1;
        }
    };

    const setSnapshot = (snapshot: ArkSnapshot, entrances: boolean) => {
        // The entrance's clock is the frame's (seconds since the scene started).
        const now = (performance.now() - started) / 1000;
        const places = placeAnimals(snapshot.animals);
        const next: Entry[] = [];
        const nextById = new Map<string, Entry>();
        for (const animal of snapshot.animals) {
            const place = places.get(animal.id)!;
            const before = entryById.get(animal.id);
            const body = before ? arkBody(animal, library.get(animal.model_slug)?.behaviour?.plan) : null;
            const entry: Entry = before && body
                ? Object.assign(before, {animal, place, length: body.display, floor: body.floor, stats: arkStats(animal), pace: loopPace(animal)})
                : newEntry(animal, place, entrances ? now : null);
            next.push(entry);
            nextById.set(animal.id, entry);
            tokens.ensure(animal.model_slug);
        }
        entries = next;
        entryById = nextById;
        // A school or a flock keeps to its first one.
        for (const entry of next) entry.leader = entry.place.leader && entry.place.leader !== entry.animal.id ? nextById.get(entry.place.leader) ?? null : null;
        applyHours();
        if (followId && !entryById.has(followId)) endFollow();
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
        const instance = new InstancedBufferAttribute(new Float32Array(capacity * 3), 3);
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
                if (entry.animal.model_slug !== slug) continue;
                const body = arkBody(entry.animal, model.behaviour.plan);
                entry.length = body.display;
                entry.floor = body.floor;
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
        // An act's pose, from a replayed event.
        if (entry.act) {
            const act = entry.act;
            return {x: act.x, z: act.z, base: act.base, yaw: act.yaw, pitch: act.pitch, roll: act.roll, afloat: act.base < -0.02 || act.base > Math.max(heightAt(act.x, act.z), 0) + 0.3};
        }
        const place = entry.place;
        const plan = model?.behaviour?.plan ?? "";
        const t = reducedMotion ? 0 : time;
        const site = ZONE_SITES[entry.animal.zone];
        // The visitor: at the jetty's foot, or a swimmer floating off its end.
        if (entry.visitor) {
            const swims = SWIMMING_PLANS.has(plan);
            const spot = swims ? VISITOR_LANDING.end : VISITOR_LANDING.foot;
            const ground = heightAt(spot.x, spot.z);
            const yaw = visitorYaw();
            return {x: spot.x, z: spot.z, base: swims ? -modelHeight * 0.35 : Math.max(ground, 0.05), yaw, pitch: 0, roll: 0, afloat: swims};
        }
        // The sea's swimmers: slow loops about their spot, the reef's under the clear shallows.
        if (site?.kind === "sea" && SWIMMING_PLANS.has(plan)) {
            // A school keeps to its first one: the same loop, a little behind and to the side.
            const lead = entry.leader && !entry.leader.act ? entry.leader : null;
            const follower = lead ? (entry.place.rank ?? 1) : 0;
            const owner = lead ?? entry;
            const direction = owner.phase > 0.5 ? 1 : -1;
            const radius = 2.2 + owner.phase * 3 + owner.length * 0.6 + (follower ? ((follower % 3) - 1) * 0.9 : 0);
            const angle = lead ? lead.loop - direction * follower * (0.1 + entry.length * 0.04) : entry.loop;
            const centre = lead ? lead.place : place;
            const x = centre.x + Math.cos(angle) * radius;
            const z = centre.z + Math.sin(angle) * radius;
            const reef = entry.animal.zone === "coral_reef";
            const depth = reef ? 0.55 + 0.35 * entry.phase + modelHeight * 0.5 : modelHeight * (0.38 + 0.12 * Math.sin(t * 0.3 + entry.phase * 9));
            const speed = direction;
            // Tangent to the loop: model heads face +z.
            const yaw = Math.atan2(-Math.sin(angle) * Math.sign(speed), Math.cos(angle) * Math.sign(speed));
            return {x, z, base: -depth, yaw, pitch: 0, roll: 0, afloat: true};
        }
        // Birds of the air: a wide circle above their zone, banked into the turn.
        if (entry.air > 0.001) {
            // A pair flies together: the mate a little behind on the first one's circle.
            const lead = entry.leader && !entry.leader.act && entry.leader.air > 0.5 ? entry.leader : null;
            const owner = lead ?? entry;
            const radius = 6 + owner.phase * 6;
            const angle = lead ? lead.loop - 0.22 * (entry.place.rank ?? 1) : entry.loop;
            const altitude = 9 + owner.phase * 6 + Math.sin(t * 0.4 + entry.phase * 7) * 0.8 + (lead ? 0.8 : 0);
            const centre = lead ? lead.place : place;
            const ax = centre.x + Math.cos(angle) * radius - radius;
            const az = centre.z + Math.sin(angle) * radius;
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
        // Asleep: a little lower at the front, as the head goes down.
        return {x: place.x, z: place.z, base, yaw: place.yaw, pitch: 0.05 * entry.rest, roll: 0, afloat: base < Math.max(place.ground, 0) - 0.01 || place.ground < 0};
    };

    let lastUpdate = 0;
    const IDLE_ABILITIES = {jaw: false, eyes: true, nose: false, tail: false};
    const updateInstances = (now: number) => {
        const dt = reducedMotion || !lastUpdate ? 0 : Math.min(now - lastUpdate, 0.1);
        lastUpdate = now;
        projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
        frustum.setFromProjectionMatrix(projection);
        const cameraPosition = camera.position;
        const viewDistance = cameraPosition.distanceTo(controls.target);
        // Seen from far, animals are drawn a little larger, like figures on a model; close up, true to size.
        const exaggerate = 1 + Math.min(Math.max((viewDistance - 40) / 120, 0), 1.3);

        type Candidate = {entry: Entry; distance: number; model: SpeciesModel | undefined; visible: boolean; pose: Pose; modelHeight: number; modelScale: number};
        const candidates: Candidate[] = [];
        for (const entry of allEntries()) {
            const slug = entry.animal.model_slug;
            const model = library.get(slug);
            if (entry.held || entry.act?.hidden) {
                entry.middle = null;
                continue;
            }
            // Asleep eases in; an animal in an act is wide awake.
            const restTarget = entry.awake || entry.act ? 0 : 1;
            if (!reducedMotion) entry.rest += (restTarget - entry.rest) * Math.min(dt * 1.5, 1);
            // Loops (a swimmer's, a flyer's) slow almost to a stop asleep.
            const plan = model?.behaviour?.plan ?? "";
            const pace = 1 - 0.85 * entry.rest;
            // Its speed sets the pace: a tuna laps the reef, a turtle drifts.
            if (ZONE_SITES[entry.animal.zone]?.kind === "sea" && SWIMMING_PLANS.has(plan)) entry.loop += dt * (0.05 + entry.phase * 0.05) * (entry.phase > 0.5 ? 1 : -1) * pace * entry.pace;
            else if (entry.air > 0.001) entry.loop += dt * (0.16 + entry.phase * 0.08) * pace * entry.pace;
            // A flyer that is selected comes down to its spot (unless followed), and so does a sleeping one; otherwise it takes to the air again.
            if (FLYERS.has(slug) && ZONE_SITES[entry.animal.zone]?.kind !== "sea" && !entry.act) {
                const target = (selectedId === entry.animal.id && followId !== entry.animal.id) || reducedMotion || !entry.awake ? 0 : 1;
                entry.air += (target - entry.air) * 0.02;
            }
            entry.lift += ((selectedId === entry.animal.id ? 1 : 0) - entry.lift) * 0.08;
            const modelScale = model ? entry.length / model.bodyLength : 1;
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
        const dotList: FindDot[] = [];
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
            entry.yawNow = where.yaw;
            const lift = entry.lift * modelHeight * 0.12;
            // Near and awake: now and then it looks round, startles, shakes, bobs or dozes (the talking models' idles, as root motion).
            if (level === "near" && entry.awake && !entry.act && !entry.visitor && model && !reducedMotion) {
                // The sharper it is, the more different things it does (`arkIdleBehaviour`).
                entry.director ??= new BehaviourDirector(arkIdleBehaviour(model.behaviour, entry.stats.intelligence), IDLE_ABILITIES, BehaviourRandom.seed(animal.id));
                const idle = entry.director.pose(now, false);
                where.yaw += idle.yaw;
                where.pitch += idle.pitch;
                where.roll += idle.roll;
                where.base += idle.lift * candidate.modelScale;
                // A camera close by: now and then it glances at it, more often the sharper it is.
                const looking = candidate.distance < GLANCE_WITHIN && !where.afloat ? glance(entry.stats.intelligence, now, entry.phase) : 0;
                if (looking > 0) {
                    let turn = Math.atan2(cameraPosition.x - where.x, cameraPosition.z - where.z) - where.yaw;
                    while (turn > Math.PI) turn -= Math.PI * 2;
                    while (turn < -Math.PI) turn += Math.PI * 2;
                    where.yaw += Math.min(Math.max(turn, -1.1), 1.1) * 0.8 * looking;
                    where.pitch -= 0.05 * looking;
                }
            }
            entry.middle = (entry.middle ?? new Vector3()).set(where.x, where.base + lift + modelHeight / 2, where.z);
            const rest = Math.max(entry.place.ground, 0);
            const marked = selectedId === animal.id ? 2 : mineOnly && animal.mine ? 1 : 0;
            // Too small to find on its own (at the size floor, or a few pixels across from far): a soft dot over it, and its icon once tapped.
            if (level !== "token" && !entry.act) {
                const perPixel = 2 * Math.tan(FOV * Math.PI / 360) * candidate.distance / height;
                const pixels = entry.length * sizeUp / perPixel;
                if (entry.floor || pixels < MARKER_BELOW_PIXELS) {
                    const top = where.base + lift + modelHeight + Math.max(perPixel * 7, 0.08);
                    dotList.push({x: where.x, y: Math.max(top, rest + 0.1), z: where.z, pixels: marked === 2 ? 11 : 8, alpha: dim ? 0.35 : 1});
                    if (marked === 2 && tokens.loaded(animal.model_slug)) tokenList.push({slug: animal.model_slug, x: where.x, y: Math.max(top, rest + 0.1) + perPixel * 20, z: where.z, size: 0.5, dim: 0, ring: 2, grow});
                }
            }

            if (level === "token") {
                counts.token++;
                tokenList.push({slug: animal.model_slug, x: where.x, y: Math.max(where.base + modelHeight * 0.75, rest + 0.4), z: where.z, size: Math.max(entry.length * 1.1, 1.6), dim, ring: marked, grow});
                continue;
            }

            // The one talking: its full talking model stands in its place.
            const actor = talking.actor;
            if (actor?.ready && talking.weight > 0 && talking.target?.animalId === animal.id && actor.slug === animal.model_slug) {
                const as = (entry.length / Math.max(bodyAxisExtent(actor.slug, model?.behaviour?.plan, {x: actor.width, y: actor.height, z: actor.length}), 0.05)) * sizeUp;
                const bob = talking.open * 0.06;
                euler.set(where.pitch + bob, where.yaw + Math.sin(now * 1.1) * 0.05 * talking.weight, where.roll + Math.sin(now * 0.7) * 0.02 * talking.weight);
                actor.root.rotation.copy(euler);
                actor.root.position.set(where.x, where.base + lift - actor.minY * as, where.z);
                actor.root.scale.setScalar(as);
                actor.root.visible = true;
                if (!where.afloat) shadowList.push({x: where.x, y: rest, z: where.z, width: Math.max(entry.length * sizeUp * 0.5, 0.4), length: entry.length * sizeUp, yaw: where.yaw, strength: 1});
                if (marked) ringList.push({x: where.x, y: where.afloat ? 0 : rest, z: where.z, radius: Math.max(entry.length * sizeUp * 0.8, 0.7), color: marked === 2 ? SELECTED : MINE, alpha: 1});
                counts.near++;
                continue;
            }

            const mesh = (level === "near" ? species.get(animal.model_slug)?.near : species.get(animal.model_slug)?.far) ?? null;
            if (!mesh || !model) continue;
            const index = perMesh.get(mesh) ?? 0;
            perMesh.set(mesh, index + 1);
            used.add(mesh);
            if (level === "near") counts.near++;
            else counts.far++;
            const act = entry.act;
            const s = candidate.modelScale * sizeUp * grow * (act ? Math.max(act.scale, 0.001) : 1);
            euler.set(where.pitch, where.yaw, where.roll);
            rotation.setFromEuler(euler);
            position.set(where.x, where.base + lift - model.minY * s - (1 - Math.min(grow, 1)) * modelHeight * 0.3, where.z);
            matrix.compose(position, rotation, scale.set(s, s, s));
            mesh.setMatrixAt(index, matrix);
            (mesh.geometry.getAttribute("arkInstance") as InstancedBufferAttribute).setXYZ(index, entry.phase, act ? act.dim : dim, entry.rest);

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
        dots.set(dotList);
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
        // (Not while following: a flyer is followed up in the air.)
        if (Math.abs(lift) > 0.001 && !followId) {
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
        for (const entry of allEntries()) {
            if (!entry.middle || entry.ghost) continue;
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

    /** A bearing away from the south from which the ground doesn't hide `target` (the first clear one; else the side). */
    const clearAzimuth = (target: Vector3, distance: number, polar: number, phase: number): number => {
        const side = phase < 0.5 ? 1 : -1;
        const bearings = [side * Math.PI / 2, -side * Math.PI / 2, side * Math.PI * 0.75, -side * Math.PI * 0.75, Math.PI];
        const look = new Spherical();
        const point = new Vector3();
        for (const azimuth of bearings) {
            look.set(distance, polar, azimuth);
            const away = new Vector3().setFromSpherical(look);
            let clear = true;
            for (let t = 0.08; t <= 1 && clear; t += 0.08) {
                point.copy(target).addScaledVector(away, t);
                clear = heightAt(point.x, point.z) < point.y - 0.25;
            }
            if (clear) return azimuth;
        }
        return bearings[0];
    };

    const select = (id: string | null, flyTo: boolean, close = false) => {
        selectedId = id;
        if (followId && followId !== id) endFollow();
        const entry = findEntry(id);
        options.onSelect?.(entry?.animal ?? null);
        if (entry && flyTo) {
            // A selection from the page (the HUD, `?focus=`) ends the opening, as a touch does.
            opening = false;
            controls.autoRotate = false;
            lastTouch = performance.now() / 1000;
            const distance = camera.position.distanceTo(controls.target);
            // Where it will rest: its own spot (a flyer lands; a swimmer is followed).
            const middle = entry.middle;
            const target = middle ? new Vector3(middle.x, Math.max(entry.place.ground, 0) + entry.drawnHeight * 0.4, middle.z) : new Vector3(entry.place.x, Math.max(entry.place.ground, 0) + entry.drawnHeight * 0.4, entry.place.z);
            if (close) {
                // Face to face: low, near, from three-quarters in front, where its mouth can be seen.
                // A visitor is seen from along the beach, with the jetty beside it rather than under the camera.
                fly(target, 3.5 + entry.length * 2, 1.6, 1.26, (entry.yawNow ?? entry.place.yaw) + 0.35);
                return;
            }
            const distanceTo = distance > 40 ? 10 + entry.length * 4 : Math.min(distance, 10 + entry.length * 6);
            // One partly behind a tree or a rock from the south is seen from the side or the north, wherever the ground leaves a clear view.
            fly(target, distanceTo, 1.3, CLOSE_POLAR, entry.place.covered ? clearAzimuth(target, distanceTo, CLOSE_POLAR, entry.phase) : undefined);
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
        // A touch during a replay skips it: the Ark as it is now.
        if (replay) finishReplay(true, true);
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
    const onPointerMove = (event: PointerEvent) => {
        // Any drag ends following.
        if (followId && down && Math.hypot(event.clientX - down.x, event.clientY - down.y) > 8) endFollow();
        else if (followId && pointers > 1) endFollow();
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
    canvas.addEventListener("pointermove", onPointerMove);
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
        dots.setViewport(FOV, height);
        post.setSize(width, height, pixelRatio);
        motes.setPixelRatio(pixelRatio);
        dust.setPixelRatio(pixelRatio);
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

    // MARK: Visitor and talking

    /** The visitor faces along the beach, a little toward the sea: seen face on from the sand, the jetty beside it. */
    const visitorYaw = () => Math.atan2(-Math.sin(VISITOR_LANDING.theta), Math.cos(VISITOR_LANDING.theta)) + 0.3;

    /** A small jetty at the landing: planks on posts, from the beach out over the water. */
    const buildJetty = (): Group => {
        const group = new Group();
        const wood = new MeshStandardMaterial({color: new Color("#8a6a4a"), roughness: 0.85, metalness: 0});
        const dark = new MeshStandardMaterial({color: new Color("#5e4632"), roughness: 0.9, metalness: 0});
        const from = VISITOR_LANDING.deckFrom;
        const to = VISITOR_LANDING.deckTo;
        const length = Math.hypot(to.x - from.x, to.z - from.z);
        const angle = Math.atan2(to.x - from.x, to.z - from.z);
        const geometries: BufferGeometry[] = [];
        const planks = Math.round(length / 0.5);
        for (let i = 0; i < planks; i++) {
            const plank = new BoxGeometry(1.7, 0.08, 0.42);
            geometries.push(plank);
            const mesh = new Mesh(plank, i % 3 === 0 ? dark : wood);
            mesh.position.set(0, 0.38, -length / 2 + (i + 0.5) * (length / planks));
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            group.add(mesh);
        }
        for (let i = 0; i <= 3; i++) {
            for (const side of [-0.78, 0.78]) {
                const post = new CylinderGeometry(0.07, 0.08, 1.8, 6);
                geometries.push(post);
                const mesh = new Mesh(post, dark);
                mesh.position.set(side, -0.5, -length / 2 + (i / 3) * length);
                mesh.castShadow = true;
                group.add(mesh);
            }
        }
        group.position.set((from.x + to.x) / 2, 0, (from.z + to.z) / 2);
        group.rotation.y = angle;
        group.userData.dispose = () => {
            geometries.forEach((geometry) => geometry.dispose());
            wood.dispose();
            dark.dispose();
        };
        return group;
    };

    const setVisitor = (next: ArkVisitor | null): string | null => {
        if (!next) {
            if (selectedId && visitor && selectedId === visitor.animal.id) select(null, false);
            visitor = null;
            visitorLabel?.remove();
            visitorLabel = null;
            if (jetty) {
                scene.remove(jetty);
                (jetty.userData.dispose as () => void)();
                jetty = null;
            }
            return null;
        }
        const id = `visitor:${next.slug}`;
        const foot = VISITOR_LANDING.foot;
        visitor = {
            animal: {
                id,
                species_profile_id: "",
                name: next.name,
                scientific_name: null,
                model_slug: next.slug,
                zone: "seashore",
                arrived_at: "",
                brought_by: {label: "", named: false},
                mine: false
            },
            place: {x: foot.x, z: foot.z, ground: heightAt(foot.x, foot.z), yaw: visitorYaw(), water: false},
            length: displayLength(next.slug),
            stats: arkStats({model_slug: next.slug}),
            floor: arkBody({model_slug: next.slug}).floor,
            pace: loopPace({model_slug: next.slug}),
            arrivedAt: (performance.now() - started) / 1000,
            level: "far",
            phase: phaseOf(id),
            middle: null,
            drawnHeight: 1,
            air: 0,
            lift: 0,
            visitor: true,
            awake: true,
            rest: 0,
            loop: 0
        };
        library.ready().then(() => {
            if (library.has(next.slug)) {
                library.request(next.slug, "far");
                library.request(next.slug, "near");
            }
        });
        if (!jetty) {
            jetty = buildJetty();
            scene.add(jetty);
        }
        if (!visitorLabel) {
            visitorLabel = document.createElement("span");
            Object.assign(visitorLabel.style, {
                position: "absolute",
                left: "0",
                top: "0",
                whiteSpace: "nowrap",
                font: "600 11px/1 var(--font-sans, ui-sans-serif, system-ui, sans-serif)",
                letterSpacing: "0.04em",
                color: "rgba(255, 252, 244, 0.96)",
                padding: "6px 9px",
                borderRadius: "999px",
                background: "rgba(14, 20, 14, 0.62)",
                backdropFilter: "blur(8px)",
                border: "1px solid rgba(255, 255, 255, 0.16)",
                opacity: "0",
                transition: "opacity 300ms ease",
                willChange: "transform"
            });
            labelLayer.appendChild(visitorLabel);
        }
        visitorLabel.textContent = next.label;
        return id;
    };

    const visitorPoint = new Vector3();
    const placeVisitorLabel = () => {
        if (!visitorLabel) return;
        const middle = visitor?.middle;
        if (!middle) {
            visitorLabel.style.opacity = "0";
            return;
        }
        visitorPoint.copy(middle).setY(middle.y + (visitor?.drawnHeight ?? 1) * 0.55 + 0.25).project(camera);
        const visible = visitorPoint.z < 1 && Math.abs(visitorPoint.x) < 1.05 && Math.abs(visitorPoint.y) < 1.05;
        visitorLabel.style.opacity = visible ? "1" : "0";
        if (visible) visitorLabel.style.transform = `translate(${((visitorPoint.x + 1) / 2 * width).toFixed(1)}px, ${((1 - visitorPoint.y) / 2 * height).toFixed(1)}px) translate(-50%, -100%) translateY(-6px)`;
    };

    const setTalking = (next: ArkTalking | null) => {
        const now = performance.now() / 1000;
        if (!next || !next.active) {
            if (talking.target) talking.target = {...talking.target, active: false};
            talking.mouth.flush(now - started / 1000);
            return;
        }
        const changed = !talking.target || talking.target.slug !== next.slug || talking.target.animalId !== next.animalId;
        if (changed) talking.mouth.clear();
        talking.target = {...next};
        talking.lastActive = now;
        if (!talking.actor || talking.actor.slug !== next.slug) {
            talking.actor?.dispose();
            talkingModels ??= talkingSource(options.talkingBase ?? options.modelBase.replace(/\/ark\/?$/, ""));
            const actor = new TalkingActor(next.slug, talkingModels, () => undefined);
            talking.actor = actor;
            scene.add(actor.root);
        }
    };

    /** Each frame: the mouth from the text (or the voice), and the swap back once it has been quiet a while. */
    let lastTalkStep = 0;
    const stepTalking = (elapsed: number) => {
        const actor = talking.actor;
        const delta = lastTalkStep ? Math.min(elapsed - lastTalkStep, 0.1) : 0;
        lastTalkStep = elapsed;
        if (!actor) return;
        const active = Boolean(talking.target?.active);
        const now = performance.now() / 1000;
        if (active) talking.lastActive = now;
        const fromVoice = now - talking.pulseAt < 0.25 ? talking.pulse : 0;
        const want = reducedMotion ? 0 : Math.max(talking.mouth.level(elapsed), fromVoice);
        talking.open = actor.ready ? actor.setMouth(want, delta) : 0;
        const speaking = active || talking.mouth.speaking || now - talking.lastActive < 1.4;
        talking.weight = speaking ? 1 : 0;
        // Shown again by updateInstances when its animal is drawn this frame.
        actor.root.visible = false;
    };

    // MARK: Following

    const endFollow = () => {
        if (!followId) return;
        followId = null;
        options.onFollowEnd?.();
    };

    const follow = (id: string | null) => {
        if (!id || !findEntry(id)) {
            followId = null;
            return;
        }
        followId = id;
        controls.autoRotate = false;
        lastTouch = performance.now() / 1000;
    };

    // MARK: The hour

    let lastClock = performance.now() / 1000;
    const setLight = () => {
        lighting.setHours(hoursNow(), fog);
        applyHours();
    };

    // MARK: Replay ("while you were away")

    type Running = {
        acts: ArkAct[];
        index: number;
        begun: boolean;
        /** Since when the next act has waited for its models (a chase needs the body plan). */
        waitFrom: number | null;
        /** When the current act's acting began (after the camera's flight); null while flying. */
        actingFrom: number | null;
        seconds: number;
        lastT: number;
        /** The current act, each frame: t is seconds since the acting began. */
        step: ((t: number, last: number, now: number) => void) | null;
        onAct?: (index: number) => void;
        resolve: () => void;
        home: {target: Vector3; distance: number; polar: number; azimuth: number};
        /** Who stands where a stand-in stood (its place, given again): shown once the act that ends the stand-in is over. */
        after: Map<Entry, number>;
    };
    let replay: Running | null = null;

    const elapsedNow = () => (performance.now() - started) / 1000;
    const inWater = (entry: Entry) => ZONE_SITES[entry.animal.zone]?.kind === "sea" || entry.place.water;

    /** Where an entry is now and how big, as the acts take it. */
    const bodyOf = (entry: Entry): ActBody => {
        const model = library.get(entry.animal.model_slug);
        const modelScale = model ? entry.length / model.bodyLength : 1;
        const height = model ? model.height * modelScale : entry.length * 0.6;
        const saved = entry.act;
        entry.act = null;
        const where = pose(entry, model, height, elapsedNow());
        entry.act = saved;
        return {x: where.x, z: where.z, base: where.base, yaw: where.yaw, length: entry.length, height, speed: moveSpeed(entry.animal, entry.length)};
    };

    const entryFor = (animal: ArkEventAnimal): Entry | null => findEntry(animal.id) ?? ghosts.find((ghost) => ghost.animal.id === animal.id) ?? null;

    /** The camera across a chase: side on, the short way round from where it looks now. */
    const sideOn = (dx: number, dz: number) => {
        spherical.setFromVector3(offset.copy(camera.position).sub(controls.target));
        const across = Math.atan2(dz, -dx);
        const options2 = [across, across + Math.PI];
        const delta = (a: number) => Math.abs(Math.atan2(Math.sin(a - spherical.theta), Math.cos(a - spherical.theta)));
        return delta(options2[0]) <= delta(options2[1]) ? options2[0] : options2[1];
    };

    /** A polar angle from which the camera sees `focus` over the hills: lower (more from above) until nothing is in the way. */
    const clearPolar = (focus: {x: number; y: number; z: number}, distance: number, polar: number, azimuth: number) => {
        for (let phi = polar; phi > 0.55; phi -= 0.12) {
            let blocked = false;
            for (let k = 0.15; k < 1 && !blocked; k += 0.1) {
                const r = distance * k;
                const x = focus.x + Math.sin(phi) * Math.sin(azimuth) * r;
                const y = focus.y + Math.cos(phi) * r;
                const z = focus.z + Math.sin(phi) * Math.cos(azimuth) * r;
                if (heightAt(x, z) > y - 0.4) blocked = true;
            }
            if (!blocked) return phi;
        }
        return 0.55;
    };

    const beginAct = (run: Running) => {
        const act = run.acts[run.index];
        run.actingFrom = null;
        run.step = null;
        run.lastT = 0;
        run.onAct?.(run.index);
        const toFrame = (focus: {x: number; y: number; z: number}, distance: number, polar: number, azimuth: number | undefined, seconds: number, then: () => void) => {
            spherical.setFromVector3(offset.copy(camera.position).sub(controls.target));
            const bearing = azimuth ?? spherical.theta;
            fly(new Vector3(focus.x, focus.y, focus.z), distance, reducedMotion ? 0 : 1.2, clearPolar(focus, distance, polar, bearing), bearing, () => {
                run.seconds = seconds;
                run.actingFrom = performance.now() / 1000;
                then();
            });
        };
        if (act.kind === "arrival" || act.kind === "birth") {
            const arrivals = (act.kind === "arrival" ? [act.animal] : act.young).map(entryFor).filter((entry): entry is Entry => Boolean(entry));
            const first = arrivals[0];
            if (!first) {
                run.seconds = 0.4;
                run.actingFrom = performance.now() / 1000;
                return;
            }
            const parent = act.kind === "birth" ? act.parents.map((id) => findEntry(id)).find(Boolean) ?? null : null;
            const focus = parent ?? first;
            toFrame({x: (first.place.x + focus.place.x) / 2, y: Math.max(first.place.ground, 0) + 0.5, z: (first.place.z + focus.place.z) / 2}, 8 + first.length * 3.2, 1.12, undefined, act.kind === "arrival" ? ARRIVAL_SECONDS : BIRTH_SECONDS, () => {
                run.step = (t) => {
                    arrivals.forEach((entry, i) => {
                        if (entry.held && t >= 0.15 + i * 0.35) {
                            entry.held = false;
                            // A flyer comes aboard on the ground, then takes to the air.
                            entry.air = 0;
                            entry.arrivedAt = elapsedNow();
                        }
                    });
                };
            });
            return;
        }
        if (act.kind === "death") {
            const entry = entryFor(act.animal);
            if (!entry) {
                run.seconds = 0.4;
                run.actingFrom = performance.now() / 1000;
                return;
            }
            const body = bodyOf(entry);
            entry.act = deathPose(body, 0);
            toFrame({x: body.x, y: Math.max(body.base, 0) + body.height * 0.4, z: body.z}, 7 + body.length * 3, 1.15, undefined, DEATH_SECONDS, () => {
                run.step = (t) => {
                    entry.act = deathPose(body, t);
                };
            });
            return;
        }
        if (act.kind === "extinction") {
            run.seconds = EXTINCTION_SECONDS;
            run.actingFrom = performance.now() / 1000;
            return;
        }
        // A meal.
        const predator = entryFor(act.predator);
        const prey = entryFor(act.prey);
        if (!predator || !prey) {
            run.seconds = 0.4;
            run.actingFrom = performance.now() / 1000;
            return;
        }
        const model = library.get(predator.animal.model_slug);
        const kind = chaseKind({
            predatorSlug: predator.animal.model_slug,
            predatorPlan: model?.behaviour?.plan ?? null,
            predatorWater: inWater(predator),
            preyWater: inWater(prey),
            predatorFlies: FLYERS.has(predator.animal.model_slug) && ZONE_SITES[predator.animal.zone]?.kind !== "sea"
        });
        const stage: MealStage = mealStage(kind, bodyOf(predator), bodyOf(prey));
        // Both hold where they are while the camera comes.
        prey.act = stage.prey(0);
        if (kind !== "cutaway") predator.act = stage.predator(0);
        const dx = prey.place.x - predator.place.x;
        const dz = prey.place.z - predator.place.z;
        const azimuth = kind === "cutaway" ? undefined : sideOn(dx, dz);
        toFrame(stage.focus, stage.distance, stage.polar, azimuth, stage.seconds, () => {
            let turned = false;
            run.step = (t, last, now) => {
                prey.act = stage.prey(t);
                if (kind !== "cutaway") predator.act = stage.predator(t);
                for (const puff of stage.puffs(last, t)) dust.add(puff, now);
                if (stage.turnAt !== undefined && t >= stage.turnAt && !turned) {
                    // The cut-away: the camera turns aside, out to the sea's horizon, while it happens.
                    turned = true;
                    const out = Math.hypot(stage.focus.x, stage.focus.z) > 1 ? Math.atan2(stage.focus.x, stage.focus.z) : 0;
                    const target = new Vector3(stage.focus.x + Math.sin(out) * 26, 1.5, stage.focus.z + Math.cos(out) * 26);
                    // From behind the prey's spot, looking out: the camera's bearing is the way back toward the island.
                    fly(target, 30, reducedMotion ? 0 : 1.3, 1.34, out + Math.PI);
                }
            };
        });
    };

    /** The Ark as it is now: everyone in place, the stand-ins gone; the view goes back unless a touch took it. */
    const finishReplay = (skipped: boolean, touched = false) => {
        const run = replay;
        if (!run) return;
        replay = null;
        for (const entry of entries) {
            if (entry.held) {
                entry.held = false;
                entry.arrivedAt = skipped ? null : entry.arrivedAt;
            }
            entry.act = null;
        }
        ghosts = [];
        dust.clear();
        flight = null;
        if (!touched) fly(run.home.target, run.home.distance, 1.6, run.home.polar, run.home.azimuth);
        run.resolve();
    };

    /** A meal's two models, loaded (or not to be had): the chase depends on the eater's body plan and both sizes. */
    const modelsReady = (act: ArkAct) => act.kind !== "meal" || [act.predator.model_slug, act.prey.model_slug].every((slug) => !library.has(slug) || Boolean(library.get(slug)));

    const stepReplay = (now: number) => {
        const run = replay;
        if (!run || opening) return;
        if (!run.begun) {
            run.waitFrom ??= now;
            if (!modelsReady(run.acts[run.index]) && now - run.waitFrom < 4) return;
            run.waitFrom = null;
            run.begun = true;
            beginAct(run);
        }
        if (run.actingFrom === null) return;
        const t = now - run.actingFrom;
        run.step?.(t, run.lastT, now);
        run.lastT = t;
        if (t >= run.seconds) {
            // The act's end: whoever moved goes back to its own place (the camera is moving on).
            const act = run.acts[run.index];
            if (act.kind === "meal") {
                const predator = entryFor(act.predator);
                if (predator) predator.act = null;
            }
            run.after.forEach((index, entry) => {
                if (index !== run.index || !entry.held) return;
                entry.held = false;
                entry.arrivedAt = elapsedNow();
            });
            run.index++;
            // The next act begins (once its models are in) on a later frame.
            if (run.index >= run.acts.length) finishReplay(false);
            else run.begun = false;
        }
    };

    const play = (acts: ArkAct[], callbacks?: {onAct?: (index: number) => void}): ArkReplayRun => {
        if (replay) finishReplay(true);
        if (!acts.length) return {skip: () => undefined, done: Promise.resolve()};
        // Who arrived or was born since: held back until their act.
        for (const act of acts) {
            const ids = act.kind === "arrival" ? [act.animal.id] : act.kind === "birth" ? act.young.map((a) => a.id) : [];
            for (const id of ids) {
                const entry = entryById.get(id);
                if (entry) entry.held = true;
            }
        }
        // Who is gone now (eaten, or died): standing in where they were until their act.
        const gone = new Map<string, ArkEventAnimal>();
        for (const act of acts) {
            const named = act.kind === "meal" ? [act.predator, act.prey] : act.kind === "death" ? [act.animal] : [];
            for (const animal of named) if (!entryById.has(animal.id)) gone.set(animal.id, animal);
        }
        // The server's own record of each (its place included), so it stands where it stood.
        const ghostAnimals: ArkAnimal[] = Array.from(gone.values()).map((animal) => ({
            id: animal.id,
            species_profile_id: animal.species_profile_id,
            name: animal.name,
            scientific_name: null,
            model_slug: animal.model_slug,
            zone: animal.zone,
            arrived_at: animal.arrived_at ?? "",
            brought_by: {label: "", named: false},
            mine: false,
            origin: animal.origin ?? undefined,
            generation: animal.generation ?? undefined,
            slot: animal.slot,
            slot_rank: animal.slot_rank,
            sociality: animal.sociality,
            activity: animal.activity
        }));
        const places = ghostAnimals.length ? placeAnimals(ghostAnimals) : new Map<string, Placement>();
        ghosts = ghostAnimals.map((animal) => Object.assign(newEntry(animal, places.get(animal.id)!, null), {ghost: true}));
        const after = new Map<Entry, number>();
        for (const ghost of ghosts) {
            ghost.leader = null;
            // One that came aboard since and is gone already: held back until its own arrival.
            ghost.held = acts.some((act) => (act.kind === "arrival" && act.animal.id === ghost.animal.id) || (act.kind === "birth" && act.young.some((a) => a.id === ghost.animal.id)));
            // Its place was given again since (only the living hold one): the newcomer waits until it is gone.
            const end = acts.findIndex((act) => (act.kind === "meal" && act.prey.id === ghost.animal.id) || (act.kind === "death" && act.animal.id === ghost.animal.id));
            if (end < 0) continue;
            for (const entry of entries) {
                if (entry.held || entry.animal.zone !== ghost.animal.zone || Math.hypot(entry.place.x - ghost.place.x, entry.place.z - ghost.place.z) > 0.05) continue;
                entry.held = true;
                after.set(entry, end);
            }
        }
        applyHours();
        // Their models, near and far.
        const slugs = new Set(acts.flatMap((act) => (act.kind === "meal" ? [act.predator.model_slug, act.prey.model_slug] : act.kind === "death" || act.kind === "arrival" ? [act.animal.model_slug] : act.kind === "birth" ? act.young.map((a) => a.model_slug) : [])));
        library.ready().then(() => {
            slugs.forEach((slug) => {
                if (!library.has(slug)) return;
                library.request(slug, "far");
                library.request(slug, "near");
                tokens.ensure(slug);
            });
        });
        controls.autoRotate = false;
        spherical.setFromVector3(offset.copy(camera.position).sub(controls.target));
        const view = opening ? homeView() : null;
        let resolve = () => undefined as void;
        const done = new Promise<void>((r) => {
            resolve = r;
        });
        replay = {
            acts,
            index: 0,
            begun: false,
            waitFrom: null,
            actingFrom: null,
            seconds: 0,
            lastT: 0,
            step: null,
            onAct: callbacks?.onAct,
            resolve,
            after,
            home: view ? {target: view.target, distance: view.distance, polar: view.polar, azimuth: view.azimuth} : {target: controls.target.clone(), distance: spherical.radius, polar: spherical.phi, azimuth: spherical.theta}
        };
        return {skip: () => finishReplay(true), done};
    };

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
        if (!reducedMotion && !flight && !selectedId && !followId && !opening && !replay && now - lastTouch > IDLE_DRIFT_AFTER) controls.autoRotate = true;
        controls.update();
        keepInWorld();
        stepTalking(elapsed);
        // The hour: read again every minute (the light changes only a little).
        if (now - lastClock > 60 && !replay) {
            lastClock = now;
            setLight();
        }
        stepReplay(now);
        updateInstances(elapsed);
        dust.step(now);
        // Following: the camera keeps the animal in the middle of the view, at the height it is (a flyer in the air).
        const followed = followId ? findEntry(followId) : null;
        if (followed?.middle && !flight && pointers === 0) {
            const k = reducedMotion ? 1 : 0.12;
            const dx = (followed.middle.x - controls.target.x) * k;
            const dy = (followed.middle.y - followed.drawnHeight * 0.1 - controls.target.y) * k;
            const dz = (followed.middle.z - controls.target.z) * k;
            controls.target.x += dx;
            controls.target.y += dy;
            controls.target.z += dz;
            camera.position.x += dx;
            camera.position.y += dy;
            camera.position.z += dz;
        }
        // Otherwise a selected animal that moves (a swimmer's loop) is kept in view.
        const tracked = selectedId && !followed ? findEntry(selectedId)?.middle : null;
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
        placeVisitorLabel();

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
    if (process.env.NODE_ENV !== "production") (window as unknown as {__arkDebug?: unknown}).__arkDebug = {camera, controls, scene, visitor: () => visitor, talking, lighting, entries: () => allEntries(), replaying: () => Boolean(replay), following: () => followId};

    return {
        update: (snapshot) => setSnapshot(snapshot, true),
        setMineOnly: (value) => {
            mineOnly = value;
        },
        select: (id, closeUp) => select(id, true, Boolean(closeUp)),
        follow,
        setHours: (hours) => {
            pinnedHours = typeof hours === "number" && Number.isFinite(hours) ? hours : null;
            setLight();
        },
        play,
        setVisitor,
        setTalking,
        talkText: (chunk) => {
            if (!talking.target) return;
            talking.mouth.feed(chunk, performance.now() / 1000 - started / 1000);
        },
        talkPulse: (level) => {
            talking.pulse = Math.min(Math.max(level, 0), 1);
            talking.pulseAt = performance.now() / 1000;
            talking.lastActive = talking.pulseAt;
        },
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
            canvas.removeEventListener("pointermove", onPointerMove);
            canvas.removeEventListener("pointercancel", onPointerCancel);
            canvas.removeEventListener("wheel", onWheel);
            controls.dispose();
            species.forEach((meshes) => {
                meshes.near?.dispose();
                meshes.far?.dispose();
                meshes.nearMaterial?.dispose();
                meshes.farMaterial?.dispose();
            });
            talking.actor?.dispose();
            replay = null;
            dust.dispose();
            if (jetty) (jetty.userData.dispose as () => void)();
            library.dispose();
            tokens.dispose();
            dots.dispose();
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
