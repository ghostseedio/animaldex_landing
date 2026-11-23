#!/usr/bin/env -S npx tsx
/**
 * Signature behaviours, wave 1: adds the recipes in `data/ark/signature-recipes.json` to the scene's table
 * (`src/ark-scene/recipes.json`). Each addition is a species whose own stored text states a behaviour that an
 * existing recipe template shows (read species by species, AnimalDex docs/ark/signature-behaviours.json), with the
 * field and the exact sentence kept beside it. Visual only, like every recipe.
 *
 * Guard: a recipe is added only where species of the same body plan already use it (the templates are written for
 * bodies: a pounce is a four-legged hunter's), so a loose mapping is skipped and listed, never drawn. The weight is
 * the one that template most often has. Idempotent: run it again after `ark-behaviour-recipes.mts` (and
 * `ark-sleep-styles.mts`) regenerates.
 *
 * Two kinds of row are not a recipe of the table: `"recipe": "sleep:<huddle|pile|cluster>"` (sig2, mammals) is how the species
 * sleeps with its kind (`src/ark-scene/sleep.json`, `data/ark/sleep-styles.json`: the sleep layer draws a huddle, a pile, a
 * roost's cluster; the recipe `cluster` is only an insects' one), set only where the species has no way yet; and a
 * `nest_build` row may carry its own `"nest": "kind:material+material"` (the generator only reads birds' nests), set only
 * where the row has none.
 *
 *   npx tsx scripts/ark-signature-recipes.mts [--dry]
 */
import fs from "node:fs";
import path from "node:path";
// Wave 2, birds (data/ark/signature-birds.json): the bird rows wave 1 held, with the bird recipes that show them.
import {applyBirdLines, applyBirdRecipes, applyBirdSleep, birdHandles, loadBirds} from "./ark-signature-birds.mts";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const dry = process.argv.includes("--dry");
const tablePath = path.join(root, "src/ark-scene/recipes.json");
const table = JSON.parse(fs.readFileSync(tablePath, "utf8")) as {species: Record<string, string>};
const full = JSON.parse(fs.readFileSync(path.join(root, "data/ark/behaviour-recipes.json"), "utf8")) as {species: Array<{slug: string; plan: string}>};
const additions = (JSON.parse(fs.readFileSync(path.join(root, "data/ark/signature-recipes.json"), "utf8")) as {additions: Array<{slug: string; name: string; recipe: string; field?: string; quote?: string; nest?: string}>}).additions;
// sig2 (mammals): how a species sleeps with its kind, and where its source is kept.
const sleepPath = path.join(root, "src/ark-scene/sleep.json");
const sleepTable = JSON.parse(fs.readFileSync(sleepPath, "utf8")) as {species: Record<string, string>};
const sleepStylesPath = path.join(root, "data/ark/sleep-styles.json");
const sleepStyles = JSON.parse(fs.readFileSync(sleepStylesPath, "utf8")) as {species: Array<{slug: string; social: string; src: Record<string, unknown>}>};

const planOf = new Map(full.species.map((s) => [s.slug, s.plan]));
const recipesOf = (row: string) => row.split("|")[0].split(",").filter(Boolean).map((r) => ({id: r.slice(0, r.lastIndexOf(".")), weight: Number(r.slice(r.lastIndexOf(".") + 1))}));
// Which plans use each recipe today, and each recipe's usual weight.
const plans = new Map<string, Set<string>>();
const weights = new Map<string, Map<number, number>>();
for (const [slug, row] of Object.entries(table.species)) {
    for (const r of recipesOf(row)) {
        const plan = planOf.get(slug);
        if (plan) (plans.get(r.id) ?? plans.set(r.id, new Set()).get(r.id)!).add(plan);
        const w = weights.get(r.id) ?? weights.set(r.id, new Map()).get(r.id)!;
        w.set(r.weight, (w.get(r.weight) ?? 0) + 1);
    }
}
// A template new with a signature wave has no users yet to learn its plans and weight from: stated here.
// (3.3 batch (D): `dip_lay`, a dragonfly laying, `data/ark/egg-dip.json`.)
const NEW: Record<string, {plans: string[]; weight: number}> = {
    dip_lay: {plans: ["flying_insect"], weight: 6},
    // sig2 (mammals): a stone hammer (macaques, capuchins) and a worm drawn out of the leaf litter (a ferret-badger).
    stone_hammer: {plans: ["primate"], weight: 3},
    worm_dig: {plans: ["quadruped"], weight: 4}
};
for (const [id, seed] of Object.entries(NEW)) {
    for (const plan of seed.plans) (plans.get(id) ?? plans.set(id, new Set()).get(id)!).add(plan);
    if (!weights.has(id)) weights.set(id, new Map([[seed.weight, 1]]));
}
const usual = (id: string) => [...(weights.get(id) ?? new Map([[3, 1]]))].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0];
// (A nest needs the row's nest field, which only the generator writes.)
const NEEDS_GENERATOR = new Set(["nest_build"]);
// The ways of hunting: a species that already has one keeps it (a second would halve the hunts its own text put first;
// an osprey's talon grab is its plunge).
const HUNTS = new Set(["perch_plunge", "air_plunge", "talon_grab", "wade_spear", "bill_sweep", "pouch_scoop", "surface_dive", "chase_fish", "river_fish", "pounce", "hawk_insects", "aerial_hawk", "hover_drop", "bat_hawk", "bat_trawl"]);

