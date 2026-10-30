import assert from "node:assert/strict";
import test from "node:test";
import {
    MAX_STEP_MEDIA_PATHS,
    STEP_VIDEO_FRAMES,
    acceptingStep,
    cleanStepReport,
    decodeAnimalStep,
    decodeOpenSteps,
    decodeStepRecords,
    decodeStepResult,
    isAcceptedStepMedia,
    isOwnStepMediaPath,
    isStepVideoFile,
    reportingStep,
    resolveStepReport,
    stepCardState,
    stepMediaExtension,
    stepMediaKind,
    stepMediaPath,
    stepProblemCode,
    stepRecordThumbnail,
    stepReportReady
} from "@/lib/your-step";

const STEP = "5d6e7f80-1a2b-4c3d-8e9f-0a1b2c3d4e5f";
const SPECIES = "0f2c1e5a-3b4d-4e6f-8a9b-1c2d3e4f5a6b";
const CAPTURE = "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d";
const USER = "9e8d7c6b-5a49-4382-9170-6f5e4d3c2b1a";

test("the step object decodes from every place it arrives, and nothing without an id", () => {
    assert.deepEqual(decodeAnimalStep({id: STEP.toUpperCase(), step: "  Walk the long way  ", set_at: "2026-10-31", accepted_at: null, trial_frequency: "low", has_report: false}), {
        id: STEP,
        step: "Walk the long way",
        setAt: "2026-10-31",
        acceptedAt: null,
        trialFrequency: "LOW",
        hasReport: false
    });
    assert.equal(decodeAnimalStep({id: "t", step: "Walk"}), null);
    assert.equal(decodeAnimalStep({id: STEP, step: "  "}), null);
    assert.equal(decodeAnimalStep(null), null);
    assert.equal(decodeAnimalStep({id: STEP, step: "Walk", trial_frequency: "SOMETIMES"})?.trialFrequency, null);
    // accept answers {step}; set from Trial answers the step object itself; jsonb may arrive as text.
    assert.equal(decodeStepResult({step: {id: STEP, step: "Walk"}})?.id, STEP);
    assert.equal(decodeStepResult({id: STEP, step: "Freeze, then move", trial_frequency: "HIGH"})?.trialFrequency, "HIGH");
    assert.equal(decodeStepResult(JSON.stringify({step: {id: STEP, step: "Walk"}}))?.step, "Walk");
    assert.equal(decodeStepResult({ok: true}), null);
});

test("the card's state follows the step: offered, accepted, then reported back", () => {
    const offered = decodeAnimalStep({id: STEP, step: "Walk"})!;
    assert.equal(stepCardState(offered), "offered");
    const accepted = acceptingStep(offered, new Date("2026-10-31T09:00:00Z"));
    assert.equal(accepted.acceptedAt, "2026-10-31T09:00:00.000Z");
    assert.equal(stepCardState(accepted), "accepted");
    // Accepting twice keeps the first moment.
    assert.equal(acceptingStep(accepted).acceptedAt, accepted.acceptedAt);
    const reported = reportingStep(offered);
    assert.equal(stepCardState(reported), "reported");
    assert.ok(reported.acceptedAt);
});

test("a report needs three characters of their own words, folded and capped", () => {
    assert.equal(stepReportReady("ok"), false);
    assert.equal(stepReportReady("  did  "), true);
    assert.equal(cleanStepReport(" I   walked\n\nthe long way "), "I walked the long way");
    assert.equal(cleanStepReport("x".repeat(2000)).length, 1500);
});

