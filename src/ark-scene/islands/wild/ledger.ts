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
 * The river mouth (2026-11-13, MA3): six reeds in the new shallows where the upper river meets the lake.
 */
export const SCENERY_APPENDED: readonly string[] = [
    "reed@-87.55,-52.27",
    "reed@-85.20,-45.42",
    "reed@-84.11,-44.17",
    "reed@-79.40,-42.11",
    "reed@-77.33,-39.66",
    "reed@-79.37,-37.69"
];

/**
 * The decor items (`decor-v2.ts` wildDecor: each one's index is its host's) each fix added, by key.
 *
 * The river mouth: those six reeds, and a lily pad its new still water now holds.
 */
export const DECOR_APPENDED: readonly string[] = [...SCENERY_APPENDED, "lily@-76.63,-33.52"];

/** What one of the ground search's tries found (`sampler.ts`): a find of a tag, or nothing. */
export type GroundFind = "leaf_litter" | "worm_hole" | "burrow" | null;

/**
 * The ground search's tries (1-based, its own seeded stream) a fix changed, with what each found before it. The
 * search counts each as it was, so every other hole keeps its number; what it finds now goes at the end.
 */
export const GROUND_WAS: ReadonlyArray<readonly [number, GroundFind]> = [
    // The river mouth: two worm holes on the bank the new valley steepened (burrows now), two new ones on its floor.
    [944, "worm_hole"],
    [1451, "worm_hole"],
    [3493, null],
    [3746, null]
];

/**
 * The map's attach points (`map-sampler.ts`) the fixes added, by id: in no list the homes are hashed onto.
 *
 * The river mouth: the ground search's four (`GROUND_WAS`), the six reeds' leaves, four worm holes on the new floor.
 */
export const POINTS_ADDED: readonly string[] = [
    "burrow:ground:360",
    "burrow:ground:361",
    "worm_hole:ground:600",
    "worm_hole:ground:601",
    "reed@-87.5,-52.3",
    "reed@-85.2,-45.4",
    "reed@-84.1,-44.2",
    "reed@-79.4,-42.1",
    "reed@-77.3,-39.7",
    "reed@-79.4,-37.7",
    "worm-89,-50",
    "worm-83,-39",
    "worm-78,-41",
    "worm-75,-43"
];

/**
 * The map's attach points the fixes took away: [their index in the list as it was, the point as it was, the tags it
 * stood for]. Tombstones in the lists (a home on one moves to the nearest good point).
 *
 * The river mouth: the two worm holes of `GROUND_WAS`, a burrow and a worm hole the new bank's water now covers.
 */
export const POINTS_GONE: ReadonlyArray<readonly [number, AttachPoint, readonly MapTag[]]> = [
    [12602, {id: "worm_hole:ground:145", tag: "worm_hole", x: -95.71600701659918, y: 16.753687160434804, z: -54.99908866547048, normal: [0.1817562199992784, 0.960298791278616, 0.21163862587061738], tangent: [-0.9656209160772354, 0.13362050260078834, 0.22298387322600927], size: {min: 0.0001, max: 0.4}, zone: "river_lake"}, ["soil"]],
    [12759, {id: "worm_hole:ground:209", tag: "worm_hole", x: -85.04003538005054, y: 15.521968627180362, z: -56.371129093319176, normal: [0.23771282627724855, 0.9556328921063736, 0.1739493827171882], tangent: [-0.9447971116838539, 0.26905547418737474, -0.18699617526477344], size: {min: 0.0001, max: 0.4}, zone: "river_lake"}, ["soil"]],
    [21543, {id: "burrow-93,-66", tag: "burrow_entrance", x: -93.14385619226232, y: 19.62913852651356, z: -65.77674116896378, normal: [0, 1, 0], tangent: [-0.8124269164472444, 0, -0.5830630372712903], size: {min: 0.0001, max: 0.6}, zone: "river_lake"}, ["burrows", "soil", "stream_river"]],
    [21544, {id: "worm-94,-57", tag: "worm_hole", x: -94.3861390093989, y: 16.94993386501095, z: -57.434502407548734, normal: [0, 1, 0], tangent: [1, 0, 0], size: {min: 0.0001, max: 0.35}, zone: "river_lake"}, ["soil"]]
];

