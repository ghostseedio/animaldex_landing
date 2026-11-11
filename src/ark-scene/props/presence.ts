/**
 * Which homes and structures the Ark shows (the owner's brief, section 5:
 * "shown where the species is present"): a nest, a hive, a mound, a web, a
 * warren, a den, a roost, a beaver's lodge or a slime trail appears only
 * while the Ark holds a species of that kind (its own or its kind's name).
 * Read from the scene's snapshot only; nothing here decides anything.
 *
 * A species' group is read from its slug's head noun (the last word:
 * "asian-honey-bee" is a bee, "honey-badger" a badger), its kind's name, and
 * (for birds) the rig's body plan when the model is in. The map lane's
 * species table (`ark-map`: spawn tags, roosts, colonies) replaces this
 * reading when it lands; the groups stay.
 *
 * Eggs and chicks (A9): eggs only where the server says a clutch is in
 * (`nests` in `voyage_public_v2`, status `egg`); chicks are the species'
 * young born in the last few Ark weeks; an empty nest is shown in the
 * breeding season, or while either is there.
 */

import type {ArkAnimal, ArkNestRow, ArkSnapshot, ArkZone} from "@/ark-scene/types";
import {nestProfile, type NestProfile} from "@/ark-scene/props/nest-kinds";
import {seasonWindow} from "@/ark-scene/props/nest-growth";

export const PROP_GROUPS = [
    "birds",
    "ants",
    "bees",
    "wasps",
    "termites",
    "spiders",
    "moths",
    "rabbits",
    "worms",
    "den",
    "lair",
    "bats",
    "sea_turtles",
    "beavers",
    "snails"
] as const;
export type PropGroup = typeof PROP_GROUPS[number];

const BIRD_NOUNS = new Set([
    "sparrow", "owl", "eagle", "hawk", "heron", "mallard", "duck", "macaw", "parrot", "puffin", "penguin", "swallow", "martin", "swift", "stork", "woodpecker",
    "finch", "robin", "gull", "tern", "pigeon", "dove", "crow", "raven", "magpie", "jay", "kingfisher", "falcon", "kestrel", "kite", "vulture", "condor", "swan",
    "goose", "hen", "chicken", "rooster", "wren", "tit", "chickadee", "warbler", "flamingo", "pelican", "cormorant", "crane", "egret", "ibis", "toucan", "hornbill",
    "weaver", "starling", "thrush", "blackbird", "bunting", "lark", "skylark", "plover", "lapwing", "sandpiper", "ostrich", "emu", "rhea", "quail", "pheasant",
    "grouse", "peacock", "peafowl", "turkey", "cockatoo", "lorikeet", "budgerigar", "parakeet", "hummingbird", "nightjar", "cuckoo", "bee-eater", "roller",
    "hoopoe", "oriole", "tanager", "cardinal", "bluebird", "nuthatch", "treecreeper", "kookaburra", "albatross", "petrel", "shearwater", "gannet", "booby",
    "guillemot", "razorbill", "kittiwake", "fulmar", "auk", "loon", "grebe", "coot", "moorhen", "rail", "bustard", "secretarybird", "osprey", "harrier", "buzzard",
    "goshawk", "sparrowhawk", "shrike", "wagtail", "pipit", "dipper", "kiwi", "cassowary", "hoatzin", "trogon", "quetzal", "motmot", "jacana", "stilt", "avocet",
    "curlew", "godwit", "snipe", "woodcock", "oystercatcher", "spoonbill", "bittern", "frigatebird", "tropicbird", "skua", "honeyeater", "sunbird", "drongo"
]);

/** Head nouns of each structure-making group. */
const GROUP_NOUNS: Array<[PropGroup, RegExp]> = [
    ["ants", /^(ant|ants)$/],
    ["bees", /^(bee|bumblebee|honeybee)$/],
    ["wasps", /^(wasp|hornet|yellowjacket)$/],
    ["termites", /^termite$/],
    ["spiders", /^(spider|tarantula|orbweaver|orb-weaver)$/],
    ["moths", /^(moth|butterfly|swallowtail|admiral|monarch|fritillary|skipper|hairstreak|silkmoth)$/],
    ["rabbits", /^rabbit$/],
    ["worms", /^earthworm$/],
    ["den", /^(fox|wolf|badger|coyote|jackal|hyena|dhole|wolverine|bear|otter)$/],
    ["lair", /^(lion|leopard|tiger|jaguar|cheetah|cougar|puma|lynx|bobcat|caracal|serval|ocelot)$/],
    ["bats", /^(bat|pipistrelle|flying-fox)$/],
    ["beavers", /^beaver$/],
    ["snails", /^(snail|slug)$/]
];

