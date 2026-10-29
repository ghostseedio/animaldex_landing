import {DIMENSIONS, type Dimension, type Experiment, EXPERIMENT_VERSION, type ExperimentKind, type Intent, KIND_DIMENSIONS} from "@/lib/social-lab/arms";
import type {SocialPlatform} from "@/lib/social/types";

// The hook lab's learner, pure. Each published share gets a score in [0, 1]:
// where its numbers rank among the same platform's posts of the same kind
// (a percentile, so a TikTok view and a YouTube view are never compared
// directly). An item built for one reaction (its intent) is judged half on
// reach and half on that reaction per view: a "share" video on shares, a
// "save" one on saves. An item's score is the mean over the platforms it went
// to. Each arm then has a Beta posterior over "beats the typical post", and
// the next item's arms are drawn by Thompson sampling, with a floor of pure
// exploration so a slow starter still gets tried. Page families (blog, battle,
// hybrid…) are drawn the same way, from every item's score.

/** A post younger than this has not been judged by its feed yet. */
export const MIN_AGE_HOURS = 36;
/** Share of picks that ignore the posterior entirely. */
export const EXPLORATION = 0.15;

export type PostMetrics = {
    views: number | null;
    likes: number | null;
    comments: number | null;
    shares: number | null;
    saves: number | null;
    hold_3s: number | null;
    completion: number | null;
    avg_view_pct: number | null;
};

export type ScoredShare = {
    /** The video / carousel / text item this share belongs to. */
    itemId: string;
    itemKind: ExperimentKind;
    /** "video", "carousel" or "text": percentiles are taken within one family per platform. */
    family: "video" | "carousel" | "text";
    platform: SocialPlatform;
    /** The page family the item was made from (blog, comparison, …); null when unknown. */
    sourceType: string | null;
    experiment: Experiment | null;
    ageHours: number;
    metrics: PostMetrics;
};

/** The numbers a share is ranked on, best signal first; null when it has none yet. */
export function signals(share: Pick<ScoredShare, "family" | "metrics">): Array<keyof PostMetrics> {
    if (share.family === "video") return ["views", "hold_3s", "completion", "avg_view_pct"];
    return ["views", "likes", "shares", "comments", "saves"];
}

/** A reaction count per view, so a post that reached more people is not credited for reach twice. */
function perView(count: number | null, views: number | null) {
    if (count === null || count === undefined || !Number.isFinite(count)) return null;
    return views && views > 0 ? count / views : count;
}

/** The numbers that say whether an item did its job, best first. */
export function jobValues(intent: Intent, metrics: PostMetrics): Array<number | null> {
    if (intent === "share") return [perView(metrics.shares, metrics.views)];
    if (intent === "save") return [perView(metrics.saves, metrics.views)];
    if (intent === "comment") return [perView(metrics.comments, metrics.views)];
    return [metrics.completion, metrics.avg_view_pct, metrics.hold_3s];
}

/** Percentile rank of `value` in `values` (ties share the midpoint), in [0, 1]. */
export function percentile(value: number, values: number[]) {
    if (values.length <= 1) return 0.5;
    let below = 0;
    let equal = 0;
    for (const other of values) {
        if (other < value) below += 1;
        else if (other === value) equal += 1;
    }
    return (below + (equal - 1) / 2) / (values.length - 1);
}

const finite = (value: number | null | undefined): value is number => value !== null && value !== undefined && Number.isFinite(value);