let added = 0;
const skipped: string[] = [];
const already: string[] = [];
const birds = loadBirds(root);
for (const a of additions) {
    // (A bird row wave 2 handles: it is shown by its own bird recipe, below.)
    if (birdHandles(birds.rows, a.slug, a.recipe)) continue;
    const row = table.species[a.slug];
    const plan = planOf.get(a.slug);
    if (row === undefined || !plan) {
        skipped.push(`${a.slug} ${a.recipe}: no row`);
        continue;
    }
    if (a.recipe.startsWith("sleep:")) {
        // How it sleeps with its kind: only where its sleep row has none (a way the generator found stays).
        const social = a.recipe.slice("sleep:".length);
        const sleepRow = sleepTable.species[a.slug];
        if (!sleepRow) {
            skipped.push(`${a.slug} ${a.recipe}: no sleep row`);
            continue;
        }
        const f = sleepRow.split("|");
        while (f.length < 3) f.push("");
        if (f[2] === social) already.push(`${a.slug} ${a.recipe}`);
        else if (f[2]) skipped.push(`${a.slug} ${a.recipe}: it already sleeps ${f[2]}`);
        else {
            f[2] = social;
            sleepTable.species[a.slug] = f.join("|");
            const style = sleepStyles.species.find((x) => x.slug === a.slug);
            if (style) {
                style.social = social;
                style.src.social = {field: a.field, phrase: a.quote};
            }
            added++;
        }
        continue;
    }
    if (recipesOf(row).some((r) => r.id === a.recipe)) {
        // (A mammal's own nest the generator found itself still needs the flag: the props do not draw it.)
        if (a.nest) {
            const f = row.split("|");
            while (f.length < 8) f.push("");
            if (!f[4]) f[4] = a.nest;
            if (!f[7].includes("o")) f[7] += "o";
            table.species[a.slug] = f.join("|");
        }
        already.push(`${a.slug} ${a.recipe}`);
        continue;
    }
    if (HUNTS.has(a.recipe) && recipesOf(row).some((r) => HUNTS.has(r.id))) {
        skipped.push(`${a.slug} ${a.recipe}: it already hunts its own way`);
        continue;
    }
    const generated = NEEDS_GENERATOR.has(a.recipe) && !a.nest;
    if (generated || !plans.get(a.recipe)?.has(plan)) {
        skipped.push(`${a.slug} ${a.recipe}: ${generated ? "needs the generator" : `no ${plan} uses it`}`);
        continue;
    }
    const fields = row.split("|");
    fields[0] = [fields[0], `${a.recipe}.${usual(a.recipe)}`].filter(Boolean).join(",");
    // (A nest of its own, where the generator found none: kind:material+material; flag `o`: the props do not draw it, the recipe does.)
    if (a.nest && !fields[4]) fields[4] = a.nest;
    while (fields.length < 8) fields.push("");
    // (No longer only its plan's defaults.)
    if (fields[7]) fields[7] = fields[7].replace("d", "");
    if (a.nest && !fields[7].includes("o")) fields[7] += "o";
    table.species[a.slug] = fields.join("|");
    added++;
}
// Wave 2, birds: the recipes (and the nests and flags the rows' sentences give), the roosts' sleep, the log lines.
const birdReport = applyBirdRecipes(table, birds.rows);
const linesPath = path.join(root, "src/ark-scene/signature-lines.json");
const lines = JSON.parse(fs.readFileSync(linesPath, "utf8")) as {species: Record<string, Record<string, string>>};
const birdSleep = applyBirdSleep(sleepTable, sleepStyles as unknown as {species: Array<Record<string, unknown>>}, birds.rows);
const birdLines = applyBirdLines(lines, birds.rows);
// (A row that brings its own log sentence, wave 2 on: the catalogue's `line` for that behaviour.)
for (const a of additions as Array<{slug: string; recipe: string; line?: string}>) {
    if (!a.line || a.recipe.startsWith("sleep:")) continue;
    (lines.species[a.slug] ??= {})[a.recipe] = a.line;
}
if (!dry) {
    fs.writeFileSync(tablePath, `${JSON.stringify(table)}\n`);
    fs.writeFileSync(sleepPath, `${JSON.stringify(sleepTable)}\n`);
    fs.writeFileSync(sleepStylesPath, `${JSON.stringify(sleepStyles, null, 1)}\n`);
    fs.writeFileSync(linesPath, JSON.stringify(lines));
}
console.log(JSON.stringify({additions: additions.length, added, already: already.length, skipped: skipped.length, birds: {rows: birds.rows.length, added: birdReport.added.length, already: birdReport.already.length, missing: birdReport.missing.length, sleepRows: birdSleep, lines: birdLines, notShown: birds.notShown.map((n) => `${n.slug} ${n.was}`)}}, null, 1));
if (skipped.length) console.log(skipped.join("\n"));
if (birdReport.missing.length) console.log(birdReport.missing.join("\n"));
