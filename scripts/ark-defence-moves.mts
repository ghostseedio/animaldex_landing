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
type Move = "curl" | "coil" | "shell" | "puff" | "tail" | "flash" | "rear" | "blur" | "thump" | "flag" | "flat" | "tuck" | "beard" | "spines";
/**
 * The pose each move is, as the catalogue's `uses` names it. SIG-DEFENCE (2026-11-20) added the M rows of P5: a rear-up
 * threat (a wolf spider, a crab, a scorpion), a web shaken or a body whirled to a blur (the orb weavers, the daddy-long-
 * legs), a foot thump or a stamp (the rabbits, a wallaby, a deer), a white tail flagged as it runs (the cottontail), a
 * slug contracted flat, legs pulled in (a house spider, a carpet beetle), a bearded dragon's beard, fin spines locked out.
 */
const POSES: Array<[Move, RegExp]> = [
    ["curl", /pose:(curl_ball|roll_ball)\b/],
    ["coil", /pose:(coil_spiral|snake_ball)\b/],
    ["shell", /pose:(shell_withdraw|shell_close \(box seal\)|hermit_withdraw_claw_plug)/],
    ["puff", /pose:puff_up\b/],
    ["flash", /pose:(hindwing_flash|wing_flick_eyespots)\b/],
    ["tail", /pose:tail_drop\b|prop:wriggling_dropped_tail\b/],
    ["rear", /^rear$|pose:(scorpion_threat_claws_tail|upright_claw_threat)\b/],
    ["blur", /pose:(web_whirl_blur|web_shake_blur)\b/],
    ["thump", /pose:(foot_thump|stamp)\b(?!_)/],
    ["flag", /pose:tail_flag\b/],
    ["flat", /pose:slug_contract_flat\b/],
    ["tuck", /pose:(legs_curl_in|play_dead_tucked)\b/],
    ["beard", /pose:beard_puff\b/],
    ["spines", /pose:spines_locked\b/]
];
/** The moments a row is acted at: a predator near (the reactive layer), or (a deer's stamp "at danger it cannot see") a disturbance, which the day's schedule gives now and then. */
const WHEN = new Set(["on_predator_near", "on_disturbance"]);
/** Sentences the scene cannot honestly show with the move. */
const NOT_SHOWN: Array<[RegExp, string]> = [
    [/\b(grabbed|seized|grab)\b/i, "the sentence says it is grabbed or seized"],
    [/\bcaterpillar\b|\blarva\b|\bnymph\b/i, "the sentence is about the caterpillar, the model is the adult"],
    [/\bbolting\b|\bjumping at\b/i, "the sentence says another action than the move"],
    [/\binto a crack\b|\bcrevice\b|\btrunk\b/i, "the sentence names a place the scene does not guarantee"],
    [/\b(female|male)\b/i, "the sentence names a sex the log does not check (decision 374)"],
    [/\braising its tail\b/i, "the sentence says the tail goes up too, and the model carries no tail to raise"]
];
/**
 * A flash's hidden colour, only where the row's own words name it (sRGB hex). A row of eyespots (the Io, Polyphemus,
 * owl and peacock butterflies) is not built: the models rest with their wings shut and the scene cannot open them, and
 * an eyespot painted on a shut wing would not be what the text says. A flagged tail is white where the row says so; a
 * bearded dragon's beard darkens (its row: "puffing out and darkening its beard").
 */
const COLOURS: Array<[RegExp, string]> = [
    [/rose-red/i, "#d8436b"],
    [/scarlet/i, "#e0261c"],
    [/bright red/i, "#d92a23"],
    [/orange/i, "#ee8a1f"],
    [/white tail/i, "#f2efe8"],
    [/darkening its beard/i, "#231b16"]
];

/**
 * The tail drop and the tail flag need the model's own tail (`ark.json` behaviour.tail: its base and length): a model
 * without one (the common wall lizard's, the salamander's, the white-tailed deer's) has no tail for the shader to drop
 * or raise. Read from the published model set (public files, no key) when the build runs.
 */
const MODELS = "https://wwhsdzpczekgdlobwaej.supabase.co/storage/v1/object/public/talking-models/v1/ark";
const manifest = (await (await fetch(`${MODELS}/manifest.json`)).json()) as {models: Record<string, string>};
const tails = new Map<string, boolean>();
async function hasTail(slug: string): Promise<boolean> {
    if (!tails.has(slug)) {
        const version = manifest.models[slug];
        const ark = version ? ((await (await fetch(`${MODELS}/${slug}/${version}.ark.json`)).json()) as {behaviour?: {tail?: {length?: number}}; tail?: {length?: number}}) : null;
        tails.set(slug, Boolean((ark?.behaviour?.tail ?? ark?.tail)?.length));
    }
    return tails.get(slug)!;
}
const NEEDS_TAIL = new Set<Move>(["tail", "flag"]);

