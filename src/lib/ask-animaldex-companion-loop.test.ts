import assert from "node:assert/strict";
import test from "node:test";
import {
    COMPANION_COPY,
    companionDisplayName,
    isEmptyCompanionEvent,
    parseCompanionFocus,
    parseCompanionUpdate,
    referralCapturePath,
    resolveReferralId
} from "@/lib/ask-animaldex/companion-loop";
import {
    createAskMessage,
    loadAskThreads,
    saveAskThreads,
    type AskThreadStorage
} from "@/lib/ask-animaldex/thread";

const REFERRAL = "8a3c4c55-1d9e-4f3a-9c41-2f1d2b3c4d5e";
const SPECIES = "0f2c1e5a-3b4d-4e6f-8a9b-1c2d3e4f5a6b";
const CAPTURE = "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d";
const STEP = "5d6e7f80-1a2b-4c3d-8e9f-0a1b2c3d4e5f";

function memoryStorage(): AskThreadStorage {
    const map = new Map<string, string>();
    return {
        getItem: (key) => map.get(key) ?? null,
        setItem: (key, value) => void map.set(key, value),
        removeItem: (key) => void map.delete(key)
    };
}

test("a done frame carries the companion loop and what the animal did in the reply", () => {
    const update = parseCompanionUpdate({
        focus: "Speaking up first in meetings",
        open_trial: null,
        your_trials_done: 2,
        open_step: null,
        trial_done: {step: "Say the idea first on Monday", power_earned: true, power_waits_for_training: false, xp: 5},
        referral: {id: REFERRAL, species_profile_id: SPECIES, capture_id: CAPTURE, animal: "African Lion", nickname: "Leo"}
    });
    assert.ok(update);
    assert.deepEqual(update.loop, {focus: "Speaking up first in meetings", openTrial: null, openStep: null, yourTrialsDone: 2});
    assert.deepEqual(update.event.stepDone, {step: "Say the idea first on Monday", powerEarned: true, xp: 5});
    assert.equal(update.event.referral?.captureId, CAPTURE);
    assert.equal(companionDisplayName(update.event.referral?.nickname, update.event.referral?.animal ?? ""), "Leo the African Lion");
    assert.equal(isEmptyCompanionEvent(update.event), false);
});

test("3.2: the open step comes from server state, and the reply that set it carries its id", () => {
    const update = parseCompanionUpdate({
        focus: "Sleep",
        open_trial: "Phone in the kitchen by ten",
        open_step: {id: STEP.toUpperCase(), step: "Phone in the kitchen by ten", accepted_at: null, trial_frequency: null},
        your_trials_done: 0,
        trial_set: {step: "Phone in the kitchen by ten", id: STEP}
    });
    assert.ok(update);
    assert.deepEqual(update.loop.openStep, {
        id: STEP,
        step: "Phone in the kitchen by ten",
        setAt: null,
        acceptedAt: null,
        trialFrequency: null,
        hasReport: false
    });
    assert.deepEqual(update.event.stepSet, {id: STEP, step: "Phone in the kitchen by ten"});
    assert.equal(isEmptyCompanionEvent(update.event), false);
    // A Trial made the step: accepted at once, and its frequency rides along.
    const fromTrial = parseCompanionUpdate({open_step: {id: STEP, step: "Freeze, then move", accepted_at: "2026-10-31T09:00:00Z", trial_frequency: "mid"}});
    assert.equal(fromTrial?.loop.openStep?.trialFrequency, "MID");
    assert.equal(fromTrial?.loop.openTrial, "Freeze, then move");
    // An older server sends no open_step: the words still show, with nothing to act on.
    assert.equal(parseCompanionUpdate({open_trial: "Walk"})?.loop.openStep, null);
    // No XP paid (the day's paying step was another): 0, never NaN.
    assert.equal(parseCompanionUpdate({trial_done: {step: "Walked", power_earned: false}})?.event.stepDone?.xp, 0);
});

