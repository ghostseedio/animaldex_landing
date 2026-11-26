#!/usr/bin/env -S npx tsx
/**
 * The zoo's homes table (p5 (zoospace), `src/ark-scene/islands/town/zoo-homes.ts`): for every catalogue species, from its
 * stored profile (`data/ark/behaviour-profiles.json`: body plan, zone, diet, its other diets, size, activity, water role)
 * and the ecology lane's food links (`data/ark/audit-predator-prey.json`), which of the zoo's new homes it lives in when
 * the server holds it in a crowded enclosure type. Rule, no lists of animals:
 *
 * - **a hunter of its housemates' kind** (its food links name a bird for an aviary bird, a mammal for a small mammal, a
 *   reptile or amphibian for a reptile-house animal) lives in a hunters' bay of its size band (bands a factor 1.25 of
 *   body size apart, so nobody shares a bay with a hunter that much bigger than itself): the birds of prey by day and
 *   the owls by night in the raptor row, the hunting waterbirds (storks) in the stork flight, the small carnivores in
 *   their row; the reptile house's big ones (band 17 and up) in the large reptile house, its water hunters with the
 *   turtles, the rest in the snake house;
 * - aviaries: the carrion eaters of the land (vultures, condors) in the vulture aviary (first: they are no birds'
 *   hunters); the geese (a stored water role "goose": they graze ashore) on the open wetland lagoon's lawns; into the
 *   free-flight dome (`dome.ts`), no hunter and no carrion eater: every other waterbird (waders, ducks, swans,
 *   pelicans: its lagoon), and the big kinds that eat no meat or fish (size 20 or more: the flyers its canopy, the
 *   ground birds its floor, the mountain, shore and polar kinds its cliff); the small kinds keep the small aviaries;
 * - reptile house: the big land tortoises (a turtle body, grazer or browser, size 30 or more) in the tortoise paddock;
 *   the snakes in the snake house; the turtles and amphibians in the second house; the lizards stay in the first;
 * - small mammals: the big grazers (size 28 or more: capybara, wallabies, maras) in the walkabout;
 * - aquarium: the river giants (fish of rivers and lakes, size 45 or more), the river rays (a model's disc 0.58 of its
 *   length across or more, size 15 to 45: the giants eat them) and the fish-eating river schoolers (piranhas) in the
 *   river house: the giants in its big tank, the rays in their shallow sand tank, the piranhas alone in theirs.
 *
 * Everyone else keeps its type and is spread over the type's own slots, each species together (`zoo-homes.ts`
 * spreadHome): the `spread` table balances the record's species over the plots by their ground, the most numerous
 * first (from a snapshot of the live record; a species it has not seen takes a plot by its own hash).
 *
 *   npx tsx scripts/ark-zoo-homes.mts [snapshot.json]     writes src/ark-scene/islands/town/zoo-homes.json
 *                                                          (snapshot default public/ark-local/snap.json)
 */
import {existsSync, readFileSync, writeFileSync} from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
type Profile = {slug: string; zone: string; plan: string; diet: string; diets?: string[] | null; size: number; activity: string; water: string | null; social: string};
const profiles = (JSON.parse(readFileSync(path.join(root, "data/ark/behaviour-profiles.json"), "utf8")) as {profiles: Profile[]}).profiles;
const links = (JSON.parse(readFileSync(path.join(root, "data/ark/audit-predator-prey.json"), "utf8")) as {prey: Record<string, string>}).prey;
const prey = new Map<string, Profile[]>(Object.entries(links).map(([k, v]) => [k, v.split(".").map((i) => profiles[parseInt(i, 36)])]));

const {modelBase} = await import("@/ark-scene/grounding/base");
const BIRDS = new Set(["flying_bird", "walking_bird", "flightless_bird"]);
const MAMMALS = new Set(["quadruped", "primate", "bat"]);
const REPTILES = new Set(["lizard", "legless", "turtle", "amphibian"]);
/**
 * The map's body classes (`src/ark-scene/map/body.json`): the reptile house takes reptiles and amphibians only. A
 * "legless" or "lizard" body plan is a shape, not a class (SPECIES-ANIM-B2, 2026-11-24: the swallowtail caterpillar,
 * the earthworms, millipedes and eels were in with the snakes); a species with no class there keeps the plan's rule.
 */
const bodyClass = new Map<string, string>(
    Object.entries(JSON.parse(readFileSync(path.join(root, "src/ark-scene/map/body.json"), "utf8")) as Record<string, unknown>)
        .filter((entry): entry is [string, string[]] => Array.isArray(entry[1]))
        .flatMap(([cls, slugs]) => slugs.map((slug) => [slug, cls] as [string, string]))
);
const reptileHouse = (slug: string) => {
    const cls = bodyClass.get(slug);
    return cls === undefined || cls === "r" || cls === "a";
};
const huntsAmong = (p: Profile, plans: Set<string>) => (prey.get(p.slug) ?? []).some((q) => plans.has(q.plan));
/** The size band: a factor of 1.25 in body size per band. */
const band = (size: number) => Math.floor(Math.log(Math.max(size, 1)) / Math.log(1.25));

