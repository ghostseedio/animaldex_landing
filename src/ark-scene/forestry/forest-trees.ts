/**
 * The logging stands' trees as `asset-trees.ts` draws them (p5 humans; AnimalDex decision 379): one override for every
 * stand of the forestry switched on in the record (`ForestTrees.setDay` each frame with the shared Ark day). A tree in a
 * stand is upright until the felling front reaches it, falls over `FALL_SECONDS` (hinged at its foot, away from the
 * crew's way in), lies felled until hauled away, leaves its stump, and grows back beside it from the planters' sapling.
 * Pure in the day (`forest-state.ts`); no allocation per frame.
 */

import {Matrix4, Quaternion, Vector3} from "three";
import {loggingsAround, inStand, type Logging, type StandTable} from "@/ark-scene/positions/forestry";
import {fallingNow, saplingScale, saplingSpot, treeFate} from "@/ark-scene/forestry/forest-state";
import type {TreeOverride} from "@/ark-scene/asset-trees";
import type {StandTree} from "@/ark-scene/forestry/forest-render";

/** A drawn tree's trunk radius at its foot (m), from its height (the library's trunks are about a fiftieth of it). */
export function trunkRadius(height: number): number {
    return Math.min(Math.max(height * 0.018, 0.12), 0.9);
}

type Tree = {x: number; y: number; z: number; scale: number; height: number; radius: number; matrix: Matrix4};

const position = new Vector3();
const scaleV = new Vector3();
const turn = new Quaternion();
const hinge = new Quaternion();
const axis = new Vector3();

/** How often (Ark days) a stand's look is re-sorted when nothing is falling: a sapling's growth, a log hauled away. */
const STEP_DAYS = 0.02;

export class ForestTrees {
    private loggings: Logging[] = [];
    private day = -Infinity;
    private lastSorted = -Infinity;
    private dirty = true;
    private trees: StandTree[] = [];

    constructor(private readonly table: StandTable, private readonly fromDay: number) {}

    /** The stands logged or regrowing at `day` (none: every tree as built). */
    get active(): readonly Logging[] {
        return this.loggings;
    }

    /** The trees the override has seen in stands (their feet), for the crews to walk between. */
    standTrees(g: Logging): StandTree[] {
        return this.trees.filter((t) => inStand(g, t.x, t.z));
    }

    /** The shared Ark day now. Returns whether the stands in play changed (the host re-marks its trees then). */
    setDay(day: number): boolean {
        this.day = day;
        const now = loggingsAround(this.table, this.fromDay, day);
        const same = now.length === this.loggings.length && now.every((g, i) => g.k === this.loggings[i].k);
        if (!same) {
            this.loggings = now;
            this.dirty = true;
        }
        return !same;
    }

    /** The override `AssetTrees.setOverride` takes. */
    override(): TreeOverride {
        return {
            covers: (tree) => {
                const hit = this.loggings.some((g) => inStand(g, tree.x, tree.z));
                if (hit) this.trees.push({x: tree.x, y: tree.y, z: tree.z, radius: trunkRadius(tree.height)});
                return hit;
            },
            matrix: (tree, into) => this.matrixOf(tree, into),
            moving: () => this.loggings.some((g) => fallingNow(g, this.trees, this.day)),
            changed: () => {
                if (this.dirty || this.day - this.lastSorted > STEP_DAYS) {
                    this.dirty = false;
                    this.lastSorted = this.day;
                    return true;
                }
                return false;
            }
        };
    }

    /** Forget the trees seen (before a new `setOverride`, which marks them again). */
    resetTrees() {
        this.trees = [];
    }

    private matrixOf(tree: Tree, into: Matrix4): Matrix4 | null {
        let g: Logging | null = null;
        for (const l of this.loggings) if (inStand(l, tree.x, tree.z)) g = l;
        if (!g) return tree.matrix;
        const fate = treeFate(g, tree.x, tree.z, this.day);
        switch (fate.state) {
            case "standing":
                return tree.matrix;
            case "falling":
            case "log": {
                // Hinged at its foot: tipped about the horizontal axis square to its fall, its own turn kept.
                const fall = fate.state === "log" ? 1 : fate.fall;
                axis.set(Math.sin(fate.dir), 0, -Math.cos(fate.dir));
                hinge.setFromAxisAngle(axis, (Math.PI / 2) * 0.97 * fall);
                tree.matrix.decompose(position, turn, scaleV);
                turn.premultiply(hinge);
                // (Lifted by its trunk's radius as it lies, so the trunk rests on the ground rather than in it.)
                position.y += trunkRadius(tree.height) * fall;
                return into.compose(position, turn, scaleV);
            }
            case "stump":
                return null;
            case "sapling": {
                const s = saplingScale(fate.growth);
                const spot = saplingSpot(g, tree.x, tree.z);
                tree.matrix.decompose(position, turn, scaleV);
                position.set(position.x + (spot.x - tree.x), position.y, position.z + (spot.z - tree.z));
                scaleV.multiplyScalar(s);
                return into.compose(position, turn, scaleV);
            }
        }
    }
}
