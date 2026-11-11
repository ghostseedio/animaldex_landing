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
 *
 * Small animals live at microhabitats (`micro.ts`, docs/ark-micro.md): on
 * the cottage at Home, on trunks, flowers, stones, leaf litter and the
 * pond's surface. Close by they are drawn true to size against them (the
 * floor and the marker only from afar), crawl on their surface, and moths
 * circle the porch light at night.
 */

import {
    ACESFilmicToneMapping,
    Color,
    DynamicDrawUsage,
    Fog,
    FogExp2,
    Frustum,
    InstancedBufferAttribute,
    InstancedMesh,
    Matrix4,
    PCFSoftShadowMap,
    PerspectiveCamera,
    Quaternion,
    Scene,
    Raycaster,
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
import {AnimalLook, attachLook, speciesLook} from "@/ark-scene/animal-look";
import {DustPuffs} from "@/ark-scene/dust";
import {HerdSpecks, textureColour, type SpeckShape} from "@/ark-scene/herd-specks";
import {ARK_HERD_LIVE, ARK_HERD_LIVE_LITE, arkRepresentatives, HERD_FIGURE_BUDGET, HERD_SPECK_BELOW_PIXELS, type ArkHerd} from "@/ark-scene/herds";
import {ARK_PLACEHOLDER_ICON, isArkPlaceholderSlug} from "@/ark-scene/placeholder";
import {ARK_TIME} from "@/ark-scene/glsl";
import {IconTokens, type TokenInstance} from "@/ark-scene/icons";
import {buildMotes} from "@/ark-scene/life";
import {ArkLighting} from "@/ark-scene/lighting";
import {ContactShadows, FindDots, GroundRings, type FindDot, type Ring, type Shadow} from "@/ark-scene/marks";
import {ModelLibrary, type SpeciesModel} from "@/ark-scene/models";
import {microDrawnLength, microSpecies, nightLight, surfacePoint, viewFrom, type MicroSpecies, type SurfacePoint} from "@/ark-scene/micro";
import {buildMicroScene} from "@/ark-scene/micro-scene";
import {rigBaseFrom} from "@/ark-scene/rig-clips";
import {clipRows, cyclesFor, newRigState, RIG_CAPS, RIG_CAPS_LITE, RIG_FADE_SECONDS, RigLibrary, rigSwitch, rootOffset, type RigClipData, type RigModel, type RigState} from "@/ark-scene/rig-player";
import {canopyPoint, leapTarget, speciesLayer, tunnelPoint, type SpeciesLayer} from "@/ark-scene/layers";
import {buildLayersScene, planktonClouds} from "@/ark-scene/layers-scene";
import {breathAt, depthSeed, fitInWater, heldOffWater, safeLoopRadius, schoolFile, schoolOffset, speciesDepth, swimPitch, waterLoopRadius, waterMotion, waterPace, waterSpec, type SpeciesDepth, type WaterSpec} from "@/ark-scene/sea-depth";
import {canMoment, momentBeats, momentPose, MOMENT_SECONDS, type ArkMomentKind, type MomentBeat, type MomentFrom} from "@/ark-scene/moments";
import {ARK_CAUSTICS} from "@/ark-scene/terrain";
import {ArkNests, nestKind} from "@/ark-scene/nests";
import {ARK_SCENE_MODULES, type ArkSceneModule} from "@/ark-scene/scene-modules";
import {placeAnimals, type Placement} from "@/ark-scene/placement";
import {ArkPost, lowerTier, tierFor, type QualityTier} from "@/ark-scene/post";
import {displayLength, SWIMMING_PLANS} from "@/ark-scene/sizes";
import {arkBody, arkIdleBehaviour, bodyAxisExtent, arkStats, glance, loopPace, moveSpeed, type ArkStats} from "@/ark-scene/stats";
import {ARK_GROUND_LITE, buildLandscape} from "@/ark-scene/terrain";
import {loadGroundTextures} from "@/ark-scene/ground-textures";
import {NearDetail} from "@/ark-scene/near-detail";
import {buildVegetation} from "@/ark-scene/vegetation";
import {TalkingActor, talkingSource, TextMouth, type TalkingModelSource} from "@/ark-scene/talking";
import {isAwake} from "@/lib/ark-daylight";
import {islandHours, seaLevelAt, weatherAt} from "@/lib/ark-clock";
import {ARK_ENV as ARK_ENVIRONMENT, ARK_WIND as ARK_WIND_VECTOR} from "@/ark-scene/glsl";
import {WATER_WIND} from "@/ark-scene/terrain";
import type {ArkEnvironment} from "@/ark-scene/sampler";
import {arkHatchNest, type ArkAct, type ArkEventAnimal} from "@/lib/ark-life";
import {BehaviourDirector, BehaviourRandom} from "@/lib/talking-models/behaviour";
import {
    ARK_REGIONS,
    type ArkAnimal,
    type ArkCameraView,
    type ArkHerdInfo,
    type ArkReplayRun,
    type ArkRegion,
    type ArkSceneHandle,
    type ArkSceneOptions,
    type ArkSceneStats,
    type ArkSnapshot,
    type ArkTalking,
    type ArkVisitor
} from "@/ark-scene/types";
import {ARK_FLYERS} from "@/ark-scene/flyers";
import {animationTargets, behaviourState, sameBehaviour, type ArkBehaviourState} from "@/ark-scene/behaviour-state";
import {behaviourProfile, type ArkBehaviourProfile} from "@/ark-scene/behaviour-profile";
import {poseOnTrip, scheduleWorld, tripAt, type ArkDoing, type HoursAt, type ScheduleAnimal, type ScheduleWorld, type Trip, type TripPose} from "@/ark-scene/behaviour-schedule";
import {worldSampler} from "@/ark-scene/world-sampler";
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
/** The lighter view (A18): fewer near models, fewer models before icons. */
const LITE_CAPS = {near: 40, nearSpecies: 24, models: 80};
/**
 * Rigged animals (`rig-player.ts`): at most this many at once (and of this
 * many species: one draw call each), within this distance unless they are
 * the viewer's own, selected or followed. The lighter view has fewer; reduced
 * motion none.
 */
const RIG_CAPS_DRAWN = {animals: 24, species: 12};
const RIG_CAPS_DRAWN_LITE = {animals: 8, species: 4};
const RIG_WITHIN = 20;
/** Seconds a rig takes to fade in or out against the procedural motion. */
const RIG_BLEND_SECONDS = 0.5;
/** Rigs not drawn for this long are let go (keeping this many). */
const RIG_KEEP_SECONDS = 45;
const RIG_KEEP = 24;
const LOAD_NEAR_WITHIN = 48;
const FOV = 38;
const MAX_DISTANCE = 340;
const ENTRANCE_SECONDS = 1.6;
const RIPPLE_SECONDS = 2.6;
/** A clutch being laid, in a replay. */
const LAID_SECONDS = 2.6;
/** Close to an animal the camera looks more across the ground than down on it (radians from straight down). */
const CLOSE_POLAR = 1.13;
/** Seconds without a touch before the view starts to drift. */
const IDLE_DRIFT_AFTER = 9;
const OPENING_SECONDS = 4.6;
/** Within this distance (m) an animal glances at the camera now and then (more often the sharper it is). */
const GLANCE_WITHIN = 14;
/** Drawn smaller than this on screen (CSS px), an animal also gets a marker so it can be found. */
const MARKER_BELOW_PIXELS = 5;
/**
 * Small animals at their microhabitats (`micro.ts`): drawn true to size
 * (their body length L, no floor) close by, never smaller on screen than
 * this (CSS px) as the camera draws back, until that reaches their usual
 * drawn length (the floor) and the marker comes back: the floor and the
 * marker are only for a view from afar.
 */
const MICRO_MIN_PIXELS = 16;
/** Past this distance (m) a small animal's model is not drawn (its marker is), unless it is someone's own or selected. */
const MICRO_DRAW_WITHIN = 42;
/** Within this distance (m) of a small animal the camera may come right up to it. */
const MICRO_CLOSE_WITHIN = 3.5;
/** How close the camera may come to a small animal (m). */
const MICRO_MIN_DISTANCE = 0.08;

/** Birds that take to the air above their zone. */
const FLYERS = ARK_FLYERS;

/** The island's hour offset from UTC: everyone sees the same time of day (graphics pass; `src/lib/ark-clock.ts`). */
const ISLAND_OFFSET_HOURS = 0;

/** Per tier: shadow map size, grass tufts, pixel-ratio cap. */
const TIER_SETTINGS: Record<QualityTier, {shadows: number; grass: number; pixelRatio: number; /** The forest fill's share (graphics pass). */ fill: number}> = {
    high: {shadows: 2048, grass: 56000, pixelRatio: 2, fill: 1},
    medium: {shadows: 1024, grass: 22000, pixelRatio: 1.5, fill: 0.6},
    low: {shadows: 0, grass: 0, pixelRatio: 1, fill: 0.3}
};
const MAX_GRASS = TIER_SETTINGS.high.grass;

type Level = "near" | "far" | "token";

/** An animal on the behaviour schedule: its profile and home, its trip (and its leader's, for a group's follower), its pose now. */
type Sched = {
    animal: ScheduleAnimal;
    profile: ArkBehaviourProfile;
    trip: Trip | null;
    lead: Trip | null;
    pose: (TripPose & {doing: ArkDoing}) | null;
    at: number;
    /** The ground under its pose and its pitch to the slope, worked out with the pose (not every frame). */
    ground: number;
    pitch: number;
};

type Entry = {
    animal: ArkAnimal;
    place: Placement;
    /** Its drawn body length (m, head to tail): from its stored length or its size stat (`stats.ts`). */
    length: number;
    /** The species' stats: looks and behaviour only. */
    stats: ArkStats;
    /** At the size floor: drawn with a marker so it can be found. */
    floor: boolean;
    /** Its usual drawn length (m, the floor and the cap applied); `length` is what it is drawn at this frame. */
    full: number;
    /** Its body length (m), true to life: a small animal is drawn at it close by. */
    trueLength: number;
    /** A small animal at its microhabitat. */
    micro?: MicroSpecies | null;
    /** A moth: 0 resting on the wall, 1 circling the porch light (at night); eased. */
    toLight?: number;
    /** Its layer (`layers.ts`): the canopy, the ground, the underground, the reef, the open sea or the deep. */
    layer: SpeciesLayer;
    /** A water species' depth band (`sea-depth.ts`), and its seed for its swim up and down the band and its breaths; null on land. */
    depth: SpeciesDepth | null;
    seed: number;
    /** Underground and in its tunnel or chamber now (drawn only in the cutaway). */
    buried?: boolean;
    /** A cross-layer moment it is acting out (cosmetic): its kind, when it began, where from, its beats still to come. */
    moment?: {kind: ArkMomentKind; start: number; from: MomentFrom | null; beats: MomentBeat[]} | null;
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
    /**
     * What it is doing now (`behaviour-state.ts`): the one state its animation, where it is drawn,
     * the tap card and follow mode all read. Never changed by selecting or following it.
     */
    state: ArkBehaviourState;
    /** Awake (`state` not asleep); `rest` eases to 1 asleep. */
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
    /** Its rig (`rig-player.ts`): the clip playing and how far the rig has faded in; absent until first rigged. */
    rig?: RigState | null;
    /** Chosen for a rig this frame (within the caps). */
    rigOn?: boolean;
    /**
     * Its behaviour schedule (`behaviour-schedule.ts`): its profile, its home, the trip it is on and where that puts it
     * now. Null for animals the schedule doesn't move (small animals at their microhabitats, burrowers, the visitor).
     */
    sched?: Sched | null;
    /** Turned to look at a predator passing (visual only), eased. */
    glance?: number;
    /** A rigged animal on the ground walks about its spot now and then (`stepWander`). */
    wander?: Wander | null;
    /** A leaper in the air: how far across (0…1), else 0. */
    leapK?: number;
    /** An underground animal out of its burrow: how far through the peek (0…1), else -1. */
    peek?: number;
};

/**
 * A rigged animal's walk about its spot: from it, a few body lengths, and
 * back, at its walk clip's own ground speed so its feet stay planted. It
 * only sets off while its rig is fully in, and stops wherever it is when the
 * rig is to go (then it stands there, procedural, until it walks back).
 */
type Wander = {x: number; z: number; heading: number; walking: boolean; until: number; tx: number; tz: number; trips: number};

type SpeciesMeshes = {
    near: InstancedMesh | null;
    far: InstancedMesh | null;
    nearMaterial: MeshStandardMaterial | null;
    farMaterial: MeshStandardMaterial | null;
    /** The rigged near mesh (its own geometry and bone texture), while the species' rig is loaded. */
    rig?: InstancedMesh | null;
    rigMaterial?: MeshStandardMaterial | null;
};

/** A herd's members past its representatives (A14): standing where the server placed them, drawn cheaply. */
type HerdDraw = {
    info: ArkHerd;
    slug: string;
    /** A member, for its size and stats (all of a species are drawn the same size). */
    sample: ArkAnimal;
    members: Array<{id: string; x: number; z: number; ground: number; yaw: number; water: boolean; phase: number; mine: boolean; awake: boolean; activity: ArkAnimal["activity"]}>;
    centre: {x: number; z: number};
    radius: number;
    /** The member nearest the middle: the badge stands over it. */
    anchor: number;
    length: number;
    colour: Color | null;
    /** The figures' and specks' matrices, kept until the drawn scale changes. */
    scale: number;
    figureMatrices: Float32Array;
    speckMatrices: Float32Array;
    /** Members nearest the camera first, sorted now and then. */
    order: Uint32Array;
    sortedAt: number;
    sortedFrom: Vector3;
    /** Each member's middle this frame (for picking), NaN when not drawn. */
    middles: Float32Array;
    badge: HTMLButtonElement;
    /** This frame: how many as models, how many as specks, the drawn height. */
    figures: number;
    specks: number;
    height: number;
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

/** 0 → 1 → 0 across the two pauses of a crawl (its turn round), eased. */
function smoothTurn(u: number): number {
    const step = (a: number, b: number, x: number) => {
        const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
        return t * t * (3 - 2 * t);
    };
    return step(0.33, 0.48, u) * (1 - step(0.83, 0.98, u));
}

function phaseOf(id: string): number {
    let h = 2166136261;
    for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
    return ((h >>> 0) % 10000) / 10000;
}

/**
 * Letter-spacing for a label's text: the tracking asked for where the script
 * takes it (Latin, Cyrillic, Greek), none elsewhere, since spacing breaks
 * Devanagari's and Bengali's head-strokes, Thai's clusters and Arabic's joins.
 */
export function arkTracking(text: string, tracking: string): string {
    return /^[\p{Script=Latin}\p{Script=Cyrillic}\p{Script=Greek}\p{N}\p{P}\p{S}\p{Z}]*$/u.test(text) ? tracking : "normal";
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
    renderer.toneMappingExposure = 0.66;
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
    // The world takes the keyboard (A18): arrows move the view, + and − zoom, Esc closes the card.
    canvas.setAttribute("role", "application");
    if (options.canvasLabel) canvas.setAttribute("aria-label", options.canvasLabel);
    if (getComputedStyle(el).position === "static") el.style.position = "relative";
    el.appendChild(canvas);

    const labelLayer = document.createElement("div");
    labelLayer.setAttribute("aria-hidden", "true");
    Object.assign(labelLayer.style, {position: "absolute", inset: "0", pointerEvents: "none", overflow: "hidden"});
    el.appendChild(labelLayer);

    let reducedMotion = Boolean(options.reducedMotion);
    /** The lighter view (A18): the reader's choice, or (null) on whenever the device's tier is low. */
    let liteChoice: boolean | null = typeof options.lite === "boolean" ? options.lite : null;
    const autoTier = tier;
    const liteOn = () => liteChoice ?? tier === "low";
    const caps = () => (liteOn() ? LITE_CAPS : {near: NEAR_INSTANCE_CAP, nearSpecies: NEAR_SPECIES_CAP, models: MODEL_CAP});
    const scene = new Scene();
    // The hour: pinned by the page (development's `?hour=`), or the viewer's own clock.
    let pinnedHours = typeof options.hours === "number" && Number.isFinite(options.hours) ? options.hours : null;
    // Island time (graphics pass): the same hour for every viewer and the livestream, from the shared clock
    // (`src/lib/ark-clock.ts`), not the viewer's own clock. `hours` / `setHours` still pin it (golden shots, recordings).
    // The world's time (ms): the clock, or (development, `setClockScale`) the clock run faster for a day-night recording.
    let clockScale = 1;
    let clockAnchor = Date.now();
    let clockAnchorReal = clockAnchor;
    const worldMs = () => clockAnchor + (Date.now() - clockAnchorReal) * clockScale;
    const hoursNow = () => pinnedHours ?? islandHours(worldMs(), ISLAND_OFFSET_HOURS);
    // The weather and tide, from the same clock unless pinned (`setEnvironment`).
    let pinnedEnvironment: Partial<ArkEnvironment & {windDirection: number; cloud: number}> | null = null;
    let environmentAt = 0;
    const voyageStart = Date.parse(options.snapshot.voyage.started_at ?? "") || null;
    const applyEnvironment = (force = false) => {
        const nowMs = Date.now();
        if (!force && nowMs - environmentAt < 2000) return;
        environmentAt = nowMs;
        const weather = weatherAt(nowMs, {voyageStartMs: voyageStart, offsetHours: ISLAND_OFFSET_HOURS});
        const live = {seaLevel: seaLevelAt(nowMs, {mean: 0, springRange: 0.7}), wetness: weather.wetness, snow: weather.mountainSnowCover, wind: weather.wind, storm: weather.storm, windDirection: weather.windDirection, cloud: weather.cloud};
        const env = {...live, ...(pinnedEnvironment ?? {})};
        ARK_ENVIRONMENT.seaLevel.value = env.seaLevel;
        ARK_ENVIRONMENT.wetness.value = env.wetness;
        ARK_ENVIRONMENT.snow.value = env.snow;
        ARK_ENVIRONMENT.wind.value = env.wind;
        ARK_ENVIRONMENT.storm.value = env.storm;
        ARK_ENVIRONMENT.cloud.value = env.cloud;
        const strength = 0.45 + 1.4 * env.wind + 2 * env.storm;
        ARK_WIND_VECTOR.value.set(Math.cos(env.windDirection), Math.sin(env.windDirection)).multiplyScalar(strength * 0.95);
        WATER_WIND.value = 0.6 + 1.2 * env.wind + 1.6 * env.storm;
    };
    const lighting = new ArkLighting(renderer, scene, hoursNow());
    const fog = new Fog(lighting.horizon, 420, 1700);
    scene.fog = fog;
    const dust = new DustPuffs();
    scene.add(dust.points);
    // Clutches laid and hatching, in a replay (A9).
    const nests = new ArkNests();
    scene.add(nests.root);

    const landscape = buildLandscape();
    const graphicsBase = (options.graphicsBase ?? "/ark/graphics").replace(/\/+$/, "");
    void loadGroundTextures(graphicsBase);
    lighting.loadDaySky(`${graphicsBase}/sky-day.hdr`);
    scene.add(landscape.ground, landscape.water);
    const vegetation = buildVegetation(MAX_GRASS);
    // Close-up detail round what the camera looks at (graphics pass): pebbles, shells, litter, ferns, clover.
    const nearDetail = new NearDetail();
    scene.add(nearDetail.group);
    for (const mesh of vegetation.meshes) scene.add(mesh);
    scene.add(vegetation.grass);
    const motes = buildMotes(260);
    motes.points.visible = !reducedMotion;
    scene.add(motes.points);
    // The cottage at Home, its porch light and the garden pond (the small animals' microhabitats).
    const micro = buildMicroScene();
    scene.add(micro.group);
    micro.setNight(lighting.daylight.night);
    // The layers: burrows and the cutaway's pit and tunnels, the sea's plankton, glow and underwater light.
    const layersScene = buildLayersScene();
    scene.add(layersScene.group);
    renderer.localClippingEnabled = true;
    layersScene.clip([landscape.ground.material as MeshStandardMaterial, vegetation.grass.material as MeshStandardMaterial, ...vegetation.meshes.map((mesh) => mesh.material as MeshStandardMaterial)]);
    const PLANKTON = planktonClouds();
    // Scenery modules outside this file (`scene-modules.ts`: the props lane's nests, homes and area details), built below.
    let modules: ArkSceneModule[] = [];

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
    // The animal-look pass (`animal-look.ts`): surfaces, wet and dust, eyes, fur shells, close-up skins, contact shadows.
    const look = new AnimalLook({
        scene,
        renderer,
        closeUpBase: options.closeUpBase === undefined ? options.modelBase.replace(/\/ark\/?$/, "/ark-closeup") : options.closeUpBase,
        basisBase: options.basisBase ?? "/ark/basis/",
        enabled: options.animalLook !== false
    });
    shadows.setContact(look.on);
    const rings = new GroundRings();
    // A placeholder species (A13) has no icon art: the generic figure's.
    const tokens = new IconTokens((slug) => (isArkPlaceholderSlug(slug) ? ARK_PLACEHOLDER_ICON : options.iconUrl(slug)));
    const dots = new FindDots();
    const specks = new HerdSpecks();
    scene.add(shadows.mesh, rings.mesh, tokens.mesh, dots.mesh, specks.meshes["four-legged"].mesh, specks.meshes.oval.mesh);

    const post = new ArkPost(renderer, scene, camera, tier);
    const applyTier = (next: QualityTier) => {
        const liteBefore = liteOn();
        tier = next;
        const settings = TIER_SETTINGS[tier];
        lighting.setShadows(renderer, settings.shadows);
        vegetation.setShadows(settings.shadows > 0);
        micro.setShadows(settings.shadows > 0);
        shadows.setStrength(look.contactStrength(settings.shadows > 0));
        look.setTier(tier, liteOn());
        vegetation.setGrassCount(settings.grass);
        vegetation.setFill(settings.fill);
        nearDetail.setShare(tier === "high" ? 1 : tier === "medium" ? 0.6 : 0.35);
        species.forEach((meshes) => {
            for (const mesh of [meshes.near, meshes.far]) if (mesh) mesh.castShadow = settings.shadows > 0;
        });
        post.setTier(tier);
        ARK_GROUND_LITE.value = tier === "low" ? 1 : 0;
        for (const sceneModule of modules) {
            sceneModule.setTier(tier, liteOn());
            sceneModule.setShadows(settings.shadows > 0);
        }
        pixelRatio = Math.min(window.devicePixelRatio || 1, settings.pixelRatio);
        renderer.setPixelRatio(pixelRatio);
        motes.points.visible = !reducedMotion && !liteOn();
        resize();
        options.onTier?.(tier, liteOn());
        // The lighter view came on (or went off) with the tier: fewer of each herd drawn one by one.
        if (liteBefore !== liteOn() && herds.length) setSnapshot(current, false);
    };

    const library = new ModelLibrary(options.modelBase, 4);
    const species = new Map<string, SpeciesMeshes>();
    // The rigs: the manifest beside the model set (or the page's own), read once; nothing while motion is reduced.
    const rigBase = options.rigBase === undefined ? rigBaseFrom(options.modelBase) : options.rigBase;
    const rigs = new RigLibrary(rigBase, RIG_CAPS);
    rigs.onEvict = (slug) => {
        const meshes = species.get(slug);
        if (meshes?.rig) {
            scene.remove(meshes.rig);
            meshes.rig.dispose();
            meshes.rigMaterial?.dispose();
            meshes.rig = null;
            meshes.rigMaterial = null;
        }
        for (const entry of entries) if (entry.animal.model_slug === slug && entry.rig) entry.rig.weight = 0;
    };
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
    // Herds (A14): the snapshot as last given, every id aboard, and who must be drawn one by one.
    let current: ArkSnapshot = options.snapshot;
    let aboard = new Set<string>();
    let herds: HerdDraw[] = [];
    let selectedHerd: string | null = null;
    /** Pinned representatives: the one selected (a herd member promoted), and a replay's animals. */
    let selectionPin: string | null = null;
    let replayPins = new Set<string>();
    let placedFor: ArkSnapshot | null = null;
    let placedAll = new Map<string, Placement>();
    let disposed = false;
    let width = 1;
    let height = 1;
    let onScreen = true;
    const started = performance.now();
    /** The shared clock (seconds since 1970): the wall's, moving with the page's frames (the recorder's too). Breaths and depth cycles run on it. */
    const clockOrigin = Date.now() / 1000;
    const clockNow = () => clockOrigin + (performance.now() - started) / 1000;

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
            letterSpacing: arkTracking(text, "0.16em"),
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

    /** The hour's sun, which says who is asleep (from the species' activity only; none known: awake by day). */
    let sunElevation = lighting.daylight.elevation;
    /** A bird of the air over land: it flies while awake. */
    const fliesOver = (animal: ArkAnimal) => (FLYERS.has(animal.model_slug) && ZONE_SITES[animal.zone]?.kind !== "sea") || Boolean(heldOffWater(animal.model_slug));

    // MARK: The behaviour schedule (NPC-style, visual only)

    /** On unless the page turns it off: every animal's behaviour from the time and its id (`behaviour-schedule.ts`). */
    const scheduleOn = options.behaviour !== false;
    let world: ScheduleWorld | null = null;
    /** The places and the walk grid, from the graphics lane's scenery interface (built once, on the first animal). */
    let behaviourBuildMs = 0;
    const scheduleWorldNow = () => {
        if (!world) {
            const started = performance.now();
            world = scheduleWorld(worldSampler());
            behaviourBuildMs = performance.now() - started;
        }
        return world;
    };
    /** The schedule's main-thread time in recent frames (ms), and how many animals it moved. */
    const behaviourTimes: number[] = [];
    let behaviourFrameMs = 0;
    let scheduledCount = 0;
    const scheduleHours: HoursAt = (epoch) => pinnedHours ?? islandHours(epoch * 1000, ISLAND_OFFSET_HOURS);
    const GROUPED = new Set(["herd", "flock", "school", "troop", "pack", "group", "colony", "swarm"]);
    const makeSched = (animal: ArkAnimal, place: Placement, length: number): Sched | null => {
        if (!scheduleOn || place.micro || place.burrow) return null;
        const sea = ZONE_SITES[animal.zone]?.kind === "sea";
        return {
            animal: {id: animal.id, zone: animal.zone, home: {x: place.x, y: place.ground, z: place.z}, length, sea},
            profile: behaviourProfile(animal.model_slug, library.get(animal.model_slug)?.behaviour?.plan),
            trip: null,
            lead: null,
            pose: null,
            at: -1,
            ground: 0,
            pitch: 0
        };
    };
    /** Moved by its schedule now (not in an act or a moment, not with reduced motion). */
    const scheduled = (entry: Pick<Entry, "sched" | "visitor" | "act" | "moment">): boolean => Boolean(entry.sched) && !reducedMotion && !entry.visitor && !entry.act && !entry.moment;
    const tripFor = (holder: Sched, key: "trip" | "lead", profile: ArkBehaviourProfile, animal: ScheduleAnimal, activity: ArkAnimal["activity"], epoch: number): Trip => {
        let trip = holder[key];
        if (!trip || epoch < trip.start || epoch >= trip.end) holder[key] = trip = tripAt(scheduleWorldNow(), profile, animal, epoch, scheduleHours, activity, trip);
        return trip;
    };
    /**
     * Where its schedule puts it now. A follower in a herd, flock, school or troop keeps to its leader: the leader's
     * pose a moment earlier, out to one side by its rank, so the group moves (and sleeps) together and turns together.
     */
    const schedulePose = (entry: Entry, epoch: number): TripPose & {doing: ArkDoing} => {
        const own = entry.sched!;
        const scheduleWorld = scheduleWorldNow();
        const leader = entry.leader && entry.leader.sched && entry.leader.animal.model_slug === entry.animal.model_slug && GROUPED.has(own.profile.social) && !entry.leader.act ? entry.leader : null;
        if (leader) {
            const rank = entry.place.rank ?? 1;
            const lag = 0.4 + 0.3 * rank;
            const trip = tripFor(own, "lead", leader.sched!.profile, leader.sched!.animal, leader.animal.activity, epoch - lag);
            const at = poseOnTrip(scheduleWorld, trip, epoch - lag);
            const angle = at.yaw + Math.PI + (rank % 2 ? 1 : -1) * (0.5 + 0.25 * Math.floor(rank / 2));
            const d = (1 + 0.45 * Math.sqrt(rank)) * Math.max(entry.length, leader.length) * 1.1;
            const x = at.x + Math.sin(angle) * d;
            const z = at.z + Math.cos(angle) * d;
            const ground = heightAt(x, z);
            const inWater = at.y < Math.max(heightAt(at.x, at.z), 0) - 0.01;
            const y = at.aloft ? at.y + ((rank % 3) - 1) * 0.5 : inWater ? Math.max(at.y, ground + 0.2) : Math.max(ground, 0);
            return {...at, x, y, z, doing: trip.doing};
        }
        const trip = tripFor(own, "trip", own.profile, own.animal, entry.animal.activity, epoch);
        return {...poseOnTrip(scheduleWorld, trip, epoch), doing: trip.doing};
    };
    /** Its schedule's pose, worked out again now (every frame close by; twice a second far away: the same function, so nothing jumps). */
    const stepSchedule = (entry: Entry, epoch: number, dt: number) => {
        const own = entry.sched!;
        const watched = entry.animal.mine || selectedId === entry.animal.id || followId === entry.animal.id;
        if (!own.pose || entry.level !== "far" || watched || epoch - own.at > 0.5 || epoch < own.at) {
            const at = (own.pose = schedulePose(entry, epoch));
            own.at = epoch;
            own.ground = heightAt(at.x, at.z);
            const onLand = !at.aloft && own.ground > 0.02 && Math.abs(at.y - own.ground) < 0.05;
            // Close by, walkers lean to the slope; far away nobody can see it.
            own.pitch = onLand && entry.level !== "far" ? slopePitch(at.x, at.z, at.yaw, entry.length) : 0;
        }
        const target = own.pose.aloft ? 1 : 0;
        entry.air += (target - entry.air) * Math.min(dt * 6, 1);
        if (Math.abs(target - entry.air) < 0.002) entry.air = target;
    };

    /** Its one behaviour state now: its schedule (or the hour and its species), and whether it is acting out a server event. Never the selection. */
    const stateOf = (entry: Pick<Entry, "animal" | "visitor" | "act"> & Partial<Pick<Entry, "sched" | "moment">>): ArkBehaviourState => {
        // An air-breather in the water comes up for air on its breath cycle (a floater is at the surface already). (sea-depth)
        const depth = speciesDepth(entry.animal.model_slug, entry.animal.zone);
        const breather = depth?.breathes && waterMotion(depth) !== "float" ? {seed: depthSeed(entry.animal.id), clock: clockNow()} : null;
        // One the classifier holds off the water (a frigatebird) stays aloft, asleep or not: it never comes down onto the sea.
        const aloftAlways = Boolean(heldOffWater(entry.animal.model_slug));
        return behaviourState({
            activity: entry.animal.activity,
            elevation: sunElevation,
            flyer: fliesOver(entry.animal),
            acting: Boolean(entry.act),
            visitor: entry.visitor,
            reducedMotion,
            breather,
            aloftAlways,
            scheduled: entry.sched?.pose && scheduled({sched: entry.sched, visitor: entry.visitor, act: entry.act, moment: entry.moment}) ? {doing: entry.sched.pose.doing, aloft: entry.sched.pose.aloft} : null
        });
    };

    const newEntry = (animal: ArkAnimal, place: Placement, arrivedAt: number | null): Entry => {
        const phase = phaseOf(animal.id);
        const body = arkBody(animal, library.get(animal.model_slug)?.behaviour?.plan);
        // It starts as it is now: a sleeping hawk on its roost, an awake one in the air (no drop from the sky on load).
        const sched = makeSched(animal, place, body.display);
        if (sched && !reducedMotion) {
            const trip = (sched.trip = tripAt(scheduleWorldNow(), sched.profile, sched.animal, worldMs() / 1000, scheduleHours, animal.activity));
            sched.pose = {...poseOnTrip(scheduleWorldNow(), trip, worldMs() / 1000), doing: trip.doing};
            sched.at = worldMs() / 1000;
            sched.ground = heightAt(sched.pose.x, sched.pose.z);
        }
        const state = stateOf({animal, visitor: false, act: null, sched});
        const targets = sched?.pose ? {...animationTargets(state), air: sched.pose.aloft ? 1 : 0} : animationTargets(state);
        return {
            sched,
            animal,
            place,
            length: body.display,
            full: body.display,
            trueLength: body.metres,
            micro: place.micro ? microSpecies(animal.model_slug) : null,
            layer: speciesLayer(animal.model_slug),
            depth: place.micro ? null : speciesDepth(animal.model_slug, animal.zone),
            seed: depthSeed(animal.id),
            stats: arkStats(animal),
            floor: body.floor,
            pace: loopPace(animal),
            arrivedAt,
            level: "far",
            phase,
            middle: null,
            drawnHeight: 1,
            air: targets.air,
            lift: 0,
            state,
            awake: !state.asleep,
            rest: targets.rest,
            loop: phase * Math.PI * 2
        };
    };

    /** The selected animal's state as last told to the page (its tap card). */
    let toldState: ArkBehaviourState | null = null;
    const tellState = () => {
        const entry = selectedId ? findEntry(selectedId) : null;
        const state = entry ? entry.state : null;
        if (sameBehaviour(state, toldState)) return;
        toldState = state;
        if (entry && state) options.onBehaviour?.(entry.animal.id, state);
    };
    /** Each animal's state for the hour (and the act it is in): who is asleep, who is in the air. */
    const refreshState = (entry: Entry) => {
        entry.state = stateOf(entry);
        entry.awake = !entry.state.asleep;
        if (reducedMotion) {
            const targets = animationTargets(entry.state);
            entry.rest = targets.rest;
            entry.air = targets.air;
        }
    };
    const applyHours = () => {
        sunElevation = lighting.daylight.elevation;
        for (const entry of allEntries()) refreshState(entry);
        for (const herd of herds) for (const member of herd.members) member.awake = isAwake(member.activity ?? null, sunElevation);
        tellState();
    };

    /** The badge over a herd: its count, tappable (the population panel is the way in for the keyboard). */
    const herdBadge = (count: number) => options.herdBadge?.(count) ?? `\u00d7 ${count.toLocaleString()}`;
    const makeBadge = (key: string): HTMLButtonElement => {
        const badge = document.createElement("button");
        badge.type = "button";
        badge.tabIndex = -1;
        Object.assign(badge.style, {
            position: "absolute",
            left: "0",
            top: "0",
            whiteSpace: "nowrap",
            font: "700 12px/1 var(--font-sans, ui-sans-serif, system-ui, sans-serif)",
            letterSpacing: "0.02em",
            color: "rgba(255, 252, 244, 0.98)",
            padding: "6px 10px",
            borderRadius: "999px",
            background: "rgba(14, 20, 14, 0.66)",
            backdropFilter: "blur(8px)",
            border: "1px solid rgba(255, 255, 255, 0.2)",
            opacity: "0",
            pointerEvents: "none",
            cursor: "pointer",
            transition: "opacity 300ms ease, background-color 200ms ease",
            willChange: "transform"
        });
        badge.addEventListener("click", (event) => {
            event.stopPropagation();
            selectHerd(key, true);
        });
        // A touch on the badge is the badge's, not the world's.
        badge.addEventListener("pointerdown", (event) => event.stopPropagation());
        labelLayer.appendChild(badge);
        return badge;
    };

    /** The herds' members past their representatives, at their own places (A14). */
    const buildHerds = (snapshot: ArkSnapshot, found: Map<string, ArkHerd>, places: Map<string, Placement>) => {
        const byId = new Map(snapshot.animals.map((animal) => [animal.id, animal]));
        const before = new Map(herds.map((herd) => [herd.info.key, herd]));
        const next: HerdDraw[] = [];
        found.forEach((info) => {
            const animals = info.massed.map((id) => byId.get(id)).filter((animal): animal is ArkAnimal => Boolean(animal));
            if (!animals.length) return;
            const members = animals.map((animal) => {
                const place = places.get(animal.id)!;
                return {id: animal.id, x: place.x, z: place.z, ground: place.ground, yaw: place.yaw, water: place.water, phase: phaseOf(animal.id), mine: animal.mine, awake: true, activity: animal.activity ?? null};
            });
            const cx = members.reduce((sum, m) => sum + m.x, 0) / members.length;
            const cz = members.reduce((sum, m) => sum + m.z, 0) / members.length;
            let radius = 0;
            let anchor = 0;
            let nearest = Infinity;
            members.forEach((m, i) => {
                const d = Math.hypot(m.x - cx, m.z - cz);
                radius = Math.max(radius, d);
                if (d < nearest) {
                    nearest = d;
                    anchor = i;
                }
            });
            const old = before.get(info.key);
            before.delete(info.key);
            const sample = animals[0];
            const body = arkBody(sample, library.get(sample.model_slug)?.behaviour?.plan);
            next.push({
                info,
                slug: info.slug,
                sample,
                members,
                centre: {x: cx, z: cz},
                radius,
                anchor,
                length: body.display,
                colour: old?.colour ?? null,
                scale: 0,
                figureMatrices: new Float32Array(members.length * 16),
                speckMatrices: new Float32Array(members.length * 16),
                order: Uint32Array.from(members.map((_, i) => i)),
                sortedAt: 0,
                sortedFrom: new Vector3(Infinity, 0, 0),
                middles: new Float32Array(members.length * 3).fill(Number.NaN),
                badge: old?.badge ?? makeBadge(info.key),
                figures: 0,
                specks: 0,
                height: 1
            });
        });
        before.forEach((herd) => herd.badge.remove());
        herds = next;
        for (const herd of herds) herd.badge.textContent = herdBadge(herd.info.count);
        if (selectedHerd && !herds.some((herd) => herd.info.key === selectedHerd)) selectHerd(null, false);
    };

    /** Again from the snapshot as it is: after a pin changed (a herd member selected, a replay's animals). */
    const refreshLive = () => {
        if (herds.length || replayPins.size || selectionPin) setSnapshot(current, false);
    };

    const setSnapshot = (snapshot: ArkSnapshot, entrances: boolean) => {
        // The entrance's clock is the frame's (seconds since the scene started).
        const now = (performance.now() - started) / 1000;
        current = snapshot;
        aboard = new Set(snapshot.animals.map((animal) => animal.id));
        // Everyone's place (the herds' members too): from the server's slots, the same for every viewer.
        if (placedFor !== snapshot) {
            placedAll = placeAnimals(snapshot.animals);
            placedFor = snapshot;
        }
        const places = placedAll;
        // A very popular species (A14): its representatives drawn one by one, the rest as the herd.
        const pins = new Set<string>(replayPins);
        if (selectionPin) pins.add(selectionPin);
        if (followId) pins.add(followId);
        // (Development: `window.__arkHerdOff = true` before mounting draws everyone one by one, to measure against.)
        const herdOff = (globalThis as {__arkHerdOff?: boolean}).__arkHerdOff === true;
        const representatives = arkRepresentatives(snapshot.animals, {pinned: pins, live: liteOn() ? ARK_HERD_LIVE_LITE : ARK_HERD_LIVE, from: herdOff ? Number.POSITIVE_INFINITY : undefined});
        buildHerds(snapshot, representatives.herds, places);
        const next: Entry[] = [];
        const nextById = new Map<string, Entry>();
        for (const animal of snapshot.animals) {
            if (!representatives.live.has(animal.id)) continue;
            const place = places.get(animal.id)!;
            const before = entryById.get(animal.id);
            const body = before ? arkBody(animal, library.get(animal.model_slug)?.behaviour?.plan) : null;
            const entry: Entry = before && body
                ? Object.assign(before, {animal, place, length: body.display, full: body.display, trueLength: body.metres, micro: place.micro ? microSpecies(animal.model_slug) : null, layer: speciesLayer(animal.model_slug), depth: place.micro ? null : speciesDepth(animal.model_slug, animal.zone), floor: body.floor, stats: arkStats(animal), pace: loopPace(animal)})
                : newEntry(animal, place, entrances ? now : null);
            next.push(entry);
            nextById.set(animal.id, entry);
            tokens.ensure(animal.model_slug);
        }
        entries = next;
        entryById = nextById;
        // The underground's burrows and molehills, and the burrow mouths of the ground's diggers.
        const burrows = next.flatMap((entry) => (entry.place.burrow ? [entry.place.burrow] : []));
        const molehills = next.flatMap((entry) => {
            const burrow = entry.place.burrow;
            if (!burrow || !/mole/.test(entry.animal.model_slug)) return [];
            return [0, 1, 2].map((k) => {
                const at = tunnelPoint(burrow, 0.35 + k * 0.25);
                return {x: at.x + Math.cos(k * 2.1) * 0.5, z: at.z + Math.sin(k * 2.1) * 0.5};
            });
        });
        const mouths = next.filter((entry) => entry.layer.burrow && !entry.place.burrow && !entry.place.micro && !entry.place.canopy && !entry.place.water).map((entry) => {
            const side = entry.length * 0.55 + 0.25;
            return {x: entry.place.x + Math.cos(entry.place.yaw) * side, z: entry.place.z - Math.sin(entry.place.yaw) * side, size: Math.min(Math.max(entry.length * 0.35, 0.18), 0.6)};
        });
        layersScene.setBurrows(burrows, molehills, mouths);
        for (const sceneModule of modules) sceneModule.setSnapshot(snapshot);
        // A school or a flock keeps to its first one.
        for (const entry of next) entry.leader = entry.place.leader && entry.place.leader !== entry.animal.id ? nextById.get(entry.place.leader) ?? null : null;
        applyHours();
        if (followId && !entryById.has(followId)) endFollow();
        if (selectedId && !entryById.has(selectedId)) {
            selectedId = null;
            options.onSelect?.(null);
        }
        // Every species' far model, nearest first, so the whole Ark fills in from where the camera is.
        // (Small animals' models wait until the camera comes close: they are not drawn from afar. Herds' far models are.)
        const byDistance = Array.from(new Set([...next.filter((entry) => !entry.micro || entry.animal.mine).map((entry) => entry.animal.model_slug), ...herds.map((herd) => herd.slug)]));
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
            material = animalMaterial({
                map: source.map,
                behaviour: model.behaviour,
                minY: box.min.y,
                maxY: box.max.y,
                animated: level === "near" && !reducedMotion && !model.placeholder,
                level,
                look: model.placeholder ? null : speciesLook(model.slug, model.behaviour?.plan, model.facing, source.geometry)
            });
            if (level === "near" && !model.placeholder) look.track(model.slug, material);
            // The placeholder figure (A13): warm clay from its own vertex colours, a little softer.
            if (model.placeholder) {
                material.vertexColors = true;
                material.roughness = 0.9;
            }
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
        attachLook(source.geometry, capacity);
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
                entry.full = body.display;
                entry.trueLength = body.metres;
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
    const basisX = new Vector3();
    const basisY = new Vector3();
    const basisZ = new Vector3();
    const basisMatrix = new Matrix4();
    let counts = {near: 0, far: 0, token: 0, herdFigures: 0, herdSpecks: 0, rigged: 0};
    const DIM_SPECK = new Color("#cfc3ad");

    /** A herd this frame: how many members are drawn (nearest first), how many of them as models. */
    type HerdPlan = {slug: string; order: Uint32Array; members: HerdDraw["members"]; figureMatrices: Float32Array; speckMatrices: Float32Array; colour: Color | null; drawn: number; figures: number; width: number; depth: number; herd: HerdDraw; shape: SpeckShape};
    const herdSphere = new Sphere();
    const herdPosition = new Vector3();
    const herdRotation = new Quaternion();
    const herdScale = new Vector3();
    const herdMatrix = new Matrix4();
    const up = new Vector3(0, 1, 0);

    /**
     * Which of each herd's members are drawn this frame and how (A14): every
     * one in view; the nearest, up to the tier's budget and while bigger than
     * a few pixels, as the far model standing still; the rest as specks. The
     * matrices are worked out again only when the drawn scale changes.
     */
    const planHerds = (cameraPosition: Vector3, exaggerate: number, now: number): HerdPlan[] => {
        const plans: HerdPlan[] = [];
        if (!herds.length) return plans;
        const budgetTier: QualityTier = liteOn() ? "low" : tier;
        let budget: number = HERD_FIGURE_BUDGET[budgetTier];
        for (const herd of herds) {
            herd.middles.fill(Number.NaN);
            const model = library.get(herd.slug);
            const far = model?.far;
            if (!model || !far) continue;
            herdSphere.center.set(herd.centre.x, 0, herd.centre.z);
            herdSphere.radius = herd.radius + herd.length * 2 + 4;
            if (!frustum.intersectsSphere(herdSphere)) continue;
            const body = arkBody(herd.sample, model.behaviour?.plan);
            herd.length = body.display;
            const sizeUp = 1 + (exaggerate - 1) * Math.min(Math.max(1.6 / herd.length, 0.25), 1);
            const modelScale = herd.length / model.bodyLength;
            const s = modelScale * sizeUp;
            const tall = model.height * s;
            herd.height = tall;
            const box = far.geometry.boundingBox!;
            const width = (box.max.x - box.min.x) * s;
            const depth = model.length * s;
            const plan = model.behaviour?.plan ?? "";
            const swims = SWIMMING_PLANS.has(plan);
            // A water species' herd (a school): each in its band, under the surface (`sea-depth.ts`).
            const herdDepth = speciesDepth(herd.slug, herd.sample.zone);
            const shape: SpeckShape = !swims && (plan === "mammal" || plan === "reptile" || plan === "" || model.placeholder) ? "four-legged" : "oval";
            if (Math.abs(s - herd.scale) > herd.scale * 0.004) {
                herd.scale = s;
                herd.members.forEach((member, i) => {
                    // Standing (or floating, a swimmer at sea) still at its own place, as the server placed it.
                    let base = member.ground;
                    // One depth for the whole school (the herd's own seed), each spread on its own spot: level, side by side.
                    if (herdDepth) base = fitInWater(waterSpec(herdDepth, heightAt(member.x, member.z), depthSeed(herd.slug), 0, 0), tall).base;
                    else if (member.water && member.ground < -0.45) base = -(swims ? 0.5 : 0.28) * tall;
                    else if (member.water) base = Math.max(member.ground, -0.3);
                    herdRotation.setFromAxisAngle(up, member.yaw);
                    herdPosition.set(member.x, base - model.minY * s, member.z);
                    herdMatrix.compose(herdPosition, herdRotation, herdScale.set(s, s, s));
                    herdMatrix.toArray(herd.figureMatrices, i * 16);
                    // The speck: a generic figure the member's size (a four-legged one, or an oval on a bird or a swimmer's body).
                    if (shape === "oval") {
                        herdPosition.set(member.x, base + tall * 0.2, member.z);
                        herdMatrix.compose(herdPosition, herdRotation, herdScale.set(width * 0.7, tall * 0.6, depth * 0.85));
                    } else {
                        herdPosition.set(member.x, base, member.z);
                        herdMatrix.compose(herdPosition, herdRotation, herdScale.set(width * 0.9, tall * 0.95, depth * 0.95));
                    }
                    herdMatrix.toArray(herd.speckMatrices, i * 16);
                });
            }
            // Nearest first: sorted again when the camera has moved, or a while has passed.
            if (herd.sortedFrom.distanceToSquared(cameraPosition) > 4 || now - herd.sortedAt > 0.5) {
                herd.sortedFrom.copy(cameraPosition);
                herd.sortedAt = now;
                const d = new Float32Array(herd.members.length);
                herd.members.forEach((m, i) => {
                    d[i] = (m.x - cameraPosition.x) ** 2 + (m.z - cameraPosition.z) ** 2 + (Math.max(m.ground, 0) - cameraPosition.y) ** 2;
                });
                herd.order.sort((a, b) => d[a] - d[b]);
            }
            const perPixelAt = 2 * Math.tan(FOV * Math.PI / 360) / height;
            let figures = 0;
            for (let k = 0; k < herd.order.length; k++) {
                const m = herd.members[herd.order[k]];
                const distance = Math.hypot(m.x - cameraPosition.x, Math.max(m.ground, 0) - cameraPosition.y, m.z - cameraPosition.z);
                if (figures === k && budget > 0 && herd.length * sizeUp / (perPixelAt * distance) >= HERD_SPECK_BELOW_PIXELS) {
                    figures++;
                    budget--;
                }
                const i = herd.order[k];
                herd.middles[i * 3] = m.x;
                herd.middles[i * 3 + 1] = herd.figureMatrices[i * 16 + 13] + tall * 0.5 + model.minY * s;
                herd.middles[i * 3 + 2] = m.z;
            }
            herd.figures = figures;
            herd.specks = herd.members.length - figures;
            plans.push({slug: herd.slug, order: herd.order, members: herd.members, figureMatrices: herd.figureMatrices, speckMatrices: herd.speckMatrices, colour: herd.colour, drawn: herd.members.length, figures, width, depth, herd, shape});
        }
        return plans;
    };

    /** Where an animal is this moment: its spot, or its loop in the water, or its circle in the sky. */
    type Pose = {
        x: number; z: number; base: number; yaw: number; pitch: number; roll: number; afloat: boolean; surface?: SurfacePoint;
        /** In the water: where in its column, fitted again to the height it is drawn at. */
        water?: WaterSpec;
        /** A school's member: its first one's point, which its offset is scaled about at the size it is drawn (so a school drawn larger from afar spreads with it). */
        school?: {x: number; z: number};
    };

    /**
     * A small animal on its surface: it crawls slowly to and fro along it (its
     * rig's walk or climb close by, a glide otherwise), turning
     * round in the pauses; asleep it keeps still. A moth at the cottage
     * circles the porch light at night, while it is awake.
     */
    const microPose = (entry: Entry, time: number): Pose => {
        const place = entry.place;
        const micro = place.micro!;
        const surface = micro.surface;
        const L = entry.trueLength;
        const reach = surface === "around" || surface === "roof" ? 0 : surface === "water" ? 0.2 : surface === "flower" ? Math.min(0.02, 2 * L) : Math.min(Math.max(5 * L, 0.03), 0.35);
        const period = 11 + 9 * entry.phase;
        const u = (((time / period + entry.phase) % 1) + 1) % 1;
        // Out (0–0.32), a pause, back (0.5–0.82), a pause; the turn round in each pause.
        const out = u < 0.32 ? easeInOut(u / 0.32) : u < 0.5 ? 1 : u < 0.82 ? 1 - easeInOut((u - 0.5) / 0.32) : 0;
        const awake = 1 - entry.rest;
        const along = reducedMotion ? 0 : reach * out * awake;
        const point = surfacePoint(micro, entry.animal.zone, along);
        const turn = reducedMotion || !reach ? 0 : Math.PI * smoothTurn(u) * awake;
        if (turn) {
            // Turn the heading about the normal: t cos + (n × t) sin.
            const c = Math.cos(turn);
            const sn = Math.sin(turn);
            const bx = point.ny * point.tz - point.nz * point.ty;
            const by = point.nz * point.tx - point.nx * point.tz;
            const bz = point.nx * point.ty - point.ny * point.tx;
            point.tx = point.tx * c + bx * sn;
            point.ty = point.ty * c + by * sn;
            point.tz = point.tz * c + bz * sn;
        }
        const k = entry.toLight ?? 0;
        if (k > 0.001) {
            // Round the porch light: a loose, wobbling loop, each moth its own.
            const radius = 0.16 + entry.phase * 0.32;
            const angle = time * (1.6 + entry.phase * 1.4) * (entry.phase > 0.5 ? 1 : -1) + entry.phase * 40;
            const light = nightLight(micro, entry.animal.zone);
            // Round a lamp post's lamp all the way; round the porch light in front of the wall.
            const flat = micro.spot === "lamp" ? 1 : 0.7;
            const lx = light.x + light.out.x + Math.cos(angle) * radius;
            const lz = light.z + light.out.z + Math.sin(angle) * radius * flat;
            const ly = light.y - 0.05 + Math.sin(time * 3.1 + entry.phase * 17) * 0.09;
            const e = easeInOut(k);
            const direction = entry.phase > 0.5 ? 1 : -1;
            const tx = -Math.sin(angle) * direction;
            const tz = Math.cos(angle) * direction * 0.7;
            const length = Math.hypot(tx, tz) || 1;
            // The wall's normal swings round to up as it takes off.
            const nx = point.nx * (1 - e);
            const ny = point.ny * (1 - e) + e;
            const nz = point.nz * (1 - e);
            const nl = Math.hypot(nx, ny, nz) || 1;
            const surfaceNow: SurfacePoint = {
                x: point.x + (lx - point.x) * e,
                y: point.y + (ly - point.y) * e,
                z: point.z + (lz - point.z) * e,
                nx: nx / nl,
                ny: ny / nl,
                nz: nz / nl,
                tx: point.tx * (1 - e) + (tx / length) * e,
                ty: point.ty * (1 - e),
                tz: point.tz * (1 - e) + (tz / length) * e
            };
            return {x: surfaceNow.x, z: surfaceNow.z, base: surfaceNow.y, yaw: Math.atan2(surfaceNow.tx, surfaceNow.tz), pitch: 0, roll: 0, afloat: true, surface: surfaceNow};
        }
        return {x: point.x, z: point.z, base: point.y, yaw: Math.atan2(point.tx, point.tz), pitch: 0, roll: 0, afloat: true, surface: point};
    };
    const nearestCloud = (x: number, z: number) => PLANKTON.reduce((best, cloud) => (Math.hypot(cloud.x - x, cloud.z - z) < Math.hypot(best.x - x, best.z - z) ? cloud : best), PLANKTON[0]);

    /**
     * A canopy animal on its tree: a percher sits still on its limb or the
     * crown; a climber crawls to and fro along its limb or up and down the
     * trunk; a leaper leaps to the next limb now and then and back; a hanger
     * hangs under its limb, swaying a little. Close by, a rig that has them
     * climbs, leaps, hangs and perches with its own clips (`rigFor`).
     */
    const canopyPose = (entry: Entry, time: number): Pose => {
        const place = entry.place.canopy!;
        const zone = entry.animal.zone;
        const awake = 1 - entry.rest;
        const period = 13 + 9 * entry.phase;
        const u = (((time / period + entry.phase) % 1) + 1) % 1;
        const reach = place.mode === "climb" ? (place.limb === -2 ? 0.7 : 0.45) : 0;
        const out = u < 0.32 ? easeInOut(u / 0.32) : u < 0.5 ? 1 : u < 0.82 ? 1 - easeInOut((u - 0.5) / 0.32) : 0;
        const point = canopyPoint(zone, place, reach * out * awake);
        if (reach && !reducedMotion) {
            const turn = Math.PI * smoothTurn(u) * awake;
            const c = Math.cos(turn);
            const sn = Math.sin(turn);
            const bx = point.ny * point.tz - point.nz * point.ty;
            const by = point.nz * point.tx - point.nx * point.tz;
            const bz = point.nx * point.ty - point.ny * point.tx;
            point.tx = point.tx * c + bx * sn;
            point.ty = point.ty * c + by * sn;
            point.tz = point.tz * c + bz * sn;
        }
        if (place.mode === "hang" && !reducedMotion) {
            // A slow sway about the limb.
            const sway = Math.sin(time * 0.55 + entry.phase * 11) * 0.14;
            const c = Math.cos(sway);
            const sn = Math.sin(sway);
            const bx = point.ty * point.nz - point.tz * point.ny;
            const by = point.tz * point.nx - point.tx * point.nz;
            const bz = point.tx * point.ny - point.ty * point.nx;
            point.nx = point.nx * c + bx * sn;
            point.ny = point.ny * c + by * sn;
            point.nz = point.nz * c + bz * sn;
        }
        entry.leapK = 0;
        if (place.mode === "leap" && awake > 0.5 && !reducedMotion) {
            // Over to the next limb (0.42–0.5 of its cycle), a while there, and back (0.92–1).
            const other = canopyPoint(zone, leapTarget(place), 0);
            const there = u >= 0.5 && u < 0.92;
            const k = u >= 0.42 && u < 0.5 ? easeInOut((u - 0.42) / 0.08) : u >= 0.92 ? 1 - easeInOut((u - 0.92) / 0.08) : there ? 1 : 0;
            if (k > 0) {
                const flying = k < 1;
                entry.leapK = flying ? k : 0;
                // A rig's leap carries its own rise: the path's arc gives way to it.
                const rigLeap = entry.rig && entry.rig.now.name === "leap" ? entry.rig.weight : 0;
                const arc = flying ? Math.sin(Math.PI * k) * 0.9 * (1 - rigLeap) : 0;
                const x = point.x + (other.x - point.x) * k;
                const y = point.y + (other.y - point.y) * k + arc;
                const z = point.z + (other.z - point.z) * k;
                const dx = (other.x - point.x) * (u >= 0.92 ? -1 : 1);
                const dz = (other.z - point.z) * (u >= 0.92 ? -1 : 1);
                const length = Math.hypot(dx, dz) || 1;
                const at = flying ? {x, y, z, nx: 0, ny: 1, nz: 0, tx: dx / length, ty: 0, tz: dz / length} : {...other};
                return {x: at.x, z: at.z, base: at.y, yaw: Math.atan2(at.tx, at.tz), pitch: 0, roll: 0, afloat: true, surface: at};
            }
        }
        return {x: point.x, z: point.z, base: point.y, yaw: Math.atan2(point.tx, point.tz), pitch: 0, roll: 0, afloat: true, surface: point};
    };

    /**
     * An underground animal: in its chamber most of the time (seen only in
     * the cutaway), now and then along its tunnel to the entrance, where it
     * peeks out for a few seconds, and back. Asleep it stays in its chamber.
     */
    const undergroundPose = (entry: Entry, modelHeight: number, time: number): Pose => {
        const burrow = entry.place.burrow!;
        const period = 26 + 14 * entry.phase;
        const u = entry.awake && !reducedMotion ? (((time / period + entry.phase) % 1) + 1) % 1 : 0;
        // Along the tunnel: 1 in the chamber, 0 at the entrance.
        const t = u < 0.45 ? 1 : u < 0.55 ? 1 - easeInOut((u - 0.45) / 0.1) : u < 0.75 ? 0 : u < 0.85 ? easeInOut((u - 0.75) / 0.1) : 1;
        const peeking = u >= 0.55 && u < 0.75;
        entry.peek = peeking ? (u - 0.55) / 0.2 : -1;
        const at = tunnelPoint(burrow, Math.max(t, 0.02));
        const ahead = tunnelPoint(burrow, Math.min(Math.max(t, 0.02) + 0.05, 1));
        const outward = u >= 0.45 && u < 0.75;
        const yaw = Math.atan2((ahead.x - at.x) * (outward ? -1 : 1), (ahead.z - at.z) * (outward ? -1 : 1));
        entry.buried = !peeking;
        if (peeking && entry.rig && entry.rig.weight > 0 && rigs.clip(entry.animal.model_slug, "emerge") && rigs.clip(entry.animal.model_slug, "burrow")) {
            // Its rig's emerge and burrow carry it up out of the ground and back down: at the mouth, at ground level.
            return {x: burrow.x, z: burrow.z, base: burrow.ground, yaw, pitch: 0, roll: 0, afloat: true};
        }
        if (peeking) {
            // Head and shoulders out of the mouth, looking about.
            const rise = Math.sin(Math.PI * Math.min((u - 0.55) / 0.2, 1));
            return {x: burrow.x, z: burrow.z, base: burrow.ground - modelHeight * (0.75 - 0.5 * rise), yaw: yaw + Math.sin(time * 1.3) * 0.5 * rise, pitch: -0.5 * rise, roll: 0, afloat: true};
        }
        return {x: at.x, z: at.z, base: at.y - modelHeight * 0.45, yaw, pitch: 0, roll: 0, afloat: true};
    };

    /** Splashes on the water (a moment's beats), as rings that spread and fade. */
    const ripples: Array<{x: number; z: number; start: number}> = [];

    /** A cross-layer moment's pose (cosmetic), or null once it is over. */
    const momentAt = (entry: Entry, model: SpeciesModel | undefined, modelHeight: number, time: number): Pose | null => {
        const moment = entry.moment!;
        const u = (time - moment.start) / MOMENT_SECONDS[moment.kind];
        if (u >= 1 || u < 0) {
            entry.moment = null;
            return null;
        }
        if (!moment.from) {
            // Where it is as the moment begins.
            entry.moment = null;
            const start = pose(entry, model, modelHeight, time);
            entry.moment = moment;
            moment.from = {x: start.x, y: start.base, z: start.z, yaw: start.yaw};
            moment.beats = momentBeats(moment.kind, moment.from, entry.length);
        }
        const at = momentPose(moment.kind, moment.from, u, entry.length);
        const due = moment.beats.filter((beat) => beat.at <= u);
        if (due.length) {
            moment.beats = moment.beats.filter((beat) => beat.at > u);
            const now = performance.now() / 1000;
            for (const beat of due) {
                for (let k = 0; k < (beat.kind === "blow" ? 7 : 4); k++) {
                    dust.add({x: beat.x + (k % 2 ? 1 : -1) * k * 0.08, y: beat.y + (beat.kind === "blow" ? k * 0.4 : 0.05), z: beat.z, size: beat.kind === "blow" ? 0.8 + k * 0.25 : 0.6, kind: "bubble"}, now);
                }
                ripples.push({x: beat.x, z: beat.z, start: time});
            }
        }
        return {x: at.x, z: at.z, base: at.y, yaw: at.yaw, pitch: at.pitch, roll: at.roll, afloat: at.afloat};
    };

    /**
     * Close to the camera (visual only, from what is drawn): animals on the ground don't stand inside each other (each
     * is pushed half the overlap apart), and prey turns its head to a predator passing within a few metres. Nothing
     * here changes a schedule; it only nudges what is drawn this frame.
     */
    const keepApart = (list: Array<{entry: Entry; distance: number; visible: boolean; pose: Pose}>, dt: number) => {
        const near = list.filter((c) => c.visible && c.entry.sched && scheduled(c.entry) && c.distance < 45 && !c.entry.sched.pose?.aloft).sort((a, b) => a.distance - b.distance).slice(0, 80);
        for (let i = 0; i < near.length; i++) {
            const a = near[i];
            const pa = a.entry.sched!.profile;
            let look: number | null = null;
            for (let j = 0; j < near.length; j++) {
                if (i === j) continue;
                const b = near[j];
                const dx = b.pose.x - a.pose.x;
                const dz = b.pose.z - a.pose.z;
                const d = Math.hypot(dx, dz);
                const room = (a.entry.length + b.entry.length) * 0.42;
                if (j > i && d < room && d > 1e-4) {
                    const push = (room - d) / 2;
                    for (const [c, sign] of [[a, -1], [b, 1]] as const) {
                        const onGround = Math.abs(c.pose.base - Math.max(heightAt(c.pose.x, c.pose.z), 0)) < 0.05;
                        c.pose.x += (dx / d) * push * sign;
                        c.pose.z += (dz / d) * push * sign;
                        if (onGround) c.pose.base = Math.max(heightAt(c.pose.x, c.pose.z), 0);
                    }
                }
                // A predator (a meat or fish eater bigger than it) moving within 6 m: it looks.
                const pb = b.entry.sched!.profile;
                const hunter = (pb.diet === "meat" || pb.diet === "fish") && (pb.size ?? 0) > (pa.size ?? 0) && b.entry.sched!.pose?.moving;
                if (hunter && pa.diet !== "meat" && d < 6 && !a.entry.sched!.pose?.moving && a.entry.awake) look = Math.atan2(dx, dz) - a.pose.yaw;
            }
            while (look !== null && look > Math.PI) look -= Math.PI * 2;
            while (look !== null && look < -Math.PI) look += Math.PI * 2;
            const want = look === null ? 0 : Math.max(Math.min(look, 1.2), -1.2);
            a.entry.glance = (a.entry.glance ?? 0) + (want - (a.entry.glance ?? 0)) * Math.min(dt * 3, 1);
        }
    };

    /** Nose down going downhill, up going uphill: the ground's slope along its heading over its length (so its feet meet the slope). */
    const slopePitch = (x: number, z: number, yaw: number, length: number) => {
        const half = Math.max(length * 0.4, 0.05);
        const front = Math.max(heightAt(x + Math.sin(yaw) * half, z + Math.cos(yaw) * half), 0);
        const back = Math.max(heightAt(x - Math.sin(yaw) * half, z - Math.cos(yaw) * half), 0);
        return Math.max(Math.min(Math.atan2(back - front, half * 2), 0.45), -0.45);
    };

    /** Its schedule's pose as the scene draws it: banked into the turn when circling, the head a little down asleep. */
    const fromSchedule = (entry: Entry): Pose => {
        const own = entry.sched!;
        const at = own.pose!;
        const ground = own.ground;
        const circling = at.aloft && (at.doing === "fly" || at.doing === "soar");
        const glance = entry.glance ?? 0;
        return {
            x: at.x,
            z: at.z,
            base: at.y,
            yaw: at.yaw + glance,
            pitch: at.aloft ? 0.95 * entry.air : 0.05 * entry.rest + own.pitch,
            roll: circling ? -0.35 * entry.air : 0,
            afloat: at.aloft || at.y < Math.max(ground, 0) - 0.01 || ground < 0
        };
    };

    /**
     * A water species' pose: a loop about its spot (a swimmer's wide, a crab's and a duck's small, none for an
     * octopus in its hole; a school keeps to its first one, a plankton feeder loops round its cloud), at its
     * band's depth from the shared clock and its seed, rising to the surface while its state is breathing.
     */
    const waterPose = (entry: Entry, depth: SpeciesDepth, modelHeight: number, time: number): Pose => {
        const place = entry.place;
        const motion = waterMotion(depth);
        const clock = reducedMotion ? 0 : clockNow();
        const breath = entry.state.breathing && !reducedMotion ? breathAt(entry.seed, clock, entry.state.asleep) : 0;
        if (motion === "hole") {
            // In its hole: still, its head turning slowly.
            const spec = waterSpec(depth, place.ground, entry.seed, clock, breath);
            const yaw = place.yaw + (reducedMotion ? 0 : Math.sin(time * 0.2 + entry.phase * 9) * 0.5 * (1 - entry.rest));
            return {x: place.x, z: place.z, base: fitInWater(spec, modelHeight).base, yaw, pitch: 0, roll: 0, afloat: true, water: spec};
        }
        const lead = entry.leader && entry.leader !== entry && !entry.leader.act && entry.leader.depth ? entry.leader : null;
        const follower = lead ? Math.max(entry.place.rank ?? 1, 1) : 0;
        const owner = lead ?? entry;
        const direction = owner.phase > 0.5 ? 1 : -1;
        // The first one's loop (a plankton feeder's round its cloud); the others keep beside it.
        const cloud = owner.layer.mode === "filter" && motion === "swim" && ZONE_SITES[owner.animal.zone]?.kind === "sea" ? nearestCloud(owner.place.x, owner.place.z) : null;
        const centre = cloud ?? owner.place;
        let radius = cloud ? cloud.radius * 0.7 + owner.phase * 2 : waterLoopRadius(motion, owner.phase, owner.length);
        // The loop stays over its water (the lake's open water; off the beach and the reef's shallows).
        radius = safeLoopRadius(centre.x, centre.z, radius);
        const angle = owner.loop;
        const lx = centre.x + Math.cos(angle) * radius;
        const lz = centre.z + Math.sin(angle) * radius;
        // Level, nose along the loop (model heads face +z): forward (sin yaw, cos yaw), right (cos yaw, -sin yaw).
        const yaw = Math.atan2(-Math.sin(angle) * direction, Math.cos(angle) * direction);
        let x = lx;
        let z = lz;
        if (follower) {
            // Beside its first one, side by side; in file behind it where the water beside is too shallow.
            const at = schoolOffset(follower, owner.seed, owner.length);
            let px = lx + Math.cos(yaw) * at.side - Math.sin(yaw) * at.back;
            let pz = lz - Math.sin(yaw) * at.side - Math.cos(yaw) * at.back;
            if (heightAt(px, pz) > -0.6) {
                // In file instead: back along the loop itself, so it stays over the loop's water.
                const back = schoolFile(follower, owner.seed, owner.length).back / Math.max(radius, 0.5);
                px = centre.x + Math.cos(angle - direction * back) * radius;
                pz = centre.z + Math.sin(angle - direction * back) * radius;
            }
            x = px;
            z = pz;
        }
        const floorY = heightAt(x, z);
        // The school swims at its first one's depth in the band (its own breath apart).
        const spec = waterSpec(depth, floorY, owner.seed, clock, breath);
        const along = reducedMotion ? 0 : (0.05 + owner.phase * 0.05) * owner.pace * radius * (1 - 0.85 * owner.rest);
        const pitch = reducedMotion ? 0 : swimPitch(depth, -floorY, owner.seed, clock, along);
        return {x, z, base: fitInWater(spec, modelHeight).base, yaw, pitch, roll: 0, afloat: true, water: spec, school: follower ? {x: lx, z: lz} : undefined};
    };

    const pose = (entry: Entry, model: SpeciesModel | undefined, modelHeight: number, time: number): Pose => {
        // An act's pose, from a replayed event.
        if (entry.act) {
            const act = entry.act;
            return {x: act.x, z: act.z, base: act.base, yaw: act.yaw, pitch: act.pitch, roll: act.roll, afloat: act.base < -0.02 || act.base > Math.max(heightAt(act.x, act.z), 0) + 0.3};
        }
        const place = entry.place;
        if (entry.moment) {
            const at = momentAt(entry, model, modelHeight, time);
            if (at) return at;
        }
        if (scheduled(entry) && entry.sched!.pose) return fromSchedule(entry);
        if (place.micro && !entry.visitor) return microPose(entry, reducedMotion ? 0 : time);
        // (A bird of the air flies from its perch, and comes back to it to rest.)
        if (place.canopy && !entry.visitor && entry.air <= 0.001) return canopyPose(entry, reducedMotion ? 0 : time);
        if (place.burrow && !entry.visitor) return undergroundPose(entry, modelHeight, reducedMotion ? 0 : time);
        const plan = model?.behaviour?.plan ?? "";
        // A water species (`sea-depth.ts`): in its depth band, its whole body under the surface (a floater on it, a
        // bottom-dweller on the floor, an octopus in its hole), an air-breather up for air when its state says so.
        if (entry.depth && !entry.visitor && entry.air <= 0.001) return waterPose(entry, entry.depth, modelHeight, time);
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
        const wander = entry.wander;
        if (wander && (wander.x || wander.z) && !place.water) {
            // Walked off its spot (its rig's walk): on the ground where it is now.
            const x = place.x + wander.x;
            const z = place.z + wander.z;
            return {x, z, base: Math.max(heightAt(x, z), 0), yaw: wander.heading, pitch: 0.05 * entry.rest, roll: 0, afloat: false};
        }
        // Asleep: a little lower at the front, as the head goes down.
        return {x: place.x, z: place.z, base, yaw: wander ? wander.heading : place.yaw, pitch: 0.05 * entry.rest, roll: 0, afloat: base < Math.max(place.ground, 0) - 0.01 || place.ground < 0};
    };

    // MARK: Rigs

    /** On its own feet on land: where a rigged animal may walk about its spot. */
    const onFoot = (entry: Entry) =>
        !scheduled(entry) &&
        !entry.visitor && !entry.place.micro && !entry.place.canopy && !entry.place.burrow && !entry.place.water && ZONE_SITES[entry.animal.zone]?.kind !== "sea" && entry.air <= 0.001 && !entry.act && !entry.moment;
    /** A number in [0, 1) for this animal and this count (the same every visit). */
    const wanderRandom = (entry: Entry, n: number) => {
        const x = Math.sin(entry.phase * 12.9898 * 1000 + n * 78.233) * 43758.5453;
        return x - Math.floor(x);
    };
    const groundClip = (slug: string): RigClipData | null => rigs.clip(slug, "walk") ?? rigs.clip(slug, "slither") ?? rigs.clip(slug, "hop");

    /**
     * A rigged animal on land walks about its spot now and then: out a few
     * body lengths onto open ground, a while there, and back. Only while its
     * rig is fully in (so its feet move with it, at its walk's own ground
     * speed); it stops where it is when the rig is to go, or it falls asleep,
     * or it is looked at.
     */
    const stepWander = (entry: Entry, modelScale: number, dt: number, now: number) => {
        if (!onFoot(entry) || reducedMotion) {
            if (entry.wander) entry.wander.walking = false;
            return;
        }
        const clip = groundClip(entry.animal.model_slug);
        if (!clip?.ground_speed) {
            if (entry.wander) entry.wander.walking = false;
            return;
        }
        const place = entry.place;
        const wander = (entry.wander ??= {x: 0, z: 0, heading: place.yaw, walking: false, until: now + 3 + entry.phase * 6, tx: 0, tz: 0, trips: 0});
        // Only awake (its one behaviour state); being looked at or followed changes nothing.
        const free = Boolean(entry.rigOn) && (entry.rig?.weight ?? 0) >= 0.999 && entry.state.kind === "awake";
        if (!free) {
            wander.walking = false;
            wander.until = Math.max(wander.until, now + 2);
            return;
        }
        if (wander.walking) {
            const dx = wander.tx - wander.x;
            const dz = wander.tz - wander.z;
            const left = Math.hypot(dx, dz);
            let turn = Math.atan2(dx, dz) - wander.heading;
            while (turn > Math.PI) turn -= Math.PI * 2;
            while (turn < -Math.PI) turn += Math.PI * 2;
            const most = 1.6 * dt;
            wander.heading += Math.min(Math.max(turn, -most), most);
            // Slowly while it turns towards where it is going; at its walk's own speed once it faces it.
            const speed = clip.ground_speed! * modelScale * (Math.abs(turn) > 0.6 ? 0.3 : 1);
            const step = Math.min(speed * dt, left);
            if (left <= Math.max(step * 1.5, 0.004) || left < 0.12 * entry.length) {
                wander.walking = false;
                wander.until = now + 5 + 10 * wanderRandom(entry, wander.trips + 0.25);
                return;
            }
            wander.x += Math.sin(wander.heading) * step;
            wander.z += Math.cos(wander.heading) * step;
            return;
        }
        if (now < wander.until) return;
        wander.trips++;
        let tx = 0;
        let tz = 0;
        if (Math.hypot(wander.x, wander.z) < 0.2 * entry.length) {
            // Out onto open ground: dry land about as high as its spot.
            const angle = wanderRandom(entry, wander.trips) * Math.PI * 2;
            const reach = Math.min(Math.max(entry.length * (1.5 + 2.5 * wanderRandom(entry, wander.trips + 0.5)), 0.35), 6);
            tx = Math.sin(angle) * reach;
            tz = Math.cos(angle) * reach;
            const level = Math.max(place.ground, 0);
            for (const f of [0.35, 0.7, 1]) {
                const h = heightAt(place.x + tx * f, place.z + tz * f);
                if (h < 0.05 || Math.abs(h - level) > Math.max(0.8, entry.length)) {
                    wander.until = now + 4;
                    return;
                }
            }
        }
        wander.tx = tx;
        wander.tz = tz;
        wander.walking = true;
    };

    const rigHere = new Vector3();
    const rigLift = new Vector3();
    /**
     * An animal's rig this frame, when it has one ready and is close enough:
     * fades it in or out (never in the middle of a peek out of its burrow),
     * picks the clip for what the scene is doing with it, and moves the clip
     * on — by the distance it moved for walking, running, climbing, slithering,
     * hopping and swimming (so the feet stay planted whatever the pace), with
     * the path for a leap or a burrow's emerge, by time otherwise. Null: draw
     * it procedural. The clip follows the animal's one behaviour state
     * (`behaviour-state.ts`): asleep, its idle (slowed); flying, no rig at all
     * (flight clips are held: the shader glide); awake, what the scene is doing
     * with it.
     */
    const rigFor = (entry: Entry, model: SpeciesModel, where: Pose, modelScale: number, dt: number): RigModel | null => {
        const slug = entry.animal.model_slug;
        const rig = rigs.get(slug);
        const turned = (d: number) => ((Math.round(d) % 360) + 360) % 360;
        if (!rig || model.placeholder || turned(rig.facingDeg) !== turned(model.facing)) {
            if (entry.rig) entry.rig.weight = 0;
            return null;
        }
        const state = (entry.rig ??= newRigState());
        // Reduced motion: no rigs (the scene's clock stands still, so nothing would fade): straight back to the near model.
        if (reducedMotion) {
            state.weight = 0;
            state.last = null;
            return null;
        }
        const target = entry.rigOn && !entry.state.airborne && entry.air <= 0.001 && !entry.visitor ? 1 : 0;
        const peeking = (entry.peek ?? -1) >= 0;
        if (!peeking) state.weight = Math.min(Math.max(state.weight + Math.min(Math.max(target - state.weight, -dt / RIG_BLEND_SECONDS), dt / RIG_BLEND_SECONDS), 0), 1);
        rigHere.set(where.x, where.base, where.z);
        let moved = state.last ? rigHere.distanceTo(state.last) / Math.max(modelScale, 1e-6) : 0;
        // A jump (a new spot, an act's cut): no stride for it.
        if (moved > 3) moved = 0;
        state.last = (state.last ?? new Vector3()).copy(rigHere);
        if (state.weight <= 0) return null;
        const speed = dt > 0 ? moved / dt : 0;
        const clip = (name: string) => rigs.clip(slug, name);
        const moving = (move: RigClipData | null): move is RigClipData => Boolean(move?.ground_speed) && speed > move!.ground_speed! * (state.now.name === move!.name ? 0.12 : 0.3);
        let want: string | null = null;
        let mode: "distance" | "time" | "sync" = "time";
        let sync = 0;
        const place = entry.place;
        const up = where.surface ? where.surface.ny : 1;
        if (entry.state.asleep && !entry.act) {
            // Asleep: its idle, slow (and the head lowered by the material's droop); never a walk.
        } else if (place.canopy && !entry.visitor) {
            const kind = place.canopy.mode;
            const move = (up < 0.6 ? clip("climb") : null) ?? clip("walk") ?? clip("climb");
            if (kind === "hang" && clip("hang")) want = "hang";
            else if (kind === "leap" && (entry.leapK ?? 0) > 0 && clip("leap")) {
                want = "leap";
                mode = "sync";
                sync = entry.leapK!;
            } else if (kind === "perch" && clip("perch")) want = "perch";
            else if (moving(move)) {
                want = move.name;
                mode = "distance";
            }
        } else if (place.micro && !entry.visitor) {
            const move = (up < 0.6 ? clip("climb") : null) ?? clip("walk") ?? clip("climb") ?? clip("slither") ?? clip("hop");
            if (moving(move)) {
                want = move.name;
                mode = "distance";
            }
        } else if (place.burrow && !entry.visitor) {
            const peek = entry.peek ?? -1;
            if (peek >= 0 && clip("emerge") && clip("burrow")) {
                if (peek < 0.35) {
                    want = "emerge";
                    mode = "sync";
                    sync = peek / 0.35;
                } else if (peek > 0.65) {
                    want = "burrow";
                    mode = "sync";
                    sync = (peek - 0.65) / 0.35;
                }
            } else {
                const move = clip("walk");
                if (moving(move)) {
                    want = move.name;
                    mode = "distance";
                }
            }
        } else if (ZONE_SITES[entry.animal.zone]?.kind === "sea" && SWIMMING_PLANS.has(model.behaviour?.plan ?? "")) {
            const swim = clip("swim");
            if (swim) {
                want = "swim";
                mode = swim.ground_speed ? "distance" : "time";
            }
        } else {
            const walk = groundClip(slug);
            const run = clip("run");
            if (run && walk?.ground_speed && speed > walk.ground_speed * 1.6) {
                want = "run";
                mode = "distance";
            } else if (moving(walk)) {
                want = walk.name;
                mode = "distance";
            } else if (!walk && moving(run)) {
                want = "run";
                mode = "distance";
            }
        }
        if (!want && clip("idle")) want = "idle";
        if (!want) {
            // Nothing for standing still (an idle that did not pass): its moving clip held at its first frame.
            const any = Object.values(rig.clips)[0];
            if (!any) return null;
            want = any.name;
            mode = "sync";
            sync = 0;
        }
        rigSwitch(state, want, mode === "sync" ? sync : 0);
        const playing = rig.clips[want];
        if (!playing) return null;
        if (mode === "distance") state.now.phase += Math.min(cyclesFor(playing, moved), (dt / playing.seconds) * 2.5);
        else if (mode === "sync") state.now.phase = sync;
        else state.now.phase += (dt / playing.seconds) * (want === "idle" ? 1 - 0.65 * entry.rest : 1);
        if (state.from) {
            state.fade += dt / RIG_FADE_SECONDS;
            const from = rig.clips[state.from.name];
            if (from && from.loop) state.from.phase += dt / from.seconds;
            if (state.fade >= 1 || !from) state.from = null;
        }
        rig.usedAt = lastUpdate;
        return rig;
    };

    /** The rigged near mesh of a species (its own geometry, the near level's skin, its bone texture). */
    const instancedRigFor = (model: SpeciesModel, rig: RigModel, needed: number): InstancedMesh | null => {
        const meshes = speciesMeshes(model.slug);
        let mesh = meshes.rig ?? null;
        if (mesh && mesh.instanceMatrix.count >= needed) return mesh;
        const capacity = Math.max(needed, 4, mesh ? mesh.instanceMatrix.count * 2 : 0);
        let material = meshes.rigMaterial ?? null;
        if (!material) {
            const box = (model.near ?? model.far)?.geometry.boundingBox ?? rig.geometry.boundingBox!;
            material = animalMaterial({
                map: model.near?.map ?? model.far?.map ?? null,
                behaviour: model.behaviour,
                minY: box.min.y,
                maxY: box.max.y,
                animated: true,
                rig: rig.texture,
                level: "near",
                look: speciesLook(model.slug, model.behaviour?.plan, model.facing, model.near?.geometry ?? rig.geometry)
            });
            look.track(model.slug, material);
            meshes.rigMaterial = material;
        }
        if (mesh) {
            scene.remove(mesh);
            mesh.dispose();
        }
        mesh = new InstancedMesh(rig.geometry, material, capacity);
        mesh.instanceMatrix.setUsage(DynamicDrawUsage);
        for (const [name, size] of [["arkInstance", 3], ["arkRigA", 4], ["arkRigB", 4]] as const) {
            const attribute = new InstancedBufferAttribute(new Float32Array(capacity * size), size);
            attribute.setUsage(DynamicDrawUsage);
            rig.geometry.setAttribute(name, attribute);
        }
        attachLook(rig.geometry, capacity);
        mesh.frustumCulled = false;
        mesh.castShadow = TIER_SETTINGS[tier].shadows > 0;
        mesh.receiveShadow = true;
        mesh.count = 0;
        scene.add(mesh);
        meshes.rig = mesh;
        return mesh;
    };
    /** A species' fur-shell material (`fur-shells.ts`): its near or rigged material's, pushed out in layers. */
    const shellMaterial = (source: InstancedMesh): MeshStandardMaterial | null => {
        const base = source.material as MeshStandardMaterial;
        const made = (base.userData as {arkOptions?: Parameters<typeof animalMaterial>[0]; arkSlug?: string});
        if (!made.arkOptions || !made.arkSlug) return null;
        const material = animalMaterial({...made.arkOptions, shell: true, shellLength: 0.012});
        look.track(made.arkSlug, material);
        return material;
    };
    rigs.onLoad = (slug) => {
        const rig = rigs.get(slug);
        if (rig) rig.usedAt = lastUpdate;
    };
    let lastEvict = 0;

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

        type Candidate = {entry: Entry; distance: number; model: SpeciesModel | undefined; visible: boolean; pose: Pose; modelHeight: number; modelScale: number; skip: boolean; rig: RigModel | null};
        const epochNow = worldMs() / 1000;
        behaviourFrameMs = 0;
        scheduledCount = 0;
        const night = lighting.daylight.night;
        const candidates: Candidate[] = [];
        for (const entry of allEntries()) {
            const slug = entry.animal.model_slug;
            const model = library.get(slug);
            if (entry.held || entry.act?.hidden) {
                entry.middle = null;
                continue;
            }
            // Its schedule first (where it is and what it is doing now), then its one state from that.
            if (scheduled(entry)) {
                const started = performance.now();
                stepSchedule(entry, epochNow, dt);
                behaviourFrameMs += performance.now() - started;
                scheduledCount++;
            }
            // Its one state (its schedule, or the hour and its species, an act it is in) sets what it does: asleep eases in,
            // a flyer takes to the air or comes down to its roost. Selecting or following it never changes this.
            refreshState(entry);
            const targets = animationTargets(entry.state);
            if (!reducedMotion) entry.rest += (targets.rest - entry.rest) * Math.min(dt * 1.5, 1);
            // Loops (a swimmer's, a flyer's) slow almost to a stop asleep.
            const plan = model?.behaviour?.plan ?? "";
            const pace = 1 - 0.85 * entry.rest;
            // Its speed sets the pace: a tuna laps the reef, a turtle drifts.
            if (entry.depth) entry.loop += dt * (0.05 + entry.phase * 0.05) * (entry.phase > 0.5 ? 1 : -1) * pace * entry.pace * waterPace(waterMotion(entry.depth));
            else if (entry.air > 0.001) entry.loop += dt * (0.16 + entry.phase * 0.08) * pace * entry.pace;
            // A flyer comes down to its roost to sleep and takes to the air again awake (an act flies its own path).
            if (fliesOver(entry.animal) && !entry.act && !scheduled(entry)) entry.air += (targets.air - entry.air) * 0.02;
            entry.lift += ((selectedId === entry.animal.id ? 1 : 0) - entry.lift) * 0.08;
            let skip = false;
            if (entry.micro && !entry.act) {
                // A moth at the cottage goes to the porch light at night while it is awake (looked at or not).
                if (entry.micro.moth && (entry.place.micro?.spot === "house" || entry.place.micro?.spot === "lamp")) {
                    const want = entry.awake && night > 0.35 && !reducedMotion ? 1 : 0;
                    entry.toLight = (entry.toLight ?? 0) + (want - (entry.toLight ?? 0)) * Math.min(dt * 0.5, 1);
                }
                // True to size close by; never smaller on screen than MICRO_MIN_PIXELS; the usual length (and the marker) from afar.
                const near = cameraPosition.distanceTo(position.set(entry.place.x, entry.place.ground, entry.place.z));
                entry.length = microDrawnLength(entry.trueLength, entry.full, near, height, FOV, MICRO_MIN_PIXELS);
                const own = entry.animal.mine || selectedId === entry.animal.id || followId === entry.animal.id;
                skip = near > MICRO_DRAW_WITHIN && !own;
                if (!skip && library.has(slug) && !model) library.request(slug, "far");
            }
            const modelScale = model ? entry.length / model.bodyLength : 1;
            const modelHeight = model ? model.height * modelScale : entry.length * 0.6;
            if (model && entry.rig) stepWander(entry, modelScale, dt, now);
            const where = pose(entry, model, modelHeight, now);
            // Only the layer the camera is in is drawn in full: under the sea nothing of the land; above it not the deep;
            // the underground only in the cutaway (or peeking out of its burrow).
            const own = entry.animal.mine || selectedId === entry.animal.id || followId === entry.animal.id;
            const atSea = ZONE_SITES[entry.animal.zone]?.kind === "sea" || entry.depth?.water === "salt";
            // The deep's are hidden from above while they are down there (an air-breather of the deep shows when it comes up).
            const down = entry.depth ? entry.depth.band === "deep" && where.base < -2.5 : entry.layer.layer === "deep";
            if (!own && !entry.moment && ((underwater && !atSea) || (!underwater && down) || (entry.place.burrow && entry.buried && !cutawayOpen))) {
                entry.middle = null;
                continue;
            }
            // (In the water at its own depth: a seabed animal is culled and loaded by where it is, not the surface over it.)
            position.set(where.x, where.water ? where.base : Math.max(where.base, 0), where.z);
            const distance = cameraPosition.distanceTo(position);
            if (distance < LOAD_NEAR_WITHIN && library.has(slug)) library.request(slug, "near");
            sphere.center.copy(position);
            sphere.radius = entry.length * 2 + 3;
            candidates.push({entry, distance, model, visible: frustum.intersectsSphere(sphere), pose: where, modelHeight, modelScale, skip, rig: null});
        }

        // The page's tap card says what the selected animal is doing now, from the same state.
        tellState();
        if (scheduleOn && !reducedMotion) {
            const started = performance.now();
            keepApart(candidates, dt);
            behaviourFrameMs += performance.now() - started;
        }
        behaviourTimes.push(behaviourFrameMs);
        if (behaviourTimes.length > 120) behaviourTimes.shift();
        const nearWanted = candidates
            .filter((c) => c.visible && !c.skip && c.model?.near && c.distance < NEAR_DISTANCE + (c.entry.level === "near" ? HYSTERESIS : 0))
            .sort((a, b) => a.distance - b.distance);
        const nearIds = new Set<string>();
        const nearSpecies = new Set<string>();
        const cap = caps();
        for (const candidate of nearWanted) {
            if (nearIds.size >= cap.near) break;
            const slug = candidate.entry.animal.model_slug;
            if (!nearSpecies.has(slug) && nearSpecies.size >= cap.nearSpecies) continue;
            nearSpecies.add(slug);
            nearIds.add(candidate.entry.animal.id);
        }
        // Models for the nearest MODEL_CAP in view; past that, icons.
        const modelled = new Set(candidates.filter((c) => c.visible && !c.skip && c.model?.far).sort((a, b) => a.distance - b.distance).slice(0, cap.models).map((c) => c.entry.animal.id));

        // Rigs: the viewer's own, the one looked at or followed, then the nearest, within the caps (none with reduced motion).
        rigs.caps = liteOn() ? RIG_CAPS_LITE : RIG_CAPS;
        const rigCap = reducedMotion ? null : liteOn() ? RIG_CAPS_DRAWN_LITE : RIG_CAPS_DRAWN;
        const rigPriority = (entry: Entry) => (entry.animal.id === selectedId || entry.animal.id === followId ? 0 : entry.animal.mine ? 1 : 2);
        const rigWanted = rigCap
            ? candidates
                  .filter((c) => c.visible && !c.skip && c.model && nearIds.has(c.entry.animal.id) && !c.entry.visitor && c.entry.air <= 0.001 && (c.distance < RIG_WITHIN || rigPriority(c.entry) < 2) && rigs.available(c.entry.animal.model_slug))
                  .sort((a, b) => rigPriority(a.entry) - rigPriority(b.entry) || a.distance - b.distance)
            : [];
        const rigSpecies = new Set<string>();
        let rigCount = 0;
        for (const candidate of candidates) candidate.entry.rigOn = false;
        for (const candidate of rigWanted) {
            if (!rigCap || rigCount >= rigCap.animals) break;
            const slug = candidate.entry.animal.model_slug;
            if (!rigSpecies.has(slug) && rigSpecies.size >= rigCap.species) continue;
            rigSpecies.add(slug);
            rigCount++;
            candidate.entry.rigOn = true;
            rigs.request(slug);
        }
        let rigged = 0;
        for (const candidate of candidates) {
            const {entry, model} = candidate;
            if (!model || !nearIds.has(entry.animal.id) || !candidate.visible || candidate.skip) {
                if (entry.rig) {
                    entry.rig.weight = 0;
                    entry.rig.last = null;
                }
                continue;
            }
            candidate.rig = rigFor(entry, model, candidate.pose, candidate.modelScale, dt);
            if (candidate.rig) rigged++;
        }

        const perMesh = new Map<InstancedMesh, number>();
        const used = new Set<InstancedMesh>();
        const tokenList: TokenInstance[] = [];
        const shadowList: Shadow[] = [];
        const ringList: Ring[] = [];
        const dotList: FindDot[] = [];
        counts = {near: 0, far: 0, token: 0, herdFigures: 0, herdSpecks: 0, rigged: 0};

        look.begin(ARK_ENVIRONMENT.wetness.value);
        const needs = new Map<string, {near: number; far: number; rig: number}>();
        for (const candidate of candidates) {
            const {entry} = candidate;
            const level: Level = nearIds.has(entry.animal.id) ? "near" : modelled.has(entry.animal.id) ? "far" : "token";
            entry.level = level;
            if (!candidate.visible || level === "token" || candidate.skip) continue;
            const need = needs.get(entry.animal.model_slug) ?? {near: 0, far: 0, rig: 0};
            if (level === "near" && candidate.rig) need.rig++;
            else need[level]++;
            needs.set(entry.animal.model_slug, need);
        }
        // The herds' members (A14): how many as the far model this frame, the rest as specks.
        const herdPlans = planHerds(cameraPosition, exaggerate, now);
        for (const herd of herdPlans) {
            if (!herd.figures) continue;
            const need = needs.get(herd.slug) ?? {near: 0, far: 0, rig: 0};
            need.far += herd.figures;
            needs.set(herd.slug, need);
        }
        needs.forEach((need, slug) => {
            const model = library.get(slug)!;
            if (need.near) instancedFor(model, "near", need.near);
            if (need.far) instancedFor(model, "far", need.far);
            const rig = need.rig ? rigs.get(slug) : undefined;
            if (rig) instancedRigFor(model, rig, need.rig);
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
            // In the water: fitted again at the height it is drawn at (from afar it is drawn larger), so its back never breaks the surface.
            if (where.water) {
                // A school drawn larger from afar spreads with it (never touching), and its depth is fitted again.
                if (where.school && sizeUp !== 1) {
                    where.x = where.school.x + (where.x - where.school.x) * sizeUp;
                    where.z = where.school.z + (where.z - where.school.z) * sizeUp;
                    where.water = {...where.water, floorY: heightAt(where.x, where.z)};
                }
                where.base = fitInWater(where.water, modelHeight).base;
            }
            if (!candidate.visible) {
                entry.middle = null;
                continue;
            }
            entry.yawNow = where.yaw;
            const lift = where.water ? 0 : entry.lift * modelHeight * 0.12;
            // Near and awake: now and then it looks round, startles, shakes, bobs or dozes (the talking models' idles, as root motion).
            if (level === "near" && entry.awake && !entry.act && !entry.visitor && !entry.micro && model && !reducedMotion) {
                // The sharper it is, the more different things it does (`arkIdleBehaviour`).
                entry.director ??= new BehaviourDirector(arkIdleBehaviour(model.behaviour, entry.stats.intelligence), IDLE_ABILITIES, BehaviourRandom.seed(animal.id));
                const idle = entry.director.pose(now, false);
                where.yaw += idle.yaw * (where.water ? 0.4 : 1);
                // In the water it swims level: no idle pitch, roll or lift (its depth is its band's).
                if (!where.water) {
                    where.pitch += idle.pitch;
                    where.roll += idle.roll;
                    where.base += idle.lift * candidate.modelScale;
                }
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
            const surface = where.surface;
            if (surface) entry.middle = (entry.middle ?? new Vector3()).set(where.x + surface.nx * modelHeight / 2, where.base + surface.ny * modelHeight / 2, where.z + surface.nz * modelHeight / 2);
            else entry.middle = (entry.middle ?? new Vector3()).set(where.x, where.base + lift + modelHeight / 2, where.z);
            const rest = Math.max(entry.place.ground, 0);
            const marked = selectedId === animal.id ? 2 : mineOnly && animal.mine ? 1 : 0;
            // Too small to find on its own (at the size floor, or a few pixels across from far): a soft dot over it, and its icon once tapped.
            // A small animal at its microhabitat only from afar: close by it is drawn true to size, and found by looking.
            const fromAfar = !entry.micro || entry.length >= entry.full * 0.999;
            if ((level !== "token" || candidate.skip) && !entry.act && fromAfar) {
                const perPixel = 2 * Math.tan(FOV * Math.PI / 360) * candidate.distance / height;
                const pixels = entry.length * sizeUp / perPixel;
                if (entry.floor || pixels < MARKER_BELOW_PIXELS || candidate.skip) {
                    const top = where.base + lift + modelHeight + Math.max(perPixel * 7, 0.08);
                    dotList.push({x: where.x, y: Math.max(top, rest + 0.1), z: where.z, pixels: marked === 2 ? 11 : 8, alpha: dim ? 0.35 : 1});
                    if (marked === 2 && tokens.loaded(animal.model_slug)) tokenList.push({slug: animal.model_slug, x: where.x, y: Math.max(top, rest + 0.1) + perPixel * 20, z: where.z, size: 0.5, dim: 0, ring: 2, grow});
                }
            }

            // A small animal far off: its marker only.
            if (candidate.skip) continue;
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

            const rig = level === "near" ? candidate.rig : null;
            const meshes = species.get(animal.model_slug);
            const mesh = (level === "near" ? (rig ? meshes?.rig : meshes?.near) : meshes?.far) ?? null;
            if (!mesh || !model) continue;
            const index = perMesh.get(mesh) ?? 0;
            perMesh.set(mesh, index + 1);
            used.add(mesh);
            if (level === "near") counts.near++;
            else counts.far++;
            const act = entry.act;
            const s = candidate.modelScale * sizeUp * grow * (act ? Math.max(act.scale, 0.001) : 1);
            if (surface) {
                // On its surface: its back to the surface's normal, heading the way it crawls; its underside on the surface.
                basisY.set(surface.nx, surface.ny, surface.nz).normalize();
                basisZ.set(surface.tx, surface.ty, surface.tz);
                basisZ.addScaledVector(basisY, -basisZ.dot(basisY)).normalize();
                basisX.crossVectors(basisY, basisZ);
                rotation.setFromRotationMatrix(basisMatrix.makeBasis(basisX, basisY, basisZ));
                const up = -model.minY * s + (1 - Math.min(grow, 1)) * -modelHeight * 0.3;
                position.set(where.x + surface.nx * up, where.base + surface.ny * up, where.z + surface.nz * up);
            } else {
                euler.set(where.pitch, where.yaw, where.roll);
                rotation.setFromEuler(euler);
                position.set(where.x, where.base + lift - model.minY * s - (1 - Math.min(grow, 1)) * modelHeight * 0.3, where.z);
            }
            const state = rig ? entry.rig : null;
            if (rig && state) {
                // A leap's clip carries the body forward itself: take that off the path's own motion.
                const leap = state.now.name === "leap" ? rig.clips.leap : undefined;
                if (leap) {
                    rootOffset(rig, leap, state.now.phase, rigLift).multiplyScalar(s * state.weight).applyQuaternion(rotation);
                    position.x -= rigLift.x;
                    position.z -= rigLift.z;
                }
                const clipNow = rig.clips[state.now.name];
                const [a0, a1, at] = clipNow ? clipRows(clipNow, state.now.phase) : [0, 0, 0];
                (mesh.geometry.getAttribute("arkRigA") as InstancedBufferAttribute).setXYZW(index, a0, a1, at, clipNow ? state.weight : 0);
                const clipFrom = state.from ? rig.clips[state.from.name] : undefined;
                if (clipFrom && state.from) {
                    const [b0, b1, bt] = clipRows(clipFrom, state.from.phase);
                    (mesh.geometry.getAttribute("arkRigB") as InstancedBufferAttribute).setXYZW(index, b0, b1, bt, 1 - easeInOut(Math.min(state.fade, 1)));
                } else {
                    (mesh.geometry.getAttribute("arkRigB") as InstancedBufferAttribute).setXYZW(index, 0, 0, 0, 0);
                }
            }
            matrix.compose(position, rotation, scale.set(s, s, s));
            mesh.setMatrixAt(index, matrix);
            (mesh.geometry.getAttribute("arkInstance") as InstancedBufferAttribute).setXYZ(index, entry.phase, act ? act.dim : dim, entry.rest);
            // The animal-look pass: wet (rain, a swim, in the water) and dust per animal; the near ones offered fur shells and their close-up skin.
            const sea = ARK_ENVIRONMENT.seaLevel.value;
            look.instance(mesh, index, {
                id: animal.id,
                slug: animal.model_slug,
                x: where.x,
                y: where.base,
                z: where.z,
                distance: candidate.distance,
                pixels: (entry.length * sizeUp * height) / (2 * Math.tan((FOV * Math.PI) / 360) * Math.max(candidate.distance, 0.01)),
                inWater: where.afloat && !surface && where.base < sea + 0.1 && entry.place.ground < sea,
                onSurface: Boolean(surface)
            }, level === "near");

            if (!where.afloat || (look.on && surface && !entry.toLight)) {
                const box = (level === "near" ? model.near : model.far)!.geometry.boundingBox!;
                const width = (box.max.x - box.min.x) * candidate.modelScale * sizeUp * 1.15;
                const length = model.length * candidate.modelScale * sizeUp * 1.0;
                if (surface) {
                    // On a wall, a leaf, a flower or a stone: its own size, on that surface where it touches it.
                    shadowList.push({x: where.x, y: where.base, z: where.z, width: width * 1.1, length: length * 1.05, yaw: where.yaw, strength: grow, nx: surface.nx, ny: surface.ny, nz: surface.nz});
                } else {
                    // On the ground: on its slope (near ones, with the pass on), a little under the body's middle.
                    const normal = look.on && level === "near" ? look.groundNormal(where.x, where.z) : null;
                    shadowList.push({
                        x: where.x,
                        y: rest,
                        z: where.z,
                        width: Math.max(width, look.on && level === "near" ? 0.05 : 0.4),
                        length: Math.max(length, look.on && level === "near" ? 0.05 : 0),
                        yaw: where.yaw,
                        strength: grow * (1 - entry.lift * 0.3),
                        ...(normal ? {nx: normal.x, ny: normal.y, nz: normal.z} : {})
                    });
                }
            }
            if (marked && !entry.micro) {
                ringList.push({x: where.x, y: where.afloat ? 0 : rest, z: where.z, radius: Math.max(entry.length * sizeUp * 0.8, 0.7), color: marked === 2 ? SELECTED : MINE, alpha: 1});
            } else if (marked && surface && surface.ny > 0.8 && !entry.toLight) {
                // A small one on level ground (the litter, a flower, the pond): a ring its own size.
                ringList.push({x: where.x, y: where.base + 0.004, z: where.z, radius: Math.max(entry.length * 1.3, 0.025), color: marked === 2 ? SELECTED : MINE, alpha: 1});
            }
        }

        // The herds' figures after their species' representatives, in the same far mesh (one draw call); the specks in one mesh for all.
        specks.begin();
        for (const herd of herdPlans) {
            const model = library.get(herd.slug);
            const mesh = species.get(herd.slug)?.far ?? null;
            const instance = mesh ? mesh.geometry.getAttribute("arkInstance") as InstancedBufferAttribute : null;
            const target = mesh ? mesh.instanceMatrix.array as Float32Array : null;
            let index = mesh ? perMesh.get(mesh) ?? 0 : 0;
            const colour = herd.herd.colour ?? (herd.herd.colour = model?.far ? textureColour(model.far.map, model.placeholder ? "#b9a789" : "#8f7f66") : null);
            for (let k = 0; k < herd.drawn; k++) {
                const i = herd.order[k];
                const member = herd.members[i];
                const dim = mineOnly && !member.mine ? 1 : 0;
                if (k < herd.figures && mesh && target && instance && model) {
                    const at = index * 16;
                    for (let j = 0; j < 16; j++) target[at + j] = herd.figureMatrices[i * 16 + j];
                    instance.setXYZ(index, member.phase, dim, member.awake ? 0 : 1);
                    look.figure(mesh, index);
                    index++;
                    counts.herdFigures++;
                    if (!member.water && shadowList.length < 900) shadowList.push({x: member.x, y: Math.max(member.ground, 0), z: member.z, width: Math.max(herd.width, 0.3), length: herd.depth, yaw: member.yaw, strength: 1});
                } else if (colour) {
                    specks.push(herd.shape, herd.speckMatrices, i * 16, dim ? DIM_SPECK : colour);
                    counts.herdSpecks++;
                }
            }
            if (mesh && index > (perMesh.get(mesh) ?? 0)) {
                perMesh.set(mesh, index);
                used.add(mesh);
            }
        }
        specks.end();

        species.forEach((meshes) => {
            for (const mesh of [meshes.near, meshes.far, meshes.rig ?? null]) {
                if (!mesh) continue;
                const count = used.has(mesh) ? perMesh.get(mesh) ?? 0 : 0;
                mesh.count = count;
                mesh.visible = count > 0;
                if (count) {
                    mesh.instanceMatrix.needsUpdate = true;
                    (mesh.geometry.getAttribute("arkInstance") as InstancedBufferAttribute).needsUpdate = true;
                    AnimalLook.touch(mesh);
                    if (mesh === meshes.rig) {
                        (mesh.geometry.getAttribute("arkRigA") as InstancedBufferAttribute).needsUpdate = true;
                        (mesh.geometry.getAttribute("arkRigB") as InstancedBufferAttribute).needsUpdate = true;
                    }
                }
            }
        });
        counts.rigged = rigged;
        look.end(now, shellMaterial);
        if (now - lastEvict > 5) {
            lastEvict = now;
            rigs.evict(now - RIG_KEEP_SECONDS, RIG_KEEP);
        }
        // The splashes of the moments.
        for (let i = ripples.length - 1; i >= 0; i--) {
            const age = now - ripples[i].start;
            if (age > 2.4 || age < 0) {
                ripples.splice(i, 1);
                continue;
            }
            ringList.push({x: ripples[i].x, y: 0.03, z: ripples[i].z, radius: 0.4 + age * 1.7, color: ARRIVAL, alpha: 0.9 * (1 - age / 2.4) ** 1.5});
        }
        // The animals that glow, at night: a soft glow on each.
        const glowing: Array<{x: number; y: number; z: number; strength: number}> = [];
        if (night > 0.3) {
            for (const entry of allEntries()) {
                if (!entry.layer.glow || !entry.middle) continue;
                glowing.push({x: entry.middle.x, y: entry.middle.y, z: entry.middle.z, strength: Math.min((night - 0.3) / 0.4, 1) * (0.75 + 0.25 * Math.sin(now * 1.7 + entry.phase * 20))});
            }
        }
        layersScene.setGlow(glowing);
        tokens.set(tokenList, camera);
        dots.set(dotList);
        shadows.set(shadowList);
        rings.set(ringList);
    };

    // MARK: Camera

    /** A flight eases the target, the distance, and (when given) the angle from straight down and the bearing. */
    type Flight = {from: Vector3; to: Vector3; fromDistance: number; toDistance: number; fromPolar: number; toPolar: number; fromAzimuth: number; toAzimuth: number; start: number; seconds: number; then?: () => void; aim?: () => Vector3 | null};
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
        // Flying to something that moves (a small animal crawling): the destination keeps up with it.
        const aim = flight.aim?.();
        if (aim) flight.to.copy(aim);
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
        const seabed = heightAt(target.x, target.z);
        // Under the sea (a swimmer looked at, the director's dive) the target stays down there, above the sea floor.
        const diving = seabed < -0.4 && target.y < -0.15;
        // (Diving, it is only kept off the floor: it used to be pulled down onto it, which sank the view below a swimmer in its band.)
        const groundUnderTarget = diving ? seabed + 0.3 : Math.max(seabed, 0);
        const viewDistance = camera.position.distanceTo(target);
        // Close up (a gecko on a wall, a beetle on a trunk), or looking at an animal up a tree or on a wall, the target
        // may stand above the ground: only kept out of it.
        const looked = selectedId ? findEntry(selectedId) : null;
        const aloft = diving || viewDistance < 6 || Boolean(looked && (looked.place.canopy || looked.place.micro || looked.air > 0.001));
        const lift = (aloft ? Math.max(groundUnderTarget - target.y, 0) : groundUnderTarget - target.y) * 0.15;
        // (Not while following: a flyer is followed up in the air.)
        if (Math.abs(lift) > 0.001 && !followId) {
            target.y += lift;
            camera.position.y += lift;
        }
        // Close to the ground only when close to what it looks at (a small animal), else well above it.
        const below = heightAt(camera.position.x, camera.position.z);
        const floor = (diving && below < -0.4 ? below + 0.5 : Math.max(below, 0)) + (diving ? 0 : Math.min(Math.max(viewDistance * 0.25, 0.03), 1.2));
        if (camera.position.y < floor) camera.position.y = floor;
        // Looking up at the surface is allowed only under it; up at a canopy animal only while it is looked at.
        controls.maxPolarAngle = diving ? 1.62 : looked?.place.canopy ? 2.7 : 1.36;
    };

    // MARK: Layers: underwater and the cutaway

    let underwater = false;
    let cutawayOpen = false;
    /** The page's or the director's choice: open, closed, or (null) open when an underground animal is looked at. */
    let cutawayWanted: boolean | null = null;
    let cutawayAt: {target: Vector3; azimuth: number} | null = null;
    // Under water the view is absorbed exponentially (graphics pass): blue-green, half gone by about 12 m.
    const underFog = new FogExp2(new Color("#2b6f78"), 0.058);
    const underDay = new Color("#2f7c85");
    const underNight = new Color("#0b2229");
    const stepLayers = (elapsed: number) => {
        const under = camera.position.y < -0.02 && heightAt(camera.position.x, camera.position.z) < -0.3;
        if (under !== underwater) {
            underwater = under;
            lighting.setUnderwater(under);
            scene.fog = under ? underFog : fog;
            vegetation.grass.visible = !under && TIER_SETTINGS[tier].grass > 0;
            micro.group.visible = !under;
            ARK_CAUSTICS.value = under ? 0.9 : 0.3;
        }
        if (under) {
            underFog.color.copy(underNight).lerp(underDay, Math.min(Math.max(lighting.daylight.daylight, 0), 1));
            scene.background = underFog.color;
        } else if (scene.background) {
            scene.background = null;
        }
        layersScene.setUnderwater(under, camera.position, lighting.daylight.daylight);
        // The cutaway: in front of what the camera looks at, rebuilt only when that moves on or the camera turns.
        const selected = selectedId ? findEntry(selectedId) : null;
        const want = cutawayWanted ?? Boolean(selected?.place.burrow && camera.position.distanceTo(controls.target) < 30);
        if (!want) {
            if (cutawayOpen) cutawayOpen = layersScene.setCutaway(null);
            cutawayAt = null;
        } else {
            const middleOfTunnel = selected?.place.burrow ? tunnelPoint(selected.place.burrow, 0.5) : null;
            const target = middleOfTunnel && selected?.place.burrow ? new Vector3(middleOfTunnel.x, selected.place.burrow.ground, middleOfTunnel.z) : controls.target.clone();
            const azimuth = Math.atan2(camera.position.x - target.x, camera.position.z - target.z);
            const turned = cutawayAt ? Math.abs(Math.atan2(Math.sin(azimuth - cutawayAt.azimuth), Math.cos(azimuth - cutawayAt.azimuth))) : Infinity;
            if (!cutawayAt || cutawayAt.target.distanceTo(target) > 1 || turned > 0.35) {
                cutawayAt = {target, azimuth};
                cutawayOpen = layersScene.setCutaway({target, towardCamera: new Vector3(Math.sin(azimuth), 0, Math.cos(azimuth))});
            }
        }
        layersScene.step(elapsed);
    };

    /**
     * Close to a small animal the camera may come right up to it: the
     * nearest distance and the near plane follow what is in front of it.
     */
    const fitCloseUp = () => {
        const target = controls.target;
        const selected = selectedId ? findEntry(selectedId) : null;
        // Looking at a small animal (flying to it, too), or with one close in front.
        let close = Boolean(selected?.micro);
        if (!close) {
            for (const entry of entries) {
                if (!entry.micro) continue;
                const dx = entry.place.x - target.x;
                const dz = entry.place.z - target.z;
                if (dx * dx + dz * dz < MICRO_CLOSE_WITHIN * MICRO_CLOSE_WITHIN && Math.abs(entry.place.ground - target.y) < MICRO_CLOSE_WITHIN) {
                    close = true;
                    break;
                }
            }
        }
        const want = close ? MICRO_MIN_DISTANCE : 4;
        // Down at once; back up gently (the camera eases out rather than jumping).
        controls.minDistance = want < controls.minDistance ? want : controls.minDistance + (want - controls.minDistance) * 0.05;
        const distance = camera.position.distanceTo(target);
        const near = Math.min(Math.max(distance * 0.08, 0.01), 0.4);
        if (Math.abs(near - camera.near) > camera.near * 0.08) {
            camera.near = near;
            camera.updateProjectionMatrix();
        }
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

    /** A tap on a herd's members (not on one of its representatives): the herd, for its species card. */
    const pickHerd = (clientX: number, clientY: number): HerdDraw | null => {
        const rect = canvas.getBoundingClientRect();
        const x = clientX - rect.left;
        const y = clientY - rect.top;
        let best: HerdDraw | null = null;
        let bestScore = Infinity;
        for (const herd of herds) {
            const perPixelAt = 2 * Math.tan(FOV * Math.PI / 360) / height;
            for (let i = 0; i < herd.members.length; i++) {
                const mx = herd.middles[i * 3];
                if (Number.isNaN(mx)) continue;
                projected.set(mx, herd.middles[i * 3 + 1], herd.middles[i * 3 + 2]);
                const distance = camera.position.distanceTo(projected);
                projected.project(camera);
                if (projected.z > 1) continue;
                const sx = (projected.x + 1) / 2 * width;
                const sy = (1 - projected.y) / 2 * height;
                const radius = Math.max(Math.max(herd.length, herd.height) / (perPixelAt * distance) / 2, 12);
                const d = Math.hypot(x - sx, y - sy);
                if (d < radius && d / radius < bestScore) {
                    best = herd;
                    bestScore = d / radius;
                }
            }
        }
        return best;
    };

    const herdInfo = (herd: HerdDraw): ArkHerdInfo => ({key: herd.info.key, slug: herd.slug, name: herd.info.name, count: herd.info.count, mine: herd.info.mine});

    /** A herd selected: its species card in the page, the camera over the whole herd (A14). */
    const selectHerd = (key: string | null, flyTo: boolean): boolean => {
        const herd = key ? herds.find((h) => h.info.key === key) ?? null : null;
        if (key && !herd) return false;
        selectedHerd = herd ? herd.info.key : null;
        for (const h of herds) h.badge.dataset.selected = h === herd ? "1" : "";
        if (herd) {
            if (selectedId) select(null, false);
            options.onHerd?.(herdInfo(herd));
            if (flyTo) {
                opening = false;
                controls.autoRotate = false;
                lastTouch = performance.now() / 1000;
                // Every one of them in view (with the representatives, who stand among them).
                const live = entries.filter((entry) => herdKeyOf(entry.animal) === herd.info.key);
                let reach = herd.radius;
                for (const entry of live) reach = Math.max(reach, Math.hypot(entry.place.x - herd.centre.x, entry.place.z - herd.centre.z));
                const target = new Vector3(herd.centre.x, Math.max(heightAt(herd.centre.x, herd.centre.z), 0), herd.centre.z);
                fly(target, Math.min(Math.max(reach * 2.4 + 12, 24), 160), 1.4, 0.95);
            }
        } else {
            options.onHerd?.(null);
        }
        return true;
    };
    const herdKeyOf = (animal: ArkAnimal) => animal.species_profile_id || `slug:${animal.model_slug}`;

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

    // MARK: Leaves in the way

    /** The plants that can stand between the camera and an animal up a tree (never the grass). */
    const TREE_KINDS = new Set(["canopy", "rainforest", "broadleaf", "conifer", "acacia", "palm", "orchard", "shrub", "cactus"]);
    const occluders = vegetation.meshes.filter((mesh) => TREE_KINDS.has(mesh.userData.kind as string));
    const rays = new Raycaster();
    const rayFrom = new Vector3();
    const rayTo = new Vector3();
    /** What is hit between a camera position and a target, short of the animal itself (its own perch within `slack` m). */
    const back = new Vector3();
    const blockers = (from: Vector3, to: Vector3, slack: number): Array<{mesh: InstancedMesh; distance: number; instance: number}> => {
        const span = from.distanceTo(to);
        rays.set(from, rayTo.copy(to).sub(from).normalize());
        rays.near = 0;
        rays.far = Math.max(span - slack, 0.01);
        const hits = rays.intersectObjects(occluders, false).map((hit) => ({mesh: hit.object as InstancedMesh, distance: hit.distance, instance: hit.instanceId ?? -1}));
        // And back from the animal to the camera: leaves are single-sided, so a camera inside a pad of leaves only
        // sees it from the inside (no hit one way, a hit the other).
        rays.set(back.copy(to), rayTo.copy(from).sub(to).normalize());
        rays.near = slack;
        rays.far = span;
        for (const hit of rays.intersectObjects(occluders, false)) hits.push({mesh: hit.object as InstancedMesh, distance: span - hit.distance, instance: hit.instanceId ?? -1});
        rays.near = 0;
        return hits;
    };
    const cameraAt = (target: Vector3, distance: number, polar: number, azimuth: number) => rayFrom.copy(target).add(offset.setFromSpherical(spherical.set(distance, polar, azimuth)));
    /**
     * A view of an animal up a tree with nothing in the way: its mode's own
     * angle first, then turned either side, from higher and lower, a little
     * nearer. Else the mode's own (the leaves in the way fade while it is
     * looked at: `foldTrees`).
     */
    const clearCanopyView = (target: Vector3, distance: number, polar: number, azimuth: number, length: number) => {
        const slack = Math.max(length * 0.6, 0.35);
        for (const near of [1, 0.75, 0.55]) {
            for (const turn of [0, 0.6, -0.6, 1.2, -1.2, Math.PI / 2 + 0.4, -Math.PI / 2 - 0.4, Math.PI]) {
                for (const tilt of [polar, 2.45, 1.55, 1.0]) {
                    const from = cameraAt(target, distance * near, tilt, azimuth + turn);
                    if (from.y < Math.max(heightAt(from.x, from.z), 0) + 0.3) continue;
                    if (!blockers(from, target, slack).length) return {distance: distance * near, polar: tilt, azimuth: azimuth + turn};
                }
            }
        }
        return {distance, polar, azimuth};
    };
    /**
     * The trees still between the camera and the animal looked at up a tree
     * (no clear view was found, or the camera was moved): those trees are
     * folded away (their instance shrunk to nothing) while it is looked at,
     * and stand again after. Checked a few times a second; never the
     * animal's own perch (within its slack).
     */
    let foldCheck = 0;
    const folded = new Map<InstancedMesh, Map<number, Matrix4>>();
    const unfold = (keep: Set<string>) => {
        folded.forEach((instances, mesh) => {
            instances.forEach((original, index) => {
                if (keep.has(`${mesh.id}#${index}`)) return;
                mesh.setMatrixAt(index, original);
                mesh.instanceMatrix.needsUpdate = true;
                instances.delete(index);
            });
            if (!instances.size) folded.delete(mesh);
        });
    };
    const foldTrees = (now: number) => {
        if (now - foldCheck < 0.25) return;
        foldCheck = now;
        const looked = selectedId ? findEntry(selectedId) : null;
        const keep = new Set<string>();
        if (looked?.place.canopy && looked.middle && !flight) {
            // Shrunk ones are not hit again: keep what is folded while it is still in the way (tested at full size).
            const hits = blockers(rayFrom.copy(camera.position), looked.middle, Math.max(looked.length * 0.6, 0.35));
            for (const hit of hits) {
                // (Never a canopy tree: the animal may be on it. Those the view search keeps out of the way.)
                if (hit.instance < 0 || hit.mesh.userData.kind === "canopy") continue;
                keep.add(`${hit.mesh.id}#${hit.instance}`);
                let instances = folded.get(hit.mesh);
                if (!instances) folded.set(hit.mesh, (instances = new Map()));
                if (instances.has(hit.instance)) continue;
                const original = new Matrix4();
                hit.mesh.getMatrixAt(hit.instance, original);
                instances.set(hit.instance, original);
                hit.mesh.setMatrixAt(hit.instance, new Matrix4().makeScale(0, 0, 0).setPosition(new Vector3().setFromMatrixPosition(original)));
                hit.mesh.instanceMatrix.needsUpdate = true;
            }
            folded.forEach((instances, mesh) => instances.forEach((_, index) => keep.add(`${mesh.id}#${index}`)));
        }
        unfold(keep);
    };

    /** Where an animal's middle is now, drawn or not (off screen, or a layer not drawn from here). */
    const middleNow = (entry: Entry): Vector3 => {
        if (entry.middle) return entry.middle.clone();
        const model = library.get(entry.animal.model_slug);
        const height = model ? model.height * (entry.length / model.bodyLength) : entry.length * 0.6;
        const where = pose(entry, model, height, elapsedNow());
        return new Vector3(where.x, where.base + height / 2, where.z);
    };

    const select = (id: string | null, flyTo: boolean, close = false) => {
        // A herd member that isn't one of its representatives comes forward to be met (A14); the last one goes back.
        const pin = id && ((!entryById.has(id) && aboard.has(id)) || id === selectionPin) ? id : null;
        if (pin !== selectionPin) {
            selectionPin = pin;
            refreshLive();
        }
        if (id && selectedHerd) selectHerd(null, false);
        selectedId = id;
        if (followId && followId !== id) endFollow();
        const entry = findEntry(id);
        options.onSelect?.(entry?.animal ?? null);
        toldState = null;
        tellState();
        if (entry && flyTo) {
            // A selection from the page (the HUD, `?focus=`) ends the opening, as a touch does.
            opening = false;
            controls.autoRotate = false;
            lastTouch = performance.now() / 1000;
            const distance = camera.position.distanceTo(controls.target);
            if (entry.place.micro) {
                // A small animal: right up to it, from out along its surface (in front of a wall, beside a trunk, above a flower).
                // The right distance for its size: about a fifth of the view's height.
                const point = surfacePoint(entry.place.micro, entry.animal.zone);
                const target = entry.middle ? entry.middle.clone() : new Vector3(point.x, point.y, point.z);
                const view = viewFrom(point);
                const closeDistance = Math.min(Math.max(entry.trueLength * 6, 0.12), 3);
                controls.minDistance = MICRO_MIN_DISTANCE;
                fly(target, closeDistance, distance > 30 ? 2.2 : 1.4, view.polar, view.azimuth);
                if (flight) flight.aim = () => (selectedId === entry.animal.id ? entry.middle : null);
                return;
            }
            // A swimmer under the surface: the camera dives to it, level with it (underwater).
            const swimming = ZONE_SITES[entry.animal.zone]?.kind === "sea" || entry.depth?.home === "coast" ? middleNow(entry) : null;
            if (swimming && swimming.y - entry.drawnHeight / 2 < -0.3 && !close) {
                const under = () => middleNow(entry).setY(Math.min(middleNow(entry).y, -0.8));
                fly(under(), Math.min(3 + entry.length * 2.2, 14), distance > 30 ? 2 : 1.4, 1.5, (entry.yawNow ?? entry.place.yaw) + Math.PI / 2);
                if (flight) flight.aim = () => (selectedId === entry.animal.id ? under() : null);
                return;
            }
            // A bird of the air in flight stays in the air: the camera goes up to it and keeps it in view.
            const aloft = entry.state.airborne && entry.air > 0.5;
            if (aloft && !close) {
                const at = middleNow(entry);
                fly(at, 8 + entry.length * 4, distance > 30 ? 2 : 1.4, CLOSE_POLAR);
                if (flight) flight.aim = () => (selectedId === entry.animal.id ? middleNow(entry) : null);
                return;
            }
            // A canopy animal: up at its height, from the clearing's side of its tree (the forest round it would hide it).
            if (entry.place.canopy && !close) {
                // Where the leaves don't hide it: from above for one on the crown, from below for one under a limb,
                // from below and beside its limb for one on it (looking up past the limb, the leaf pads are above it),
                // level with one on the trunk, out along the trunk's face.
                const place = entry.place.canopy;
                const site = ZONE_SITES[entry.animal.zone] ?? ZONE_SITES.farm_garden;
                const target = middleNow(entry);
                const point = canopyPoint(entry.animal.zone, place);
                let azimuth = Math.atan2(site.x - target.x, site.z - target.z);
                let polar = 2.2;
                if (place.limb === -1) polar = 0.75;
                else if (place.limb === -2) {
                    polar = 1.5;
                    azimuth = Math.atan2(point.nx, point.nz);
                } else {
                    // Square to the limb, on the clearing's side of it.
                    const side = Math.atan2(point.tz, -point.tx);
                    const toSite = azimuth;
                    azimuth = Math.cos(side - toSite) >= 0 ? side : side + Math.PI;
                    polar = place.mode === "hang" ? 2.55 : 2.15;
                }
                // The first view, of the mode's own and some others round it, with no leaves or limbs between.
                const view = clearCanopyView(target, 2.6 + entry.length * 2.2, polar, azimuth, entry.length);
                fly(target, view.distance, distance > 30 ? 2 : 1.4, view.polar, view.azimuth);
                if (flight) flight.aim = () => (selectedId === entry.animal.id ? middleNow(entry) : null);
                return;
            }
            // An underground animal: from above its burrow, a little to one side; the cutaway opens in front of it.
            if (entry.place.burrow && !close) {
                const burrow = entry.place.burrow;
                const middle = tunnelPoint(burrow, 0.5);
                fly(new Vector3(middle.x, burrow.ground - 0.7, middle.z), 5.5 + entry.length * 2, 1.4, 1.2, Math.atan2(Math.sin(burrow.direction + Math.PI / 2), Math.cos(burrow.direction + Math.PI / 2)));
                return;
            }
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
        if (!hit) {
            const herd = pickHerd(event.clientX, event.clientY);
            if (herd) {
                selectHerd(herd.info.key, true);
                return;
            }
            if (selectedHerd) selectHerd(null, false);
        }
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
    // The keyboard (A18): arrows move the view (OrbitControls), + and − zoom, Esc closes the card.
    controls.listenToKeyEvents(canvas);
    controls.keyPanSpeed = 14;
    const onKey = (event: KeyboardEvent) => {
        lastTouch = performance.now() / 1000;
        if (opening) {
            opening = false;
            flight = null;
        }
        if (event.key === "Escape") {
            if (replay) finishReplay(true, true);
            else if (selectedId) select(null, false);
            else if (selectedHerd) selectHerd(null, false);
            return;
        }
        if (event.key === "+" || event.key === "=" || event.key === "-" || event.key === "_") {
            event.preventDefault();
            const distance = camera.position.distanceTo(controls.target);
            const next = Math.min(Math.max(distance * (event.key === "+" || event.key === "=" ? 0.8 : 1.25), controls.minDistance), MAX_DISTANCE);
            fly(controls.target.clone(), next, 0.35);
        }
    };
    canvas.addEventListener("keydown", onKey);

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
    modules = ARK_SCENE_MODULES.map((create) => create({
        scene,
        renderer,
        tier,
        snapshot: options.snapshot,
        hours: hoursNow(),
        placeOf: (id) => placedAll.get(id) ?? null,
        planOf: (slug) => library.get(slug)?.behaviour?.plan,
        reducedMotion
    }));
    if (options.props === false) for (const sceneModule of modules) sceneModule.setEnabled(false);
    applyTier(tier);

    // MARK: First view

    setSnapshot(options.snapshot, false);
    const home = homeView();
    // A recording (`?record=1`) starts on its first shot's view: no opening flight.
    let opening = !reducedMotion && !options.recording;
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
            full: displayLength(next.slug),
            trueLength: arkBody({model_slug: next.slug}).metres,
            layer: speciesLayer(next.slug),
            depth: null,
            seed: 0,
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
            state: behaviourState({activity: null, elevation: 0, flyer: false, visitor: true}),
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
        visitorLabel.style.letterSpacing = arkTracking(next.label, "0.04em");
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

    /** Each herd's count badge over its middle, while the herd is in view and the camera isn't among it. */
    const badgePoint = new Vector3();
    const placeBadges = () => {
        for (const herd of herds) {
            const badge = herd.badge;
            const member = herd.members[herd.anchor];
            const shown = member && !Number.isNaN(herd.middles[herd.anchor * 3]);
            if (!shown) {
                badge.style.opacity = "0";
                badge.style.pointerEvents = "none";
                continue;
            }
            badgePoint.set(member.x, Math.max(member.ground, 0) + herd.height * 1.25 + 0.4, member.z);
            const near = camera.position.distanceTo(badgePoint) < 10;
            badgePoint.project(camera);
            const visible = !near && !replay && badgePoint.z < 1 && Math.abs(badgePoint.x) < 1.02 && Math.abs(badgePoint.y) < 1.02;
            badge.style.opacity = visible ? "1" : "0";
            badge.style.pointerEvents = visible ? "auto" : "none";
            badge.style.background = badge.dataset.selected ? "rgba(167, 244, 50, 0.9)" : "rgba(14, 20, 14, 0.66)";
            badge.style.color = badge.dataset.selected ? "#0e140e" : "rgba(255, 252, 244, 0.98)";
            if (visible) badge.style.transform = `translate(${((badgePoint.x + 1) / 2 * width).toFixed(1)}px, ${((1 - badgePoint.y) / 2 * height).toFixed(1)}px) translate(-50%, -100%)`;
        }
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
        micro.setNight(lighting.daylight.night);
        for (const sceneModule of modules) sceneModule.setHours(hoursNow());
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

    /**
     * Where a clutch is laid: where the young will stand once they hatch
     * (when that is in the same replay), else beside the parent, a body
     * length to its side.
     */
    const nestSpot = (parent: Entry, acts: ArkAct[], index: number) => {
        const plan = library.get(parent.animal.model_slug)?.behaviour?.plan;
        const kind = nestKind({plan, slug: parent.animal.model_slug, water: inWater(parent)});
        const size = Math.min(Math.max(parent.length * 0.55, 0.25), 1.6);
        const laid = acts[index];
        for (let i = index + 1; i < acts.length; i++) {
            const later = acts[i];
            if (later.kind !== "birth" || arkHatchNest(acts, i) !== laid) continue;
            const young = later.young.map(entryFor).find((entry): entry is Entry => Boolean(entry));
            if (young) return {x: young.place.x, y: Math.max(young.place.ground, 0) + (kind === "spawn" ? -0.05 : 0), z: young.place.z, size, kind};
        }
        const body = bodyOf(parent);
        const side = parent.phase > 0.5 ? 1 : -1;
        const x = body.x + Math.cos(body.yaw) * side * parent.length * 0.9;
        const z = body.z - Math.sin(body.yaw) * side * parent.length * 0.9;
        return {x, y: Math.max(heightAt(x, z), 0) + (kind === "spawn" ? -0.05 : 0), z, size, kind};
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
        if (act.kind === "laid") {
            // A clutch appears beside the parent: where its young will stand when they hatch in this replay, else at its side.
            const parent = entryFor(act.animal);
            if (!parent) {
                run.seconds = 0.4;
                run.actingFrom = performance.now() / 1000;
                return;
            }
            const spot = nestSpot(parent, run.acts, run.index);
            toFrame({x: spot.x, y: spot.y + 0.3, z: spot.z}, 5 + parent.length * 2.4, 1.1, undefined, LAID_SECONDS, () => {
                let laid = false;
                run.step = (_t, _last, now) => {
                    if (laid) return;
                    laid = true;
                    nests.lay(act.nest, spot, spot.size, spot.kind, act.eggs, now);
                };
            });
            return;
        }
        if (act.kind === "birth" && act.fromEgg) {
            // They hatch: from the clutch laid earlier in this replay, else from one at the young's place.
            const young = act.young.map(entryFor).filter((entry): entry is Entry => Boolean(entry));
            const first = young[0];
            if (!first) {
                run.seconds = 0.4;
                run.actingFrom = performance.now() / 1000;
                return;
            }
            const laid = arkHatchNest(run.acts, run.index);
            const nestId = laid?.nest ?? `hatch:${first.animal.id}`;
            const parent = act.parents.map((id) => findEntry(id)).find(Boolean) ?? null;
            const plan = library.get((parent ?? first).animal.model_slug)?.behaviour?.plan;
            const kind = nestKind({plan, slug: (parent ?? first).animal.model_slug, water: inWater(parent ?? first)});
            const at = nests.where(nestId) ?? {x: first.place.x, y: Math.max(first.place.ground, 0) + (kind === "spawn" ? -0.05 : 0), z: first.place.z, size: Math.min(Math.max((parent ?? first).length * 0.55, 0.25), 1.6)};
            toFrame({x: at.x, y: at.y + 0.3, z: at.z}, 5 + first.length * 3, 1.1, undefined, BIRTH_SECONDS + ArkNests.YOUNG_AFTER, () => {
                let hatched = false;
                run.step = (t, _last, now) => {
                    if (!hatched) {
                        hatched = true;
                        // A clutch laid before the last visit: it is there already, its eggs about to hatch.
                        if (!nests.has(nestId)) nests.lay(nestId, at, at.size, kind, young.length, now - 3);
                        nests.hatch(nestId, now);
                    }
                    young.forEach((entry, i) => {
                        if (entry.held && t >= ArkNests.YOUNG_AFTER + i * 0.25) {
                            entry.held = false;
                            entry.air = 0;
                            entry.arrivedAt = elapsedNow();
                        }
                    });
                };
            });
            return;
        }
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
        nests.clear();
        flight = null;
        if (replayPins.size) {
            replayPins = new Set();
            refreshLive();
        }
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
        // Everyone the acts name is drawn one by one while it plays, a herd's members too (A14).
        replayPins = new Set(acts.flatMap((act) => (act.kind === "meal" ? [act.predator.id, act.prey.id] : act.kind === "birth" ? act.young.map((a) => a.id) : act.kind === "extinction" ? [] : [act.animal.id])));
        refreshLive();
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
            for (const animal of named) if (!aboard.has(animal.id)) gone.set(animal.id, animal);
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
        const slugs = new Set(acts.flatMap((act) => (act.kind === "meal" ? [act.predator.model_slug, act.prey.model_slug] : act.kind === "death" || act.kind === "arrival" || act.kind === "laid" ? [act.animal.model_slug] : act.kind === "birth" ? act.young.map((a) => a.model_slug) : [])));
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
        // Reduced motion: the water, the grass and the animals hold still (A18).
        if (!reducedMotion) {
            ARK_TIME.value = elapsed;
            ARK_CLOCK.value = elapsed % 3600;
        }
        applyEnvironment();
        landscape.water.position.y = ARK_ENVIRONMENT.seaLevel.value;
        stepFlight(now);
        stepInset();
        // Idle: after a while untouched, the view drifts slowly round.
        if (!reducedMotion && !options.recording && !flight && !selectedId && !followId && !opening && !replay && now - lastTouch > IDLE_DRIFT_AFTER) controls.autoRotate = true;
        controls.update();
        keepInWorld();
        fitCloseUp();
        stepLayers(elapsed);
        foldTrees(elapsed);
        micro.step(camera.position);
        for (const sceneModule of modules) sceneModule.step(elapsed, camera, controls.target);
        stepTalking(elapsed);
        // The hour: read again every minute (the light changes only a little).
        if (now - lastClock > (clockScale > 1 ? 0.25 : 60) && !replay) {
            lastClock = now;
            setLight();
        }
        stepReplay(now);
        updateInstances(elapsed);
        dust.step(now);
        nests.step(now);
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
                    // A small animal crawls up and down its wall or trunk, a flyer climbs and comes down: kept in view.
                    const dy = tracked.y - lastTracked.y;
                    const trackedEntry = findEntry(selectedId);
                    if ((trackedEntry?.micro || (trackedEntry && trackedEntry.air > 0.001)) && Math.abs(dy) < 1) {
                        controls.target.y += dy;
                        camera.position.y += dy;
                    }
                }
            }
            lastTracked = (lastTracked ?? new Vector3()).copy(tracked);
        } else {
            lastTracked = null;
        }
        const viewDistance = camera.position.distanceTo(controls.target);
        nearDetail.update(controls.target, viewDistance);
        lighting.fitShadow(controls.target, viewDistance);
        // The miniature's soft top and bottom, gentler on a tall phone screen where it covers more of the picture.
        post.setTiltShift(Math.min(Math.max((viewDistance - 110) / 260, 0), width < height ? 0.18 : 0.3));
        renderer.info.reset();
        post.render();
        placeLabels();
        placeVisitorLabel();
        placeBadges();

        const spent = performance.now() - startedAt;
        frameTimes.push(spent);
        if (frameTimes.length > 60) frameTimes.shift();
        if (lastDrawn) {
            const interval = startedAt - lastDrawn;
            // Long gaps (a tab in the background, a stall) stay out of the stats, but the tier check counts slow frames
            // too: a device drawing at 5 fps must still drop to the low tier (only gaps over 2 s, a hidden page, are skipped).
            if (interval < 250) {
                frameIntervals.push(interval);
                if (frameIntervals.length > 60) frameIntervals.shift();
            }
            if (interval < 2000) {
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
    if (process.env.NODE_ENV !== "production") (window as unknown as {__arkDebug?: unknown}).__arkDebug = {camera, controls, scene, visitor: () => visitor, talking, lighting, entries: () => allEntries(), replaying: () => Boolean(replay), following: () => followId, occlusion: () => {
        const looked = selectedId ? findEntry(selectedId) : null;
        return looked?.middle ? blockers(camera.position.clone(), looked.middle, 0.35).map((hit) => ({kind: hit.mesh.userData.kind, distance: hit.distance})) : null;
    }};

    return {
        update: (snapshot) => setSnapshot(snapshot, true),
        setMineOnly: (value) => {
            mineOnly = value;
        },
        select: (id, closeUp) => select(id, true, Boolean(closeUp)),
        selectHerd: (key) => selectHerd(key, true),
        setLite: (lite) => {
            liteChoice = lite;
            const want: QualityTier = lite === true ? "low" : lite === false && tier === "low" ? (forced ?? (autoTier === "low" ? "medium" : autoTier)) : lite === null ? (forced ?? autoTier) : tier;
            if (want !== tier) applyTier(want);
            else options.onTier?.(tier, liteOn());
            motes.points.visible = !reducedMotion && !liteOn();
            // Fewer (or more) of each herd drawn one by one.
            if (herds.length) setSnapshot(current, false);
        },
        setProps: (on) => {
            for (const sceneModule of modules) sceneModule.setEnabled(on);
        },
        setReducedMotion: (reduced) => {
            if (reduced === reducedMotion) return;
            reducedMotion = reduced;
            for (const sceneModule of modules) sceneModule.setReducedMotion(reduced);
            motes.points.visible = !reducedMotion && !liteOn();
            if (reduced) {
                flight = null;
                controls.autoRotate = false;
                if (replay) finishReplay(true, true);
                applyHours();
            }
        },
        follow,
        setClockScale: (scale, atMs) => {
            // Development: the world's time runs `scale` times faster from now, or from `atMs` (a day-night recording); 1 is the clock again.
            const now = typeof atMs === "number" && Number.isFinite(atMs) ? atMs : worldMs();
            clockAnchor = now;
            clockAnchorReal = Date.now();
            clockScale = Math.max(Number.isFinite(scale) ? scale : 1, 1);
            if (clockScale === 1 && atMs === undefined) clockAnchor = clockAnchorReal = Date.now();
            setLight();
        },
        setHours: (hours) => {
            pinnedHours = typeof hours === "number" && Number.isFinite(hours) ? hours : null;
            setLight();
        },
        setEnvironment: (environment) => {
            pinnedEnvironment = environment;
            applyEnvironment(true);
        },
        setAnimalLook: (on, pin) => {
            look.setEnabled(on);
            if (pin && "islandMs" in pin) look.pinIsland(pin.islandMs ?? null);
            shadows.setContact(on);
            shadows.setStrength(look.contactStrength(TIER_SETTINGS[tier].shadows > 0));
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
        view: (): ArkCameraView => {
            spherical.setFromVector3(offset.copy(camera.position).sub(controls.target));
            return {target: {x: controls.target.x, y: controls.target.y, z: controls.target.z}, distance: spherical.radius, polar: spherical.phi, azimuth: spherical.theta};
        },
        homeView: (): ArkCameraView => {
            const view = homeView();
            return {target: {x: view.target.x, y: view.target.y, z: view.target.z}, distance: view.distance, polar: view.polar, azimuth: view.azimuth};
        },
        setView: (view) => {
            // Exactly this view, now: any flight (a replay's way home) is dropped.
            flight = null;
            controls.autoRotate = false;
            lastTouch = performance.now() / 1000;
            spherical.set(Math.min(Math.max(view.distance, controls.minDistance), MAX_DISTANCE), view.polar, view.azimuth);
            controls.target.set(view.target.x, view.target.y, view.target.z);
            camera.position.copy(controls.target).add(offset.setFromSpherical(spherical));
            controls.update();
        },
        locate: (id) => {
            const entry = findEntry(id);
            if (!entry) return null;
            const ground = Math.max(entry.place.ground, 0);
            const middle = entry.middle ?? new Vector3(entry.place.x, ground + entry.drawnHeight * 0.5, entry.place.z);
            return {x: middle.x, y: middle.y, z: middle.z, ground, length: entry.length, height: entry.drawnHeight, awake: entry.awake, yaw: entry.yawNow ?? 0};
        },
        behaviour: (id) => findEntry(id)?.state ?? null,
        heightAt: (x, z) => Math.max(heightAt(x, z), 0),
        preload: async (slugs) => {
            await library.ready();
            for (const slug of slugs) {
                if (!library.has(slug)) continue;
                library.request(slug, "far");
                library.request(slug, "near");
                tokens.ensure(slug);
            }
        },
        loading: () => library.busy,
        hold: (id) => {
            const entry = findEntry(id);
            if (entry) entry.held = true;
        },
        moment: (kind, id) => {
            const now = elapsedNow();
            const fits = (entry: Entry) => canMoment(kind, entry.animal.model_slug, entry.animal.zone) && !entry.act && !entry.held && (kind !== "primate_drop" || Boolean(entry.place.canopy));
            const chosen = (id ? findEntry(id) : null) ?? [...entries].sort((a, b) => a.animal.id.localeCompare(b.animal.id)).find(fits) ?? null;
            if (!chosen || !fits(chosen)) return null;
            chosen.moment = {kind, start: now, from: null, beats: []};
            return chosen.animal.id;
        },
        setCutaway: (open) => {
            cutawayWanted = open;
            cutawayAt = null;
        },
        arrive: (id) => {
            const entry = findEntry(id);
            if (!entry) return;
            // As a replay's arrival: on the ground first (a flyer then takes to the air), with the entrance's grow and ripple.
            entry.held = false;
            entry.air = 0;
            entry.arrivedAt = elapsedNow();
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
            modelsLoaded: library.loadedCount,
            herdFigures: counts.herdFigures,
            herdSpecks: counts.herdSpecks,
            live: entries.length,
            placeholders: library.placeholderCount,
            tier,
            lite: liteOn(),
            rigged: counts.rigged,
            scheduled: scheduledCount,
            behaviourMs: Math.round(mean(behaviourTimes) * 1000) / 1000,
            behaviourBuildMs: Math.round(behaviourBuildMs),
            rigsLoaded: rigs.loadedCount,
            rigBytes: rigs.bytes,
            animalLook: look.on,
            furShells: look.on ? look.shells.drawn : 0,
            closeUpSkins: look.closeUps.loaded
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
            canvas.removeEventListener("keydown", onKey);
            controls.stopListenToKeyEvents();
            herds.forEach((herd) => herd.badge.remove());
            specks.dispose();
            controls.dispose();
            species.forEach((meshes) => {
                meshes.near?.dispose();
                meshes.far?.dispose();
                meshes.rig?.dispose();
                meshes.nearMaterial?.dispose();
                meshes.farMaterial?.dispose();
                meshes.rigMaterial?.dispose();
            });
            rigs.dispose();
            look.dispose();
            talking.actor?.dispose();
            replay = null;
            dust.dispose();
            nests.dispose();
            if (jetty) (jetty.userData.dispose as () => void)();
            library.dispose();
            tokens.dispose();
            dots.dispose();
            shadows.dispose();
            rings.dispose();
            landscape.dispose();
            nearDetail.dispose();
            vegetation.dispose();
            micro.dispose();
            for (const sceneModule of modules) sceneModule.dispose();
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
