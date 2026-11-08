import assert from "node:assert/strict";
import test from "node:test";
import {contentVideoIdFromPath, fixPlan, isSilentPlan, videoProblems, withCurrentVideoPaths, type FixableVideo} from "./content-video/fix";
import type {VideoPlan} from "./content-video/plan";

const ID = "23791d51-f84b-4600-9f30-a567cb6590c5";

function plan(overrides: Partial<VideoPlan> = {}): VideoPlan {
    return {
        title: "t",
        hookText: "h",
        scenes: [
            {narration: "one", image: 0, focusX: 0.5, visual: "ai_clip", motionPrompt: "m"},
            {narration: "two", image: 0, focusX: 0.5, visual: "ai_clip", motionPrompt: "m", clipSeconds: 6},
            {narration: "three", image: 0, focusX: 0.5, visual: "image"}
        ],
        ctaNarration: "c",
        ctaText: "c",
        ...overrides
    } as VideoPlan;
}

function video(overrides: Partial<FixableVideo> = {}): FixableVideo {
    return {status: "ready", plan: plan(), clips: [], tts_provider: "google", video_path: `blog/x/${ID}-abc.mp4`, poster_path: `blog/x/${ID}-abc.jpg`, ...overrides};
}

test("a page video's id comes out of any of its cuts' paths, and nothing else's", () => {
    assert.equal(contentVideoIdFromPath(`blog/how-fast-is-a-peregrine-falcon/${ID}-mw6ajqkb.mp4`), ID);
    assert.equal(contentVideoIdFromPath("carousel:abc"), null);
    assert.equal(contentVideoIdFromPath("stories/abc.mp4"), null);
});

test("posts of an earlier cut count against the current file, keeping the posted path", () => {
    const posts = [{media_path: `blog/x/${ID}-old.mp4`}, {media_path: "carousel:1"}];
    const result = withCurrentVideoPaths(posts, [{id: ID, video_path: `blog/x/${ID}-new.mp4`}]);
    assert.equal(result[0].media_path, `blog/x/${ID}-new.mp4`);
    assert.equal(result[0].postedPath, `blog/x/${ID}-old.mp4`);
    assert.equal(result[1].media_path, "carousel:1");
});

test("a healthy video has nothing to fix; an unknown poster (not sent) is not a missing file", () => {
    assert.deepEqual(videoProblems(video()), []);
    assert.deepEqual(videoProblems(video({poster_path: undefined})), []);
    assert.equal(fixPlan(video(), [], new Date(), "rendering"), null);
});

test("a no-voice video gets its voice back for free: re-edit only, the lab's arm kept", () => {
    const silent = video({tts_provider: "none", plan: plan({experiment: {version: 1, voice: "no_voice"} as never})});
    const problems = videoProblems(silent);
    assert.deepEqual(problems.map((problem) => problem.code), ["no_voice"]);
    const now = new Date("2026-11-09T06:00:00Z");
    const fixed = fixPlan(silent, problems, now, "rendering")!;
    assert.equal(fixed.status, "rendering");
    assert.equal(fixed.usd, 0);
    assert.equal(fixed.plan!.voiceRestoredAt, now.toISOString());
    assert.equal(fixed.plan!.experiment!.voice, "no_voice");
    assert.equal(isSilentPlan(fixed.plan), false);
    // Once fixed, the same row no longer reads as silent (its next render records google).
    assert.deepEqual(videoProblems({...silent, plan: fixed.plan, tts_provider: "google"}), []);
});

test("failed AI shots are made again, except a wrong animal or the per-video cap; the cost is quoted", () => {
    const clips = [
        {scene: 0, status: "failed" as const, idempotencyKey: "a", usd: 0.2, error: "Timed out waiting for Higgsfield"},
        {scene: 1, status: "failed" as const, idempotencyKey: "b", usd: 0, error: "The drawn frame showed a dog, not a cat"}
    ];
    const problems = videoProblems(video({clips}));
    assert.equal(problems.length, 1);
    assert.equal(problems[0].code, "missing_shots");
    const fixed = fixPlan(video({clips}), problems, new Date(), "rendering")!;
    assert.equal(fixed.status, "generating");
    assert.deepEqual(fixed.clips.map((clip) => clip.scene), [1]);
    assert.equal(fixed.usd, 0.21);
    const capped = [{...clips[0], error: "Over the $1.5 per-video cap"}];
    assert.deepEqual(videoProblems(video({clips: capped})), []);
});

test("a missing file is re-edited; a failed or stopped video resumes; a running one is left alone", () => {
    assert.deepEqual(videoProblems(video(), {fileMissing: true}).map((problem) => problem.code), ["missing_file"]);
    assert.equal(fixPlan(video(), videoProblems(video(), {fileMissing: true}), new Date(), "rendering")!.status, "rendering");
    const failed = video({status: "failed"});
    assert.equal(fixPlan(failed, videoProblems(failed), new Date(), "rendering")!.status, "rendering");
    const stopped = video({status: "generating"});
    assert.equal(videoProblems(stopped)[0].code, "interrupted");
    assert.deepEqual(videoProblems({...stopped, running: true}), []);
});

test("a video made outside the video maker says so and is not touched", () => {
    const outside = video({plan: null, tts_provider: null});
    const problems = videoProblems(outside);
    assert.deepEqual(problems.map((problem) => problem.code), ["not_editable"]);
    assert.equal(fixPlan(outside, problems, new Date(), "rendering"), null);
});
