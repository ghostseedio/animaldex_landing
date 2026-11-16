#!/usr/bin/env -S npx tsx
/**
 * Young animals and seasonal looks (3.3 batch, lane C): builds `src/ark-scene/young-life.json` from the species
 * catalogue (AnimalDex docs/ark/signature-behaviours.json), each entry with its species' own log sentence (the row's
 * `line`), which the live log says when the world shows it near the camera (`young-life.ts`, the signature-line path).
 *
 * Real data only: a species is in only if its catalogue row (a quote of its own stored text) says it. Each entry
 * below names the row by species and by a pattern the row's `behaviour` or `quote` must match; the drawing spec
 * beside it (a colour, bars or stripes) is this script's reading of those very words and nothing else. A row that is
 * missing, or whose words no longer match, stops the build. Rows the look system cannot draw honestly are listed in
 * `skipped` with the reason, never drawn.
 *
 *   npx tsx scripts/ark-young-life.mts --catalogue <AnimalDex>/docs/ark/signature-behaviours.json [--dry]
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
type Row = {id: string; name: string; behaviour: string; quote: string; showable: boolean; how: string | null; uses: string | null; theme: string | null; when: string | null; line: string | null};
const rows = (JSON.parse(fs.readFileSync(cataloguePath, "utf8")) as {rows: Row[]}).rows;
const slugs = new Set(Object.keys((JSON.parse(fs.readFileSync(path.join(root, "src/ark-scene/animal-look.json"), "utf8")) as {species: Record<string, unknown>}).species));
const slugOf = (name: string) => name.toLowerCase().replace(/'/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

type Rgb = [number, number, number];
type Coat = {
    /** The young colour (sRGB 0-1) and how much of the adult's skin it replaces. */
    base?: Rgb; mix?: number;
    /** Marks: bars across the body, stripes along it, spots, or one line down the back. */
    mark?: "bars" | "stripes" | "spots" | "back"; markColour?: Rgb; strength?: number; count?: number; width?: number; broken?: number;
    /** Only the tail. */
    tail?: boolean;
    /** Duller (0-1 toward grey). */
    dull?: number;
    /** Days of life over which the text says it fades (from, to); without it, as it grows up. */
    fade?: [number, number];
};
const PALE: Rgb = [0.9, 0.86, 0.74];
const DARK: Rgb = [0.13, 0.11, 0.09];
/** The young coats the look shader can draw, each read from the row its pattern finds. */
const COATS: Array<{name: string; says: RegExp} & Coat> = [
    {name: "Wild Boar", says: /cream-and-brown stripes fade at around 3 to 4 months/, base: [0.44, 0.31, 0.2], mix: 0.75, mark: "stripes", markColour: [0.9, 0.82, 0.62], count: 4.5, width: 0.36, strength: 0.85, fade: [90, 120]},
    {name: "South American Tapir", says: /reddish-brown coat is marked with pale stripes and spots/, base: [0.42, 0.24, 0.15], mix: 0.8, mark: "stripes", markColour: PALE, count: 4, width: 0.3, broken: 0.6, strength: 0.9},
    {name: "Baird's Tapir", says: /single striped calf/, mark: "stripes", markColour: PALE, count: 4, width: 0.3, broken: 0.4, strength: 0.85},
    {name: "Collared Peccary", says: /reddish-brown coat with a dark stripe down the back/, base: [0.5, 0.3, 0.2], mix: 0.75, mark: "back", markColour: DARK, strength: 0.9},
    {name: "African Lion", says: /cubs are born faintly spotted/, mark: "spots", markColour: [0.36, 0.26, 0.16], count: 3.2, strength: 0.32},
    {name: "Francois' Langur", says: /Infants are born bright orange/, base: [0.93, 0.5, 0.12], mix: 0.88},
    {name: "Blue Wildebeest", says: /Calves are born a pale tawny brown/, base: [0.7, 0.55, 0.36], mix: 0.8},
    {name: "Black Spiny-tailed Iguana", says: /Hatchlings are bright green/, base: [0.3, 0.72, 0.2], mix: 0.8},
    {name: "Emerald Tree Boa", says: /Newborns are usually brick-red or orange, not green, and change colour gradually over about their first year/, base: [0.7, 0.28, 0.15], mix: 0.8, fade: [30, 365]},
    {name: "Leopard Gecko", says: /Juveniles are banded dark and pale, not spotted/, base: [0.85, 0.8, 0.64], mix: 0.85, mark: "bars", markColour: DARK, count: 3, width: 0.5, strength: 0.9},
    {name: "Red Tegu", says: /Juveniles brown with pale bands/, base: [0.4, 0.3, 0.2], mix: 0.8, mark: "bars", markColour: PALE, count: 4, width: 0.3, strength: 0.85},
    {name: "Saltwater Crocodile", says: /Juveniles pale yellowish with dark bands and spots/, base: [0.82, 0.76, 0.48], mix: 0.75, mark: "bars", markColour: DARK, count: 3.5, width: 0.4, broken: 0.35, strength: 0.85},
    {name: "Spectacled Caiman", says: /Juveniles yellowish with bold black bands/, base: [0.8, 0.72, 0.4], mix: 0.75, mark: "bars", markColour: [0.05, 0.05, 0.05], count: 3.5, width: 0.42, strength: 0.92},
    {name: "Eastern Rat Snake", says: /Juveniles are grey with dark blotches along the back/, base: [0.56, 0.56, 0.56], mix: 0.8, mark: "spots", markColour: [0.18, 0.16, 0.15], count: 2.4, strength: 0.85},
    {name: "Southeastern Five-lined Skink", says: /Juveniles have a vivid blue tail/, base: [0.1, 0.35, 0.95], mix: 0.9, tail: true},
    {name: "Gray Angelfish", says: /Juveniles black with yellow vertical bands/, base: [0.04, 0.04, 0.05], mix: 0.9, mark: "bars", markColour: [0.95, 0.85, 0.15], count: 3.5, width: 0.22, strength: 0.95},
    {name: "Blue Tang", says: /bright yellow juveniles/, base: [0.98, 0.85, 0.1], mix: 0.9},
    {name: "Goldfish", says: /Young goldfish are dark olive-bronze and turn gold over their first year/, base: [0.3, 0.3, 0.14], mix: 0.85, fade: [200, 365]},
    {name: "Boeseman's Rainbowfish", says: /Juveniles are plain silvery grey, and males take about a year/, base: [0.66, 0.68, 0.7], mix: 0.85, fade: [300, 365]},
    {name: "Zebra Shark", says: /Young are dark brown with narrow yellowish stripes/, base: [0.25, 0.17, 0.1], mix: 0.85, mark: "bars", markColour: [0.9, 0.82, 0.5], count: 7, width: 0.18, strength: 0.9},
    {name: "Brownbanded Bamboo Shark", says: /Juveniles boldly banded/, mark: "bars", markColour: [0.2, 0.14, 0.1], count: 5, width: 0.5, strength: 0.75},
    {name: "Greater Amberjack", says: /bold dark vertical bars, which fade as they grow/, mark: "bars", markColour: DARK, count: 5, width: 0.4, strength: 0.7},
    {name: "Spotted Barb", says: /Young fish show extra dark bars or blotches along the flank/, mark: "bars", markColour: DARK, count: 5, width: 0.35, strength: 0.5},
    {name: "Iridescent Shark", says: /two dark stripes along each side/, mark: "stripes", markColour: [0.1, 0.1, 0.12], count: 2, width: 0.3, strength: 0.8},
    {name: "Bluestreak Cleaner Wrasse", says: /Juveniles are black with a vivid blue line along the back/, base: [0.03, 0.03, 0.04], mix: 0.9, mark: "back", markColour: [0.1, 0.5, 1], strength: 0.95},
    {name: "Blueface Angelfish", says: /dark blue with pale curved bars/, base: [0.05, 0.08, 0.35], mix: 0.9, mark: "bars", markColour: [0.85, 0.9, 1], count: 5, width: 0.2, strength: 0.9},
    {name: "Little Blue Heron", says: /pure white for its first year/, base: [0.96, 0.96, 0.96], mix: 0.92, fade: [330, 365]},
    {name: "Sun Conure", says: /Young birds are largely green and gain this yellow as they mature/, base: [0.25, 0.6, 0.2], mix: 0.65},
    {name: "Scarlet Ibis", says: /Young birds are duller and develop color as they mature/, dull: 0.7},
    {name: "Ring-billed Gull", says: /take three years to reach adult plumage, passing through mottled brown and grey stages/, base: [0.45, 0.37, 0.3], mix: 0.6, mark: "spots", markColour: [0.25, 0.2, 0.16], count: 4, strength: 0.5, fade: [900, 1095]},
    {name: "Yellow-legged Gull", says: /Young birds are mottled brown and take four years/, base: [0.45, 0.37, 0.3], mix: 0.6, mark: "spots", markColour: [0.25, 0.2, 0.16], count: 4, strength: 0.5, fade: [1200, 1460]},
    {name: "Southern Black Widow", says: /Young spiders are pale with white, yellow and orange markings and darken as they mature/, base: [0.8, 0.76, 0.66], mix: 0.75},
    {name: "Leopard Slug", says: /Young slugs tend to be paler and less boldly marked/, base: [0.8, 0.76, 0.68], mix: 0.45},
    {name: "Variegated Meadowhawk", says: /young adults are yellow-brown/, base: [0.7, 0.55, 0.2], mix: 0.65},
    {name: "Ant Mimic Mantis", says: /hatches as a shiny black nymph/, base: [0.03, 0.03, 0.03], mix: 0.9},
    {name: "Giant Malaysian Leaf Insect", says: /Newly hatched nymphs are reddish-brown/, base: [0.48, 0.24, 0.14], mix: 0.85},
    {name: "Mantled Guereza", says: /Infants are born mostly white/, base: [0.95, 0.95, 0.93], mix: 0.85}
];
/** Young looks of the catalogue this pass does not draw, and why (said in the data, never drawn wrong). */
const COATS_SKIPPED: Record<string, string> = {
    "Malayan Tapir": "the quote gives no young colour, and stripes over the adult's black-and-white would be wrong",
    "American Robin": "a breast only", "Magnificent Frigatebird": "head and breast only", "Black-headed Ibis": "head and neck only", "Eurasian Coot": "the head only",
    "Common Wood Pigeon": "a patch missing, not a coat", "Eurasian Collared Dove": "a collar missing, not a coat", "Racket-tailed Roller": "tail feathers missing (shape)",
    "Asian Fairy-bluebird": "young males like females: sex and age", "Green Peafowl": "the train (shape)", "African Grey Parrot": "the iris", "Barn Owl": "sizes, not a coat",
    "Asian Swamp Eel": "fins (shape)", "Bicolor Parrotfish": "three stages and a sex change", "Giant Gourami": "the quote is the adult's hump", "Red-bellied Pacu": "the belly only",
    "Black Swallowtail": "the caterpillar (another body)", "Desert Locust": "a phase, not an age", "Spiny Leaf Insect": "the head only", "Bold Jumper": "one spot",
    "Black Planthopper": "a fan of wax threads (shape)", "Red-spotted Purple": "the caterpillar (another body)",
    "House Centipede": "legs (shape)", "Long-spined Sea Urchin": "the spines only", "Shore Crab": "patches of three colours, not placed by the text"
};

