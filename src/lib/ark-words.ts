/**
 * The Ark's words (`ark` in the locale file): the /ark page, its population
 * HUD and tap card, and the capture page's Ark band. Read on the server
 * (`loaders/ark-words`), English key by key where a locale lacks one, and
 * handed to the client components as a prop.
 */

import type {ArkRegion, ArkZone} from "@/ark-scene/types";

export type ArkHudWords = {
    label: string;
    title: string;
    show: string;
    hide: string;
    statAnimals: string;
    statSpecies: string;
    statFounders: string;
    pairsLine: string;
    single: string;
    pair: string;
    more: string;
    crowded: string;
    yours: string;
    flyTo: string;
    rowLabel: string;
    showAll: string;
    showFewer: string;
    earlyTitle: string;
    earlyBody: string;
    bring: string;
};

export type ArkStoryWords = {generic: string; debate: string; openDebate: string};

export type ArkCaptureWords = {
    aboardOne: string;
    aboardOther: string;
    mineOnly: string;
    mineOne: string;
    mineOther: string;
    needsMate: string;
    see: string;
    bringMate: string;
    notAboardTitle: string;
    notAboardBody: string;
    start: string;
    seeArk: string;
};

export type ArkWords = {
    metaTitle: string;
    metaDescription: string;
    eyebrow: string;
    title: string;
    beginning: string;
    aboard: string;
    empty: string;
    unavailable: string;
    animalsOne: string;
    animalsOther: string;
    speciesOne: string;
    speciesOther: string;
    foundersOne: string;
    foundersOther: string;
    myAnimals: string;
    hint: string;
    loading: string;
    noWebgl: string;
    newArrival: string;
    showMe: string;
    lives: string;
    broughtBy: string;
    arrived: string;
    close: string;
    wholeWorld: string;
    regionsLabel: string;
    howTitle: string;
    howBody: string;
    howCta: string;
    founderNote: string;
    zones: Record<ArkZone, string>;
    regions: Record<ArkRegion, string>;
    hud: ArkHudWords;
    story: ArkStoryWords;
    capture: ArkCaptureWords;
};

/** "{count} animals" and the like: every `{key}` filled from `values`, unknown keys left as they are. */
export function fillArkWords(template: string, values: Record<string, string | number>): string {
    return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? String(values[key]) : match));
}
