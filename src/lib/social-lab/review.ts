import {type Intent, INTENTS} from "@/lib/social-lab/arms";
import type {VideoPlan, VideoSource} from "@/lib/content-video/plan";

// The pre-flight check, pure: before a video's clips are paid for, a second
// model reads the script cold, as someone scrolling would meet it, and answers
// the questions that decide whether a feed pushes it. Does a 5-year-old get it
// in 3 seconds? Would people share it, save it, comment, watch to the end? A
// script that fails its job is rewritten once with the reviewer's fixes
// (llm.ts). The scores are kept on the plan so they can be checked against
// what the post actually did.

export const REACTIONS = ["share", "save", "comment", "stay"] as const satisfies readonly Intent[];

/** A job score at least this high (out of 10) passes. */
export const PASS_SCORE = 7;

export type ReactionScore = {score: number; reason: string};

export type VideoReview = {
    fiveYearOld: {passes: boolean; wouldSay: string; hardWords: string[]};
    scores: Record<Intent, ReactionScore>;
    fixes: string[];
    /** The reaction the video was built for; null for a video without an intent. */
    job: Intent | null;
    passes: boolean;
    /** True when the first draft failed and this is the rewrite's review. */
    rewritten?: boolean;
    /** The first draft's result, when it was rewritten. */
    firstDraft?: {passes: boolean; jobScore: number; fiveYearOld: boolean};
};

export const REVIEW_SYSTEM_PROMPT = `You are the toughest test audience for AnimalDex's short animal videos (TikTok, YouTube Shorts, Reels). You read a script cold, the way someone scrolling meets it, and judge it honestly. Most scripts are average: score 4–6 unless you can name exactly why a viewer would act.

1. THE 5-YEAR-OLD TEST. The first 3 seconds are the on-screen hook text, the first spoken line and what the first shot shows. After those 3 seconds, could a 5-year-old say what the video is about: which animal, and what is surprising about it? Write what they would say (would_say). It FAILS for: a word a 5-year-old does not know (list each in hard_words; an animal's common name is fine), wordplay or a metaphor to decode, a hook that only makes sense after the title, an animal that is not named or clearly shown, or more than one idea.

2. For each reaction, a score from 1 to 10 and the concrete reason:
- share: would a viewer send this to one specific friend? Name who and the message they would send with it.
- save: would they save it to come back to? Name what they would use it for.
- comment: would they feel they have to comment? Write the comment they would type.
- stay: would they watch to the very end? Name what stops them scrolling, and the moment they would most likely leave.
Score 8 or more only when you can name it concretely. Generic praise is a 5.

3. fixes: up to 4 specific rewrites that would most raise the JOB's score and make the script pass the 5-year-old test. Quote the line and give the replacement. Keep every fact true to the script; never invent facts.

Return only the JSON object.`;

const reactionSchema = {type: "object", additionalProperties: false, required: ["score", "reason"], properties: {score: {type: "integer"}, reason: {type: "string"}}} as const;

export const REVIEW_JSON_SCHEMA = {
    type: "object",
    additionalProperties: false,
    required: ["five_year_old", "scores", "fixes"],
    properties: {
        five_year_old: {
            type: "object",
            additionalProperties: false,
            required: ["passes", "would_say", "hard_words"],
            properties: {passes: {type: "boolean"}, would_say: {type: "string"}, hard_words: {type: "array", items: {type: "string"}}}
        },
        scores: {type: "object", additionalProperties: false, required: [...REACTIONS], properties: Object.fromEntries(REACTIONS.map((reaction) => [reaction, reactionSchema]))},
        fixes: {type: "array", items: {type: "string"}}
    }
} as const;

/** About how fast the voice speaks, for the timings the reviewer sees. */
const WORDS_PER_SECOND = 2.7;

