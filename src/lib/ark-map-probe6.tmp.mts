import fixture from "@/ark-scene/fixtures/snapshot.json";
import {decodeArkSnapshot} from "@/ark-scene/snapshot";
import {placeAnimals, allocateArkPlaces} from "@/ark-scene/placement";
const full = decodeArkSnapshot(fixture)!;
const p = placeAnimals(full.animals);
const s = allocateArkPlaces(full.animals);
const list = full.animals.map((a) => ({a, q: p.get(a.id)!, sl: s.get(a.id)!}));
for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
  const A = list[i], B = list[j];
  if (A.q.micro || B.q.micro) continue;
  if (Math.hypot(A.q.x - B.q.x, A.q.z - B.q.z) <= 0.9) console.log(A.a.model_slug, A.a.zone, A.sl.slot, A.sl.rank, A.q.map?.tag, A.q.map?.level, "|", B.a.model_slug, B.a.zone, B.sl.slot, B.sl.rank, B.q.map?.tag, B.q.map?.level, A.q.x.toFixed(1), A.q.z.toFixed(1));
}
