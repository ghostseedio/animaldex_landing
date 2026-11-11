import {readFileSync} from "node:fs";
import {Matrix4, Quaternion, Vector3} from "three";
import {buildLocoRig} from "../src/ark-scene/locomotion/skeleton";
import {leggedDriver, sweepLimit, type LeggedState} from "../src/ark-scene/locomotion/legged";
const rig = buildLocoRig(JSON.parse(readFileSync(`src/ark-scene/locomotion/fixtures/${process.argv[2]}.json`, "utf8")));
const scale = Number(process.argv[3]) / Math.max(rig.length, rig.height);
const fr = Number(process.argv[4] ?? 2.5);
const hip = rig.gaitLength * scale; const v = Math.sqrt(fr * 9.81 * hip);
console.log("legH", rig.legHeight.toFixed(3), "hipM", hip.toFixed(3), "v", v.toFixed(2), "sweepLimit(mesh)", sweepLimit(rig).toFixed(3), "legs", rig.legs.map((l) => `${l.key} up${l.upperLength.toFixed(2)} lo${l.lowerLength.toFixed(2)} vert${(l.hip[1] - l.ankle[1]).toFixed(2)}`).join(" "));
const st = leggedDriver.init(rig) as LeggedState; const world = rig.bones.map((b) => b.restWorld.clone());
for (let f = 0; f <= 240; f++) { const t = f / 60; const z = v * t;
  const inst = new Matrix4().compose(new Vector3(0, -rig.minY * scale, z), new Quaternion(), new Vector3(scale, scale, scale));
  rig.bones.forEach((b, i) => world[i].copy(b.restWorld));
  const g = leggedDriver.pose(rig, {instance: inst, scale, yaw: 0, dt: 1 / 60, clock: 10 + t, seed: 0.3, ground: () => ({height: 0, nx: 0, ny: 1, nz: 0}), grounded: true, clipNow: "run", clipFrom: null, clipPhase: 0}, world, st)!;
  if (f % 40 === 0) console.log(t.toFixed(2), g.gait, "cad", g.cadence.toFixed(2), "stride m", g.stride.toFixed(2), "duty", g.duty.toFixed(2), "crouch", (st.crouch.x / rig.legHeight).toFixed(3), "drop", (st.drop.x / rig.legHeight).toFixed(3), "bob", (st.bob.x / rig.legHeight).toFixed(3));
}
