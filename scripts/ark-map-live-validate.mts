#!/usr/bin/env -S npx tsx
/**
 * The map's spawn validator (`src/ark-scene/map/validate.ts`) on a real snapshot's animals, in islands mode: the wild
 * island's animals (by T1's routing, `islands-routing.json`), placed and checked as the scene places them, at the
 * server's own slots and ranks. The synthetic run (`validateMap()` over every species) is CI's; this is the live check.
 *
 *   ARK_WORLD=v2 nice -n 10 npx tsx scripts/ark-map-live-validate.mts --snapshot public/ark-local/live.json \
 *       --routing public/ark-local/islands-routing.json [--scale 1|3|year] [--out report.json]
 *
 * - `ARK_WORLD=v2`: the bigger wild island (Part C, `world.ts` setArkWorld); without it, today's island in islands mode
 *   (no hamlet, decision 148).
 * - `--scale 3`: each wild zone's animals three times over (copies at the slots past the server's), `--scale year`: up to
 *   the islands plan's counts at a year (`islands/wild/sites.ts` WILD_PLAN_COUNTS), each copy its own cluster.
 *
 * The snapshot is read in place (never copied) and the report names species and checks, never people. Local only.
 */

import {readFileSync, writeFileSync} from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const opt = (name: string, fallback?: string) => {
    const i = args.indexOf(`--${name}`);
    return i >= 0 ? args[i + 1] : fallback;
};
const snapshotPath = path.resolve(opt("snapshot", "public/ark-local/live.json")!);
const routingPath = opt("routing", "public/ark-local/islands-routing.json");
const scale = opt("scale", "1")!;
const out = opt("out");

const {arkWorld} = await import("@/ark-scene/world");
const {setNoHamlet} = await import("@/ark-scene/no-hamlet");
// Islands mode: no hamlet on the wild island (v2 sets it itself).
setNoHamlet(true);
const {decodeArkSnapshot} = await import("@/ark-scene/snapshot");
const {validateMap, failuresBySpecies, VALIDATOR_CHECKS} = await import("@/ark-scene/map/validate");
const {mapPoints} = await import("@/ark-scene/map/place");
const {WILD_PLAN_COUNTS} = await import("@/ark-scene/islands/wild/sites");
type Animal = import("@/ark-scene/types").ArkAnimal;

const snapshot = decodeArkSnapshot(JSON.parse(readFileSync(snapshotPath, "utf8")));
if (!snapshot) throw new Error("not a snapshot");
const routing = routingPath ? new Map((JSON.parse(readFileSync(path.resolve(routingPath), "utf8")) as {animals: Array<{id: string; island: string}>}).animals.map((row) => [row.id, row.island])) : null;
const wild = snapshot.animals.filter((a) => (routing ? routing.get(a.id) === "wild" : a.area !== "house" && a.area !== "farm" && a.area !== "zoo"));

/** Copies of the wild animals at the slots past the server's (each its own cluster), up to `target` per zone. */
function scaled(animals: Animal[], target: (zone: string, today: number) => number): Animal[] {
    const byZone = new Map<string, Animal[]>();
    for (const a of animals) byZone.set(a.zone, [...(byZone.get(a.zone) ?? []), a]);
    const extra: Animal[] = [];
    for (const [zone, list] of Array.from(byZone.entries())) {
        let next = Math.max(...list.map((a) => a.slot ?? 0)) + 1;
        const want = target(zone, list.length);
        for (let k = 0; list.length + k < want; k++) {
            const from = list[k % list.length];
            extra.push({...from, id: `${from.id}~${k}`, slot: next++, slot_rank: 0, mine: false});
        }
    }
    return [...animals, ...extra];
}

const animals = scale === "1" ? wild : scale === "year" ? scaled(wild, (zone, today) => Math.max(WILD_PLAN_COUNTS[zone]?.year ?? today, today)) : scaled(wild, (_zone, today) => today * Number(scale));
const started = performance.now();
const report = validateMap(animals);
const ms = Math.round(performance.now() - started);
const byCheck = Object.fromEntries(VALIDATOR_CHECKS.map((check) => [check, report.failures.filter((f) => f.check === check).length]));
const byZone: Record<string, number> = {};
for (const a of animals) byZone[a.zone] = (byZone[a.zone] ?? 0) + 1;
const summary = {
    world: arkWorld(),
    sampler: mapPoints().sampler.id,
    scale,
    animals: report.animals,
    species: report.species,
    byZone,
    failures: report.failures.length,
    byCheck,
    ms,
    bySpecies: Object.fromEntries(Array.from(failuresBySpecies(report.failures).entries()).map(([slug, checks]) => [slug, Object.fromEntries(checks)]))
};
console.log(JSON.stringify({...summary, bySpecies: undefined}, null, 1));
for (const [slug, checks] of Object.entries(summary.bySpecies).slice(0, Number(process.env.SHOW ?? 40))) console.log(slug, JSON.stringify(checks));
if (out) writeFileSync(out, JSON.stringify(summary, null, 1));
