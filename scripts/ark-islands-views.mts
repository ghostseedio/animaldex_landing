import {townPlan} from "@/ark-scene/islands/town/plan";
import {townWorldOrigin} from "@/ark-scene/islands";
const o = townWorldOrigin();
const plan = townPlan();
const slot = (id: string) => plan.zoo.slots.find((s) => s.id === id)!.at;
const f = plan.farms.find((x) => x.id === "farmstead-0")!.at;
const views = {
  savanna: {target: {x: slot("savanna_paddocks-1").x, y: 0, z: slot("savanna_paddocks-1").z}, distance: 45, polar: 0.85, azimuth: 0.4},
  penguins: {target: {x: slot("penguin_seal_pools-1").x, y: 1, z: slot("penguin_seal_pools-1").z}, distance: 26, polar: 0.8, azimuth: 0.2},
  zoo: {target: {x: -125, y: 0, z: -60}, distance: 110, polar: 0.75, azimuth: 0.6},
  homes: {target: {x: 92, y: 2, z: 22}, distance: 55, polar: 0.9, azimuth: 0.7},
  farm: {target: {x: f.x, y: 2, z: f.z}, distance: 45, polar: 0.85, azimuth: 0.5}
};
for (const v of Object.values(views)) {
    v.target.x += o.x;
    v.target.z += o.z;
}
console.log(JSON.stringify(views));
