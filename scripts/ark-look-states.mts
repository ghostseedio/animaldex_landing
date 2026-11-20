#!/usr/bin/env -S npx tsx
/**
 * Look states (lane SIG-OTHER, 2026-11-20): builds `src/ark-scene/look-states.json` from the species catalogue (AnimalDex
 * docs/ark/signature-behaviours.json): what a species changes in colour with the hour (a gecko pales at night, a goldfish
 * fades), in its season (a drake's drab eclipse, a gull's hood) or in a display, and what swells in a display or a
 * season (a dewlap, a vocal sac, a throat pouch, full cheeks, a rutting stag's neck). `look-state.ts` and the look
 * shader draw it.
 *
 * Real data only: a species is in only if its catalogue row (a quote of its own stored text) says it. Each entry below
 * names the row by species and by a pattern its `behaviour` or `quote` must match; the drawing beside it (a colour, a
 * region, a size) is this script's reading of those very words and nothing else. A row that is missing, or whose words
 * no longer match, stops the build. Months are the Ark year's (northern months, as the scene's seasons): a season the
 * row names ("summer", "autumn", "winter") or the species' own stored mating months (`recipes.json`); a row that names
 * "the breeding season" for a species with no stored months is in `skipped`, never drawn. Rows the look system cannot
 * draw honestly are in `skipped` with the reason.
 *
 *   npx tsx scripts/ark-look-states.mts --catalogue <AnimalDex>/docs/ark/signature-behaviours.json [--dry]
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
type Row = {id: string; name: string; behaviour: string; quote: string; showable: boolean; how: string | null; uses: string | null; theme: string | null; when: string | null; effort: string | null; line: string | null};
const rows = (JSON.parse(fs.readFileSync(cataloguePath, "utf8")) as {rows: Row[]}).rows;
const slugs = new Set(Object.keys((JSON.parse(fs.readFileSync(path.join(root, "src/ark-scene/animal-look.json"), "utf8")) as {species: Record<string, unknown>}).species));
const lookRows = (JSON.parse(fs.readFileSync(path.join(root, "src/ark-scene/animal-look.json"), "utf8")) as {species: Record<string, number[]>}).species;
const slugOf = (name: string) => name.toLowerCase().replace(/'/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const recipes = (JSON.parse(fs.readFileSync(path.join(root, "src/ark-scene/recipes.json"), "utf8")) as {species: Record<string, string>}).species;
const storedMating = (slug: string) => ((recipes[slug] ?? "").split("|")[2] ?? "").split("").map((c) => "abcdefghijkl".indexOf(c) + 1).filter((m) => m > 0);

type Rgb = [number, number, number];
type V3 = [number, number, number];
type Region = {c: V3; r: V3; mirror?: boolean};
type Tone = {colour?: Rgb; mix?: number; desat?: number; gain?: number; glow?: number; region?: Region};
type Trigger = {kind: "season"; months: number[]; sex?: "male" | "female"} | {kind: "blocks"; blocks: string[]; sex?: "male" | "female"} | {kind: "alarm"} | {kind: "forage"} | {kind: "flash"; period: number; on: number; sex?: "male" | "female"};
type Individual = {kind: "patches" | "spots"; scale: number; dark: number; light: number};

const SUMMER = [6, 7, 8];
const AUTUMN = [9, 10, 11];
const WINTER = [12, 1, 2];
const range = (a: number, b: number) => Array.from({length: b - a + 1}, (_, k) => a + k);
const whole: Region = {c: [0, 0, 0], r: [0.9, 0.9, 1.4]};

/** What the look pass makes of the night, by species: a tone over the whole body (or one region). The words are the row's. */
type Night = {name: string; says: RegExp; line: string; tone: Tone};
const PALE: Tone = {desat: 0.4, gain: 1.22, colour: [0.86, 0.82, 0.74], mix: 0.3};
const NIGHT: Night[] = [
    {name: "Common House Gecko", line: "{aAnimal} has turned pale for the night", says: /pales at night and darkens in daylight/, tone: PALE},
    {name: "Common Wall Gecko", line: "{aAnimal} has paled its skin for the night", says: /darkens in daylight and pales at night/, tone: PALE},
    {name: "Mediterranean House Gecko", line: "{aAnimal} is looking paler now that it is night", says: /paler at night than by day/, tone: PALE},
    {name: "Tropical House Gecko", line: "{aAnimal} has turned pale, almost pinkish-white, for the night", says: /pale and almost pinkish-white at night/, tone: {desat: 0.35, gain: 1.25, colour: [0.93, 0.83, 0.79], mix: 0.55}},
    {name: "Crested Gecko", line: "{aAnimal} has turned darker and richer for the active night", says: /paler when resting by day and darker and richer when active at night/, tone: {desat: -0.35, gain: 0.8}},
    {name: "Goldfish", line: "{aAnimal} has let its colour fade for the night", says: /colour slightly faded/, tone: {desat: 0.32, gain: 1.06}},
    {name: "Siamese Fighting Fish", line: "{aAnimal} has paled its colours for the night", says: /colours noticeably paler while it sleeps/, tone: {desat: 0.5, gain: 1.2}},
    {name: "Guppy", line: "{aAnimal} has dulled its colours for the night", says: /fins lowered and colours dulled/, tone: {desat: 0.45, gain: 0.9}},
    {name: "Neon Tetra", line: "{aAnimal} has dimmed its blue stripe for the night", says: /the blue stripe dims/, tone: {desat: 0.4, gain: 0.88}},
    {name: "Black Skirt Tetra", line: "{aAnimal} has paled its colours for the night", says: /colours often pale/, tone: {desat: 0.45, gain: 1.15}},
    {name: "Tiger Barb", line: "{aAnimal} has let its colours fade for the night", says: /the colours fade until light returns/, tone: {desat: 0.5, gain: 1.1}},
    {name: "Freshwater Angelfish", line: "{aAnimal} has paled its barring for the night", says: /barring often pales noticeably/, tone: {desat: 0.35, gain: 1.2}},
    {name: "Veiled Chameleon", line: "{aAnimal} has faded to pale green for the night", says: /colours often fade to a pale green/, tone: {desat: 0.3, gain: 1.1, colour: [0.62, 0.76, 0.5], mix: 0.45}},
    {name: "Yellow Tang", line: "{aAnimal} has faded for the night", says: /fades at night with a dark stripe/, tone: {desat: 0.4, gain: 1.15}},
    {name: "Three-spot Gourami", line: "{aAnimal} has paled its colours for the night", says: /with its colours paled/, tone: {desat: 0.45, gain: 1.15}},
    // Eyeshine: the eyes glow green in the dark (a glow adds its colour as light, and takes the eyes too).
    {name: "Carolina Wolf Spider", line: "{aAnimal} has its eyes shining green in the dark", says: /green eyeshine/, tone: {colour: [0.35, 1, 0.4], mix: 0.9, glow: 1.3, region: {c: [0.052, 0.053, 0.062], r: [0.035, 0.03, 0.035], mirror: true}}}
];

