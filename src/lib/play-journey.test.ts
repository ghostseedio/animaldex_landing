import assert from "node:assert/strict";
import test from "node:test";
import type {PowerGateStatus} from "@/lib/animal-powers";
import {type AnimalTrial, decodeAnimalTrial} from "@/lib/animal-trials";
import {
    PLAY_JOURNEY_COPY,
    PLAY_JOURNEY_TRAINING_REWARD_XP,
    type PlayJourneyCard,
    type PlayJourneyFused,
    type PlayJourneyStepFailure,
    buildPlayJourney,
    journeyFocus,
    journeyIsEmpty,
    journeyPowersEarned,
    journeyStatusLine,
    journeyTimeLeft,
    lockedSummaryLine,
    visibleEntries
} from "@/lib/play-journey";

// Same cases as iOS AnimalDexTests/PlayJourneyTests.swift.

const FOX = "11111111-1111-1111-1111-111111111111";
const OWL = "22222222-2222-2222-2222-222222222222";
const FOX_CARD = "aaaaaaaa-0000-0000-0000-000000000001";
const FOX_CARD_NEWER = "aaaaaaaa-0000-0000-0000-000000000002";
const OWL_CARD = "aaaaaaaa-0000-0000-0000-000000000003";

const DAY = 86_400_000;
const T0 = 1_800_000_000_000;
const iso = (ms: number) => new Date(ms).toISOString();

function card(
    captureId: string,
    options: {species?: string | null; name?: string; at?: number; power?: string | null; gate?: PowerGateStatus} = {}
): PlayJourneyCard {
    return {
        captureId,
        speciesProfileId: options.species === undefined ? FOX : options.species,
        animalName: options.name ?? "Red Fox",
        capturedAt: iso(options.at ?? T0),
        imageSrc: null,
        powerName: options.power === undefined ? "Lookout Turn" : options.power,
        gate: options.gate ?? "not_earned"
    };
}

function trial(options: {species?: string; frequency?: string; status?: string; deadline?: number} = {}): AnimalTrial {
    const status = options.status ?? "not_started";
    const decoded = decodeAnimalTrial({
        species_profile_id: options.species ?? FOX,
        frequency: options.frequency ?? "LOW",
        species_display_name: "Red Fox",
        title: "Look Twice",
        principle_name: "Lookout Turn",
        primary_proof_type: "photo",
        proof_types: ["photo"],
        reward_class: "xp_standard",
        reward_credits: 5,
        status,
        activated_at: status === "not_started" ? null : iso(T0),
        completion_deadline_at: options.deadline ? iso(options.deadline) : null,
        completed_at: status === "completed" ? iso(T0) : null
    });
    assert.ok(decoded);
    return decoded;
}

function journey(input: {
    cards: PlayJourneyCard[];
    trained?: string[];
    failures?: PlayJourneyStepFailure[];
    earned?: string[];
    trials?: AnimalTrial[];
    completed?: string[];
    fused?: PlayJourneyFused[];
}) {
    return buildPlayJourney({
        cards: input.cards,
        trainedSpecies: input.trained ?? [],
        failures: input.failures ?? [],
        earnedSpecies: input.earned ?? [],
        openTrials: input.trials ?? [],
        completedTrialSpecies: input.completed ?? [],
        fused: input.fused ?? []
    });
}

test("a new catch starts at Train", () => {
    const result = journey({cards: [card(FOX_CARD)]});
    assert.deepEqual(result.train.map((entry) => entry.speciesProfileId), [FOX]);
    assert.equal(result.train[0].rewardXP, PLAY_JOURNEY_TRAINING_REWARD_XP);
    assert.ok(!result.proveIt.length && !result.battleAndFuse.length && !result.locked.length);
    assert.equal(journeyFocus(result), "train");
});

test("two cards of one animal are one row that opens the newest", () => {
    const result = journey({cards: [card(FOX_CARD), card(FOX_CARD_NEWER, {at: T0 + DAY})]});
    assert.equal(result.train.length, 1);
    assert.equal(result.train[0].captureId, FOX_CARD_NEWER);
});

test("Training moves it to Prove it", () => {
    const result = journey({cards: [card(FOX_CARD)], trained: [FOX], trials: [trial()]});
    assert.deepEqual(result.proveIt.map((entry) => entry.speciesProfileId), [FOX]);
    assert.deepEqual(result.proveIt[0].proof, {kind: "notStarted"});
    assert.equal(result.proveIt[0].rewardXP, 10);
});

test("a running Trial says so and sorts first", () => {
    const deadline = T0 + 2 * DAY;
    const result = journey({
        cards: [card(FOX_CARD), card(OWL_CARD, {species: OWL, name: "Barn Owl", at: T0 + 3 * DAY})],
        trained: [FOX, OWL],
        trials: [trial({status: "active", deadline}), trial({species: OWL})]
    });
    assert.deepEqual(result.proveIt.map((entry) => entry.speciesProfileId), [FOX, OWL]);
    assert.deepEqual(result.proveIt[0].proof, {kind: "trialRunning", deadline: iso(deadline)});
    assert.equal(journeyStatusLine(result.proveIt[0], T0)?.text, "Trial running · 2d left");
});