const MARINE_ZONES = new Set<ArkZone>(["coral_reef", "open_ocean"]);

/** The head noun of a slug or a name: its last word ("asian-honey-bee" → "bee"; "Bee-eater" stays one word). */
export function headNoun(text: string): string {
    const words = text.toLowerCase().replace(/[^a-z-\s]/g, "").split(/[\s-]+/).filter(Boolean);
    const last = words[words.length - 1] ?? "";
    // "flying-fox" and "bee-eater" are one word each.
    const pair = words.slice(-2).join("-");
    if (pair === "flying-fox" || pair === "bee-eater" || pair === "orb-weaver") return pair;
    return last;
}

/** The groups a species of the Ark makes structures for (`plan` is the rig's body plan, when the model is in). */
export function speciesGroups(animal: Pick<ArkAnimal, "model_slug" | "name" | "zone" | "kind_name">, plan?: string | null): PropGroup[] {
    const nouns = new Set([headNoun(animal.model_slug), headNoun(animal.name), animal.kind_name ? headNoun(animal.kind_name) : ""].filter(Boolean));
    const groups: PropGroup[] = [];
    const slug = animal.model_slug;
    for (const [group, pattern] of GROUP_NOUNS) {
        if (!Array.from(nouns).some((noun) => pattern.test(noun))) continue;
        // Sea slugs and cone snails keep no garden trails; the mountain beaver builds no dams.
        if (group === "snails" && (MARINE_ZONES.has(animal.zone) || /sea-|cone|whelk|nudibranch/.test(slug))) continue;
        if (group === "beavers" && /mountain-beaver/.test(slug)) continue;
        if (group === "worms" && MARINE_ZONES.has(animal.zone)) continue;
        groups.push(group);
    }
    if (/sea-turtle|leatherback/.test(slug)) groups.push("sea_turtles");
    if (/fruit-bat|vampire-bat/.test(slug) && !groups.includes("bats")) groups.push("bats");
    if (plan === "bird" || Array.from(nouns).some((noun) => BIRD_NOUNS.has(noun))) groups.push("birds");
    return groups;
}

/** The Ark's day of the year (1 Ark year = 365 Ark days, `voyage_ark_day`). */
export function arkDayOfYear(arkDay: number | null | undefined): number | null {
    if (typeof arkDay !== "number" || !Number.isFinite(arkDay)) return null;
    return ((arkDay % 365) + 365) % 365;
}

/**
 * 0–1: how far into its breeding season a zone is, on the Ark's own year
 * (northern seasons, as the shared clock's): spring into early summer on
 * the temperate land, the short summer on the ice, the long wet season in
 * the tropics. Without an Ark day, 0. (Stored per-species seasons, where
 * the traits lane has them, replace this when the snapshot carries them.)
 */
export function breedingSeason(zone: ArkZone, arkDay: number | null | undefined): number {
    const day = arkDayOfYear(arkDay);
    if (day === null) return 0;
    const [from, to] = seasonWindow(zone);
    const inWindow = day < from || day > to ? 0 : Math.sin((Math.PI * (day - from)) / (to - from)) ** 0.5;
    // The tropics breed most of the year.
    return zone === "rainforest" || zone === "coral_reef" ? Math.max(inWindow, 0.35) : inWindow;
}

/** How long chicks stay in the nest, in Ark days. */
export const FLEDGE_ARK_DAYS = 24;

export type NestPlan = {
    /** The species and zone (one nest per species per zone). */
    key: string;
    /** The species (its kind for a breed): `nest-growth.ts`'s speciesId. */
    speciesId: string;
    slug: string;
    name: string;
    zone: ArkZone;
    /** What it builds and where (`nest-kinds.ts`). */
    profile: NestProfile;
    /** The adult that sits it (its id), when one is aboard and not a youngster. */
    sitter: string | null;
    /** Eggs in it now (the server's clutch), 0 for none. */
    eggs: number;
    /** Chicks in it now (young born in the last FLEDGE_ARK_DAYS), 0 for none. */
    chicks: number;
    /** 0–1 the breeding season. */
    season: number;
};

