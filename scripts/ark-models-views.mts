/**
 * ARK-MODELS: each rig's rest pose (the pose the Ark shows at rest) from its side, its front and three-quarters,
 * untextured, for before/after sheets of new and remade models. Like ark-pose-heads.mts, without the sit row,
 * so it also draws rigs that have no sleep clip.
 *
 *   npx tsx --tsconfig scripts/tsconfig.scripts.json scripts/ark-models-views.mts <dir of <slug>.glb> <out.png> <slug,slug,...>
 *
 * One row per slug: side (azimuth 90), front (0), three-quarter (45).
 * ARK_VIEW_ANGLES="90,0;0,85" sets the views (azimuth,elevation; default side, front, three-quarter).
 * ARK_VIEW_CLIP=idle draws the first frame of that clip instead of the bind pose: bird and insect rigs carry flight
 * wing cards at their open size in the bind pose, which every clip tucks away (rig_ark.py CARD_HIDDEN), so the bind
 * pose shows them as flat sheets the Ark never draws.
 */
import {loadRig, draw, rowOf, sheet, skinnedBy, writePng, type Picture} from "./ark-pose-lib.mts";
import {restRow} from "@/ark-scene/locomotion/neck-gate";

const [dir, out, list] = process.argv.slice(2);
const pictures: Picture[] = [];
for (const slug of list.split(",")) {
    const r = await loadRig(`${dir}/${slug}.glb`, slug);
    const box = r.geometry.boundingBox!;
    const size = Math.max(box.max.x - box.min.x, box.max.y - box.min.y, box.max.z - box.min.z);
    const clip = process.env.ARK_VIEW_CLIP ? r.clips[process.env.ARK_VIEW_CLIP] : undefined;
    const points = skinnedBy(r, clip ? rowOf(r.data, r.bones, clip.row) : restRow(r.rig));
    const centre: [number, number, number] = [(box.min.x + box.max.x) / 2, box.min.y + (box.max.y - box.min.y) * 0.5, (box.min.z + box.max.z) / 2];
    console.log(slug, Object.keys(r.clips).join(","));
    const angles = process.env.ARK_VIEW_ANGLES ? process.env.ARK_VIEW_ANGLES.split(";").map((a) => a.split(",").map(Number)) : [[90, 0], [0, 0], [45, 15]];
    for (const [azimuth, elevation] of angles) pictures.push(draw(points, r.index, {azimuth, elevation, ground: box.min.y, fit: size * 0.62, centre, size: 300}));
}
writePng(out, sheet(pictures, process.env.ARK_VIEW_ANGLES ? process.env.ARK_VIEW_ANGLES.split(";").length : 3));
