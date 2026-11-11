import fixtureV2 from "@/ark-scene/fixtures/snapshot-v2.json";
import {decodeArkSnapshot} from "@/ark-scene/snapshot";
import {placeAnimals, allocateArkPlaces, slotKind} from "@/ark-scene/placement";
import {mapPoints} from "@/ark-scene/map/place";
const v2 = decodeArkSnapshot(fixtureV2)!;
const p = placeAnimals(v2.animals);
const s = allocateArkPlaces(v2.animals);
for (const a of v2.animals) { const sl = s.get(a.id)!; const k = slotKind(a, sl.slot); if (k === "cover" && sl.rank === 0) { const q = p.get(a.id)!; console.log(a.model_slug, a.zone, q.map?.tag, q.water, q.covered, mapPoints().sampler.covered!(q.x, q.z)); } }
