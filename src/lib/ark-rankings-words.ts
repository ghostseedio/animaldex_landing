/**
 * The words of the two Ark ranking pages (`ark.rankings` in every locale file: en and id in the site's own files, the
 * other 43 languages in `src/data/locales/ark/<language>.json`). Placeholders in `{braces}` are filled by `fillArkWords`.
 * Pure and client-safe.
 */

import {arkHeartsEscape, arkHeartsVariant, type ArkHeartsRules} from "@/lib/ark-hearts-rules";
import {fillArkWords} from "@/lib/ark-words";
import type {ArkGroup, ArkPlace} from "@/lib/ark-rankings";

export type ArkRankingsWords = {
    /** The category on the hub and in the breadcrumbs: "Ark". */
    category: string;
    breadcrumb: string;
    updated: string;
    readingTime: string;
    readingMinutes: string;
    methodLink: string;
    seeInArk: string;
    openArk: string;
    unavailable: string;
    relatedTitle: string;
    relatedDescription: string;
    readRanking: string;
    faqTitle: string;
    /** The hub card's "Method" line. */
    cardMethod: string;
    ctaTitle: string;
    ctaBody: string;
    table: {
        rank: string;
        animal: string;
        kind: string;
        chance: string;
        reason: string;
        youngPerAdult: string;
        search: string;
        searchPlaceholder: string;
        all: string;
        showing: string;
        of: string;
        backToTop: string;
        placeFilter: string;
        groupFilter: string;
    };
    places: Record<ArkPlace, string>;
    groups: Record<ArkGroup, string>;
    survival: {
        metaTitle: string;
        metaDescription: string;
        title: string;
        description: string;
        intro: string;
        animalsAboard: string;
        placesTitle: string;
        placesDescription: string;
        placeAlive: string;
        placeLine: string;
        placeTrendTitle: string;
        trendMore: string;
        trendLess: string;
        trendSteady: string;
        causesTitle: string;
        causesDescription: string;
        causeOld: string;
        causeStarved: string;
        causeEaten: string;
        causeLine: string;
        huntingProtected: string;
        huntingCounted: string;
        huntingOn: string;
        recoverNote: string;
        /**
         * A heart a survived attack (behind `hearts_escape`, docs/ark/hearts-escape.md): the words that take `intro`,
         * `placesDescription` and `recoverNote` while it is (`recoverNoteEscapeOld`: old age still returns).
         * `arkSurvivalHeartsWords` swaps them in; the page's metadata keeps the plain ones.
         */
        introEscape?: string;
        placesDescriptionEscape?: string;
        recoverNoteEscape?: string;
        recoverNoteEscapeOld?: string;
        notRecorded: string;
        allTime: string;
        closeUpTitle: string;
        animalsTitle: string;
        animalsDescription: string;
        kindsTitle: string;
        kindsDescription: string;
        chanceAnimal: string;
        chanceKind: string;
        aboardCount: string;
        methodTitle: string;
        methodDescription: string;
        methodShare: string;
        methodChance: string;
        methodKinds: string;
        faqQ1: string;
        faqA1: string;
        faqQ2: string;
        faqA2: string;
    };
    breeders: {
        metaTitle: string;
        metaDescription: string;
        title: string;
        description: string;
        intro: string;
        kindsRanked: string;
        totalsTitle: string;
        totalsDay: string;
        totalsWeek: string;
        totalsAll: string;
        rulesTitle: string;
        rule1: string;
        rule2: string;
        rule3: string;
        rule4: string;
        vertebratesTitle: string;
        vertebratesDescription: string;
        mammalsTitle: string;
        mammalsDescription: string;
        allTitle: string;
        allDescription: string;
        youngPerAdult: string;
        breederLine: string;
        topTitle: string;
        methodTitle: string;
        methodDescription: string;
        methodYoung: string;
        methodGroups: string;
        faqQ1: string;
        faqA1: string;
        faqQ2: string;
        faqA2: string;
    };
};

/** `fillArkWords` for these words (the one filler, so a page imports one module). */
export const fillRankingWords = fillArkWords;

/** The survival page's words with a heart a survived attack: "Some get away, some do not", not "Some come back". Without the rule, exactly the plain words. */
export function arkSurvivalHeartsWords(words: ArkRankingsWords["survival"], rules: ArkHeartsRules | null | undefined): ArkRankingsWords["survival"] {
    if (!arkHeartsEscape(rules)) return words;
    return {
        ...words,
        intro: words.introEscape ?? words.intro,
        placesDescription: words.placesDescriptionEscape ?? words.placesDescription,
        recoverNote: arkHeartsVariant(rules, words.recoverNote, words.recoverNoteEscape, words.recoverNoteEscapeOld)
    };
}
