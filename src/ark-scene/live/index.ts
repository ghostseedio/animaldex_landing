/**
 * The live HUD for pages outside Next (the apps' embed, `public/ark/embed.html?hud=1`): the log over the world
 * and the population bars, wired to a mounted scene. /ark uses the log's controller directly and draws its bars
 * in its own column (`ark-live-bars.tsx`).
 */

import {ArkLive, type ArkLiveWordsIn} from "@/ark-scene/live/controller";
import {ArkBarsView, type ArkBarsWords} from "@/ark-scene/live/bars-view";
import {ARK_LIVE_ENGLISH, type ArkLiveWords} from "@/lib/ark-live-words";
import type {ArkRegion, ArkSceneHandle, ArkSnapshot} from "@/ark-scene/types";
import type {ArkActivityWords} from "@/lib/ark-animal-status";

export {ArkLive} from "@/ark-scene/live/controller";

/** The Ark's words as `/api/ark/words` answers them (`ark`): only what the HUD reads. */
export type ArkHudWordsIn = {
    live?: Partial<ArkLiveWords> | null;
    replay?: Record<string, string> | null;
    showMe?: string | null;
    /** The schedule's moments' words (decision 240). */
    activity?: Partial<ArkActivityWords> | null;
    regions?: Partial<Record<ArkRegion, string>> | null;
    hud?: Partial<Record<"title" | "show" | "hide" | "rowLabel" | "single" | "pair" | "more" | "crowded", string>> | null;
    a11y?: {regionCount?: string} | null;
} | null;

export type ArkLiveHudOptions = {
    scene: () => ArkSceneHandle | null;
    words: ArkHudWordsIn;
    locale: string;
    /** `/api/ark/events`, or null (development's fixtures). */
    eventsUrl: string | null;
    /** Draw the log, the bars (default both). */
    log?: boolean;
    bars?: boolean;
    reducedMotion?: boolean;
};

const REGIONS_ENGLISH: Record<ArkRegion, string> = {ocean: "Ocean", coast: "Coast", fresh_water: "Fresh water", forest: "Forest", open_land: "Open land", high_cold: "High and cold", home: "Home"};

function barsWords(words: ArkHudWordsIn): ArkBarsWords {
    const hud = words?.hud ?? {};
    const live = {...ARK_LIVE_ENGLISH, ...(words?.live ?? {})};
    return {
        title: hud.title || "Aboard",
        show: hud.show || "Who is aboard",
        hide: hud.hide || "Hide who is aboard",
        barsNote: live.barsNote,
        up: live.up,
        down: live.down,
        regions: {...REGIONS_ENGLISH, ...(words?.regions ?? {})},
        status: {single: hud.single || "needs a mate", pair: hud.pair || "a pair", more: hud.more || "more than a pair", crowded: hud.crowded || "crowded"},
        rowLabel: hud.rowLabel || "{animal}: {count}, {status}",
        regionCount: words?.a11y?.regionCount || "{region}: {count} animals"
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
    const narrow = typeof window !== "undefined" && window.matchMedia?.("(max-width: 599px)").matches;
    const log = options.log === false ? null : new ArkLive({host, scene: options.scene, words: options.words as ArkLiveWordsIn, locale: options.locale, eventsUrl: options.eventsUrl, reducedMotion: options.reducedMotion, storageKey: null});
    const bars = options.bars === false ? null : new ArkBarsView(host, {scene: options.scene, words: barsWords(options.words), locale: options.locale, reducedMotion: Boolean(options.reducedMotion), collapsed: Boolean(narrow)});
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
