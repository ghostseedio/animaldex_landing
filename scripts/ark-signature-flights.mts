#!/usr/bin/env -S npx tsx
/**
 * Territory, patrol and display flights (lane SIG-OTHER, 2026-11-20): the catalogue rows (AnimalDex
 * docs/ark/signature-behaviours.json, how = flight_path) that three shared recipe templates show with the blocks the scene
 * already has:
 *   - `sally_chase`: a male holds a perch and darts out after what passes, then comes back to it (dragonflies, butterflies,
 *     a bee fly, a carpenter bee);
 *   - `patrol_low`: a male patrols low back and forth over his ground looking for a female (a wasp, moths, butterflies);
 *   - `display_flight`: a male climbs steeply from his perch and glides down in a wide arc (doves and pigeons).
 * Each species' own row (its stored text, an exact quote) is kept in `data/ark/signature-recipes-other.json`, applied to the
 * scene's table by `scripts/ark-signature-recipes.mts`, and its sentence is written to `src/ark-scene/signature-lines.json`:
 * what the scene shows of the row (a dart out and back, a low patrol, a steep climb and a glide), never what it does not
 * (the rivals chased, the wing claps). A row the templates would show wrongly is in `held` with the reason.
 *
 *   npx tsx scripts/ark-signature-flights.mts --catalogue <AnimalDex>/docs/ark/signature-behaviours.json [--dry]
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
type Row = {id: string; name: string; behaviour: string; quote: string; showable: boolean; how: string | null; uses: string | null; theme: string | null; when: string | null; effort: string | null; source_field: string | null};
const rows = (JSON.parse(fs.readFileSync(cataloguePath, "utf8")) as {rows: Row[]}).rows;
const table = JSON.parse(fs.readFileSync(path.join(root, "src/ark-scene/recipes.json"), "utf8")) as {species: Record<string, string>};
const slugOf = (name: string) => name.toLowerCase().replace(/'/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

type Pick = {name: string; says: RegExp; line: string};
const SALLY: Pick[] = [
    {name: "Scarlet Skimmer", says: /perching on a reed tip and darting out to chase rival males/, line: "{aAnimal} is darting out from its reed tip and back to it"},
    {name: "Broad-bodied Chaser", says: /flying out to chase off rival males and coming back/, line: "{aAnimal} is flying out from its pond-side perch and back to it"},
    {name: "Common Flangetail", says: /Males defend a perch and the patch of water around it/, line: "{aAnimal} is darting out from its perch and back to it"},
    {name: "Pied Paddy Skimmer", says: /territorial on a very small scale/, line: "{aAnimal} is darting out from its low perch and back to it"},
    {name: "Tropical Carpenter Bee", says: /hovering in place and chasing off other insects/, line: "{aAnimal} is darting out from its spot near the flowers and back to it"},
    {name: "Greater Bee Fly", says: /chase anything of similar size that crosses them/, line: "{aAnimal} is darting out across its sunlit clearing and back"},
    {name: "Brilliant Blue", says: /perching low and chasing off other butterflies/, line: "{aAnimal} is darting out from its low perch and back to it"},
    {name: "Great Eggfly", says: /perch on a sunlit leaf and chase almost anything/, line: "{aAnimal} is darting out from its sunlit leaf and back to it"},
    {name: "Hackberry Emperor", says: /dart out at passing butterflies/, line: "{aAnimal} is darting out from its sunlit trunk and back to it"},
    {name: "Mourning Cloak", says: /hold a sunny perch in the afternoon and chase passing butterflies/, line: "{aAnimal} is darting out from its sunny perch and back to it"},
    {name: "Red Admiral", says: /hold sunlit perches in the afternoon and fly up to chase rivals/, line: "{aAnimal} is flying up from its sunlit perch and back to it"},
    {name: "Two-tailed Pasha", says: /returns again and again to the same high perch/, line: "{aAnimal} is flying out from its high perch and back to it"}
];
const PATROL: Pick[] = [
    {name: "Giant Scoliid Wasp", says: /patrol low over the ground where females are due to emerge/, line: "{aAnimal} is patrolling low over the ground"},
    {name: "Fox Moth", says: /fly fast and low in afternoon sunshine searching for females/, line: "{aAnimal} is patrolling low over the ground in the sun"},
    {name: "Little Wood-Satyr", says: /patrolling woodland paths and edges/, line: "{aAnimal} is patrolling the woodland edge"},
    {name: "Common Rose", says: /Males patrol and hill-top/, line: "{aAnimal} is patrolling its ground"}
];
const DISPLAY: Pick[] = [
    {name: "Common Wood Pigeon", says: /climbs steeply, claps its wings, then glides down/, line: "{aAnimal} is climbing steeply and gliding down in its display flight"},
    {name: "Eurasian Collared Dove", says: /rising steeply and gliding down on spread wings/, line: "{aAnimal} is rising steeply and gliding down in its display flight"},
    {name: "Spotted Dove", says: /climbs steeply with loud wing claps, then glides down in a wide arc/, line: "{aAnimal} is climbing steeply and gliding down in a wide arc in its display flight"}
];
/** Rows the templates would show wrongly, and why. */
const HELD: Array<{name: string; says: RegExp; why: string}> = [
    {name: "Green June Beetle", says: /fly low, back and forth over turf/, why: "its body does not fly on the Ark (a crawler): a patrol on the wing would be drawn wrong"},
    {name: "Common Buzzard", says: /rollercoaster display/, why: "a steep plunge needs a flight block that dives onto a point in the air; only plunges into water exist"},
    {name: "Northern Lapwing", says: /tumbling|aerial displays/, why: "rolls and tumbles are a body attitude the flight blocks do not have"},
    {name: "Racket-tailed Roller", says: /rolling, tumbling display flights/, why: "rolls and tumbles are a body attitude the flight blocks do not have"},
    {name: "Cocoa Tussock Moth", says: /Males fly at night/, why: "a night patrol; the template is a day one"},
    {name: "Damselfly", says: /grips the female behind the head/, why: "a pair in tandem is a pair template with the male's grip: not drawn"},
    {name: "Lesser Adjutant Stork", says: /soars high on rising warm air/, why: "soaring is already in the schedule's flight beats (glide)"}
];

