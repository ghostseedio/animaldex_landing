/**
 * The ranking pages' numbers as words and table rows, in the reader's language. Pure and client-safe: the pages hand it a
 * report (`data/ark-rankings.ts`) and the words (`ark.rankings`, with the Ark card's `timeLeft` and `life` for the
 * reasons), and it hands back what the shared ranking components show.
 */

import type {ArkAnimal} from "@/ark-scene/types";
import {arkDirection} from "@/lib/ark-languages";
import {
    ARK_DEATH_CAUSES,
    ARK_PLACES,
    type ArkBreeder,
    type ArkDeathCause,
    type ArkGroup,
    type ArkPlace,
    type ArkPlaceSurvival,
    type ArkRiskAnimal,
    type ArkRiskKind,
    type ArkSurvival
} from "@/lib/ark-rankings";
import type {ArkRankingsWords} from "@/lib/ark-rankings-words";
import {arkChanceText, arkTimeLeftText, type ArkTimeLeftUnitWords, type ArkTimeLeftWords} from "@/lib/ark-time-left";
import {fillArkWords} from "@/lib/ark-words";

/** A row of the shared ranking table (`RankingTable`), for these lists. */
export type ArkRankingRow = {
    rank: number;
    tier: string;
    speciesSlug: string;
    speciesName: string;
    iconSrc: string;
    primaryMetric: string;
    shortReason: string;
    domain: string;
    href: string;
};

/** A path into the Ark for one animal or kind: `/ark?focus=<animal id or model slug>`. */
export function arkFocusPath(focus: string): string {
    return `/ark?focus=${encodeURIComponent(focus)}`;
}

function safeLocale(locale: string): string {
    try {
        return new Intl.NumberFormat(locale).resolvedOptions().locale;
    } catch {
        return "en";
    }
}

/** A fraction as a percentage in the reader's language ("92.9%"), with at most `digits` decimals. */
export function arkPercent(fraction: number, locale: string, digits = 0): string {
    const clamped = Math.min(Math.max(fraction, 0), 1);
    return new Intl.NumberFormat(safeLocale(locale), {style: "percent", maximumFractionDigits: digits}).format(clamped);
}

export function arkNumber(value: number, locale: string, digits = 0): string {
    return new Intl.NumberFormat(safeLocale(locale), {maximumFractionDigits: digits}).format(value);
}

/** The most a kind's or an animal's chance reads as: an estimate is never sure (the card's own 1 to 99). */
export function arkChancePercent(chance: number): number {
    return Math.min(Math.max(Math.round(chance * 100), 1), 99);
}

// MARK: Survival

export type ArkPlaceCard = {
    place: ArkPlace;
    name: string;
    /** "92.9% still alive", or null where nobody was there. */
    alive: string | null;
    line: string;
    trend: "more" | "less" | "steady";
    trendText: string;
    /** The sparkline's values (lost per 100 aboard, oldest day first) and a screen reader's description of them. */
    series: number[];
    seriesLabel: string;
};

export function arkPlaceCards(survival: ArkSurvival, words: ArkRankingsWords, locale: string): ArkPlaceCard[] {
    const s = words.survival;
    const days = survival.windowDays;
    return survival.places
        .filter((place) => place.everThere > 0)
        .map((place: ArkPlaceSurvival): ArkPlaceCard => ({
            place: place.place,
            name: words.places[place.place],
            alive: place.share === null ? null : fillArkWords(s.placeAlive, {percent: arkPercent(place.share, locale, 1)}),
            line: fillArkWords(s.placeLine, {lost: arkNumber(place.lost, locale), recovering: arkNumber(place.recovering, locale), alive: arkNumber(place.alive, locale)}),
            trend: place.trend,
            trendText: place.trend === "more" ? s.trendMore : place.trend === "less" ? s.trendLess : s.trendSteady,
            series: place.ratePer100,
            seriesLabel: `${s.placeTrendTitle}: ${place.ratePer100.map((value) => arkNumber(value, locale, 1)).join(", ")} (${days})`
        }));
}

/** The place with the highest share alive among those with enough animals to say (at least 20 there in the window). */
export function arkSafestPlace(survival: ArkSurvival): ArkPlaceSurvival | null {
    const enough = survival.places.filter((place) => place.share !== null && place.everThere >= 20);
    if (!enough.length) return null;
    return enough.reduce((best, place) => ((place.share ?? 0) > (best.share ?? 0) ? place : best));
}

export type ArkCauseBar = {cause: ArkDeathCause; name: string; falls: number; lost: number; share: number; line: string};

export function arkCauseBars(survival: ArkSurvival, words: ArkRankingsWords, locale: string): ArkCauseBar[] {
    const s = words.survival;
    const names: Record<ArkDeathCause, string> = {old: s.causeOld, starved: s.causeStarved, eaten: s.causeEaten};
    const total = ARK_DEATH_CAUSES.reduce((sum, cause) => sum + survival.causes.falls[cause], 0);
    return ARK_DEATH_CAUSES.map((cause) => ({
        cause,
        name: names[cause],
        falls: survival.causes.falls[cause],
        lost: survival.causes.lostForGood[cause],
        share: total > 0 ? survival.causes.falls[cause] / total : 0,
        line: fillArkWords(s.causeLine, {falls: arkNumber(survival.causes.falls[cause], locale), lost: arkNumber(survival.causes.lostForGood[cause], locale)})
    }));
}

