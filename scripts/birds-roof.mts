import {readFileSync} from "node:fs";
import {setArkWorld} from "@/ark-scene/world";
setArkWorld("v2");
const {mergeArkIslandsRouting} = await import("@/lib/ark-islands-local");
const {decodeArkSnapshot} = await import("@/ark-scene/snapshot");
const {arkIslandSnapshot} = await import("@/lib/ark-islands");
const {placeTownAnimals} = await import("@/ark-scene/islands/town/placement");
const {townWorldSampler} = await import("@/ark-scene/islands/town/sampler");
const {townColliderSet} = await import("@/ark-scene/islands/town/colliders");
const {scheduleWorld, tripAt, poseOnTrip, withLazyRoost, roostOf} = await import("@/ark-scene/behaviour-schedule");
const {behaviourProfile} = await import("@/ark-scene/behaviour-profile");
const {modelBase} = await import("@/ark-scene/grounding/base");
const {arkBody} = await import("@/ark-scene/stats");
const {islandHours} = await import("@/lib/ark-clock");
const {townHeight} = await import("@/ark-scene/islands/town/ground");
const W = process.env.ARK_LOCAL!;
const {merged} = mergeArkIslandsRouting(JSON.parse(readFileSync(W + "live.json", "utf8")), JSON.parse(readFileSync(W + "islands-routing.json", "utf8")));
const whole = decodeArkSnapshot((merged as {snapshot?: unknown}).snapshot ?? merged)!;
const town = arkIslandSnapshot(whole, "town");
const placed = placeTownAnimals(town.animals);
const world = scheduleWorld(townWorldSampler(placed.open, {x: 0, z: 0}, townColliderSet(placed.open, {x: 0, z: 0})));
const start = Date.UTC(2026, 10, 12) / 1000 + Number(process.env.H ?? 0) * 3600;
const rows = new Map<string, number>();
for (const a of town.animals) {
  const info = placed.town.get(a.id)!; if (!["roof","ledge","tall","eave","belfry"].includes(info.where)) continue;
  const mb = modelBase(a.model_slug); if (mb?.plan !== "bird") continue;
  const p = placed.places.get(a.id)!;
  const length = arkBody(a, mb?.plan ?? null).display;
  const profile = behaviourProfile(a.model_slug, mb?.plan ?? null);
  const own = withLazyRoost({id: a.id, zone: a.zone, home: {x: p.x, y: p.ground, z: p.z}, length, sea: false, range: Math.max(info.range, 0.6) * 1.5}, () => null);
  const roost = roostOf(world, profile, own);
  const roostLow = roost.y < p.ground - 1;
  const doings = new Map<string, number>(); let trip: any = null;
  for (let e = start; e < start + 3 * 3300; e += 30) {
    if (!trip || e < trip.start || e >= trip.end) trip = tripAt(world, profile, own, e, (x: number) => islandHours(x * 1000, 0), a.activity ?? null, trip);
    doings.set(trip.doing, (doings.get(trip.doing) ?? 0) + 1);
  }
  const k = `${info.where} roost=${profile.roost} roostPoint=${roost.point ? roost.point.split(":")[1] : "none"} roostOnGround=${roostLow} activity=${a.activity} doings=${[...doings.keys()].sort().join(",")}`;
  rows.set(k, (rows.get(k) ?? 0) + 1);
}
for (const [k, n] of [...rows].sort((x, y) => y[1] - x[1])) console.log(n, k);
