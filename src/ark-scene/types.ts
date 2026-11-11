import type {ArkActivity} from "@/lib/ark-daylight";
import type {ArkAct} from "@/lib/ark-life";
import type {ArkStats} from "@/ark-scene/stats";
import type {ArkMomentKind} from "@/ark-scene/moments";
import type {ArkBehaviourState} from "@/ark-scene/behaviour-state";
import type {ArkRestStatus} from "@/ark-scene/sleep";

export type {ArkRestStatus} from "@/ark-scene/sleep";
import type {ArkRuntimeHandle, ArkRuntimeOptions} from "@/ark-scene/runtime";

/**
 * The shared Ark's data, as `voyage_public_v2` returns it (life v2 contract,
 * section 4.1; `voyage_public_v1`'s answer is the same without the life
 * fields), and the scene's interface (Ark v1 contract, section 5).
 */

export const ARK_ZONES = [
    "coral_reef",
    "open_ocean",
    "seashore",
    "river_lake",
    "wetland",
    "rainforest",
    "woodland",
    "grassland",
    "desert",
    "mountains",
    "polar",
    "farm_garden"
] as const;
export type ArkZone = typeof ARK_ZONES[number];

/** The scene's world map: seven regions, each one or two zones (contract section 4). */
export const ARK_REGIONS = ["ocean", "coast", "fresh_water", "forest", "open_land", "high_cold", "home"] as const;
export type ArkRegion = typeof ARK_REGIONS[number];

export const REGION_ZONES: Record<ArkRegion, readonly ArkZone[]> = {
    ocean: ["open_ocean", "coral_reef"],
    coast: ["seashore"],
    fresh_water: ["river_lake", "wetland"],
    forest: ["rainforest", "woodland"],
    open_land: ["grassland", "desert"],
    high_cold: ["mountains", "polar"],
    home: ["farm_garden"]
};

export const ZONE_REGION: Record<ArkZone, ArkRegion> = Object.fromEntries(
    ARK_REGIONS.flatMap((region) => REGION_ZONES[region].map((zone) => [zone, region]))
) as Record<ArkZone, ArkRegion>;

/** How an animal is doing, as the server says (`voyage_public_v2`). */
export type ArkCondition = "well_fed" | "hungry" | "old";
/** The species' stored social life: `group` gathers in a cluster, `pair` stays close. */
export type ArkSociality = "solitary" | "pair" | "group";

export type ArkAnimal = {
    id: string;
    species_profile_id: string;
    name: string;
    scientific_name: string | null;
    /**
     * The Ark model's slug. A species with no model comes from the server as
     * `placeholder: true` and `model_slug: null`: it is decoded to
     * `placeholder--<species id>` (`placeholder.ts`) and drawn as the neutral figure.
     */
    model_slug: string;
    /** The species has no Ark model yet (A13): drawn as the neutral placeholder figure. */
    placeholder?: boolean;
    /**
     * Its kind (A1): a breed's parent species (a Labrador's Domestic Dog),
     * whose pairs, breeding and cap apply. Breeds of one kind are one row in
     * the population panel. Absent: its own kind.
     */
    kind_species_profile_id?: string | null;
    /** The kind's name, when the server sends it. */
    kind_name?: string | null;
    zone: ArkZone;
    arrived_at: string;
    brought_by: {label: string; named: boolean};
    mine: boolean;
    // Ark life v2 (`voyage_public_v2`): absent from a v1 snapshot.
    /** Came aboard after a step, or was born on the Ark. */
    origin?: "arrived" | "born";
    /** 0 for an arrival, a parent's plus one for the young. */
    generation?: number;
    condition?: ArkCondition | null;
    born_ark_day?: number | null;
    /** The species' stored activity: when it sleeps (the scene's day and night). */
    activity?: ArkActivity | null;
    sociality?: ArkSociality | null;
    /** A capture's setting (the server's `voyage_animals.area`): a pet's house or a farm animal's smallholding in the hamlet (`map/hamlet.ts`); absent or null: placed by the map. */
    area?: "house" | "farm" | null;
    /** Who brought it, or (for the young) both parents' bringers: labels only, anonymous unless named. */
    bringers?: Array<{label: string; named: boolean}>;
    /**
     * Where it stands, decided by the server once, when it came aboard or was
     * born: a cluster in its zone (`slot`) and its place in it (`slot_rank`,
     * 0 on the slot's spot). Absent from a v1 answer (placement then gives
     * them in arrival order).
     */
    slot?: number | null;
    slot_rank?: number | null;
    // The species' stats (docs/ark-next.md, stats addendum): looks and behaviour only. When the
    // snapshot carries none, the scene reads the catalogue's (`stats.ts`, `species-stats.json`).
    /** The five stats, 0–100. */
    stats?: Partial<ArkStats> | null;
    /** A stored body length in metres (`voyage_species_traits.length_m`), and the phrase it came from. */
    length_m?: number | null;
    length_phrase?: string | null;
};

