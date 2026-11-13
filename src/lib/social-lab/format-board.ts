// The format leaderboard, pure: Victor Gu's "format arbitrage" applied to our
// own numbers. A format is a repeatable template (a "who would win" battle, a
// top-5 countdown, a dark & gold animal lesson), not one video. Each post is
// measured against its own platform's median, so a TikTok view and a YouTube
// view are never compared directly; a format's number is the median of its
// posts' multiples. The verdict follows the playbook's rules:
//   test  — under 10 videos: keep posting, no judgement yet;
//   scale — median ≥ 2× the platform median, or ≥ 10% of posts are hits
//           (a hit = 5× the platform median): make three times as many;
//   fix   — at or above the median but the 3-second hold is under 40%:
//           keep the format, rewrite its hook;
//   kill  — clearly below the platform median after 10 videos (under 0.8×:
//           the playbook says "below the median", but the account's own
//           median sits at 1× by definition, so a band keeps noise from
//           retiring half the formats): retire it;
//   hold  — in between: keep it in the mix.
// The auto-generators read the verdicts (formatWeight) when they pick what to
// make next; /admin/story-videos shows the board.

export type FormatFamily = "video" | "carousel" | "text";
/** Victor's three ways to win a format: be better at it, bring it from another niche, or out-post everyone. */
export type FormatStrategy = "out_execute" | "transplant" | "scale";

export type FormatSpec = {label: string; family: FormatFamily; strategy: FormatStrategy; what: string};

export const FORMATS = {
    battle: {label: "Who would win? (AI battle)", family: "video", strategy: "out_execute", what: "VS card with real stats, then an AI fight that ends on the page's winner."},
    creature: {label: "Hybrid / fusion reveal", family: "video", strategy: "out_execute", what: "Two parent animals, then the imagined animal revealed in an AI clip."},
    countdown: {label: "Top 5 countdown", family: "video", strategy: "out_execute", what: "A ranking page counted down from #5 to #1."},
    location_guide: {label: "What you can see in…", family: "video", strategy: "out_execute", what: "A place and the animals you can spot there."},
    page_story: {label: "Narrated story (blog)", family: "video", strategy: "out_execute", what: "A blog post told as a fast narrated photo edit."},
    lesson: {label: "What the animal teaches you", family: "video", strategy: "transplant", what: "Self-improvement's dark & gold quote video, with one real animal behaviour as the lesson."},
    guess: {label: "Guess the animal", family: "video", strategy: "transplant", what: "Quiz: a close-up you can't place, clues getting easier, then the reveal with its stat card."},
    scan: {label: "Scan reveal (our footage)", family: "video", strategy: "out_execute", what: "Real footage of the app scanning a real animal, the result card, a fact and its lesson."},
    you_vs: {label: "You vs the animal", family: "video", strategy: "transplant", what: "Could you beat it? Three rounds shown as events, one you really win, then the score."},
    would_you_rather: {label: "Would you rather", family: "video", strategy: "transplant", what: "Two animals' powers in action, each one's real catch, then \"A or B?\"."},
    pokemon: {label: "Real-life Pokémon", family: "video", strategy: "transplant", what: "A real animal, two design clues, the Pokémon it matches, a fact that beats the game."},
    app_story: {label: "App species story", family: "video", strategy: "out_execute", what: "The app's own story video of one species."},
    real_footage: {label: "Real footage (uploaded)", family: "video", strategy: "transplant", what: "Phone or camera footage edited by hand and uploaded."},
    ark: {label: "Ark clip (recorded scene)", family: "video", strategy: "out_execute", what: "A scripted shot of the live Ark (day to night, an arrival, a meal chase, a follow, a flyover, meet the species) with captions from stored data."},
    carousel_page: {label: "Page carousel", family: "carousel", strategy: "out_execute", what: "A page told in 5–8 slides."},
    carousel_usual_vs_animal: {label: "Carousel: the usual vs the animal", family: "carousel", strategy: "transplant", what: "An everyday idea, the usual answer, and an animal's take."},
    carousel_five_animals: {label: "Carousel: 5 animals, 1 idea", family: "carousel", strategy: "transplant", what: "One idea, five animals' takes, \"which one is you?\"."},
    carousel_birth_month: {label: "Carousel: your birth month = your animal", family: "carousel", strategy: "transplant", what: "Astrology's \"your month = your X\": twelve animals, one trait each, one month roasted."},
    text: {label: "Text posts", family: "text", strategy: "scale", what: "Hot takes, polls and wild facts on X, Threads and Bluesky."}
} as const satisfies Record<string, FormatSpec>;
export type FormatKey = keyof typeof FORMATS;

