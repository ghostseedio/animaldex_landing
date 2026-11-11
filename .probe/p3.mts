import {worldDecor, forestFill} from "@/ark-scene/decor";
import {grassTufts} from "@/ark-scene/decor";
const all = [...worldDecor().map((d) => ({...d, src: "decor"})), ...forestFill().map((d) => ({...d, src: "fill"}))];
for (const [x, z] of [[-21, -52.5], [-28.5, -52.5], [-1.5, -25.5]]) {
  console.log(x, z, all.filter((d) => Math.hypot(d.x - x, d.z - z) < 8).map((d) => `${d.src}:${d.kind}@${Math.hypot(d.x - x, d.z - z).toFixed(1)}${"rank" in d ? " r" + (d as any).rank?.toFixed?.(2) : ""}`).join(", "));
}
