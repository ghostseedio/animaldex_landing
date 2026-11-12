/**
 * The Ark's food chain in plain words (SEO lane S3, decision 244): for one
 * species aboard, what it eats and what eats it among the animals aboard now,
 * each link with the phrase of the field guide it was taken from.
 *
 * Pure and client-safe: it reads `voyage_food_links` rows (read on the server,
 * `src/data/ark-food-chain.ts`) and the public snapshot. Shared by
 * /ark/food-chain, the compact embed on the home page and /ark
 * (`components/ark/ark-food-chain-section`), and the species pages' "In the Ark".
 *
 * Which links count is the server ecology's own test where the public data
 * can say it (`_shared/ark-ecology/rules.ts` linkUsable), and stricter where it
 * cannot, so the page never shows a meal the Ark would not allow:
 * - a link the realm check refused (`realm_ok = false`) is left out;
 * - group prey above the size rule (`size_ok = false`, which only some group
 *   hunters may take) is left out;
 * - never the predator's own kind or genus;
 * - kept animals (in the town's houses, on its farms or in the zoo) are fed by
 *   their keepers: they neither hunt nor are hunted (islands, `outsideWildEcology`);
 * - a predator hunts only on its own island and in its own region (D12, with the
 *   town's gardens, park trees, canal and roofs as regions of their own), so a
 *   pair counts only when wild animals of both share a region;
 * - a kind kept as a pet anywhere aboard (any of it lives in a house) is never
 *   listed as prey (pets are never prey, A4; stricter than the server's list).
 *
 * Species facts only: no bringer, no user.
 */

import type {ArkAnimal, ArkSnapshot} from "@/ark-scene/types";
import {arkPopulation, type ArkSpeciesRow} from "@/lib/ark-population";

/** One species aboard, as the food chain names it. */
export type ArkFoodChainSpecies = {
    /** Its kind's species_profile_id (breeds count as their kind, A1). */
    id: string;
    /** The model slug: the /ark?focus= value and, when published, its /animals/ page. */
    slug: string;
    name: string;
    aboard: number;
    /** `/animals/<slug>` when that page exists and is indexed; else null. */
    page: string | null;
};

/** One rule of a predator's stored diet, with the species aboard it reaches. */
export type ArkFoodChainEats = {
    /** The verbatim piece of the field guide's diet text ("small mammals"). */
    phrase: string | null;
    /** The group the rule names ("birds"), or null for a named species. */
    group: string | null;
    prey: ArkFoodChainSpecies[];
};

/** One predator aboard that may eat the species, with its own diet phrase. */
export type ArkFoodChainEatenBy = {
    predator: ArkFoodChainSpecies;
    phrase: string | null;
    group: string | null;
};

export type ArkFoodChainEntry = {
    species: ArkFoodChainSpecies;
    eats: ArkFoodChainEats[];
    eatenBy: ArkFoodChainEatenBy[];
    /** Every one aboard is kept (a house, a farm or the zoo): fed by keepers, outside the wild food chain. */
    kept: boolean;
    /** Never listed as prey: kept, or a pet kind. */
    neverPrey: boolean;
};

/** A `voyage_food_links` row as read (decision 244: species, link and phrase columns only). */
export type ArkFoodChainRow = {
    id?: unknown;
    predator?: unknown;
    prey?: unknown;
    basis?: unknown;
    group_label?: unknown;
    phrase?: unknown;
    realm_ok?: unknown;
    size_ok?: unknown;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A strict species slug (`?species=`): lower case words joined by single hyphens, at most 80 characters. */
export const ARK_FOOD_CHAIN_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+){0,11}$/;

export function isArkFoodChainSlug(value: unknown): value is string {
    return typeof value === "string" && value.length <= 80 && ARK_FOOD_CHAIN_SLUG.test(value);
}

function uuid(value: unknown): string | null {
    return typeof value === "string" && UUID.test(value.trim()) ? value.trim().toLowerCase() : null;
}

function words(value: unknown): string | null {
    return typeof value === "string" && value.replace(/\s+/g, " ").trim() ? value.replace(/\s+/g, " ").trim() : null;
}

/** The rule a view row came from: its id is "<rule id>:<prey>". */
function ruleOf(row: ArkFoodChainRow): number {
    const id = typeof row.id === "string" ? Number.parseInt(row.id.split(":")[0], 10) : NaN;
    return Number.isFinite(id) ? id : Number.MAX_SAFE_INTEGER;
}

function genusOf(animal: ArkAnimal | undefined): string | null {
    const first = animal?.scientific_name?.trim().split(/\s+/)[0]?.toLowerCase();
    return first && /^[a-z]+$/.test(first) ? first : null;
}

