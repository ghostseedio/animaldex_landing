import {sampleGround, zoneAt, ZONE_SITES} from "@/ark-scene/world";
import {worldDecor, forestFill} from "@/ark-scene/decor";
const decor = [...worldDecor(), ...forestFill()].filter((d: any) => d.kind !== "flower" && d.kind !== "leaf");
const h = (x: number, z: number) => sampleGround(x, z).height;
const best: any[] = [];
for (let x = -60; x <= 40; x += 1.5) for (let z = -90; z <= -20; z += 1.5) {
  const s = sampleGround(x, z);
  if (zoneAt(s) !== "mountains" || s.land < 0.95) continue;
  const e = 1; const gx = (h(x + e, z) - h(x - e, z)) / 2, gz = (h(x, z + e) - h(x, z - e)) / 2;
  const g = Math.hypot(gx, gz); if (g < 0.05) continue;
  const ux = gx / g, uz = gz / g; // uphill
  const y = s.height;
  const back = h(x + ux * 5, z + uz * 5) - y;
  const front = Math.abs(h(x - ux * 2.5, z - uz * 2.5) - y);
  const side = Math.abs(h(x - uz * 2.5, z + ux * 2.5) - y) + Math.abs(h(x + uz * 2.5, z - ux * 2.5) - y);
  const clear = !decor.some((d) => Math.hypot(d.x - x, d.z - z) < 3.6);
  const facing = (-ux * -x + -uz * -z) / Math.hypot(x, z); // mouth faces island centre
  const site = ZONE_SITES.mountains; const dsite = Math.hypot(x - site.x, z - site.z);
  if (!clear || back < 4.5 || dsite < 12 || y < 14) continue;
  best.push({x, z, y: y.toFixed(1), back: back.toFixed(1), front: front.toFixed(2), side: side.toFixed(1), facing: facing.toFixed(2), score: back - 3 * front - side + 3 * facing});
}
best.sort((a, b) => b.score - a.score);
console.log(best.slice(0, 12));
