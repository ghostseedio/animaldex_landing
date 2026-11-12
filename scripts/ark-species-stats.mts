#!/usr/bin/env -S npx tsx
/**
 * `src/ark-scene/species-stats.json`: every species that can come aboard
 * (`voyage_species`), its five stats from `species_profiles.canonical_game_stats`,
 * and its true size (true-scale lane, motion pass §3, `docs/ark/true-scale.md`):
 * the length its model is drawn at, its body length in metres, and where that
 * came from.
 *
 * Inputs:
 *  1. A read-only query of the live catalogue (run from the AnimalDex repo,
 *     `BEGIN TRANSACTION READ ONLY`, `scripts/ark-true-scale/catalogue.sql`):
 *       supabase db query --linked -f catalogue.sql -o json > catalogue.json
 *  2. The data-gap lengths (`scripts/ark-true-scale/generated-lengths.json`):
 *     typical adult head-and-body and total lengths and masses for every
 *     species with a model, written by Claude Code agents (no API) in the data-gap
 *     work's way (AnimalDex `ark-data-gaps`: generated values kept apart and
 *     labelled, with a phrase and a confidence).
 *  3. The ark models' `ark.json` (extent, plan, the tail's base where the rig
 *     found one): `~/animaldex-talking-models/ark` or `--models <dir>`.
 *
 *   npx tsx scripts/ark-species-stats.mts catalogue.json [--models dir] [--report out.tsv]
 *
 * A species' length, best first:
 *  - **stored**: the traits lane's `voyage_species_traits.length_m` (its range's
 *    middle, with its phrase), else the size clause of `stats_basis`; kept when
 *    it agrees with the data-gap value within 2.5× (else it is most likely a
 *    wingspan, a height or a maximum read as a length, and it is reported);
 *  - **data-gap**: the generated value;
 *  - **estimate**: the size stat through the catalogue's mass anchors
 *    (`stats.ts` massFromSize), `L = 0.33 · mass^(1/3)`;
 *  - (at run time only) the body plan's typical length.
 *
 * Which length: mammals are measured head and body (no tail), lizards and
 * crocodiles snout to vent where the phrase says so, everything else whole.
 * The model is drawn so its body matches: a model whose rig found a tail
 * (`ark.json` behaviour.tail) is scaled by its head and body (nose to the
 * tail's base, along +z); one without by its whole length (the tail, if any,
 * as the rig drew it), through `bodyAxisExtent`'s axis.
 */
import {existsSync, readFileSync, writeFileSync} from "node:fs";
import os from "node:os";
import {dirname, join, resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {bodyAxisExtent, lengthFromMass, massFromSize} from "../src/ark-scene/stats.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const arg = (name: string, fallback: string | null = null) => {
    const at = process.argv.indexOf(`--${name}`);
    return at > 0 ? process.argv[at + 1] : fallback;
};
const input = process.argv[2];
if (!input || input.startsWith("--")) throw new Error("usage: ark-species-stats.mts <catalogue.json> [--models dir] [--report out.tsv]");
const modelsDir = arg("models", join(os.homedir(), "animaldex-talking-models", "ark"))!;
const generatedPath = arg("generated", join(root, "scripts/ark-true-scale/generated-lengths.json"))!;
const heightsPath = arg("heights", join(root, "scripts/ark-true-scale/generated-heights.json"))!;

type CatalogueRow = {slug: string | null; display_name: string | null; stats: Record<string, unknown> | null; basis: string | null; t_length: string | null; t_phrase: string | null};
type Generated = {hb: number; total: number; mass: number; conf: "high" | "medium" | "low"; phrase: string};
/** Standing height (m): `top` the highest point standing at rest (head, ears or horns), `shoulder` the withers. */
type Height = {shoulder: number; top: number; conf: "high" | "medium" | "low"};
type ArkJson = {extent: [number, number, number]; behaviour?: {plan?: string; tail?: {base: [number, number, number]; length: number}; extent?: {max: [number, number, number]; min: [number, number, number]}}};

const raw = JSON.parse(readFileSync(input, "utf8")) as {rows: CatalogueRow[]} | CatalogueRow[];
const catalogueRows = (Array.isArray(raw) ? raw : raw.rows).filter((row) => row.slug);
const generated = JSON.parse(readFileSync(generatedPath, "utf8")) as {species: Record<string, Generated>};
const heights = existsSync(heightsPath) ? (JSON.parse(readFileSync(heightsPath, "utf8")) as {species: Record<string, Height>}).species : {};

