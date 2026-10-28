import assert from "node:assert/strict";
import test from "node:test";

// The web copy of the apps' supabase/functions/_shared/animal-focus.test.ts:
// the same lines, the same rosters, held to the same answers.
import {
    bondForClient,
    companionDoneFields,
    companionLoopRules,
    companionPromptLines,
    extractCompanionLines,
    parseCompanionRoster,
    parseCompanionState,
    resolveReferral
} from "@/lib/ask-animaldex/companion-focus";
import {ASK_FOLLOW_UP_SENTINEL as SENTINEL, buildAskStreamingSystemPrompt, splitStreamedReply} from "@/lib/ask-animaldex/prompt";
import {buildAskGreetingUserPrompt, type AskGroundingPacket, type AskSpeciesGrounding} from "@/lib/ask-animaldex/grounding";

test("companion lines come out of the follow-ups and are never chips", () => {
    const raw = [
        "Then the meeting is the territory. Say it first.",
        SENTINEL,
        "What if he talks over me?",
        "How do lions hold ground?",
        "FOCUS: Speaking up first in meetings",
        "TRIAL: In Monday's meeting, say your idea before anyone else speaks | 4",
        "- REFER: a2 | They freeze when they have to disagree with their manager."
    ].join("\n");
    const {raw: left, lines} = extractCompanionLines(raw);
    assert.equal(lines.focus, "Speaking up first in meetings");
    assert.deepEqual(lines.trial, {step: "In Monday's meeting, say your idea before anyone else speaks", checkInAfterDays: 4});
    assert.deepEqual(lines.refer, {key: "a2", problem: "They freeze when they have to disagree with their manager."});
    assert.equal(lines.done, null);
    assert.equal(left, ["Then the meeting is the territory. Say it first.", SENTINEL, "What if he talks over me?", "How do lions hold ground?"].join("\n"));
    assert.deepEqual(splitStreamedReply(left).followUps, ["What if he talks over me?", "How do lions hold ground?"]);
});

test("a DONE line comes out, and an empty one still counts", () => {
    const loop = extractCompanionLines(`Well done.\n${SENTINEL}\nWhat next?\nDONE: Said the idea first and the director wrote it down.`);
    assert.equal(loop.lines.done, "Said the idea first and the director wrote it down.");
    assert.equal(loop.raw, `Well done.\n${SENTINEL}\nWhat next?`);
    assert.equal(extractCompanionLines(`Well done.\n${SENTINEL}\nDONE:`).lines.done, "done");
});

test("lines before the sentinel are left alone, and odd days are clamped", () => {
    assert.equal(extractCompanionLines("FOCUS: in the answer").lines.focus, null);
    const {lines} = extractCompanionLines(`ok\n${SENTINEL}\nTRIAL: Walk the long way home | 90`);
    assert.equal(lines.trial?.checkInAfterDays, 14);
    assert.equal(extractCompanionLines(`ok\n${SENTINEL}\nTRIAL: Walk the long way home`).lines.trial?.checkInAfterDays, 3);
    // A referral without the problem is not one.
    assert.equal(extractCompanionLines(`ok\n${SENTINEL}\nREFER: a1`).lines.refer, null);
});

test("a referral resolves by key, then by name", () => {
    const roster = parseCompanionRoster([
        {species_profile_id: "s1", capture_id: "c1", animal: "African Lion", nickname: "Leo", power: "Step Forward", lesson: "Take the ground first."},
        {species_profile_id: "s2", capture_id: "c2", animal: "Honey Badger", nickname: null, power: "No Retreat", lesson: null},
        {capture_id: "broken"}
    ]);
    assert.deepEqual(roster.map((entry) => entry.key), ["a1", "a2"]);
    assert.equal(resolveReferral("a2", roster)?.capture_id, "c2");
    assert.equal(resolveReferral("leo", roster)?.capture_id, "c1");
    assert.equal(resolveReferral("african lion", roster)?.capture_id, "c1");
    assert.equal(resolveReferral("a9", roster), null);
});

test("the state reads tolerantly", () => {
    assert.equal(parseCompanionState(null), null);
    const state = parseCompanionState({
        focus: {id: "f", focus: "Asking for the raise", since: "2026-10-28"},
        open_trial: null,
        your_trials_done: 2,
        recent_done: [{step: "Wrote the numbers", done_at: "2026-10-27"}, {nope: 1}],
        referral: {id: "r", from_animal: "Giant Oceanic Manta Ray", problem: "They want to be braver at work."}
    });
    assert.equal(state?.focus?.focus, "Asking for the raise");
    assert.equal(state?.recent_done.length, 1);
    assert.equal(state?.referral?.from_animal, "Giant Oceanic Manta Ray");
});

