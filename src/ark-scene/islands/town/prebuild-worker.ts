/**
 * The town's prebuild worker (decision 153; `prebuild.ts`): the plan, the areas, the ground's grid, the scenery and
 * buildings, the zoo, the animals' places, the behaviour world's raster and places and the colliders, off the page's
 * main thread. Built as `public/ark/ark-town-worker.js` (scripts/build-ark-bundle.mjs). Pure: the same answer as the
 * main thread's own build.
 */

import {townPlan} from "@/ark-scene/islands/town/plan";
import {townAreas} from "@/ark-scene/islands/town/areas";
import {townBuildData} from "@/ark-scene/islands/town/render/index";
import {placeTownAnimals} from "@/ark-scene/islands/town/placement";
import {townSamplerData} from "@/ark-scene/islands/town/sampler";
import {townColliderList} from "@/ark-scene/islands/town/colliders";
import {packTownBuild, type TownPrebuild, type TownPrebuildRequest} from "@/ark-scene/islands/town/prebuild";

const scope = self as unknown as {onmessage: ((event: MessageEvent<TownPrebuildRequest>) => void) | null; postMessage: (data: unknown, transfer?: Transferable[]) => void};

scope.onmessage = (event) => {
    try {
        const started = performance.now();
        const {animals, origin, open} = event.data;
        const plan = townPlan();
        const areas = townAreas();
        const built = townBuildData(open);
        const placed = placeTownAnimals(animals);
        const sampler = townSamplerData(placed.open, origin);
        const colliders = townColliderList(placed.open, origin);
        const transfer = packTownBuild(built);
        transfer.push(sampler.solid.buffer as ArrayBuffer);
        const answer: TownPrebuild = {
            plan,
            areas,
            built,
            placed: {places: Array.from(placed.places.entries()), town: Array.from(placed.town.entries()), open: placed.open},
            sampler,
            colliders,
            ms: Math.round(performance.now() - started)
        };
        scope.postMessage(answer, transfer);
    } catch (error) {
        scope.postMessage({error: String(error)});
    }
};
