import assert from "node:assert/strict";
import test from "node:test";
import {
    answerAskWarmupItem,
    applyWarmupResult,
    askDoneStepIds,
    askEarnedReport,
    askReplySpecials,
    askStepResolution,
    askWarmupAnswers,
    askWarmupChoiceMark,
    askWarmupItem,
    askWarmupItems,
    askWarmupNextIndex
} from "@/lib/ask-animaldex/special-messages";
import {normalizeCompanionEvent, parseCompanionUpdate} from "@/lib/ask-animaldex/companion-loop";
import {
    ASK_STEP_REPORT_THUMB_MAX_LENGTH,
    askStepReportThumb,
    createAskMessage,
    loadAskThreads,
    saveAskThreads,
    type AskWarmupItem
} from "@/lib/ask-animaldex/thread";
import {askConversationHistory} from "@/lib/ask-animaldex/grounding";
import {decodeAnimalStep} from "@/lib/your-step";
import {decodeSpeciesTraining} from "@/lib/species-training";

// docs/your-step/INLINE.md, as iOS AnimalSpecialSections and AnimalWarmupRun
// decide it: which animal messages are special, the step a reply set and
// where it stands, and the Warmup a question at a time in the thread.

const STEP = "5d6e7f80-1a2b-4c3d-8e9f-0a1b2c3d4e5f";
const OTHER_STEP = "6e7f8091-2b3c-4d4e-9f0a-1b2c3d4e5f60";
const SPECIES = "59f1a1a9-cf08-4418-9baf-b20ddd00ceb3";
const THUMB = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDA==";
const TRAINING = "```animaldex-card\n{\"kind\":\"training\"}\n```";
const TRIAL = "```animaldex-card\n{\"kind\":\"trial\",\"frequency\":\"MID\"}\n```";

function memoryStorage() {
    const store = new Map<string, string>();
    return {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => void store.set(key, value),
        removeItem: (key: string) => void store.delete(key)
    };
}

function reply(text: string, overrides: Parameters<typeof createAskMessage>[2] = {}) {
    return createAskMessage("assistant", text, overrides);
}

const context = {
    warmupUnavailable: false,
    warmupStarted: false,
    trialsUnavailable: false,
    debatesOffered: true,
    debateSetupOpenHere: false
};

test("a plain reply is a plain bubble; only a finished animal reply can be special", () => {
    assert.deepEqual(askReplySpecials({...context, message: reply("Hello there.")}), []);
    assert.deepEqual(askReplySpecials({...context, message: reply(TRAINING, {status: "streaming"})}), []);
    const person = createAskMessage("user", "hi", {companionEvent: {stepDone: {step: "Walk", powerEarned: false, xp: 5}}});
    assert.deepEqual(askReplySpecials({...context, message: person}), []);
});

test("done comes first, then the step it set; with a step, its Trials give way to it", () => {
    const message = reply(`Well done. Next, ask first.\n${TRIAL}`, {
        companionEvent: {stepDone: {step: "Walked", powerEarned: true, xp: 5}, stepSet: {id: STEP, step: "Ask first"}}
    });
    assert.deepEqual(askReplySpecials({...context, message}), [
        {kind: "done", xp: 5, step: "Walked", powerEarned: true},
        {kind: "step", stepSet: {id: STEP, step: "Ask first"}}
    ]);
});

test("the Warmup, the Trials and the debate offer come from the reply's cards and the server, and go once used", () => {
    const message = reply(`Try this.\n${TRAINING}\n${TRIAL}`, {companionEvent: {debateOffer: {problem: "My boss", with: []}}});
    assert.deepEqual(askReplySpecials({...context, message}), [
        {kind: "trials"},
        {kind: "warmup"},
        {kind: "debate", problem: "My boss", with: []}
    ]);
    // Taken, unavailable, Debates off, the setup open under it: each goes.
    assert.deepEqual(askReplySpecials({...context, message, warmupStarted: true, trialsUnavailable: true, debateSetupOpenHere: true}), []);
    assert.deepEqual(askReplySpecials({...context, message, warmupUnavailable: true, debatesOffered: false}), [{kind: "trials"}]);
    // Skip, Not now: the offers go; a done step never does.
    const used = {...message, cardsDismissed: true, companionEvent: {...message.companionEvent, stepDone: {step: "Walked", powerEarned: false, xp: 0}}};
    assert.deepEqual(askReplySpecials({...context, message: used}), [{kind: "done", xp: 0, step: "Walked", powerEarned: false}]);
    // A Warmup question is its own special message, never a reply's sections.
    const question = reply("", {warmup: {runId: "r", speciesProfileId: SPECIES, index: 0, total: 2, prompt: "Why?", choices: ["a", "b"]}});
    assert.deepEqual(askReplySpecials({...context, message: question}), []);
});

test("the step a reply set: live with its buttons while open, done once the animal saw it, else closed", () => {
    const open = decodeAnimalStep({id: STEP, step: "Ask first", accepted_at: null})!;
    const anchor = {id: STEP, step: "Ask first"};
    assert.deepEqual(askStepResolution({stepSet: anchor, openStep: open, loaded: true, doneStepIds: new Set()}), {kind: "live", step: open});
    assert.deepEqual(askStepResolution({stepSet: anchor, openStep: null, loaded: true, doneStepIds: new Set([STEP])}), {kind: "done"});
    assert.deepEqual(askStepResolution({stepSet: anchor, openStep: decodeAnimalStep({id: OTHER_STEP, step: "Other"}), loaded: true, doneStepIds: new Set()}), {kind: "closed"});
    assert.deepEqual(askStepResolution({stepSet: anchor, openStep: null, loaded: false, doneStepIds: new Set()}), {kind: "pending"});

    // The done event's step id travels with the reply, through storage too.
    const update = parseCompanionUpdate({trial_done: {id: STEP, step: "Ask first", power_earned: false, xp: 5}});
    assert.equal(update?.event.stepDone?.id, STEP);
    const restored = normalizeCompanionEvent(JSON.parse(JSON.stringify(update?.event)));
    assert.equal(restored?.stepDone?.id, STEP);
    assert.deepEqual(Array.from(askDoneStepIds([reply("ok", {companionEvent: restored ?? undefined}), reply("hi")])), [STEP]);
    // A Trial picked from a reply keeps its frequency on the step it carries.
    const picked = normalizeCompanionEvent({stepSet: {id: STEP, step: "Freeze", trialFrequency: "MID"}});
    assert.equal(picked?.stepSet?.trialFrequency, "MID");
});

