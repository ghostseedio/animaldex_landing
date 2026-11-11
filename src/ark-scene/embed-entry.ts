/**
 * The standalone bundle's entry (`scripts/build-ark-bundle.mjs` →
 * `public/ark/ark-scene.js`): the scene on `window.AnimalDexArk`, for
 * `public/ark/embed.html` and the 3.3 apps' WebView.
 */

import {decodeArkSnapshot, mountArk} from "@/ark-scene";
import {prepareArk} from "@/ark-scene/runtime/prebuild";

declare global {
    interface Window {
        AnimalDexArk?: {mountArk: typeof mountArk; decodeArkSnapshot: typeof decodeArkSnapshot; prepareArk: typeof prepareArk};
    }
}

window.AnimalDexArk = {mountArk, decodeArkSnapshot, prepareArk};
