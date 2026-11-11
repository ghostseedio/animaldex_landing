/**
 * What nest a bird builds and where (docs/ark/props.md, "Nests by species"):
 * the form, the site, how big it is against the bird, how many make a
 * colony, how long it takes to build, and what lines it. A weaver's woven
 * purse hangs from a twig tip; an eagle's eyrie is two metres of sticks on a
 * ledge; a guillemot keeps no nest at all, only its egg on bare rock.
 *
 * Read from the species' slug's head noun (and a few whole slugs), like
 * `presence.ts`. Pure and deterministic.
 */

import type {ArkAnimal, ArkZone} from "@/ark-scene/types";

/** The nest's shape. */
export const NEST_FORMS = [
    "cup", // a woven cup of twigs and grass, lined soft (songbirds)
    "platform", // a flat stack of sticks, a shallow cup on top (herons, hawks, crows, pigeons)
    "eyrie", // a deep heap of big sticks added to every year (eagles, ospreys, storks)
    "scrape", // a hollow in the ground or on a ledge, a few pebbles or shells round it (gulls, plovers, falcons, ostriches)
    "down_bowl", // a grass bowl lined with the bird's own down (ducks, geese, gamebirds)
    "mud_cup", // a half cup of mud pellets against a wall (swallows); `closed` for a martin's
    "ball", // a loose ball of grass with a side entrance (sparrows)
    "dome", // a domed nest of sticks or moss with a side entrance (wrens, magpies, hammerkops)
    "pendant", // a woven purse hanging from a twig tip, its entrance below (weavers, orioles, sunbirds)
    "floating", // a raft of wet water weed at the margin (grebes, coots, loons)
    "mound", // a heap of reeds (swans, cranes) or a mud cone (flamingos)
    "pebbles", // a ring of stones (Adélie and gentoo penguins)
    "megapode", // a heap of rotting leaf litter metres across (megapodes)
    "hole", // a hole in a trunk (woodpeckers, parrots, owls)
    "burrow", // a tunnel in a bank or turf (kingfishers, bee-eaters, puffins)
    "barn", // the barn's gable (barn owls)
    "none" // no nest: brood parasites, the emperor's egg on its feet
] as const;
export type NestForm = typeof NEST_FORMS[number];

/** Where it goes (each found through the scenery interface, `props/sampler.ts`). */
export type NestSite = "tree_fork" | "tree_top" | "branch_tip" | "trunk_hole" | "cliff_ledge" | "ground" | "shore" | "water_margin" | "eaves" | "barn" | "bank" | "none";

export type NestProfile = {
    form: NestForm;
    site: NestSite;
    /** Across the nest, as a multiple of the bird's drawn length (`sizes.ts`), so the sitter fits it. */
    across: number;
    /** Nests of the species built close together (one is the sitter's). */
    colony: number;
    /** Ark days from the first stick to finished. */
    buildDays: number;
    /** Built on year after year (eyries): what is left of last year's when building starts. */
    carriedOver: number;
    /** What lines the cup. */
    lining: "grass" | "down" | "moss" | "mud" | "leaves" | "feathers" | "none";
    /** A martin's cup closed to a small hole. */
    closed?: boolean;
};

const P = (form: NestForm, site: NestSite, across: number, buildDays: number, lining: NestProfile["lining"], extra: Partial<NestProfile> = {}): NestProfile => ({
    form,
    site,
    across,
    colony: 1,
    buildDays,
    carriedOver: 0,
    lining,
    ...extra
});