/**
 * A clutch on the Ark (`voyage_public_v2`'s top-level `nests`, migration
 * 20261113140000, A9): one per species and zone while its eggs are in.
 * Visual only (the props' eggs in a nest, a turtle's nest on the beach).
 */
export type ArkNestRow = {
    species_profile_id: string;
    name: string;
    model_slug: string | null;
    zone: ArkZone;
    status: "egg";
    eggs: number | null;
    laid_ark_day: number | null;
    hatch_ark_day: number | null;
    mine: boolean;
};

export type ArkSnapshot = {
    voyage: {slug: string; name: string; started_at: string | null};
    counts: {animals: number; species: number; founders: number};
    zones: Array<{key: ArkZone; animals: number}>;
    animals: ArkAnimal[];
    as_of: string | null;
    /** The Ark's own day (v2's `voyage.ark_day`): 1 Ark year = 14 real days, counted by the server. */
    ark_day?: number | null;
    /** The clutches in (v2's `nests`, A9); absent from a v1 answer or before the eggs migration. */
    nests?: ArkNestRow[];
};

export type ArkSceneStats = {
    drawCalls: number;
    triangles: number;
    /** Mean CPU time of a frame's update and render, over the last second (ms). */
    frameMs: number;
    /** Mean time between drawn frames, over the last second (ms). */
    intervalMs: number;
    near: number;
    far: number;
    sprites: number;
    pixelRatio: number;
    modelsLoaded: number;
    /** Herds (A14): members drawn as the far model, and as the few-pixel figure. */
    herdFigures: number;
    herdSpecks: number;
    /** Animals drawn one by one (everyone outside a herd, and the herds' representatives). */
    live: number;
    /** Species drawn as the placeholder figure (A13). */
    placeholders: number;
    tier: "high" | "medium" | "low";
    lite: boolean;
    /** Animals drawn with their rig this frame, rigs loaded, and the rig bytes downloaded this session. */
    rigged: number;
    /** The behaviour schedule: animals on it, its main-thread time per frame (ms, mean), and the time its places and walk grid took to build (ms, once). */
    scheduled?: number;
    behaviourMs?: number;
    behaviourBuildMs?: number;
    /** In how many slices between frames the behaviour world was built, and its longest slice (ms). */
    behaviourBuildSlices?: number;
    behaviourBuildLongestMs?: number;
    /** The main-thread time the last predator-prey spacing took, sliced (ms). */
    behaviourSpacingMs?: number;
    rigsLoaded: number;
    rigBytes: number;
    /** The animal-look pass: on, animals in fur shells this frame, close-up skins on the GPU. */
    animalLook?: boolean;
    furShells?: number;
    closeUpSkins?: number;
    /** The liveliness wiring this frame: sheltering, young at heel, moved off the tide, rain drops, traces, sound. */
    liveliness?: {/** Main-thread ms a frame in the wiring (mean of the last 60). */ ms: number; /** Last frame's split (ms). */ split?: {pose: number; drawn: number; step: number}; sheltering: number; young: number; tideMoved: number; drops: number; haze: number; prints: number; ripples: number; worn: number; voices: number; beds: number; soundOn: boolean};
};

/** A herd (A14): a species with so many aboard that it is drawn as representatives and a count. */
export type ArkHerdInfo = {key: string; slug: string; name: string; count: number; mine: number};

