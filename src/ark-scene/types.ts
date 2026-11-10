import type {ArkActivity} from "@/lib/ark-daylight";
import type {ArkAct} from "@/lib/ark-life";
import type {ArkStats} from "@/ark-scene/stats";

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
    model_slug: string;
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

export type ArkSnapshot = {
    voyage: {slug: string; name: string; started_at: string | null};
    counts: {animals: number; species: number; founders: number};
    zones: Array<{key: ArkZone; animals: number}>;
    animals: ArkAnimal[];
    as_of: string | null;
    /** The Ark's own day (v2's `voyage.ark_day`): 1 Ark year = 14 real days, counted by the server. */
    ark_day?: number | null;
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
};

export type ArkSceneOptions = {
    snapshot: ArkSnapshot;
    /** The ark model set's folder: `<modelBase>/manifest.json`, `<modelBase>/<slug>/<version>.near.glb`. */
    modelBase: string;
    /** The species icon art (the `animals` bucket's `<slug>.webp`). */
    iconUrl: (slug: string) => string;
    onSelect?: (animal: ArkAnimal | null) => void;
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
    /** The camera stopped following (a drag, or the animal left). */
    onFollowEnd?: () => void;
};

/** A replay running (`play`): skip it to jump to the Ark as it is now. */
export type ArkReplayRun = {skip: () => void; done: Promise<void>};

/** The chat's animal shown in the Ark while none of its kind is aboard: never counted, only in a panel beside its chat. */
export type ArkVisitor = {slug: string; name: string; /** Its label in the scene, e.g. "Visiting: not aboard yet". */ label: string};

/** Who is talking: the animal's id (an aboard animal's, or the visitor's), its model slug, and whether it is talking now. */
export type ArkTalking = {slug: string; animalId: string | null; active: boolean};

export type ArkSceneHandle = {
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
    /** Fly to a region, or back to the whole world with null. */
    focusRegion: (region: ArkRegion | null) => void;
    /** The camera follows this animal until any drag (or null to stop). */
    follow: (id: string | null) => void;
    /** Pin the hour (0–24), or back to the viewer's clock with null. */
    setHours: (hours: number | null) => void;
    /**
     * Act out what the server says happened ("while you were away"): each act
     * in turn, at speed, from the Ark as it is now (who arrived is held back
     * until its act, who was eaten or died stands in until then). Never
     * decides anything: the acts come from the event log.
     */
    play: (acts: ArkAct[], callbacks?: {onAct?: (index: number) => void}) => ArkReplayRun;
    stats: () => ArkSceneStats;
    dispose: () => void;
};