test("an earned Power opens Battle & Fuse", () => {
    const byGate = journey({cards: [card(FOX_CARD, {gate: "earned"})]});
    const byList = journey({cards: [card(FOX_CARD)], earned: [FOX]});
    const byTrial = journey({cards: [card(FOX_CARD)], completed: [FOX]});
    for (const result of [byGate, byList, byTrial]) {
        assert.deepEqual(result.battleAndFuse.map((entry) => entry.speciesProfileId), [FOX]);
        assert.ok(!result.train.length && !result.proveIt.length);
    }
    assert.equal(journeyPowersEarned(byGate), 1);
});

test("an animal with no Power is left out", () => {
    const result = journey({cards: [
        card(FOX_CARD, {power: null, gate: "not_applicable_missing_power"}),
        card(OWL_CARD, {species: null, gate: "not_applicable_unresolved_species"})
    ]});
    assert.equal(journeyIsEmpty(result), true);
});

test("a missed Training locks until a newer card", () => {
    const miss: PlayJourneyStepFailure = {speciesProfileId: FOX, step: "train", failedAt: iso(T0 + DAY)};
    const locked = journey({cards: [card(FOX_CARD)], failures: [miss]});
    assert.equal(locked.locked[0]?.lockedStep, "train");
    assert.equal(locked.train.length, 0);
    assert.equal(journeyStatusLine(locked.locked[0])?.text, "Training missed");

    const reopened = journey({cards: [card(FOX_CARD), card(FOX_CARD_NEWER, {at: T0 + 2 * DAY})], failures: [miss]});
    assert.equal(reopened.locked.length, 0);
    assert.deepEqual(reopened.train.map((entry) => entry.captureId), [FOX_CARD_NEWER]);
});

test("a rejected proof locks step two, not Training", () => {
    const miss: PlayJourneyStepFailure = {speciesProfileId: FOX, step: "proveIt", failedAt: iso(T0 + DAY)};
    const result = journey({cards: [card(FOX_CARD)], trained: [FOX], failures: [miss], trials: [trial()]});
    assert.equal(result.locked[0]?.lockedStep, "proveIt");
    assert.equal(result.proveIt.length, 0);
});

test("a miss is forgotten once the Power is earned", () => {
    const miss: PlayJourneyStepFailure = {speciesProfileId: FOX, step: "proveIt", failedAt: iso(T0 + DAY)};
    const result = journey({cards: [card(FOX_CARD, {gate: "earned"})], failures: [miss]});
    assert.equal(result.locked.length, 0);
    assert.equal(result.battleAndFuse.length, 1);
});

test("a fused Power starts the loop again on its card", () => {
    const id = "ffffffff-0000-0000-0000-000000000001";
    const fused = (options: {trained?: number; earned?: number; trainingMiss?: number} = {}): PlayJourneyFused => ({
        id,
        captureId: FOX_CARD,
        name: "Night Patrol",
        createdAt: iso(T0),
        trainingCompletedAt: options.trained ? iso(options.trained) : null,
        earnedAt: options.earned ? iso(options.earned) : null,
        trainingFailedAt: options.trainingMiss ? iso(options.trainingMiss) : null,
        proofFailedAt: null
    });
    const base = card(FOX_CARD, {gate: "earned"});

    const toTrain = journey({cards: [base], fused: [fused()]});
    assert.equal(toTrain.battleAndFuse.length, 1);
    assert.deepEqual(toTrain.train[0]?.subject, {kind: "fusedPower", id, name: "Night Patrol"});
    assert.equal(toTrain.train[0]?.captureId, FOX_CARD);

    const toProve = journey({cards: [base], fused: [fused({trained: T0})]});
    assert.equal(toProve.proveIt[0]?.subject.kind, "fusedPower");

    const done = journey({cards: [base], fused: [fused({trained: T0, earned: T0})]});
    assert.ok(!done.train.length && !done.proveIt.length);

    const locked = journey({cards: [base], fused: [fused({trainingMiss: T0 + DAY})]});
    assert.equal(locked.locked[0]?.subject.kind, "fusedPower");
});

test("time left reads in the largest unit", () => {
    assert.equal(journeyTimeLeft(iso(T0 + 2 * DAY + 60_000), T0), "2d");
    assert.equal(journeyTimeLeft(iso(T0 + 5 * 3_600_000), T0), "5h");
    assert.equal(journeyTimeLeft(iso(T0 + 30_000), T0), "1m");
    assert.equal(journeyTimeLeft(iso(T0 - 1000), T0), null);
});

test("more than five rows fold to four behind Show all", () => {
    const rows = journey({cards: Array.from({length: 6}, (_, index) =>
        card(`c${index}`, {species: `s${index}`, at: T0 + index}))}).train;
    assert.equal(visibleEntries(rows, false).length, 4);
    assert.equal(visibleEntries(rows, true).length, 6);
    assert.equal(visibleEntries(rows.slice(0, 5), false).length, 5);
});

test("a locked step says when it can be tried again", () => {
    assert.equal(lockedSummaryLine(2), "2 locked · try again tomorrow");
    assert.equal(PLAY_JOURNEY_COPY.tryAgainTomorrow, "TRY AGAIN TOMORROW");
});
