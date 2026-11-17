/**
 * The logging stands' trees as `asset-trees.ts` draws them (p5 humans; AnimalDex decision 379): one override for every
 * stand of the forestry switched on in the record (`ForestTrees.setDay` each frame with the shared Ark day). A tree in a
 * stand is upright until the felling front reaches it, falls over `FALL_SECONDS` (hinged at its foot, away from the
 * crew's way in), lies felled until hauled away, leaves its stump, and grows back in its place from the planters' sapling.
 * Pure in the day (`forest-state.ts`); no allocation per frame.
 */

import {Matrix4, Quaternion, Vector3} from "three";
import {loggingsAround, inStand, type Logging, type StandTable} from "@/ark-scene/positions/forestry";
import {fallingNow, saplingScale, treeFate} from "@/ark-scene/forestry/forest-state";
import type {TreeOverride} from "@/ark-scene/asset-trees";
import type {StandTree} from "@/ark-scene/forestry/forest-render";

/** A drawn tree's trunk radius at its foot (m), from its height (the library's trunks are about a fiftieth of it). */
export function trunkRadius(height: number): number {
    return Math.min(Math.max(height * 0.018, 0.12), 0.9);
}

/**
 * How far a tree's foot spreads (m): its trunk, the rainforest's giants' (30 m and over) wider root collar, and a
 * buttressed emergent's fins, which the library's emergents flare to about five trunk radii at any size. The feller
 * stands outside it (at a buttressed tree, at the fins' ends, sawing them off first as loggers do).
 */
export function footRadius(height: number, buttress = false): number {
    return trunkRadius(height) * (buttress ? 5 : height >= 30 ? 2.4 : 1.25);
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
    /** Each stand's trees, once asked (dropped whenever the trees are marked again). */
    private readonly byStand = new Map<number, StandTree[]>();
    /** The trees left standing (by their built matrix: one per drawn tree), once kept, kept. */
    private readonly kept = new WeakSet<Matrix4>();
    private keptCount = 0;

    /**
     * `perches`: where the animals aboard live or sleep up in a tree (their places' points off the ground). A tree whose
     * crown holds one is left standing, as a logging crew leaves habitat trees: an animal the logging spares (a carded
     * one: decision 379) is never left perched in the air where its tree was.
     */
    constructor(private readonly table: StandTable, private readonly fromDay: number, private readonly perches: () => ReadonlyArray<{x: number; z: number}> = () => []) {}

    /** How many trees of the stands in play are left standing for the animals living in them. */
    get retained(): number {
        return this.keptCount;
    }

    /** The stands logged or regrowing at `day` (none: every tree as built). */
    get active(): readonly Logging[] {
        return this.loggings;
    }

    /** The trees the override has seen in stands (their feet), for the crews to walk between. */
    standTrees(g: Logging): StandTree[] {
        let list = this.byStand.get(g.k);
        if (!list) {
            list = this.trees.filter((t) => inStand(g, t.x, t.z));
            this.byStand.set(g.k, list);
        }
        return list;
    }

    /** Every tree the override has seen in the stands in play. */
    get allTrees(): readonly StandTree[] {
        return this.trees;
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
                if (!this.loggings.some((g) => inStand(g, tree.x, tree.z))) return false;
                if (!this.kept.has(tree.matrix)) {
                    // (`radius` is its crown's: a perch within it, and a little over, is this tree's.)
                    const reach = tree.radius + 0.5;
                    for (const p of this.perches()) {
                        const dx = p.x - tree.x, dz = p.z - tree.z;
                        if (dx * dx + dz * dz <= reach * reach) {
                            this.kept.add(tree.matrix);
                            break;
                        }
                    }
                }
                if (this.kept.has(tree.matrix)) {
                    this.keptCount++;
                    return false;
                }
                this.trees.push({x: tree.x, y: tree.y, z: tree.z, radius: footRadius(tree.height, tree.buttress === true), trunk: trunkRadius(tree.height), height: tree.height, buttress: tree.buttress === true});
                this.byStand.clear();
                return true;
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
        this.byStand.clear();
        this.keptCount = 0;
    }

    private matrixOf(tree: Tree, into: Matrix4): Matrix4 | null {
        let g: Logging | null = null;
        for (const l of this.loggings) if (inStand(l, tree.x, tree.z)) g = l;
        if (!g) return tree.matrix;
        const fate = treeFate(g, tree.x, tree.z, this.day);
        switch (fate.state) {
            case "standing":
                return tree.matrix;
            case "falling": {
                // Hinged at its foot: tipped about the horizontal axis square to its fall, its own turn kept.
                const fall = fate.fall;
                axis.set(Math.sin(fate.dir), 0, -Math.cos(fate.dir));
                hinge.setFromAxisAngle(axis, (Math.PI / 2) * 0.97 * fall);
                tree.matrix.decompose(position, turn, scaleV);
                turn.premultiply(hinge);
                // (Lifted by its trunk's radius as it lies, so the trunk rests on the ground rather than in it.)
                position.y += trunkRadius(tree.height) * fall;
                return into.compose(position, turn, scaleV);
            }
            // Down: the tree's own mesh goes (its buttressed foot would lie as a sheet at the butt); the trunk above
            // the cut is `forest-logs.ts`'s log, the stump `forest-render.ts`'s.
            case "log":
            case "stump":
                return null;
            case "sapling": {
                // The same tree, younger, in its own place.
                tree.matrix.decompose(position, turn, scaleV);
                scaleV.multiplyScalar(saplingScale(fate.growth));
                return into.compose(position, turn, scaleV);
            }
        }
    }
}
