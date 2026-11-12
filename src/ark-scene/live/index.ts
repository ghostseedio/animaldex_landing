/**
 * The live HUD for pages outside Next (the apps' embed, `public/ark/embed.html?hud=1`): the log over the world
 * and who is aboard (biggest first, with the 24-hour change), wired to a mounted scene. /ark uses the log's
 * controller directly and draws who is aboard as its own overlay (`ark-population-hud.tsx`).
 */

import {ArkLive, type ArkLiveWordsIn} from "@/ark-scene/live/controller";
import {ArkBarsView, type ArkBarsWords} from "@/ark-scene/live/bars-view";
import type {ArkLiveWords} from "@/lib/ark-live-words";
import type {ArkSceneHandle, ArkSnapshot} from "@/ark-scene/types";

export {ArkLive} from "@/ark-scene/live/controller";

/** The Ark's words as `/api/ark/words` answers them (`ark`): only what the HUD reads. */
export type ArkHudWordsIn = {
    live?: Partial<ArkLiveWords> | null;
    replay?: Record<string, string> | null;
    showMe?: string | null;
    speciesOne?: string | null;
    speciesOther?: string | null;
    hud?: Partial<Record<"show" | "hide" | "chip" | "rowCount" | "change24h" | "changeWindow" | "yours" | "herdTag" | "listLabel", string>> | null;
} | null;

export type ArkLiveHudOptions = {
    scene: () => ArkSceneHandle | null;
    words: ArkHudWordsIn;
    locale: string;
    /** `/api/ark/events`, or null (development's fixtures). */
    eventsUrl: string | null;
    /** A species' icon in who is aboard (the embed's icon folder); absent: the Ark's generic figure. */
    iconUrl?: ((slug: string) => string) | null;
    /** Draw the log, the bars (default both). */
    log?: boolean;
    bars?: boolean;
    reducedMotion?: boolean;
};

function barsWords(words: ArkHudWordsIn): ArkBarsWords {
    const hud = words?.hud ?? {};
    return {
        chip: hud.chip || "{count} aboard",
        show: hud.show || "Who is aboard",
        hide: hud.hide || "Hide who is aboard",
        rowCount: hud.rowCount || "{animal}: {count}",
        change24h: hud.change24h || "{change} in the last 24 hours",
        changeWindow: hud.changeWindow || "24 h",
        speciesOne: words?.speciesOne || "1 species",
        speciesOther: words?.speciesOther || "{count} species",
        yours: hud.yours || "Yours",
        herdTag: hud.herdTag || "herd",
        list: hud.listLabel || "Every species aboard, the most numerous first"
    };
}

export type ArkLiveHud = {
    /** Every snapshot the host shows (before any "same animals" check). */
    snapshot: (snapshot: ArkSnapshot) => void;
    /** Development's feed: its event rows. */
    events: (raw: unknown) => void;
    setWords: (words: ArkHudWordsIn, locale: string) => void;
    setSelected: (id: string | null) => void;
    setCovered: (covered: boolean) => void;
    dispose: () => void;
};

/** The log and the bars over `host` (a positioned box over the world). */
export function mountArkLiveHud(host: HTMLElement, options: ArkLiveHudOptions): ArkLiveHud {
    const log = options.log === false ? null : new ArkLive({host, scene: options.scene, words: options.words as ArkLiveWordsIn, locale: options.locale, eventsUrl: options.eventsUrl, reducedMotion: options.reducedMotion, storageKey: null});
    // Who is aboard starts as its chip, every time (decision 239; nothing is remembered in the apps' panel).
    const bars = options.bars === false ? null : new ArkBarsView(host, {scene: options.scene, words: barsWords(options.words), locale: options.locale, reducedMotion: Boolean(options.reducedMotion), collapsed: true, eventsUrl: options.eventsUrl, iconUrl: options.iconUrl ?? null});
    return {
        snapshot: (snapshot) => {
            log?.snapshot(snapshot);
            bars?.update(snapshot);
        },
        events: (raw) => log?.events(raw),
        setWords: (words, locale) => {
            log?.setWords(words as ArkLiveWordsIn, locale);
            bars?.setWords(barsWords(words), locale);
        },
        setSelected: (id) => bars?.setSelected(id),
        setCovered: (covered) => log?.setCovered(covered),
        dispose: () => {
            log?.dispose();
            bars?.dispose();
        }
    };
}
