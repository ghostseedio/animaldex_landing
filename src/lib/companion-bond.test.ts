import assert from "node:assert/strict";
import test from "node:test";
import {
    BOND_COPY,
    COMPANIONS_COPY,
    bondChipText,
    bondLevelProgress,
    bondPowerLine,
    bondStageLabel,
    companionLevelsBySpecies,
    companionRowHref,
    ownCardLevel,
    companionStatusLine,
    companionSummaryName,
    decodeAnimalBond,
    decodeChatBond,
    decodeCompanionSummaries,
    trialDifficulty
} from "@/lib/companion-bond";

const SPECIES = "0f2c1e5a-3b4d-4e6f-8a9b-1c2d3e4f5a6b";

test("the bond screen decodes animal_bond_v1, tolerantly", () => {
    const bond = decodeAnimalBond({
        species_profile_id: SPECIES,
        xp: 140,
        level: 4,
        level_xp: 100,
        next_level_xp: 180,
        stage: "working_together",
        stage_index: 2,
        stage_label: "Working together",
        mastered: false,
        strands: {lesson: 100, practice: 40, life: "oops"},
        lesson_check_passed: true,
        power: {name: "Sentinel Shift", earned: true, via: "your_trial", at: "2026-10-28"},
        counted: {days: 3},
        companion: {
            focus: {id: "f", focus: "Speaking up first", since: "2026-10-27"},
            open_trial: {id: "t", step: "Say it first on Monday", set_at: "2026-10-28"},
            your_trials_done: 1,
            recent_done: [{step: "Booked the meeting", done_at: "2026-10-26", evidence: null}, {nope: 1}]
        }
    });
    assert.ok(bond);
    assert.equal(bond.level, 4);
    assert.deepEqual(bond.strands, {lesson: 100, practice: 40, life: 0});
    assert.equal(bond.focus, "Speaking up first");
    assert.equal(bond.openTrial, "Say it first on Monday");
    assert.deepEqual(bond.recentDone, [{step: "Booked the meeting", doneAt: "2026-10-26"}]);
    assert.equal(bondLevelProgress(bond), 0.5);
    assert.equal(bondPowerLine(bond, "Leo"), "Earned in your own life");
    assert.equal(bondChipText(bond), "Level 4 · Working together");

    const bare = decodeAnimalBond({});
    assert.ok(bare);
    assert.equal(bare.level, 1);
    assert.equal(bare.stageLabel, "Met");
    assert.equal(bondLevelProgress(bare), 1);
    assert.equal(decodeAnimalBond(null), null);
    assert.equal(decodeAnimalBond([1]), null);
});

test("the Power line says what earning it takes", () => {
    const notEarned = {power: {name: "X", earned: false, via: null, at: null}};
    assert.equal(bondPowerLine({...notEarned, lessonCheckPassed: true}, "Leo"), "Complete one Trial with Leo to earn it.");
    assert.equal(bondPowerLine({...notEarned, lessonCheckPassed: false}, "Leo"), "Pass its lesson check, then complete one Trial with Leo.");
    assert.equal(bondPowerLine({power: {name: "X", earned: true, via: "trial", at: null}, lessonCheckPassed: true}, "Leo"), "Earned by Trial");
    assert.equal(bondPowerLine({power: {name: "X", earned: true, via: "application", at: null}, lessonCheckPassed: true}, "Leo"), "Earned by applying it");
});

test("companions decode in server order and skip rows without a species", () => {
    const rows = decodeCompanionSummaries([
        {species_profile_id: SPECIES, capture_id: "c1", animal: "African Lion", nickname: "Leo", level: 3, stage: "trusted", mastered: true, unread: 2, referral_waiting: false, focus: null, open_trial: null, power: {name: "Step Forward", earned: true}},
        {species_profile_id: "s2", animal: "Meerkat", referral_waiting: true},
        {animal: "No id"}
    ]);
    assert.equal(rows.length, 2);
    assert.equal(companionSummaryName(rows[0]), "Leo the African Lion");
    assert.equal(rows[0].stageLabel, "Trusted");
    assert.equal(rows[0].powerEarned, true);
    assert.equal(rows[1].level, 1);
    assert.equal(companionLevelsBySpecies(rows).get(SPECIES)?.level, 3);
    assert.deepEqual(decodeCompanionSummaries("oops"), []);
});

