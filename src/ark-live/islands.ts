/**
 * The Ark's islands as player control sees them (docs/ark/player-control-contract.md §1).
 *
 * Today there is one island, `ark` (DECISIONS.md #15). Part C adds `wild` and `town`; their sizes and the strait between
 * them are placeholders until the islands plan lands (design §12, DECISIONS.md #8).
 *
 * Pure: no Node, no DOM. Shared by `ark-live` and the page.
 */

export const ISLAND_IDS = ["ark", "wild", "town"] as const;
export type IslandId = (typeof ISLAND_IDS)[number];

export function isIslandId(value: unknown): value is IslandId {
    return typeof value === "string" && (ISLAND_IDS as readonly string[]).includes(value);
}

export function islandIndex(id: IslandId): number {
    return ISLAND_IDS.indexOf(id);
}

export function islandFromIndex(index: number): IslandId | null {
    return ISLAND_IDS[index] ?? null;
}

/**
 * A strait between two islands (design §12.2), in each island's own coordinates.
 *
 * The departure band is a stretch of `from`'s coast, just offshore (deep water for a swimmer, over the sea for a flyer):
 * the segment `a0 → a1`, crossed heading `out` (a unit vector away from the island). The arrival band is the matching
 * stretch of `to`'s coast, `b0 → b1`, reached heading `into` (toward the island). A point at fraction f along the
 * departure band lands at fraction f along the arrival band. The corridor between them is `length` metres long and
 * `halfWidth` metres either side of the line; the sea in it is `depth` metres deep.
 */
export type Strait = {
    from: IslandId;
    to: IslandId;
    a0: {x: number; z: number};
    a1: {x: number; z: number};
    out: {x: number; z: number};
    b0: {x: number; z: number};
    b1: {x: number; z: number};
    into: {x: number; z: number};
    length: number;
    halfWidth: number;
    depth: number;
    /** How far (m) from the band a crossing may start. */
    bandReach: number;
};

export type IslandConfig = {
    id: IslandId;
    /** The terrain's half-width (m): the island fits in [-half, half] on x and z. */
    half: number;
    /** Metres per unit of the wire's i16 positions (1 cm covers ±327 m; 2 cm covers ±655 m). */
    unit: number;
};

export const ISLANDS: Record<IslandId, IslandConfig> = {
    // Today's island (`world.ts` TERRAIN_HALF 132).
    ark: {id: "ark", half: 132, unit: 0.01},
    // Placeholders (design §12): an 800 m wild island and a 500 m town island.
    wild: {id: "wild", half: 400, unit: 0.02},
    town: {id: "town", half: 250, unit: 0.01}
};

/** No strait exists until Part C's islands plan defines the archipelago (DECISIONS.md #8: 300 m until then). */
export const STRAITS: Strait[] = [];

/** The placeholder strait the tests and the design's tables use: 300 m of sea 30 m deep, a corridor ±40 m wide. */
export function placeholderStrait(from: IslandId = "wild", to: IslandId = "town"): Strait {
    return {
        from,
        to,
        a0: {x: 380, z: -60},
        a1: {x: 380, z: 60},
        out: {x: 1, z: 0},
        b0: {x: -230, z: -60},
        b1: {x: -230, z: 60},
        into: {x: 1, z: 0},
        length: 300,
        halfWidth: 40,
        depth: 30,
        bandReach: 12
    };
}
