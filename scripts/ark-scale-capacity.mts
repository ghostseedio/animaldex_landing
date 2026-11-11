#!/usr/bin/env -S npx tsx
/**
 * Zone capacity at the captures-backfill scale (AnimalDex docs/ark/captures-backfill-dry-run.md):
 * how many distinct spots each zone's grid has (placement.ts, terrain only), how many slots
 * the 1x / 3x populations need there, and where those slots stand (on their own zone's ground,
 * on another zone's, or stacked on the grid's last spot once it runs out).
 *
 *   npx tsx scripts/ark-scale-capacity.mts .ark-golden/site/population-1x.json [.ark-golden/site/population-3x.json]
 */
import {readFileSync} from "node:fs";
import {zoneLayout} from "../src/ark-scene/placement.ts";
import {ARK_ZONES} from "../src/ark-scene/types.ts";
import {sampleGround, zoneAt} from "../src/ark-scene/world.ts";

type Row = {zone: string; slot: number};
const files = process.argv.slice(2);
const capacity = new Map<string, {spots: number; ownGround: number}>();
for (const zone of ARK_ZONES) {
    const layout = zoneLayout(zone);
    let spots = 0;
    let own = 0;
    let last = "";
    for (let i = 0; i < 6000; i++) {
        const spot = layout.spot(i);
        const key = `${spot.x.toFixed(3)},${spot.z.toFixed(3)}`;
        if (key === last) break;
        last = key;
        spots++;
        if (zoneAt(sampleGround(spot.x, spot.z)) === zone) own++;
    }
    capacity.set(zone, {spots, ownGround: own});
}
console.log("| zone | grid spots | of them on the zone's own ground |" + files.map((f) => ` slots needed (${f.match(/(\d+x)/)?.[1]}) | on own ground | on another zone's | stacked past the grid |`).join(""));
console.log("|---|---:|---:|" + files.map(() => "---:|---:|---:|---:|").join(""));
const per = files.map((file) => {
    const rows = (JSON.parse(readFileSync(file, "utf8")) as {animals: Row[]}).animals;
    const slots = new Map<string, Set<number>>();
    for (const row of rows) (slots.get(row.zone) ?? slots.set(row.zone, new Set()).get(row.zone)!).add(row.slot);
    return slots;
});
for (const zone of ARK_ZONES) {
    const cap = capacity.get(zone)!;
    const layout = zoneLayout(zone);
    const cells = per.map((slots) => {
        const used = [...(slots.get(zone) ?? new Set<number>())];
        let own = 0;
        let other = 0;
        let stacked = 0;
        for (const s of used) {
            if (s >= cap.spots) {
                stacked++;
                continue;
            }
            const spot = layout.spot(s);
            if (zoneAt(sampleGround(spot.x, spot.z)) === zone) own++;
            else other++;
        }
        return ` ${used.length} | ${own} | ${other} | ${stacked} |`;
    });
    console.log(`| ${zone} | ${cap.spots} | ${cap.ownGround} |${cells.join("")}`);
}
