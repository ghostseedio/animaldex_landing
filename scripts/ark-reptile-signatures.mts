#!/usr/bin/env -S npx tsx
/**
 * Signature behaviours, wave 2, lane SIG2-REPTILES (AnimalDex docs/ark/behaviours-plan.md, decisions 367 and 369): the
 * held rows of wave 1 whose model body plan is `reptile` (lizards, geckos, crocodilians) or `turtle` (tortoises, sea
 * turtles). `scripts/ark-signature-recipes.mts` held them because their recipe is written for another body plan; here
 * each is given the recipe that shows it on its own body (`src/ark-scene/recipe-templates-reptiles.ts`: the variants
 * `pounce~lizard`, `dig_burrow~nest`, `wallow~turtle`, `probe_feed~turtle`, `beach_nest~bank`, `incubate_sit~reptile`,
 * and the plain `dig_burrow` / `probe_feed` where a look at them on a tortoise and a skink said they fit), or is held
 * again with the reason written down.
 *
 * Every row is the catalogue's own (AnimalDex docs/ark/signature-behaviours.json: the species, the behaviour and the quote
 * are read from it and must be an exact span of its field); the log sentence is the catalogue's own line where the 3D
 * shows what it says, else cut to what the 3D shows (a sentence about sleeping, shade or a season the recipe does not
 * guarantee). The log's table names no sex ("her" becomes "its").
 *
 * Writes `data/ark/signature-recipes-reptiles.json` (the additions, which `ark-signature-recipes.mts` applies to the
 * scene's table, and the templates' plans and weights), their sentences into `src/ark-scene/signature-lines.json` and
 * `src/ark-scene/micro-ambush.json` (the small clingers' sit-and-wait hunting hours, `micro-ambush.ts`). Idempotent.
 *
 *   npx tsx scripts/ark-reptile-signatures.mts <path to signature-behaviours.json>
 *   npx tsx scripts/ark-signature-recipes.mts
 */
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const source = process.argv[2];
if (!source) throw new Error("usage: ark-reptile-signatures.mts <signature-behaviours.json>");
type Row = {id: string; name: string; behaviour: string; source_field: string; quote: string; showable: boolean; how: string; uses: string; when: string; line: string};
const rows = (JSON.parse(fs.readFileSync(source, "utf8")) as {rows: Row[]}).rows;
const slugOf = (name: string) => name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/['’]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

type Plan = {slug: string; behaviour: string; recipe: string; /** The sentence the log says (the catalogue's own when absent). */ line?: string; /** Its hours when it is a small clinger on the micro surfaces (a wall, a rock). */ micro?: "night" | "day"; nest?: string};
// The rows, by species: the catalogue's behaviour (an exact string), the recipe that shows it.
const PLAN: Plan[] = [
    // MARK: Tortoises
    {slug: "aldabra-giant-tortoise", behaviour: "female lays eggs in soil nest and leaves", recipe: "dig_burrow~nest", line: "{aAnimal} is laying its eggs in a nest in the soil"},
    {slug: "leopard-tortoise", behaviour: "female digs nest", recipe: "dig_burrow~nest", line: "{aAnimal} is digging a nest in the soil for its clutch"},
    {slug: "russian-tortoise", behaviour: "digs metre-long burrows with strong forelimbs", recipe: "dig_burrow"},
    {slug: "sulcata-tortoise", behaviour: "excavates deep burrows and retreats in midday heat/drought", recipe: "dig_burrow", line: "{aAnimal} is excavating a deep burrow"},
    {slug: "aldabra-giant-tortoise", behaviour: "rests in shade and wallows in heat", recipe: "wallow~turtle", line: "{aAnimal} is wallowing to ride out the heat"},
    {slug: "asian-forest-tortoise", behaviour: "pushes into damp leaf litter or mud for hours on warm days", recipe: "wallow~turtle", line: "{aAnimal} is pushing itself down into damp litter or soft mud"},
    {slug: "galapagos-tortoise", behaviour: "sleeps half-submerged in mud wallows", recipe: "wallow~turtle", line: "{aAnimal} is settling half-submerged into a mud wallow"},
    // MARK: A sea turtle and a lizard on the forest floor
    {slug: "hawksbill-sea-turtle", behaviour: "probes beak into coral crevices for sponges", recipe: "probe_feed~turtle"},
    {slug: "indonesian-blue-tongued-skink", behaviour: "forages through leaf litter; shelters in midday heat", recipe: "probe_feed~lizard", line: "{aAnimal} is foraging through the leaf litter"},
    // MARK: Nests on the bank, and nests guarded
    {slug: "mugger-crocodile", behaviour: "digs nest hole in sandy bank", recipe: "beach_nest~bank"},
    {slug: "amboina-sailfin-lizard", behaviour: "female buries eggs in bank nest", recipe: "beach_nest~bank", line: "{aAnimal} is digging a shallow nest on the bank and burying its eggs"},
    {slug: "siamese-crocodile", behaviour: "female guards nest", recipe: "incubate_sit~reptile", line: "{aAnimal} is guarding its nest", nest: "other:"},
    {slug: "philippine-crocodile", behaviour: "female guards nest near water", recipe: "incubate_sit~reptile", line: "{aAnimal} is guarding its nest", nest: "other:"},
    {slug: "red-tegu", behaviour: "female lines nest with plants and guards it", recipe: "incubate_sit~reptile", line: "{aAnimal} is staying to guard its nest", nest: "other:"},
    // MARK: Sit-and-wait hunters: the scheduled lizard, and the small clingers on a wall or a rock (`micro-ambush.ts`)
    {slug: "oriental-garden-lizard", behaviour: "hunts from a perch with short rapid attack", recipe: "pounce~lizard", line: "{aAnimal} is watching its surroundings, then making a short, rapid attack"},
    {slug: "brazilian-lava-lizard", behaviour: "motionless on rock then dashes out at insect", recipe: "pounce~lizard", micro: "day"},
    {slug: "bocages-wall-lizard", behaviour: "dash from basking spot to catch insects", recipe: "pounce~lizard", micro: "day", line: "{aAnimal} is dashing out from its basking spot at an insect"},
    {slug: "leopard-gecko", behaviour: "waits at burrow mouths for insects", recipe: "pounce~lizard", micro: "night", line: "{aAnimal} is waiting at a burrow mouth for passing insects, then dashing at one"},
    {slug: "common-house-gecko", behaviour: "hunts insects at lit walls at night", recipe: "pounce~lizard", micro: "night"},
    {slug: "common-wall-gecko", behaviour: "waits motionless beside wall lamps for moths", recipe: "pounce~lizard", micro: "night", line: "{aAnimal} is clinging motionless beside a wall lamp until a moth comes within reach"},
    {slug: "mediterranean-house-gecko", behaviour: "waits by lamps at night to snap moths", recipe: "pounce~lizard", micro: "night"},
    {slug: "tropical-house-gecko", behaviour: "waits beside lamps at night to snap insects", recipe: "pounce~lizard", micro: "night"}
];

// What each template needs the table to know: the body plans of `behaviour-recipes.json` it is drawn for (the guard of
// `ark-signature-recipes.mts` reads this, as it reads `dip_lay`'s) and the weight it takes where nothing else says.
// The plain `dig_burrow` and `probe_feed` are allowed for these plans after a look at them on a tortoise and a skink.
const TEMPLATES = {
    "pounce~lizard": {plans: ["lizard"], weight: 6},
    "dig_burrow~nest": {plans: ["turtle"], weight: 5},
    "wallow~turtle": {plans: ["turtle"], weight: 5},
    "probe_feed~turtle": {plans: ["turtle"], weight: 5},
    // (SIG3: the skink's own, its body flat: the plain probe's bill tip stood it on its nose.)
    "probe_feed~lizard": {plans: ["lizard"], weight: 5},
    "beach_nest~bank": {plans: ["lizard"], weight: 5},
    "incubate_sit~reptile": {plans: ["lizard"], weight: 5},
    dig_burrow: {plans: ["turtle"], weight: 5},
    probe_feed: {plans: ["lizard"], weight: 5}
};

// Held again, with the reason.
const HELD = [
    {slug: "tokay-gecko", behaviour: "may guard eggs stuck to surfaces", recipe: "incubate_sit", reason: "its eggs are stuck to a wall or a trunk; the nest guard is a lying-over of a mound on the ground, which is another animal's"},
    {slug: "southeastern-five-lined-skink", behaviour: "female coils around her clutch until it hatches", recipe: "incubate_sit", reason: "a small clinger on the leaf litter (a micro animal, off the schedule), and no clutch of eggs is drawn without the server's record of laying; a coil around nothing would show nothing"}
];

const additions: Array<Record<string, unknown>> = [];
// Wave 1's held rows these variants replace: (species, the recipe wave 1 named): read from wave 1's own file.
const wave1 = (JSON.parse(fs.readFileSync(path.join(root, "data/ark/signature-recipes.json"), "utf8")) as {additions: Array<{slug: string; recipe: string; behaviour: string}>}).additions;
const replaces: Array<{slug: string; recipe: string}> = [];
const lines = new Map<string, Record<string, string>>();
const micro: Record<string, string> = {};
const report: string[] = [];
for (const p of PLAN) {
    const row = rows.find((r) => r.showable && slugOf(r.name) === p.slug && r.behaviour === p.behaviour);
    if (!row) throw new Error(`no catalogue row: ${p.slug} / ${p.behaviour}`);
    additions.push({slug: p.slug, name: row.name, recipe: p.recipe, behaviour: row.behaviour, field: row.source_field, quote: row.quote, ...(p.nest ? {nest: p.nest} : {}), ...(p.micro ? {micro: p.micro} : {})});
    const line = p.line ?? row.line.replace(/\bher\b/g, "its");
    (lines.get(p.slug) ?? lines.set(p.slug, {}).get(p.slug)!)[p.recipe] = line;
    if (p.micro) micro[p.slug] = p.micro;
    // (Wave 1's row of this species and behaviour named a plain recipe: the variant stands for it.)
    const original = wave1.find((w) => w.slug === p.slug && w.behaviour === row.behaviour);
    if (original && original.recipe !== p.recipe) replaces.push({slug: p.slug, recipe: original.recipe});
    report.push(`${p.slug} ${p.recipe}: ${line}`);
}
for (const h of HELD) if (!rows.some((r) => r.showable && slugOf(r.name) === h.slug && r.behaviour === h.behaviour)) throw new Error(`no catalogue row: ${h.slug} / ${h.behaviour}`);

fs.writeFileSync(
    path.join(root, "data/ark/signature-recipes-reptiles.json"),
    `${JSON.stringify({about: "Signature behaviours, wave 2, the reptile and turtle plans (lane SIG2-REPTILES): the rows wave 1 held (data/ark/signature-recipes.json) for lizards, geckos, crocodilians, tortoises and sea turtles, each with the recipe that shows it on its own body (src/ark-scene/recipe-templates-reptiles.ts). Built by scripts/ark-reptile-signatures.mts from AnimalDex docs/ark/signature-behaviours.json; applied by scripts/ark-signature-recipes.mts. templates: the plans a template is drawn for and its weight; held: the rows still held and why.", version: "reptiles-1", templates: TEMPLATES, replaces, additions, held: HELD}, null, 1)}\n`
);

const linesPath = path.join(root, "src/ark-scene/signature-lines.json");
const table = JSON.parse(fs.readFileSync(linesPath, "utf8")) as {species: Record<string, Record<string, string>>};
for (const [slug, own] of lines) Object.assign((table.species[slug] ??= {}), own);
fs.writeFileSync(linesPath, JSON.stringify(table));

// The small clingers' hunting hours.
fs.writeFileSync(path.join(root, "src/ark-scene/micro-ambush.json"), `${JSON.stringify({about: "Small clingers that hunt by sit-and-wait (lane SIG2-REPTILES): which hours each sits still and dashes at an insect (micro-ambush.ts), from the catalogue's own `when` (data/ark/signature-recipes-reptiles.json).", version: "micro-ambush-1", species: micro})}\n`);
console.log(JSON.stringify({rows: PLAN.length, held: HELD.map((h) => `${h.slug}: ${h.reason}`), lines: report}, null, 1));