type State = {name: string; says: RegExp; /** The sentence said while it is drawn: what the scene shows of the row's behaviour (the row's own words, trimmed to that). */ line: string; also?: Array<{name?: string; says: RegExp}>; trigger: Trigger; tone?: Tone; swell?: {region: Region; push: number}; individual?: Individual; /** The sentence is true when the strength is high (default) or low (the model's own plumage is the season's). */ say?: "on" | "off"; why: string};
const STATES: State[] = [
    // MARK: Display swells (a recipe's block now: pushup/display for a lizard's dewlap, call for a sac)
    {name: "Green Iguana", line: "{aAnimal} is showing its dewlap", says: /dewlap display/, trigger: {kind: "blocks", blocks: ["pushup", "display"], sex: "male"}, swell: {region: {c: [0, 0.075, 0.36], r: [0.07, 0.06, 0.09]}, push: 0.07}, why: "the dewlap under the chin, in its push-up display"},
    {name: "Green Anole", line: "{aAnimal} is showing its pink dewlap", says: /extends pink dewlap/, trigger: {kind: "blocks", blocks: ["pushup", "display"], sex: "male"}, swell: {region: {c: [0, 0.085, 0.385], r: [0.05, 0.04, 0.075]}, push: 0.055}, tone: {colour: [0.96, 0.45, 0.62], mix: 0.75, region: {c: [0, 0.085, 0.385], r: [0.05, 0.04, 0.075]}}, why: "a pink dewlap, in its push-up and courtship"},
    {name: "Brown Anole", line: "{aAnimal} is flashing its orange dewlap", says: /orange dewlap flash/, trigger: {kind: "blocks", blocks: ["pushup", "display"], sex: "male"}, swell: {region: {c: [0, 0.085, 0.385], r: [0.05, 0.04, 0.075]}, push: 0.055}, tone: {colour: [0.96, 0.5, 0.1], mix: 0.8, region: {c: [0, 0.085, 0.385], r: [0.05, 0.04, 0.075]}}, why: "an orange dewlap, in its push-up and courtship"},
    {name: "Oriental Garden Lizard", line: "{aAnimal} is presenting its red throat in a push-up display", says: /push-ups and throat presentation to rivals/, also: [{says: /intense red/}], trigger: {kind: "blocks", blocks: ["pushup", "display"], sex: "male"}, swell: {region: {c: [0, 0.04, 0.42], r: [0.04, 0.035, 0.07]}, push: 0.03}, tone: {colour: [0.85, 0.12, 0.08], mix: 0.7, region: {c: [0, 0.04, 0.42], r: [0.05, 0.04, 0.08]}}, why: "the throat presented, red, in its push-up"},
    {name: "Common Green Forest Lizard", line: "{aAnimal} is puffing its throat at a rival", says: /bobs head and puffs throat at rivals/, trigger: {kind: "blocks", blocks: ["pushup", "display"], sex: "male"}, swell: {region: {c: [0, 0.215, 0.4], r: [0.04, 0.04, 0.07]}, push: 0.04}, why: "the throat puffed at a rival, in its push-up"},
    {name: "Veiled Chameleon", line: "{aAnimal} is inflating its body and flaring its colours at a rival", says: /inflating their bodies and flaring bright colours/, trigger: {kind: "blocks", blocks: ["pushup", "display"], sex: "male"}, swell: {region: whole, push: 0.025}, tone: {desat: -0.55, gain: 1.15}, why: "a rival male's inflated body and flared colours, in its contest"},
    {name: "American Bullfrog", line: "{aAnimal} is calling with its vocal sac swollen", says: /inflated vocal sac/, trigger: {kind: "blocks", blocks: ["call"], sex: "male"}, swell: {region: {c: [0, 0.09, 0.38], r: [0.13, 0.08, 0.12]}, push: 0.08}, why: "the vocal sac under the chin, while it calls"},
    {name: "Marsh Frog", line: "{aAnimal} is calling with its grey cheek sacs swollen", says: /paired grey cheek vocal sacs/, trigger: {kind: "blocks", blocks: ["call"], sex: "male"}, swell: {region: {c: [0.13, 0.12, 0.34], r: [0.07, 0.06, 0.09], mirror: true}, push: 0.06}, tone: {colour: [0.58, 0.6, 0.61], mix: 0.5, region: {c: [0.13, 0.12, 0.34], r: [0.07, 0.06, 0.09], mirror: true}}, why: "the pair of grey vocal sacs at the cheeks, while it calls"},
    {name: "Great Plains Toad", line: "{aAnimal} is calling with its vocal sac held forward", says: /sausage-shaped vocal sac/, trigger: {kind: "blocks", blocks: ["call"], sex: "male"}, swell: {region: {c: [0, 0.1, 0.38], r: [0.12, 0.07, 0.1]}, push: 0.08}, why: "the vocal sac held forward, while it calls"},
    {name: "Grey Crowned Crane", line: "{aAnimal} is booming with its red throat sac inflated", says: /booms with inflated red throat sac/, trigger: {kind: "blocks", blocks: ["call", "display"]}, swell: {region: {c: [0, 0.43, 0.33], r: [0.05, 0.06, 0.05]}, push: 0.045}, tone: {colour: [0.85, 0.1, 0.08], mix: 0.8, region: {c: [0, 0.43, 0.33], r: [0.055, 0.065, 0.055]}}, why: "the red throat sac, while it calls"},
    {name: "Siamang", line: "{aAnimal} is calling with its throat sac inflated", says: /inflates throat sac during duets/, trigger: {kind: "blocks", blocks: ["call"]}, swell: {region: {c: [0, 0.63, 0.27], r: [0.07, 0.07, 0.07]}, push: 0.07}, tone: {colour: [0.72, 0.56, 0.53], mix: 0.4, region: {c: [0, 0.63, 0.27], r: [0.07, 0.07, 0.07]}}, why: "the throat sac, in its duet"},
    {name: "Magnificent Frigatebird", line: "{aAnimal} is displaying with its red throat pouch inflated", says: /inflates a red throat pouch like a balloon/, trigger: {kind: "blocks", blocks: ["display", "dance", "call"], sex: "male"}, swell: {region: {c: [0, 0.245, 0.3], r: [0.06, 0.07, 0.09]}, push: 0.11}, tone: {colour: [0.92, 0.12, 0.08], mix: 0.85, region: {c: [0, 0.245, 0.3], r: [0.065, 0.075, 0.095]}}, why: "the red throat pouch, in his display"},
    {name: "European Starling", line: "{aAnimal} is singing with its throat feathers puffed", says: /sings with throat feathers puffed/, trigger: {kind: "blocks", blocks: ["call"], sex: "male"}, swell: {region: {c: [0, 0.29, 0.29], r: [0.06, 0.05, 0.06]}, push: 0.03}, why: "the throat feathers puffed, while he sings"},
    // MARK: Cheek pouches (full while it forages, slowly emptied)
    {name: "Long-tailed Macaque", line: "{aAnimal} has its cheek pouches full of food", says: /cheek pouches bulge with stored food/, trigger: {kind: "forage"}, swell: {region: {c: [0.05, 0.17, 0.43], r: [0.05, 0.05, 0.06], mirror: true}, push: 0.035}, why: "the cheeks full of what it has taken"},
    {name: "Campbell's Dwarf Hamster", line: "{aAnimal} has stuffed its cheek pouches full of seed", says: /stuffs cheek pouches back to the shoulders/, trigger: {kind: "forage"}, swell: {region: {c: [0.12, 0.07, 0.33], r: [0.09, 0.08, 0.1], mirror: true}, push: 0.07}, why: "the cheeks stuffed with seed"},
    {name: "Eastern Chipmunk", line: "{aAnimal} has its cheeks stuffed full", says: /cheeks stuffed twice as wide/, trigger: {kind: "forage"}, swell: {region: {c: [0.08, 0.08, 0.42], r: [0.06, 0.06, 0.08], mirror: true}, push: 0.05}, why: "the cheeks stuffed full"},
    {name: "Mandrill", line: "{aAnimal} has its cheek pouches stuffed with food", says: /stuffs food in cheek pouches/, trigger: {kind: "forage"}, swell: {region: {c: [0.09, 0.26, 0.4], r: [0.05, 0.07, 0.08], mirror: true}, push: 0.035}, why: "the cheeks full of what it has taken"},
    // MARK: Seasons (the Ark year's months)
    {name: "Mallard", line: "{aAnimal} is in its drab eclipse plumage", says: /moult into a drab, female-like eclipse plumage in summer/, trigger: {kind: "season", months: SUMMER, sex: "male"}, tone: {colour: [0.42, 0.36, 0.28], mix: 0.62, desat: 0.25}, why: "the drake's drab eclipse plumage, in summer"},
    {name: "Mandarin Duck", line: "{aAnimal} is in its plain eclipse plumage", says: /moults into a plain eclipse plumage/, trigger: {kind: "season", months: [], sex: "male"}, tone: {colour: [0.42, 0.36, 0.28], mix: 0.62, desat: 0.25}, why: "the drake's plain eclipse plumage, after the display season (the three months after its stored mating months)"},
    {name: "Black-headed Gull", line: "{aAnimal} is wearing its chocolate-brown hood", says: /Chocolate-brown hood in the breeding season/, trigger: {kind: "season", months: []}, tone: {colour: [0.24, 0.14, 0.1], mix: 0.88, region: {c: [0, 0.3, 0.33], r: [0.1, 0.08, 0.11]}}, why: "the chocolate-brown hood, in its stored mating months (its model's head is white)"},
    {name: "Great Crested Grebe", line: "{aAnimal} is showing its white face and neck, without the ruff", says: /White face and neck in winter, without the ruff/, trigger: {kind: "season", months: []}, say: "off", tone: {colour: [0.5, 0.24, 0.1], mix: 0.7, region: {c: [0, 0.46, 0.18], r: [0.1, 0.1, 0.1]}}, why: "the chestnut ruff, in its stored mating months (its model is in its white winter face)"},
    {name: "Winter White Dwarf Hamster", line: "{aAnimal} is in its near-white winter coat", says: /moults from grey-brown to near-white as the days shorten/, trigger: {kind: "season", months: [3, 4, 5, 6, 7, 8, 9, 10]}, say: "off", tone: {colour: [0.5, 0.42, 0.36], mix: 0.55}, why: "grey-brown outside the winter (its model is in its near-white coat)"},
    {name: "Southeastern Five-lined Skink", line: "{aAnimal} is showing broad orange-red jaws", says: /broad orange-red jaws in the breeding season/, trigger: {kind: "season", months: [], sex: "male"}, tone: {colour: [0.86, 0.36, 0.16], mix: 0.6, region: {c: [0, 0.0, 0.42], r: [0.08, 0.06, 0.1]}}, why: "the orange-red jaws, in its stored mating months"},
    {name: "Two-spotted Spider Mite", line: "{aAnimal} has turned orange-red for the winter", says: /females turn orange-red for winter dormancy/, trigger: {kind: "season", months: WINTER, sex: "female"}, tone: {colour: [0.85, 0.28, 0.1], mix: 0.7}, why: "the female's orange-red, for winter"},
    {name: "White-tailed Deer", line: "{aAnimal} has a thickened neck for the autumn rut", says: /necks thicken during the autumn rut/, trigger: {kind: "season", months: AUTUMN, sex: "male"}, swell: {region: {c: [0, 0.2, 0.2], r: [0.1, 0.12, 0.1]}, push: 0.04}, why: "the buck's thickened neck, in the autumn rut"},
    {name: "Red Deer", line: "{aAnimal} has grown a thick, shaggy neck for the autumn", says: /stags develop a thick, shaggy neck mane/, trigger: {kind: "season", months: AUTUMN, sex: "male"}, swell: {region: {c: [0, 0.12, 0.22], r: [0.1, 0.12, 0.1]}, push: 0.05}, why: "the stag's thick neck, in autumn"},
    // MARK: A light organ's flash after dusk (a drawing's timing: the row gives none), and each animal its own pattern
    {name: "Common Eastern Firefly", line: "{aAnimal} is flashing its light", says: /flashing their light organ/, trigger: {kind: "flash", period: 4, on: 0.35, sex: "male"}, tone: {colour: [0.78, 0.95, 0.25], mix: 0.9, glow: 1.9, region: {c: [0, -0.02, -0.33], r: [0.13, 0.07, 0.15]}}, why: "the light organ under the abdomen's tip, flashing after dusk"},
    {name: "Koi", line: "{aAnimal} has patches of colour of its own", says: /every fish has its own colour patches/, trigger: {kind: "season", months: range(1, 12)}, individual: {kind: "patches", scale: 5, dark: 0.22, light: 0.3}, why: "its own pattern of dark and pale patches over the skin's colours, from its own seed"},
    {name: "Guppy", line: "{aAnimal} has spots of its own", says: /every male has different spots/, trigger: {kind: "season", months: range(1, 12), sex: "male"}, individual: {kind: "spots", scale: 6, dark: 0.2, light: 0}, why: "a male's own pattern of dark spots, from its own seed"},
    {name: "Raccoon Dog", line: "{aAnimal} has fattened through late summer and autumn", says: /fattens through late summer and autumn/, trigger: {kind: "season", months: [8, 9, 10, 11]}, swell: {region: whole, push: 0.02}, why: "fattened through late summer and autumn"}
];

