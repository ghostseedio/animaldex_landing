import assert from "node:assert/strict";
import test from "node:test";

// The web copy of the apps' supabase/functions/_shared/animal-focus.test.ts
// (3.2, AnimalDex r32-server 25c163e8): the same lines, the same rosters, held
// to the same answers. The string-by-string check against the server's own
// output is ask-animaldex-your-step-parity.test.ts.
import {
    bondForClient,
    companionDoneFields,
    companionLoopRules,
    companionPromptLines,
    companionWarmup,
    conversationOffersWarmup,
    describeStepMedia,
    extractCompanionLines,
    openStepForClient,
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
    // 3.2: the open step says whether it is accepted, its Trial and whether a report waits.
    const open = parseCompanionState({open_trial: {id: "t", step: "Walk", set_at: "2026-10-31", accepted_at: "2026-10-31T08:00:00Z", trial_frequency: "LOW", has_report: true}});
    assert.deepEqual(open?.open_trial, {id: "t", step: "Walk", set_at: "2026-10-31", accepted_at: "2026-10-31T08:00:00Z", trial_frequency: "LOW", has_report: true});
    assert.equal(parseCompanionState({open_trial: {id: "t", step: "Walk"}})?.open_trial?.has_report, false);
});

test("the prompt carries the loop, the Power's state and the other animals", () => {
    const lines = companionPromptLines({
        state: parseCompanionState({focus: {id: "f", focus: "Asking for the raise"}, your_trials_done: 0, recent_done: []}),
        roster: parseCompanionRoster([{species_profile_id: "s1", capture_id: "c1", animal: "African Lion", power: "Step Forward"}]),
        powerEarned: false,
        warmup: {available: true, passed: false, may_offer: true}
    }).join("\n");
    assert.equal(lines.includes('"focus":"Asking for the raise"'), true);
    assert.equal(lines.includes('"your_power":"not earned yet"'), true);
    assert.equal(lines.includes('"warmup":{"passed":false,"may_offer":true}'), true);
    // No lesson check stands in the way any more (3.2).
    assert.equal(lines.includes("lesson_check"), false);
    assert.equal(lines.includes('"key":"a1"'), true);
    assert.deepEqual(companionPromptLines({state: null, roster: [], powerEarned: true}), []);
    // An animal with no Warmup says nothing about one.
    const noQuiz = companionPromptLines({
        state: parseCompanionState({your_trials_done: 0, recent_done: []}),
        roster: [],
        powerEarned: false,
        warmup: {available: false, passed: false, may_offer: false}
    }).join("\n");
    assert.equal(noQuiz.includes("warmup"), false);
});

test("the step object reads whole, and the done event's open_step comes from it", () => {
    const state = parseCompanionState({
        open_trial: {id: "t1", step: "Say it first on Monday", set_at: "2026-10-30T09:00:00Z", accepted_at: "2026-10-30T09:05:00Z", trial_frequency: "MID", has_report: true},
        your_trials_done: 0,
        recent_done: []
    });
    assert.deepEqual(openStepForClient(state?.open_trial), {id: "t1", step: "Say it first on Monday", accepted_at: "2026-10-30T09:05:00Z", trial_frequency: "MID"});
    assert.equal(openStepForClient(null), null);
    // An older server's object (no accepted_at) still reads, as not accepted.
    const old = parseCompanionState({open_trial: {id: "t2", step: "Walk home"}, your_trials_done: 0, recent_done: []});
    assert.equal(old?.open_trial?.accepted_at, null);
    assert.equal(old?.open_trial?.has_report, false);
    // The prompt says whether it is accepted, and which of its Trials it came from.
    const lines = companionPromptLines({state, roster: [], powerEarned: false}).join("\n");
    assert.equal(lines.includes('"open_trial":{"step":"Say it first on Monday","set":"2026-10-30","accepted":true,"from_your_trial":"MID"}'), true);
});

