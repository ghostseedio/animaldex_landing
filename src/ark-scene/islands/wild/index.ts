/**
 * The wild island's hook for the archipelago (Part C; docs/ark/wild-island.md): its definition in the shape of
 * `islands/index.ts` ArkIslandDef (the town lane's frame, owned by the world-frame lane), its extent for the strait
 * (decision 141: both islands in one world, side by side, the town ~250 m across a strait from this coast, the offset
 * derived from both islands' extents), and `loadWildIsland`, the build behind `loadIsland("wild")`.
 *
 * The island keeps its own local frame (x east, z south, origin at its middle): placement, the slot atlas and the
 * player-control wire are in it. The archipelago frame only places the whole island.
 */

import type {Group, Mesh, Vector3} from "three";
import {inlandOf, iceShelf} from "@/ark-scene/islands/wild/fields";
import {WILD_CHUNKS, WILD_GRID, WILD_HALF, type WildChunkSpan} from "@/ark-scene/islands/wild/frame";

/** Structurally `islands/index.ts` ArkIslandDef (archipelago left to the frame's owner). */
export const WILD_ISLAND = {
    id: "wild" as const,
    half: WILD_HALF,
    chunks: WILD_CHUNKS,
    /** Measured at 1 m (`summary.ts` measureWild; docs/ark/wild-island.md §1). */
    landHa: 11.9,
    /** The opening view: from the southern sea, looking north over the beach to the peaks. */
    home: {target: [0, 8, -30] as [number, number, number], eye: [0, 230, 560] as [number, number, number]}
};

/** Is there land (or the cove's ice shelf) at a point? */
function landAt(x: number, z: number): boolean {
    return inlandOf(x, z).inland >= 0 || iceShelf(x, z) > 0.5;
}

/**
 * How far the island's land reaches from its middle toward a direction (m), `angle` in the frame's convention
 * (atan2(dz, dx): 0 east, −π/2 north). For the strait: the town's offset is this toward the town, the strait, and
 * the town's own reach back. Scanned at 0.5 m; pure.
 */
export function wildReachToward(angle: number): number {
    const dx = Math.cos(angle);
    const dz = Math.sin(angle);
    let reach = 0;
    for (let r = 0; r <= WILD_HALF; r += 0.5) if (landAt(dx * r, dz * r)) reach = r;
    return reach;
}

let box: {minX: number; maxX: number; minZ: number; maxZ: number} | null = null;

/** The land's bounding box in the island's frame (m), from its coast at every degree. */
export function wildLandBounds(): {minX: number; maxX: number; minZ: number; maxZ: number} {
    if (box) return box;
    const out = {minX: 0, maxX: 0, minZ: 0, maxZ: 0};
    for (let k = 0; k < 720; k++) {
        const a = (k / 720) * Math.PI * 2;
        const r = wildReachToward(a);
        const x = Math.cos(a) * r;
        const z = Math.sin(a) * r;
        out.minX = Math.min(out.minX, x);
        out.maxX = Math.max(out.maxX, x);
        out.minZ = Math.min(out.minZ, z);
        out.maxZ = Math.max(out.maxZ, z);
    }
    box = out;
    return out;
}

/** A loaded wild island, structurally `islands/index.ts` ArkIslandWorld. */
export type WildIslandWorld = {
    id: "wild";
    root: Group;
    heightAt: (x: number, z: number) => number;
    grid: typeof WILD_GRID;
    spans: WildChunkSpan[];
    content: Uint8Array;
    setDrawn: (drawn: ((chunk: number) => boolean) | null) => void;
    /** Every frame, the shared clock's epoch milliseconds (nothing on the wild island runs on it yet). */
    update: (epochMs: number) => void;
    /** Every frame: the camera's eye in the island's own frame (its scenery's levels of detail re-sort as it moves); optional on ArkIslandWorld. */
    setCamera: (eye: Vector3) => void;
    /** The island's sea (a 4 km plane; the world's own sea drops it, decision 143). */
    sea: Mesh;
    /** The water's depth field over ±`half` (RGBA per ground vertex: depth/12 m, reef, fresh, the river's flow), for the world's sea. */
    depth: {data: Uint8Array; size: number; half: number};
    setShadows: (on: boolean) => void;
    setTier: (tier: "high" | "medium" | "low") => void;
    dispose: () => void;
};

/** Builds the wild island (imported on demand, as the town is). */
export async function loadWildIsland(options: {tier: "high" | "medium" | "low"; base?: string}): Promise<WildIslandWorld> {
    const {buildWildIsland} = await import("@/ark-scene/islands/wild/render/index");
    const island = buildWildIsland({tier: options.tier, base: options.base});
    return {id: "wild", root: island.root, heightAt: island.heightAt, grid: island.grid, spans: island.spans, content: island.content, setDrawn: island.setDrawn, update: () => {}, setCamera: island.update, sea: island.sea, depth: island.depth, setShadows: island.setShadows, setTier: island.setTier, dispose: island.dispose};
}