// One row per slug: the one with a stored length if several profiles share a model.
const catalogue = new Map<string, CatalogueRow>();
for (const row of catalogueRows) {
    const had = catalogue.get(row.slug!);
    if (!had || (row.t_length && !had.t_length)) catalogue.set(row.slug!, row);
}

const KEYS = ["size", "speed", "dominance", "rarity", "intelligence"] as const;
const NUMBER = String.raw`(\d+(?:\.\d+)?)`;
const LENGTH = new RegExp(String.raw`(?:about\s+|~|c\.\s*|up to\s+)?` + NUMBER + String.raw`(?:\s*(?:-|–|to)\s*` + NUMBER + String.raw`)?\s*(mm|cm|m)\b(?!\s*(?:wingspan|wing|tall|high|at the shoulder|shoulder|height|across|span|in diameter|diameter|deep))`, "i");
const UNIT: Record<string, number> = {mm: 0.001, cm: 0.01, m: 1};

/** The size clause of `stats_basis` ("size 27->14: 25-35 cm body ..."): its first length that isn't a wingspan, a height or a shoulder. */
function basisLength(basis: string | null): {metres: number; phrase: string} | null {
    const clause = (basis ?? "").split("|").map((part) => part.trim()).find((part) => /^size\b/i.test(part));
    if (!clause) return null;
    const text = clause.replace(/^size\s*\d+\s*(?:->|→)\s*\d+\s*:\s*/i, "");
    const match = LENGTH.exec(text);
    if (!match) return null;
    const before = text.slice(Math.max(0, match.index - 14), match.index).toLowerCase();
    if (/wingspan|span|tall|height|shoulder/.test(before)) return null;
    const low = Number(match[1]);
    const high = match[2] ? Number(match[2]) : low;
    return {metres: (low + high) / 2 * UNIT[match[3].toLowerCase()], phrase: text.slice(0, 90)};
}

/** The traits lane's stored range ("[0.6,0.7)") as its middle. */
function traitsLength(range: string | null): number | null {
    const m = /^[[(]\s*([\d.eE+-]+)\s*,\s*([\d.eE+-]+)\s*[\])]$/.exec(range ?? "");
    if (!m) return null;
    const value = (Number(m[1]) + Number(m[2])) / 2;
    return Number.isFinite(value) && value > 0 ? value : null;
}

/** What a stored phrase measured: head and body (no tail) or the whole animal. */
function phraseKind(phrase: string, plan: string): "hb" | "total" {
    const p = phrase.toLowerCase();
    if (/\btotal\b|including (?:the )?tail|with (?:the |its )?tail|\btl\b|nose to tail|tail tip/.test(p)) return "total";
    if (/head[- ]?(?:and[- ])?body|snout[- ]?vent|\bsvl\b|carapace|\bshell\b|\bbody\b|\bhb\b|mantle|\bdisc\b/.test(p)) return "hb";
    return plan === "mammal" ? "hb" : "total";
}

function modelOf(slug: string): ArkJson | null {
    const path = join(modelsDir, slug, "ark.json");
    return existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) as ArkJson : null;
}

/**
 * The model's length drawn for a body of `hb` (head and body) and `total` (to the tail tip) metres, along
 * `bodyAxisExtent`'s axis:
 * - by the head and body where the rig found a tail on a mammal or a reptile (nose to the tail's base, along +z);
 * - by the head and body for any other mammal (its tail, if any, hangs or curls: a horse's, a cow's, a dog's; measured
 *   against standing heights, the whole length drew them 1.2-1.8x too tall);
 * - by the whole length otherwise (birds bill to tail, fish, snakes, insects...).
 * Then, for a mammal or a bird with a standing height, checked against the model's height: the scale is the geometric
 * mean of the two (a trunk, a raised head or a neck held up makes the length alone misjudge the model), unless they
 * disagree by more than 2x (an odd pose: the length alone, reported).
 */