const homes: Record<string, Record<string, string>> = {};
const why: Record<string, string> = {};
for (const p of profiles) {
    const own: Record<string, string> = {};
    const b = band(p.size);
    if (BIRDS.has(p.plan)) {
        if (p.diet === "carrion" && !p.water) own.aviaries = "vultures";
        else if (huntsAmong(p, BIRDS)) own.aviaries = p.activity === "nocturnal" ? `owls:${b}` : p.water ? `waders:${b}` : `raptors:${b}`;
        else if (p.water) own.aviaries = p.water === "goose" ? "wetland" : "dome:lagoon";
        else if (p.size >= 20 && p.diet !== "meat" && p.diet !== "fish") own.aviaries = p.zone === "mountains" || p.zone === "seashore" || p.zone === "polar" ? "dome:cliff" : p.plan === "flying_bird" ? "dome:canopy" : "dome:floor";
    }
    if (MAMMALS.has(p.plan)) {
        if (huntsAmong(p, MAMMALS)) own.small_mammals = `carnivores:${b}`;
        else if (p.plan === "quadruped" && p.diet === "grazer" && p.size >= 28) own.small_mammals = "walkabout";
    }
    if (REPTILES.has(p.plan) && reptileHouse(p.slug)) {
        if (p.plan === "turtle" && (p.diet === "grazer" || p.diet === "browser") && p.size >= 30) own.reptile_house = "tortoises";
        else if (huntsAmong(p, REPTILES)) own.reptile_house = b >= 17 ? "large_reptiles" : p.water ? "turtles" : "snakes";
        else if (p.plan === "legless") own.reptile_house = "snakes";
        else if (p.plan === "turtle" || p.plan === "amphibian") own.reptile_house = "turtles";
    }
    if (p.plan === "fish" && p.zone === "river_lake") {
        // (A river ray: its model's disc at least 0.58 of its length across, too wide to turn in the tunnel's lanes.)
        const model = modelBase(p.slug);
        const disc = model ? model.size.x / Math.max(model.size.z, 0.05) >= 0.58 : false;
        if (disc && p.size >= 15 && p.size < 45) own.aquarium = "rays";
        else if (p.size >= 45) own.aquarium = "river";
        else if (p.diet === "fish" && p.social === "school") own.aquarium = "piranhas";
    }
    if (!Object.keys(own).length) continue;
    homes[p.slug] = own;
    why[p.slug] = `${p.plan} ${p.zone} ${p.diet} size ${p.size} band ${b} ${p.activity}${p.water ? ` water ${p.water}` : ""}${prey.has(p.slug) ? ` hunts ${[...new Set((prey.get(p.slug) ?? []).map((q) => q.plan))].join("/")}` : ""}`;
}
const target = path.join(root, "src/ark-scene/islands/town/zoo-homes.json");
const about =
    "Generated by scripts/ark-zoo-homes.mts from data/ark/behaviour-profiles.json (stored plan, zone, diet, size, activity, water role), data/ark/audit-predator-prey.json (the food links) and a snapshot of the live record (the spread's balance). `homes`: which of the zoo's new homes a species lives in when the server holds it in that enclosure type (keys: the server type); `<row>:<band>` is a hunters' bay by size band. `spread`: the plot of its type's own a species takes otherwise. Applied in zoo-homes.ts.";
const previous = existsSync(target) ? (JSON.parse(readFileSync(target, "utf8")) as {spread?: Record<string, Record<string, string>>}).spread ?? {} : {};
writeFileSync(target, JSON.stringify({about, homes, why, spread: previous}) + "\n");

// The spread: the record's residents who keep their type, each species to the least filled plot (by its ground), the
// most numerous species first (ties by name). Read after the homes are written (the module reads the table).
const snapPath = process.argv[2] ?? path.join(root, "public/ark-local/snap.json");
let spread: Record<string, Record<string, string>> = previous;
if (existsSync(snapPath)) {
    const {zooHomeOf, ZOO_SPREAD} = await import("@/ark-scene/islands/town/zoo-homes");
    type Row = {model_slug: string; area?: string | null; island?: string | null; enclosure?: string | null; scientific_name?: string | null};
    const zoo = (JSON.parse(readFileSync(snapPath, "utf8")) as {snapshot: {animals: Row[]}}).snapshot.animals.filter((a) => a.area === "zoo" && (a.island ?? "town") === "town");
    const counts = new Map<string, Map<string, number>>();
    for (const a of zoo) {
        const type = (a.enclosure ?? "").replace(/-\d+$/, "") as keyof typeof ZOO_SPREAD;
        const list = ZOO_SPREAD[type];
        // (Only those whose home is the spread: not the safari's, not a new home's.)
        const home = zooHomeOf({...a, area: "zoo"});
        if (!list || !home || !list.some((x) => x.id === home)) continue;
        const m = counts.get(type) ?? new Map<string, number>();
        m.set(a.model_slug, (m.get(a.model_slug) ?? 0) + 1);
        counts.set(type, m);
    }
    spread = {};
    for (const [type, m] of counts) {
        const list = ZOO_SPREAD[type as keyof typeof ZOO_SPREAD]!;
        const load = new Map(list.map((x) => [x.id, 0] as [string, number]));
        for (const [slug, n] of [...m].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))) {
            let best = list[0];
            for (const x of list) if ((load.get(x.id)! + n) / x.weight < (load.get(best.id)! + n) / best.weight - 1e-12) best = x;
            load.set(best.id, load.get(best.id)! + n);
            (spread[slug] ??= {})[type] = best.id;
        }
        console.log(type, JSON.stringify(Object.fromEntries(load)));
    }
} else console.log("no snapshot: the spread table kept as it was");
writeFileSync(target, JSON.stringify({about, homes, why, spread}) + "\n");
console.log(Object.keys(homes).length, "species with a new home,", Object.keys(spread).length, "in the spread table");
