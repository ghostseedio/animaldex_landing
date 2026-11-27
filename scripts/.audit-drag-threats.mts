/**
 * PERF-WEB audit (drag lane, 2026-11-27), untracked helper: how many of the threat links `wireThreats` makes cross
 * between the islands (index.ts wireSchedules passes both islands' drawn animals in one list). Upper bound: every
 * animal of the real snapshot counted as drawn and scheduled (the scene draws a live budget of them). Output only.
 *
 *   npx tsx scripts/.audit-drag-threats.mts <voyage.json>
 */
import {readFileSync} from "node:fs";
import {decodeArkSnapshot} from "@/ark-scene/snapshot";
import {arkIslandSnapshot} from "@/lib/ark-islands";
import {eats} from "@/ark-scene/food-links";

const raw = JSON.parse(readFileSync(process.argv[2], "utf8"));
const snapshot = decodeArkSnapshot(raw.snapshot ?? raw);
if (!snapshot) throw new Error("no snapshot");
const human = (slug: string) => /human|person|people/.test(slug);
const wild = arkIslandSnapshot(snapshot, "wild").animals.filter((a) => !human(a.model_slug));
const town = arkIslandSnapshot(snapshot, "town").animals.filter((a) => !human(a.model_slug));
const all = [...wild.map((a) => ({a, isl: "wild"})), ...town.map((a) => ({a, isl: "town"}))];
const slugs = Array.from(new Set(all.map((x) => x.a.model_slug)));
const hunters = slugs.filter((p) => slugs.some((q) => q !== p && eats(p, q)));
const top = new Set(hunters.filter((p) => !slugs.some((q) => q !== p && eats(q, p))));
const tops = all.filter((x) => top.has(x.a.model_slug));
let same = 0;
let cross = 0;
let preyWithCross = 0;
let preyWithAny = 0;
let preyOnlyCross = 0;
const crossBy = new Map<string, number>();
for (const x of all) {
    const found = tops.filter((p) => p.a.model_slug !== x.a.model_slug && eats(p.a.model_slug, x.a.model_slug));
    const s = found.filter((p) => p.isl === x.isl).length;
    const c = found.length - s;
    same += s;
    cross += c;
    if (found.length) preyWithAny++;
    if (c) preyWithCross++;
    if (c && !s) preyOnlyCross++;
    if (c) crossBy.set(x.isl, (crossBy.get(x.isl) ?? 0) + c);
}
console.log(JSON.stringify({
    animals: {wild: wild.length, town: town.length},
    topKinds: Array.from(top).sort(),
    topAnimals: {wild: tops.filter((t) => t.isl === "wild").length, town: tops.filter((t) => t.isl === "town").length},
    preyWithAnyThreat: preyWithAny,
    preyWithCrossIslandThreat: preyWithCross,
    preyWhoseThreatsAreAllCrossIsland: preyOnlyCross,
    threatLinks: {sameIsland: same, crossIsland: cross, crossShare: Math.round((cross / Math.max(same + cross, 1)) * 1000) / 10},
    crossLinksByPreyIsland: Object.fromEntries(crossBy)
}, null, 1));
