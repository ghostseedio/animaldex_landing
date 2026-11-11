import {validateMap, failuresBySpecies} from "@/ark-scene/map/validate";
const t = performance.now();
const r = validateMap();
console.log("animals", r.animals, "species", r.species, "failures", r.failures.length, "ms", Math.round(performance.now() - t));
const by: Record<string, number> = {};
for (const f of r.failures) by[f.check] = (by[f.check] ?? 0) + 1;
console.log(by);
const s = failuresBySpecies(r.failures);
console.log("species failing", s.size);
const ex: Record<string, string[]> = {};
for (const f of r.failures) { (ex[f.check] ??= []); if (ex[f.check].length < 6) ex[f.check].push(`${f.slug}: ${f.detail}`); }
console.log(JSON.stringify(ex, null, 1));
