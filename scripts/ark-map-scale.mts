#!/usr/bin/env -S npx tsx
/**
 * The map at the captures' scale (owner decision D10; AnimalDex
 * docs/ark/captures-backfill-dry-run.md §4.3, §5): places the dry run's
 * population (AnimalDex `scripts/ark/fixtures/captures-population.json`,
 * branch ark-captures-dryrun: synthetic owners, real species mix) at 1× and
 * 3× and runs the hamlet's and the crowding checks (`map/validate-hamlet.ts`).
 * It also writes the tests' compact fixture of the house and farm residents
 * (`src/ark-scene/fixtures/hamlet-population.json`: per kind, how many at 1×).
 *
 *   npx tsx scripts/ark-map-scale.mts <captures-population.json>
 */
import {readFileSync, writeFileSync} from "node:fs";
import {dirname, join, resolve} from "node:path";
import {fileURLToPath} from "node:url";
import {validatePopulation} from "../src/ark-scene/map/validate-hamlet.ts";
import {islandHours} from "../src/lib/ark-clock.ts";
import type {ArkAnimal, ArkZone} from "../src/ark-scene/types.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const path = process.argv[2];
if (!path) throw new Error("usage: ark-map-scale.mts <captures-population.json>");
type Species = {kind: string; look_slug: string; kind_slug: string; zone: string; area: string; activity: string | null; sociality: string | null};
const file = JSON.parse(readFileSync(path, "utf8")) as {species: Species[]; scales: Record<string, {animals: Array<[number, number, number, number]>}>};

function population(scale: "1" | "3"): ArkAnimal[] {
    return file.scales[scale].animals.map(([index, owner, day], i) => {
        const s = file.species[index];
        const area = s.area === "house" || s.area === "farm" ? s.area : null;
        return {
            id: `cap${scale}-${String(i).padStart(5, "0")}`, species_profile_id: s.kind, kind_species_profile_id: s.kind, name: s.look_slug, scientific_name: null, model_slug: s.look_slug,
            zone: (area ? "farm_garden" : s.zone) as ArkZone, area, arrived_at: new Date(Date.UTC(2026, 10, 11) + day * 86400000).toISOString(),
            brought_by: {label: `Voyager ${owner + 3}`, named: false}, mine: false, activity: (s.activity ?? null) as ArkAnimal["activity"]
        } as ArkAnimal;
    });
}

// The tests' fixture: the house and farm residents at 1×, per kind.
const counts = new Map<string, {slug: string; area: string; activity: string | null; n: number}>();
for (const [index] of file.scales["1"].animals) {
    const s = file.species[index];
    if (s.area !== "house" && s.area !== "farm") continue;
    const key = `${s.area}|${s.look_slug}`;
    const row = counts.get(key) ?? {slug: s.look_slug, area: s.area, activity: s.activity, n: 0};
    row.n++;
    counts.set(key, row);
}
const rows = Array.from(counts.values()).sort((a, b) => b.n - a.n || a.slug.localeCompare(b.slug)).map((r) => [r.slug, r.area, r.activity, r.n]);
writeFileSync(join(root, "src/ark-scene/fixtures/hamlet-population.json"), JSON.stringify({about: "The dry run's house and farm residents at 1x, per kind [slug, area, activity, count] (AnimalDex scripts/ark/fixtures/captures-population.json, branch ark-captures-dryrun; scripts/ark-map-scale.mts). 3x is each count tripled.", residents: rows}) + "\n");

const DAY = Date.UTC(2026, 10, 12) / 1000;
const hours = (epoch: number) => islandHours(epoch * 1000, 0);
for (const scale of ["1", "3"] as const) {
    const animals = population(scale);
    const started = performance.now();
    const report = validatePopulation(animals, hours, DAY);
    const by = new Map<string, number>();
    for (const f of report.failures) by.set(f.check, (by.get(f.check) ?? 0) + 1);
    console.log(`${scale}x: ${animals.length} animals, ${report.residents} residents on ${report.plots} plots; out at most ${report.outMost} (${(report.outShare * 100).toFixed(1)}% of residents on average); most per 1 m cell ${report.mostPerCell}, cells over the limit ${report.cellsOver}; failures ${report.failures.length} ${JSON.stringify(Object.fromEntries(by))}; ${Math.round(performance.now() - started)} ms`);
    for (const f of report.failures.slice(0, 8)) console.log(`  ${f.check}: ${f.detail}`);
}
