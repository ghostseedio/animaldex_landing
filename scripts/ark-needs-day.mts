#!/usr/bin/env -S npx tsx
/**
 * Every catalogue species' day by its needs alone (behaviours pass, lane B3 needs, 2026-11-14): when it sleeps and
 * what each waking slot is for (a feeding bout, the rest after it, the time between, a trip to water, a bask on
 * waking), from `behaviour-schedule.ts` awakeAt and needAt. No world, no plans: a lone animal of each species on the
 * island's own clock over one day, so the whole catalogue takes seconds. What the animal then does in a slot (its
 * choice among its behaviours, a recipe, a place that is or is not near) is the schedule's; measure that with
 * `scripts/ark-activity-budget.mts`.
 *
 *   npx tsx --tsconfig scripts/tsconfig.scripts.json scripts/ark-needs-day.mts [--species a,b] [--tsv out.tsv] [--days 1]
 *
 * Columns: hours asleep; the share of the 24 hours in each need; feeding bouts a day and their median length
 * (minutes); trips to water; the day hour by hour (z asleep, F feeding, r resting, - between, D a drink, b basking).
 */
import {readFileSync, writeFileSync} from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const value = (name: string) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : undefined;
};
const {decodeBehaviourRow, dayOf} = await import("../src/ark-scene/behaviour-profile.ts");
const sched = await import("../src/ark-scene/behaviour-schedule.ts");
const {islandHours} = await import("../src/lib/ark-clock.ts");

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const table: Record<string, string> = JSON.parse(readFileSync(path.join(root, "src/ark-scene/behaviours.json"), "utf8")).species;
const only = value("--species")?.split(",");
const days = Number(value("--days") ?? "1");
const SLOT = sched.SLOT_SECONDS;
const start = Date.UTC(2026, 10, 12) / 1000;
const hoursAt = (epoch: number) => islandHours(epoch * 1000, 0);
const LETTER: Record<string, string> = {sleep: "z", feed: "F", rest: "r", free: "-", drink: "D", bask: "b"};
const NEEDS = ["sleep", "feed", "rest", "free", "drink", "bask"] as const;

const lines: string[] = [];
const rows: string[][] = [];
for (const slug of Object.keys(table).sort()) {
    if (only && !only.includes(slug)) continue;
    const profile = decodeBehaviourRow(slug, table[slug]);
    if (profile.move === "sessile") continue;
    const animal = {id: `c-${slug}`, zone: "grassland" as const, group: null};
    const offset = sched.slotOffset(animal.id);
    const first = Math.ceil((start + offset) / SLOT);
    const count = Math.round((86_400 * days) / SLOT);
    const needs: string[] = [];
    const byHour: Array<Record<string, number>> = Array.from({length: 24}, () => ({}));
    for (let k = 0; k < count; k++) {
        const at = (first + k) * SLOT - offset;
        const need = sched.awakeAt(profile, null, hoursAt(at)) ? sched.needAt(profile, animal, null, at, hoursAt) : "sleep";
        needs.push(need);
        const h = Math.floor(hoursAt(at + SLOT / 2)) % 24;
        byHour[h][need] = (byHour[h][need] ?? 0) + 1;
    }
    const share = (need: string) => needs.filter((n) => n === need).length / count;
    const runs: Array<{need: string; n: number}> = [];
    for (const need of needs) {
        const last = runs[runs.length - 1];
        if (last && last.need === need) last.n++;
        else runs.push({need, n: 1});
    }
    const feeds = runs.filter((r) => r.need === "feed").map((r) => (r.n * SLOT) / 60).sort((a, b) => a - b);
    const strip = byHour.map((h) => LETTER[Object.entries(h).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "free"]).join("");
    const day = dayOf(profile);
    const pct = (x: number) => `${Math.round(100 * x)}`.padStart(3);
    lines.push(`${slug.padEnd(32).slice(0, 32)} ${profile.diet.padEnd(8).slice(0, 8)} ${profile.activity.slice(0, 4)} sleep ${(share("sleep") * 24).toFixed(1).padStart(4)} h | feed ${pct(share("feed"))} rest ${pct(share("rest"))} between ${pct(share("free"))} bask ${pct(share("bask"))} | feeds ${(feeds.length / days).toFixed(0).padStart(3)} a day, median ${(feeds.length ? feeds[Math.floor(feeds.length / 2)] : 0).toFixed(0).padStart(3)} min | drinks ${(runs.filter((r) => r.need === "drink").length / days).toFixed(1)} | ${strip} | ${day.feed},${day.cycle},${day.rest},${day.drinks},${day.sleep ?? ""},${day.every}${day.ruminates ? ",r" : ""}`);
    rows.push([slug, profile.diet, profile.activity, (share("sleep") * 24).toFixed(2), ...NEEDS.map((n) => share(n).toFixed(4)), (feeds.length / days).toFixed(1), (feeds.length ? feeds[Math.floor(feeds.length / 2)] : 0).toFixed(1), (runs.filter((r) => r.need === "drink").length / days).toFixed(1), strip]);
}
console.log(lines.join("\n"));
const tsv = value("--tsv");
if (tsv) writeFileSync(tsv, [["slug", "diet", "activity", "sleepHours", ...NEEDS, "feedBouts", "feedMedianMin", "drinks", "strip"].join("\t"), ...rows.map((r) => r.join("\t"))].join("\n"));