export function isFormatKey(value: unknown): value is FormatKey {
    return typeof value === "string" && Object.hasOwn(FORMATS, value);
}

/** The page families a video can be made from, and the format each one makes (battles from comparisons, …). */
export const SOURCE_FORMAT: Record<string, FormatKey> = {
    comparison: "battle",
    hybrid: "creature",
    fusion: "creature",
    ranking: "countdown",
    location: "location_guide",
    blog: "page_story",
    lesson: "lesson",
    guess: "guess",
    scan: "scan",
    you_vs: "you_vs",
    would_you_rather: "would_you_rather",
    pokemon: "pokemon",
    ark: "ark"
};

/** Which format a post is: the key stamped on the share row (options.format) first, else what it was made of. Null when we cannot tell. */
export function formatOfPost(post: {mediaKind: string; optionsFormat?: string | null; videoFormat?: string | null; sourceType?: string | null; carouselFormat?: string | null; contentKind?: string | null}): FormatKey | null {
    if (isFormatKey(post.optionsFormat)) return post.optionsFormat;
    if (post.mediaKind === "uploaded_video") return "real_footage";
    if (post.mediaKind === "story_video") return "app_story";
    if (post.mediaKind === "carousel" || post.contentKind === "carousel") {
        const key = `carousel_${post.carouselFormat ?? "page"}`;
        return isFormatKey(key) ? key : "carousel_page";
    }
    if (post.mediaKind === "text_post" || post.contentKind === "text") return "text";
    // A page video: the format its plan was made in, else the one its page family makes.
    if (post.videoFormat && post.videoFormat !== "editorial" && isFormatKey(post.videoFormat)) return post.videoFormat;
    return post.sourceType ? SOURCE_FORMAT[post.sourceType] ?? null : null;
}

/** A post the feed has had long enough to judge (same cut-off as the hook lab). */
export const JUDGE_AFTER_HOURS = 36;
/** Videos before any verdict. */
export const TEST_ITEMS = 10;
export const SCALE_MULTIPLE = 2;
export const HIT_MULTIPLE = 5;
export const SCALE_HIT_RATE = 0.1;
export const HOOK_HOLD_FLOOR = 0.4;
/** Under this multiple after 10 videos a format is retired. */
export const KILL_MULTIPLE = 0.8;
/** A platform whose median is below this many views (Pinterest, our Facebook) cannot rank formats yet. */
export const MIN_PLATFORM_MEDIAN = 10;

export type BoardPost = {
    itemId: string;
    format: FormatKey;
    platform: string;
    ageHours: number;
    views: number | null;
    hold3s: number | null;
    shares: number | null;
    clicks?: number | null;
    url?: string | null;
    title?: string | null;
};

export type Verdict = "test" | "scale" | "fix" | "kill" | "hold";

export const VERDICTS: Record<Verdict, {label: string; tone: "good" | "warn" | "bad" | "neutral"; action: string}> = {
    scale: {label: "Scale", tone: "good", action: "Making 3× as many"},
    hold: {label: "Keep", tone: "neutral", action: "Stays in the mix"},
    fix: {label: "Fix the hook", tone: "warn", action: "Good reach, weak first 3 seconds: rewrite the opening"},
    kill: {label: "Retire", tone: "bad", action: "Under 0.8× the median after 10 videos: made rarely, as a check"},
    test: {label: "Testing", tone: "neutral", action: "Gets extra slots until 10 videos are judged"}
};

