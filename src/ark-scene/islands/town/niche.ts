/**
 * Where town wildlife lives on the town island, by kind and zone (islands plan Appendix A and §7.1): the spots' kinds
 * (`SpotWhere`), the habitats by zone, and an urban species' niche. Pure and light (no plan): the page's population
 * panel groups the town's wildlife by it, and `areas.ts` places them by it.
 */

export type SpotWhere =
    // Homes
    | "lawn" | "yard" | "balcony" | "courtyard" | "window"
    // Farms
    | "paddock" | "farmyard" | "run"
    // Town wildlife
    | "garden" | "park" | "allotment" | "churchyard" | "wood" | "wild_corner" | "hedgerow" | "field_margin" | "canal" | "millpond" | "farm_pond" | "beach"
    // Urban
    | "roof" | "eave" | "ledge" | "tall" | "belfry" | "bin" | "drain" | "quay" | "square" | "lamp_wall"
    // Zoo
    | "enclosure" | "pool" | "indoor";

/**
 * The town's habitat for a wild species by its zone (islands plan §7.1, for encounter hunting's per-island slot atlas
 * and the urban rule's wildlife): where its spots are on the town island.
 */
export const TOWN_HABITATS_BY_ZONE: Record<string, SpotWhere[]> = {
    farm_garden: ["garden", "park", "allotment", "hedgerow", "wild_corner"],
    woodland: ["park", "churchyard", "wood"],
    rainforest: ["park", "churchyard", "wood"],
    river_lake: ["canal", "millpond", "farm_pond"],
    wetland: ["canal", "millpond", "farm_pond"],
    seashore: ["roof", "quay", "beach"],
    coral_reef: ["quay"],
    open_ocean: ["quay"],
    grassland: ["park", "field_margin", "garden"],
    desert: ["field_margin", "wild_corner"],
    mountains: ["tall", "roof", "ledge"],
    polar: ["quay"]
};

/**
 * An urban species' niche by its kind (the plan's Appendix A list; peregrines on tall buildings, rats at bins and
 * drains, gulls on roofs and the quay…). Matched on the model slug's words; anything else falls back to its zone.
 */
export function urbanNiche(slug: string, zone: string): SpotWhere[] {
    const s = slug.toLowerCase();
    if (/peregrine/.test(s)) return ["tall", "ledge"];
    if (/kestrel|hawk|sparrowhawk|vulture/.test(s)) return ["tall", "roof", "park"];
    if (/owl/.test(s)) return ["churchyard", "belfry", "wood"];
    if (/rat\b|-rat|mouse/.test(s)) return ["bin", "drain", "canal"];
    if (/bat\b|pipistrelle|-bat/.test(s)) return ["belfry", "eave"];
    if (/gull/.test(s)) return ["roof", "quay"];
    if (/pigeon|dove/.test(s)) return ["square", "roof", "ledge"];
    if (/sparrow|swallow|swift|martin|hornero|wren|phoebe|kiskadee|sunbird/.test(s)) return ["eave", "garden", "roof"];
    if (/magpie|crow|raven|jackdaw|rook/.test(s)) return ["roof", "tall", "park"];
    if (/gecko|lizard|skink/.test(s)) return ["lamp_wall", "garden"];
    if (/duck|mallard|goose|wagtail|tyrant|heron/.test(s)) return ["canal", "millpond"];
    if (/monitor/.test(s)) return ["canal", "millpond"];
    if (/squirrel|raccoon|civet|macaque|fox/.test(s)) return ["park", "garden", "bin"];
    if (/deer|cottontail|groundhog|rabbit/.test(s)) return ["park", "field_margin", "garden"];
    if (/galah|cockatoo|parrot/.test(s)) return ["park", "roof"];
    if (/moth|hornet|wasp|yellowjacket|spider|combfoot|snail|fly/.test(s)) return ["lamp_wall", "eave", "garden"];
    return TOWN_HABITATS_BY_ZONE[zone] ?? ["park"];
}
