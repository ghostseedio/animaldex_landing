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
 * Wave 2 (small bodies: arthropods; `recipe-small.ts`): a held row is released by a variant template written for its
 * body (`variant_of` keeps the wave-1 recipe), or by a plan the original template is checked on (`also` in `data/ark/signature-templates-small.json`). An
 * addition may carry `line` (the species' own sentence for what the recipe shows: written to
 * `src/ark-scene/signature-lines.json`, the log's table; the test of that table holds it to its rules) and `replaces`
 * (a generic recipe the species' own displaces: a jumping spider's dance for the generic display) or `held` (why a row stays out).
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
// (Every `data/ark/signature-recipes*.json`: the first wave's, and a lane's own: its `additions`, and its `templates`, the
// plans and the weight of a template the table has no users of yet, or the plans a reviewed variant is drawn for.)
type Addition = {slug: string; name: string; recipe: string; field?: string; quote?: string; nest?: string; line?: string; replaces?: string; held?: string};
const files = fs.readdirSync(path.join(root, "data/ark")).filter((f) => /^signature-recipes.*\.json$/.test(f)).sort();
const additions: Addition[] = [];
const seeded: Record<string, {plans: string[]; weight: number}> = {};
// (`replaces`: held rows another file's addition now shows another way, not listed as held; `held`: rows held again, with why.)
const replaced = new Set<string>();
const heldWhy = new Map<string, string>();
// (Lane SIG7: coat variants aboard as species of their own, with no row: each takes its parent's, less `without`.)
// (SPECIES-ANIM-B2, 2026-11-24: `over`, a breed is its parent too: it takes the parent's row over the generator's own,
// whose row for a domestic breed is a plain quadruped's, none of its parent's acts.)
type Coats = {of: string; without: string[]; slugs: string[]; over?: boolean};
const coats: Coats[] = [];
// (Lane SIG9: `withdraw`, a generated row a lane takes out of the table again, with why: one that reads wrong once it can
// run, a bufflehead's strut on land when its courtship is on the water.)
const withdrawn: Array<{slug: string; recipe: string; reason: string}> = [];
// (Lane SIG10: a sleep posture a species' own sleep text gives that the sleep generator has no word for: a night beetle, a
// hermit crab or a slug that spends the day buried in litter, sand or soil (`buried`). Its other postures stay as alts.)
type SleepPostureRow = {slug: string; posture: string; alts?: string[]; field: string; quote: string};
const sleepPostures: SleepPostureRow[] = [];
for (const f of files) {
    const j = JSON.parse(fs.readFileSync(path.join(root, "data/ark", f), "utf8")) as {additions: Addition[]; templates?: Record<string, {plans: string[]; weight: number}>; replaces?: Array<{slug: string; recipe: string}>; held?: Array<{slug: string; recipe: string; reason: string}> | Record<string, string>; coats?: Coats; withdraw?: Array<{slug: string; recipe: string; reason: string}>; sleeps?: SleepPostureRow[]};
    additions.push(...j.additions);
    withdrawn.push(...(j.withdraw ?? []));
    sleepPostures.push(...(j.sleeps ?? []));
    if (j.coats) coats.push(j.coats);
    Object.assign(seeded, j.templates ?? {});
    for (const r of j.replaces ?? []) replaced.add(`${r.slug} ${r.recipe}`);
    // (A lane's held catalogue rows by name, which are not wave-1 rows, are its own list: only the wave-1 rows' are read here.)
    if (Array.isArray(j.held)) for (const h of j.held) heldWhy.set(`${h.slug} ${h.recipe}`, h.reason);
}
// sig2 (mammals): how a species sleeps with its kind, and where its source is kept.
const sleepPath = path.join(root, "src/ark-scene/sleep.json");
const sleepTable = JSON.parse(fs.readFileSync(sleepPath, "utf8")) as {species: Record<string, string>};
const sleepStylesPath = path.join(root, "data/ark/sleep-styles.json");
const sleepStyles = JSON.parse(fs.readFileSync(sleepStylesPath, "utf8")) as {species: Array<{slug: string; social: string; src: Record<string, unknown>}>};
const linesPath = path.join(root, "src/ark-scene/signature-lines.json");
const lines = JSON.parse(fs.readFileSync(linesPath, "utf8")) as {species: Record<string, Record<string, string>>};

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
    worm_dig: {plans: ["quadruped"], weight: 4},
    // (Lane SIG-OTHER: territory and display flights.)
    sally_chase: {plans: ["flying_insect"], weight: 5},
    patrol_low: {plans: ["flying_insect"], weight: 4},
    display_flight: {plans: ["walking_bird", "flying_bird"], weight: 6},
    ...seeded
};
for (const [id, seed] of Object.entries(NEW)) {
    for (const plan of seed.plans) (plans.get(id) ?? plans.set(id, new Set()).get(id)!).add(plan);
    if (!weights.has(id)) weights.set(id, new Map([[seed.weight, 1]]));
}
// Wave 2, the small bodies (`src/ark-scene/recipe-small.ts`): its templates' plans and weights, and the plans a wave-1
// template is also checked on (the behaviours harness's frames), in `data/ark/signature-templates-small.json`.
{
    const seeds = JSON.parse(fs.readFileSync(path.join(root, "data/ark/signature-templates-small.json"), "utf8")) as {templates: Record<string, {plans: string[]; weight: number}>; also: Record<string, string[]>};
    for (const [id, seed] of Object.entries(seeds.templates)) {
        for (const plan of seed.plans) (plans.get(id) ?? plans.set(id, new Set()).get(id)!).add(plan);
        if (!weights.has(id)) weights.set(id, new Map([[seed.weight, 1]]));
    }
    for (const [id, extra] of Object.entries(seeds.also)) for (const plan of extra) (plans.get(id) ?? plans.set(id, new Set()).get(id)!).add(plan);
}
const usual = (id: string) => [...(weights.get(id) ?? new Map([[3, 1]]))].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0];
// (A nest needs the row's nest field, which only the generator writes.)
const NEEDS_GENERATOR = new Set(["nest_build"]);
// The ways of hunting: a species that already has one keeps it (a second would halve the hunts its own text put first;
// an osprey's talon grab is its plunge).
const HUNTS = new Set(["perch_plunge", "air_plunge", "talon_grab", "wade_spear", "bill_sweep", "pouch_scoop", "surface_dive", "chase_fish", "river_fish", "pounce", "hawk_insects", "aerial_hawk", "hover_drop", "bat_hawk", "bat_trawl", "night_hawk", "edge_ambush", "sit_snap"]);