/** Rows the look system cannot draw honestly, and why (said in the data, never drawn wrong). */
const SKIPPED: Array<{name: string; says: RegExp; why: string}> = [
    {name: "Tiger Barb", says: /snout and the edges of the fins turn bright red/, why: "its stored text gives no mating months to say when, and the model has no fin edges apart from its body"},
    {name: "Nile Tilapia", says: /Breeding males flush reddish on throat and fins/, why: "no stored mating months, and fins are not separate in the model"},
    {name: "Black Spiny-tailed Iguana", says: /orange tones on the head and throat/, why: "no stored mating months"},
    {name: "Common Sun Skink", says: /yellow, orange or reddish colouring/, why: "no stored mating months"},
    {name: "Oriental Garden Lizard", says: /dramatically more conspicuous around the head and throat/, why: "no stored mating months (its red throat is drawn in its push-up display instead)"},
    {name: "Common Green Forest Lizard", says: /vibrant coloration, often displaying a bright red or orange head/, why: "no stored mating months"},
    {name: "Great Egret", says: /long lacy plumes on the back/, why: "plumes are shape, and the face skin is a few pixels"},
    {name: "Snowy Egret", says: /long lacy plumes/, why: "plumes are shape, and the face skin is a few pixels"},
    {name: "Tricolored Heron", says: /bare skin at the base of the bill turns vivid blue/, why: "a few pixels at the bill base"},
    {name: "Grey Wagtail", says: /black throat bordered by white stripes/, why: "its stored mating months (December to February) are not a breeding season in the north"},
    {name: "Western Yellow Wagtail", says: /brighter yellow below/, why: "its stored mating months (December to February) are not a breeding season in the north"},
    {name: "European Starling", says: /Pale feather tips give a spotted look in winter/, why: "its stored mating months (December to February) are not a breeding season in the north, and the feather tips are marks, not a tone"},
    {name: "Baya Weaver", says: /Breeding males become brighter yellow/, why: "the model's colour under the photo is not known to be a male's"},
    {name: "Red Junglefowl", says: /eclipse plumage domestic cockerels lack/, why: "no stored mating months, and the hackles are shape"},
    {name: "Cotton Pygmy Goose", says: /dark neck collar appears in the breeding season/, why: "no stored mating months"},
    {name: "Sambar Deer", says: /blood-red patch on the throat/, why: "no stored mating months"},
    {name: "Cayenne Tick", says: /Fed females swell to many times their unfed size/, why: "the scene does not know when a tick has fed"},
    {name: "Common Bed Bug", says: /Body swells and darkens after a blood meal/, why: "the scene does not know when a bed bug has fed"},
    {name: "Green Anole", says: /rapidly change color from bright green to brown/, why: "a state with its own trigger (its dewlap is drawn in its display)"},
    {name: "Brown Anole", says: /shift between pale tan and almost black/, why: "a state with its own trigger (its dewlap is drawn in its display)"}
];

