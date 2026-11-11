import {sampleGround, zoneAt, ZONE_SITES} from "@/ark-scene/world";
import {worldDecor, forestFill} from "@/ark-scene/decor";
const decor = [...worldDecor(), ...forestFill()].filter((d: any) => d.kind !== "flower" && d.kind !== "leaf");
const h = (x: number, z: number) => sampleGround(x, z).height;
const out: any[] = [];
for (let x = -70; x <= 60; x += 1.5) for (let z = -95; z <= 30; z += 1.5) {
  const s = sampleGround(x, z);
  const zone = zoneAt(s);
  if ((zone !== "mountains" && zone !== "polar") || s.land < 0.97 || s.height < 3) continue;
  let lo = Infinity, hi = -Infinity;
  for (let a = 0; a < 8; a++) for (const r of [2, 4.5]) { const y = h(x + Math.cos(a * 0.785) * r, z + Math.sin(a * 0.785) * r); lo = Math.min(lo, y); hi = Math.max(hi, y); }
  if (hi - lo > 2.0 || zone !== "mountains") continue;
  const near = decor.filter((d) => Math.hypot(d.x - x, d.z - z) < 5.2).length;
  if (near > 0) continue;
  const site = ZONE_SITES[zone]; const ds = Math.hypot(x - site.x, z - site.z);
  if (ds < site.clearing + 3) continue;
  out.push({x, z, zone, y: s.height.toFixed(1), spread: (hi - lo).toFixed(2), ds: ds.toFixed(0)});
}
out.sort((a, b) => +a.spread - +b.spread);
console.log(out.length, out.slice(0, 15));
