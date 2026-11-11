#!/usr/bin/env -S npx tsx
/**
 * `src/ark-scene/animal-look.json`: each Ark species' surface (fur, feathers,
 * scales, skin, shell, slimy), its eyes and its weather flags, for the
 * animal-look pass (`animal-look.ts`, docs/ark/animal-look.md). Deterministic,
 * from stored data only; the rules and their order are `animal-look-rules.ts`.
 *
 *   npx tsx scripts/ark-animal-look.mts [build dir] [traits.json] [report.tsv]
 *
 * Reads, from the talking-model build (default ~/animaldex-talking-models):
 * - `ark/manifest.json`: the species with an Ark model (every row written);
 * - `rig/plans.json` and `rig/taxonomy.json`: body plan, class, order, family;
 * - `out/<slug>/landmarks.json`: `head_box.covering`, read off the photo;
 * - `assets/<slug>.talking.json`: the eyes (two mirrored points in the model's
 *   space, the glossy balls of the talking model) and their radius;
 * and the traits lane's `traits.json` (`realm`: land, air, sea, fresh), matched
 * by the species' name, for who swims and comes out (wet after a swim), who
 * lives in water, and who walks dry ground (dust).
 *
 * Rows: [class index, flags, eye x, eye y, eye z, eye radius] (eye radius 0: no
 * eyes); flags as `LOOK_FLAG`. The report lists every species with its class,
 * where that came from and the reason, defaults first.
 */
import {existsSync, readFileSync, writeFileSync} from "node:fs";
import os from "node:os";
import {dirname, join, resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {aquatic, chooseLook, dusty, LOOK_CLASSES, LOOK_FLAG, semiAquatic} from "../src/ark-scene/animal-look-rules";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const [buildArg, traitsArg, reportArg] = process.argv.slice(2);
const build = resolve(buildArg ?? join(os.homedir(), "animaldex-talking-models"));
const read = <T>(path: string): T => JSON.parse(readFileSync(path, "utf8")) as T;

type Plan = {name?: string; plan?: string; taxonomy?: {class_name?: string | null; order_name?: string | null; family_name?: string | null} | null};
type Taxon = {slug: string; display_name?: string; class_name?: string | null; order_name?: string | null; family_name?: string | null};
type Talking = {eyes?: number[][]; eye_radius?: number};
type Trait = {name: string; realm?: string[] | null};

const models = read<{models: Record<string, string>}>(join(build, "ark", "manifest.json")).models;
const plans = read<{species: Record<string, Plan>}>(join(build, "rig", "plans.json")).species;
const taxonomy = new Map(read<Taxon[]>(join(build, "rig", "taxonomy.json")).map((row) => [row.slug, row]));
const key = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const realms = new Map<string, string[]>();
if (traitsArg && existsSync(traitsArg)) {
    for (const trait of read<{traits: Trait[]}>(traitsArg).traits) if (trait.realm?.length) realms.set(key(trait.name), trait.realm);
}

const round = (value: number) => Math.round(value * 10000) / 10000;
const species: Record<string, number[]> = {};
const report: string[] = [];
const counts: Record<string, number> = {};
const sources: Record<string, number> = {};
let defaults = 0;
let withEyes = 0;
let realmFound = 0;
/** Rows where the taxonomy settled it against the photo's covering (a shark's denticles read as scales, a frog's skin as slimy). */
const overrides: Record<string, number> = {};
for (const slug of Object.keys(models).sort()) {
    const plan = plans[slug];
    const taxon = taxonomy.get(slug);
    const tax = plan?.taxonomy ?? taxon ?? null;
    const landmarks = existsSync(join(build, "out", slug, "landmarks.json")) ? read<{head_box?: {covering?: string}}>(join(build, "out", slug, "landmarks.json")) : null;
    const talking = existsSync(join(build, "assets", `${slug}.talking.json`)) ? read<Talking>(join(build, "assets", `${slug}.talking.json`)) : {};
    const name = plan?.name ?? taxon?.display_name ?? slug.replace(/-/g, " ");
    const realm = realms.get(key(name)) ?? null;
    if (realm) realmFound++;
    const choice = chooseLook({className: tax?.class_name, order: tax?.order_name, family: tax?.family_name, covering: landmarks?.head_box?.covering, plan: plan?.plan});
    let flags = 0;
    if (choice.defaulted) flags |= LOOK_FLAG.defaulted;
    if (semiAquatic(realm)) flags |= LOOK_FLAG.semiAquatic;
    if (aquatic(realm, plan?.plan)) flags |= LOOK_FLAG.aquatic;
    if (dusty(plan?.plan, choice.look, realm)) flags |= LOOK_FLAG.dusty;
    // The eyes come in mirrored pairs: keep the one on +x (the scene mirrors it).
    const eye = (talking.eyes ?? []).filter((point) => point.length === 3).sort((a, b) => b[0] - a[0])[0];
    const radius = Number(talking.eye_radius ?? 0);
    const eyeRow = eye && radius > 0 ? [round(Math.abs(eye[0])), round(eye[1]), round(eye[2]), round(radius)] : [0, 0, 0, 0];
    if (eyeRow[3] > 0) withEyes++;
    species[slug] = [LOOK_CLASSES.indexOf(choice.look), flags, ...eyeRow];
    counts[choice.look] = (counts[choice.look] ?? 0) + 1;
    sources[choice.source] = (sources[choice.source] ?? 0) + 1;
    if (choice.defaulted) defaults++;
    const seen = landmarks?.head_box?.covering;
    if (seen && seen !== choice.look) overrides[`${seen}->${choice.look}`] = (overrides[`${seen}->${choice.look}`] ?? 0) + 1;
    const flagWords = [flags & LOOK_FLAG.semiAquatic ? "wet-after-swim" : "", flags & LOOK_FLAG.aquatic ? "aquatic" : "", flags & LOOK_FLAG.dusty ? "dusty" : "", realm ? "" : "no-realm"].filter(Boolean).join(",");
    report.push([slug, choice.look, choice.source, choice.defaulted ? "DEFAULT" : "", choice.reason, landmarks?.head_box?.covering ?? "", plan?.plan ?? "", flagWords].join("\t"));
}
report.sort((a, b) => (b.split("\t")[3] === "DEFAULT" ? 1 : 0) - (a.split("\t")[3] === "DEFAULT" ? 1 : 0) || a.localeCompare(b));

const out = join(root, "src/ark-scene/animal-look.json");
writeFileSync(out, JSON.stringify({
    about: "Generated by scripts/ark-animal-look.mts from the talking-model build (plans, taxonomy, photo covering, eyes) and the traits lane's realms. Rows: [class index, flags, eye x, eye y, eye z, eye radius]; classes as `classes`; flags 1 default, 2 wet after a swim, 4 lives in water, 8 dusty.",
    classes: LOOK_CLASSES,
    species
}).replace(/\],"/g, "],\n\""));
const reportPath = reportArg ?? join(root, "docs/ark/animal-look-classes.tsv");
writeFileSync(reportPath, ["slug\tclass\tsource\tdefault\treason\tphoto covering\tbody plan\tflags", ...report, ""].join("\n"));
console.log(JSON.stringify({species: Object.keys(species).length, counts, sources, defaults, overrides, withEyes, realmFound, out, report: reportPath}));