const find = (name: string, says: RegExp, among: Row[] = rows) => {
    const hit = among.filter((r) => r.name === name && (says.test(r.quote) || says.test(r.behaviour)));
    if (hit.length !== 1) throw new Error(`${name}: ${hit.length} catalogue rows match ${says}`);
    if (!hit[0].line) throw new Error(`${name}: the row has no line`);
    if (!hit[0].showable) throw new Error(`${name}: the row is not showable`);
    const slug = slugOf(name);
    if (!slugs.has(slug)) throw new Error(`${name}: no model ${slug}`);
    return {row: hit[0], slug};
};

const species: Record<string, {name: string; night?: unknown; state?: unknown}> = {};
const entry = (slug: string, name: string) => (species[slug] ??= {name});
for (const {name, says, line, tone} of NIGHT) {
    const {row, slug} = find(name, says);
    entry(slug, name).night = {id: row.id, quote: row.quote, line, tone};
}
for (const s of STATES) {
    const {row, slug} = find(s.name, s.says);
    const also = (s.also ?? []).map((a) => find(a.name ?? s.name, a.says).row.id);
    const trigger = {...s.trigger} as Trigger;
    if (trigger.kind === "season" && trigger.months.length === 0) {
        // Its stored mating months (`recipes.json`); a species that has none is not drawn (the months are never made up).
        const months = storedMating(slug);
        if (!months.length) throw new Error(`${s.name}: no stored mating months`);
        // The mandarin drake's eclipse follows the display season: the three months after its stored months.
        trigger.months = s.name === "Mandarin Duck" ? [1, 2, 3].map((k) => ((Math.max(...months) - 1 + k) % 12) + 1) : s.name === "Great Crested Grebe" ? months : months;
    }
    entry(slug, s.name).state = {id: row.id, alsoRows: also.length ? also : undefined, quote: row.quote, line: s.line, say: s.say ?? "on", why: s.why, trigger, tone: s.tone, swell: s.swell, individual: s.individual};
}
const skipped: Record<string, string> = {};
for (const k of SKIPPED) {
    const {row} = find(k.name, k.says);
    skipped[`${k.name}: ${row.behaviour}`] = k.why;
}
// (A species' eyes: the spider's glow sits on its own eyes.)
const sp = species[slugOf("Carolina Wolf Spider")];
if (sp?.night) {
    const eye = lookRows[slugOf("Carolina Wolf Spider")];
    if (!eye || eye[5] <= 0) throw new Error("the wolf spider has no eyes marked");
    ((sp.night as {tone: Tone}).tone.region as Region) = {c: [eye[2], eye[3], eye[4]], r: [0.035, 0.03, 0.035], mirror: true};
}

const out = {
    about: "Look states (lane SIG-OTHER), built by scripts/ark-look-states.mts from the species catalogue (AnimalDex docs/ark/signature-behaviours.json): only what a species' own stored text says. night: the tone the species takes in the dark, by the island's daylight (colours sRGB; desat + greyer, - richer; gain lighter or darker; glow adds the colour as light). state: a tone and/or a swell by a trigger (season: the Ark year's months, sex the seeded one; blocks: the recipe block it is in now; forage: while it takes food). Regions are ellipsoids of the model's rest pose (the model is one long; mirror folds x). line = the species' own sentence for it, said in the live log when the world shows it (say off: when it does not, the model's own plumage being the season's).",
    species,
    skipped
};
const nights = Object.values(species).filter((s) => s.night).length;
const states = Object.values(species).filter((s) => s.state).length;
console.log(`species ${Object.keys(species).length}: night ${nights}, state ${states}, skipped ${Object.keys(skipped).length}`);
if (!process.argv.includes("--dry")) fs.writeFileSync(path.join(root, "src/ark-scene/look-states.json"), JSON.stringify(out, null, 1) + "\n");
