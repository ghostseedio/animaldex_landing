import assert from "node:assert/strict";
import test from "node:test";

// The owner's change of 2026-10-31 (proof bonus + debates fixes): the proof's
// +5 XP on the done step and the record, public debates with your own
// animals (nothing at stake), and the debate's problem from the focus.
import {COMPANION_WORDS_EN, companionWords} from "@/lib/companion-bond";
import {normalizeCompanionEvent, parseCompanionUpdate} from "@/lib/ask-animaldex/companion-loop";
import {askReplySpecials} from "@/lib/ask-animaldex/special-messages";
import {debateOfferProblem} from "@/lib/ask-animaldex/companion-focus";
import {decodeStepRecords, stepProofStatus} from "@/lib/your-step";
import {stepProofBonusLine} from "@/lib/your-step-words";
import {
    debateHasStakes,
    debateIsOwnOnly,
    debateSeedProblem,
    decodeDebate,
    groupDebateCandidates,
    othersPicked,
    type DebateCandidate
} from "@/lib/debates";
import en from "@/data/locales/en.json";
import id from "@/data/locales/id.json";

const STEP = "11111111-1111-4111-8111-111111111111";

test("trial_done's proof bonus is read, never more than the step paid, and absent from old servers", () => {
    const withBonus = parseCompanionUpdate({focus: null, trial_done: {id: STEP, step: "Spoke first", power_earned: false, xp: 10, proof_bonus: 5}});
    assert.deepEqual(withBonus?.event.stepDone, {id: STEP, step: "Spoke first", powerEarned: false, xp: 10, proofBonus: 5});
    const old = parseCompanionUpdate({focus: null, trial_done: {id: STEP, step: "Spoke first", power_earned: false, xp: 5}});
    assert.equal(old?.event.stepDone?.proofBonus, undefined);
    const capped = parseCompanionUpdate({focus: null, trial_done: {step: "Spoke first", xp: 0, proof_bonus: 5}});
    assert.equal(capped?.event.stepDone?.proofBonus, undefined);
    // Kept with the thread, and read back.
    const stored = normalizeCompanionEvent(JSON.parse(JSON.stringify(withBonus?.event)));
    assert.equal(stored?.stepDone?.proofBonus, 5);
});

test("the done special carries the bonus, and the line says it only when there is one", () => {
    const specials = askReplySpecials({
        message: {role: "assistant", status: "complete", text: "Well done.", companionEvent: {stepDone: {step: "Walked", powerEarned: false, xp: 10, proofBonus: 5}}},
        warmupUnavailable: false,
        warmupStarted: false,
        trialsUnavailable: false,
        debatesOffered: false,
        debateSetupOpenHere: false
    });
    assert.deepEqual(specials[0], {kind: "done", xp: 10, step: "Walked", powerEarned: false, proofBonus: 5});
    assert.equal(stepProofBonusLine(5, COMPANION_WORDS_EN), "+5 XP for your proof");
    assert.equal(stepProofBonusLine(0, COMPANION_WORDS_EN), null);
    assert.equal(stepProofBonusLine(undefined, COMPANION_WORDS_EN), null);
});

test("a record reads its proof status; only the server's four words count", () => {
    const [record] = decodeStepRecords([{id: STEP, step: "Spoke first", done_at: "2026-10-31T10:00:00Z", xp_awarded: 15, proof_status: "confirmed"}]);
    assert.equal(record.proofStatus, "confirmed");
    assert.equal(record.xpAwarded, 15);
    assert.equal(decodeStepRecords([{id: STEP, step: "Spoke first"}])[0].proofStatus, null);
    for (const said of ["confirmed", "unclear", "not_shown", "failed"]) assert.equal(stepProofStatus(said), said);
    assert.equal(stepProofStatus("yes"), null);
});

