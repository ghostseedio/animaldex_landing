/**
 * ARK-POSE: look at a rig's clips without a browser. A sheet (png) of one or more clips of one species, each from five
 * sides, a row per frame picked.
 *
 *   npx tsx --tsconfig scripts/tsconfig.scripts.json scripts/ark-pose-look.mts <dir of <slug>.glb> <slug> <out.png> clip[:frame][,clip[:frame]...]
 */
import {loadRig, rowOf, sheet, skinnedBy, views, writePng, type Picture} from "./ark-pose-lib.mts";

const [dir, slug, out, list] = process.argv.slice(2);
const r = await loadRig(`${dir}/${slug}.glb`, slug);
console.log(slug, r.entry.code, Object.keys(r.clips).join(" "), JSON.stringify(r.prepared.posedLie), JSON.stringify(r.prepared.fixes));
const pictures: Picture[] = [];
for (const item of (list ?? "idle").split(",")) {
    const [name, frame] = item.split(":");
    const clip = r.clips[name];
    if (!clip) {
        console.log("no clip", name);
        continue;
    }
    const f = frame === "end" ? clip.rows - 1 : frame === "mid" ? Math.floor(clip.rows / 2) : Number(frame ?? 0);
    pictures.push(...views(r, skinnedBy(r, rowOf(r.data, r.bones, clip.row + Math.min(f, clip.rows - 1)))));
}
writePng(out, sheet(pictures, 5));