test("the prompt carries the loop, the Power's state and the other animals", () => {
    const lines = companionPromptLines({
        state: parseCompanionState({focus: {id: "f", focus: "Asking for the raise"}, your_trials_done: 0, recent_done: []}),
        roster: parseCompanionRoster([{species_profile_id: "s1", capture_id: "c1", animal: "African Lion", power: "Step Forward"}]),
        powerEarned: false,
        lessonCheckPassed: false
    }).join("\n");
    assert.equal(lines.includes('"focus":"Asking for the raise"'), true);
    assert.equal(lines.includes('"your_power":"not earned yet"'), true);
    assert.equal(lines.includes('"lesson_check_passed":false'), true);
    assert.equal(lines.includes('"key":"a1"'), true);
    assert.deepEqual(companionPromptLines({state: null, roster: [], powerEarned: true, lessonCheckPassed: true}), []);
});

test("the system prompt carries the loop on the owner's chat only, and the opt-out sets no steps", () => {
    const withLoop = buildAskStreamingSystemPrompt({scope: "species", mode: "chat", animalName: "Lion", companionLoop: {offersSteps: true}});
    assert.equal(withLoop.includes("Helping them with their life"), true);
    assert.equal(withLoop.includes("TRIAL: <the step"), true);
    const optedOut = buildAskStreamingSystemPrompt({scope: "species", mode: "chat", animalName: "Lion", companionLoop: {offersSteps: false}});
    assert.equal(optedOut.includes("set no steps"), true);
    assert.equal(optedOut.includes("Once you understand their situation"), false);
    const visitor = buildAskStreamingSystemPrompt({scope: "species", mode: "chat", animalName: "Lion"});
    assert.equal(visitor.includes("Helping them with their life"), false);
    assert.equal(visitor.includes("FOCUS:"), false);
    // A Trial thread has no loop.
    const trial = buildAskStreamingSystemPrompt({scope: "species", aboutTrial: true, animalName: "Lion", companionLoop: {offersSteps: true}});
    assert.equal(trial.includes("FOCUS:"), false);
    assert.equal(companionLoopRules({offersSteps: true}).some((line) => /\bnever call it a Trial\b/i.test(line)), true);
    // The website has no step cards to offer.
    assert.equal(companionLoopRules({offersSteps: true}).some((line) => /\bcard\b/i.test(line)), false);
});

const lion: AskSpeciesGrounding = {
    slug: "african-lion",
    speciesProfileId: "sp-lion",
    name: "African Lion",
    scientificName: null,
    category: null,
    summary: null,
    identification: [],
    habitat: null,
    nativeRange: null,
    diet: null,
    predators: null,
    sleepPattern: null,
    lifespan: null,
    reproduction: null,
    sexDifference: null,
    interestingFacts: [],
    behaviorTraits: [],
    spottingTips: [],
    power: null,
    systemDynamics: null,
    relatedSpecies: [],
    relatedLocations: []
};

function lionPacket(overrides: Partial<AskGroundingPacket> = {}): AskGroundingPacket {
    return {scope: "species", species: lion, candidateSpecies: [], pageContext: null, hasReaderPhoto: false, mode: "chat", ...overrides};
}

test("a referral opens straight into the problem", () => {
    const prompt = buildAskGreetingUserPrompt({packet: lionPacket(), recordInSystem: true, referral: true});
    assert.equal(prompt.includes("referral_opening"), true);
    assert.equal(prompt.includes("greeting_request"), false);
    assert.equal(buildAskGreetingUserPrompt({packet: lionPacket(), recordInSystem: true}).includes("referral_opening"), false);
});

test("the turn carries the loop and the relationship", () => {
    const lines = companionPromptLines({
        state: parseCompanionState({focus: {id: "f", focus: "Sleep"}, your_trials_done: 1, recent_done: []}),
        roster: [],
        powerEarned: true,
        lessonCheckPassed: true
    });
    const prompt = buildAskGreetingUserPrompt({
        packet: lionPacket({companionLines: lines, relationship: {stage: "working_together", counted: {days: 3}}}),
        recordInSystem: true
    });
    assert.equal(prompt.includes('companion — what you and your owner are working on:'), true);
    assert.equal(prompt.includes('relationship — what you and this person share so far: {"stage":"working_together"'), true);
});

test("done carries companion and the new bond in the server's shape", () => {
    assert.deepEqual(
        companionDoneFields({
            focus: "Speaking up first",
            openTrial: null,
            yourTrialsDone: 2,
            event: {trial_done: {step: "Said it first", power_earned: true, power_waits_for_training: false}},
            bond: {stage: "trusted", stage_index: 3, stage_label: "Trusted", level: 7, mastered: false, strands: {lesson: 80, practice: 40, life: 20}, counted: {days: 9}}
        }),
        {
            bond: {stage: "trusted", stage_index: 3, stage_label: "Trusted", level: 7, strands: {lesson: 80, practice: 40, life: 20}},
            companion: {
                focus: "Speaking up first",
                open_trial: null,
                your_trials_done: 2,
                trial_done: {step: "Said it first", power_earned: true, power_waits_for_training: false}
            }
        }
    );
    assert.deepEqual(bondForClient({stage: "met", mastered: true}), {stage: "met", stage_index: 0, stage_label: null, mastered: true});
    assert.deepEqual(companionDoneFields({focus: null, openTrial: "Walk", yourTrialsDone: 0, event: {}}), {
        companion: {focus: null, open_trial: "Walk", your_trials_done: 0}
    });
});
