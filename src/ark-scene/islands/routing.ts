/**
 * Part C routing as the scene's fixtures and local rehearsals need it (islands plan §3.5, §4.1). **The server decides
 * every animal's island, area and enclosure** (`voyage_route_v1`, `voyage_zoo_enclosure_pick`, AnimalDex
 * `ark-islands-server`); the scene only reads them. This file gives development data the same shape: the fixture's
 * made-up Ark (`fixtures/islands.ts`) and the local real snapshot with island fields synthesised from the server's
 * species routing and T1's rehearsal counts (`lib/ark-islands-local.ts`). Pure and deterministic (seeded hashes).
 */

import {eats} from "@/ark-scene/food-links";
import {ZOO_ENCLOSURE_TYPES, ZOO_TYPES, type ZooEnclosureType} from "@/ark-scene/islands/town/zoo-types";

/** The zoo houses whose kinds each live in their own tank, terrarium or cage (server: `ZOO_HOUSES`, decision 39). */
export const ZOO_HOUSE_TYPES: ReadonlySet<ZooEnclosureType> = new Set<ZooEnclosureType>(["aquarium", "reptile_house", "insect_house", "nocturnal_house", "aviaries"]);
/** Enclosures open as animals arrive, up to about this many (decision 23; server `ZOO_MAX_ENCLOSURES`). */
export const ZOO_MAX_ENCLOSURES = 40;

/** A stable 0–1 from text (FNV-1a). */
export function unitOf(text: string): number {
    let hash = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) {
        hash ^= text.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash / 0x100000000;
}

const RULES: Array<[RegExp, ZooEnclosureType]> = [
    [/(^|-)(goat|sheep|cow|cattle|pig|chicken|donkey|horse|alpaca|llama|guinea-pig|domestic-rabbit|turkey)(-|$)/, "childrens_farm"],
    [/penguin|(^|-)seal(-|$)|sea-lion|walrus/, "penguin_seal_pools"],
    [/dolphin|dugong|manatee|sea-turtle|shark|(^|-)ray(-|$)|manta|herring|salmon|trout|carp|koi|goldfish|tetra|cichlid|clownfish|tang|wrasse|grouper|eel|octopus|squid|jellyfish|crab|lobster|shrimp|starfish|sea-star|urchin|anemone|coral|seahorse|pufferfish|angelfish|-fish(-|$)|(^|-)fish-|whale/, "aquarium"],
    [/ostrich|(^|-)emu(-|$)|rhea|cassowary|elephant|rhinoceros|rhino|giraffe|zebra|wildebeest|gazelle|impala|antelope|oryx|hippopotamus|hippo|tapir|kudu|eland|buffalo|camel/, "savanna_paddocks"],
    [/(^|-)(lion|tiger|leopard|jaguar|cheetah|puma|cougar|snow-leopard|clouded-leopard)(-|$)/, "big_cats"],
    [/(^|-)(bat|pipistrelle|flying-fox|aye-aye|loris|bushbaby|galago|kiwi|sugar-glider)(-|$)/, "nocturnal_house"],
    [/monkey|gorilla|chimpanzee|bonobo|orangutan|gibbon|lemur|macaque|baboon|tamarin|marmoset|capuchin|mandrill/, "primate_house"],
    [/(^|-)(bear|wolf|fox|hyena|jackal|coyote|dhole|wolverine)(-|$)/, "bears_wolves"],
    [/(^|-)(deer|boar|bison|moose|elk|ibex|markhor|bongo|reindeer|caribou|okapi|mouflon|chamois|takin|warthog)(-|$)/, "hoofstock_paddocks"],
    [/alligator|crocodile|caiman|gharial|snake|python|boa|viper|cobra|mamba|lizard|iguana|gecko|chameleon|monitor|komodo|tortoise|terrapin|turtle|frog|toad|newt|salamander|axolotl|skink|anole|dragon/, "reptile_house"],
    [/beetle|ant(-|$)|bee(-|$)|wasp|hornet|butterfly|moth|cricket|grasshopper|mantis|stick-insect|spider|tarantula|scorpion|centipede|millipede|snail|slug|ladybird|ladybug|dragonfly|fly(-|$)|cockroach|termite/, "insect_house"],
    [/eagle|hawk|falcon|kestrel|owl|vulture|macaw|parrot|cockatoo|parakeet|budgerigar|lory|lorikeet|toucan|hornbill|heron|egret|stork|crane|ibis|flamingo|pelican|puffin|gull|duck|mallard|goose|swan|pigeon|dove|sparrow|finch|robin|thrush|starling|crow|raven|magpie|jay|kingfisher|bee-eater|sunbird|hummingbird|peafowl|peacock|pheasant|quail|turaco|weaver|wren|warbler|tit(-|$)|swallow|swift|bird/, "aviaries"],
    [/meerkat|otter|red-panda|capybara|wallaby|kangaroo|koala|wombat|armadillo|anteater|sloth|porcupine|hedgehog|rabbit|hare|squirrel|chipmunk|prairie-dog|mongoose|raccoon|coati|civet|genet|skunk|badger|ferret|weasel|mink|marten|binturong|quokka|rat(-|$)|mouse|hamster|gerbil|chinchilla|cavy|mara|hyrax|pangolin/, "small_mammals"]
];