/**
 * The map's attach points the fixes changed: [id, what the lists take it as] (the tags it stood for, where it was, the
 * clear drop under it).
 *
 * The river mouth: leaves over the new valley (its ground's tags changed), a bank rock seated a few cm over, and the
 * drop under the limbs over the lowered valley floor.
 */
export const POINTS_WAS: ReadonlyArray<readonly [string, {tags?: readonly MapTag[]; x?: number; z?: number; clearBelow?: number}]> = [
    ["leaf:decor171:0", {tags: ["leaves"]}],
    ["leaf:decor171:3", {tags: ["leaves"]}],
    ["leaf:decor216:3", {tags: ["leaves"]}],
    ["leaf:decor216:0", {tags: ["leaves"]}],
    ["leaf:decor230:8", {tags: ["leaves", "stream_river", "waterfall_rapids"]}],
    ["leaf:decor286:10", {tags: ["leaves", "stream_river", "waterfall_rapids"]}],
    ["rock_face:decor1324:0", {tags: ["rocks_boulders", "stream_river", "waterfall_rapids"], x: -96.99664018062003, z: -74.83367423178247}],
    ["rock_face:decor1324:1", {x: -95.65108505831124, z: -73.50704578269074}],
    ["rock_face:decor1324:2", {x: -93.13206039368343, z: -75.04122754629765}],
    ["rock_face:decor1324:3", {tags: ["rocks_boulders", "stream_river", "waterfall_rapids"], x: -97.3306666079442, z: -75.95199946324166}],
    ["limb:decor133:9", {clearBelow: 1.0198629145645413}],
    ["canopy_hang:decor133:2", {clearBelow: 2.462510822869035}],
    ["canopy_hang:decor133:3", {clearBelow: 1.5126117591969894}],
    ["canopy_hang:decor133:0", {clearBelow: 2.191487497467021}],
    ["limb:decor171:2", {clearBelow: 8.016219195984043}],
    ["limb:decor171:5", {clearBelow: 3.7019760998611666}],
    ["limb:decor171:6", {clearBelow: 8.391818534796418}],
    ["canopy_hang:decor171:0", {clearBelow: 2.7336003626701952}],
    ["canopy_hang:decor171:1", {clearBelow: 7.857125262902045}],
    ["canopy_hang:decor171:2", {clearBelow: 6.478523655517392}],
    ["canopy_hang:decor171:3", {clearBelow: 8.17392901774933}],
    ["limb:decor216:1", {clearBelow: 5.343644664278768}],
    ["limb:decor216:7", {clearBelow: 5.696629802693014}],
    ["limb:decor216:9", {clearBelow: 10.397065171261445}],
    ["canopy_hang:decor216:1", {clearBelow: 6.510401047185015}],
    ["canopy_hang:decor216:2", {clearBelow: 7.202687802389052}],
    ["canopy_hang:decor216:3", {clearBelow: 5.673980292682138}],
    ["canopy_hang:decor216:4", {clearBelow: 9.46124886729738}],
    ["limb:decor216:3", {clearBelow: 6.6867998820741565}],
    ["canopy_hang:decor218:1", {clearBelow: 5.402856907590335}],
    ["canopy_hang:decor218:2", {clearBelow: 9.375292620016564}],
    ["limb:decor218:0", {clearBelow: 4.779900169119202}],
    ["limb:decor218:2", {clearBelow: 5.539518923730727}],
    ["limb:decor218:4", {clearBelow: 9.462692746617973}],
    ["canopy_hang:decor218:0", {clearBelow: 4.233252104557646}],
    ["limb:decor230:3", {clearBelow: 3.886915760711382}],
    ["limb:decor230:6", {clearBelow: 6.067208275901331}],
    ["limb:decor230:10", {clearBelow: 6.83766033207614}],
    ["limb:decor230:12", {clearBelow: 5.165895419905848}],
    ["canopy_hang:decor230:2", {clearBelow: 3.55228326276627}],
    ["canopy_hang:decor230:3", {clearBelow: 3.8288563513726146}],
    ["canopy_hang:decor230:4", {clearBelow: 5.750866391306435}],
    ["canopy_hang:decor230:5", {clearBelow: 5.714405480723254}],
    ["limb:decor230:0", {clearBelow: 2.548668334236119}],
    ["limb:decor230:1", {clearBelow: 4.144725247502816}],
    ["limb:decor230:2", {clearBelow: 3.586591095557363}]
];

