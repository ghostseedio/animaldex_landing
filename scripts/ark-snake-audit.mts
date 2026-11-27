/**
 * ARK-MODELS: rest pose and clip audit of legless rigs (snakes, legless lizards, caecilians, worms).
 *   npx tsx --tsconfig scripts/tsconfig.scripts.json scripts/ark-snake-audit.mts <dir of <slug>.glb> <slug,slug,...>
 * One JSON line per slug: the idle frame's box (length along the body's long horizontal axis, height), height / length,
 * the share of the body above a fifth of the length (coiled or upright), and the clip names.
 */
import {loadRig, rowOf, skinnedBy} from "./ark-pose-lib.mts";
import {restRow} from "@/ark-scene/locomotion/neck-gate";

const [dir, list] = process.argv.slice(2);
for (const slug of list.split(",")) {
    try {
        const r = await loadRig(`${dir}/${slug}.glb`, slug);
        const clip = r.clips.idle;
        const p = skinnedBy(r, clip ? rowOf(r.data, r.bones, clip.row) : restRow(r.rig));
        const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
        for (let i = 0; i < p.length; i += 3) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], p[i + k]); hi[k] = Math.max(hi[k], p[i + k]); }
        const len = Math.max(hi[0] - lo[0], hi[2] - lo[2]), h = hi[1] - lo[1];
        let up = 0;
        for (let i = 1; i < p.length; i += 3) if (p[i] - lo[1] > len * 0.2) up++;
        console.log(JSON.stringify({slug, len: +len.toFixed(3), h: +h.toFixed(3), hl: +(h / len).toFixed(3), up: +(up / (p.length / 3)).toFixed(3), clips: Object.keys(r.clips).sort()}));
    } catch (e) { console.log(JSON.stringify({slug, error: String(e).slice(0, 120)})); }
}