/** Each judged share's score: the mean percentile over the signals it has, within platform × family; half its job's when it has one. */
export function scoreShares(shares: ScoredShare[]): Array<ScoredShare & {score: number}> {
    const judged = shares.filter((share) => share.ageHours >= MIN_AGE_HOURS);
    const groups = new Map<string, ScoredShare[]>();
    for (const share of judged) {
        const key = `${share.platform}:${share.family}`;
        groups.set(key, [...(groups.get(key) ?? []), share]);
    }
    const scored: Array<ScoredShare & {score: number}> = [];
    for (const group of Array.from(groups.values())) {
        for (const share of group) {
            const parts: number[] = [];
            for (const signal of signals(share)) {
                const value = share.metrics[signal];
                if (!finite(value)) continue;
                const pool = group.map((other) => other.metrics[signal]).filter(finite);
                if (pool.length < 3) continue;
                parts.push(percentile(value, pool));
            }
            if (!parts.length) continue;
            const reach = parts.reduce((sum, part) => sum + part, 0) / parts.length;
            // The job's own numbers, ranked against every post in the group (not only same-job ones).
            const intent = share.experiment?.intent;
            const job: number[] = [];
            if (intent) {
                jobValues(intent, share.metrics).forEach((value, slot) => {
                    if (!finite(value)) return;
                    const pool = group.map((other) => jobValues(intent, other.metrics)[slot]).filter(finite);
                    if (pool.length >= 3) job.push(percentile(value, pool));
                });
            }
            const score = job.length ? (reach + job.reduce((sum, part) => sum + part, 0) / job.length) / 2 : reach;
            scored.push({...share, score});
        }
    }
    return scored;
}

export type ItemScore = {itemId: string; kind: ExperimentKind; experiment: Experiment; score: number; platforms: number};

/** One score per item: the mean over its platforms. Items without a recorded experiment are left out. */
export function itemScores(scored: Array<ScoredShare & {score: number}>): ItemScore[] {
    const byItem = new Map<string, Array<ScoredShare & {score: number}>>();
    for (const share of scored) {
        if (!share.experiment || share.experiment.version !== EXPERIMENT_VERSION) continue;
        byItem.set(share.itemId, [...(byItem.get(share.itemId) ?? []), share]);
    }
    return Array.from(byItem.entries()).map(([itemId, list]) => ({
        itemId,
        kind: list[0].itemKind,
        experiment: list[0].experiment!,
        score: list.reduce((sum, share) => sum + share.score, 0) / list.length,
        platforms: list.length
    }));
}

export type ArmStats = {arm: string; items: number; mean: number | null; alpha: number; beta: number};

/** Beta(1 + Σscore, 1 + Σ(1−score)) per arm of one dimension, over the items of the kinds given. */
export function armStats(items: ItemScore[], dimension: Dimension, kinds: readonly ExperimentKind[]): ArmStats[] {
    return Object.keys(DIMENSIONS[dimension]).map((arm) => {
        const mine = items.filter((item) => kinds.includes(item.kind) && item.experiment[dimension] === arm);
        const sum = mine.reduce((total, item) => total + item.score, 0);
        return {arm, items: mine.length, mean: mine.length ? sum / mine.length : null, alpha: 1 + sum, beta: 1 + mine.length - sum};
    });
}

// ── Sampling ─────────────────────────────────────────────────────────────────

type Random = () => number;

function gaussian(random: Random) {
    let u = 0;
    while (u === 0) u = random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * random());
}

/** Marsaglia–Tsang gamma sampler (shape ≥ 1; boosted below 1). */
function gamma(shape: number, random: Random): number {
    if (shape < 1) return gamma(shape + 1, random) * Math.pow(random() || 1e-12, 1 / shape);
    const d = shape - 1 / 3;
    const c = 1 / Math.sqrt(9 * d);
    for (;;) {
        let x: number;
        let v: number;
        do {
            x = gaussian(random);
            v = 1 + c * x;
        } while (v <= 0);
        v = v * v * v;
        const u = random();
        if (u < 1 - 0.0331 * x ** 4) return d * v;
        if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
    }
}

export function sampleBeta(alpha: number, beta: number, random: Random = Math.random) {
    const a = gamma(alpha, random);
    const b = gamma(beta, random);
    return a / (a + b);
}

