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

const scope = self as unknown as {onmessage: ((event: MessageEvent<TownPrebuildRequest | {type: "send"}>) => void) | null; postMessage: (data: unknown, transfer?: Transferable[]) => void};

// (A held answer, `hold`: worked out at once, posted when the page asks for it (`send`), after its first frame.)
let ready: {answer: unknown; transfer: Transferable[]} | null = null;
let asked = false;
const post = () => {
    if (!ready || !asked) return;
    scope.postMessage(ready.answer, ready.transfer);
    ready = null;
};

scope.onmessage = (event) => {
    if ("type" in event.data && event.data.type === "send") {
        asked = true;
        post();
        return;
    }
    const request = event.data as TownPrebuildRequest;
    asked = !request.hold;
    try {
        const started = performance.now();
        // Each step's time (ms): the plan, areas, ground grid, scenery, buildings, zoo, places, behaviour raster, colliders.
        const steps: Record<string, number> = {};
        let mark = started;
        const took = (name: string) => {
            const now = performance.now();
            steps[name] = Math.round(now - mark);
            mark = now;
        };
        const {animals, origin, open} = request;
        const plan = townPlan();
        took("plan");
        const areas = townAreas();
        took("areas");
        const built = townBuildData(open, steps);
        mark = performance.now();
        const placed = placeTownAnimals(animals);
        took("places");
        const sampler = townSamplerData(placed.open, origin);
        took("raster");
        const colliders = townColliderList(placed.open, origin);
        took("colliders");
        const transfer = packTownBuild(built);
        transfer.push(sampler.solid.buffer as ArrayBuffer);
        took("pack");
        const answer: TownPrebuild = {
            plan,
            areas,
            built,
            placed: {places: Array.from(placed.places.entries()), town: Array.from(placed.town.entries()), open: placed.open},
            sampler,
            colliders,
            ms: Math.round(performance.now() - started),
            steps
        };
        ready = {answer, transfer};
        // (Held: a word that it is done, so the page may take it while its main thread is free.)
        if (!asked) scope.postMessage({type: "ready", ms: answer.ms});
        post();
    } catch (error) {
        scope.postMessage({error: String(error)});
    }
};
