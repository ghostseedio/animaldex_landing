/**
 * ARK-ANIM round 3: the posed lie's gate (`locomotion/lie-pose.ts`) on every four-legged rig of a folder of rig files (the
 * live set's, meshopt decoded). usage: npx tsx scripts/ark-lie-scan.mts <dir of <slug>.glb> <out.jsonl>
 */
import {readFileSync, readdirSync, appendFileSync} from "node:fs";
import type {SkinnedMesh} from "three";
import {GLTFLoader} from "three/examples/jsm/loaders/GLTFLoader.js";
import {MeshoptDecoder} from "three/examples/jsm/libs/meshopt_decoder.module.js";
import {restGeometry, rawSkeletonOf} from "@/ark-scene/rig-player";
import {buildLocoRig} from "@/ark-scene/locomotion/skeleton";
import {LiePose, lieShaped} from "@/ark-scene/locomotion/lie-pose";
const [dir, out] = process.argv.slice(2);
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
for (const f of readdirSync(dir).filter((f) => f.endsWith(".glb"))) {
  const slug = f.replace(/\.glb$/, "");
  const b = readFileSync(`${dir}/${f}`);
  const jl = b.readUInt32LE(12); const j = JSON.parse(b.subarray(20, 20 + jl).toString());
  const x = j.extras?.ark_rig; const e = x?.rig;
  if (!e || e.plan !== "quadruped") continue;
  const pilot = typeof e.code === "string" && e.code.startsWith("pilot");
  try {
    const gltf: any = await new Promise((res, rej) => loader.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), "", res, rej));
    let mesh: SkinnedMesh | null = null;
    gltf.scene.updateMatrixWorld(true);
    gltf.scene.traverse((o: any) => { if (!mesh && o.isSkinnedMesh) mesh = o; });
    const geometry = restGeometry(mesh!, x.bones);
    const raw = rawSkeletonOf(mesh!, x.bones, geometry, slug, e);
    const rig = buildLocoRig(raw);
    const lie = new LiePose(rig, raw);
    appendFileSync(out, JSON.stringify({slug, pilot, shaped: lieShaped(rig), sitting: rig.sitting, ...lie.check}) + "\n");
  } catch (err) {
    appendFileSync(out, JSON.stringify({slug, pilot, error: String(err)}) + "\n");
  }
}
