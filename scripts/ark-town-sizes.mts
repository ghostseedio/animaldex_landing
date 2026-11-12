// Lane TB (docs/ark/town-island.md §12.3): every domestic, farm and zoo species on the real Ark's town, its drawn length
// and height against its expected standing height; flags past 1.5× or under 0.67×. Development only: reads the local
// real snapshot and T1's routing in place (public/ark-local, never committed). `npx tsx scripts/ark-town-sizes.mts`.
import {mkdirSync, readFileSync, writeFileSync} from "node:fs";
import {setArkWorld} from "@/ark-scene/world";
setArkWorld("v2");
const {mergeArkIslandsRouting} = await import("@/lib/ark-islands-local");
const {decodeArkSnapshot} = await import("@/ark-scene/snapshot");
const {arkIslandSnapshot} = await import("@/lib/ark-islands");
const {arkBody, bodyAxisExtent} = await import("@/ark-scene/stats");
const {modelBase} = await import("@/ark-scene/grounding/base");
const heights = JSON.parse(readFileSync("scripts/ark-true-scale/generated-heights.json", "utf8")).species as Record<string, {shoulder: number; top: number}>;
const W = process.env.ARK_LOCAL ?? "public/ark-local/";
mkdirSync(".ark-golden/town", {recursive: true});
const {merged} = mergeArkIslandsRouting(JSON.parse(readFileSync(W + "live.json", "utf8")), JSON.parse(readFileSync(W + "islands-routing.json", "utf8")));
const town = arkIslandSnapshot(decodeArkSnapshot((merged as {snapshot?: unknown}).snapshot ?? merged)!, "town");
const rows = new Map<string, any>();
for (const a of town.animals) {
  if (!a.area) continue;
  const key = `${a.area}|${a.model_slug}`;
  const r = rows.get(key);
  if (r) { r.n++; continue; }
  const base = modelBase(a.model_slug);
  const body = arkBody(a, base?.plan);
  const size = base?.size ?? null;
  const scale = size ? body.display / Math.max(bodyAxisExtent(a.model_slug, base?.plan, size), 0.05) : null;
  const drawnH = size && scale ? size.y * scale : null;
  const drawnL = size && scale ? size.z * scale : null;
  const want = heights[a.model_slug]?.top ?? null;
  rows.set(key, {area: a.area, slug: a.model_slug, n: 1, plan: base?.plan ?? "-", length: body.metres, source: body.source, drawnL, drawnH, wantH: want, hRatio: want && drawnH ? drawnH / want : null, model: Boolean(base)});
}
const list = [...rows.values()].sort((a, b) => a.area.localeCompare(b.area) || b.n - a.n);
const out = ["area\tslug\taboard\tplan\tbody_m\tsource\tdrawn_len_m\tdrawn_h_m\texpected_top_h_m\th_ratio\tflag"];
for (const r of list) {
  const flag = !r.model ? "no model base" : r.hRatio === null ? "" : r.hRatio > 1.5 ? "too tall" : r.hRatio < 0.67 ? "too short" : "";
  out.push([r.area, r.slug, r.n, r.plan, r.length.toFixed(3), r.source, r.drawnL?.toFixed(3) ?? "-", r.drawnH?.toFixed(3) ?? "-", r.wantH?.toFixed(2) ?? "-", r.hRatio?.toFixed(2) ?? "-", flag].join("\t"));
}
writeFileSync(process.env.ARK_OUT ?? ".ark-golden/town/sizes.tsv", out.join("\n") + "\n");
console.log(out.filter((l) => /too |no model/.test(l)).join("\n"));
console.log("species", list.length);
