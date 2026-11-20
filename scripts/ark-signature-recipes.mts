#!/usr/bin/env -S npx tsx
/**
 * Signature behaviours, wave 1: adds the recipes in `data/ark/signature-recipes.json` to the scene's table
 * (`src/ark-scene/recipes.json`). Each addition is a species whose own stored text states a behaviour that an
 * existing recipe template shows (read species by species, AnimalDex docs/ark/signature-behaviours.json), with the
 * field and the exact sentence kept beside it. Visual only, like every recipe.
 *
 * Guard: a recipe is added only where species of the same body plan already use it (the templates are written for
 * bodies: a pounce is a four-legged hunter's), so a loose mapping is skipped and listed, never drawn. The weight is
 * the one that template most often has. Idempotent: run it again after `ark-behaviour-recipes.mts` regenerates.
 *
 *   npx tsx scripts/ark-signature-recipes.mts [--dry]
 */
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const dry = process.argv.includes("--dry");
const tablePath = path.join(root, "src/ark-scene/recipes.json");
const table = JSON.parse(fs.readFileSync(tablePath, "utf8")) as {species: Record<string, string>};
const full = JSON.parse(fs.readFileSync(path.join(root, "data/ark/behaviour-recipes.json"), "utf8")) as {species: Array<{slug: string; plan: string}>};
// (Every `data/ark/signature-recipes*.json`: the first wave's, and a lane's own: its `additions`, and its `templates`, the
// plans and the weight of a template the table has no users of yet, or the plans a reviewed variant is drawn for.)
type Addition = {slug: string; name: string; recipe: string; nest?: string};
const files = fs.readdirSync(path.join(root, "data/ark")).filter((f) => /^signature-recipes.*\.json$/.test(f)).sort();
const additions: Addition[] = [];
const seeded: Record<string, {plans: string[]; weight: number}> = {};
// (`replaces`: held rows another file's addition now shows another way, not listed as held; `held`: rows held again, with why.)
const replaced = new Set<string>();
const heldWhy = new Map<string, string>();
for (const f of files) {
    const j = JSON.parse(fs.readFileSync(path.join(root, "data/ark", f), "utf8")) as {additions: Addition[]; templates?: Record<string, {plans: string[]; weight: number}>; replaces?: Array<{slug: string; recipe: string}>; held?: Array<{slug: string; recipe: string; reason: string}>};
    additions.push(...j.additions);
    Object.assign(seeded, j.templates ?? {});
    for (const r of j.replaces ?? []) replaced.add(`${r.slug} ${r.recipe}`);
    for (const h of j.held ?? []) heldWhy.set(`${h.slug} ${h.recipe}`, h.reason);
}

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
const NEW: Record<string, {plans: string[]; weight: number}> = {dip_lay: {plans: ["flying_insect"], weight: 6}, ...seeded};
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
let superseded = 0;
const skipped: string[] = [];
const already: string[] = [];
for (const a of additions) {
    // (An original row another file shows another way: its replacement is what is applied.)
    if (replaced.has(`${a.slug} ${a.recipe}`)) {
        superseded++;
        continue;
    }
    const row = table.species[a.slug];
    const plan = planOf.get(a.slug);
    if (row === undefined || !plan) {
        skipped.push(`${a.slug} ${a.recipe}: no row`);
        continue;
    }
    if (recipesOf(row).some((r) => r.id === a.recipe)) {
        already.push(`${a.slug} ${a.recipe}`);
        continue;
    }
    // (A variant `pounce~lizard` is a way of hunting like its plain recipe: judged as it, `recipe-templates-reptiles.ts`.)
    const hunts = (id: string) => HUNTS.has(id.split("~")[0]);
    if (hunts(a.recipe) && recipesOf(row).some((r) => hunts(r.id))) {
        skipped.push(`${a.slug} ${a.recipe}: it already hunts its own way`);
        continue;
    }
    if (NEEDS_GENERATOR.has(a.recipe) || !plans.get(a.recipe)?.has(plan)) {
        skipped.push(`${a.slug} ${a.recipe}: ${heldWhy.get(`${a.slug} ${a.recipe}`) ?? (NEEDS_GENERATOR.has(a.recipe) ? "needs the generator" : `no ${plan} uses it`)}`);
        continue;
    }
    const fields = row.split("|");
    fields[0] = [fields[0], `${a.recipe}.${usual(a.recipe)}`].filter(Boolean).join(",");
    // (A nest guard's site: the generic nest field for a species whose row has none, so the schedule can place a nest for it.)
    if (a.nest && !fields[4]) fields[4] = a.nest;
    // (No longer only its plan's defaults.)
    if (fields[7]) fields[7] = fields[7].replace("d", "");
    table.species[a.slug] = fields.join("|");
    added++;
}
if (!dry) fs.writeFileSync(tablePath, `${JSON.stringify(table)}\n`);
console.log(JSON.stringify({additions: additions.length, added, already: already.length, superseded, skipped: skipped.length}, null, 1));
if (skipped.length) console.log(skipped.join("\n"));
