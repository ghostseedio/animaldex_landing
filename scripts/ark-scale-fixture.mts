#!/usr/bin/env -S npx tsx
/**
 * The captures-backfill scale fixtures for the web (AnimalDex docs/ark/captures-backfill-dry-run.md):
 * turns the SYNTHETIC population (AnimalDex scripts/ark/fixtures/captures-population.json:
 * production aggregates, made-up owners, no user ids, capture ids or locations) into a
 * `voyage_public_v2`-shaped snapshot the scene loads like the server's answer.
 *
 *   npx tsx scripts/ark-scale-fixture.mts <captures-population.json> [--out .ark-golden/site]
 *
 * Writes population-1x.json and population-3x.json. Domestic and Farm animals stand in
 * zone farm_garden (today's only home zone); the rest in their species' zone. Places come
 * from `allocateArkPlaces` (the server's rules, in arrival order); everyone is "Voyager N".
 * Deterministic: the same files every run.
 */
import {createHash} from "node:crypto";
import {mkdirSync, readFileSync, writeFileSync} from "node:fs";
import {join, resolve} from "node:path";
import {allocateArkPlaces} from "../src/ark-scene/placement.ts";
import type {ArkAnimal} from "../src/ark-scene/types.ts";

type Species = {look: string; kind: string; look_slug: string; name: string; scientific_name: string | null; zone: string; setting: string; area: string; activity: string | null; sociality: string | null};
type Population = {launch: string; species: Species[]; scales: Record<string, {animals: Array<[number, number, number, number]>}>};

const input = process.argv[2];
if (!input) throw new Error("usage: ark-scale-fixture.mts <captures-population.json> [--out dir]");
const outAt = process.argv.indexOf("--out");
const out = resolve(outAt > 0 ? process.argv[outAt + 1] : ".ark-golden/site");
mkdirSync(out, {recursive: true});
const population = JSON.parse(readFileSync(input, "utf8")) as Population;
const launch = Date.parse(`${population.launch}T09:00:00Z`);
const ARK_DAY_MS = 14 / 365 * 86_400_000;

/** A stable made-up uuid for a synthetic animal. */
function fakeId(scale: string, index: number): string {
    const s = createHash("sha256").update(`ark-scale:${scale}:${index}`).digest("hex");
    return `${s.slice(0, 8)}-${s.slice(8, 12)}-4${s.slice(13, 16)}-8${s.slice(17, 20)}-${s.slice(20, 32)}`;
}

for (const [scale, {animals}] of Object.entries(population.scales)) {
    // Owners are numbered by size; "Voyager N" follows the order of first arrival, as on the server.
    const firstSeen = new Map<number, number>();
    const ordered = animals.map((row, index) => ({row, index})).sort((a, b) => a.row[2] - b.row[2] || a.index - b.index);
    for (const {row} of ordered) if (!firstSeen.has(row[1])) firstSeen.set(row[1], firstSeen.size + 1);
    const started = launch + ordered[0].row[2] * 86_400_000;
    const list: ArkAnimal[] = ordered.map(({row, index}) => {
        const s = population.species[row[0]];
        const voyager = {label: `Voyager ${firstSeen.get(row[1])}`, named: false};
        const zone = s.area === "house" || s.area === "farm" ? "farm_garden" : s.zone;
        const arrived = new Date(launch + row[2] * 86_400_000 + (index % 1440) * 60_000).toISOString().replace(/\.\d{3}Z$/, "Z");
        return {
            id: fakeId(scale, index), species_profile_id: s.look, name: s.name, scientific_name: s.scientific_name, model_slug: s.look_slug,
            zone, arrived_at: arrived, brought_by: voyager, mine: false, origin: "arrived", generation: 0, condition: "well_fed",
            born_ark_day: 0, activity: s.activity, sociality: s.sociality, bringers: [voyager]
        } as unknown as ArkAnimal;
    });
    const places = allocateArkPlaces(list);
    for (const animal of list) {
        const place = places.get(animal.id)!;
        (animal as unknown as {slot: number; slot_rank: number}).slot = place.slot;
        (animal as unknown as {slot: number; slot_rank: number}).slot_rank = place.rank;
    }
    const zones = new Map<string, number>();
    for (const animal of list) zones.set(animal.zone, (zones.get(animal.zone) ?? 0) + 1);
    const snapshot = {
        voyage: {slug: "first", name: "The first Ark", started_at: new Date(started).toISOString().replace(/\.\d{3}Z$/, "Z"), ark_day: Math.round((launch - started) / ARK_DAY_MS * 1000) / 1000},
        counts: {animals: list.length, species: new Set(list.map((a) => a.species_profile_id)).size, founders: firstSeen.size},
        zones: [...zones.entries()].sort((a, b) => b[1] - a[1]).map(([key, n]) => ({key, animals: n})),
        animals: list,
        as_of: new Date(launch).toISOString().replace(/\.\d{3}Z$/, "Z")
    };
    const file = join(out, `population-${scale}x.json`);
    writeFileSync(file, JSON.stringify(snapshot));
    const slots = new Map<string, number>();
    for (const animal of list) {
        const place = places.get(animal.id)!;
        slots.set(animal.zone, Math.max(slots.get(animal.zone) ?? 0, place.slot + 1));
    }
    console.log(`${scale}x: ${list.length} animals, ${snapshot.counts.species} looks, ${firstSeen.size} voyagers -> ${file}`);
    console.log(`   slots per zone: ${[...slots.entries()].sort((a, b) => b[1] - a[1]).map(([z, n]) => `${z} ${n}`).join(", ")}`);
}