export type PlatformBaseline = {platform: string; medianViews: number; judgedPosts: number; counted: boolean};

export type FormatPlatformRow = {platform: string; posts: number; medianViews: number | null; multiple: number | null; hits: number};

export type FormatRow = {
    format: FormatKey;
    label: string;
    family: FormatFamily;
    strategy: FormatStrategy;
    /** Distinct videos / carousels judged (the playbook's "10 videos"). */
    items: number;
    /** Judged posts on platforms that can rank. */
    posts: number;
    /** Median over posts of views ÷ that platform's median; 1 = a typical post. */
    multiple: number | null;
    hitRate: number | null;
    hold3s: number | null;
    sharesPer1k: number | null;
    clicksPer1k: number | null;
    perPlatform: FormatPlatformRow[];
    best: {views: number; platform: string; url: string | null; title: string | null; multiple: number} | null;
    verdict: Verdict;
    reason: string;
};

export function median(values: number[]): number | null {
    if (!values.length) return null;
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

const finite = (value: number | null | undefined): value is number => value !== null && value !== undefined && Number.isFinite(value);

function round(value: number | null, digits = 2) {
    if (value === null) return null;
    const factor = 10 ** digits;
    return Math.round(value * factor) / factor;
}

/** The playbook's rules, in order. */
export function verdictFor(row: Pick<FormatRow, "items" | "multiple" | "hitRate" | "hold3s">): {verdict: Verdict; reason: string} {
    if (row.items < TEST_ITEMS || row.multiple === null) return {verdict: "test", reason: `${row.items} of ${TEST_ITEMS} videos judged`};
    const times = `${row.multiple.toFixed(1)}× the median`;
    if (row.multiple >= SCALE_MULTIPLE || (row.hitRate ?? 0) >= SCALE_HIT_RATE) {
        return {verdict: "scale", reason: row.multiple >= SCALE_MULTIPLE ? times : `${Math.round((row.hitRate ?? 0) * 100)}% of posts are hits`};
    }
    if (row.multiple < KILL_MULTIPLE) return {verdict: "kill", reason: `${times} after ${row.items} videos`};
    if (row.hold3s !== null && row.hold3s < HOOK_HOLD_FLOOR) return {verdict: "fix", reason: `${times}, but only ${Math.round(row.hold3s * 100)}% stay 3 seconds`};
    return {verdict: "hold", reason: times};
}

export type FormatBoard = {platforms: PlatformBaseline[]; formats: FormatRow[]; judgedPosts: number};

export function buildFormatBoard(posts: BoardPost[]): FormatBoard {
    const judged = posts.filter((post) => post.ageHours >= JUDGE_AFTER_HOURS && finite(post.views));
    const byPlatform = new Map<string, number[]>();
    for (const post of judged) byPlatform.set(post.platform, [...(byPlatform.get(post.platform) ?? []), post.views!]);
    const platforms: PlatformBaseline[] = Array.from(byPlatform, ([platform, views]) => {
        const medianViews = median(views) ?? 0;
        return {platform, medianViews, judgedPosts: views.length, counted: medianViews >= MIN_PLATFORM_MEDIAN};
    }).sort((a, b) => b.judgedPosts - a.judgedPosts);
    const baseline = new Map(platforms.filter((entry) => entry.counted).map((entry) => [entry.platform, entry.medianViews]));

    const groups = new Map<FormatKey, BoardPost[]>();
    for (const post of judged) groups.set(post.format, [...(groups.get(post.format) ?? []), post]);
    const formats: FormatRow[] = (Object.keys(FORMATS) as FormatKey[]).map((format) => {
        const all = groups.get(format) ?? [];
        const ranked = all.filter((post) => baseline.has(post.platform));
        const multiples = ranked.map((post) => post.views! / baseline.get(post.platform)!);
        const hits = ranked.filter((post) => post.views! >= HIT_MULTIPLE * baseline.get(post.platform)!).length;
        const shares = all.filter((post) => finite(post.shares));
        const clicks = all.filter((post) => finite(post.clicks));
        const viewsWith = (list: BoardPost[]) => list.reduce((sum, post) => sum + post.views!, 0);
        const perPlatform = Array.from(new Set(all.map((post) => post.platform))).map((platform) => {
            const own = all.filter((post) => post.platform === platform);
            const base = baseline.get(platform) ?? null;
            const mid = median(own.map((post) => post.views!));
            return {platform, posts: own.length, medianViews: mid, multiple: base && mid !== null ? round(mid / base) : null, hits: base ? own.filter((post) => post.views! >= HIT_MULTIPLE * base).length : 0};
        }).sort((a, b) => b.posts - a.posts);
        const bestPost = ranked.length ? ranked.reduce((top, post) => post.views! / baseline.get(post.platform)! > top.views! / baseline.get(top.platform)! ? post : top) : null;
        const row = {
            format,
            label: FORMATS[format].label,
            family: FORMATS[format].family,
            strategy: FORMATS[format].strategy,
            items: new Set(ranked.map((post) => post.itemId)).size,
            posts: ranked.length,
            multiple: round(median(multiples)),
            hitRate: ranked.length ? round(hits / ranked.length, 3) : null,
            hold3s: round(median(all.map((post) => post.hold3s).filter(finite)), 3),
            sharesPer1k: shares.length && viewsWith(shares) > 0 ? round(shares.reduce((sum, post) => sum + post.shares!, 0) / viewsWith(shares) * 1000) : null,
            clicksPer1k: clicks.length && viewsWith(clicks) > 0 ? round(clicks.reduce((sum, post) => sum + post.clicks!, 0) / viewsWith(clicks) * 1000) : null,
            perPlatform,
            best: bestPost ? {views: bestPost.views!, platform: bestPost.platform, url: bestPost.url ?? null, title: bestPost.title ?? null, multiple: round(bestPost.views! / baseline.get(bestPost.platform)!)!} : null
        };
        return {...row, ...verdictFor(row)};
    });
    const order: Record<Verdict, number> = {scale: 0, hold: 1, fix: 2, test: 3, kill: 4};
    formats.sort((a, b) => order[a.verdict] - order[b.verdict] || (b.multiple ?? -1) - (a.multiple ?? -1) || b.items - a.items);
    return {platforms, formats, judgedPosts: judged.length};
}

/**
 * How much more (or less) often the generators should make a format:
 * scale 3× (the playbook's "triple its share"), testing 1.5× until it has its
 * 10 videos, retired 0.15× (still made now and then: a format can come back).
 */
export function formatWeight(verdict: Verdict | undefined) {
    switch (verdict) {
        case "scale": return 3;
        case "test": return 1.5;
        case "kill": return 0.15;
        default: return 1;
    }
}

/**
 * Re-orders the hook lab's ranking of page families by the formats they
 * make: a weighted draw without replacement, the lab's order as the tie
 * break. A family whose format scales is usually first; a retired one is
 * usually last. Pure; `random` is injectable for tests.
 */
export function weightSourceOrder(order: readonly string[], verdicts: Partial<Record<FormatKey, Verdict>>, random: () => number = Math.random): string[] {
    // The lab's own order counts too: earlier families start with a small edge.
    const pool = order.map((type, index) => ({type, weight: formatWeight(SOURCE_FORMAT[type] ? verdicts[SOURCE_FORMAT[type]] : undefined) * (1 + (order.length - index) / (order.length * 4))}));
    const result: string[] = [];
    while (pool.length) {
        const total = pool.reduce((sum, entry) => sum + entry.weight, 0);
        let pick = random() * total;
        let index = pool.findIndex((entry) => (pick -= entry.weight) < 0);
        if (index < 0) index = pool.length - 1;
        result.push(pool[index].type);
        pool.splice(index, 1);
    }
    return result;
}
