/**
 * The prebuild's scenery worker (runtime/prebuild.ts): the decor, the forest fill and the grass, off the main thread.
 * Built as `public/ark/ark-prebuild-worker.js` (scripts/build-ark-bundle.mjs). With the ground (terrain.ts) it carries
 * the part of three.js the terrain module needs.
 */

import {computeScenery, groundBuffers} from "@/ark-scene/runtime/prebuild-scenery";

const scope = self as unknown as {onmessage: ((event: MessageEvent<{grass: number; tier?: "high" | "medium" | "low"}>) => void) | null; postMessage: (data: unknown, transfer?: Transferable[]) => void};

scope.onmessage = (event) => {
    const result = computeScenery(event.data.grass, event.data.tier);
    scope.postMessage(result, [result.grass.numbers.buffer, result.grass.zones.buffer, ...groundBuffers(result.ground)]);
};