/** Whole slugs first (exceptions to their head noun). */
const BY_SLUG: Array<[RegExp, NestProfile]> = [
    [/(emperor|king)-penguin/, P("none", "none", 0, 0, "none")],
    [/(adelie|gentoo|chinstrap)-penguin/, P("pebbles", "ground", 1.1, 3, "none", {colony: 5})],
    [/penguin/, P("burrow", "bank", 0.8, 3, "none", {colony: 2})],
    [/barn-owl/, P("barn", "barn", 0.6, 0, "none")],
    [/snowy-owl/, P("scrape", "ground", 0.9, 1, "feathers")],
    [/burrowing-owl/, P("burrow", "bank", 0.7, 2, "none")],
    [/(eagle-owl|great-horned-owl)/, P("scrape", "cliff_ledge", 1.0, 1, "none")],
    [/(bald-eagle|african-fish-eagle|white-tailed-eagle|harpy-eagle|sea-eagle|fish-eagle)/, P("eyrie", "tree_top", 1.9, 10, "leaves", {carriedOver: 0.65})],
    [/(peregrine|falcon|kestrel|condor)/, P("scrape", "cliff_ledge", 0.9, 0.5, "none")],
    [/(white-stork|black-stork|stork)/, P("eyrie", "tree_top", 1.5, 8, "grass", {carriedOver: 0.6})],
    [/sociable-weaver/, P("dome", "tree_top", 3.2, 20, "grass", {carriedOver: 0.8})],
    [/(house-martin|cliff-swallow)/, P("mud_cup", "eaves", 0.75, 7, "feathers", {closed: true, colony: 3})],
    [/(sand-martin|bank-swallow)/, P("burrow", "bank", 0.55, 4, "none", {colony: 5})],
    [/(long-tailed-tit|penduline)/, P("dome", "tree_fork", 0.9, 12, "feathers")],
    [/(magpie|hammerkop|hamerkop)/, P("dome", "tree_top", 1.4, 10, "mud")],
    [/(mute-swan|whooper-swan|trumpeter-swan|black-swan|swan)/, P("mound", "water_margin", 1.1, 6, "down")],
    [/(rook)$/, P("platform", "tree_top", 0.9, 6, "grass", {colony: 4})],
    [/(brush-turkey|malleefowl|megapode|scrubfowl)/, P("megapode", "ground", 4.5, 30, "none", {carriedOver: 0.7})],
    [/(guillemot|murre|razorbill)/, P("scrape", "cliff_ledge", 0.6, 0.2, "none", {colony: 4})],
    [/(northern-gannet|gannet|booby)/, P("mound", "cliff_ledge", 1.0, 5, "grass", {colony: 5})],
    [/kittiwake/, P("cup", "cliff_ledge", 0.9, 6, "grass", {colony: 4})],
    [/albatross/, P("mound", "ground", 1.0, 6, "grass")],
    [/flamingo/, P("mound", "shore", 0.9, 6, "mud", {colony: 6})],
    [/(cuckoo|cowbird|honeyguide|whydah|indigobird)/, P("none", "none", 0, 0, "none")]
];

/** By head noun. */
const BY_NOUN: Array<[RegExp, NestProfile]> = [
    [/^(weaver|oriole|sunbird|oropendola|cacique)$/, P("pendant", "branch_tip", 1.15, 5, "grass", {colony: 4})],
    [/^(eagle|osprey|vulture)$/, P("eyrie", "cliff_ledge", 1.9, 10, "leaves", {carriedOver: 0.65})],
    [/^(hawk|buzzard|kite|goshawk|sparrowhawk|harrier|secretarybird)$/, P("platform", "tree_top", 1.15, 6, "leaves")],
    [/^(heron|egret|spoonbill|ibis|cormorant|shag|anhinga|darter|pelican|hoatzin)$/, P("platform", "tree_top", 1.0, 5, "grass", {colony: 3})],
    [/^(crow|raven|jay|jackdaw)$/, P("platform", "tree_top", 0.95, 6, "grass")],
    [/^(pigeon|dove)$/, P("platform", "tree_fork", 0.8, 3, "none")],
    [/^(owl)$/, P("hole", "trunk_hole", 0.7, 0, "none")],
    [/^(macaw|parrot|woodpecker|toucan|hornbill|tit|chickadee|nuthatch|cockatoo|lorikeet|parakeet|budgerigar|hoopoe|roller|trogon|quetzal|starling|barbet|flicker|treecreeper)$/, P("hole", "trunk_hole", 0.7, 0, "none")],
    [/^(kingfisher|bee-eater|motmot|puffin|shearwater|petrel|kiwi)$/, P("burrow", "bank", 0.7, 4, "none")],
    [/^(swallow)$/, P("mud_cup", "eaves", 0.8, 6, "feathers")],
    [/^(martin|swift)$/, P("mud_cup", "eaves", 0.75, 7, "feathers", {closed: true})],
    [/^(sparrow|wagtail)$/, P("ball", "eaves", 0.95, 4, "feathers")],
    [/^(wren|dipper)$/, P("dome", "tree_fork", 1.0, 5, "moss")],
    [/^(hummingbird)$/, P("cup", "tree_fork", 0.55, 6, "moss")],
    [/^(robin|finch|thrush|blackbird|warbler|cardinal|tanager|bunting|shrike|honeyeater|drongo|flycatcher|bulbul|white-eye|tailorbird|vireo|grosbeak|goldfinch|chaffinch|bluebird|mockingbird|catbird|waxwing|kinglet|redstart|nightingale|bowerbird|lyrebird|manakin|cotinga|babbler|myna|grackle|bunting)$/, P("cup", "tree_fork", 0.75, 4, "moss")],
    [/^(mallard|duck|teal|wigeon|pintail|eider|merganser|goose|shelduck)$/, P("down_bowl", "ground", 0.95, 2, "down")],
    [/^(pheasant|grouse|quail|partridge|peacock|peafowl|turkey|guineafowl|ptarmigan|capercaillie|bustard|tinamou)$/, P("down_bowl", "ground", 0.85, 1.5, "leaves")],
    [/^(hen|chicken|rooster|junglefowl)$/, P("down_bowl", "ground", 0.9, 1.5, "grass")],
    [/^(ostrich|emu|rhea|cassowary)$/, P("scrape", "ground", 1.0, 1, "leaves")],
    [/^(gull|tern|skimmer|plover|lapwing|sandpiper|oystercatcher|avocet|stilt|curlew|godwit|snipe|woodcock|killdeer|dotterel|turnstone|skua|lark|skylark|pipit|nightjar|courser|pratincole)$/, P("scrape", "shore", 0.75, 1, "grass")],
    [/^(grebe|coot|moorhen|loon|diver|jacana|gallinule)$/, P("floating", "water_margin", 1.0, 3, "grass")],
    [/^(crane|bittern|rail)$/, P("mound", "water_margin", 0.9, 4, "grass")],
    [/^(frigatebird|tropicbird|fulmar)$/, P("scrape", "cliff_ledge", 0.8, 1, "grass")],
    [/^(cassowary)$/, P("scrape", "ground", 1.0, 1, "leaves")]
];

