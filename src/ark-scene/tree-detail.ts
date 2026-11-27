/**
 * Lane SEAT (2026-11-27): the trees an animal drawn near is held on, drawn at full detail.
 *
 * A perch on a tree is one of the tree's attach points, and those are on its full-detail level, lod0 (`tree-assets.ts`
 * TREE_CLOSE: "the level its attach points are on"). The library's trees hand over to their lighter levels by the
 * camera's distance alone (`asset-trees.ts` update: on the medium tier a beech is lod0 only within 15 m or so), and the
 * lighter levels have not got the full tree's limbs: a downy woodpecker asleep on its beech's limb, drawn as a rig 20 m
 * off, was held a metre over the lod2 crown under it, on nothing (the seat audit, PR #160's CI), and the seat pass may
 * not move a held animal more than half a metre to anything else (ARK-VANISH).
 *
 * So the seat pass tells this module where each animal drawn near and held on a surface is (`holdTreeDetail`, each time
 * it seats it), and the trees round those points keep their full level (`asset-trees.ts`), as many as `TREE_DETAIL_MOST`.
 * Nothing else changes: the same trees, the same places, only their level of detail while a held animal is drawn on them.
 */

type Held = {x: number; y: number; z: number; frame: number};

const held = new Map<object, Held>();
let points: Array<{x: number; y: number; z: number}> | null = null;
let version = 0;

/** The most trees kept at full detail this way at once (each a lod0 instance: 4,000 to 9,500 triangles, no draw call). */
export const TREE_DETAIL_MOST = 24;

/** An animal (`key`, its holder) drawn held at (x, y, z) this frame (`frame`: the seat pass's own count). */
export function holdTreeDetail(key: object, x: number, y: number, z: number, frame: number): void {
    const h = held.get(key);
    if (!h) {
        held.set(key, {x, y, z, frame});
        version++;
        points = null;
        return;
    }
    h.frame = frame;
    // (Moved along its limb a little: the same tree. Moved on further: the trees round it are sorted again.)
    if (Math.hypot(x - h.x, y - h.y, z - h.z) > 0.5) {
        h.x = x;
        h.y = y;
        h.z = z;
        version++;
        points = null;
    }
}

/**
 * At a frame's start: those not held for `keep` frames are let go (off their perch, no longer drawn near). The seat
 * pass works a calm animal out every half second or so, longer when its budget is short: four seconds covers that.
 */
export function releaseTreeDetail(frame: number, keep = 240): void {
    held.forEach((h, key) => {
        if (frame - h.frame > keep || frame < h.frame) {
            held.delete(key);
            version++;
            points = null;
        }
    });
}

/** Where animals are held now (world frame). */
export function treeDetailPoints(): ReadonlyArray<{x: number; y: number; z: number}> {
    return (points ??= Array.from(held.values(), (h) => ({x: h.x, y: h.y, z: h.z})));
}

/** Changes whenever a point is held, moved or let go: the trees are sorted again then. */
export function treeDetailVersion(): number {
    return version;
}

/**
 * Whether a tree (its foot, its crown's radius and its height, world frame, scaled) holds one of these points up in it:
 * over half a metre above its foot (the trunk's foot is on every level) and inside its crown's cylinder.
 */
export function treeHoldsPoint(tree: {x: number; y: number; z: number; radius: number; height: number}, list: ReadonlyArray<{x: number; y: number; z: number}>): boolean {
    for (const p of list) {
        if (p.y < tree.y + 0.5 || p.y > tree.y + tree.height + 0.5) continue;
        if (Math.hypot(p.x - tree.x, p.z - tree.z) <= tree.radius + 0.5) return true;
    }
    return false;
}

/** Tests: everything let go. */
export function resetTreeDetail(): void {
    held.clear();
    points = null;
    version++;
}
