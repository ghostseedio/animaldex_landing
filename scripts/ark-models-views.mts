/**
 * ARK-MODELS: each rig's rest pose (the pose the Ark shows at rest) from its side, its front and three-quarters,
 * untextured, for before/after sheets of new and remade models. Like ark-pose-heads.mts, without the sit row,
 * so it also draws rigs that have no sleep clip.
 *
 *   npx tsx --tsconfig scripts/tsconfig.scripts.json scripts/ark-models-views.mts <dir of <slug>.glb> <out.png> <slug,slug,...>
 *
 * One row per slug: side (azimuth 90), front (0), three-quarter (45).
 */
import {loadRig, draw, sheet, skinnedBy, writePng, type Picture} from "./ark-pose-lib.mts";
import {restRow} from "@/ark-scene/locomotion/neck-gate";

const [dir, out, list] = process.argv.slice(2);
const pictures: Picture[] = [];
for (const slug of list.split(",")) {
    const r = await loadRig(`${dir}/${slug}.glb`, slug);
    const box = r.geometry.boundingBox!;
    const size = Math.max(box.max.x - box.min.x, box.max.y - box.min.y, box.max.z - box.min.z);
    const points = skinnedBy(r, restRow(r.rig));
    const centre: [number, number, number] = [(box.min.x + box.max.x) / 2, box.min.y + (box.max.y - box.min.y) * 0.5, (box.min.z + box.max.z) / 2];
    console.log(slug, Object.keys(r.clips).join(","));
    for (const [azimuth, elevation] of [[90, 0], [0, 0], [45, 15]]) pictures.push(draw(points, r.index, {azimuth, elevation, ground: box.min.y, fit: size * 0.62, centre, size: 300}));
}
writePng(out, sheet(pictures, 3));
