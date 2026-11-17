/**
 * Append-only scenery across terrain fixes (decision 303, 2026-11-13).
 *
 * The animals' homes are hashed onto lists: a decor item's index is its host's (`decor<i>`, whose attach points'
 * ids and seeded streams follow it), the ground search numbers its holes and burrows as it finds them
 * (`worm_hole:ground:<n>`), and the map's points follow the scenery's own order. A terrain fix that adds an item in
 * the middle of a list, or takes one out, would renumber everything after it, so homes hundreds of metres from the
 * fix would move. So the lists are append-only:
 *
 * - every item that existed keeps its index and its place (its height follows the ground under it);
 * - one the new terrain removes (now under water, or inside a bank) is a tombstone in its place: its number stays
 *   taken, and nothing stands there;
 * - one the new terrain adds goes at the end of its list.
 *
 * The map's own lists (`map/points.ts`: each zone's cells of a tag, the attach points a kind fits) hash a home by the
 * list's size as well as its order, so they are made from the island as it was when the homes were pinned
 * (`mapLedger`, `map/sampler.ts` MapLedger): the points a fix added are in none of them, the ones it took away are
 * tombstones at their old index, and a point or cell it changed counts as it was. A home on a tombstone, or on a cell
 * or point the fix took from its tag, is the only one that moves: to the nearest cell of its tag in its zone, or the
 * nearest free point of its kind that holds today.
 *
 * Each terrain fix adds its rows here, made by comparing the build before the fix with the build after (the scenery,
 * the decor, the ground search's finds by try, the map's points with their tags, the map's grid cells). When the
 * server's atlas is regenerated (the owner's call), the rows fold away: the lists are then today's.
 *
 * Folded 2026-11-17 (p5 CRATER, the volcano's crater lake): the atlas is regenerated on the new island (AnimalDex
 * `ark-p5-crater-server`), so every row (the river mouth's, MA3) is gone and the lists are today's. The next fix adds
 * its rows here again.
 */

import type {AttachPoint, LedgerCell, MapLedger} from "@/ark-scene/map/sampler";
import type {MapTag} from "@/ark-scene/map/tags";

/** A scenery or decor item's key in the ledger: its kind and where it stands (cm). */
export function ledgerKey(kind: string, x: number, z: number): string {
    return `${kind}@${x.toFixed(2)},${z.toFixed(2)}`;
}

/**
 * The scenery items (`scenery.ts` wildScenery) each fix added, by key, in the order they go at the end.
 *
 * (None since the fold.)
 */
export const SCENERY_APPENDED: readonly string[] = [];

/**
 * The decor items (`decor-v2.ts` wildDecor: each one's index is its host's) each fix added, by key.
 *
 * (None since the fold.)
 */
export const DECOR_APPENDED: readonly string[] = [...SCENERY_APPENDED];

/** What one of the ground search's tries found (`sampler.ts`): a find of a tag, or nothing. */
export type GroundFind = "leaf_litter" | "worm_hole" | "burrow" | null;

/**
 * The ground search's tries (1-based, its own seeded stream) a fix changed, with what each found before it. The
 * search counts each as it was, so every other hole keeps its number; what it finds now goes at the end.
 */
export const GROUND_WAS: ReadonlyArray<readonly [number, GroundFind]> = [];

/**
 * The map's attach points (`map-sampler.ts`) the fixes added, by id: in no list the homes are hashed onto.
 *
 * (None since the fold.)
 */
export const POINTS_ADDED: readonly string[] = [];

/**
 * The map's attach points the fixes took away: [their index in the list as it was, the point as it was, the tags it
 * stood for]. Tombstones in the lists (a home on one moves to the nearest good point).
 *
 * (None since the fold.)
 */
export const POINTS_GONE: ReadonlyArray<readonly [number, AttachPoint, readonly MapTag[]]> = [];

/**
 * The map's attach points the fixes changed: [id, what the lists take it as] (the tags it stood for, where it was, the
 * clear drop under it).
 *
 * (None since the fold.)
 */
export const POINTS_WAS: ReadonlyArray<readonly [string, {tags?: readonly MapTag[]; x?: number; z?: number; clearBelow?: number}]> = [];

/**
 * The map's 2.5 m grid cells (`map/points.ts`) the fixes changed: [x, z, what it was (null: no cell then)].
 *
 * (None since the fold.)
 */
export const CELLS_WAS: ReadonlyArray<readonly [number, number, LedgerCell | null]> = [];

/** The map's ledger (`map/sampler.ts` MapLedger) from the rows above. */
export function mapLedger(): MapLedger {
    return {
        added: new Set(POINTS_ADDED),
        gone: POINTS_GONE.map(([index, point, tags]) => ({index, point, tags})),
        was: new Map(POINTS_WAS),
        cells: new Map(CELLS_WAS.map(([x, z, cell]) => [`${x},${z}`, cell]))
    };
}

/**
 * A list with the ledger's appended items moved to its end (in the ledger's order): every other item keeps the index
 * it had before the fixes that added them.
 */
export function appendLast<T>(list: readonly T[], keyOf: (item: T) => string, appended: readonly string[]): T[] {
    if (!appended.length) return [...list];
    const rank = new Map(appended.map((key, i) => [key, i]));
    const kept: T[] = [];
    const late: Array<{item: T; rank: number}> = [];
    for (const item of list) {
        const r = rank.get(keyOf(item));
        if (r === undefined) kept.push(item);
        else late.push({item, rank: r});
    }
    late.sort((a, b) => a.rank - b.rank);
    return [...kept, ...late.map(({item}) => item)];
}
