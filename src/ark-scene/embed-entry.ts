/**
 * The standalone bundle's entry (`scripts/build-ark-bundle.mjs` →
 * `public/ark/ark-scene.js`): the scene on `window.AnimalDexArk`, for
 * `public/ark/embed.html` and the 3.3 apps' WebView.
 */

import {decodeArkSnapshot, mountArk} from "@/ark-scene";

declare global {
    interface Window {
        AnimalDexArk?: {mountArk: typeof mountArk; decodeArkSnapshot: typeof decodeArkSnapshot};
    }
}

window.AnimalDexArk = {mountArk, decodeArkSnapshot};