export type ArkSceneOptions = ArkRuntimeOptions & {
    snapshot: ArkSnapshot;
    /** The ark model set's folder: `<modelBase>/manifest.json`, `<modelBase>/<slug>/<version>.near.glb`. */
    modelBase: string;
    /**
     * The rigs' folder (`<rigBase>/manifest.json`, `<rigBase>/<slug>/<v>.rig.glb`): the walking,
     * climbing and other clips that passed their checks, played on the animals close by.
     * Default: beside the model set (`…/v1/ark` → `…/ark-rig/v1`); null: no rigs.
     */
    rigBase?: string | null;
    /** The species icon art (the `animals` bucket's `<slug>.webp`). */
    iconUrl: (slug: string) => string;
    onSelect?: (animal: ArkAnimal | null) => void;
    /**
     * What the selected animal is doing now (`behaviour-state.ts`), when it is selected and whenever that changes:
     * the tap card's state line reads this, the same state the scene animates, never a clock of its own.
     */
    onBehaviour?: (id: string, state: ArkBehaviourState) => void;
    /**
     * How the selected animal is resting now, in the tap card's plain words (`sleep.ts` restStatus: asleep in its den,
     * on one leg, keeping watch, dozing in the sun…; null up and about), when it is selected and whenever that changes.
     */
    onRest?: (id: string, rest: ArkRestStatus | null) => void;
    mineOnly?: boolean;
    /** The seven regions' names, drawn over the world when it is seen from far. */
    regionLabels?: Partial<Record<ArkRegion, string>>;
    /** Called once the first frame is drawn. */
    onReady?: () => void;
    /** Honour prefers-reduced-motion: no idle motion, no camera flights. */
    reducedMotion?: boolean;
    /**
     * The full talking models (`<talkingBase>/manifest.json`, `<slug>/<version>.g1.glb|.jpg|.json`),
     * swapped in while an animal talks. Default: `modelBase` without its trailing `/ark`.
     */
    talkingBase?: string;
    /** A fixed hour (0–24) for the light and who is asleep; default: the viewer's clock, read every minute. */
    hours?: number | null;
    /** The behaviour schedule (`behaviour-schedule.ts`): animals walk, fly, swim, sleep at their roosts and visit places by the time and their ids. Default on. */
    behaviour?: boolean;
    /** The local reactive layer (`reactive.ts`): animals near the camera look round, react to predators, sounds and the camera. Default on (off with reduced motion). */
    reactive?: boolean;
    /** The camera stopped following (a drag, or the animal left). */
    onFollowEnd?: () => void;
    /**
     * A recording (`/ark?record=1`, the marketing clip recorder): no opening
     * flight and no idle drift, so every camera move is the director's.
     */
    recording?: boolean;
    /** A herd was tapped (or its badge), or the herd selection cleared (A14). */
    onHerd?: (herd: ArkHerdInfo | null) => void;
    /** A herd's count badge, e.g. "1,000 aboard" (default: the number in the page's locale). */
    herdBadge?: (count: number) => string;
    /** The canvas's accessible name (it takes the keyboard: arrows move the view, + and − zoom, Esc closes). */
    canvasLabel?: string;
    /** The lighter view (A18): true on, false off, null or absent decided by the device's tier. */
    lite?: boolean | null;
    /** The scene's own art (ground textures, sky light): `<graphicsBase>/ground-albedo-512.webp`… Default "/ark/graphics". */
    graphicsBase?: string;
    /**
     * The animal-look pass (`animal-look.ts`): surfaces by species, wet and dust, eyes, fur shells, close-up skins and
     * contact shadows on the surface. Default on; false draws the animals exactly as before.
     */
    animalLook?: boolean;
    /**
     * The close-up skins' folder (`<closeUpBase>/manifest.json`, `<slug>/<version>.near.ktx2`), loaded only when the
     * camera is close. Default: beside the model set (`…/v1/ark` → `…/v1/ark-closeup`); null: none.
     */
    closeUpBase?: string | null;
    /** Where the KTX2 transcoder is (`basis_transcoder.js` / `.wasm`). Default "/ark/basis/". */
    basisBase?: string;
    /** The asset library (trees, plants, rocks): `<assetBase>/trees/oak-a.lod0.glb`… Default its manifest's base, "/ark/assets/v1". */
    assetBase?: string;
    /** The quality tier changed (the lighter view follows it unless the reader chose). */
    onTier?: (tier: "high" | "medium" | "low", lite: boolean) => void;
    /**
     * The scenery's extra detail (nests, hives, webs, the garden's and the farm's things, the cave,
     * dew, mist, smoke: `src/ark-scene/props`): true on (default), false off.
     */
    props?: boolean;
    /**
     * The storage host the animals' sounds come from (`https://<project>.supabase.co`): the chat's
     * `animal-chat-sounds` bucket. Default: the model set's host; null: no calls.
     */
    soundBase?: string | null;
    /** The list of recordings heard changed (the Sounds panel's credits). */
    onSoundCredits?: () => void;
};