/**
 * The map's 2.5 m grid cells (`map/points.ts`) the fixes changed: [x, z, what it was (null: no cell then)].
 *
 * The river mouth: the valley's floor, banks and shallows where the upper river comes down to the lake.
 */
export const CELLS_WAS: ReadonlyArray<readonly [number, number, LedgerCell | null]> = [
    [-97.5, -65, {zone: "river_lake", tags: ["soil", "burrows", "stream_river", "waterfall_rapids", "open_sky"], wet: false}],
    [-97.5, -62.5, {zone: "river_lake", tags: ["soil", "burrows", "stream_river", "waterfall_rapids", "open_sky"], wet: false}],
    [-95, -70, {zone: "river_lake", tags: ["soil", "burrows", "rocks_boulders", "stream_river", "waterfall_rapids", "open_sky"], wet: false}],
    [-95, -67.5, {zone: "river_lake", tags: ["soil", "burrows", "stream_river", "waterfall_rapids", "open_sky"], wet: false}],
    [-95, -60, {zone: "river_lake", tags: ["soil", "burrows", "stream_river", "waterfall_rapids", "open_sky"], wet: false}],
    [-92.5, -65, {zone: "river_lake", tags: ["soil", "burrows", "stream_river", "waterfall_rapids", "open_sky"], wet: false}],
    [-92.5, -62.5, {zone: "river_lake", tags: ["soil", "burrows", "stream_river", "waterfall_rapids", "open_sky"], wet: false}],
    [-90, -60, {zone: "river_lake", tags: ["soil", "burrows", "stream_river", "waterfall_rapids", "open_sky"], wet: false}],
    [-90, -52.5, {zone: "river_lake", tags: ["stream_river", "waterfall_rapids"], wet: true}],
    [-90, -50, {zone: "river_lake", tags: ["cliffs", "open_sky"], wet: false}],
    [-87.5, -52.5, {zone: "river_lake", tags: ["stream_river", "waterfall_rapids"], wet: true}],
    [-87.5, -47.5, {zone: "river_lake", tags: ["stream_river", "waterfall_rapids"], wet: true}],
    [-87.5, -45, {zone: "river_lake", tags: ["soil", "burrows", "cliffs", "stream_river", "waterfall_rapids", "open_sky"], wet: false}],
    [-85, -50, {zone: "river_lake", tags: ["cliffs", "open_sky"], wet: false}],
    [-85, -45, {zone: "river_lake", tags: ["stream_river", "waterfall_rapids"], wet: true}],
    [-85, -42.5, {zone: "river_lake", tags: ["cliffs", "open_sky"], wet: false}],
    [-82.5, -65, {zone: "river_lake", tags: ["soil", "burrows", "open_sky"], wet: false}],
    [-82.5, -47.5, {zone: "river_lake", tags: ["cliffs", "open_sky"], wet: false}],
    [-82.5, -40, {zone: "river_lake", tags: ["open_sky"], wet: false}],
    [-82.5, -37.5, {zone: "river_lake", tags: ["open_sky"], wet: false}],
    [-82.5, -35, {zone: "river_lake", tags: ["open_sky"], wet: false}],
    [-82.5, -32.5, {zone: "river_lake", tags: ["soil", "burrows", "lake", "marsh_reeds", "open_sky"], wet: false}],
    [-80, -45, {zone: "river_lake", tags: ["cliffs", "open_sky"], wet: false}],
    [-80, -42.5, {zone: "river_lake", tags: ["stream_river", "waterfall_rapids"], wet: true}],
    [-80, -37.5, {zone: "river_lake", tags: ["lake", "marsh_reeds"], wet: true}],
    [-77.5, -42.5, {zone: "river_lake", tags: ["open_sky"], wet: false}],
    [-77.5, -40, {zone: "river_lake", tags: ["lake", "marsh_reeds"], wet: true}],
    [-77.5, -37.5, {zone: "river_lake", tags: ["lake", "marsh_reeds"], wet: true}],
    [-77.5, -35, {zone: "river_lake", tags: ["lake"], wet: true}],
    [-75, -42.5, {zone: "river_lake", tags: ["open_sky"], wet: false}],
    [-75, -37.5, {zone: "river_lake", tags: ["lake", "marsh_reeds"], wet: true}],
    [-72.5, -42.5, {zone: "river_lake", tags: ["open_sky"], wet: false}]
];

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
