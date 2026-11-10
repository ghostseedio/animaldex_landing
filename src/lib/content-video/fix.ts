import {isRecordedSourceType, type VideoPlan} from "@/lib/content-video/plan";
import type {ContentVideoClip, ContentVideoStatus} from "@/lib/content-video/store";

// The "Fix" button on /admin/story-videos: what is wrong with a page video,
// read from its row, and how the video maker repairs it. Pure and
// client-safe (types only), so the card can show the problems before anyone
// clicks, and the server applies the same plan.
//
// Every repair goes back through the normal runner (runner.ts), which keeps
// the script and every clip already paid for; only a retried AI shot spends.

/** A rendered file is `blog/<slug>/<video id>-<stamp>.mp4`; each re-render gets a new stamp. */
const VIDEO_PATH = /^blog\/[^/]+\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})-[a-z0-9]+\.mp4$/;

/** The page video a share-log media path belongs to, whichever cut of it was posted. Pure. */
export function contentVideoIdFromPath(mediaPath: string) {
    return VIDEO_PATH.exec(mediaPath)?.[1] ?? null;
}

/**
 * Share-log rows with each page video's older cuts pointed at its current
 * file, so a re-edited or fixed video keeps its history: auto-share does not
 * post it again where the earlier cut went, and the hook lab keeps its
 * numbers. `postedPath` keeps the file that actually went out. Pure.
 */
export function withCurrentVideoPaths<T extends {media_path: string}>(posts: T[], videos: ReadonlyArray<{id: string; video_path: string | null}>): Array<T & {postedPath: string}> {
    const current = new Map(videos.filter((video) => video.video_path).map((video) => [video.id, video.video_path!]));
    return posts.map((post) => {
        const id = contentVideoIdFromPath(post.media_path);
        const path = id ? current.get(id) : undefined;
        return {...post, media_path: path ?? post.media_path, postedPath: post.media_path};
    });
}

export type FixableVideo = {
    /** A recorded clip (an Ark clip) is never fixed here: it has no script, voice or AI shots to redo. */
    source_type?: string;
    status: ContentVideoStatus;
    plan: VideoPlan | null;
    clips: ContentVideoClip[];
    tts_provider: string | null;
    video_path: string | null;
    poster_path?: string | null;
    running?: boolean;
};

export type VideoProblem =
    | {code: "failed"; label: string}
    | {code: "interrupted"; label: string}
    | {code: "no_voice"; label: string}
    | {code: "missing_shots"; label: string; scenes: number[]; usd: number}
    | {code: "missing_file"; label: string}
    | {code: "not_editable"; label: string};

/** Higgsfield's floor price per clip-second (runner.ts): the most a retried shot is assumed to cost. */
const USD_PER_CLIP_SECOND = 0.042;
const DEFAULT_CLIP_SECONDS = 5;

/** A plan made silent by the hook lab's no-voice arm, and not given its voice back since. */
export function isSilentPlan(plan: VideoPlan | null | undefined) {
    return plan?.experiment?.voice === "no_voice" && !plan.voiceRestoredAt;
}

/** A failed AI shot worth asking for again: not a wrong-animal verdict and not the per-video cap (both would fail the same way). */
function retryable(clip: ContentVideoClip) {
    if (clip.status !== "failed") return false;
    const error = clip.error ?? "";
    return !/showed|wrong animal|per-video cap/i.test(error);
}

/** The AI-clip scenes whose shot failed and could be made again, with what that may cost. */
function missingShots(video: FixableVideo) {
    const plan = video.plan;
    if (!plan) return {scenes: [] as number[], usd: 0};
    const scenes: number[] = [];
    let usd = 0;
    plan.scenes.forEach((scene, index) => {
        if (scene.visual !== "ai_clip" || scene.footage) return;
        const clip = video.clips.find((candidate) => candidate.scene === index);
        if (!clip || !retryable(clip)) return;
        scenes.push(index);
        usd += (scene.clipSeconds ?? DEFAULT_CLIP_SECONDS) * USD_PER_CLIP_SECOND;
    });
    return {scenes, usd: Number(usd.toFixed(2))};
}

/**
 * What is wrong with a page video. `fileMissing` is the server's check that
 * the finished file is really in the bucket (the card does not know). Pure.
 */
export function videoProblems(video: FixableVideo, {fileMissing = false}: {fileMissing?: boolean} = {}): VideoProblem[] {
    if (video.running) return [];
    if (isRecordedSourceType(video.source_type)) return [{code: "not_editable", label: "Recorded by the Ark clip recorder: record it again (scripts/ark-clips.mts) instead of fixing it here"}];
    const inProgress = video.status !== "ready" && video.status !== "failed";
    if (video.status === "failed") return [{code: "failed", label: "Stopped with an error"}];
    if (inProgress) return [{code: "interrupted", label: "Stopped part-way (the server restarted)"}];
    if (!video.plan) return [{code: "not_editable", label: "Made outside the video maker, so it can't be re-edited here"}];

    const problems: VideoProblem[] = [];
    if (video.tts_provider === "none" || isSilentPlan(video.plan)) problems.push({code: "no_voice", label: "No voiceover"});
    const shots = missingShots(video);
    if (shots.scenes.length) {
        problems.push({code: "missing_shots", label: `${shots.scenes.length} AI shot${shots.scenes.length === 1 ? "" : "s"} failed and became a still`, scenes: shots.scenes, usd: shots.usd});
    }
    if (!video.video_path || video.poster_path === null || fileMissing) problems.push({code: "missing_file", label: "The video file is missing"});
    return problems;
}

export type FixPlan = {
    /** Where the runner starts: "generating" when shots are retried, else straight to the edit. */
    status: ContentVideoStatus;
    plan: VideoPlan | null;
    clips: ContentVideoClip[];
    fixing: string[];
    usd: number;
};

/**
 * How to repair `problems`: the voice comes back (the lab's record of the
 * silent cut stays honest through `voiceRestoredAt`), failed shots are asked
 * for again, and the video is edited anew from its script and clips. Null
 * when nothing here can be fixed. `resumeAt` is where an interrupted or
 * failed video picks up (runner.ts resumeStatus). Pure.
 */
export function fixPlan(video: FixableVideo, problems: VideoProblem[], now: Date, resumeAt: ContentVideoStatus): FixPlan | null {
    const fixable = problems.filter((problem) => problem.code !== "not_editable");
    if (!fixable.length) return null;
    if (fixable.some((problem) => problem.code === "failed" || problem.code === "interrupted")) {
        // A failed video is retried from its last good step; its failed shots with it.
        const shots = missingShots(video);
        const clips = video.clips.filter((clip) => !shots.scenes.includes(clip.scene));
        return {status: shots.scenes.length && video.plan ? "generating" : resumeAt, plan: video.plan, clips, fixing: fixable.map((problem) => problem.label), usd: shots.usd};
    }
    let plan = video.plan!;
    let clips = video.clips;
    let status: ContentVideoStatus = "rendering";
    let usd = 0;
    for (const problem of fixable) {
        if (problem.code === "no_voice") plan = {...plan, voiceRestoredAt: now.toISOString()};
        if (problem.code === "missing_shots") {
            clips = clips.filter((clip) => !problem.scenes.includes(clip.scene));
            status = "generating";
            usd = problem.usd;
        }
    }
    return {status, plan, clips, fixing: fixable.map((problem) => problem.label), usd};
}
