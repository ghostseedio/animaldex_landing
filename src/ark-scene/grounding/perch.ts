/**
 * Perches on the trees as they are drawn (motion 100x pass, lane L3: "tree animals aren't properly on branches ...
 * never inside the canopy or hovering beside it"). Since tree-attach generator 7 every branch, limb and hang point
 * carries `open`: the share of sight lines out of its tree (40° round out-and-up; out-and-down under a limb) that
 * leave the tree unblocked. Most of the old points were deep in their crowns (61% of branch points, 57% of limb
 * points saw out nowhere): an animal put there is hidden in the leaves. The attach sampler (`sampler.ts`) keeps a
 * hidden point for what lives in the leaves (an insect, a spider, a tree frog: a body of 6 cm and under; a roosting
 * bat under a limb, 20 cm and under) and offers the visible ones, its outer-crown perches first, to everyone else.
 */

/** A tree point is hidden in its crown below this openness. */
export const HIDDEN_OPEN = 0.25;
/** The largest body (m) a hidden branch or limb point keeps (the small things that live in the leaves). */
export const HIDDEN_MAX_BODY = 0.06;
/** The largest body (m) a hidden hang point keeps (a bat roosting in the foliage). */
export const HIDDEN_HANG_MAX_BODY = 0.2;

const TREE_PERCHES = new Set(["branch", "limb", "canopy_hang"]);

/** Whether a tree point (scenery tag, its openness) is hidden in its crown; points without a measured openness never are. */
export function perchHidden(tag: string, open: number | undefined, measured: boolean): boolean {
    return measured && TREE_PERCHES.has(tag) && typeof open === "number" && open < HIDDEN_OPEN;
}

/** The size range a tree point offers: a hidden one only to small bodies (as above). */
export function perchSize(tag: string, open: number | undefined, measured: boolean, size: [number, number]): [number, number] {
    if (!perchHidden(tag, open, measured)) return size;
    const most = tag === "canopy_hang" ? HIDDEN_HANG_MAX_BODY : HIDDEN_MAX_BODY;
    return [Math.min(size[0], most), Math.min(size[1], most)];
}
