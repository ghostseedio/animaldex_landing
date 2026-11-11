/**
 * Each species' sleep style (docs/ark/sleep.md): how it lies or stands asleep, how it sleeps with its own kind,
 * whether it closes its eyes, and how it breathes. Deterministic rules over stored data only, no AI calls:
 *
 *   1. its own stored sleep text (`species_field_guide.sleep_pattern`): "rest standing in tight huddles",
 *      "sitting pressed side by side along a branch", "hanging in dense clusters", "lying close together",
 *      "on the bottom", "vertical" (the clause has to be about resting, not feeding or breeding);
 *   2. the recipes lane's sleeping posture (`recipes.json`: one_leg, tuck, hang, curl, float, stand, huddle);
 *   3. the taxon's prior (the family, then the order and the body plan: hoofed animals lie on their chests,
 *      pigs on their sides, cats and foxes curl, horses and elephants sleep standing).
 *
 * Every field keeps its source (`{field, phrase}`, `{recipe}` or `{rule}`) in `data/ark/sleep-styles.json`; the
 * scene reads the compact rows in `src/ark-scene/sleep.json` (`sleep.ts` decodes them).
 *
 *   npx tsx scripts/ark-sleep-styles.mts <species export .json> [--audit out.tsv]
 *
 * The export is the behaviour lane's read-only one (`ark-behaviour-load.mts`: rows with slug, sleep_pattern,
 * class_name, order_name, family_name).
 */

import {readFileSync, writeFileSync} from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const exportPath = process.argv[2];
if (!exportPath) throw new Error("usage: ark-sleep-styles.mts <species export .json> [--audit out.tsv]");
const auditAt = process.argv.indexOf("--audit");
const auditPath = auditAt > 0 ? process.argv[auditAt + 1] : null;

type Row = {slug: string; sleep_pattern: string | null; class_name: string | null; order_name: string | null; family_name: string | null; parent_slug: string | null};
type Profile = {slug: string; plan: string; move: string; moves: string[]; roost: string; social: string; size: number | null; seabed: boolean; breathes: boolean; excluded: string | null};

const rows: Row[] = JSON.parse(readFileSync(exportPath, "utf8")).rows;
const bySlug = new Map(rows.map((r) => [r.slug, r]));
const profiles: Profile[] = JSON.parse(readFileSync(path.join(root, "data/ark/behaviour-profiles.json"), "utf8")).profiles;
const recipes: Record<string, string> = JSON.parse(readFileSync(path.join(root, "src/ark-scene/recipes.json"), "utf8")).species;

export type Posture = "sternal" | "side" | "curl" | "stand" | "one_leg" | "tuck" | "hang" | "float_back" | "sit" | "flat" | "bottom" | "hover" | "bottle" | "still";
export type Social = "apart" | "huddle" | "pile" | "row" | "cluster";
type Source = {field: "sleep"; phrase: string} | {recipe: string} | {rule: string};

// MARK: Text

/** The clauses of the sleep text about resting or sleeping (not its feeding, hunting or breeding). */
function restClauses(text: string): string[] {
    return text
        .split(/(?<=[.;:])\s+|,\s+(?=while|but|and then|then|where|between)/i)
        .map((c) => c.trim())
        // (A clause about the young or the larva is not the adult's sleep: "Caterpillars rest coiled in litter".)
        .filter((c) => !/^(caterpillars?|larvae?|nymphs?|grubs?|tadpoles?)\b/i.test(c))
        .filter((c) => /\b(sleep|sleeps|sleeping|slept|rest|rests|resting|roost|roosts|roosting|doz|nap|naps|hang|hangs|hanging|huddl|lying|lie|lies|bed down)/i.test(c))
        .filter((c) => !/\b(feeds?|feeding|hunts?|hunting|forag|breed|nest(s|ing)? (in|on)|lays?|eggs?)\b/i.test(c) || /\b(sleep|rest|roost|huddl|hang)/i.test(c.split(/\b(feeds?|feeding|hunts?|hunting|forag)\b/i)[0] ?? ""));
}

