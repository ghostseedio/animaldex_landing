#!/usr/bin/env -S npx tsx
/**
 * Shaking off the water (owner 2026-11-16: "animals like geese who normally shake upon getting out of the water - can
 * we do that"): which species shake when they climb out, by rule over data already stored, never by hand.
 *
 * The catalogue of each species' own text (AnimalDex docs/ark/signature-behaviours.json) has no row that says a species
 * shakes water off (its "shake" rows are head shakes, a peacock's train, a web, flies off a zebu's skin): it gives none.
 * So the list is built from the two other stored sources the scene already reads:
 *   - `data/ark/behaviour-profiles.json` `water`: the species goes into the water in the Ark at all (only those ever
 *     climb out: the schedule's crossings are for amphibious profiles);
 *   - `data/ark/behaviour-recipes.json` `crossing`: how it leaves the water and what it does after (the taxonomy rules
 *     of scripts/ark-behaviour-compose.mts: "family Anatidae (launches onto the water)", "family Mustelidae (dives in
 *     from the bank)", "class Mammalia: wades in, shakes off after");
 *   - each model's `ark.json` `behaviour.idle.shake` (0 never … 3 often; the talking models' profiles, AnimalDex
 *     scripts/talking-models/behaviour/profiles.json, which the bucket's ark.json files carry as written).
 *
 * The rule:
 *   1. waterfowl, the owner's own example (geese, ducks, swans): a species whose crossing rule is family Anatidae and
 *      that goes into the water. They shake the body and then flap the wings with the head stretched up, then preen;
 *   2. a mammal whose crossing says it shakes off after AND whose model shakes sometimes or often (idle.shake >= 2)
 *      AND that goes into the water: the otters, a Labrador, a bush dog, a polar bear, a rakali, a bearded pig.
 * Nothing else (seals haul out and lie; penguins, rails and grebes preen by their own rules; a beaver's, a capybara's
 * or a platypus's model shakes rarely, so they are left out).
 *
 * Writes `src/ark-scene/water-shake.json` ({species: {<model_slug>: ["w" wings | "b" body only, why]}}).
 *
 *   npx tsx scripts/ark-water-shake.mts [--idle <profiles.json>] [--dry]
 */
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const at = process.argv.indexOf("--idle");
const idlePath = at > 0 ? process.argv[at + 1] : path.join(root, "..", "AnimalDex", "scripts", "talking-models", "behaviour", "profiles.json");
const dry = process.argv.includes("--dry");

type Recipe = {slug: string; name: string; plan: string; crossing?: {entry: string; exit: string; after: string; src?: {rule?: string; default?: string; field?: string; phrase?: string}}};
type Profile = {slug: string; water: string | null; excluded: unknown};
const recipes = Object.values((JSON.parse(fs.readFileSync(path.join(root, "data/ark/behaviour-recipes.json"), "utf8")) as {species: Record<string, Recipe>}).species);
const profilesRaw = (JSON.parse(fs.readFileSync(path.join(root, "data/ark/behaviour-profiles.json"), "utf8")) as {profiles: Profile[] | Record<string, Profile>}).profiles;
const profiles = new Map((Array.isArray(profilesRaw) ? profilesRaw : Object.values(profilesRaw)).map((p) => [p.slug, p]));
const idle = JSON.parse(fs.readFileSync(idlePath, "utf8")) as Record<string, {idle?: Record<string, number>}>;

const species: Record<string, [string, string]> = {};
const left: string[] = [];
for (const r of recipes) {
    const profile = profiles.get(r.slug);
    const c = r.crossing;
    if (!profile || profile.excluded || !profile.water || !c) continue;
    const shake = idle[r.slug]?.idle?.shake ?? null;
    const rule = c.src?.rule ?? c.src?.default ?? c.src?.phrase ?? "";
    if (/family Anatidae/.test(rule)) species[r.slug] = ["w", `${rule}; water ${profile.water}; idle.shake ${shake ?? "-"}`];
    else if (c.after === "shake" && shake !== null && shake >= 2) species[r.slug] = ["b", `${rule}; water ${profile.water}; idle.shake ${shake}`];
    else if (c.after === "shake") left.push(`${r.slug} (idle.shake ${shake ?? "-"})`);
}
const sorted = Object.fromEntries(Object.entries(species).sort(([a], [b]) => a.localeCompare(b)));
const table = {
    about: "Shaking off the water (owner 2026-11-16): species that shake when they climb out of the water; w: a body shake, then the wings flapped with the head stretched up (waterfowl, family Anatidae), b: a body shake (a mammal whose crossing shakes off after and whose model's idle.shake is 2 or 3). Only species that go into the water in the Ark. Built by scripts/ark-water-shake.mts; never edited by hand.",
    version: "water-shake-1",
    line: "{aAnimal} is shaking off the water",
    species: sorted
};
console.log(`${Object.keys(sorted).length} species: ${Object.values(sorted).filter((v) => v[0] === "w").length} waterfowl, ${Object.values(sorted).filter((v) => v[0] === "b").length} mammals`);
console.log(`left out (crossing shakes off, model rarely shakes): ${left.join(", ") || "none"}`);
if (!dry) fs.writeFileSync(path.join(root, "src/ark-scene/water-shake.json"), JSON.stringify(table, null, 1) + "\n");
