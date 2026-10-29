import type {SourceType} from "@/lib/content-video/plan";

// Which page the auto-generate timer makes a video from: a page family (the
// left-hand dropdown) among those with pages left, then a random page of it
// (the right-hand one). The family comes from the hook lab's ranking when
// there is one (rankSourceTypes), else at random. Pure, so the choice is testable.

export function pickRandomSource<T extends {slug: string}>(available: Partial<Record<SourceType, T[]>>, random: () => number = Math.random, order: readonly string[] = []): {type: SourceType; page: T} | null {
    const types = (Object.keys(available) as SourceType[]).filter((type) => (available[type]?.length ?? 0) > 0);
    if (!types.length) return null;
    const ranked = order.find((type): type is SourceType => types.includes(type as SourceType));
    const type = ranked ?? types[Math.min(types.length - 1, Math.floor(random() * types.length))];
    const pages = available[type]!;
    return {type, page: pages[Math.min(pages.length - 1, Math.floor(random() * pages.length))]};
}

/** True when one more video at the per-video cap would still fit today's budget. */
export function budgetAllowsVideo(spentTodayUSD: number, maxVideoUSD: number, dailyBudgetUSD: number) {
    return spentTodayUSD + maxVideoUSD <= dailyBudgetUSD;
}
