/**
 * Discover posts for Animal Trials, ported from the iOS source of truth
 * (`DiscoverAnimalTrialTimelineItem` and `DiscoverAnimalTrialTimelineCardView`).
 *
 * A completed Trial is a Discover post the same way a comparison or a trade
 * is. So is evidence that failed both checks, and a written "Apply It Your
 * Way" account whether it was accepted or not. The database view decides what
 * is a post; this module decides how one reads.
 */

export type DiscoverAnimalTrialPostLike = {
    frequency: string;
    isFailed: boolean;
    rewardXP: number;
    rewardCredits: number;
    title: string;
    speciesName: string;
};

/** `LOW` / `MID` / `HIGH` are Trials; `APPLICATION` is the written route. */
export function animalTrialFrequencyLabel(frequency: string | null | undefined) {
    switch ((frequency ?? "").trim().toUpperCase()) {
        case "LOW": return "LOW TRIAL";
        case "MID": return "MID TRIAL";
        case "HIGH": return "HIGH TRIAL";
        case "APPLICATION": return "YOUR WAY";
        default: return "TRIAL";
    }
}

/** The eyebrow over the title: the frequency, marked when the evidence was refused. */
export function animalTrialStatusLabel(post: Pick<DiscoverAnimalTrialPostLike, "frequency" | "isFailed">) {
    const label = animalTrialFrequencyLabel(post.frequency);
    return post.isFailed ? `${label} · FAILED` : label;
}

export type AnimalTrialPill = {tone: "reward" | "fail"; text: string};

/**
 * What the post earned. A refused attempt shows why it earned nothing rather
 * than an empty row; an accepted one shows only the rewards that were non-zero.
 */
export function animalTrialPills(post: Pick<DiscoverAnimalTrialPostLike, "isFailed" | "rewardXP" | "rewardCredits">): AnimalTrialPill[] {
    if (post.isFailed) return [{tone: "fail", text: "EVIDENCE NOT ACCEPTED"}];
    const pills: AnimalTrialPill[] = [];
    if (post.rewardXP > 0) pills.push({tone: "reward", text: `+${post.rewardXP} XP`});
    if (post.rewardCredits > 0) pills.push({tone: "reward", text: `+${post.rewardCredits} Credits`});
    return pills;
}

/** A written account is the person's own words: it is shown as prose, never as a headline. */
export function isWrittenAnimalTrialPost(post: {proofType: string | null | undefined}) {
    return (post.proofType ?? "").trim().toLowerCase() === "application";
}

export function animalTrialAccessibilityLabel(post: DiscoverAnimalTrialPostLike) {
    const label = animalTrialFrequencyLabel(post.frequency);
    return post.isFailed
        ? `${label}. Failed. ${post.title}. ${post.speciesName}.`
        : `${label}. ${post.title}. ${post.speciesName}.`;
}

export function animalTrialPeerSummary(peerNames: string[]) {
    if (!peerNames.length) return null;
    return peerNames.length === 1
        ? `Also finished a Trial: ${peerNames[0]}`
        : `Also finished a Trial by ${peerNames.length} other collectors`;
}

/**
 * The cohort pager: the post already on screen stays first, and the others
 * follow newest first without repeating it.
 */
export function pinnedAnimalTrialCohort<T extends {id: string}>(current: T, page: T[]): T[] {
    return [current, ...page.filter((post) => post.id !== current.id)];
}

/**
 * Collectors other than the one on screen who have a post in the cohort,
 * each once. They are the small avatar stack; the person on screen is the
 * large one, so they stay out of it.
 */
export function animalTrialPeers<T extends {collector: {userId: string; name: string}}>(current: T, posts: T[]) {
    const seen = new Set<string>();
    const peers: T["collector"][] = [];
    for (const post of posts) {
        if (post.collector.userId === current.collector.userId) continue;
        if (seen.has(post.collector.userId)) continue;
        seen.add(post.collector.userId);
        peers.push(post.collector);
    }
    return peers;
}

/** The route that serves a post's evidence still. Only a published post has one. */
export function animalTrialEvidenceRoute(postId: string) {
    return `/api/trial-evidence/${encodeURIComponent(postId)}`;
}

export const ANIMAL_TRIAL_COHORT_PAGE_SIZE = 12;
