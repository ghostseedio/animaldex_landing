import {validateMap} from "@/ark-scene/map/validate";
import {validateGrips} from "@/ark-scene/map/validate-grips";
const r = validateMap();
const t = performance.now();
const g = await validateGrips(r.placed, (id) => id.replace(/^v-/, "").replace(/-\d+$/, ""));
console.log("grips", g.skipped, g.checked, g.failures.length, Math.round(performance.now() - t), "ms");
const by: Record<string, number> = {};
for (const f of g.failures) by[f.detail.replace(/\d+%.*/, "N%").slice(0, 40)] = (by[f.detail.replace(/\d+%.*/, "N%").slice(0, 40)] ?? 0) + 1;
console.log(by); console.log(g.failures.slice(0, 12));