test("a report says it is one, and what was attached, without the media", () => {
    const state = parseCompanionState({open_trial: {id: "t1", step: "Say it first"}, your_trials_done: 0, recent_done: []});
    const withVideo = companionPromptLines({state, roster: [], powerEarned: false, stepReport: {media: "a video"}}).join("\n");
    assert.equal(withVideo.includes('step_report — they have just tapped "I did it" on companion.open_trial'), true);
    assert.equal(withVideo.includes("They also added a video to their record of it, which you cannot see."), true);
    const plain = companionPromptLines({state, roster: [], powerEarned: false, stepReport: {media: null}}).join("\n");
    assert.equal(plain.includes("step_report"), true);
    assert.equal(plain.includes("They also added"), false);
    // No open step: nothing to report on.
    const none = companionPromptLines({
        state: parseCompanionState({your_trials_done: 0, recent_done: []}),
        roster: [],
        powerEarned: false,
        stepReport: {media: null}
    }).join("\n");
    assert.equal(none.includes("step_report"), false);
    assert.equal(describeStepMedia([]), null);
    assert.equal(describeStepMedia(["u/steps/s/a.jpg"]), "a photo");
    assert.equal(describeStepMedia(["u/steps/s/a.mp4", "u/steps/s/b.jpg"]), "a video");
    assert.equal(describeStepMedia(["u/steps/s/a.jpg", "u/steps/s/b.png"]), "2 photos");
});

test("the Warmup is offered once, in the first conversation, while it is not passed", () => {
    const progress = {warmup: {available: true, passed: false}};
    assert.equal(companionWarmup({ownerProgress: progress, daysTalked: 0, offeredInConversation: false}).may_offer, true);
    assert.equal(companionWarmup({ownerProgress: progress, daysTalked: 1, offeredInConversation: false}).may_offer, true);
    assert.equal(companionWarmup({ownerProgress: progress, daysTalked: 2, offeredInConversation: false}).may_offer, false);
    assert.equal(companionWarmup({ownerProgress: progress, daysTalked: 0, offeredInConversation: true}).may_offer, false);
    assert.deepEqual(
        companionWarmup({ownerProgress: {warmup: {available: true, passed: true}}, daysTalked: 0, offeredInConversation: false}),
        {available: true, passed: true, may_offer: false}
    );
    assert.equal(companionWarmup({ownerProgress: null, daysTalked: 0, offeredInConversation: false}).may_offer, false);
    const card = 'Want to try?\n```animaldex-card\n{"kind":"training","title":"Warmup","body":"Two questions.","cta":"Take it"}\n```';
    assert.equal(conversationOffersWarmup([{role: "assistant", content: card}]), true);
    assert.equal(conversationOffersWarmup([{role: "user", content: card}]), false);
    assert.equal(conversationOffersWarmup([{role: "assistant", content: '```animaldex-card\n{"kind":"trial","frequency":"MID"}\n```'}]), false);
});

test("the step rules: plain words, no proof, no refusal, no lesson check, Trials for a different step", () => {
    const rules = companionLoopRules({offersSteps: true}).join("\n");
    assert.equal(/never mention a card, a\s+button or tapping/.test(rules), true);
    assert.equal(rules.includes("Never ask for proof or to see anything"), true);
    assert.equal(/Never refuse it, never say it does not count, and never mention attempts, limits, waiting or\s+tomorrow/.test(rules), true);
    assert.equal(/something else that still does your lesson, it counts the same/.test(rules), true);
    assert.equal(/ask them one specific question/.test(rules), true);
    assert.equal(/offer\s+your own Trials instead, with the trial card/.test(rules), true);
    assert.equal(/may offer it once, with the training card/.test(rules), true);
    assert.equal(/never offer it again in this conversation/.test(rules), true);
    // Gone in 3.2: the lesson check before the Power, and the card after a done step.
    assert.equal(/lesson check|lesson_check/i.test(rules), false);
    assert.equal(/offer it with the training\s+card/.test(rules), false);
    assert.equal(/the first step they finish with you\s+earns it/.test(rules), true);
    assert.equal(rules.includes("power_just_earned"), true);
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
    // 3.2: the owner's chat offers its Trials and its Warmup with cards, as the apps do.
    assert.equal(companionLoopRules({offersSteps: true}).some((line) => /with the trial card/.test(line)), true);
    assert.equal(optedOut.includes("set no steps and send no cards"), true);
});

