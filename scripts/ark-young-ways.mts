#!/usr/bin/env -S npx tsx
/**
 * How young are kept (sig-young lane): builds `src/ark-scene/young-ways.json` and `data/ark/young-ways-rows.json` from the
 * species catalogue's "young care" theme (AnimalDex docs/ark/signature-behaviours.json, 236 rows).
 *
 * Real data only: a species is in only if its catalogue row (a quote of its own stored text) says it. Each entry below
 * names its row by species and a pattern the row's `behaviour` or `quote` must match; a row that is missing or whose
 * words no longer match stops the build. Every one of the theme's rows is accounted for in the rows file: built here,
 * built by an earlier pass (`already`), the eggs' (laying, clutches, sacs: the `ark-mating-shown` branch's), or held with its
 * reason. Nothing is drawn that no row says, and no row is drawn for a species with no young.
 *
 * The ways (what the scene does with a species' young, `young-ways.ts`):
 *   ride    young carried on a parent: style back | belly | tail | under; `by` male: the father carries
 *   line    young follow in a line behind the parent (the parent's own path); `by` male: the father leads
 *   follow  young keep at the parent's heel and play round her (the care table read the species' notes as a nest or nothing)
 *   stay    young kept at one spot while the parent is away and comes back in bouts (a nursing visit, food brought):
 *           hide (lies flat in cover), den (at its den's mouth), nest (a chick that gapes); `helpers`: other adults of the
 *           kind bring food too; `hours`: only at those hours; `days`: how long it stays (else its dependence)
 *   cluster young of the kind gather in a clump while the adults go about their day (creches, nymph clusters)
 *
 *   npx tsx scripts/ark-young-ways.mts --catalogue <AnimalDex>/docs/ark/signature-behaviours.json [--dry]
 */
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const arg = (name: string) => {
    const at = process.argv.indexOf(`--${name}`);
    return at > 0 ? process.argv[at + 1] : undefined;
};
const cataloguePath = arg("catalogue");
if (!cataloguePath) throw new Error("--catalogue <path to signature-behaviours.json>");
type Row = {id: string; name: string; behaviour: string; quote: string; showable: boolean; how: string | null; uses: string | null; theme: string | null; when: string | null; line: string | null; effort: string | null};
const all = (JSON.parse(fs.readFileSync(cataloguePath, "utf8")) as {rows: Row[]}).rows;
const rows = all.filter((r) => r.theme === "young_care" && r.showable);
const slugs = new Set(Object.keys((JSON.parse(fs.readFileSync(path.join(root, "src/ark-scene/animal-look.json"), "utf8")) as {species: Record<string, unknown>}).species));
const slugOf = (name: string) => name.toLowerCase().replace(/'/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

type Ride = "back" | "belly" | "tail" | "under";
type Way = {
    ride?: Ride;
    by?: "male";
    line?: boolean;
    follow?: boolean;
    stay?: "hide" | "den" | "nest";
    visit?: "nurse" | "feed";
    helpers?: boolean;
    hours?: "dawn_dusk";
    days?: number;
    cluster?: boolean;
    /** Which of the ways the row's sentence is true of (the log says the row's line only for those). */
    say?: Array<"ride" | "line" | "stay" | "visit" | "cluster">;
};
type Entry = {name: string; says: RegExp; /** The part of the row's sentence the scene does not draw (the row counts as part built, not built). */ part?: string} & Way;

const RIDE: Entry[] = [
    // Birds on the water: a swan and a grebe carry their chicks on the back.
    {name: "Great Crested Grebe", says: /ride on a parent's back/, ride: "back", say: ["ride"]},
    {name: "Mute Swan", says: /ride on a parent's back/, ride: "back", say: ["ride"]},
    // Spiders and scorpions.
    {name: "Carolina Wolf Spider", says: /spiderlings ride on mother's back/, ride: "back", say: ["ride"]},
    {name: "Tiger Wolf Spider", says: /spiderlings ride on her back/, ride: "back", say: ["ride"]},
    {name: "Giant Forest Scorpion", says: /mother carries young on her back/, ride: "back", say: ["ride"]},
    {name: "Giant Whip Scorpion", says: /hatchlings ride on her back/, ride: "back", say: ["ride"]},
    {name: "Malaysian Forest Scorpion", says: /newborns ride on mother's back/, ride: "back", say: ["ride"]},
    // Crayfish: the young cling beneath the mother's tail.
    {name: "Red Swamp Crayfish", says: /young cling to her through first moults/, ride: "under", say: ["ride"]},
    {name: "Redclaw Crayfish", says: /hatchlings cling beneath mother's tail/, ride: "under", say: ["ride"]},
    // Mammals that carry on the back, the chest or the tail.
    {name: "Common Opossum", says: /young ride on mother's back/, ride: "back", say: ["ride"]},
    {name: "Southern Tamandua", says: /carries young on its back/, ride: "back", say: ["ride"]},
    {name: "Common Hippopotamus", says: /calf rests on mother's back in deep water/, ride: "back", say: ["ride"]},
    {name: "Large Flying Fox", says: /mother carries pup on her chest/, ride: "belly", say: ["ride"]},
    {name: "Sunda Pangolin", says: /carries pup on tail/, ride: "tail"},
    // Primates whose infant clings to the belly (the rest of the primates' rows keep the belly-then-back carry of an earlier pass).
    {name: "Lar Gibbon", says: /infant clings to mother's belly/, ride: "belly", say: ["ride"]},
    {name: "Celebes Crested Macaque", says: /infant carried on belly/, ride: "belly", say: ["ride"]},
    {name: "Long-tailed Macaque", says: /infant clings to belly/, ride: "belly", say: ["ride"]},
    // (The care table read this text as no care: its own sentence says the infant rides on the mother's back.)
    {name: "Squirrel Monkey", says: /infant rides on mother's back, other females carry/, ride: "back", say: ["ride"], part: "the infant rides its mother; other females carrying it is not drawn"},
    // The father (and helpers) carries: where the record has the father, the infant rides him.
    {name: "Coppery Titi Monkey", says: /father carries infant/, ride: "back", by: "male", say: ["ride"]},
    {name: "Common Marmoset", says: /fathers and siblings carry the twins/, ride: "back", by: "male", say: ["ride"]},
    {name: "Emperor Tamarin", says: /males and helpers carry twins/, ride: "back", by: "male", say: ["ride"]},
    {name: "Siamang", says: /father carries infant from second year/, ride: "back", part: "the infant rides its mother; the father carrying it from its second year is not drawn"},
    {name: "Barbary Macaque", says: /males carry and groom infants/, ride: "back", by: "male", say: ["ride"]}
];

const LINE: Entry[] = [
    {name: "Domestic Duck", says: /ducklings follow the mother in a line/, line: true, say: ["line"]},
    {name: "Domestic Goose", says: /goslings follow the parent in a line/, line: true, say: ["line"]},
    {name: "Mallard", says: /ducklings follow the female alone/, line: true, say: ["line"]},
    {name: "Canada Goose", says: /both parents escort goslings/, line: true, part: "defending them is not drawn"},
    {name: "Domestic Chicken", says: /chicks stay close to the hen for weeks/, line: true},
    {name: "Wild Turkey", says: /hen leads poults after hatching/, line: true, say: ["line"]},
    {name: "Ruddy Shelduck", says: /walk ducklings kilometres to water/, line: true},
    {name: "Striped Skunk", says: /kits follow mother to forage/, line: true, say: ["line"]},
    {name: "Black Rhinoceros", says: /calf follows behind its mother/, line: true, say: ["line"]},
    {name: "Bengal Tiger", says: /cubs trail mother on stalk|mother teaches cubs to hunt/, line: true, say: ["line"]},
    {name: "Indochinese Tiger", says: /cubs follow mother on hunts/, line: true, say: ["line"]},
    {name: "Sumatran Tiger", says: /cubs learn the mother's forest routes/, line: true},
    {name: "Common Raccoon", says: /young follow and climb with mother/, line: true},
    {name: "Southern Cassowary", says: /male alone incubates the green eggs and raises the chicks/, line: true, by: "male", part: "the male leads the chicks; his sitting on the eggs is the eggs\'"},
    {name: "Emu", says: /male sits on the eggs for about eight weeks/, line: true, by: "male", part: "the male leads the striped chicks; his sitting on the eggs is the eggs\'"},
    {name: "Greater Rhea", says: /male leads and guards a creche of chicks/, line: true, by: "male", part: "the male leads the chicks; guarding the creche and adopting strays is not drawn"},
    {name: "Rufous Hornero", says: /young stay on parents' territory for months/, line: true},
    {name: "White-throated Dipper", says: /chicks can swim and dive at fledging/, line: true, part: "the chicks follow; their diving is not drawn"},
    {name: "American Crocodile", says: /female helps hatchlings reach water/, line: true, part: "the hatchlings follow her; the way to the water is her day\'s, not set"},
    {name: "Brown Bear", says: /cubs born in the winter den, guarded for years/, line: true, part: "the cubs follow her; the winter den is not drawn"},
    {name: "Banded Archerfish", says: /young learn by watching skilled shooters/, line: true, part: "the young keep with an adult; their watching its shots is not drawn"},
    {name: "Striped Snakehead", says: /guarding parents charge intruders near the fry/, line: true, part: "the fry keep with the parents; their charging intruders is not drawn"}
];

/** Young at the parent's heel, with the play of young (the earlier pass's heel and play bursts, which the care table kept from them). */
const FOLLOW: Entry[] = [
    {name: "Giant Panda", says: /one cub stays with mother/, follow: true},
    {name: "European Otter", says: /cubs first swim at ~3 months/, follow: true},
    {name: "Smooth-coated Otter", says: /pups get swimming lessons/, follow: true},
    {name: "Harbor Seal", says: /pup swims soon after birth/, follow: true},
    {name: "Domestic Cat", says: /kittens play/, follow: true},
    {name: "Domestic Dog", says: /pups learn through play/, follow: true},
    {name: "Green-cheeked Conure", says: /young wrestle/, follow: true}
];

/** Young kept at a spot while the parent is away: lying hidden, at the den, in the nest. */
const STAY: Entry[] = [
    // Hiders: the young lies flat and still while the mother browses, and she comes back to nurse.
    {name: "Bongo", says: /calf lies hidden while mother returns to nurse/, stay: "hide", visit: "nurse", say: ["stay", "visit"]},
    {name: "Chital", says: /fawn lies hidden in cover/, stay: "hide", visit: "nurse", say: ["stay"]},
    {name: "Domestic Goat", says: /kids lie hidden while mother browses/, stay: "hide", visit: "nurse", say: ["stay"]},
    {name: "Fallow Deer", says: /fawns hidden in cover/, stay: "hide", visit: "nurse", say: ["stay"]},
    {name: "Gemsbok", says: /calves hide early before joining the herd/, stay: "hide", visit: "nurse", say: ["stay"]},
    {name: "Greater Kudu", says: /calves hide early/, stay: "hide", visit: "nurse", say: ["stay"]},
    {name: "Javan Rusa Deer", says: /calf lies hidden in cover/, stay: "hide", visit: "nurse", say: ["stay"]},
    {name: "Mule Deer", says: /spotted fawns lie hidden/, stay: "hide", visit: "nurse", say: ["stay"]},
    {name: "Nyala", says: /calf lies hidden in dense vegetation/, stay: "hide", visit: "nurse", say: ["stay"]},
    {name: "Red Deer", says: /spotted calf lies hidden/, stay: "hide", visit: "nurse", say: ["stay"]},
    {name: "White-tailed Deer", says: /spotted fawns lie hidden while doe returns/, stay: "hide", visit: "nurse", say: ["stay", "visit"]},
    {name: "Baird's Tapir", says: /striped calf hides then follows mother/, stay: "hide", visit: "nurse", say: ["stay"]},
    {name: "Eastern Cottontail", says: /mother visits nest only briefly at dawn and dusk/, stay: "hide", visit: "nurse", hours: "dawn_dusk", say: ["visit"]},
    // Fledglings that hide in cover while the parents keep feeding them.
    {name: "Andean Sparrow", says: /fledglings hide in low cover/, stay: "hide", visit: "feed", say: ["stay", "visit"]},
    // The eland calf lies hidden for its first weeks (its row's quote), then joins the nursery group.
    {name: "Common Eland", says: /calves form a nursery group/, stay: "hide", visit: "nurse", say: []},
    // Dens: kits and pups wait at the den's mouth and the parent (and helpers) come back with food.
    {name: "American Badger", says: /gives birth and raises kits in underground dens/, stay: "den", visit: "nurse"},
    {name: "American Marten", says: /kits raised in tree cavities or logs/, stay: "den", visit: "nurse"},
    {name: "Fisher", says: /kits in tree cavities/, stay: "den", visit: "nurse"},
    {name: "Pine Marten", says: /rests and breeds in tree cavities or old nests/, stay: "den", visit: "nurse"},
    {name: "Red Panda", says: /gives birth in tree hollows/, stay: "den", visit: "nurse"},
    {name: "Red Fox", says: /kits in dens/, stay: "den", visit: "feed", say: ["stay", "visit"]},
    {name: "Coyote", says: /pups in a den, both parents feeding/, stay: "den", visit: "feed", say: ["stay", "visit"]},
    {name: "Gray Wolf", says: /pack helps feed and guard pups at the den/, stay: "den", visit: "feed", helpers: true, say: ["stay", "visit"]},
    {name: "Eurasian Wolf", says: /pack feeds pups regurgitated meat at the den/, stay: "den", visit: "feed", helpers: true, say: ["stay", "visit"]},
    {name: "Spotted Hyena", says: /cubs raised at the clan den/, stay: "den", visit: "nurse", say: ["stay"], part: "the cubs wait at the den and their mother comes to nurse them; the clan's raising them together is not drawn"},
    {name: "Raccoon Dog", says: /both parents guard and feed pups/, stay: "den", visit: "feed", say: ["visit"]},
    {name: "Short-beaked Echidna", says: /puggle left in a nursery burrow/, stay: "den", visit: "nurse", say: ["stay"]},
    {name: "Swift Fox", says: /family moves between dens with kits through summer/, stay: "den", visit: "feed"},
    {name: "Patagonian Mara", says: /young in communal warrens, parents visit only their own/, stay: "den", visit: "nurse", say: ["stay", "visit"]},
    {name: "Meerkat", says: /group babysits pups at the burrow/, stay: "den", visit: "feed", helpers: true, say: ["stay"], part: "pups at the burrow and adults coming with food; the babysitter who stays behind is not drawn"},
    {name: "Black-and-white Ruffed Lemur", says: /parks infants in nests instead of carrying them/, stay: "nest", visit: "nurse", say: ["stay"]},
    {name: "African Lion", says: /pride nursery: lionesses guard and nurse each other's cubs/, stay: "den", visit: "nurse", helpers: true, say: ["stay", "visit"]},
    // Helpers at a bird's nest: the group's other adults bring food to the chicks as well.
    {name: "Carrion Crow", says: /young stay on parents' territory for years and help raise broods/, stay: "nest", visit: "feed", helpers: true, say: ["visit"]},
    {name: "Pied Butcherbird", says: /group helpers feed young/, stay: "nest", visit: "feed", helpers: true, say: ["visit"]},
    {name: "White-crested Laughingthrush", says: /helpers from the group feed chicks/, stay: "nest", visit: "feed", helpers: true, say: ["visit"]},
    {name: "Harris's Hawk", says: /older offspring stay and help feed later broods/, stay: "nest", visit: "feed", helpers: true, say: ["visit"]},
    {name: "Laughing Kookaburra", says: /family helpers assist in raising young/, stay: "nest", visit: "feed", helpers: true, say: ["visit"]},
    {name: "Magnificent Frigatebird", says: /female feeds the chick for most of a year after the male leaves/, stay: "nest", visit: "feed", days: 120, say: ["visit"]}
];

/** Young that gather in a clump while the adults go about their day. */
const CLUSTER: Entry[] = [
    {name: "African Penguin", says: /chicks gather in creches/, cluster: true, say: ["cluster"]},
    {name: "Galah", says: /fledglings gather in nursery trees while parents forage/, cluster: true, say: ["cluster"]},
    {name: "Common Eland", says: /calves form a nursery group/, cluster: true, say: ["cluster"]},
    {name: "Shield & Stink Bug", says: /nymphs cluster tightly after hatching/, cluster: true, say: ["cluster"]},
    {name: "Buff-tip Moth", says: /caterpillars feed together, then separate as they grow/, cluster: true, say: ["cluster"]},
    {name: "Tiger Moth", says: /larvae feed in groups under fig leaves/, cluster: true, say: ["cluster"]},
    {name: "Red-tailed Tinfoil Barb", says: /juveniles form tight shoals at once/, cluster: true, say: ["cluster"]},
    {name: "Flathead Catfish", says: /fry shoal in the shallows, then disperse/, cluster: true, say: ["cluster"]},
    {name: "Spectacled Caiman", says: /hatchlings stay in group near mother/, cluster: true, say: ["cluster"], part: "the hatchlings clump; their staying near her is her day's"},
    {name: "Orb-weaver Spider", says: /spiderlings cluster then balloon away/, cluster: true, part: "the spiderlings clump; their ballooning away is not drawn"},
    {name: "Peacock Butterfly", says: /caterpillars live together in a silk web/, cluster: true, part: "the caterpillars clump; the silk web is not drawn"}
];

/**
 * Rows another pass already shows (young follow, ride, nurse, play, the mouth carry, the duckling drop), by species: the table says
 * what. A row here whose species has no such thing in the scene would be wrong, so each is checked by `young-ways.test.ts`.
 */
const ALREADY: Array<{name: string; says: RegExp; what: string}> = [
    {name: "Australian Wood Duck", says: /duckling/, what: "duckling-drop: the hollow drop"},
    {name: "Bufflehead", says: /ducklings jump/, what: "duckling-drop"},
    {name: "Lesser Whistling Duck", says: /ducklings drop/, what: "duckling-drop"},
    {name: "Mandarin Duck", says: /ducklings jump/, what: "duckling-drop"},
    {name: "Muscovy Duck", says: /ducklings jump|day-old ducklings/, what: "duckling-drop"},
    {name: "Asian Arowana", says: /carries the eggs and young in his mouth/, what: "mouth-carry (brood)"},
    {name: "Silver Arowana", says: /carries eggs and young in his mouth/, what: "mouth-carry (brood)"},
    {name: "Nile Tilapia", says: /carries eggs and fry in her mouth/, what: "mouth-carry (brood)"},
    {name: "American Alligator", says: /carries hatchlings in her mouth/, what: "mouth-carry (jaws)"},
    {name: "Mugger Crocodile", says: /carries hatchlings to water in her mouth/, what: "mouth-carry (jaws)"},
    {name: "Saltwater Crocodile", says: /carries hatchlings to water in her mouth/, what: "mouth-carry (jaws)"},
    {name: "Dugong", says: /calf stays close to its mother/, what: "young follow (heel)"},
    {name: "Sperm Whale", says: /group protects calves/, what: "young follow (heel)"},
    {name: "Western Lowland Gorilla", says: /young play and stay close/, what: "young play (heel bursts)"}
];
/** Primates: the infant clings and rides (an earlier pass's belly-then-back carry, `ark-age.ts`); checked against the care table. */
const PRIMATE_RIDE = /^(Bolivian Squirrel Monkey|Bornean Orangutan|Chimpanzee|Francois' Langur|Hamadryas Baboon|Mantled Guereza|Mantled Howler Monkey|Ring-tailed Lemur|Stump-tailed Macaque|Tufted Capuchin|Tufted Gray Langur|Western Gorilla)$/;

const find = (name: string, says: RegExp, among: Row[]) => {
    const hit = among.filter((r) => r.name === name && (says.test(r.quote) || says.test(r.behaviour)));
    if (hit.length !== 1) throw new Error(`${name}: ${hit.length} catalogue rows match ${says}`);
    if (!hit[0].line) throw new Error(`${name}: the row has no line`);
    const slug = slugOf(name);
    if (!slugs.has(slug)) throw new Error(`${name}: no model ${slug}`);
    return {row: hit[0], slug};
};

const species: Record<string, Record<string, unknown>> = {};
const status = new Map<string, {status: string; what: string}>();
const merge = (slug: string, name: string, row: Row, way: Way, kind: string, part?: string) => {
    const {say, ...spec} = way;
    const into = (species[slug] ??= {name, ways: {}, lines: {} as Record<string, string>});
    Object.assign(into.ways as object, spec);
    for (const k of say ?? []) (into.lines as Record<string, string>)[k] = row.line!;
    status.set(`${row.id}|${row.behaviour}`, part ? {status: "part", what: `${kind}: ${part}`} : {status: "built", what: kind});
};
for (const [kind, list] of [["ride", RIDE], ["line", LINE], ["follow", FOLLOW], ["stay", STAY], ["cluster", CLUSTER]] as const) {
    for (const {name, says, part, ...way} of list) {
        const {row, slug} = find(name, says, rows);
        merge(slug, name, row, way, kind, part);
    }
}
for (const {name, says, what} of ALREADY) {
    const {row} = find(name, says, rows);
    const key = `${row.id}|${row.behaviour}`;
    if (!status.has(key)) status.set(key, {status: "already", what});
}
for (const r of rows) {
    if (PRIMATE_RIDE.test(r.name) && /carr|cling|ride|handle|belly|back|infant|passed/i.test(r.behaviour + r.uses)) {
        const key = `${r.id}|${r.behaviour}`;
        if (!status.has(key)) status.set(key, {status: "already", what: "ride (belly then back; the primates' carry, ark-age.ts)"});
    }
}

/** Held rows by their catalogue shape (the reason is said, never drawn wrong). */
const EGGS = /egg|sac\b|clutch|incubat|brood guard|coil around|coil|berried|nest cavity|guard nest|guards? (?:the )?(?:egg|nest)|lays|deposit|vent/i;
const HELD_BY_NAME: Record<string, string> = {
    "Cotton Pygmy Goose": "the duckling drop's rule: its quote says only that they jump down, not from a tree hole (scripts/ark-bird-moves.mts skipped it)",
    "Killdeer": "the duckling drop is a tree hole's; these chicks jump from a roof edge (not drawn)",
    "Australasian Swamphen": "the group's shared nest and its feeding the chicks (a nest and a group's feeding, not drawn)",
    "Kuhl's Pipistrelle Bat": "the females' nursery colony (a roost of females, the roost recipe's), not the young",
    "Io Moth": "caterpillars in single file (a file with no parent to lead it: not built)"
};
const held = (r: Row): {status: string; what: string} => {
    if (HELD_BY_NAME[r.name]) return {status: "held", what: HELD_BY_NAME[r.name]};
    const text = [r.behaviour, r.uses].join(" ");
    if (r.how === "look") return {status: "held", what: "look: a colour or shape of the young (the look lane, young-life.json coats), not a behaviour"};
    if (r.how === "presence") return {status: "held", what: "presence: where the young live (a habitat or depth), nothing shown by the young themselves"};
    if (r.how === "flight_path") return {status: "held", what: "flight: spiderlings ballooning on silk (a flight path of tiny young): not built"};
    if (EGGS.test(text)) return {status: "eggs", what: "the eggs' or the clutch's (laying, sitting, guarding eggs, sacs): ark-mating-shown's layings and clutches"};
    if (r.how === "new_clip") return {status: "held", what: "needs a new rig clip (P4)"};
    if (r.how === "mark") return {status: "held", what: "a ground mark (pit, exit hole): not built here"};
    if (r.how === "prop") return {status: "held", what: "a prop (den or web) not drawn by this pass"};
    return {status: "held", what: `${r.how ?? "?"}: not built in this pass (${r.uses ?? ""})`};
};
const rowsOut = rows.map((r) => {
    const s = status.get(`${r.id}|${r.behaviour}`) ?? held(r);
    return {id: r.id, name: r.name, behaviour: r.behaviour, quote: r.quote, how: r.how, effort: r.effort, ...s};
});
const counts: Record<string, number> = {};
for (const r of rowsOut) counts[r.status] = (counts[r.status] ?? 0) + 1;

const out = {
    about: "How young are kept (sig-young lane), built by scripts/ark-young-ways.mts from the species catalogue's young-care rows (AnimalDex docs/ark/signature-behaviours.json): only what a species' own stored text says. ride: young carried on a parent (style back/belly/tail/under; by male: the father); line: young follow in a line along the parent's path; stay: young kept at one spot (hide/den/nest) while the parent comes back in bouts (visit nurse/feed; helpers: other adults of the kind too; hours; days); cluster: the young of the kind gather in a clump. lines: the row's own English log sentence by way. Used by young-ways.ts. The rows each way is read from, with their quotes, are in data/ark/young-ways-rows.json.",
    species
};
console.log(`species ${Object.keys(species).length}; rows ${rowsOut.length}: ${Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(", ")}`);
if (!process.argv.includes("--dry")) {
    fs.writeFileSync(path.join(root, "src/ark-scene/young-ways.json"), JSON.stringify(out, null, 1) + "\n");
    fs.writeFileSync(path.join(root, "data/ark/young-ways-rows.json"), JSON.stringify({about: "Every young-care row of the catalogue (2026-11-16) with what the scene does with it today (scripts/ark-young-ways.mts): built, already (an earlier pass), eggs (ark-mating-shown), or held with its reason.", counts, rows: rowsOut}, null, 1) + "\n");
}