/** The hunting line: protected (with the day it ends and the real days left), on, or the model's note that it is not counted. */
export function arkHuntingLine(report: {hunt: {state: "protected" | "on" | "unknown"; endsArkDay: number | null; inDays: number | null}; hunting: "counted" | "partial" | "off"}, words: ArkRankingsWords, locale: string): string {
    const s = words.survival;
    if (report.hunt.state === "protected" && report.hunt.endsArkDay !== null && report.hunt.inDays !== null) {
        return fillArkWords(s.huntingProtected, {day: arkNumber(Math.ceil(report.hunt.endsArkDay), locale), days: arkNumber(Math.max(1, Math.round(report.hunt.inDays)), locale)});
    }
    return report.hunt.state === "on" ? s.huntingOn : "";
}

export type ArkRiskWords = {words: ArkTimeLeftWords; units: ArkTimeLeftUnitWords};

function reasonOf(row: ArkRiskAnimal, timeWords: ArkRiskWords, locale: string): string {
    const parts: string[] = [];
    if (row.outlook?.left) {
        const left = arkTimeLeftText(row.outlook.left, timeWords.words, timeWords.units, locale);
        parts.push(`${left.title}: ${left.value}`);
    }
    const chance = row.outlook ? arkChanceText(row.outlook, timeWords.words, timeWords.units, locale) : null;
    if (chance?.mainReason) parts.push(chance.mainReason);
    return parts.join(" · ");
}

export function arkRiskAnimalRows(rows: readonly ArkRiskAnimal[], rankOf: (animalId: string) => number, words: ArkRankingsWords, timeWords: ArkRiskWords, locale: string, iconOf: (slug: string) => string): ArkRankingRow[] {
    return rows.map((row) => ({
        rank: rankOf(row.animal.id),
        tier: "",
        speciesSlug: row.animal.model_slug,
        speciesName: row.animal.name,
        iconSrc: iconOf(row.animal.model_slug),
        primaryMetric: fillArkWords(words.survival.chanceAnimal, {percent: arkPercent(arkChancePercent(row.chance) / 100, locale)}),
        shortReason: reasonOf(row, timeWords, locale),
        domain: words.places[row.place],
        href: arkFocusPath(row.animal.id)
    }));
}

export function arkRiskKindRows(rows: readonly ArkRiskKind[], rankOf: (kindId: string) => number, words: ArkRankingsWords, timeWords: ArkRiskWords, locale: string, iconOf: (slug: string) => string): ArkRankingRow[] {
    return rows.map((kind) => ({
        rank: rankOf(kind.kindId),
        tier: "",
        speciesSlug: kind.slug,
        speciesName: kind.name,
        iconSrc: iconOf(kind.slug),
        primaryMetric: fillArkWords(words.survival.chanceKind, {percent: arkPercent(arkChancePercent(kind.persistence) / 100, locale)}),
        shortReason: [fillArkWords(words.survival.aboardCount, {count: arkNumber(kind.aboard, locale)}), reasonOf(kind.worst, timeWords, locale)].filter(Boolean).join(" · "),
        domain: kind.group ? words.groups[kind.group] : "",
        href: arkFocusPath(kind.slug)
    }));
}

// MARK: Breeders

export function arkBreederRows(rows: readonly ArkBreeder[], words: ArkRankingsWords, locale: string, iconOf: (slug: string) => string): ArkRankingRow[] {
    return rows.map((row, index) => ({
        rank: index + 1,
        tier: "",
        speciesSlug: row.slug,
        speciesName: row.name,
        iconSrc: iconOf(row.slug),
        primaryMetric: fillArkWords(words.breeders.youngPerAdult, {value: arkNumber(row.youngPerAdult, locale, 1)}),
        shortReason: fillArkWords(words.breeders.breederLine, {day: arkNumber(row.bornDay, locale), week: arkNumber(row.bornWeek, locale), all: arkNumber(row.bornAll, locale), adults: arkNumber(row.adults, locale)}),
        domain: row.group ? words.groups[row.group] : "",
        href: arkFocusPath(row.slug)
    }));
}

/** The animals of a place as the Ark's own place words say it (a reader-facing helper for tests and the pages). */
export function arkPlaceName(place: ArkPlace, words: ArkRankingsWords): string {
    return words.places[place];
}

export function arkGroupName(group: ArkGroup, words: ArkRankingsWords): string {
    return words.groups[group];
}

/** The text direction of the reader's language ("rtl" for Arabic, Hebrew, Persian, Urdu). */
export function arkRankingDirection(language: string): "ltr" | "rtl" {
    return arkDirection(language);
}

/** The places in the order the pages show them. */
export const ARK_PLACE_ORDER = ARK_PLACES;

export type {ArkAnimal};