let added = 0;
let superseded = 0;
const skipped: string[] = [];
const already: string[] = [];
const birds = loadBirds(root);
// (sig2: rows held after their frames were looked at, `data/ark/signature-holds.json`, each with why: never drawn, no sentence in the log.)
const holdsPath = path.join(root, "data/ark/signature-holds.json");
const holds = new Map<string, string>(fs.existsSync(holdsPath) ? (JSON.parse(fs.readFileSync(holdsPath, "utf8")) as {held: Array<{slug: string; recipe: string; reason: string}>}).held.map((h) => [`${h.slug} ${h.recipe}`, h.reason]) : []);
for (const a of additions) {
    if (holds.has(`${a.slug} ${a.recipe}`)) {
        skipped.push(`${a.slug} ${a.recipe}: held (frames): ${holds.get(`${a.slug} ${a.recipe}`)}`);
        if (lines.species[a.slug]) delete lines.species[a.slug][a.recipe];
        continue;
    }
    // (A bird row wave 2 handles: it is shown by its own bird recipe, below.)
    if (birdHandles(birds.rows, a.slug, a.recipe)) continue;
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
    // (A row held back for a reason of its own: kept in the data with it, never drawn.)
    if (a.held) {
        skipped.push(`${a.slug} ${a.recipe}: ${a.held}`);
        continue;
    }
    // (A sentence is kept only for a recipe the species has: the table's test.)
    const say = () => {
        if (a.line) (lines.species[a.slug] ??= {})[a.recipe] = a.line;
    };
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
        if (a.nest && a.recipe === "nest_build") {
            const f = row.split("|");
            while (f.length < 8) f.push("");
            if (!f[4]) f[4] = a.nest;
            if (!f[7].includes("o")) f[7] += "o";
            table.species[a.slug] = f.join("|");
        }
        say();
        already.push(`${a.slug} ${a.recipe}`);
        continue;
    }
    // (A variant `pounce~lizard` is a way of hunting like its plain recipe: judged as it, `recipe-templates-reptiles.ts`.)
    const hunts = (id: string) => HUNTS.has(id.split("~")[0]);
    if (hunts(a.recipe) && recipesOf(row).some((r) => hunts(r.id))) {
        skipped.push(`${a.slug} ${a.recipe}: it already hunts its own way`);
        continue;
    }
    const generated = NEEDS_GENERATOR.has(a.recipe) && !a.nest;
    if (generated || !plans.get(a.recipe)?.has(plan)) {
        skipped.push(`${a.slug} ${a.recipe}: ${heldWhy.get(`${a.slug} ${a.recipe}`) ?? (generated ? "needs the generator" : `no ${plan} uses it`)}`);
        continue;
    }
    const fields = row.split("|");
    // (Its own displaces the generic one it stands in for.)
    if (a.replaces) fields[0] = fields[0].split(",").filter((r) => r.slice(0, r.lastIndexOf(".")) !== a.replaces).join(",");
    fields[0] = [fields[0], `${a.recipe}.${usual(a.recipe)}`].filter(Boolean).join(",");
    // (A nest of its own, where the generator found none: kind:material+material; flag `o`: the props do not draw it, the recipe does.
    // A nest guard's site, sig2 reptiles: the generic nest field for a species whose row has none, so the schedule can place a nest for it.)
    if (a.nest && !fields[4]) fields[4] = a.nest;
    while (fields.length < 8) fields.push("");
    // (No longer only its plan's defaults.)
    if (fields[7]) fields[7] = fields[7].replace("d", "");
    if (a.nest && a.recipe === "nest_build" && !fields[7].includes("o")) fields[7] += "o";
    table.species[a.slug] = fields.join("|");
    say();
    added++;
}
for (const w of withdrawn) {
    const row = table.species[w.slug];
    if (!row) continue;
    const fields = row.split("|");
    const acts = fields[0].split(",").filter((a) => a && a.replace(/\.\d+$/, "") !== w.recipe);
    if (acts.length === fields[0].split(",").filter(Boolean).length) continue;
    fields[0] = acts.join(",");
    table.species[w.slug] = fields.join("|");
    skipped.push(`${w.slug} ${w.recipe}: withdrawn: ${w.reason}`);
}
// (SIG3: a held sleep row is taken out of the sleep layer too: the generator found the huddle in the species' own text, so a
// hold that says it reads wrong has to switch it off, not only keep a second copy out. Each sleeps a little apart instead.)
for (const [key, reason] of holds) {
    const [slug, recipe] = key.split(" ");
    if (!recipe?.startsWith("sleep:")) continue;
    const f = (sleepTable.species[slug] ?? "").split("|");
    if (f.length < 3 || f[2] !== recipe.slice("sleep:".length)) continue;
    f[2] = "";
    sleepTable.species[slug] = f.join("|").replace(/\|+$/, "");
    const style = sleepStyles.species.find((x) => x.slug === slug);
    if (style) {
        style.social = "apart";
        style.src.social = {rule: `held (signature-holds.json): ${reason.slice(0, 160)}`};
    }
}
let postured = 0;
for (const sp of sleepPostures) {
    const f = (sleepTable.species[sp.slug] ?? "still").split("|");
    const alts = (sp.alts ?? []).join(",");
    if (f[0] === sp.posture && (f[1] ?? "") === alts) continue;
    f[0] = sp.posture;
    while (f.length < 2) f.push("");
    f[1] = alts;
    sleepTable.species[sp.slug] = f.join("|").replace(/\|+$/, "");
    const style = sleepStyles.species.find((x) => x.slug === sp.slug) as {posture?: string; alts?: string[]; src: Record<string, unknown>} | undefined;
    if (style) {
        style.posture = sp.posture;
        style.alts = sp.alts ?? [];
        style.src.posture = {field: sp.field, phrase: sp.quote};
    }
    postured++;
}
// (Lane SIG7: a coat variant (a bicolor domestic cat) is the same animal as its parent: its parent's row, sleep row and
// sentences, less the acts whose clips its rig lacks. Only where the generator gave it no row of its own.)
let coated = 0;
for (const c of coats) {
    const parent = table.species[c.of];
    if (!parent) {
        skipped.push(`${c.of} coats: no parent row`);
        continue;
    }
    const fields = parent.split("|");
    fields[0] = fields[0].split(",").filter((r) => r && !c.without.includes(r.slice(0, r.lastIndexOf(".")))).join(",");
    const row = fields.join("|");
    for (const slug of c.slugs) {
        if (planOf.has(slug) && !c.over) {
            skipped.push(`${slug} coat of ${c.of}: it has a row of its own`);
            continue;
        }
        table.species[slug] = row;
        if (sleepTable.species[c.of]) sleepTable.species[slug] = sleepTable.species[c.of];
        const own = Object.entries(lines.species[c.of] ?? {}).filter(([recipe]) => !c.without.includes(recipe));
        if (own.length) lines.species[slug] = Object.fromEntries(own);
        else delete lines.species[slug];
        coated++;
    }
}
// Wave 2, birds: the recipes (and the nests and flags the rows' sentences give), the roosts' sleep, the log lines.
const birdReport = applyBirdRecipes(table, birds.rows);
const birdSleep = applyBirdSleep(sleepTable, sleepStyles as unknown as {species: Array<Record<string, unknown>>}, birds.rows);
const birdLines = applyBirdLines(lines, birds.rows);
// (A species whose every sentence was a held row's keeps no empty entry.)
for (const [slug, own] of Object.entries(lines.species)) if (!Object.keys(own).length) delete lines.species[slug];
if (!dry) {
    fs.writeFileSync(tablePath, `${JSON.stringify(table)}\n`);
    fs.writeFileSync(sleepPath, `${JSON.stringify(sleepTable)}\n`);
    fs.writeFileSync(sleepStylesPath, `${JSON.stringify(sleepStyles, null, 1)}\n`);
    fs.writeFileSync(linesPath, JSON.stringify(lines));
}
console.log(JSON.stringify({additions: additions.length, added, already: already.length, superseded, coated, postured, skipped: skipped.length, birds: {rows: birds.rows.length, added: birdReport.added.length, already: birdReport.already.length, missing: birdReport.missing.length, sleepRows: birdSleep, lines: birdLines, notShown: birds.notShown.map((n) => `${n.slug} ${n.was}`)}}, null, 1));
if (skipped.length) console.log(skipped.join("\n"));
if (birdReport.missing.length) console.log(birdReport.missing.join("\n"));
