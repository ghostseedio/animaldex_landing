#!/usr/bin/env -S npx tsx
/**
 * The birds' own moves (3.3 batch, lane B): builds `src/ark-scene/bird-moves.json` from the species catalogue
 * (AnimalDex docs/ark/signature-behaviours.json: each row a quote of that species' stored text). A species is given a
 * move only where one of its rows says it, by the row's `uses` (the catalogue's own mapping), and keeps the row's
 * sentence for the live log. Nothing here is invented: no rates, no species.
 *
 *   mob    small birds diving at a predator near them, in turns          uses new:mob_dive | new:swoop | group:colony_mob
 *   lure   a ground-nester's broken-wing display leading danger away      uses clip:broken_wing_display
 *   tail   the constant tail movement the bird is known by                uses …tail_pump | tail_cock | tail_fan | tail_flick | tail_bob | fantail_swivel
 *   drop   ducklings jumping from the tree hole on the day they leave     uses clip:duckling_hollow_drop (a tree, not a roof)
 *
 *   npx tsx scripts/ark-bird-moves.mts --catalogue <signature-behaviours.json> [--dry]
 */
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const arg = (name: string) => {
    const at = process.argv.indexOf(`--${name}`);
    return at > 0 ? process.argv[at + 1] : undefined;
};
const cataloguePath = arg("catalogue") ?? path.resolve(root, "../AnimalDex/docs/ark/signature-behaviours.json");
type Row = {id: string; name: string; behaviour: string; quote: string; showable: boolean; how: string; uses?: string; theme: string; when: string; line: string};
const rows = (JSON.parse(fs.readFileSync(cataloguePath, "utf8")) as {rows: Row[]}).rows.filter((r) => r.showable && r.line);
const plans = new Map((JSON.parse(fs.readFileSync(path.join(root, "data/ark/behaviour-recipes.json"), "utf8")) as {species: Array<{slug: string; plan: string}>}).species.map((s) => [s.slug, s.plan]));
const slugOf = (name: string) => name.toLowerCase().replace(/['’]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const bird = (r: Row) => /bird/.test(plans.get(slugOf(r.name)) ?? "");
const flies = (r: Row) => plans.get(slugOf(r.name)) === "flying_bird";
const skipped: string[] = [];

type Said = {line: string | null; behaviour: string; quote: string};
const said = (r: Row, line: string | null = r.line): Said => ({line, behaviour: r.behaviour, quote: r.quote});

// (A sentence that names the foe is said only of that kind of animal: `mobFoeFits`.)
const foeOf = (line: string) => (/\bowl\b/.test(line) ? "owl" : /bird of prey|raptor|harrier|hawk|eagle/.test(line) ? "raptor" : /\bcrow\b/.test(line) ? "crow" : /snake/.test(line) ? "snake" : null);
const mob: Record<string, Said & {foe: string | null}> = {};
for (const r of rows) {
    if (r.theme !== "defence_tactic" || !/^(new:mob_dive|new:swoop|group:colony_mob)/.test(r.uses ?? "")) continue;
    if (!flies(r)) {
        skipped.push(`mob ${r.name}: not a flying bird`);
        continue;
    }
    // (A sentence that names a sex is held back: the log does not check the actor's, `signature-lines.json`'s own rule.)
    mob[slugOf(r.name)] = {...said(r, /\b(male|female)\b/.test(r.line) ? null : r.line), foe: foeOf(r.line)};
}

// The row's sentence is said only where it says the display itself (a stilt's and a crane's rows say the charge and
// the dive at the intruder, which this does not show: they do the display without a sentence of their own).
const lure: Record<string, Said> = {};
for (const r of rows) {
    if (r.uses !== "clip:broken_wing_display" || !bird(r)) continue;
    lure[slugOf(r.name)] = said(r, /broken wing/.test(r.line) ? r.line : null);
}

const TAIL: Array<[RegExp, string[]]> = [
    [/fantail_swivel/, ["fan", "swivel"]],
    [/tail_cock \+ tail_fan/, ["cock", "fan"]],
    [/tail_fan_flick/, ["fan", "flick"]],
    [/tail_pump/, ["pump"]],
    [/tail_cock/, ["cock"]],
    [/tail_bob/, ["bob"]],
    [/tail_flick/, ["flick"]]
];
const tail: Record<string, Said & {moves: string[]; while: string}> = {};
for (const r of rows) {
    if (r.theme !== "signature" || r.how !== "procedural_pose" || !/tail/.test(r.uses ?? "")) continue;
    const hit = TAIL.find(([re]) => re.test(r.uses ?? ""));
    if (!hit || !bird(r)) {
        skipped.push(`tail ${r.name}: ${r.uses} (${bird(r) ? "no tail move of these" : "not a bird"})`);
        continue;
    }
    // (Its sentence is said only where it says the tail's own movement: one that also has the bird hopping along a stream
    // is held back; one that has it walking or perched is said while it walks or stands still: `while`.)
    const line = /hopping|stream/.test(r.line) ? null : r.line;
    tail[slugOf(r.name)] = {...said(r, line), moves: hit[1], while: /walking/.test(r.line) ? "walk" : /perch/.test(r.line) ? "still" : "any"};
}

const drop: Record<string, Said> = {};
for (const r of rows) {
    if (r.uses !== "clip:duckling_hollow_drop") continue;
    if (!/tree|hollow|cavity|hole/.test(r.behaviour) || /roof/.test(r.behaviour)) {
        skipped.push(`drop ${r.name}: ${r.behaviour}`);
        continue;
    }
    drop[slugOf(r.name)] = said(r);
}

const sorted = <T,>(o: Record<string, T>) => Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)));
const out = {
    about: "The birds' own moves (3.3 batch, lane B), built by scripts/ark-bird-moves.mts from AnimalDex docs/ark/signature-behaviours.json: a species has a move only where a row of its own stored text says it (the quote beside it), and its sentence for the live log is the row's line. mob: diving at a predator near them in turns. lure: the broken-wing display. tail: its constant tail movement. drop: its ducklings jump from the tree hole.",
    version: "bird-moves-1",
    mob: sorted(mob),
    lure: sorted(lure),
    tail: sorted(tail),
    drop: sorted(drop)
};
console.log(`mob ${Object.keys(mob).length}  lure ${Object.keys(lure).length}  tail ${Object.keys(tail).length}  drop ${Object.keys(drop).length}`);
for (const [k, v] of Object.entries({mob, lure, tail, drop})) console.log(k, Object.keys(v).sort().join(", "));
if (skipped.length) console.log("left out:\n  " + skipped.join("\n  "));
if (!process.argv.includes("--dry")) fs.writeFileSync(path.join(root, "src/ark-scene/bird-moves.json"), JSON.stringify(out, null, 1) + "\n");
