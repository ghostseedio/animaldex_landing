/**
 * The prebuild's scenery worker (runtime/prebuild.ts): the decor, the forest fill and the grass, off the main thread.
 * Built as `public/ark/ark-prebuild-worker.js` (scripts/build-ark-bundle.mjs); ~20 KB (no three.js).
 */

import {computeScenery} from "@/ark-scene/runtime/prebuild-scenery";

const scope = self as unknown as {onmessage: ((event: MessageEvent<{grass: number}>) => void) | null; postMessage: (data: unknown, transfer?: Transferable[]) => void};

scope.onmessage = (event) => {
    const result = computeScenery(event.data.grass);
    scope.postMessage(result, [result.grass.numbers.buffer, result.grass.zones.buffer]);
};