test("the new words are in English and Indonesian", () => {
    for (const locale of [en, id]) {
        const words = companionWords((locale as Record<string, unknown>).companions);
        for (const said of [
            words.journey.report.attachBonus,
            words.journey.done.proofBonus,
            words.journey.record.proof,
            words.debate.ownOnly,
            words.debate.yourAnimals,
            words.debate.othersAnimals,
            words.debate.noOthers
        ]) {
            assert.ok(said.trim().length > 0);
        }
        assert.match(words.journey.done.proofBonus, /\{n\}/);
    }
    const indonesian = companionWords((id as Record<string, unknown>).companions);
    assert.notEqual(indonesian.debate.ownOnly, COMPANION_WORDS_EN.debate.ownOnly);
    assert.notEqual(indonesian.journey.report.attachBonus, COMPANION_WORDS_EN.journey.report.attachBonus);
});

function candidate(captureId: string, ownerIsMe: boolean, fits = false): DebateCandidate {
    return {captureId, ownerIsMe, speciesProfileId: null, slug: null, animal: captureId, nickname: null, powerName: null, powerLesson: null, hearts: null, fits};
}

test("Public lists your animals first, then other people's, best fits first in each", () => {
    const rows = [candidate("o1", false), candidate("m1", true), candidate("o2", false, true), candidate("m2", true, true)];
    const {own, others} = groupDebateCandidates(rows);
    assert.deepEqual(own.map((row) => row.captureId), ["m2", "m1"]);
    assert.deepEqual(others.map((row) => row.captureId), ["o2", "o1"]);
    assert.equal(othersPicked(rows, ["m1", "m2"]), 0);
    assert.equal(othersPicked(rows, ["m1", "o1"]), 1);
});

test("stakes only between different owners: own-only public debates have none, the server's word wins", () => {
    const participants = (askerOwned: boolean[]) => askerOwned.map((owned, seat) => ({
        participant_id: `2222222${seat}-2222-4222-8222-222222222222`,
        seat,
        animal: "Wolf",
        is_asker_owned: owned
    }));
    const own = decodeDebate({id: "33333333-3333-4333-8333-333333333333", visibility: "public", status: "voting", participants: participants([true, true])});
    const mixed = decodeDebate({id: "33333333-3333-4333-8333-333333333333", visibility: "public", status: "voting", participants: participants([true, false])});
    const said = decodeDebate({id: "33333333-3333-4333-8333-333333333333", visibility: "public", status: "voting", has_stakes: false, participants: participants([true, false])});
    const privateOne = decodeDebate({id: "33333333-3333-4333-8333-333333333333", visibility: "private", status: "debating", participants: participants([true, true])});
    assert.ok(own && mixed && said && privateOne);
    assert.equal(debateHasStakes(own), false);
    assert.equal(debateIsOwnOnly(own), true);
    assert.equal(debateHasStakes(mixed), true);
    assert.equal(debateIsOwnOnly(mixed), false);
    assert.equal(debateIsOwnOnly(said), true);
    // A private debate never had stakes, and never says so.
    assert.equal(debateHasStakes(privateOne), false);
    assert.equal(debateIsOwnOnly(privateOne), false);
});

test("a debate starts on the main problem: the offer's, else the focus, else what they said", () => {
    assert.equal(debateSeedProblem({offered: "Speaking up in meetings", focus: "Sleep", said: ["hi"]}), "Speaking up in meetings");
    assert.equal(debateSeedProblem({offered: null, focus: "  Speaking up   first ", said: ["my last message"]}), "Speaking up first");
    assert.equal(debateSeedProblem({focus: null, said: [null, "my last message"]}), "my last message");
    assert.equal(debateSeedProblem({focus: null, said: ["the call's problem", "my last message"]}), "the call's problem");
    assert.equal(debateSeedProblem({}), "");
    // The server's offer and hand-over: the focus when there is one.
    assert.equal(debateOfferProblem("Speaking up first", "They freeze in meetings"), "Speaking up first");
    assert.equal(debateOfferProblem(null, "They freeze in meetings"), "They freeze in meetings");
    assert.equal(debateOfferProblem(" ", null), null);
});