function drawnLength(slug: string, plan: string, model: ArkJson | null, hb: number, total: number): {drawn: number; by: string; heightRatio: number | null} {
    if (!model) return {drawn: total, by: "total", heightRatio: null};
    const [x, y, z] = model.extent;
    const axis = bodyAxisExtent(slug, plan, {x, y, z});
    const tail = model.behaviour?.tail;
    const front = model.behaviour?.extent?.max[2] ?? z / 2;
    const back = model.behaviour?.extent?.min[2] ?? -z / 2;
    let drawn = total;
    let by = "total";
    if (tail && (plan === "mammal" || plan === "reptile") && Math.abs(axis - z) < 1e-6) {
        // The head and body's share of the model's length: the nose (+z) to the tail's base.
        const share = (front - tail.base[2]) / Math.max(front - back, 1e-6);
        if (share >= 0.45 && share <= 0.97) {
            drawn = hb / share;
            by = "hb/tail";
        }
    }
    if (by === "total" && plan === "mammal") {
        drawn = hb;
        by = "hb";
    }
    const standing = heights[slug];
    if (standing && standing.top > 0 && (plan === "mammal" || plan === "bird")) {
        const byLength = drawn / axis;
        const byHeight = standing.top / y;
        const ratio = byHeight / byLength;
        if (ratio >= 0.5 && ratio <= 2) return {drawn: Math.sqrt(byLength * byHeight) * axis, by: `${by}+height`, heightRatio: ratio};
        return {drawn, by: `${by} (height ${ratio.toFixed(2)}x: odd pose, not used)`, heightRatio: ratio};
    }
    return {drawn, by, heightRatio: null};
}

/**
 * Hand corrections, each with its reason (`docs/ark/true-scale.md`): models whose shape the length can't be laid
 * along. Drawn length (m) along the body axis.
 */
const DRAWN_OVERRIDES: Record<string, {drawn: number; why: string}> = {
    // 5-10 m stretched, but it lies in a loose tangle; the model is that tangle (2.9 m wide at 7.5 m).
    "bootlace-worm": {drawn: 1.5, why: "lies coiled: the model is a loose tangle, drawn about 1.5 m long and 0.6 m across"}
};

/** A wingspan (m) in a phrase ("wingspan 7-8 cm", "Wingspan 25 mm"): its range's middle. */
function wingspanOf(phrase: string): number | null {
    const m = /wing\s*span\s*(?:of\s*|about\s*|~\s*)?(\d+(?:\.\d+)?)(?:\s*(?:-|–|to)\s*(\d+(?:\.\d+)?))?\s*(mm|cm|m)\b/i.exec(phrase);
    if (!m) return null;
    const low = Number(m[1]);
    const high = m[2] ? Number(m[2]) : low;
    return ((low + high) / 2) * UNIT[m[3].toLowerCase()];
}

/**
 * A butterfly or a moth is seen by its wings, and its model is its wings: spread (as wide as long or wider) its width
 * is the wingspan; folded up over its back its length is a forewing's, about half the wingspan. Drawn length along
 * z, or null without a wingspan.
 */
function wingDrawn(model: ArkJson | null, wingspan: number | null, body: number): number | null {
    if (!model || !wingspan) return null;
    const [x, , z] = model.extent;
    return x / z >= 0.8 ? wingspan * (z / x) : Math.max(body, wingspan * 0.5);
}

/** The old on-screen length (before true scale): `clamp(1.2 · L^0.6, 0.18, 9)`, for the report. */
const oldDisplay = (metres: number) => Math.min(Math.max(1.2 * metres ** 0.6, 0.18), 9);

export type SizeSource = "stored" | "data-gap" | "estimate";
const SOURCES: SizeSource[] = ["stored", "data-gap", "estimate"];

const species: Record<string, number[]> = {};
const lengths: Record<string, [number, number, number]> = {};
const report: string[] = ["slug\tname\tplan\tsource\tconfidence\tmetres\tdrawn\tdrawn_by\theight_ratio\told_display\tchange\tstored\tgenerated_hb\tgenerated_total\testimate\tphrase\tnote"];
const counts: Record<string, number> = {stored: 0, "data-gap": 0, estimate: 0, rejected_stored: 0};
const round = (value: number) => Number(value.toPrecision(4));

