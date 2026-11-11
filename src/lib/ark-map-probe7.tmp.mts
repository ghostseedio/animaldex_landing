import fixture from "@/ark-scene/fixtures/snapshot.json";
import {decodeArkSnapshot} from "@/ark-scene/snapshot";
import {placeAnimals, allocateArkPlaces} from "@/ark-scene/placement";
import {arkBody} from "@/ark-scene/stats";
const full = decodeArkSnapshot(fixture)!;
const p = placeAnimals(full.animals);
const s = allocateArkPlaces(full.animals);
for (const a of full.animals.filter((a) => a.zone === "desert")) { const q = p.get(a.id)!; const sl = s.get(a.id)!; console.log(a.model_slug, sl.slot, sl.rank, q.x.toFixed(2), q.z.toFixed(2), q.map?.tag, q.map?.level, q.micro ? "micro" : "", arkBody(a).metres.toFixed(2)); }