test("on a call nothing is set, offered or drawn; visitors and groups set no steps either", () => {
    const call = buildAskStreamingSystemPrompt({scope: "species", mode: "auto", animalName: "Lion", call: true, supportedVisuals: []});
    assert.equal(call.includes("This is a voice call: set no steps, offer no Warmup, Trials or battles"), true);
    assert.equal(call.includes("Helping them with their life"), false);
    assert.equal(call.includes("TRIAL: <the step"), false);
    assert.equal(call.includes("Your Trials, unasked"), false);
    const visitor = buildAskStreamingSystemPrompt({scope: "species", mode: "auto", animalName: "Lion", speakingTo: "visitor"});
    assert.equal(visitor.includes("Do not offer the owner's steps, Warmup, Trials or"), true);
    const group = buildAskStreamingSystemPrompt({scope: "species", mode: "chat", animalName: "Lion", groupLines: ["group"]});
    assert.equal(group.includes("asked not to be offered steps, your Warmup, Trials or battles"), true);
    assert.equal(group.includes("TRIAL: <the step"), false);
});

test("the card kinds: Trials and the Warmup, never Apply It Your Way, and only where the reader has cards", () => {
    const owner = buildAskStreamingSystemPrompt({scope: "species", mode: "auto", animalName: "Lion", companionLoop: {offersSteps: true}, supportedVisuals: ["card"]});
    assert.equal(owner.includes("training (your Warmup"), true);
    assert.equal(owner.includes("trial (your Trials, to make one of them their step"), true);
    assert.equal(/apply \(Apply It Your Way|trial_or_apply/.test(owner), false);
    // The step itself is never a card the model writes: the drawer draws it.
    assert.equal(/A step you set them in\s+your own words needs no card/.test(owner), true);
    assert.equal(owner.includes("then any card block(s), each closed with ```"), true);
    // A reader with no cards is never told how to write one.
    const reader = buildAskStreamingSystemPrompt({scope: "species", mode: "auto", animalName: "Lion", supportedVisuals: ["flow"]});
    assert.equal(reader.includes("animaldex-card"), false);
    assert.equal(reader.includes("with the trial card"), false);
    assert.equal(reader.includes("then any card block(s)"), false);
    // The site-wide assistant never gets the owner's cards.
    const general = buildAskStreamingSystemPrompt({scope: "general", supportedVisuals: ["flow", "card"]});
    assert.equal(general.includes("animaldex-card"), false);
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
        powerEarned: true
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
            openStep: null,
            yourTrialsDone: 2,
            event: {trial_done: {id: "t", step: "Said it first", power_earned: true, power_waits_for_training: false, xp: 5}},
            bond: {stage: "trusted", stage_index: 3, stage_label: "Trusted", level: 7, mastered: false, strands: {lesson: 80, practice: 40, life: 20}, counted: {days: 9}}
        }),
        {
            bond: {stage: "trusted", stage_index: 3, stage_label: "Trusted", level: 7, strands: {lesson: 80, practice: 40, life: 20}},
            companion: {
                focus: "Speaking up first",
                open_trial: null,
                open_step: null,
                your_trials_done: 2,
                trial_done: {id: "t", step: "Said it first", power_earned: true, power_waits_for_training: false, xp: 5}
            }
        }
    );
    assert.deepEqual(bondForClient({stage: "met", mastered: true}), {stage: "met", stage_index: 0, stage_label: null, mastered: true});
    assert.deepEqual(companionDoneFields({
        focus: null,
        openStep: {id: "t", step: "Walk", set_at: "2026-10-31", accepted_at: "2026-10-31T08:00:00Z", trial_frequency: "LOW", has_report: true},
        yourTrialsDone: 0,
        event: {trial_set: {id: "t", step: "Walk"}}
    }), {
        companion: {
            focus: null,
            open_trial: "Walk",
            // The client's step object: no set_at or has_report in the done event (SPEC section 4).
            open_step: {id: "t", step: "Walk", accepted_at: "2026-10-31T08:00:00Z", trial_frequency: "LOW"},
            your_trials_done: 0,
            trial_set: {id: "t", step: "Walk"}
        }
    });
});
