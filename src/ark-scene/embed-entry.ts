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
 * `arkLoad…`: the loading screen's steps, stage and bar (`src/lib/ark-loading.ts`), for the embed's own screen and
 * its `ark:progress` messages.
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
import {arkStatusForHost} from "@/lib/ark-animal-status";
import {arkReloadForRestoredContext} from "@/lib/ark-context-restore";
import {ARK_LOAD_START, arkAgoText, arkAnimalsShare, arkLoadAnimals, arkLoadProgress, arkLoadStage, arkLoadStep, arkLoadWorking, arkNewestArrival, arkProgressMessage, arkWhenSettled, markArkLoad} from "@/lib/ark-loading";

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
            /** Decision 240: an animal's status for the host (`ark:selected`, `ark:status`), its lines in the app's language. */
            arkStatusForHost: typeof arkStatusForHost;
            /** A lost WebGL context, back: the page reloads (`src/lib/ark-context-restore.ts`), twice at most in three minutes. */
            arkReloadForRestoredContext: typeof arkReloadForRestoredContext;
            /** The loading screen (`src/lib/ark-loading.ts`). */
            ARK_LOAD_START: typeof ARK_LOAD_START;
            arkLoadStep: typeof arkLoadStep;
            arkLoadAnimals: typeof arkLoadAnimals;
            arkLoadStage: typeof arkLoadStage;
            arkLoadProgress: typeof arkLoadProgress;
            arkLoadWorking: typeof arkLoadWorking;
            arkAnimalsShare: typeof arkAnimalsShare;
            arkNewestArrival: typeof arkNewestArrival;
            arkAgoText: typeof arkAgoText;
            arkProgressMessage: typeof arkProgressMessage;
            arkWhenSettled: typeof arkWhenSettled;
            markArkLoad: typeof markArkLoad;
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
    mergeArkIslandsRouting: process.env.NODE_ENV !== "production" ? mergeArkIslandsRouting : undefined,
    arkStatusForHost,
    arkReloadForRestoredContext,
    ARK_LOAD_START,
    arkLoadStep,
    arkLoadAnimals,
    arkLoadStage,
    arkLoadProgress,
    arkLoadWorking,
    arkAnimalsShare,
    arkNewestArrival,
    arkAgoText,
    arkProgressMessage,
    arkWhenSettled,
    markArkLoad
};
