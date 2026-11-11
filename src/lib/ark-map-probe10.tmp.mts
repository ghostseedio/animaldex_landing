import {readFileSync} from "node:fs";
import {GLTFLoader} from "three/examples/jsm/loaders/GLTFLoader.js";
import {MeshoptDecoder} from "three/examples/jsm/libs/meshopt_decoder.module.js";
const buf = readFileSync(process.env.HOME + "/animaldex-talking-models/rig/publish/brown-throated-sloth/93f6c8cb011f.rig.glb");
const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
const gltf = await loader.parseAsync(ab, "");
gltf.scene.updateMatrixWorld(true);
gltf.scene.traverse((o: any) => { if (o.isBone && /foot|hand/i.test(o.name)) { const p = o.getWorldPosition(new (o.position.constructor)()); console.log(o.name, p.toArray().map((v: number) => v.toFixed(3))); } if (o.isSkinnedMesh) { o.geometry.computeBoundingBox(); console.log("bbox", o.geometry.boundingBox.min.toArray(), o.geometry.boundingBox.max.toArray()); } });
import {halfToFloat} from "@/ark-scene/rig-player";
const ex = (gltf.parser.json as any).extras.ark_rig;
const view = new Uint16Array((await gltf.parser.getDependency("bufferView", ex.bufferView)) as ArrayBuffer);
const B = ex.bones.length;
const bones: Record<string, any> = {};
gltf.scene.traverse((o: any) => { if (o.isBone) bones[o.name] = o.getWorldPosition(new (o.position.constructor)()); });
for (const row of [0, 12, 24]) {
  const out: string[] = [];
  for (const name of ["leg0L_foot", "leg1L_foot", "hips", "head"]) {
    const b = ex.bones.indexOf(name); const p = bones[name];
    const at = (axis: number) => { const base = row * B * 12 + b * 12 + axis * 4; return halfToFloat(view[base]) * p.x + halfToFloat(view[base + 1]) * p.y + halfToFloat(view[base + 2]) * p.z + halfToFloat(view[base + 3]); };
    out.push(`${name} ${[0, 1, 2].map((a) => at(a).toFixed(3)).join(",")}`);
  }
  console.log(row, out.join(" | "));
}
