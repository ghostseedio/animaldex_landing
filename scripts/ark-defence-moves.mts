#!/usr/bin/env -S npx tsx
/**
 * Defence moves (3.3 batch, lane A; owner 2026-11-16: curl into a ball, shell withdraw, puff up, tail drop, hindwing
 * and eyespot flash): which species does which, from the catalogue of each species' own stored text (AnimalDex
 * docs/ark/signature-behaviours.json). A species gets a move only where one of its rows says it: a defence row
 * (`theme` defence_tactic, `when` on_predator_near, showable) whose `uses` names the pose. Courtship and seasonal rows
 * (a bullfrog's vocal sac, a snail sealed for the dry season) are not defence and are never taken.
 *
 * Left out by rule, and listed in the full file's `skipped`:
 *   - a sentence that says the animal is grabbed or seized (the scene never decides a catch);
 *   - a sentence about another life stage than the model drawn (a moth's caterpillar);
 *   - a sentence that says something else than the move (a hedgehog that "balls only if needed", a moth "bolting");
 *   - a species with no model in the scene's tables.
 *
 * Writes the scene's table `src/ark-scene/defence-moves.json` ({species: {<model_slug>: [move, line, colour?]}}; a coil is a curl for a legless body) and the
 * full one with each row's quote, `data/ark/defence-moves.json`.
 *
 *   npx tsx scripts/ark-defence-moves.mts --catalogue <signature-behaviours.json> [--dry]
 */
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const at = process.argv.indexOf("--catalogue");
const cataloguePath = at > 0 ? process.argv[at + 1] : path.join(root, "..", "AnimalDex", "docs", "ark", "signature-behaviours.json");
const dry = process.argv.includes("--dry");

type Row = {id: string; name: string; behaviour: string; quote: string; showable: boolean; how: string; uses: string; theme: string; when: string; line: string};
const rows = (JSON.parse(fs.readFileSync(cataloguePath, "utf8")) as {rows: Row[]}).rows;
const known = (JSON.parse(fs.readFileSync(path.join(root, "src/ark-scene/behaviours.json"), "utf8")) as {species: Record<string, string>}).species;

const slugOf = (name: string) => name.toLowerCase().replace(/['’]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** (A coil is the flat spiral of a millipede or a snake: the curl of a body with no ball to make.) */
type Move = "curl" | "coil" | "shell" | "puff" | "tail" | "flash";
/** The pose each move is, as the catalogue's `uses` names it. */
const POSES: Array<[Move, RegExp]> = [
    ["curl", /pose:(curl_ball|roll_ball)\b/],
    ["coil", /pose:(coil_spiral|snake_ball)\b/],
    ["shell", /pose:(shell_withdraw|shell_close \(box seal\)|hermit_withdraw_claw_plug)/],
    ["puff", /pose:puff_up\b/],
    ["flash", /pose:(hindwing_flash|wing_flick_eyespots)\b/],
    ["tail", /pose:tail_drop\b|prop:wriggling_dropped_tail\b/]
];
/** Sentences the scene cannot honestly show with the move. */
const NOT_SHOWN: Array<[RegExp, string]> = [
    [/\b(grabbed|seized|grab)\b/i, "the sentence says it is grabbed or seized"],
    [/\bcaterpillar\b|\blarva\b/i, "the sentence is about the caterpillar, the model is the adult"],
    [/\bbolting\b|\bjumping at\b/i, "the sentence says another action than the move"],
    [/\binto a crack\b|\bcrevice\b|\btrunk\b/i, "the sentence names a place the scene does not guarantee"]
];
/**
 * A flash's hidden colour, only where the row's own words name it (sRGB hex). A row of eyespots (the Io, Polyphemus,
 * owl and peacock butterflies) is not built: the models rest with their wings shut and the scene cannot open them, and
 * an eyespot painted on a shut wing would not be what the text says.
 */
const COLOURS: Array<[RegExp, string]> = [
    [/rose-red/i, "#d8436b"],
    [/scarlet/i, "#e0261c"],
    [/bright red/i, "#d92a23"],
    [/orange/i, "#ee8a1f"]
];

/** The moves the scene draws today (each proven in the behaviours harness); a row of another move is listed in the full file's `skipped`. */
const BUILT = new Set<Move>(["curl", "coil", "shell", "puff", "flash"]);

/** Species whose model does not take the move honestly (looked at in the behaviours harness), with why. */
const NOT_ON_MODEL: Record<string, string> = {
    "eastern-lubber-grasshopper": "its wings lie between its hind legs on the model: the flash coloured the legs, not the wings"
};

const species: Record<string, [Move, string] | [Move, string, string]> = {};
const full: Array<{slug: string; name: string; id: string; move: Move; line: string; behaviour: string; quote: string; uses: string; colour?: string}> = [];
const skipped: string[] = [];
for (const row of rows) {
    if (!row.showable || row.theme !== "defence_tactic" || row.when !== "on_predator_near") continue;
    const move = POSES.find(([, re]) => re.test(row.uses))?.[0];
    if (!move) continue;
    const slug = slugOf(row.name);
    const why = !BUILT.has(move) ? "the move is not drawn yet" : NOT_ON_MODEL[slug] ? NOT_ON_MODEL[slug] : !known[slug] ? "no model in the scene's tables" : NOT_SHOWN.find(([re]) => re.test(row.line))?.[1] ?? (species[slug] ? `it already has ${species[slug][0]}` : null);
    const colour = move === "flash" && !/eyespots?|fake eyes/i.test(`${row.behaviour} ${row.line}`) ? COLOURS.find(([re]) => re.test(`${row.behaviour} ${row.line}`))?.[1] : undefined;
    if (why || (move === "flash" && !colour)) {
        skipped.push(`${row.name} (${move}): ${why ?? "eyespots (or no colour named): the scene cannot open a wing to show them"}: "${row.line}"`);
        continue;
    }
    species[slug] = colour ? [move, row.line, colour] : [move, row.line];
    full.push({slug, name: row.name, id: row.id, move, line: row.line, behaviour: row.behaviour, quote: row.quote, uses: row.uses, ...(colour ? {colour} : {})});
}
const counts: Record<string, number> = {};
for (const f of full) counts[f.move] = (counts[f.move] ?? 0) + 1;
const sorted = Object.fromEntries(Object.entries(species).sort(([a], [b]) => a.localeCompare(b)));
const about = "Defence moves (3.3 batch, lane A): the species whose own stored text says they curl into a ball, withdraw into a shell, puff up, drop the tail or flash hidden wing colour or eyespots when a predator is near, with the row's sentence for the live log. Built by scripts/ark-defence-moves.mts from AnimalDex docs/ark/signature-behaviours.json; never edited by hand.";
if (!dry) {
    fs.writeFileSync(path.join(root, "src/ark-scene/defence-moves.json"), `${JSON.stringify({about, version: "defence-moves-1", species: sorted})}\n`);
    fs.writeFileSync(path.join(root, "data/ark/defence-moves.json"), `${JSON.stringify({about, version: "defence-moves-1", counts, species: full.sort((a, b) => a.slug.localeCompare(b.slug)), skipped}, null, 1)}\n`);
}
console.log(JSON.stringify(counts));
for (const f of full) console.log(`${f.move.padEnd(6)} ${f.slug}${f.colour ? ` [${f.colour}]` : ""}: ${f.line}`);
console.log(`\nskipped (${skipped.length}):\n${skipped.join("\n")}`);
