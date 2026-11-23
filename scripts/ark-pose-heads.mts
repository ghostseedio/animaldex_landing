/**
 * ARK-POSE: the primates' sitting heads up close without a browser: per species its rest pose and its posed sit, each
 * from its side and from its front, the picture centred on the head's joint.
 *
 *   npx tsx --tsconfig scripts/tsconfig.scripts.json scripts/ark-pose-heads.mts <dir of <slug>.glb> <out.png> <slug,slug,...> [--off] [--body]
 *
 * `--off`: the load without this lane's gates (ARK-SLEEP's own sit). `--body`: the whole animal, not the head alone.
 */
import {loadRig, draw, rowOf, sheet, skinnedBy, writePng, type Picture} from "./ark-pose-lib.mts";
import {restRow} from "@/ark-scene/locomotion/neck-gate";

const [dir, out, list] = process.argv.slice(2);
if (process.argv.includes("--off")) (globalThis as {__arkPoseGate?: boolean}).__arkPoseGate = false;
const body = process.argv.includes("--body");
const pictures: Picture[] = [];
for (const slug of list.split(",")) {
    const r = await loadRig(`${dir}/${slug}.glb`, slug);
    const box = r.geometry.boundingBox!;
    const size = Math.max(box.max.y - box.min.y, box.max.z - box.min.z);
    console.log(slug, JSON.stringify(r.prepared.sit));
    for (const row of [restRow(r.rig), rowOf(r.data, r.bones, r.clips.sleep.row)]) {
        const points = skinnedBy(r, row);
        const h = r.rig.head;
        const e = r.rig.bones[h].restWorld.elements;
        const at = (k: number) => row[h * 12 + k * 4] * e[12] + row[h * 12 + k * 4 + 1] * e[13] + row[h * 12 + k * 4 + 2] * e[14] + row[h * 12 + k * 4 + 3];
        const centre: [number, number, number] = body ? [(box.min.x + box.max.x) / 2, box.min.y + size * 0.5, (box.min.z + box.max.z) / 2] : [at(0), at(1), at(2)];
        for (const [azimuth, elevation] of [[90, 0], [0, 0]]) pictures.push(draw(points, r.index, {azimuth, elevation, ground: box.min.y, fit: size * (body ? 0.62 : 0.24), centre, size: 330}));
    }
}
writePng(out, sheet(pictures, 4));
