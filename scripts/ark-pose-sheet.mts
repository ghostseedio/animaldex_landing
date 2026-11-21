/**
 * ARK-POSE: a contact sheet of many species' poses without a browser: a row per species (in the order given), and per
 * clip named its side, three-quarter front and three-quarter back views.
 *
 *   npx tsx --tsconfig scripts/tsconfig.scripts.json scripts/ark-pose-sheet.mts <dir of <slug>.glb> <out.png> <slug,slug,...> <clip[:frame][@yaw/pitch],...> [--off] [--size 240]
 *
 * `@yaw/pitch` (degrees; + to its left, + down): the head look asked of it on top of the clip, drawn as the shader draws
 * it: clamped to the rig's limits, split by its neck share, times the clip's share of the look.
 *
 * A clip a rig does not have is drawn as its idle with a red band (it stands). `--off`: the load without this lane's
 * gates (`__arkPoseGate = false`), for the before sheet.
 */
import {loadRig, rowOf, sheet, skinnedBy, views, writePng, type Picture} from "./ark-pose-lib.mts";
import {lookOnRow} from "@/ark-scene/locomotion/neck-gate";

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
        const [what, asked] = item.split("@");
        const [name, frame] = what.split(":");
        const clip = r.clips[name];
        const use = clip ?? r.clips.idle ?? Object.values(r.clips)[0];
        const f = frame === "end" ? use.rows - 1 : frame === "mid" ? Math.floor(use.rows / 2) : Number(frame ?? 0);
        let row = rowOf(r.data, r.bones, use.row + Math.min(f, use.rows - 1));
        const look = r.prepared.look ?? r.look;
        if (asked && look) {
            const [yaw, pitch] = asked.split("/").map((n) => (Number(n) * Math.PI) / 180);
            const share = use.lookShare ?? 1;
            const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);
            row = lookOnRow(row, r.bones, look, look.neckShare, clamp(yaw, -look.yaw, look.yaw) * share, clamp(pitch || 0, -look.up, look.down) * share, new Float32Array(r.bones * 12));
        }
        // (A look is drawn from its front too.)
        const tiles = views(r, skinnedBy(r, row), asked ? [[90, 4], [20, 14], [-40, 14]] : [[90, 4], [40, 16], [140, 16]], size);
        if (!clip) for (const tile of tiles) for (let i = 0; i < tile.width * 8 * 3; i += 3) tile.rgb.set([210, 60, 60], i);
        pictures.push(...tiles);
        line.push(clip ? name : `${name}:none`);
    }
    console.log(slug, line.join(" "));
}
writePng(out, sheet(pictures, names.length * 3));
