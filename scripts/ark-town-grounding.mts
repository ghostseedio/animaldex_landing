// Lane TB (docs/ark/town-island.md §12.2): every animal on the real Ark's town where the scene draws it (tanks,
// displays, zoo houses, the ground, the schedule through a day), and the old rule's counts. Development only: reads the
// local real snapshot and T1's routing in place. `npx tsx scripts/ark-town-grounding.mts` (SCHED=0: places only).
import {readFileSync} from "node:fs";
import {setArkWorld} from "@/ark-scene/world";
setArkWorld("v2");
const {mergeArkIslandsRouting} = await import("@/lib/ark-islands-local");
const {decodeArkSnapshot} = await import("@/ark-scene/snapshot");
const {arkIslandSnapshot} = await import("@/lib/ark-islands");
const {validateTownAnimals} = await import("@/ark-scene/islands/town/validate-animals");
const {townWorldOrigin} = await import("@/ark-scene/islands");
const W = process.env.ARK_LOCAL ?? "public/ark-local/";
const {merged} = mergeArkIslandsRouting(JSON.parse(readFileSync(W + "live.json", "utf8")), JSON.parse(readFileSync(W + "islands-routing.json", "utf8")));
const whole = decodeArkSnapshot((merged as {snapshot?: unknown}).snapshot ?? merged)!;
const town = arkIslandSnapshot(whole, "town");
const t0 = performance.now();
const r = validateTownAnimals(town.animals, {origin: townWorldOrigin(), schedule: process.env.SCHED !== "0"});
console.log("ms", Math.round(performance.now() - t0), "animals", r.animals, "samples", r.samples, "kinds", r.kinds);
console.log("counts", r.counts, "legacy", r.legacy, "lifted", r.lifted);
const by = new Map<string, number>();
for (const p of r.problems) { const k = `${p.kind}:${p.problems.join("+")}:${p.slug}:${p.where}`; by.set(k, (by.get(k) ?? 0) + 1); }
for (const [k, n] of [...by].sort((a, b) => b[1] - a[1]).slice(0, 40)) console.log(n, k);
for (const p of r.problems.slice(0, 15)) console.log(JSON.stringify(p));