/** The script as a viewer meets it: what is on screen and what is said, second by second. */
export function scriptForReview(plan: VideoPlan, source: Pick<VideoSource, "title" | "images">, job: Intent | null) {
    const alt = (index: number) => source.images.find((image) => image.index === index)?.alt || "a photo";
    let clock = 0;
    const lines = plan.scenes.map((scene, index) => {
        const seconds = Math.max(scene.minSeconds ?? 0, scene.clipSeconds && scene.visual === "ai_clip" ? Math.min(scene.clipSeconds, 5) : 0, scene.narration.split(/\s+/).filter(Boolean).length / WORDS_PER_SECOND, 1.5);
        const shows = scene.visual === "card"
            ? scene.card?.kind === "vs" ? `a VS card: ${scene.card.left.name} vs ${scene.card.right.name}` : scene.card?.kind === "pair" ? `the two parents side by side: ${scene.card.left.name} + ${scene.card.right.name}` : "a designed card"
            : scene.keyframePrompt ? `an AI shot: ${scene.keyframePrompt.slice(0, 160)}` : `${scene.visual === "ai_clip" ? "the photo, moving: " : ""}${alt(scene.image)}`;
        const line = `${index + 1}. [${clock.toFixed(1)}–${(clock + seconds).toFixed(1)} s] shows: ${shows}${scene.overlay ? ` | on screen: "${scene.overlay}"` : ""} | says: "${scene.narration}"`;
        clock += seconds;
        return line;
    });
    const end = plan.ending === "loop" ? "No end card: the last line loops back to the first." : `End card: says "${plan.ctaNarration}" | shows "${plan.ctaText}"`;
    return [
        `Video about: ${source.title}`,
        job ? `Its JOB: ${INTENTS[job].label}. ${INTENTS[job].question}` : "Its job: not set; judge all four reactions.",
        "",
        `On-screen hook text over the first seconds: "${plan.hookText}"`,
        "",
        "Scenes:",
        ...lines,
        end
    ].join("\n");
}

function clampScore(value: unknown) {
    const number = Math.round(Number(value));
    return Number.isFinite(number) ? Math.min(10, Math.max(1, number)) : 1;
}

/** Holds the reviewer's reply to the shape; null when it is unusable. */
export function normalizeReview(value: unknown, job: Intent | null): VideoReview | null {
    const record = value as Record<string, any> | null;
    if (!record || typeof record !== "object" || !record.five_year_old || !record.scores) return null;
    const scores = Object.fromEntries(REACTIONS.map((reaction) => {
        const entry = record.scores[reaction] ?? {};
        return [reaction, {score: clampScore(entry.score), reason: typeof entry.reason === "string" ? entry.reason.trim().slice(0, 400) : ""}];
    })) as Record<Intent, ReactionScore>;
    const fiveYearOld = {
        passes: record.five_year_old.passes === true,
        wouldSay: typeof record.five_year_old.would_say === "string" ? record.five_year_old.would_say.trim().slice(0, 300) : "",
        hardWords: Array.isArray(record.five_year_old.hard_words) ? record.five_year_old.hard_words.filter((word: unknown): word is string => typeof word === "string").slice(0, 12) : []
    };
    const fixes = Array.isArray(record.fixes) ? record.fixes.filter((fix: unknown): fix is string => typeof fix === "string" && fix.trim().length > 0).map((fix: string) => fix.trim().slice(0, 500)).slice(0, 4) : [];
    return {fiveYearOld, scores, fixes, job, passes: fiveYearOld.passes && jobScore({scores, job}) >= PASS_SCORE};
}

/** The job's score; for a video without a job, its best reaction's. */
export function jobScore(review: Pick<VideoReview, "scores" | "job">) {
    return review.job ? review.scores[review.job].score : Math.max(...REACTIONS.map((reaction) => review.scores[reaction].score));
}

/** Of two reviews, the better script: passing first, then the job score, then the 5-year-old test. */
export function betterReview(a: VideoReview, b: VideoReview) {
    if (a.passes !== b.passes) return a.passes ? a : b;
    if (jobScore(a) !== jobScore(b)) return jobScore(a) > jobScore(b) ? a : b;
    if (a.fiveYearOld.passes !== b.fiveYearOld.passes) return a.fiveYearOld.passes ? a : b;
    return a;
}

/** The note the writer gets when its first draft failed. */
export function rewriteBrief(review: VideoReview) {
    const failed = [
        review.fiveYearOld.passes ? null : `It FAILS the 5-year-old test: after 3 seconds a 5-year-old would say "${review.fiveYearOld.wouldSay}".${review.fiveYearOld.hardWords.length ? ` Words they do not know: ${review.fiveYearOld.hardWords.join(", ")}.` : ""}`,
        review.job && review.scores[review.job].score < PASS_SCORE ? `Its job (${INTENTS[review.job].label}) scores ${review.scores[review.job].score}/10: ${review.scores[review.job].reason}` : null
    ].filter(Boolean);
    return [
        "A TEST AUDIENCE REJECTED YOUR FIRST DRAFT. Write a new one that fixes this; keep the facts true to the source.",
        ...failed.map((line) => `- ${line}`),
        ...(review.fixes.length ? ["Their fixes:", ...review.fixes.map((fix) => `- ${fix}`)] : [])
    ].join("\n");
}
