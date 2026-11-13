import type {SourceType} from "@/lib/content-video/plan";
import {dayStartMs} from "@/lib/social/auto-share-plan";

// Which page the auto-generate timer makes a video from: a page family (the
// left-hand dropdown) among those with pages left, then a random page of it
// (the right-hand one). The family comes from the hook lab's ranking when
// there is one (rankSourceTypes), else at random. Pure, so the choice is testable.

export function pickRandomSource<T extends {slug: string}>(available: Partial<Record<SourceType, T[]>>, random: () => number = Math.random, order: readonly string[] = []): {type: SourceType; page: T} | null {
    const types = (Object.keys(available) as SourceType[]).filter((type) => (available[type]?.length ?? 0) > 0);
    if (!types.length) return null;
    const ranked = order.find((type): type is SourceType => types.includes(type as SourceType));
    const type = ranked ?? types[Math.min(types.length - 1, Math.floor(random() * types.length))];
    // Within the family, the highest-priority pages go first (a lesson about a lion before one about a moth).
    const top = Math.max(...available[type]!.map((page) => (page as {priority?: number}).priority ?? 0));
    const pages = available[type]!.filter((page) => ((page as {priority?: number}).priority ?? 0) === top);
    return {type, page: pages[Math.min(pages.length - 1, Math.floor(random() * pages.length))]};
}

/**
 * Generated videos a day, every format together (16 Nov 2026): the autopilot
 * stops once this many videos exist for the Jakarta day, whoever started them
 * (the timer or "Generate video" in the admin), and whatever page family or
 * format. CONTENT_VIDEO_DAILY_MAX raises or lowers it; a failed video does not
 * count (nothing was shipped), an archived one does (it was paid for).
 */
export const CONTENT_VIDEO_DAILY_MAX_DEFAULT = 2;

/** The videos that count towards today's cap. */
export function videosMadeToday<T extends {status: string; created_at: string}>(rows: readonly T[], now: number) {
    const start = dayStartMs(now);
    return rows.filter((row) => row.status !== "failed" && Date.parse(row.created_at) >= start);
}

/** The cap in force: the env override when it is a positive number, else the default. */
export function contentVideoDailyMax(env: Record<string, string | undefined> = process.env) {
    const value = Number(env.CONTENT_VIDEO_DAILY_MAX);
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : CONTENT_VIDEO_DAILY_MAX_DEFAULT;
}

/** True when one more video at the per-video cap would still fit today's budget. */
export function budgetAllowsVideo(spentTodayUSD: number, maxVideoUSD: number, dailyBudgetUSD: number) {
    return spentTodayUSD + maxVideoUSD <= dailyBudgetUSD;
}

/** Animals everyone has an opinion on, as they appear in comparison slugs ("gorilla-vs-crocodile", "bear-vs-tiger"). */
const FAMOUS_ANIMALS = ["gorilla", "lion", "tiger", "shark", "crocodile", "alligator", "orca", "bear", "wolf", "hippopotamus", "eagle", "elephant", "cheetah", "leopard", "jaguar", "hyena", "rhino", "rhinoceros", "python", "anaconda", "cobra", "octopus", "chimpanzee", "honey-badger", "komodo-dragon", "whale", "moose", "bison", "kangaroo", "ostrich"];

/** How many sides of a comparison slug are a famous animal (a "golden-headed-lion-tamarin" or a "lionfish" is not a lion). */
export function famousSides(slug: string) {
    return slug.split("-vs-").filter((side) => FAMOUS_ANIMALS.some((animal) => side === animal || side.endsWith(`-${animal}`))).length;
}
