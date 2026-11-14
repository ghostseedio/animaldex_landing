import {readFileSync} from "node:fs";
import {setArkWorld} from "@/ark-scene/world";
setArkWorld("v2");
const {mergeArkIslandsRouting} = await import("@/lib/ark-islands-local");
const {decodeArkSnapshot} = await import("@/ark-scene/snapshot");
const {arkIslandSnapshot} = await import("@/lib/ark-islands");
const {placeTownAnimals} = await import("@/ark-scene/islands/town/placement");
const {townHeight} = await import("@/ark-scene/islands/town/ground");
const {townWorldSampler} = await import("@/ark-scene/islands/town/sampler");
const {townColliderSet} = await import("@/ark-scene/islands/town/colliders");
const {scheduleWorld, tripAt, poseOnTrip, withLazyRoost} = await import("@/ark-scene/behaviour-schedule");
const {behaviourProfile} = await import("@/ark-scene/behaviour-profile");
const {modelBase} = await import("@/ark-scene/grounding/base");
const {arkBody} = await import("@/ark-scene/stats");
const {islandHours} = await import("@/lib/ark-clock");
const W = process.env.ARK_LOCAL!;
const {merged} = mergeArkIslandsRouting(JSON.parse(readFileSync(W + "live.json", "utf8")), JSON.parse(readFileSync(W + "islands-routing.json", "utf8")));
const whole = decodeArkSnapshot((merged as {snapshot?: unknown}).snapshot ?? merged)!;
const town = arkIslandSnapshot(whole, "town");
const placed = placeTownAnimals(town.animals);
const world = scheduleWorld(townWorldSampler(placed.open, {x: 0, z: 0}, townColliderSet(placed.open, {x: 0, z: 0})));
const a = town.animals.find((q) => q.id === process.env.ID)!;
const p = placed.places.get(a.id)!; const info = placed.town.get(a.id)!;
console.log(a.model_slug, a.activity, info, p);
const mb = modelBase(a.model_slug);
const length = arkBody(a, mb?.plan ?? null).display;
const profile = behaviourProfile(a.model_slug, mb?.plan ?? null);
console.log("roost", JSON.stringify(profile.roost), "altitude", profile.altitude);
const own = withLazyRoost({id: a.id, zone: a.zone, home: {x: p.x, y: p.ground, z: p.z}, length, sea: false, range: Math.max(info.range, 0.6) * 1.5}, () => null);
let trip: any = null; let last = "";
const start = Date.UTC(2026, 10, 12) / 1000 + Number(process.env.H ?? 0) * 3600;
for (let e = start; e < start + 3300; e += 15) {
  if (!trip || e < trip.start || e >= trip.end) trip = tripAt(world, profile, own, e, (x: number) => islandHours(x * 1000, 0), a.activity ?? null, trip);
  const at = poseOnTrip(world, trip, e);
  const line = `${trip.doing} to=${trip.to.point ?? "-"} toY=${trip.to.y.toFixed(2)} at ${trip.to.x.toFixed(1)},${trip.to.z.toFixed(1)} mode=${trip.legs?.map((l: any) => l.mode).join("/")}`;
  if (line !== last) { console.log(((e - start)).toFixed(0), line, "pose", at.x.toFixed(1), at.y.toFixed(2), at.z.toFixed(1), "ground", townHeight(at.x, at.z).toFixed(2), at.aloft ? "aloft" : ""); last = line; }
}
