import fixtureV2 from "@/ark-scene/fixtures/snapshot-v2.json";
import {decodeArkSnapshot} from "@/ark-scene/snapshot";
import {placeAnimals} from "@/ark-scene/placement";
const v2 = decodeArkSnapshot(fixtureV2)!;
const p = placeAnimals(v2.animals);
for (const a of v2.animals.filter((a) => ["harbor-seal"].includes(a.model_slug))) { const q = p.get(a.id)!; console.log(a.model_slug, a.zone, a.slot, a.slot_rank, q.x.toFixed(2), q.z.toFixed(2), q.map?.tag, q.map?.level, q.map?.key, q.micro?.attach?.id, q.ground.toFixed(2)); }
