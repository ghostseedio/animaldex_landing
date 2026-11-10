/**
 * Each zone's colours, from its talking-model background
 * (`~/animaldex-talking-models/backgrounds/<zone>.jpg`).
 *
 * `scripts/sample-ark-palettes.mjs` sampled the photographs once (the
 * `sampled` comments: sky = top quarter, ground = bottom third). Photographs
 * are lit, hazy and shot into the sun, so their means are darker and muddier
 * than a surface's own colour: the values below keep each one's hue and are
 * lifted by hand to read as albedo under the scene's warm light. The images
 * themselves never enter the repo.
 */

export type ZonePalette = {
    /** The ground's two tones, mixed by noise. */
    ground: readonly [string, string];
    /** Trees, reeds, coral: what grows there. */
    growth: readonly [string, string];
    /** The sky in that photograph (sky, mid band), used for the haze mix. */
    sky: string;
};

export const ZONE_PALETTES = {
    // sampled sky #86aec7 ground #a79d96 accent #50717e
    coral_reef: {ground: ["#d8c7a6", "#c9b08e"], growth: ["#e07f6c", "#d9a35b"], sky: "#86aec7"},
    // sampled sky #1681b5 mid #015a92 ground #02506a
    open_ocean: {ground: ["#2d5d74", "#244b60"], growth: ["#3f7d7a", "#2f6a6a"], sky: "#1681b5"},
    // sampled sky #c6baab mid #898172 ground #4b4639
    seashore: {ground: ["#cdb990", "#bba67f"], growth: ["#77705f", "#8a826f"], sky: "#c6baab"},
    // sampled sky #b1a591 mid #7f8079 ground #382e26
    river_lake: {ground: ["#8d8a5c", "#7c7550"], growth: ["#6f7a3e", "#8a8a4a"], sky: "#b1a591"},
    // sampled sky #e5d0bb mid #af977a ground #796854
    wetland: {ground: ["#8f8a5c", "#7b7452"], growth: ["#b0a167", "#8f8a4c"], sky: "#e5d0bb"},
    // sampled sky #747357 mid #3f3e28 ground #3d3427
    rainforest: {ground: ["#4f6a32", "#435c2b"], growth: ["#3a5a2a", "#2f4c25"], sky: "#747357"},
    // sampled sky #9b8160 mid #615032 ground #413321 accent #4e471c
    woodland: {ground: ["#76703f", "#6a6236"], growth: ["#6b7a38", "#b07a3c"], sky: "#9b8160"},
    // sampled sky #e3b688 mid #a16e39 ground #5f3e1c
    grassland: {ground: ["#ccaa62", "#bf9a55"], growth: ["#6b7036", "#7f7a3e"], sky: "#e3b688"},
    // sampled sky #c8aa91 mid #b07446 ground #8d5833
    desert: {ground: ["#ddb07a", "#d39f68"], growth: ["#a77e56", "#8e6a48"], sky: "#c8aa91"},
    // sampled sky #c8c7c2 mid #797564 ground #6b614b
    mountains: {ground: ["#8d8a6a", "#7f7a62"], growth: ["#4c5e37", "#5a6a40"], sky: "#c8c7c2"},
    // sampled sky #bbc7cb mid #9da6ad ground #878c97
    polar: {ground: ["#eef2f4", "#dfe7ec"], growth: ["#d4e2ea", "#c6d6e0"], sky: "#bbc7cb"},
    // sampled sky #c6c7b7 mid #988b5a ground #646238 accent #524c25
    farm_garden: {ground: ["#89a24f", "#7c9447"], growth: ["#5f7d3a", "#6e8a40"], sky: "#c6c7b7"}
} as const satisfies Record<string, ZonePalette>;

/** Fields in the Home region, one per patch. */
export const FIELD_TONES = ["#93a35e", "#bba872", "#7d9150", "#ac9a68", "#879c5c"] as const;

/** Bare rock on steep ground, snow up high, wet sand at the waterline. */
export const ROCK = "#857c6c";
export const SNOW = "#f1f4f5";
export const WET_SAND = "#b7a586";

/** One sky for the whole world: the warm, hazy light the backgrounds share. */
export const SKY = {
    zenith: "#a7bccb",
    horizon: "#ecdcc4",
    sun: "#ffe4bd",
    /** The hemisphere light's ground bounce. */
    bounce: "#7d6e52"
} as const;

/** Water: deep sea, the reef's shallows, the lake. */
export const WATER = {
    deep: "#123f63",
    open: "#1f6a8e",
    reef: "#2fb2b5",
    shallow: "#58c9bf",
    lake: "#3f7d76"
} as const;
