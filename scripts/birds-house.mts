import {readFileSync} from "node:fs";
import {setArkWorld} from "@/ark-scene/world";
setArkWorld("v2");
const {mergeArkIslandsRouting} = await import("@/lib/ark-islands-local");
const {decodeArkSnapshot} = await import("@/ark-scene/snapshot");
const {arkIslandSnapshot} = await import("@/lib/ark-islands");
const {placeTownAnimals} = await import("@/ark-scene/islands/town/placement");
const {modelBase} = await import("@/ark-scene/grounding/base");
const {arkBody} = await import("@/ark-scene/stats");
const W = process.env.ARK_LOCAL!;
const {merged} = mergeArkIslandsRouting(JSON.parse(readFileSync(W + "live.json", "utf8")), JSON.parse(readFileSync(W + "islands-routing.json", "utf8")));
const whole = decodeArkSnapshot((merged as {snapshot?: unknown}).snapshot ?? merged)!;
const town = arkIslandSnapshot(whole, "town");
const placed = placeTownAnimals(town.animals);
const by = new Map<string, {n: number; ids: string[]; len: number}>();
for (const a of town.animals) {
  if (a.area !== "house" || modelBase(a.model_slug)?.plan !== "bird") continue;
  const info = placed.town.get(a.id)!;
  const k = `${info.keeping}/${info.display?.form ?? info.where} ${a.model_slug}`;
  const r = by.get(k) ?? {n: 0, ids: [], len: arkBody(a, "bird").display};
  r.n++; if (r.ids.length < 1) r.ids.push(a.id); by.set(k, r);
}
for (const [k, r] of [...by].sort((x, y) => y[1].n - x[1].n)) console.log(r.n, k, r.len.toFixed(2), r.ids[0]);
