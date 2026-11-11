#!/usr/bin/env -S npx tsx
/**
 * The Ark map's body classes (`src/ark-scene/map/body.json`): which kind of
 * animal each species is (a bird, a bat, a mammal, a reptile, an amphibian,
 * a fish, an invertebrate), from the rig lane's body plans and taxonomy
 * (`~/animaldex-talking-models/rig/plans.json`), and for a species the
 * plans lack, the map generator's own reasons (`docs/ark-map/species.json`:
 * "body plan: …", "taxonomy: …"). The scene keeps only small invertebrates
 * as micro animals (`map/species.ts` trueMicro); every bird, bat and
 * mammal goes on the behaviour schedule.
 *
 *   npx tsx scripts/ark-map-body.mts [plans.json]
 */
import {existsSync, readFileSync, writeFileSync} from "node:fs";
import {dirname, join, resolve} from "node:path";
import {fileURLToPath} from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const plansPath = process.argv[2] ?? join(process.env.HOME ?? "", "animaldex-talking-models/rig/plans.json");
if (!existsSync(plansPath)) throw new Error(`no rig plans at ${plansPath}`);
type Plan = {plan: string; taxonomy?: {class_name?: string | null; phylum_name?: string | null}};
const plans = (JSON.parse(readFileSync(plansPath, "utf8")) as {species: Record<string, Plan | null>}).species;
const map = (JSON.parse(readFileSync(join(root, "docs/ark-map/species.json"), "utf8")) as {species: Array<{slug: string; move: string; moveReason: string | null}>}).species;

/** b bird, t bat, m mammal, r reptile, a amphibian, f fish, i invertebrate. */
type Body = "b" | "t" | "m" | "r" | "a" | "f" | "i";
const VERTEBRATE: Record<string, Body> = {Aves: "b", Mammalia: "m", Reptilia: "r", Squamata: "r", Testudines: "r", Crocodylia: "r", Amphibia: "a", Actinopterygii: "f", Chondrichthyes: "f", Sarcopterygii: "f", Myxini: "f", Petromyzonti: "f", Elasmobranchii: "f"};
const BY_PLAN: Record<string, Body> = {flying_bird: "b", walking_bird: "b", flightless_bird: "b", bat: "t", quadruped: "m", primate: "m", lizard: "r", turtle: "r", amphibian: "a", fish: "f", flying_insect: "i", insect: "i", arachnid: "i", crustacean: "i", cephalopod_jelly: "i"};

/** Fish orders whose bodies are legless (the eels). */
const EEL_ORDERS = new Set(["Anguilliformes", "Gymnotiformes", "Synbranchiformes", "Saccopharyngiformes"]);

function fromPlan(plan: Plan & {taxonomy?: {order_name?: string | null}}): Body | null {
    const cls = plan.taxonomy?.class_name ?? null;
    if (plan.plan === "bat") return "t";
    if (plan.taxonomy?.order_name && EEL_ORDERS.has(plan.taxonomy.order_name)) return "f";
    if (plan.taxonomy?.order_name === "Tricladida") return "i";
    if (cls && VERTEBRATE[cls]) return VERTEBRATE[cls];
    if (BY_PLAN[plan.plan]) return BY_PLAN[plan.plan];
    // A legless or "other" body with a known class that is not a vertebrate's: an invertebrate (a worm, a slug, a leech).
    if (cls) return "i";
    return null;
}

function fromReason(reason: string | null): Body | null {
    const plan = /body plan: ([a-z_]+)/.exec(reason ?? "")?.[1];
    if (plan && BY_PLAN[plan]) return BY_PLAN[plan];
    if (/taxonomy: (Gastropoda|Bivalvia|Anthozoa|Echinoidea|Asteroidea|Holothuroidea|Polychaeta|Ophiuroidea|Demospongiae|Crinoidea|Hexactinellida|Scyphozoa|Hydrozoa)/.test(reason ?? "")) return "i";
    if (/taxonomy: Anura|Caudata/.test(reason ?? "")) return "a";
    if (/Onychophora|velvet worm|coral/i.test(reason ?? "")) return "i";
    return null;
}

const out: Record<Body, string[]> = {b: [], t: [], m: [], r: [], a: [], f: [], i: []};
const unknown: string[] = [];
for (const row of map) {
    const plan = plans[row.slug];
    const body = (plan ? fromPlan(plan) : null) ?? fromReason(row.moveReason);
    if (body) out[body].push(row.slug);
    else unknown.push(row.slug);
}
for (const list of Object.values(out)) list.sort();
const file = {
    about: "The Ark map's body classes (scripts/ark-map-body.mts): b bird, t bat, m mammal, r reptile, a amphibian, f fish, i invertebrate; from the rig lane's plans.json (body plan and taxonomy), else the map generator's reasons. Not listed: unknown (treated by its movement).",
    ...out
};
writeFileSync(join(root, "src/ark-scene/map/body.json"), JSON.stringify(file) + "\n");
console.log(Object.entries(out).map(([k, v]) => `${k} ${v.length}`).join(", "), `unknown ${unknown.length}: ${unknown.slice(0, 20).join(" ")}`);
