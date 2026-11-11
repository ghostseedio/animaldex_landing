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

declare global {
    interface Window {
        AnimalDexArk?: {
            mountArk: typeof mountArk;
            decodeArkSnapshot: typeof decodeArkSnapshot;
            prepareArk: typeof prepareArk;
            mountArkLiveHud: typeof mountArkLiveHud;
            arkFoundersOf: typeof arkFoundersOf;
            decodeArkFounders: typeof decodeArkFounders;
            ArkLiveFixtureFeed?: typeof ArkLiveFixtureFeed;
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
    ArkLiveFixtureFeed: process.env.NODE_ENV !== "production" ? ArkLiveFixtureFeed : undefined
};
