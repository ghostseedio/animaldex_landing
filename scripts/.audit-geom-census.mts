// PERF-WEB audit (geom): census of the town's residents by area, and of the town's colliders. Untracked helper.
import {readFileSync} from "node:fs";
import {decodeArkSnapshot} from "@/ark-scene/snapshot";
import {arkIslandSnapshot} from "@/lib/ark-islands";
import {placeTownAnimals} from "@/ark-scene/islands/town/placement";
import {townColliderSet} from "@/ark-scene/islands/town/colliders";
import {townWorldOrigin} from "@/ark-scene/islands";
import {setArkWorld} from "@/ark-scene/world";
setArkWorld("v2");
const raw = JSON.parse(readFileSync(process.argv[2], "utf8"));
const snapshot = decodeArkSnapshot(raw.snapshot ?? raw)!;
const origin = townWorldOrigin();
const town = arkIslandSnapshot(snapshot, "town");
const placed = placeTownAnimals(town.animals);
const byArea = new Map<string, number>();
for (const a of town.animals) {
    const info = placed.town.get(a.id);
    const k = info ? `${info.area}${info.pen ? "+pen" : ""}${info.enclosure ? "+encl" : ""}${info.tank ? "+tank" : ""}${info.room ? "+room" : ""}` : "unplaced";
    byArea.set(k, (byArea.get(k) ?? 0) + 1);
}
console.log("origin", origin, "town animals", town.animals.length, "snapshot animals", snapshot.animals.length);
console.log([...byArea.entries()].sort((a, b) => b[1] - a[1]));
const t0 = performance.now();
const set = townColliderSet(placed.open, origin);
console.log("town colliders", set.list.length, "built ms", (performance.now() - t0).toFixed(0));
const kinds = new Map<string, number>();
for (const c of set.list) kinds.set(`${c.shape}:${c.kind}`, (kinds.get(`${c.shape}:${c.kind}`) ?? 0) + 1);
console.log([...kinds.entries()].sort((a, b) => b[1] - a[1]));
// cell occupancy of the 4 m index
const cells = (set as any).cells as Map<number, unknown[]>;
const sizes = [...cells.values()].map((l) => l.length).sort((a, b) => a - b);
const q = (p: number) => sizes[Math.min(sizes.length - 1, Math.floor(p * sizes.length))];
console.log("index cells", cells.size, "per cell p50", q(0.5), "p90", q(0.9), "p99", q(0.99), "max", sizes[sizes.length - 1], "mean", (sizes.reduce((a, b) => a + b, 0) / sizes.length).toFixed(2));
let maxReach = 0; for (const c of set.list) maxReach = Math.max(maxReach, c.reach);
const reaches = set.list.map((c) => c.reach).sort((a, b) => a - b);
console.log("reach p50", reaches[Math.floor(reaches.length / 2)].toFixed(2), "p99", reaches[Math.floor(reaches.length * 0.99)].toFixed(2), "max", maxReach.toFixed(2));