/** Everything the food chain needs to know about who is aboard, built once per snapshot. */
export type ArkFoodChainAboard = {
    /** Kind id -> its row. */
    rows: Map<string, ArkSpeciesRow>;
    /** Any species_profile_id aboard (a look or a kind) -> its kind id. */
    kindOf: Map<string, string>;
    /** Model slug -> kind id. */
    bySlug: Map<string, string>;
};

export function arkFoodChainAboard(snapshot: ArkSnapshot | null): ArkFoodChainAboard {
    const rows = new Map<string, ArkSpeciesRow>();
    const kindOf = new Map<string, string>();
    const bySlug = new Map<string, string>();
    for (const group of arkPopulation(snapshot).regions) {
        for (const row of group.species) {
            const kind = row.key.toLowerCase();
            if (!UUID.test(kind)) continue;
            rows.set(kind, row);
            kindOf.set(kind, kind);
            bySlug.set(row.slug.toLowerCase(), kind);
            for (const animal of row.animals) {
                kindOf.set(animal.species_profile_id.toLowerCase(), kind);
                bySlug.set(animal.model_slug.toLowerCase(), kind);
            }
        }
    }
    return {rows, kindOf, bySlug};
}

/** The kind id aboard for a slug or a species_profile_id, or null when none of it is aboard. */
export function arkFoodChainKind(aboard: ArkFoodChainAboard, value: string | null | undefined): string | null {
    const wanted = value?.trim().toLowerCase();
    if (!wanted) return null;
    return aboard.kindOf.get(wanted) ?? aboard.bySlug.get(wanted) ?? null;
}

/** Every look id aboard that counts as this kind (the kind itself first). */
export function arkFoodChainLooks(aboard: ArkFoodChainAboard, kind: string): string[] {
    const row = aboard.rows.get(kind);
    const looks = new Set<string>([kind]);
    for (const animal of row?.animals ?? []) looks.add(animal.species_profile_id.toLowerCase());
    return Array.from(looks);
}

function speciesOf(row: ArkSpeciesRow, kind: string, page: (slug: string) => string | null): ArkFoodChainSpecies {
    return {id: kind, slug: row.slug, name: row.name, aboard: row.count, page: page(row.slug)};
}

/** D12's hunting regions by zone (`_shared/ark-ecology/rules.ts` REGION_OF). */
const REGION_OF: Record<string, string> = {
    farm_garden: "home",
    rainforest: "forest",
    woodland: "forest",
    river_lake: "fresh_water",
    wetland: "fresh_water",
    grassland: "open_land",
    desert: "open_land",
    seashore: "coast",
    coral_reef: "ocean",
    open_ocean: "ocean",
    mountains: "high_cold",
    polar: "high_cold"
};

const KEPT_AREAS = new Set(["house", "farm", "zoo"]);

/** Where an animal hunts and can be hunted (`islands.ts` regionKey): its island, then its region; null when it is kept. */
export function arkHuntingRegion(animal: Pick<ArkAnimal, "area" | "island" | "zone">): string | null {
    if (animal.area && KEPT_AREAS.has(animal.area)) return null;
    const region = REGION_OF[animal.zone] ?? animal.zone;
    return animal.island === "town" ? `town:${region}` : region;
}

function wildRegions(row: ArkSpeciesRow | undefined): Set<string> {
    const regions = new Set<string>();
    for (const animal of row?.animals ?? []) {
        const region = arkHuntingRegion(animal);
        if (region) regions.add(region);
    }
    return regions;
}

function isPetKind(row: ArkSpeciesRow | undefined): boolean {
    return Boolean(row?.animals.some((animal) => animal.area === "house"));
}

/** Whether the Ark may use this link between these two kinds aboard (see the module comment). */
function usable(row: ArkFoodChainRow, predator: ArkSpeciesRow | undefined, prey: ArkSpeciesRow | undefined, predatorKind: string, preyKind: string): boolean {
    if (!predator || !prey || predatorKind === preyKind) return false;
    if (row.realm_ok === false || row.size_ok === false) return false;
    const a = genusOf(predator.animals[0]);
    const b = genusOf(prey.animals[0]);
    if (a && b && a === b) return false;
    if (isPetKind(prey)) return false;
    const hunts = wildRegions(predator);
    for (const region of Array.from(wildRegions(prey))) if (hunts.has(region)) return true;
    return false;
}

const bySize = (a: ArkFoodChainSpecies, b: ArkFoodChainSpecies) => b.aboard - a.aboard || a.name.localeCompare(b.name);

/**
 * One species' place in the Ark's food chain, from the rows that name it as
 * predator or as prey (either may be read for it; rows about other pairs are
 * ignored). `page` names a species' indexed page by its slug, or null.
 */