/** Thompson draw over one dimension's arms, with uniform exploration. */
export function pickArm(stats: ArmStats[], random: Random = Math.random, exploration = EXPLORATION): string {
    if (random() < exploration) return stats[Math.floor(random() * stats.length)].arm;
    let best = stats[0];
    let bestDraw = -1;
    for (const entry of stats) {
        const draw = sampleBeta(entry.alpha, entry.beta, random);
        if (draw > bestDraw) {
            bestDraw = draw;
            best = entry;
        }
    }
    return best.arm;
}

/** How often each arm wins a Thompson draw: the "chance it is best" the admin panel shows. */
export function chanceBest(stats: ArmStats[], draws = 400, random: Random = Math.random): Record<string, number> {
    const wins = Object.fromEntries(stats.map((entry) => [entry.arm, 0])) as Record<string, number>;
    for (let index = 0; index < draws; index += 1) wins[pickArm(stats, random, 0)] += 1;
    return Object.fromEntries(Object.entries(wins).map(([arm, count]) => [arm, count / draws]));
}

/** Kinds that share what they learn about a dimension: a hook style that works in a battle informs an editorial too. */
export function learningKinds(kind: ExperimentKind, dimension: Dimension): readonly ExperimentKind[] {
    if (dimension === "hookStyle" || dimension === "intent") return kind === "carousel" ? ["carousel"] : ["editorial", "battle", "creature"];
    if (dimension === "ending" || dimension === "opener") return ["editorial", "battle", "creature"];
    return [kind];
}

/** The arms the next item of `kind` uses, one per dimension it tests; `allowed` narrows a dimension (the intents a page fits). */
export function chooseExperiment(kind: ExperimentKind, items: ItemScore[], random: Random = Math.random, allowed: Partial<Record<Dimension, readonly string[]>> = {}): Experiment {
    const experiment: Experiment = {version: EXPERIMENT_VERSION};
    for (const dimension of KIND_DIMENSIONS[kind]) {
        const only = allowed[dimension];
        const stats = armStats(items, dimension, learningKinds(kind, dimension)).filter((entry) => !only?.length || only.includes(entry.arm));
        if (!stats.length) continue;
        (experiment as Record<string, unknown>)[dimension] = pickArm(stats, random);
    }
    return experiment;
}

// ── Page families ────────────────────────────────────────────────────────────

/**
 * Beta stats per page family (blog, comparison, …) for one item family, from
 * every judged item's score whether or not it carried an experiment: an
 * item's score is its mean over the platforms it went to.
 */
export function sourceTypeStats(scored: Array<ScoredShare & {score: number}>, family: ScoredShare["family"], types: readonly string[]): ArmStats[] {
    const byItem = new Map<string, {type: string; scores: number[]}>();
    for (const share of scored) {
        if (share.family !== family || !share.sourceType) continue;
        const entry = byItem.get(share.itemId) ?? {type: share.sourceType, scores: []};
        entry.scores.push(share.score);
        byItem.set(share.itemId, entry);
    }
    const items = Array.from(byItem.values()).map((entry) => ({type: entry.type, score: entry.scores.reduce((sum, value) => sum + value, 0) / entry.scores.length}));
    return types.map((type) => {
        const mine = items.filter((item) => item.type === type);
        const sum = mine.reduce((total, item) => total + item.score, 0);
        return {arm: type, items: mine.length, mean: mine.length ? sum / mine.length : null, alpha: 1 + sum, beta: 1 + mine.length - sum};
    });
}

/** Every arm in the order Thompson draws pick them (each pick with the same exploration floor). */
export function rankArms(stats: ArmStats[], random: Random = Math.random, exploration = EXPLORATION): string[] {
    const left = [...stats];
    const order: string[] = [];
    while (left.length) {
        const arm = pickArm(left, random, exploration);
        order.push(arm);
        left.splice(left.findIndex((entry) => entry.arm === arm), 1);
    }
    return order;
}
