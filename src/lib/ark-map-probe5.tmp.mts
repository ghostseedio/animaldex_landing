import fixture from "@/ark-scene/fixtures/snapshot.json";
import {decodeArkSnapshot} from "@/ark-scene/snapshot";
import {placeAnimals, allocateArkPlaces} from "@/ark-scene/placement";
const full = decodeArkSnapshot(fixture)!;
const p = placeAnimals(full.animals);
const s = allocateArkPlaces(full.animals);
const goats = full.animals.filter((a) => a.model_slug === "domestic-goat");
for (const a of goats) { const q = p.get(a.id)!; const sl = s.get(a.id)!; console.log(a.zone, sl.slot, sl.rank, q.x.toFixed(2), q.z.toFixed(2), q.map?.tag, q.map?.level, q.micro ? "micro" : ""); }
