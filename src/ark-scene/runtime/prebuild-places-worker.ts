/**
 * The prebuild's places worker (runtime/prebuild.ts): a big Ark's places (`placeAnimals`), off the main thread. It
 * carries the placement's species data and three.js (~1.1 MB), so it is only asked for when the Ark is big
 * (`PLACES_IN_WORKER_FROM` animals). Built as `public/ark/ark-prebuild-places-worker.js`.
 */

import type {ArkAnimal} from "@/ark-scene/types";
import {placeAnimals} from "@/ark-scene/placement";

const scope = self as unknown as {onmessage: ((event: MessageEvent<{animals: ArkAnimal[]}>) => void) | null; postMessage: (data: unknown) => void};

scope.onmessage = (event) => {
    const started = Date.now();
    const places = Array.from(placeAnimals(event.data.animals).entries());
    scope.postMessage({places, ms: Date.now() - started});
};
