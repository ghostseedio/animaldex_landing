#!/usr/bin/env -S npx tsx
/**
 * Dragonflies laying their eggs (3.3 batch, lane D; owner 2026-11-16): which species dip the abdomen's tip to the water,
 * from the catalogue alone (AnimalDex docs/ark/signature-behaviours.json: rows whose `uses` is the catalogue's own
 * `clip:dragonfly_dip_oviposit`, the female alone, or `clip:tandem_dip_oviposit`, the pair in tandem).
 *
 * Writes `data/ark/egg-dip.json` (every such row, with its quote and its sentence, and whether the scene draws it), adds
 * the drawn ones to `data/ark/signature-recipes.json` (recipe `dip_lay`; then run `scripts/ark-signature-recipes.mts`)
 * and their sentences to `src/ark-scene/signature-lines.json`. A pair in tandem is not drawn yet (the recipe is one
 * female's): those rows are kept in the data, marked, and given neither recipe nor sentence. The log's table names no
 * sex (its test): "her" in a sentence becomes "its", a clause about the male is dropped. A sentence that names rain's
 * temporary pools (`when: rain`) is held back (the scene's water is standing): that species keeps the generic line.
 *
 *   npx tsx scripts/ark-egg-dip.mts <path to signature-behaviours.json>
 */
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const source = process.argv[2];
if (!source) throw new Error("usage: ark-egg-dip.mts <signature-behaviours.json>");
type Row = {id: string; name: string; behaviour: string; quote: string; showable: boolean; how: string; uses: string; when: string; line: string};
const rows = (JSON.parse(fs.readFileSync(source, "utf8")) as {rows: Row[]}).rows.filter((r) => r.showable && /^clip:(dragonfly|tandem)_dip_oviposit$/.test(r.uses));
const table = JSON.parse(fs.readFileSync(path.join(root, "src/ark-scene/recipes.json"), "utf8")) as {species: Record<string, string>};
const slugOf = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const neutral = (line: string) => line.replace(/, the male [^,]*$/i, "").replace(/\bher\b/g, "its");

const species = rows
    .map((r) => {
        const slug = slugOf(r.name);
        const tandem = r.uses === "clip:tandem_dip_oviposit";
        const known = slug in table.species;
        return {slug, id: r.id, name: r.name, behaviour: r.behaviour, quote: r.quote, when: r.when, uses: r.uses, line: r.line, mode: tandem ? "tandem" : "female", drawn: known && !tandem, ...(r.when === "rain" ? {lineHeld: "its sentence names a temporary rain pool; the scene's water is standing"} : {}), ...(tandem ? {held: "a pair in tandem is not drawn yet"} : known ? {} : {held: "no row in the scene's recipes"})};
    })
    .sort((a, b) => a.slug.localeCompare(b.slug));
fs.writeFileSync(path.join(root, "data/ark/egg-dip.json"), `${JSON.stringify({about: "Dragonflies laying their eggs by dipping the abdomen's tip to the water: every catalogue row that says so (AnimalDex docs/ark/signature-behaviours.json, uses clip:dragonfly_dip_oviposit or clip:tandem_dip_oviposit), with the species' own sentence. drawn: the scene gives it the recipe dip_lay (the female alone); held: why not. Built by scripts/ark-egg-dip.mts.", version: "egg-dip-1", species}, null, 1)}\n`);

const drawn = species.filter((s) => s.drawn);
const additionsPath = path.join(root, "data/ark/signature-recipes.json");
const additions = JSON.parse(fs.readFileSync(additionsPath, "utf8")) as {additions: Array<{slug: string; name: string; recipe: string; behaviour: string; field: string; quote: string}>};
for (const s of drawn) {
    if (additions.additions.some((a) => a.slug === s.slug && a.recipe === "dip_lay")) continue;
    additions.additions.push({slug: s.slug, name: s.name, recipe: "dip_lay", behaviour: s.behaviour, field: "catalogue", quote: s.quote});
}
fs.writeFileSync(additionsPath, JSON.stringify(additions, null, 1));

const linesPath = path.join(root, "src/ark-scene/signature-lines.json");
const lines = JSON.parse(fs.readFileSync(linesPath, "utf8")) as {species: Record<string, Record<string, string>>};
for (const s of drawn) {
    // (A sentence that names weather or a place the recipe does not guarantee is not said: the generic line stands.)
    if ("lineHeld" in s) {
        delete lines.species[s.slug]?.dip_lay;
        if (lines.species[s.slug] && !Object.keys(lines.species[s.slug]).length) delete lines.species[s.slug];
    }
    else (lines.species[s.slug] ??= {}).dip_lay = neutral(s.line);
}
fs.writeFileSync(linesPath, JSON.stringify(lines));
console.log(JSON.stringify({rows: rows.length, drawn: drawn.map((s) => `${s.slug}: ${neutral(s.line)}`), held: species.filter((s) => !s.drawn).map((s) => `${s.slug}: ${s.held}`)}, null, 1));
