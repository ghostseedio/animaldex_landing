import {mapPoints} from "@/ark-scene/map/place";
import {placeAnimals} from "@/ark-scene/placement";
import {mapSlugs, mapSpecies} from "@/ark-scene/map/species";
import table from "@/ark-scene/map/species.json";
const t0 = performance.now();
const pts = mapPoints();
const all = pts.all();
console.log("points", all.length, "ms", Math.round(performance.now() - t0));
const t1 = performance.now();
console.log("attach points", pts.sampler.attachPoints().length, "ms", Math.round(performance.now() - t1));
const hab = JSON.parse((await import("node:fs")).readFileSync(process.env.HOME + "/animaldex-talking-models/habitats.json", "utf8"));
const animals = mapSlugs().map((slug, i) => ({id: `a${i}`, species_profile_id: slug, name: slug, scientific_name: null, model_slug: slug, zone: hab[slug] ?? "farm_garden", arrived_at: "2026-11-01T00:00:00Z", brought_by: {label: "x", named: false}, mine: false, slot: i, slot_rank: 0}));
const t2 = performance.now();
const placed = placeAnimals(animals as never);
console.log("placed", placed.size, "ms", Math.round(performance.now() - t2));
const kinds: Record<string, number> = {};
for (const a of animals) { const p = placed.get(a.id)!; const k = p.map ? (p.micro ? "attach" : p.canopy ? "canopy" : p.map.held ? "held" : "ground") + (p.map.tag === mapSpecies(a.model_slug, a.zone as never)?.spawn ? "" : ":other-tag") : "zone"; kinds[k] = (kinds[k] ?? 0) + 1; }
console.log(kinds);
