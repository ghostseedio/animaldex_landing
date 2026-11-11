/**
 * The Ark map's vocabulary (docs/ark/map-plan.md, B3): the 57 microhabitat
 * types of the B1 inventory (`map-inventory.md`) as spawn tags, the 17 areas
 * of the plan's section 3 that hold them, and the kinds of movement and
 * attachment a species can have. Shared by the generator
 * (`scripts/ark-map.mts`) and the scene, so the two never disagree.
 */

/** The inventory's types, in its order. A species' spawn tag is one of these. */
export const MAP_TAGS = [
    "rocky_shore", "sandy_beach", "mudflat", "mangrove", "estuary", "coastal_shallows", "coral_reef", "kelp", "seagrass", "seabed",
    "open_ocean", "sea_surface", "deep_water", "sea_cliffs", "sea_ice", "tundra", "snow_ice", "pond", "stream_river", "lake",
    "marsh_reeds", "waterfall_rapids", "salt_lake", "grassland", "flower_meadow", "scrub", "forest_general", "forest_floor", "logs_deadwood", "trunks_bark",
    "canopy", "bamboo", "leaves", "soil", "burrows", "termite_ant_mounds", "rocks_boulders", "caves", "cliffs", "desert_sand",
    "mountain_alpine", "open_sky", "house", "garden", "town_park", "compost", "farm_barn", "garden_pond", "on_grazers", "attached_to_large",
    "cleaner_station", "anemone", "on_hosts", "host_nests", "dung", "carcass"
] as const;
export type MapTag = typeof MAP_TAGS[number];

/** The plan's areas (section 3), in its table's order. */
export const MAP_AREAS = [
    "open_water", "reef", "shallows", "rocky_shore", "beach", "estuary", "cold_cove", "river", "lake_marsh", "grassland",
    "scrub", "canopy", "forest_floor", "underground", "desert", "mountain", "homestead"
] as const;
export type MapArea = typeof MAP_AREAS[number];

/** Which area holds each tag (the plan's table). `forest_general` never spawns: the inventory resolved it to canopy or floor. */
export const TAG_AREA: Record<MapTag, MapArea> = {
    open_ocean: "open_water", sea_surface: "open_water", deep_water: "open_water", attached_to_large: "open_water",
    coral_reef: "reef", cleaner_station: "reef", anemone: "reef", seagrass: "reef",
    coastal_shallows: "shallows", seabed: "shallows",
    rocky_shore: "rocky_shore", sea_cliffs: "rocky_shore", kelp: "rocky_shore",
    sandy_beach: "beach",
    estuary: "estuary", mangrove: "estuary", mudflat: "estuary", salt_lake: "estuary",
    sea_ice: "cold_cove", tundra: "cold_cove",
    stream_river: "river", waterfall_rapids: "river",
    lake: "lake_marsh", marsh_reeds: "lake_marsh", pond: "lake_marsh",
    grassland: "grassland", flower_meadow: "grassland", on_grazers: "grassland", dung: "grassland", termite_ant_mounds: "grassland",
    scrub: "scrub",
    canopy: "canopy", trunks_bark: "canopy", bamboo: "canopy", leaves: "canopy", host_nests: "canopy", open_sky: "canopy",
    forest_floor: "forest_floor", logs_deadwood: "forest_floor", carcass: "forest_floor", forest_general: "forest_floor",
    soil: "underground", burrows: "underground",
    desert_sand: "desert",
    mountain_alpine: "mountain", rocks_boulders: "mountain", cliffs: "mountain", caves: "mountain", snow_ice: "mountain",
    house: "homestead", garden: "homestead", garden_pond: "homestead", compost: "homestead", farm_barn: "homestead", town_park: "homestead", on_hosts: "homestead"
};

/** The sea's tags (marine): a swimmer here loops in the sea, never on land. */
export const SEA_TAGS: ReadonlySet<MapTag> = new Set<MapTag>([
    "open_ocean", "sea_surface", "deep_water", "attached_to_large", "coral_reef", "cleaner_station", "anemone", "seagrass", "coastal_shallows", "seabed", "kelp", "sea_ice"
]);

/** Fresh and brackish water: a fish here swims in the river, the lake, the pools or the creeks. */
export const FRESH_TAGS: ReadonlySet<MapTag> = new Set<MapTag>(["pond", "stream_river", "lake", "marsh_reeds", "waterfall_rapids", "garden_pond", "estuary", "mangrove", "salt_lake"]);

/**
 * How a species moves (B3 "movement types"), from its rig body plan, its
 * layer's mode and its taxonomy: walk, fly (perches and flies loops), swim,
 * crawl (insects, spiders, snails, crabs on their surface), slither, climb,
 * leap and hang (the canopy's), perch (sits on a limb or a ledge), burrow,
 * hop (frogs), drift (jellyfish and the sea surface's sailors), fixed
 * (corals, anemones, sponges, barnacles, mussels: never moves).
 */
export const MAP_MOVES = ["walk", "fly", "swim", "crawl", "slither", "climb", "leap", "hang", "perch", "burrow", "hop", "drift", "fixed"] as const;
export type MapMove = typeof MAP_MOVES[number];

/**
 * What it stands on or holds to (B3 "attachment types"): the ground; in the
 * water's column; on the sea floor; floating at the surface; fixed to rock
 * or coral; a canopy limb; a trunk's bark; the cottage's wall; a flower; a
 * stone; the leaf litter; in a burrow; on a floe; a cliff's ledge; the air.
 * And the partners' (section 6): riding a host's back, at a host's feet, in
 * the anemone, at the cleaning station, near a parasite's host, and a
 * colony's nest.
 */
export const MAP_ATTACHMENTS = [
    "ground", "water", "floor", "surface", "fixed", "limb", "trunk", "wall", "flower", "rock", "litter", "burrow", "ice", "ledge", "air",
    "ride", "beside", "anemone", "station", "host", "nest"
] as const;
export type MapAttachment = typeof MAP_ATTACHMENTS[number];

/**
 * The partner roles (section 6), each from a stored phrase: a rider (the
 * oxpecker on a grazer's back, the remora under a shark), one that walks at
 * a grazer's feet (egrets, drongos, wagtails), the anemone's fish, the
 * cleaners at their station and the clients that visit it by day, a
 * parasite near its host (never harming it), a brood parasite (an egg in a
 * host's nest, a visual only).
 */
export const MAP_ROLES = ["rider", "beside", "anemone", "cleaner", "client", "parasite", "brood"] as const;
export type MapRole = typeof MAP_ROLES[number];

/** The host groups a role names, each a fixed list of species in the generated table. */
export const HOST_GROUPS = ["grazers", "sharks_rays_turtles", "anemone", "station_clients", "horses_tapirs_cattle", "cats_dogs", "birds", "frogs", "fish", "mammals"] as const;
export type HostGroup = typeof HOST_GROUPS[number];