const YOUNG = /juvenil|young|fawn|calf|calves|cub|hatchling|chick|piglet|infant|newborn|nymph|caterpillar/i;
const youngLookRows = rows.filter((r) => r.how === "look" && r.showable && YOUNG.test([r.behaviour, r.uses, r.when].join(" ")));
const find = (name: string, says: RegExp, among: Row[]) => {
    const hit = among.filter((r) => r.name === name && (says.test(r.quote) || says.test(r.behaviour)));
    if (hit.length !== 1) throw new Error(`${name}: ${hit.length} catalogue rows match ${says}`);
    if (!hit[0].line) throw new Error(`${name}: the row has no line`);
    const slug = slugOf(name);
    if (!slugs.has(slug)) throw new Error(`${name}: no model ${slug}`);
    return {row: hit[0], slug};
};
const coats: Record<string, unknown> = {};
for (const {name, says, ...coat} of COATS) {
    const {row, slug} = find(name, says, youngLookRows);
    coats[slug] = {name, id: row.id, quote: row.quote, line: row.line, ...coat};
}
const unread = youngLookRows.filter((r) => !COATS.some((c) => c.name === r.name) && !(r.name in COATS_SKIPPED)).map((r) => r.name);
if (unread.length) throw new Error(`young look rows neither drawn nor skipped with a reason: ${unread.join(", ")}`);

const out = {
    about: "Young animals and seasonal looks (3.3 batch, lane C), built by scripts/ark-young-life.mts from the species catalogue (AnimalDex docs/ark/signature-behaviours.json): only what a species' own stored text says. coats: the young of these species wear another coat (the look shader's young coat, young-coat.ts); colours are sRGB.",
    coats,
    coatsSkipped: Object.fromEntries(youngLookRows.filter((r) => r.name in COATS_SKIPPED).map((r) => [r.name, COATS_SKIPPED[r.name]]))
};
console.log(`coats ${Object.keys(coats).length} (skipped ${Object.keys(out.coatsSkipped).length})`);
if (!process.argv.includes("--dry")) {
    fs.writeFileSync(path.join(root, "src/ark-scene/young-life.json"), JSON.stringify(out, null, 1) + "\n");
}
