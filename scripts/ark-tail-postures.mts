#!/usr/bin/env -S npx tsx
/**
 * Tail postures (lane SIG-OTHER, 2026-11-20): builds `src/ark-scene/tail-postures.json` from the species catalogue
 * (AnimalDex docs/ark/signature-behaviours.json): the species whose own stored text says how the tail is carried or moved
 * and whose rig has a tail chain (tail0-tail2). `tail-posture.ts` and the locomotion layer's legged driver draw it.
 *
 * Real data only: each entry names its catalogue row by species and by a pattern the row's quote must match; the angles are
 * this script's reading of those very words (up, arched, bent, S) and nothing else. A row that is missing, or whose quote
 * no longer matches, stops the build. Rows it cannot draw honestly are in `skipped` with the reason.
 *
 *   npx tsx scripts/ark-tail-postures.mts --catalogue <AnimalDex>/docs/ark/signature-behaviours.json [--dry]
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
type Row = {id: string; name: string; behaviour: string; quote: string; showable: boolean; line: string | null; theme: string | null};
const rows = (JSON.parse(fs.readFileSync(cataloguePath, "utf8")) as {rows: Row[]}).rows;
const slugOf = (name: string) => name.toLowerCase().replace(/'/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const slugs = new Set(Object.keys((JSON.parse(fs.readFileSync(path.join(root, "src/ark-scene/animal-look.json"), "utf8")) as {species: Record<string, unknown>}).species));

type Spec = {name: string; says: RegExp; when: "always" | "moving" | "social"; pitch: number[]; idle?: number; wag?: {amp: number[]; rate: number}; line?: string};
const SPECS: Spec[] = [
    // A dog's wag is a social signal: its tail swings from the base, a little raised, while it greets or plays.
    {name: "Domestic Dog", says: /Tail wagged or raised as a social signal/, when: "social", pitch: [0.35, 0.15, 0.05], idle: 0, wag: {amp: [0.3, 0.4, 0.5], rate: 3.4}},
    // "Raised ringed tail ... while moving": straight up like a flag while it walks, half up at rest.
    {name: "South American Coati", says: /Raised ringed tail: the tail works like a visible group flag while moving/, when: "moving", pitch: [1.0, 0.35, 0.1], idle: 0.3},
    {name: "Eastern Chipmunk", says: /Tail held straight up when running/, when: "moving", pitch: [1.1, 0.3, 0.1], idle: 0.2},
    // "Held in an arch": over the back and curving back down toward the tip.
    {name: "Hamadryas Baboon", says: /Tail held in an arch/, when: "always", pitch: [0.9, -0.1, -0.6], idle: 1},
    // "Bent sharply near the base, then hanging down".
    {name: "Olive Baboon", says: /Tail bent sharply near the base, then hanging down/, when: "always", pitch: [1.1, -1.0, -0.15], idle: 1},
    // "Carried in an S or C": up, back, up.
    {name: "Toque Macaque", says: /Tail as long as the body, carried in an S or C/, when: "always", pitch: [0.7, -0.7, 0.6], idle: 1}
];
const SKIPPED: Array<{name: string; says: RegExp; why: string}> = [
    {name: "Prevost's Squirrel", says: /quick dashes with frequent pauses/, why: "its quote gives the dashes and pauses, not an arched tail"},
    {name: "Tayra", says: /bounds along with the back arched and the tail held out/, why: "the tail held out is the rig's rest pose; the arched back is a body clip"},
    {name: "Giraffe", says: /Tufted black tail flicked against flies/, why: "its rig has no tail bones"}
];

const find = (name: string, says: RegExp) => {
    const hit = rows.filter((r) => r.name === name && r.showable && says.test(r.quote));
    if (hit.length !== 1) throw new Error(`${name}: ${hit.length} catalogue rows match ${says}`);
    if (!hit[0].line) throw new Error(`${name}: the row has no line`);
    const slug = slugOf(name);
    if (!slugs.has(slug)) throw new Error(`${name}: no model ${slug}`);
    return {row: hit[0], slug};
};
const species: Record<string, unknown> = {};
for (const {name, says, line, ...spec} of SPECS) {
    const {row, slug} = find(name, says);
    species[slug] = {name, id: row.id, quote: row.quote, line: line ?? row.line, ...spec};
}
const skipped: Record<string, string> = {};
for (const k of SKIPPED) {
    const hit = rows.filter((r) => r.name === k.name && k.says.test(r.quote));
    if (hit.length < 1) throw new Error(`${k.name}: skipped row not found`);
    skipped[`${k.name}: ${hit[0].behaviour}`] = k.why;
}
const out = {
    about: "Tail postures of the rigged mammals (lane SIG-OTHER), built by scripts/ark-tail-postures.mts from the species catalogue (AnimalDex docs/ark/signature-behaviours.json): only what a species' own stored text says. when: always, while moving (the locomotion layer's motion), or while it signals socially (the scene's: it looks at another animal or the camera, or is at play). pitch: radians each tail link holds at full hold (up positive); idle: the share kept when not held; wag: the yaw swing of each link at full social strength and its rate (Hz). line = the species' own sentence, said in the live log while it is drawn.",
    species,
    skipped
};
console.log(`species ${Object.keys(species).length}, skipped ${Object.keys(skipped).length}`);
if (!process.argv.includes("--dry")) fs.writeFileSync(path.join(root, "src/ark-scene/tail-postures.json"), JSON.stringify(out, null, 1) + "\n");
