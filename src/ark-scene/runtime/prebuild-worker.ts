/**
 * The prebuild worker (runtime/prebuild.ts): the mount's heavy seeded work, off the main thread. Built as
 * `public/ark/ark-prebuild-worker.js` for the apps' embed (scripts/build-ark-bundle.mjs); the site's bundler builds
 * it from `new URL("./prebuild-worker.ts", import.meta.url)`.
 */

import {computeArkPrebuild, type ArkPrebuildInput} from "@/ark-scene/runtime/prebuild";

const scope = self as unknown as {onmessage: ((event: MessageEvent<ArkPrebuildInput>) => void) | null; postMessage: (data: unknown, transfer?: Transferable[]) => void};

scope.onmessage = (event) => {
    const result = computeArkPrebuild(event.data);
    scope.postMessage(result, [result.grass.numbers.buffer, result.grass.zones.buffer]);
};