const find = (p: {name: string; says: RegExp}, theme?: string) => {
    const hit = rows.filter((r) => r.name === p.name && r.how === "flight_path" && r.showable && (p.says.test(r.quote) || p.says.test(r.behaviour)) && (!theme || r.theme === theme));
    if (hit.length !== 1) throw new Error(`${p.name}: ${hit.length} flight rows match ${p.says}`);
    const slug = slugOf(p.name);
    if (!(slug in table.species)) throw new Error(`${p.name}: no recipes row ${slug}`);
    return {row: hit[0], slug};
};

const additions: Array<{slug: string; name: string; recipe: string; behaviour: string; field: string; quote: string; id: string}> = [];
const lines: Record<string, Record<string, string>> = {};
const add = (recipe: string, picks: Pick[]) => {
    for (const p of picks) {
        const {row, slug} = find(p);
        additions.push({slug, name: p.name, recipe, behaviour: row.behaviour, field: row.source_field ?? "catalogue", quote: row.quote, id: row.id});
        (lines[slug] ??= {})[recipe] = p.line;
    }
};
add("sally_chase", SALLY);
add("patrol_low", PATROL);
add("display_flight", DISPLAY);
const held: Record<string, string> = {};
for (const h of HELD) {
    const hit = rows.filter((r) => r.name === h.name && r.how === "flight_path" && (h.says.test(r.quote) || h.says.test(r.behaviour)));
    if (!hit.length) throw new Error(`${h.name}: held row not found (${h.says})`);
    held[`${h.name}: ${hit[0].behaviour}`] = h.why;
}
additions.sort((a, b) => a.recipe.localeCompare(b.recipe) || a.slug.localeCompare(b.slug));

const out = {
    about: "Territory, patrol and display flights (lane SIG-OTHER), built by scripts/ark-signature-flights.mts from the species catalogue (AnimalDex docs/ark/signature-behaviours.json): each species whose own stored text states a territorial dart from a perch (sally_chase), a low patrol (patrol_low) or a steep-climb-and-glide display flight (display_flight), with the exact sentence. Applied to src/ark-scene/recipes.json by scripts/ark-signature-recipes.mts. held: rows the templates would draw wrongly, and why.",
    version: "signature-other-1",
    additions,
    held
};
console.log(`additions ${additions.length} (sally ${SALLY.length}, patrol ${PATROL.length}, display ${DISPLAY.length}), held ${Object.keys(held).length}`);
if (!process.argv.includes("--dry")) {
    fs.writeFileSync(path.join(root, "data/ark/signature-recipes-other.json"), JSON.stringify(out, null, 1) + "\n");
    // (Their sentences join the table of the species' own lines: said while the recipe's episode is in view.)
    const linesPath = path.join(root, "src/ark-scene/signature-lines.json");
    const existing = JSON.parse(fs.readFileSync(linesPath, "utf8")) as {species: Record<string, Record<string, string>>};
    for (const [slug, own] of Object.entries(lines)) existing.species[slug] = {...(existing.species[slug] ?? {}), ...own};
    fs.writeFileSync(linesPath, JSON.stringify(existing));
}
