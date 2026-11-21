/**
 * ARK-POSE: a contact sheet of many species' poses without a browser: a row per species (in the order given), and per
 * clip named its side, three-quarter front and three-quarter back views.
 *
 *   npx tsx --tsconfig scripts/tsconfig.scripts.json scripts/ark-pose-sheet.mts <dir of <slug>.glb> <out.png> <slug,slug,...> <clip[:frame],...> [--off] [--size 240]
 *
 * A clip a rig does not have is drawn as its idle with a red band (it stands). `--off`: the load without this lane's
 * gates (`__arkPoseGate = false`), for the before sheet.
 */
import {loadRig, rowOf, sheet, skinnedBy, views, writePng, type Picture} from "./ark-pose-lib.mts";

const [dir, out, slugList, clipList] = process.argv.slice(2);
if (process.argv.includes("--off")) (globalThis as {__arkPoseGate?: boolean}).__arkPoseGate = false;
const sizeAt = process.argv.indexOf("--size");
const size = sizeAt > 0 ? Number(process.argv[sizeAt + 1]) : 240;
const pictures: Picture[] = [];
const names = clipList.split(",");
for (const slug of slugList.split(",")) {
    const r = await loadRig(`${dir}/${slug}.glb`, slug);
    const line: string[] = [];
    for (const item of names) {
        const [name, frame] = item.split(":");
        const clip = r.clips[name];
        const use = clip ?? r.clips.idle ?? Object.values(r.clips)[0];
        const f = frame === "end" ? use.rows - 1 : frame === "mid" ? Math.floor(use.rows / 2) : Number(frame ?? 0);
        const tiles = views(r, skinnedBy(r, rowOf(r.data, r.bones, use.row + Math.min(f, use.rows - 1))), [[90, 4], [40, 16], [140, 16]], size);
        if (!clip) for (const tile of tiles) for (let i = 0; i < tile.width * 8 * 3; i += 3) tile.rgb.set([210, 60, 60], i);
        pictures.push(...tiles);
        line.push(clip ? name : `${name}:none`);
    }
    console.log(slug, line.join(" "));
}
writePng(out, sheet(pictures, names.length * 3));