test("the Power-earned message quotes the report it answered, with its thumbnail", () => {
    const report = createAskMessage("user", "I asked before I answered.", {stepReportId: STEP, stepReportThumb: THUMB, stepReportKind: "photo"});
    const chat = createAskMessage("user", "Also, hello");
    const earned = reply("That is it.", {companionEvent: {stepDone: {id: STEP, step: "Ask first", powerEarned: true, xp: 5}}});
    assert.equal(askEarnedReport([reply("Hi"), report, chat, earned], earned.id)?.id, report.id);
    // A report on another step is not this one's.
    const elsewhere = createAskMessage("user", "Other", {stepReportId: OTHER_STEP});
    assert.equal(askEarnedReport([elsewhere, earned], earned.id), null);
    assert.equal(askEarnedReport([earned], earned.id), null);
});

test("a report keeps its thumbnail through storage; anything that is not a small image data URL is dropped", () => {
    const storage = memoryStorage();
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

test("the Warmup in the thread: a question at a time, as the animal's messages, never history for the model", () => {
    const training = decodeSpeciesTraining({
        species_profile_id: SPECIES,
        available: true,
        unlocked: true,
        questions: [
            {index: 0, prompt: "What does it do first?", choices: ["Waits", "Runs"]},
            {index: 1, prompt: "Why?", choices: ["To see", "To hide", "To eat"]}
        ]
    })!;
    const offer = reply(`Want a warmup?\n${TRAINING}`);
    const first = askWarmupItem(training, 0, offer.id)!;
    assert.deepEqual(first, {runId: offer.id, speciesProfileId: SPECIES, index: 0, total: 2, prompt: "What does it do first?", choices: ["Waits", "Runs"]});
    assert.equal(askWarmupItem(training, 2, offer.id), null);
    assert.equal(askWarmupChoiceMark(first, 0), "open");

    const answered = answerAskWarmupItem(first, 1);
    assert.equal(answered.chosen, 1);
    // Settled: a second tap changes nothing.
    assert.equal(answerAskWarmupItem(answered, 0), answered);
    assert.equal(askWarmupChoiceMark(answered, 1), "chosen");
    assert.equal(askWarmupChoiceMark(answered, 0), "faded");
    assert.equal(askWarmupNextIndex(answered, [answered]), 1);
    assert.equal(askWarmupAnswers([answered]), null);

    const second = answerAskWarmupItem(askWarmupItem(training, 1, offer.id)!, 2);
    assert.equal(askWarmupNextIndex(second, [answered, second]), null);
    const thread = [offer, reply("", {warmup: answered}), createAskMessage("user", "unrelated"), reply("", {warmup: second})];
    const items = askWarmupItems(thread, offer.id);
    assert.deepEqual(items.map((item) => item.index), [0, 1]);
    assert.deepEqual(askWarmupAnswers(items), [1, 2]);
    // The questions' text is empty: the model never hears them as the animal's words.
    assert.deepEqual(askConversationHistory(thread).map((turn) => turn.content), [offer.text, "unrelated"]);

    // The verdict on each, the pass and its XP on the last; never which answer was right.
    const result = {passed: false, alreadyCompleted: false, correct: [true, false], explanations: [], rewardXP: 0, rewardCredits: 0};
    const checkedFirst = applyWarmupResult(result, answered);
    const checkedLast = applyWarmupResult(result, second);
    assert.equal(checkedFirst.correct, true);
    assert.equal(checkedFirst.passed, undefined);
    assert.equal(checkedLast.correct, false);
    assert.equal(checkedLast.passed, false);
    assert.equal(askWarmupChoiceMark(checkedFirst, 1), "right");
    assert.equal(askWarmupChoiceMark(checkedLast, 2), "wrong");
    const passed = applyWarmupResult({...result, passed: true, correct: [true, true], rewardXP: 5}, second);
    assert.deepEqual([passed.passed, passed.rewardXP], [true, 5]);
    assert.equal(applyWarmupResult({...result, passed: true, correct: [true, true], rewardXP: 5, alreadyCompleted: true}, second).rewardXP, 0);

    // Kept through storage, so the run is still there when the thread is reopened.
    const storage = memoryStorage();
    saveAskThreads(storage, {"capture:c1": [offer, reply("", {warmup: checkedFirst}), reply("", {warmup: checkedLast})]});
    const restored = loadAskThreads(storage)["capture:c1"].map((message) => message.warmup).filter((item): item is AskWarmupItem => Boolean(item));
    assert.deepEqual(restored, [checkedFirst, checkedLast]);
    // A malformed question is dropped, never the thread.
    const broken = loadAskThreads((() => {
        const raw = memoryStorage();
        saveAskThreads(raw, {"capture:c2": [offer, reply("x", {warmup: {...first, choices: ["only one"]}})]});
        return raw;
    })())["capture:c2"];
    assert.equal(broken.length, 2);
    assert.equal(broken[1].warmup, undefined);
});