export function arkFoodChainEntry(rows: ArkFoodChainRow[], aboard: ArkFoodChainAboard, kind: string, page: (slug: string) => string | null): ArkFoodChainEntry | null {
    const own = aboard.rows.get(kind);
    if (!own) return null;
    const species = speciesOf(own, kind, page);
    const kept = wildRegions(own).size === 0;
    const neverPrey = kept || isPetKind(own);

    // What it eats: rule by rule in the stored diet order, each with the species aboard it reaches.
    const rules = new Map<number, {rule: number; phrase: string | null; group: string | null; prey: Map<string, ArkFoodChainSpecies>}>();
    // What eats it: each predator once, by its best link (a named species before a group, then the first rule).
    const predators = new Map<string, {rule: number; basis: string; item: ArkFoodChainEatenBy}>();

    for (const row of rows) {
        const predatorKind = arkFoodChainKind(aboard, uuid(row.predator));
        const preyKind = arkFoodChainKind(aboard, uuid(row.prey));
        if (!predatorKind || !preyKind) continue;
        const predator = aboard.rows.get(predatorKind);
        const prey = aboard.rows.get(preyKind);
        if (!usable(row, predator, prey, predatorKind, preyKind)) continue;
        const group = row.basis === "group" ? words(row.group_label) : null;
        const phrase = words(row.phrase);
        const rule = ruleOf(row);
        if (predatorKind === kind) {
            const entry = rules.get(rule) ?? {rule, phrase, group, prey: new Map()};
            entry.prey.set(preyKind, speciesOf(prey!, preyKind, page));
            rules.set(rule, entry);
        }
        if (preyKind === kind) {
            const basis = row.basis === "species" ? "species" : "group";
            const seen = predators.get(predatorKind);
            const better = !seen || (basis === "species" && seen.basis !== "species") || (basis === seen.basis && rule < seen.rule);
            if (better) predators.set(predatorKind, {rule, basis, item: {predator: speciesOf(predator!, predatorKind, page), phrase, group}});
        }
    }

    const eats = Array.from(rules.values())
        .sort((a, b) => a.rule - b.rule)
        .map((entry) => ({phrase: entry.phrase, group: entry.group, prey: Array.from(entry.prey.values()).sort(bySize)}));
    const eatenBy = neverPrey
        ? []
        : Array.from(predators.values()).map((entry) => entry.item).sort((a, b) => bySize(a.predator, b.predator));
    return {species, eats, eatenBy, kept, neverPrey};
}

/** How many species aboard a species' entry links to, either way (for picking what to feature). */
export function arkFoodChainLinkCount(entry: ArkFoodChainEntry): number {
    const others = new Set<string>();
    for (const rule of entry.eats) for (const prey of rule.prey) others.add(prey.id);
    for (const item of entry.eatenBy) others.add(item.predator.id);
    return others.size;
}

/** Every species aboard for the explorer's list: wild ones first (they are in the food chain), each group biggest first, then by name. */
export function arkFoodChainIndex(aboard: ArkFoodChainAboard, page: (slug: string) => string | null): ArkFoodChainSpecies[] {
    return Array.from(aboard.rows.entries())
        .map(([kind, row]) => ({species: speciesOf(row, kind, page), kept: wildRegions(row).size === 0}))
        .sort((a, b) => Number(a.kept) - Number(b.kept) || bySize(a.species, b.species))
        .map((item) => item.species);
}

/**
 * The species to feature (the compact embed, the explorer's first panel):
 * predators whose prey is aboard, as the scene's visual food table
 * (`src/ark-scene/food-links.json`) knows them, most prey aboard first, one
 * per region where it can, then by name; deterministic for a snapshot.
 * Only a short-list: each is read and checked against the real links before it shows.
 */
export function arkFoodChainCandidates(aboard: ArkFoodChainAboard, preyOfSlug: (slug: string) => Iterable<string>, limit: number): string[] {
    const scored: Array<{kind: string; region: string; score: number; name: string}> = [];
    for (const [kind, row] of Array.from(aboard.rows.entries())) {
        const hunts = wildRegions(row);
        if (!hunts.size) continue;
        const prey = new Set<string>();
        for (const slug of Array.from(preyOfSlug(row.slug))) {
            const preyKind = aboard.bySlug.get(slug.toLowerCase());
            const preyRow = preyKind ? aboard.rows.get(preyKind) : undefined;
            if (!preyKind || preyKind === kind || !preyRow || isPetKind(preyRow)) continue;
            if (Array.from(wildRegions(preyRow)).some((region) => hunts.has(region))) prey.add(preyKind);
        }
        if (prey.size) scored.push({kind, region: row.region, score: prey.size, name: row.name});
    }
    scored.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
    const picked: string[] = [];
    const regions = new Set<string>();
    for (const item of scored) {
        if (picked.length >= limit) break;
        if (regions.has(item.region)) continue;
        regions.add(item.region);
        picked.push(item.kind);
    }
    for (const item of scored) {
        if (picked.length >= limit) break;
        if (!picked.includes(item.kind)) picked.push(item.kind);
    }
    return picked;
}
