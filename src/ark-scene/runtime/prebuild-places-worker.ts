/**
 * The prebuild's places worker (runtime/prebuild.ts): a big Ark's places (`placeAnimals`), off the main thread. It
 * carries the placement's species data and three.js (~1.1 MB), so it is only asked for when the Ark is big
 * (`PLACES_IN_WORKER_FROM` animals). Built as `public/ark/ark-prebuild-places-worker.js`.
 */

import type {ArkAnimal} from "@/ark-scene/types";
import {placeAnimals} from "@/ark-scene/placement";
import {zoneCapacities} from "@/ark-scene/map/capacity";

const scope = self as unknown as {onmessage: ((event: MessageEvent<{animals: ArkAnimal[]}>) => void) | null; postMessage: (data: unknown) => void};

scope.onmessage = (event) => {
    const started = Date.now();
    const places = Array.from(placeAnimals(event.data.animals).entries());
    // Rule E's per-zone capacities (map/capacity.ts): a pure table, 1.3 s of the phone profile's mount at the backfill.
    const capacities = Array.from(zoneCapacities().entries());
    scope.postMessage({places, capacities, ms: Date.now() - started});
};