export type Presence = {
    /** Per group, the animals of it aboard (adults and young). */
    groups: Map<PropGroup, ArkAnimal[]>;
    /** One nest per bird species (and zone) that shows one now. */
    nests: NestPlan[];
    /** The sea turtles' nests on the beach: one per turtle species in season or with a clutch. */
    turtleNests: Array<{key: string; eggs: number; season: number}>;
};

const speciesKey = (animal: Pick<ArkAnimal, "species_profile_id" | "kind_species_profile_id" | "model_slug">) => animal.kind_species_profile_id || animal.species_profile_id || animal.model_slug;

/** What the snapshot holds, for the props: the groups aboard, the nests and their eggs and chicks. */
export function propsPresence(snapshot: Pick<ArkSnapshot, "animals" | "ark_day" | "nests">, planOf: (slug: string) => string | null | undefined = () => null): Presence {
    const groups = new Map<PropGroup, ArkAnimal[]>();
    for (const animal of snapshot.animals) {
        for (const group of speciesGroups(animal, planOf(animal.model_slug))) {
            const list = groups.get(group) ?? [];
            list.push(animal);
            groups.set(group, list);
        }
    }
    const clutches = new Map<string, ArkNestRow>();
    for (const row of snapshot.nests ?? []) if (row.status === "egg") clutches.set(`${row.species_profile_id}|${row.zone}`, row);
    const arkDay = typeof snapshot.ark_day === "number" ? snapshot.ark_day : null;
    const young = (animal: ArkAnimal) => animal.origin === "born" && typeof animal.born_ark_day === "number" && arkDay !== null && arkDay - animal.born_ark_day >= 0 && arkDay - animal.born_ark_day < FLEDGE_ARK_DAYS;

    const nests: NestPlan[] = [];
    const birds = groups.get("birds") ?? [];
    const bySpecies = new Map<string, ArkAnimal[]>();
    for (const bird of birds) {
        const key = `${speciesKey(bird)}|${bird.zone}`;
        const list = bySpecies.get(key) ?? [];
        list.push(bird);
        bySpecies.set(key, list);
    }
    for (const [key, members] of Array.from(bySpecies.entries())) {
        const first = members[0];
        const profile = nestProfile(first);
        if (profile.form === "none") continue;
        const clutch = clutches.get(`${first.species_profile_id}|${first.zone}`) ?? clutches.get(`${first.kind_species_profile_id ?? ""}|${first.zone}`) ?? null;
        const chicks = members.filter(young).length;
        const season = breedingSeason(first.zone, arkDay);
        if (!clutch && !chicks && season <= 0) continue;
        const sitter = members.find((member) => !young(member))?.id ?? null;
        nests.push({key, speciesId: speciesKey(first), slug: first.model_slug, name: first.name, zone: first.zone, profile, sitter, eggs: clutch ? Math.min(Math.max(clutch.eggs ?? 3, 1), 6) : 0, chicks: Math.min(chicks, 4), season});
    }
    nests.sort((a, b) => a.key.localeCompare(b.key));

    const turtleNests: Presence["turtleNests"] = [];
    const turtles = new Map<string, ArkAnimal>();
    for (const turtle of groups.get("sea_turtles") ?? []) if (!turtles.has(speciesKey(turtle))) turtles.set(speciesKey(turtle), turtle);
    for (const [key, turtle] of Array.from(turtles.entries())) {
        const clutch = Array.from(clutches.values()).find((row) => row.species_profile_id === turtle.species_profile_id) ?? null;
        const season = breedingSeason("seashore", arkDay);
        if (!clutch && season <= 0) continue;
        turtleNests.push({key, eggs: clutch ? Math.min(Math.max(clutch.eggs ?? 6, 3), 9) : 0, season});
    }
    turtleNests.sort((a, b) => a.key.localeCompare(b.key));
    return {groups, nests, turtleNests};
}

/** The groups present, as a stable string (rebuild the gated props only when it changes). */
export function presenceKey(presence: Presence): string {
    const groups = PROP_GROUPS.filter((group) => presence.groups.has(group)).join(",");
    const nests = presence.nests.map((nest) => `${nest.key}:${nest.profile.form}:${nest.sitter ?? ""}:${nest.eggs}:${nest.chicks}`).join(";");
    const turtles = presence.turtleNests.map((nest) => `${nest.key}:${nest.eggs}`).join(";");
    return `${groups}|${nests}|${turtles}`;
}
