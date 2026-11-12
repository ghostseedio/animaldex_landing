/**
 * The standalone bundle's entry (`scripts/build-ark-bundle.mjs` →
 * `public/ark/ark-scene.js`): the scene on `window.AnimalDexArk`, for
 * `public/ark/embed.html` and the 3.3 apps' WebView.
 *
 * `mountArkLiveHud`: the live log and the population bars (`?hud=1`).
 * `arkFoundersOf` / `decodeArkFounders`: the named founders and shared stories
 * beside the snapshot (the same answer's), for the host's cards ("@handle").
 * `ArkLiveFixtureFeed`: development's live feed, only in a development build
 * (`node scripts/build-ark-bundle.mjs --dev`); undefined in production.
 */

import {decodeArkSnapshot, mountArk} from "@/ark-scene";
import {prepareArk} from "@/ark-scene/runtime/prebuild";
import {mountArkLiveHud} from "@/ark-scene/live";
import {ArkLiveFixtureFeed} from "@/lib/ark-live-fixture";
import {arkFoundersOf, decodeArkFounders} from "@/lib/ark-founders";
import {fetchArkHunting} from "@/lib/ark-hunting";
import {mountArchipelago} from "@/ark-scene/islands/archipelago";
import {arkOpeningIsland, arkTwoIslands} from "@/lib/ark-islands";
import {mergeArkIslandsRouting} from "@/lib/ark-islands-local";

declare global {
    interface Window {
        AnimalDexArk?: {
            mountArk: typeof mountArk;
            decodeArkSnapshot: typeof decodeArkSnapshot;
            prepareArk: typeof prepareArk;
            mountArkLiveHud: typeof mountArkLiveHud;
            arkFoundersOf: typeof arkFoundersOf;
            decodeArkFounders: typeof decodeArkFounders;
            /** Encounter hunting's read (`/api/ark/hunting`), for the embed's refresh; null under the pool. */
            fetchArkHunting: typeof fetchArkHunting;
            ArkLiveFixtureFeed?: typeof ArkLiveFixtureFeed;
            /**
             * Part C (decisions 141-154): the one world with the town across the strait, the town built off the first frame,
             * flights between the islands; with one island it is `mountArk` exactly as before.
             */
            mountArchipelago: typeof mountArchipelago;
            /** Two islands in this read (the server's switch); the island to open on (decision 26). */
            arkTwoIslands: typeof arkTwoIslands;
            arkOpeningIsland: typeof arkOpeningIsland;
            /** Development only: T1's routing merged into a local snapshot by id (`?islands=`); undefined in production. */
            mergeArkIslandsRouting?: typeof mergeArkIslandsRouting;
        };
    }
}

window.AnimalDexArk = {
    mountArk,
    decodeArkSnapshot,
    prepareArk,
    mountArkLiveHud,
    arkFoundersOf,
    decodeArkFounders,
    fetchArkHunting,
    ArkLiveFixtureFeed: process.env.NODE_ENV !== "production" ? ArkLiveFixtureFeed : undefined,
    mountArchipelago,
    arkTwoIslands,
    arkOpeningIsland,
    mergeArkIslandsRouting: process.env.NODE_ENV !== "production" ? mergeArkIslandsRouting : undefined
};
