import assert from "node:assert/strict";
import test from "node:test";
import {
    answerWarmupRun,
    askEarnedQuote,
    askReplySpecials,
    failWarmupRun,
    finishWarmupRun,
    retryWarmupRun,
    startWarmupRun,
    warmupRunActive,
    warmupRunShownCount,
    warmupRunSubmission
} from "@/lib/ask-animaldex/special-messages";
import {createAskMessage, loadAskThreads, saveAskThreads, askStepReportThumb, ASK_STEP_REPORT_THUMB_MAX_LENGTH} from "@/lib/ask-animaldex/thread";

// docs/your-step/INLINE.md: which animal messages are special, and the
// Warmup a question at a time in the thread.

const STEP = "5d6e7f80-1a2b-4c3d-8e9f-0a1b2c3d4e5f";
const THUMB = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDA==";

function reply(text: string, overrides: Parameters<typeof createAskMessage>[2] = {}) {
    return createAskMessage("assistant", text, overrides);
}

const base = {stepCardMessageId: null, warmupAvailable: true, debatesOffered: true};

test("a plain reply is a plain bubble; only a finished animal reply can be special", () => {
    assert.deepEqual(askReplySpecials({...base, message: reply("Hello there.")}), []);
    const streaming = reply("```animaldex-card\n{\"kind\":\"training\"}\n```", {status: "streaming"});
    assert.deepEqual(askReplySpecials({...base, message: streaming}), []);
    const person = createAskMessage("user", "hi", {companionEvent: {stepDone: {step: "Walk", powerEarned: false, xp: 5}}});
    assert.deepEqual(askReplySpecials({...base, message: person}), []);
});

test("done comes first, then the step it set, from server state rather than its words", () => {
    const message = reply("Well done. Next, try asking first.", {
        companionEvent: {stepDone: {step: "Walked", powerEarned: true, xp: 5}, stepSet: {id: STEP, step: "Ask first"}}
    });
    assert.deepEqual(askReplySpecials({...base, message, stepCardMessageId: message.id}), [
        {kind: "done", xp: 5, step: "Walked", powerEarned: true},
        {kind: "step"}
    ]);
    // The step is no longer the open one: that reply keeps only its done.
    assert.deepEqual(askReplySpecials({...base, message, stepCardMessageId: "another"}), [
        {kind: "done", xp: 5, step: "Walked", powerEarned: true}
    ]);
});

test("the Warmup, the Trials and the debate offer come from the reply's cards and the server, and go once used", () => {
    const text = "Try this.\n```animaldex-card\n{\"kind\":\"training\"}\n```\n```animaldex-card\n{\"kind\":\"trial\",\"frequency\":\"MID\"}\n```";
    const message = reply(text, {companionEvent: {debateOffer: {problem: "My boss", with: []}}});
    assert.deepEqual(askReplySpecials({...base, message}), [
        {kind: "warmup"},
        {kind: "trials", frequency: "MID"},
        {kind: "debate", problem: "My boss", with: []}
    ]);
    // No Warmup for this animal, Debates off: neither shows.
    assert.deepEqual(askReplySpecials({...base, message, warmupAvailable: false, debatesOffered: false}), [
        {kind: "trials", frequency: "MID"}
    ]);
    // Skipped or used: the offers go, a done step stays.
    const used = {...message, cardsDismissed: true, companionEvent: {...message.companionEvent, stepDone: {step: "Walked", powerEarned: false, xp: 0}}};
    assert.deepEqual(askReplySpecials({...base, message: used}), [{kind: "done", xp: 0, step: "Walked", powerEarned: false}]);
});

test("the Power-earned message quotes the message it answered, with the report's thumbnail", () => {
    const report = createAskMessage("user", "I asked before I answered.", {stepReportId: STEP, stepReportThumb: THUMB, stepReportKind: "photo"});
    const earned = reply("That is it.", {companionEvent: {stepDone: {step: "Ask first", powerEarned: true, xp: 5}}});
    const thread = [reply("Hi"), report, earned];
    assert.deepEqual(askEarnedQuote(thread, earned.id), {text: "I asked before I answered.", thumb: THUMB, kind: "photo"});
    assert.equal(askEarnedQuote([earned], earned.id), null);
    const said = createAskMessage("user", "Done it, no photo");
    assert.deepEqual(askEarnedQuote([said, earned], earned.id), {text: "Done it, no photo", thumb: null, kind: null});
});

test("a report keeps its thumbnail through storage; anything that is not a small image data URL is dropped", () => {
    const store = new Map<string, string>();
    const storage = {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => void store.set(key, value),
        removeItem: (key: string) => void store.delete(key)
    };
    const report = createAskMessage("user", "I did it", {stepReportId: STEP, stepReportThumb: THUMB, stepReportKind: "video"});
    assert.equal(report.stepReportKind, "video");
    // A thumbnail only travels on a report.
    assert.equal(createAskMessage("user", "hi", {stepReportThumb: THUMB}).stepReportThumb, undefined);
    saveAskThreads(storage, {"capture:c1": [report, reply("Tell me more.")]});
    const restored = loadAskThreads(storage)["capture:c1"][0];
    assert.equal(restored.stepReportThumb, THUMB);
    assert.equal(restored.stepReportKind, "video");

    assert.equal(askStepReportThumb(THUMB), THUMB);
    assert.equal(askStepReportThumb("https://example.com/a.jpg"), null);
    assert.equal(askStepReportThumb("data:image/svg+xml;base64,PHN2Zz4="), null);
    assert.equal(askStepReportThumb(`data:image/jpeg;base64,${"A".repeat(ASK_STEP_REPORT_THUMB_MAX_LENGTH)}`), null);
    assert.equal(askStepReportThumb("data:image/jpeg;base64,abc\"><script>"), null);
});

test("the Warmup in the thread: a question at a time, the last answer sends them", () => {
    let run = startWarmupRun({id: "w1", questionCount: 3, afterMessageId: "m9", offerMessageId: "m4"});
    assert.equal(warmupRunActive(run), true);
    assert.equal(warmupRunShownCount(run), 1);
    assert.equal(warmupRunSubmission(run), null);

    run = answerWarmupRun(run, 0, 2);
    assert.equal(warmupRunShownCount(run), 2);
    // A settled question, or one not asked yet, does not change.
    assert.equal(answerWarmupRun(run, 0, 1), run);
    assert.equal(answerWarmupRun(run, 2, 1), run);

    run = answerWarmupRun(run, 1, 0);
    assert.equal(run.phase, "answering");
    run = answerWarmupRun(run, 2, 1);
    assert.equal(run.phase, "submitting");
    assert.equal(warmupRunShownCount(run), 3);
    assert.deepEqual(warmupRunSubmission(run), [2, 0, 1]);
    assert.equal(answerWarmupRun(run, 2, 0), run);

    // The answers never reached the grader: the same ones go again.
    const failed = failWarmupRun(run);
    assert.equal(failed.phase, "error");
    assert.equal(warmupRunActive(failed), true);
    assert.equal(retryWarmupRun(failed).phase, "submitting");
    assert.deepEqual(warmupRunSubmission(retryWarmupRun(failed)), [2, 0, 1]);

    const done = finishWarmupRun(run, {passed: false, alreadyCompleted: false, correct: [true, false, true], explanations: [], rewardXP: 0, rewardCredits: 0});
    assert.equal(done.phase, "result");
    assert.equal(warmupRunActive(done), false);
    assert.equal(failWarmupRun(done), done);
});