/** Species whose model does not take the move honestly (looked at in the behaviours harness), with why. */
const NOT_ON_MODEL: Record<string, string> = {
    "eastern-lubber-grasshopper": "its wings lie between its hind legs on the model: the flash coloured the legs, not the wings"
};

const species: Record<string, [Move, string] | [Move, string, string] | [Move, string, string, number]> = {};
const full: Array<{slug: string; name: string; id: string; move: Move; line: string; behaviour: string; quote: string; uses: string; when: string; colour?: string; flag?: boolean; cornered?: boolean; fore?: boolean}> = [];
const skipped: string[] = [];
for (const row of rows) {
    if (!row.showable || row.theme !== "defence_tactic" || !WHEN.has(row.when)) continue;
    const move = POSES.find(([, re]) => re.test(row.uses))?.[0];
    if (!move) continue;
    const slug = slugOf(row.name);
    const tailless = NEEDS_TAIL.has(move) && known[slug] && !(await hasTail(slug)) ? "the model carries no tail (ark.json behaviour.tail) to drop or raise" : null;
    const why = NOT_ON_MODEL[slug] ? NOT_ON_MODEL[slug] : !known[slug] ? "no model in the scene's tables" : NOT_SHOWN.find(([re]) => re.test(row.line))?.[1] ?? tailless ?? (species[slug] ? `it already has ${species[slug][0]}` : null);
    const colour = (move === "flash" && !/eyespots?|fake eyes/i.test(`${row.behaviour} ${row.line}`)) || move === "flag" || move === "beard" ? COLOURS.find(([re]) => re.test(`${row.behaviour} ${row.line}`))?.[1] : undefined;
    if (why || (move === "flash" && !colour)) {
        skipped.push(`${row.name} (${move}): ${why ?? "eyespots (or no colour named): the scene cannot open a wing to show them"}: "${row.line}"`);
        continue;
    }
    // Flags (a number, the table's fourth value): 1 it flags its white tail as it runs after the thump (the European rabbit's
    // one row says both, and its model has the tail); 2 it rears only when cornered (its row says "cornered"); 4 a stamp
    // of a forefoot, not the hind feet's thump; 8 acted at a disturbance the day's schedule gives, not at a predator.
    const flag = move === "thump" && /pose:tail_flag\b/.test(row.uses) && (await hasTail(slug));
    const cornered = move === "rear" && /\bcornered\b/i.test(row.line);
    const fore = move === "thump" && /pose:stamp\b/.test(row.uses);
    const bits = (flag ? 1 : 0) | (cornered ? 2 : 0) | (fore ? 4 : 0) | (row.when === "on_disturbance" ? 8 : 0);
    species[slug] = bits ? [move, row.line, colour ?? "", bits] : colour ? [move, row.line, colour] : [move, row.line];
    full.push({slug, name: row.name, id: row.id, move, line: row.line, behaviour: row.behaviour, quote: row.quote, uses: row.uses, when: row.when, ...(colour ? {colour} : {}), ...(flag ? {flag} : {}), ...(cornered ? {cornered} : {}), ...(fore ? {fore} : {})});
}
const counts: Record<string, number> = {};
for (const f of full) counts[f.move] = (counts[f.move] ?? 0) + 1;
const sorted = Object.fromEntries(Object.entries(species).sort(([a], [b]) => a.localeCompare(b)));
const about = "Defence moves (3.3 batch, lane A; SIG-DEFENCE 2026-11-20): the species whose own stored text says they curl into a ball, withdraw into a shell, puff up, drop the tail, flash hidden wing colour, rear up, shake to a blur, thump or stamp, flag a white tail, contract flat, pull in their legs, puff a beard or lock out fin spines when a predator is near (or, a stamp, at a disturbance), with the row's sentence for the live log. Built by scripts/ark-defence-moves.mts from AnimalDex docs/ark/signature-behaviours.json; never edited by hand.";
if (!dry) {
    fs.writeFileSync(path.join(root, "src/ark-scene/defence-moves.json"), `${JSON.stringify({about, version: "defence-moves-2", species: sorted})}\n`);
    fs.writeFileSync(path.join(root, "data/ark/defence-moves.json"), `${JSON.stringify({about, version: "defence-moves-2", counts, species: full.sort((a, b) => a.slug.localeCompare(b.slug)), skipped}, null, 1)}\n`);
}
console.log(JSON.stringify(counts));
for (const f of full) console.log(`${f.move.padEnd(6)} ${f.slug}${f.colour ? ` [${f.colour}]` : ""}: ${f.line}`);
console.log(`\nskipped (${skipped.length}):\n${skipped.join("\n")}`);
