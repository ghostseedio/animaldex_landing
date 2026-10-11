/**
 * The five AnimalDex stats, read as a lesson.
 *
 * Every species in AnimalDex has one canonical stat profile
 * (`species_profiles.canonical_game_stats`): dominance, speed, size,
 * intelligence and rarity, each 0–100 for a typical healthy adult in the wild.
 * The tier lists rank on them; this module is how a stat changes the way an
 * animal's lesson is lived. Copy lives in the locale files under
 * `rankings.statLessons`; this holds the structure and the example animals.
 *
 * Example values are the live canonical stats (Oct 11 2026). Each example has a
 * published species page.
 */

import type {SpeciesStats} from "@/lib/battle-tier";

export type StatLessonKey = keyof SpeciesStats;

export type StatLessonExample = {
    slug: string;
    name: string;
    value: number;
};

export type StatLesson = {
    key: StatLessonKey;
    shortTitle: string;
    /** Same tints as the species page stat radar and the app's AnimalRadarMetric. */
    tint: string;
    high: StatLessonExample;
    low: StatLessonExample;
};

/** Order matches the app's stat radar. */
export const STAT_LESSONS: StatLesson[] = [
    {
        key: "speed",
        shortTitle: "SPD",
        tint: "#A7F432",
        high: {slug: "cheetah", name: "Cheetah", value: 100},
        low: {slug: "aldabra-giant-tortoise", name: "Aldabra Giant Tortoise", value: 8}
    },
    {
        key: "dominance",
        shortTitle: "DOM",
        tint: "rgba(239, 68, 68, 0.92)",
        high: {slug: "grizzly-bear", name: "Grizzly Bear", value: 94},
        low: {slug: "western-honey-bee", name: "Western Honey Bee", value: 12}
    },
    {
        key: "size",
        shortTitle: "SIZE",
        tint: "#9454fa",
        high: {slug: "african-bush-elephant", name: "African Bush Elephant", value: 92},
        low: {slug: "bee-hummingbird", name: "Bee Hummingbird", value: 2}
    },
    {
        key: "intelligence",
        shortTitle: "INT",
        tint: "rgba(34, 211, 238, 0.92)",
        high: {slug: "chimpanzee", name: "Chimpanzee", value: 96},
        low: {slug: "koala", name: "Koala", value: 32}
    },
    {
        key: "rarity",
        shortTitle: "RAR",
        tint: "rgba(251, 146, 60, 0.92)",
        high: {slug: "kakapo", name: "Kakapo", value: 99},
        low: {slug: "house-sparrow", name: "House Sparrow", value: 5}
    }
];

export function getStatLesson(key: StatLessonKey) {
    return STAT_LESSONS.find((lesson) => lesson.key === key) ?? null;
}

/**
 * The stat a tier list leans on, by its ranking category. Lists that measure
 * something the five stats don't (eyesight, camouflage, culture…) return null
 * and show the five stats together instead.
 */
const CATEGORY_STAT: Partial<Record<string, StatLessonKey>> = {
    speed: "speed",
    agility: "speed",
    strength: "dominance",
    danger: "dominance",
    bite_force: "dominance",
    strike: "dominance",
    hunting: "dominance",
    fatality: "dominance",
    size: "size",
    intelligence: "intelligence",
    communication: "intelligence",
    adaptability: "intelligence",
    teamwork: "intelligence",
    rarity: "rarity"
};

export function statForRanking(ranking: {category: string; statRankingKey?: string}): StatLessonKey | null {
    const direct = ranking.statRankingKey;
    if (direct && STAT_LESSONS.some((lesson) => lesson.key === direct)) return direct as StatLessonKey;
    return CATEGORY_STAT[ranking.category] ?? null;
}