/** What the zone suggests for a bird the lists do not know. */
function byZone(zone: ArkZone): NestProfile {
    switch (zone) {
        case "mountains":
        case "polar":
            return P("scrape", "cliff_ledge", 0.8, 1, "grass");
        case "seashore":
            return P("scrape", "shore", 0.75, 1, "grass");
        case "river_lake":
        case "wetland":
            return P("down_bowl", "ground", 0.9, 2, "grass");
        case "grassland":
        case "desert":
            return P("scrape", "ground", 0.8, 1, "grass");
        case "farm_garden":
            return P("cup", "tree_fork", 0.75, 4, "moss");
        default:
            return P("cup", "tree_fork", 0.75, 4, "moss");
    }
}

function lastWord(slug: string): string {
    const words = slug.toLowerCase().split(/[\s-]+/).filter(Boolean);
    const pair = words.slice(-2).join("-");
    if (pair === "bee-eater" || pair === "white-eye") return pair;
    return words[words.length - 1] ?? "";
}

/** The nest of a bird species: by its slug, then its head noun, then its zone. */
export function nestProfile(animal: Pick<ArkAnimal, "model_slug" | "name" | "zone">): NestProfile {
    const slug = animal.model_slug.toLowerCase();
    for (const [pattern, profile] of BY_SLUG) if (pattern.test(slug)) return profile;
    const nouns = [lastWord(slug), lastWord(animal.name ?? "")];
    for (const noun of nouns) for (const [pattern, profile] of BY_NOUN) if (pattern.test(noun)) return profile;
    return byZone(animal.zone);
}

/** The nest's radius in metres for a bird drawn `drawn` metres long. */
export function nestRadius(profile: NestProfile, drawn: number): number {
    return Math.max(0.06, (profile.across * drawn) / 2);
}

/** An egg's length for a bird drawn `drawn` metres long (an egg is about a tenth of its layer). */
export function eggLength(drawn: number): number {
    return Math.min(Math.max(0.11 * drawn, 0.035), 0.2);
}

/** An egg's ground colour and how spotted it is, by the nest's form and the bird. */
export function eggLook(slug: string, profile: NestProfile): {hue: number; saturation: number; lightness: number; spots: number} {
    if (/(heron|egret|thrush|robin|starling|blackbird|dunnock)/.test(slug)) return {hue: 0.5, saturation: 0.32, lightness: 0.78, spots: /thrush|blackbird/.test(slug) ? 0.4 : 0};
    if (/(mallard|duck|teal|goose|swan|grebe|coot)/.test(slug)) return {hue: 0.2, saturation: 0.18, lightness: 0.8, spots: 0};
    if (/(eagle|hawk|buzzard|kite|osprey|falcon|kestrel)/.test(slug)) return {hue: 0.08, saturation: 0.3, lightness: 0.8, spots: 0.7};
    if (profile.form === "scrape" || profile.form === "pebbles") return {hue: 0.12, saturation: 0.3, lightness: 0.62, spots: 0.9};
    if (profile.form === "hole" || profile.form === "burrow" || profile.form === "barn") return {hue: 0.1, saturation: 0.05, lightness: 0.93, spots: 0};
    if (profile.form === "cup") return {hue: 0.52, saturation: 0.25, lightness: 0.8, spots: 0.5};
    return {hue: 0.1, saturation: 0.15, lightness: 0.86, spots: 0.25};
}
