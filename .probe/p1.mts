import fixture from "@/ark-scene/fixtures/snapshot-v2.json";
import {decodeArkSnapshot} from "@/ark-scene/snapshot";
import {placeAnimals} from "@/ark-scene/placement";
const s = decodeArkSnapshot(fixture)!;
const p = placeAnimals(s.animals);
for (const a of s.animals) {
  if (!/sparrow|owl|eagle|hawk|heron|mallard|macaw|puffin|penguin|turtle|rabbit|fox|wolf|lion|leopard/.test(a.model_slug)) continue;
  const q = p.get(a.id)!;
  console.log(a.model_slug.padEnd(20), a.zone.padEnd(12), q.x.toFixed(1), q.z.toFixed(1), q.ground.toFixed(2), q.water ? "water" : "", q.micro ? "micro:" + JSON.stringify(q.micro).slice(0, 80) : "", q.canopy ? "canopy:" + JSON.stringify(q.canopy).slice(0, 80) : "", q.burrow ? "burrow" : "", q.leader === a.id ? "L" : "");
}
