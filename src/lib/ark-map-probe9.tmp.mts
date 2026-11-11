import {placeAnimals} from "@/ark-scene/placement";
const a = (slug: string, zone: string, slot: number) => ({id: slug, species_profile_id: slug, name: slug, scientific_name: null, model_slug: slug, zone, arrived_at: "2026-11-01T00:00:00Z", brought_by: {label: "x", named: false}, mine: false, slot, slot_rank: 0});
const p = placeAnimals([a("water-strider", "river_lake", 20), a("star-nosed-mole", "woodland", 31)] as never);
for (const [id, q] of p) console.log(id, JSON.stringify({x: q.x, z: q.z, g: q.ground, water: q.water, tag: q.map?.tag, att: q.micro?.attach?.tag, burrow: !!q.burrow}));