test("a loop with nothing new in it is an empty event, and a malformed field costs nothing else", () => {
    const update = parseCompanionUpdate({
        focus: null,
        open_trial: "Walk the long way",
        your_trials_done: "two",
        trial_done: "oops",
        referral: {animal: "No id"}
    });
    assert.ok(update);
    assert.equal(update.loop.openTrial, "Walk the long way");
    assert.equal(update.loop.yourTrialsDone, 0);
    assert.equal(isEmptyCompanionEvent(update.event), true);
    assert.equal(parseCompanionUpdate("oops"), null);
    assert.equal(parseCompanionUpdate(null), null);
    assert.equal(parseCompanionUpdate([1, 2]), null);
});

test("the focus RPC reads its nested focus and step", () => {
    assert.deepEqual(
        parseCompanionFocus({
            focus: {id: "f", focus: "Saying no to extra shifts", since: "2026-10-28"},
            open_trial: {id: STEP, step: "Turn down one shift this week", set_at: "2026-10-28T09:00:00Z", accepted_at: "2026-10-28T10:00:00Z", trial_frequency: null, has_report: true},
            your_trials_done: 3,
            referral: null
        }),
        {
            focus: "Saying no to extra shifts",
            openTrial: "Turn down one shift this week",
            openStep: {
                id: STEP,
                step: "Turn down one shift this week",
                setAt: "2026-10-28T09:00:00Z",
                acceptedAt: "2026-10-28T10:00:00Z",
                trialFrequency: null,
                hasReport: true
            },
            yourTrialsDone: 3
        }
    );
    assert.deepEqual(parseCompanionFocus({focus: null, open_trial: null, your_trials_done: 0}), {focus: null, openTrial: null, openStep: null, yourTrialsDone: 0});
    // A step without a usable id still reads as words.
    assert.equal(parseCompanionFocus({open_trial: {id: "t", step: "Walk"}})?.openTrial, "Walk");
    assert.equal(parseCompanionFocus(null), null);
});

test("Talk to opens the referred capture's chat on the referral", () => {
    const referral = {id: REFERRAL, speciesProfileId: SPECIES, captureId: CAPTURE, animal: "Meerkat", nickname: null};
    assert.equal(referralCapturePath(referral), `/app/capture/${CAPTURE}?referral=${REFERRAL}`);
    assert.equal(referralCapturePath({...referral, id: null}), `/app/capture/${CAPTURE}`);
    assert.equal(referralCapturePath({...referral, captureId: null}), null);
    assert.equal(companionDisplayName(null, "Meerkat"), "Meerkat");
    assert.equal(companionDisplayName("meerkat", "Meerkat"), "Meerkat");
    assert.equal(resolveReferralId(REFERRAL.toUpperCase()), REFERRAL);
    assert.equal(resolveReferralId("not-a-uuid"), null);
    assert.equal(resolveReferralId(null), null);
});

test("a reply keeps what the animal did in it through a reload; older threads have none", () => {
    const storage = memoryStorage();
    const reply = createAskMessage("assistant", "Well done.", {
        companionEvent: {stepDone: {step: "Booked the meeting", powerEarned: false, xp: 5}, stepSet: {id: STEP, step: "Book the meeting"}}
    });
    const older = createAskMessage("assistant", "hi");
    saveAskThreads(storage, {[`capture:${CAPTURE}`]: [older, reply]});
    const [restoredOlder, restoredReply] = loadAskThreads(storage)[`capture:${CAPTURE}`];
    assert.equal(restoredOlder.companionEvent, undefined);
    assert.deepEqual(restoredReply.companionEvent, reply.companionEvent);
});

test("companion copy matches iOS word for word", () => {
    assert.equal(COMPANION_COPY.workingOn.replace("{focus}", "Sleep"), "Working on: Sleep");
    assert.equal(COMPANION_COPY.notThisAnyMore, "Not this any more");
    assert.equal("powerWaitsForTraining" in COMPANION_COPY, false);
    assert.equal(COMPANION_COPY.talkTo.replace("{name}", "Leo the African Lion"), "Talk to Leo the African Lion");
});