/** A camera view: what it looks at, how far, the angle from straight down, and the bearing (radians). */
export type ArkCameraView = {target: {x: number; y: number; z: number}; distance: number; polar: number; azimuth: number};

/** Where an animal is drawn now (its middle), the ground under it, its length and height, whether it is awake, and its heading. */
export type ArkLocated = {x: number; y: number; z: number; ground: number; length: number; height: number; awake: boolean; /** Which way it faces (radians about up; 0 = +z). */ yaw: number};

/** A replay running (`play`): skip it to jump to the Ark as it is now. */
export type ArkReplayRun = {skip: () => void; done: Promise<void>};

/** The chat's animal shown in the Ark while none of its kind is aboard: never counted, only in a panel beside its chat. */
export type ArkVisitor = {slug: string; name: string; /** Its label in the scene, e.g. "Visiting: not aboard yet". */ label: string};

/** Who is talking: the animal's id (an aboard animal's, or the visitor's), its model slug, and whether it is talking now. */
export type ArkTalking = {slug: string; animalId: string | null; active: boolean};

export type ArkSceneHandle = ArkRuntimeHandle & {
    /** A newer snapshot: animals not seen before come aboard with an entrance. */
    update: (snapshot: ArkSnapshot) => void;
    setMineOnly: (mineOnly: boolean) => void;
    /** Select (and fly to) an animal, or clear the selection; `closeUp` comes face to face with it (the chat's panel). */
    select: (id: string | null, closeUp?: boolean) => void;
    /**
     * Pixels at the foot of the view covered by the page (a tap band): the
     * view's middle moves up by half of it, so what the camera looks at
     * stays in sight above the band. 0 gives the whole view back.
     */
    setViewInset: (bottomPixels: number) => void;
    /**
     * Show the chat's animal as a visitor at the landing (or none). Returns
     * the visitor's id, which `select` and `setTalking` take.
     */
    setVisitor: (visitor: ArkVisitor | null) => string | null;
    /**
     * An animal starts or stops talking: while active its full talking model
     * stands in for it, its mouth moved by `talkText` or `talkPulse`; it goes
     * back to the light model a moment after it stops.
     */
    setTalking: (talking: ArkTalking | null) => void;
    /** More of the reply as it is typed: the mouth says it syllable by syllable. */
    talkText: (chunk: string) => void;
    /** The reply heard aloud: how loud it is now (0…1), as the voice call's meter. */
    talkPulse: (level: number) => void;
    /** Select a herd (A14): fly to it and show its count (or clear with null). Returns false when the species isn't a herd. */
    selectHerd: (key: string | null) => boolean;
    /** The lighter view: true on, false off, null decided by the device. */
    setLite: (lite: boolean | null) => void;
    /** The scenery's extra detail (`ArkSceneOptions.props`) on or off. */
    setProps: (on: boolean) => void;
    /** Reduced motion turned on or off (prefers-reduced-motion changed): no flights, no idles, everything still. */
    setReducedMotion: (reduced: boolean) => void;
    /** Fly to a region, or back to the whole world with null. */
    focusRegion: (region: ArkRegion | null) => void;
    /** The camera follows this animal until any drag (or null to stop). */
    follow: (id: string | null) => void;
    /**
     * Pin the weather and tide (sea level in m; wetness, snow, wind, storm 0–1; windDirection radians), or follow the
     * island clock with null. Any field left out keeps following the clock. `rain` (0–1, falling now): coats soak in it
     * (the animal-look pass) and animals shelter from it (liveliness); a pinned `wetness` without it means no rain.
     */
    setEnvironment: (environment: Partial<{seaLevel: number; wetness: number; snow: number; wind: number; storm: number; windDirection: number; cloud: number; /** Rain falling, 0–1 (animals shelter above 0.45). */ rain: number; fog: number}> | null) => void;
    /**
     * Sound on or off (liveliness wiring, `ark-audio.ts`). Call it only from the viewer's tap (the handler itself):
     * the audio is made there and nowhere else, so nothing sounds before a tap, on the web or in the apps.
     * False when the device has no WebAudio.
     */
    setSound: (on: boolean) => boolean;
    /** Whether sound is on now, whether it has been unlocked by a tap, and every recording heard in this visit (the Sounds panel). */
    sound: () => {on: boolean; unlocked: boolean; credits: Array<{text: string; page: string | null; license: string}>};
    setSoundVolume: (volume: number) => void;
    /** Pin the hour (0–24), or back to the island's shared clock with null. */
    /** Development: run the world's time this many times faster (a day-night recording); 1 for the clock. */
    setClockScale: (scale: number, atMs?: number) => void;
    setHours: (hours: number | null) => void;
    /**
     * The animal-look pass on or off (off: every animal exactly as before). `islandMs` pins the island time its
     * swims are timed by (who is wet from a swim), or follows the clock again with null.
     */
    setAnimalLook: (on: boolean, pin?: {islandMs?: number | null}) => void;
    /**
     * Act out what the server says happened ("while you were away"): each act
     * in turn, at speed, from the Ark as it is now (who arrived is held back
     * until its act, who was eaten or died stands in until then). Never
     * decides anything: the acts come from the event log.
     */
    play: (acts: ArkAct[], callbacks?: {onAct?: (index: number) => void}) => ArkReplayRun;
    stats: () => ArkSceneStats;
    // The recorder's camera (`?record=1`, src/ark-scene/director.ts); harmless elsewhere.
    /** The camera's view now. */
    view: () => ArkCameraView;
    /** The whole world in view, as the page opens on it. */
    homeView: () => ArkCameraView;
    /** Put the camera exactly there now (any flight is dropped). */
    setView: (view: ArkCameraView) => void;
    /** Where an animal (or a replay's stand-in) is now; null when it is not in the scene. */
    locate: (id: string) => ArkLocated | null;
    /** What an animal is doing now (the state its animation, tap card and follow mode share); null when it is not in the scene. */
    behaviour: (id: string) => ArkBehaviourState | null;
    /** How an animal is resting now (`sleep.ts` restStatus); null up and about, or not in the scene. */
    rest: (id: string) => ArkRestStatus | null;
    /** What the local reactive layer has an animal doing this frame (its action, head look, offset, alarm); null outside its budget. */
    reactive: (id: string) => ArkReactiveSnapshot | null;
    /** The reactive layer's cost and counts on the last frame (for the perf report and the audit lane). */
    reactiveStats: () => ArkReactiveStats;
    /** The ground's height at a point (never below the sea). */
    heightAt: (x: number, z: number) => number;
    /** Ask for these species' models, near and far (resolves once asked; `loading` says when they are in). */
    preload: (slugs: string[]) => Promise<void>;
    /** True while any model is still loading. */
    loading: () => boolean;
    /** Keep an animal out of sight until `arrive` (the recorder's new arrival). */
    hold: (id: string) => void;
    /** A held animal comes aboard now, with the entrance it has in a replay. */
    arrive: (id: string) => void;
    /**
     * A cross-layer moment (`moments.ts`: a seabird's dive, a whale surfacing,
     * an owl's swoop, a primate dropping to the ground), cosmetic only, by
     * this animal or the first that can: returns who acts it out, or null.
     */
    moment: (kind: ArkMomentKind, id?: string | null) => string | null;
    /** Open the ground's cutaway (true), close it (false), or (null) open it when an underground animal is looked at. */
    setCutaway: (open: boolean | null) => void;
    dispose: () => void;
};

/** One animal's reactive state, as the page and the audit lane read it (`reactive.ts` ReactiveOut). */
export type ArkReactiveSnapshot = {action: string; headYaw: number; headPitch: number; headWeight: number; dx: number; dz: number; bodyYaw: number; crouch: number; called: boolean; alarmed: number; looking: string | null};
export type ArkReactiveStats = {tier: string; agents: number; inputs: number; perceptions: number; sightChecks: number; alarms: number; ms: number};