/**
 * A zoo animal's enclosure type by its kind's slug (the plan's classification rule, §3.5, as near as a slug allows).
 * The server's `voyage_species.zoo_enclosure` (taxonomy and stored traits) is the real answer; this is for made-up
 * fixtures only.
 */
export function zooTypeOfSlug(slug: string): ZooEnclosureType {
    for (const [pattern, type] of RULES) if (pattern.test(slug)) return type;
    return "small_mammals";
}

/** A fixture kind the plan's urban rule (8) would route to the town (Appendix A's kinds, by slug). */
export function urbanSlug(slug: string): boolean {
    return /house-sparrow|tree-sparrow|mallard|muscovy|egyptian-goose|red-fox|brown-rat|black-rat|house-mouse|pigeon|collared-dove|gull|magpie|carrion-crow|american-crow|jackdaw|raven|rook|raccoon|gray-squirrel|fox-squirrel|house-gecko|tokay|kestrel|peregrine|pipistrelle|macaque|water-monitor|white-tailed-deer|cottontail/.test(slug);
}

export type RoutedAnimal = {id: string; slug: string; kind: string; arrivedAt: string; type: ZooEnclosureType};

/**
 * Each zoo animal's enclosure, as the server's `voyage_zoo_enclosure_pick` gives it, in arrival order: its kind's
 * own enclosure of the type with room (lowest number first); else an open one of the type with room whose kinds
 * have no food link with it (a zoo house takes any kind); else, under the cap, the type's next free number; else
 * its kind's least-full one, else the least-full compatible one, else a new one past the cap.
 */
export function assignEnclosures(animals: readonly RoutedAnimal[], maxOpen = ZOO_MAX_ENCLOSURES): Map<string, string> {
    const out = new Map<string, string>();
    const open = new Map<string, {type: ZooEnclosureType; kinds: Map<string, string>; n: number}>();
    const number = (id: string) => Number(id.slice(id.lastIndexOf("-") + 1));
    const linked = (a: string, b: string) => a !== b && (eats(a, b) || eats(b, a));
    const ordered = animals.slice().sort((a, b) => a.arrivedAt.localeCompare(b.arrivedAt) || a.id.localeCompare(b.id));
    for (const animal of ordered) {
        const cap = ZOO_TYPES[animal.type].capacity;
        const ofType = Array.from(open.entries()).filter(([, e]) => e.type === animal.type).sort((x, y) => number(x[0]) - number(y[0]));
        const own = ofType.filter(([, e]) => e.kinds.has(animal.kind));
        const compatible = ofType.filter(([, e]) => ZOO_HOUSE_TYPES.has(animal.type) || Array.from(e.kinds.values()).every((slug) => !linked(slug, animal.slug)));
        const roomy = (list: typeof ofType) => list.find(([, e]) => e.n < cap)?.[0];
        let pick = roomy(own) ?? roomy(compatible);
        if (!pick) {
            const next = () => {
                const used = new Set(ofType.map(([id]) => number(id)));
                let n = 1;
                while (used.has(n)) n++;
                return `${animal.type}-${n}`;
            };
            const least = (list: typeof ofType) => (list.length ? list.reduce((b, x) => (x[1].n < b[1].n ? x : b))[0] : undefined);
            pick = open.size < maxOpen ? next() : least(own) ?? least(compatible) ?? next();
        }
        let e = open.get(pick);
        if (!e) open.set(pick, (e = {type: animal.type, kinds: new Map(), n: 0}));
        e.kinds.set(animal.kind, animal.slug);
        e.n++;
        out.set(animal.id, pick);
    }
    return out;
}

/** Open enclosures per type, from assigned names. */
export function enclosuresPerType(names: Iterable<string>): Partial<Record<ZooEnclosureType, number>> {
    const out: Partial<Record<ZooEnclosureType, number>> = {};
    for (const name of Array.from(new Set(names))) {
        const type = name.slice(0, name.lastIndexOf("-")) as ZooEnclosureType;
        if ((ZOO_ENCLOSURE_TYPES as readonly string[]).includes(type)) out[type] = (out[type] ?? 0) + 1;
    }
    return out;
}