const slugs = new Set<string>([...catalogue.keys(), ...Object.keys(generated.species)]);
for (const slug of [...slugs].sort()) {
    const row = catalogue.get(slug) ?? null;
    const model = modelOf(slug);
    const plan = model?.behaviour?.plan ?? "";
    const values = row ? KEYS.map((key) => Number((row.stats ?? {})[key])) : null;
    const hasStats = values !== null && values.every((v) => Number.isFinite(v));
    if (hasStats) species[slug] = values!;
    if (!model) continue;

    const gen = generated.species[slug] ?? null;
    const estimate = hasStats ? lengthFromMass(massFromSize(values![0])) : null;
    const traits = row ? traitsLength(row.t_length) : null;
    const basis = row && traits === null ? basisLength(row.basis) : null;
    const storedMetres = traits ?? basis?.metres ?? null;
    const storedPhrase = traits !== null ? row!.t_phrase ?? "" : basis?.phrase ?? "";

    let hb: number;
    let total: number;
    let source: SizeSource;
    let phrase = "";
    let note = "";
    const ratio = gen ? gen.total / Math.max(gen.hb, 1e-9) : 1;
    if (storedMetres !== null) {
        const kind = phraseKind(storedPhrase, plan);
        // A ray's stored figure is often its disc's width: not a length along its body (the data-gap total is).
        const width = plan === "ray" && /width|wide|span|across/i.test(storedPhrase);
        // Checked against the data-gap value (2.5×), or without one against the size stat's estimate (4×, as before).
        const genSame = gen ? (kind === "hb" ? gen.hb : gen.total) : estimate;
        const within = gen ? 2.5 : 4;
        const agrees = !width && (genSame === null || (storedMetres / genSame <= within && genSame / storedMetres <= within));
        if (agrees) {
            hb = kind === "hb" ? storedMetres : storedMetres / ratio;
            total = kind === "hb" ? storedMetres * ratio : storedMetres;
            source = "stored";
            phrase = storedPhrase;
        } else if (gen) {
            counts.rejected_stored++;
            note = width ? `stored ${storedMetres} m is a ray's disc width ("${storedPhrase}"): the data-gap length is used` : `stored ${storedMetres} m ("${storedPhrase}") disagrees with ${genSame} m: not used`;
            hb = gen.hb;
            total = gen.total;
            source = "data-gap";
            phrase = gen.phrase;
        } else {
            counts.rejected_stored++;
            note = `stored ${storedMetres} m ("${storedPhrase}") disagrees with the size stat's ${round(estimate!)} m: not used`;
            hb = estimate!;
            total = estimate!;
            source = "estimate";
        }
    } else if (gen) {
        hb = gen.hb;
        total = gen.total;
        source = "data-gap";
        phrase = gen.phrase;
    } else if (estimate !== null) {
        hb = estimate;
        total = estimate;
        source = "estimate";
    } else continue;
    counts[source]++;
    const metres = plan === "mammal" ? hb : total;
    // A butterfly or a moth by its wings (its body alone drew a 5 cm-wingspan butterfly 2 cm across).
    const wings = plan === "butterfly" ? wingDrawn(model, wingspanOf(gen?.phrase ?? "") ?? wingspanOf(storedPhrase ?? ""), total) : null;
    const fitted = wings !== null ? {drawn: wings, by: "wingspan", heightRatio: null} : drawnLength(slug, plan, model, hb, total);
    const override = DRAWN_OVERRIDES[slug];
    const {drawn, by, heightRatio} = override ? {drawn: override.drawn, by: `override: ${override.why}`, heightRatio: fitted.heightRatio} : fitted;
    lengths[slug] = [round(drawn), round(metres), SOURCES.indexOf(source)];
    const before = oldDisplay(storedMetres ?? estimate ?? (plan === "bird" ? 0.45 : 1));
    report.push([slug, row?.display_name ?? "", plan, source, source === "data-gap" ? gen!.conf : source === "stored" ? "stored" : "estimate", round(metres), round(drawn), by, heightRatio === null ? "" : round(heightRatio), round(before), round(drawn / before), storedMetres ?? "", gen?.hb ?? "", gen?.total ?? "", estimate === null ? "" : round(estimate), phrase.replace(/\s+/g, " "), note].join("\t"));
}

const out = join(root, "src/ark-scene/species-stats.json");
writeFileSync(out, JSON.stringify({
    about: "Generated by scripts/ark-species-stats.mts from the live catalogue, the data-gap lengths and the ark models. species: [size, speed, dominance, rarity, intelligence]. lengths: [drawn length of the model along its body axis (m), body length (m, head and body for mammals, whole otherwise), source index into sources].",
    sources: SOURCES,
    species,
    lengths
}).replace(/\],"/g, "],\n\"") + "\n");
const reportPath = arg("report");
if (reportPath) writeFileSync(reportPath, report.join("\n") + "\n");
console.log(`${Object.keys(species).length} species with stats, ${Object.keys(lengths).length} sized: ${JSON.stringify(counts)} -> ${out}`);