test("media goes to the reader's own steps folder in journal-proofs, and nothing outside it is theirs", () => {
    assert.equal(stepMediaPath(USER.toUpperCase(), SPECIES.toUpperCase(), STEP, ".JPG"), `${USER}/steps/${SPECIES}/${STEP}.jpg`);
    assert.equal(isOwnStepMediaPath(USER, `${USER}/steps/${SPECIES}/${STEP}.jpg`), true);
    assert.equal(isOwnStepMediaPath(USER, `${USER}/animal-trials/${SPECIES}-low/clip.mp4`), false);
    assert.equal(isOwnStepMediaPath(USER, `${CAPTURE}/steps/${SPECIES}/${STEP}.jpg`), false);
    assert.equal(isOwnStepMediaPath(USER, `${USER}/steps/../../other/x.jpg`), false);
    assert.equal(stepMediaExtension({type: "image/heic", name: "IMG_1.HEIC"}), "jpg");
    assert.equal(stepMediaExtension({type: "image/png"}), "png");
    assert.equal(stepMediaExtension({type: "video/quicktime", name: "clip.MOV"}), "mov");
    assert.equal(stepMediaExtension({type: "", name: "clip.webm"}), "webm");
    assert.equal(isStepVideoFile({type: "video/mp4"}), true);
    assert.equal(isStepVideoFile({type: "image/jpeg"}), false);
    assert.equal(stepMediaKind(`${USER}/steps/${SPECIES}/${STEP}.mp4`), "video");
    assert.equal(stepMediaKind(`${USER}/steps/${SPECIES}/${STEP}.jpg`), "photo");
    // A video's clip plus its frames fit the server's four paths.
    assert.ok(1 + STEP_VIDEO_FRAMES <= MAX_STEP_MEDIA_PATHS);
});

test("open steps and records decode in the server's order, skipping rows they cannot use", () => {
    const open = decodeOpenSteps([
        {id: STEP, species_profile_id: SPECIES, capture_id: CAPTURE, animal: "African Lion", nickname: "Leo", step: "Say it first", trial_frequency: null, accepted_at: "2026-10-31T08:00:00Z", set_at: "2026-10-30", slug: "african-lion"},
        {id: STEP, species_profile_id: "nope", animal: "X", step: "Y"},
        {species_profile_id: SPECIES, step: "No id"}
    ]);
    assert.equal(open.length, 1);
    assert.equal(open[0].captureId, CAPTURE);
    assert.equal(open[0].nickname, "Leo");
    assert.equal(open[0].acceptedAt, "2026-10-31T08:00:00Z");
    assert.deepEqual(decodeOpenSteps("oops"), []);

    const records = decodeStepRecords(JSON.stringify([
        {id: STEP, step: "Said it first", trial_frequency: "MID", account: "I went first and it was fine", evidence: "They spoke first", media_paths: ["a.jpg", "", "b.mp4", "c.jpg", "d.jpg", "e.jpg"], done_at: "2026-10-31T10:00:00Z", xp_awarded: 5},
        {id: "x", step: "No id"}
    ]));
    assert.equal(records.length, 1);
    assert.deepEqual(records[0].mediaPaths, ["a.jpg", "b.mp4", "c.jpg", "d.jpg"]);
    assert.equal(records[0].trialFrequency, "MID");
    assert.equal(records[0].xpAwarded, 5);
    assert.equal(stepRecordThumbnail([{path: "b.mp4", url: "u1", kind: "video"}, {path: "c.jpg", url: "u2", kind: "photo"}])?.url, "u2");
    assert.equal(stepRecordThumbnail([]), null);
});

test("a chat request's step_report is a uuid or nothing", () => {
    assert.deepEqual(resolveStepReport({step_id: STEP.toUpperCase()}), {stepId: STEP});
    assert.equal(resolveStepReport({step_id: "1; drop table"}), null);
    assert.equal(resolveStepReport("oops"), null);
    assert.equal(resolveStepReport(undefined), null);
});

test("an RPC refusal is its code (SERVER.md), and anything else is unavailable", () => {
    assert.equal(stepProblemCode("step_not_open"), "step_not_open");
    assert.equal(stepProblemCode('{"code":"P0001","message":"species_not_unlocked"}'), "species_not_unlocked");
    assert.equal(stepProblemCode("ERROR: media_path_not_owned"), "media_path_not_owned");
    assert.equal(stepProblemCode("connection reset"), "step_unavailable");
    assert.equal(stepProblemCode(undefined), "step_unavailable");
});

test("the bucket takes JPEG, PNG and WebP photos and MP4, MOV and WebM videos as they are; HEIC is redrawn first", () => {
    for (const type of ["image/jpeg", "image/png", "image/webp", "video/mp4", "video/quicktime", "video/webm"]) {
        assert.equal(isAcceptedStepMedia({type}), true, type);
    }
    for (const type of ["image/heic", "image/gif", "video/x-matroska", ""]) assert.equal(isAcceptedStepMedia({type}), false, type);
});
