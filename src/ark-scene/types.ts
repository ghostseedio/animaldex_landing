/**
 * The shared Ark's data, as `voyage_public_v1` returns it (Ark v1 contract,
 * section 2), and the scene's interface (section 5).
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
};

export type ArkSnapshot = {
    voyage: {slug: string; name: string; started_at: string | null};
    counts: {animals: number; species: number; founders: number};
    zones: Array<{key: ArkZone; animals: number}>;
    animals: ArkAnimal[];
    as_of: string | null;
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
};

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
    stats: () => ArkSceneStats;
    dispose: () => void;
};