type Hit<T> = {value: T; phrase: string} | null;
function find<T>(clauses: string[], tests: Array<[RegExp, T]>): Hit<T> {
    for (const clause of clauses) {
        for (const [re, value] of tests) {
            if (re.test(clause) && !/\b(not|never|rarely|cannot|can't|unlike|rather than|instead of)\b[^.]{0,30}$/i.test(clause.split(re)[0] ?? "")) return {value, phrase: clause};
        }
    }
    return null;
}

const POSTURE_WORDS: Array<[RegExp, Posture]> = [
    [/\bon one leg\b|\bone-legged\b/i, "one_leg"],
    [/\bon (its|their) backs?\b/i, "float_back"],
    [/\bvertical(ly)?\b|\bbottl(e|ing)\b/i, "bottle"],
    [/\b(rests?|resting|lies|lie|lying|sleeps?|sleeping|settles?)\b[^.]{0,30}\bon the (sea ?|lake |river )?(bottom|floor|seabed|bed)\b|\bon the bottom\b/i, "bottom"],
    [/\b(hangs?|hanging|hovers?|hovering)\b[^.]{0,25}\b(still|motionless|in the water|near the bottom|low in the water|in mid-?water)\b/i, "hover"],
    [/\b(hangs?|hanging)\b[^.]{0,20}\b(upside[- ]down|from|by (its|their) feet)\b|\bupside[- ]down\b/i, "hang"],
    [/\b(standing|stands|stand) (sleep|rest|asleep)|\b(mostly|usually|often|mainly) standing\b|\b(sleeps?|rests?|dozes?|resting|sleeping) (while )?standing\b|\bon (its|their) feet\b/i, "stand"],
    // (The body coiled, not just its tail: "tail coiled" on a chameleon's branch is no curl.)
    [/\bcurl(s|ed|ing)? (up|into)|(?<!tail )\bcoil(s|ed|ing)?\b/i, "curl"],
    [/\bon (its|their) sides?\b|\bstretched out\b|\bsprawl/i, "side"],
    [/\bon (its|their) (belly|bellies|chest|chests)\b|\blegs (folded|tucked)\b/i, "sternal"],
    [/\b(bill|beak|head)s? (tucked|tucks|under|into|beneath|over)\b|\btuck(s|ed|ing)? (its|their|the) (bill|beak|head)\b/i, "tuck"]
];

const SOCIAL_WORDS: Array<[RegExp, Social]> = [
    [/\bhuddl(e|es|ed|ing)\b/i, "huddle"],
    [/\b(lying|lie|sleep(ing)?|rest(ing)?) close together\b|\bin (a )?(pile|heap)s?\b|\bpiles? (up|together)\b/i, "pile"],
    [/\bside by side\b|\bin (a )?rows?\b|\bshoulder to shoulder\b|\b(lined|lines) up\b/i, "row"],
    [/\bclusters?\b|\bclustered\b/i, "cluster"]
];

// MARK: Taxon priors

const HOOFED_LYING = new Set(["Bovidae", "Cervidae", "Camelidae", "Antilocapridae", "Tragulidae", "Moschidae", "Hippopotamidae", "Rhinocerotidae", "Tapiridae", "Tayassuidae"]);
const STANDING = new Set(["Equidae", "Elephantidae"]);
const BIG_CATS = /^(african-lion|asiatic-lion|lion|.*tiger|.*leopard|jaguar|cougar|puma|cheetah|snow-leopard)$/;
const GECKOS = new Set(["Gekkonidae", "Phyllodactylidae", "Sphaerodactylidae", "Diplodactylidae", "Carphodactylidae", "Pygopodidae"]);
const SNAKE_FAMILIES = /^(Boidae|Pythonidae|Colubridae|Elapidae|Viperidae|Natricidae|Lamprophiidae|Typhlopidae|Leptotyphlopidae|Anomalepididae|Aniliidae|Uropeltidae|Cylindrophiidae|Xenopeltidae|Acrochordidae|Homalopsidae|Dipsadidae|Pseudoxyrhophiidae|Atractaspididae|Tropidophiidae|Bolyeriidae|Loxocemidae|Xenodermidae|Pareidae|Calamariidae|Sibynophiidae|Psammophiidae|Prosymnidae|Erycidae|Charinidae|Sanziniidae|Candoiidae|Ungaliophiidae|Xenophidiidae|Gerrhopilidae|Xenotyphlopidae|Anomochilidae)$/;

/** The rule posture for a species with no text or recipe posture, and the alternatives an animal may take on a night. */
function ruled(p: Profile, r: Row | undefined): {posture: Posture; alts: Posture[]; rule: string} {
    const fam = r?.family_name ?? "";
    const ord = r?.order_name ?? "";
    const cls = r?.class_name ?? "";
    const water = p.move === "swim" && !p.moves.includes("walk");
    switch (p.plan) {
        case "bat":
            return {posture: "hang", alts: [], rule: "plan bat: hangs by its feet"};
        case "primate":
            return {posture: "sit", alts: [], rule: "plan primate: sits hunched, the head down"};
        case "flying_bird":
        case "walking_bird":
        case "flightless_bird":
            if (fam === "Spheniscidae") return {posture: "stand", alts: ["sternal"], rule: "family Spheniscidae: rests standing or lying on its belly"};
            return {posture: "tuck", alts: [], rule: `plan ${p.plan}: sits or perches, the head sunk or tucked`};
        case "lizard":
        case "turtle":
        case "amphibian":
            return {posture: "flat", alts: [], rule: `plan ${p.plan}: lies still, the belly down`};
        case "legless":
            return {posture: "still", alts: [], rule: "plan legless: lies still"};
        case "fish":
            if (cls === "Mammalia") return water ? {posture: "hover", alts: [], rule: "a sea mammal: rests still at the surface"} : {posture: "side", alts: ["sternal"], rule: "a sea mammal ashore: lies on its side or belly"};
            if (p.seabed || p.roost === "bottom") return {posture: "bottom", alts: [], rule: `profile ${p.seabed ? "seabed" : "roost bottom"}: rests on the bottom`};
            return {posture: "hover", alts: [], rule: "plan fish: hangs still in the water"};
        case "quadruped":
            if (STANDING.has(fam)) return {posture: "stand", alts: fam === "Equidae" ? ["sternal", "side"] : ["side"], rule: `family ${fam}: sleeps standing, lies down now and then`};
            if (fam === "Giraffidae") return {posture: "stand", alts: ["sternal"], rule: "family Giraffidae: sleeps standing, or lying with its legs folded"};
            if (fam === "Suidae") return {posture: "side", alts: ["sternal"], rule: "family Suidae: lies on its side"};
            if (HOOFED_LYING.has(fam)) return {posture: "sternal", alts: [], rule: `family ${fam}: lies on its chest, the legs folded under`};
            if (fam === "Felidae") return BIG_CATS.test(p.slug) || (p.size ?? 0) >= 60 ? {posture: "side", alts: ["sternal", "curl"], rule: "family Felidae, a big cat: sprawls on its side or chest, or curls"} : {posture: "curl", alts: ["sternal"], rule: "family Felidae: curls up"};
            if (fam === "Canidae") return (p.size ?? 0) >= 45 ? {posture: "curl", alts: ["side"], rule: "family Canidae, a big dog: curls or lies on its side"} : {posture: "curl", alts: [], rule: "family Canidae: curls up, the tail over the nose"};
            if (fam === "Ursidae") return {posture: "side", alts: ["sternal", "curl"], rule: "family Ursidae: lies on its side or belly"};
            if (fam === "Phocidae" || fam === "Otariidae" || fam === "Odobenidae") return {posture: "side", alts: ["sternal"], rule: `family ${fam}: hauled out on its side or belly`};
            if (fam === "Hyaenidae") return {posture: "side", alts: ["curl"], rule: "family Hyaenidae: lies on its side or curls"};
            if (fam === "Macropodidae") return {posture: "side", alts: ["sit"], rule: "family Macropodidae: lies on its side, or sits back on its tail"};
            if (fam === "Leporidae") return {posture: "curl", alts: [], rule: "family Leporidae: crouched in a loaf"};
            if (ord === "Carnivora" || ord === "Rodentia" || ord === "Eulipotyphla" || ord === "Erinaceomorpha" || ord === "Soricomorpha" || ord === "Dasyuromorphia" || ord === "Didelphimorphia" || ord === "Peramelemorphia" || ord === "Afrosoricida" || ord === "Macroscelidea" || ord === "Lagomorpha" || ord === "Cingulata" || ord === "Pholidota" || ord === "Hyracoidea" || ord === "Diprotodontia")
                return {posture: "curl", alts: [], rule: `order ${ord}: curls up`};
            return {posture: "sternal", alts: [], rule: `plan quadruped (${ord || "order unknown"}): lies on its chest`};
        default:
            return {posture: "still", alts: [], rule: `plan ${p.plan}: keeps still`};
    }
}

/** Whether it shuts its eyes asleep: mammals, birds, turtles, crocodilians, lizards with lids (not geckos, snakes, fish, invertebrates). */
function closesEyes(p: Profile, r: Row | undefined): {value: boolean; rule: string} {
    const cls = r?.class_name ?? "";
    const fam = r?.family_name ?? "";
    if (cls === "Mammalia") return {value: true, rule: "class Mammalia: eyelids"};
    if (cls === "Aves") return {value: true, rule: "class Aves: eyelids"};
    if (cls === "Amphibia") return {value: p.plan === "amphibian", rule: p.plan === "amphibian" ? "class Amphibia (a frog or toad): eyes drawn in and shut" : "a legless amphibian: no lids to speak of"};
    if (cls === "Testudines" || cls === "Crocodylia" || cls === "Sphenodontia" || p.plan === "turtle") return {value: true, rule: `${cls || p.plan}: eyelids`};
    if (cls === "Squamata" || p.plan === "lizard" || p.plan === "legless") {
        if (p.plan === "legless" || SNAKE_FAMILIES.test(fam)) return {value: false, rule: "a snake: no eyelids (a clear scale over the eye)"};
        if (GECKOS.has(fam)) return {value: false, rule: `family ${fam}: no eyelids`};
        return {value: true, rule: "a lizard: eyelids"};
    }
    return {value: false, rule: `${cls || p.plan}: no eyelids`};
}

/** Its breath, against a mammal's by size: birds a little quicker, reptiles and amphibians slow, gill breathers none. */
function breathOf(p: Profile, r: Row | undefined): {value: number; rule: string} {
    const cls = r?.class_name ?? "";
    if (p.plan === "fish") return cls === "Mammalia" ? {value: 0.6, rule: "a sea mammal: slow and deep"} : {value: 0, rule: "gills: no chest to rise"};
    if (cls === "Mammalia") return {value: 1, rule: "a mammal"};
    if (cls === "Aves") return {value: 1.25, rule: "a bird: a little quicker"};
    if (["lizard", "turtle", "legless"].includes(p.plan) && cls !== "Amphibia") return {value: 0.3, rule: "a reptile: slow"};
    if (cls === "Amphibia") return {value: 0.4, rule: "an amphibian: slow"};
    return {value: 0, rule: `${cls || p.plan}: no breath to draw`};
}

// MARK: Build

type Out = {slug: string; posture: Posture; alts: Posture[]; social: Social; eyes: boolean; mammal: boolean; breath: number; src: Record<string, Source>};
const out: Out[] = [];
for (const p of profiles) {
    if (p.excluded) continue;
    const row = bySlug.get(p.slug) ?? (bySlug.get(p.slug.replace(/-/g, "_")) ?? undefined);
    const parent = row?.parent_slug ? bySlug.get(row.parent_slug) : undefined;
    const text = row?.sleep_pattern ?? parent?.sleep_pattern ?? "";
    const clauses = text ? restClauses(text) : [];
    const recipePosture = (recipes[p.slug] ?? "").split("|")[6] || "";
    const src: Record<string, Source> = {};
    const rule = ruled(p, row ?? parent);
    let posture: Posture = rule.posture;
    let alts: Posture[] = rule.alts;
    src.posture = {rule: rule.rule};
    // The recipes lane's posture (a stored phrase, or its family rule) before the plain prior.
    const fromRecipe: Record<string, Posture> = {one_leg: "one_leg", tuck: "tuck", hang: "hang", curl: "curl", stand: "stand", huddle: "stand", float: p.plan === "quadruped" ? "float_back" : "tuck"};
    if (recipePosture && fromRecipe[recipePosture]) {
        const next = fromRecipe[recipePosture];
        // A big cat or a big dog the recipes call "curl" keeps its sprawl as the first choice and curls on some nights.
        if (next === "curl" && (posture === "side" || (posture === "curl" && alts.length))) {
            if (!alts.includes("curl") && posture !== "curl") alts = [...alts, "curl"];
        } else {
            if (next !== posture) alts = posture !== "still" && next === "stand" && ["sternal", "side"].includes(posture) ? [posture] : alts.filter((a) => a !== next);
            posture = next;
        }
        src.posture = {recipe: `posture ${recipePosture}`};
    }
    const said = find(clauses, POSTURE_WORDS);
    // The text's own word last and strongest, where it fits the animal (a fish can't stand; a mammal on land doesn't hover).
    const fits = (q: Posture) => {
        const water = p.plan === "fish" || p.plan === "cephalopod_jelly";
        if (["bottom", "hover", "bottle"].includes(q)) return water || p.move === "swim";
        if (["stand", "one_leg", "sternal", "side", "tuck", "sit"].includes(q)) return !water && !["insect", "flying_insect", "arachnid", "crustacean", "other", "cephalopod_jelly"].includes(p.plan);
        if (q === "hang") return ["bat", "flying_bird", "quadruped", "primate", "insect", "flying_insect", "arachnid"].includes(p.plan);
        if (q === "tuck") return p.plan.includes("bird");
        if (q === "float_back") return p.plan === "quadruped";
        return true;
    };
    if (said && fits(said.value) && said.value !== posture) {
        if (posture !== "still" && posture !== said.value && !["bottom", "hover", "bottle", "hang"].includes(said.value) && fits(posture)) alts = [posture, ...alts.filter((a) => a !== said.value && a !== posture)].slice(0, 2);
        else alts = alts.filter((a) => a !== said.value);
        posture = said.value;
        src.posture = {field: "sleep", phrase: said.phrase};
    } else if (said && said.value === posture) {
        src.posture = {field: "sleep", phrase: said.phrase};
    }
    // How it sleeps with its own kind.
    let social: Social = "apart";
    const together = find(clauses, SOCIAL_WORDS);
    if (together && !(together.value === "row" && !(p.plan.includes("bird") || p.plan === "bat"))) {
        // Birds that sleep close together or huddled on a perch sit in a row along it (not penguins, on the ground).
        social = p.plan.includes("bird") && posture !== "stand" && (together.value === "pile" || together.value === "huddle") ? "row" : together.value;
        src.social = {field: "sleep", phrase: together.phrase};
    } else if (recipePosture === "huddle") {
        social = "huddle";
        src.social = {recipe: "posture huddle"};
    } else if (posture === "hang" && p.plan === "bat" && /\bcolon(y|ies)\b|\bin groups\b|\bcommunal/i.test(text)) {
        social = "cluster";
        src.social = {field: "sleep", phrase: clauses.find((c) => /\bcolon(y|ies)\b|\bin groups\b|\bcommunal/i.test(c)) ?? text};
    } else {
        src.social = {rule: "no shared sleeping place in its text: each sleeps a little apart"};
    }
    const eyes = closesEyes(p, row ?? parent);
    src.eyes = {rule: eyes.rule};
    const breath = breathOf(p, row ?? parent);
    src.breath = {rule: breath.rule};
    const mammal = (row ?? parent)?.class_name === "Mammalia";
    out.push({slug: p.slug, posture, alts: alts.filter((a) => a !== posture && fits(a)).slice(0, 2), social, eyes: eyes.value, mammal, breath: breath.value, src});
}
out.sort((a, b) => a.slug.localeCompare(b.slug));

const species: Record<string, string> = {};
for (const o of out) species[o.slug] = [o.posture, o.alts.join(","), o.social === "apart" ? "" : o.social, (o.eyes ? "e" : "") + (o.mammal ? "m" : ""), o.breath ? String(o.breath) : ""].join("|").replace(/\|+$/, "");
writeFileSync(
    path.join(root, "src/ark-scene/sleep.json"),
    JSON.stringify({about: "Generated by scripts/ark-sleep-styles.mts (sources: data/ark/sleep-styles.json). Rows: posture|other postures it takes on some nights|how it sleeps with its kind (huddle, pile, row, cluster; empty apart)|flags (e closes its eyes, m a mammal)|breath against a mammal's (empty: none). Decoded by sleep.ts.", version: "sleep-v1", species}) + "\n"
);
writeFileSync(path.join(root, "data/ark/sleep-styles.json"), JSON.stringify({about: "Each species' sleep style with the source of every field (scripts/ark-sleep-styles.mts).", generated: new Date().toISOString().slice(0, 10), count: out.length, species: out}, null, 1) + "\n");
const tally = (key: keyof Out) => out.reduce<Record<string, number>>((acc, o) => ((acc[String(o[key])] = (acc[String(o[key])] ?? 0) + 1), acc), {});
console.log("species", out.length);
console.log("posture", tally("posture"));
console.log("social", tally("social"));
console.log("eyes", tally("eyes"));
console.log("from text", out.filter((o) => "field" in o.src.posture).length, "from recipes", out.filter((o) => "recipe" in o.src.posture).length);
if (auditPath) {
    const lines = ["slug\tposture\talts\tsocial\tposture source\tsocial source\tsleep text"];
    for (const o of out) {
        const show = (s: Source) => ("phrase" in s ? `text: ${s.phrase}` : "recipe" in s ? `recipe: ${s.recipe}` : `rule: ${s.rule}`);
        lines.push([o.slug, o.posture, o.alts.join(","), o.social, show(o.src.posture), show(o.src.social), (bySlug.get(o.slug)?.sleep_pattern ?? "").replace(/\s+/g, " ")].join("\t"));
    }
    writeFileSync(auditPath, lines.join("\n") + "\n");
}