test("a row's status line is the first that applies", () => {
    const row = {unread: 0, referralWaiting: false, openTrial: null as string | null, focus: null as string | null};
    assert.deepEqual(companionStatusLine({...row, unread: 1}, "I found a warm rock."), {text: "I found a warm rock.", unread: true});
    assert.equal(companionStatusLine({...row, unread: 1, referralWaiting: true}).text, "Sent your way: tap to hear its take");
    assert.equal(companionStatusLine({...row, openTrial: "Walk the long way", focus: "Sleep"}).text, "Your step: Walk the long way");
    assert.equal(companionStatusLine({...row, focus: "Sleep"}).text, "Working on: Sleep");
    assert.equal(companionStatusLine(row).text, "Say hello");
});

test("the chat's bond carries the level", () => {
    assert.deepEqual(decodeChatBond({stage: "met", stage_index: 0, stage_label: "Met", level: 2, strands: {lesson: 10}}), {
        stage: "met",
        stageLabel: "Met",
        level: 2,
        mastered: false,
        strands: {lesson: 10, practice: 0, life: 0}
    });
    assert.equal(bondChipText({level: null, stageLabel: "Met"}), "Met");
    assert.equal(decodeChatBond({level: 2}), null);
    assert.equal(bondStageLabel("long_standing"), "Long-standing");
});

test("your own cards show their animal's bond level, by species id then slug, else their own", () => {
    const rows = decodeCompanionSummaries([
        {species_profile_id: SPECIES, slug: "african-lion", animal: "African Lion", level: 6},
        {species_profile_id: "s2", slug: "meerkat", animal: "Meerkat", level: 3}
    ]);
    assert.equal(ownCardLevel(rows, {speciesProfileId: SPECIES.toUpperCase()}, 1), 6);
    // A folded profile id still finds its animal by slug, in either spelling.
    assert.equal(ownCardLevel(rows, {speciesProfileId: "folded-id", speciesSlug: "african_lion"}, 2), 6);
    assert.equal(ownCardLevel(rows, {speciesSlug: "Meerkat"}, 9), 3);
    assert.equal(ownCardLevel(rows, {speciesProfileId: "unknown", speciesSlug: "okapi"}, 4), 4);
    assert.equal(ownCardLevel([], {speciesProfileId: SPECIES}, 5), 5);
});

test("a row with a referral waiting opens its chat on the referral", () => {
    const REFERRAL = "8a3c4c55-1d9e-4f3a-9c41-2f1d2b3c4d5e";
    const CAPTURE = "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d";
    const [waiting, plain, malformed, noCard] = decodeCompanionSummaries([
        {species_profile_id: SPECIES, capture_id: CAPTURE, animal: "Meerkat", referral_waiting: true, referral_id: REFERRAL.toUpperCase()},
        {species_profile_id: "s2", capture_id: CAPTURE, animal: "Lion", referral_waiting: false, referral_id: null},
        {species_profile_id: "s3", capture_id: CAPTURE, animal: "Okapi", referral_waiting: true, referral_id: 42},
        {species_profile_id: "s4", animal: "Tapir", referral_waiting: true, referral_id: REFERRAL}
    ]);
    assert.equal(waiting.referralId, REFERRAL);
    assert.equal(companionRowHref(waiting), `/app/capture/${CAPTURE}?referral=${REFERRAL}`);
    assert.equal(plain.referralId, null);
    assert.equal(companionRowHref(plain), `/app/capture/${CAPTURE}?talk=1`);
    // A malformed id is no referral: the row still opens the chat.
    assert.equal(malformed.referralId, null);
    assert.equal(companionRowHref(malformed), `/app/capture/${CAPTURE}?talk=1`);
    assert.equal(companionRowHref(noCard), null);
});

test("frequencies read as difficulty", () => {
    assert.equal(trialDifficulty("LOW"), "Easy");
    assert.equal(trialDifficulty("mid"), "Medium");
    assert.equal(trialDifficulty("HIGH"), "Hard");
    assert.equal(trialDifficulty(null), null);
});

test("bond copy matches the SPEC word for word", () => {
    assert.equal(BOND_COPY.noFocus.replace("{name}", "Leo"), "Tell Leo what's going on in your life and it will pick something to work on with you.");
    assert.equal(BOND_COPY.livesItsLesson, "You live its lesson.");
    assert.equal(BOND_COPY.askAboutTrialMessage.replace("{difficulty}", "Easy"), "Tell me about your Easy Trial.");
    assert.equal(BOND_COPY.battleLocked.replace("{name}", "Leo"), "Earn Leo's Power to battle with it.");
    assert.equal(COMPANIONS_COPY.empty, "Capture an animal to meet your first companion.");
    assert.equal(COMPANIONS_COPY.masteredCount.replace("{n}", "2"), "2 mastered");
});
