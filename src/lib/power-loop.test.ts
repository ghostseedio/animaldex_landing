import assert from "node:assert/strict";
import test from "node:test";
import {
    POWER_LOOP_COPY,
    type PowerLoopInput,
    levelReached,
    oneTimeLevelLine,
    powerLoop,
    remainingTrialRewards,
    trialXP,
    winsToLevelLine,
    winsToNextLevel
} from "@/lib/power-loop";
import {MAX_ANIMAL_LEVEL_XP, animalLevel, xpForAnimalLevel} from "@/lib/animal-level";

const TRAINING = {available: true, completed: false, rewardXP: 10, rewardCredits: 1, questionCount: 3};

const TRIALS: PowerLoopInput["trials"] = [
    {status: "notStarted", rewardClass: "xp_small", rewardCredits: 3},
    {status: "notStarted", rewardClass: "xp_standard", rewardCredits: 5}
];

function input(overrides: Partial<PowerLoopInput> = {}): PowerLoopInput {
    return {
        xp: 0,
        training: TRAINING,
        trials: TRIALS,
        powerEarned: false,
        hasPowerToEarn: true,
        stake: 10,
        fusionCost: 4,
        ...overrides
    };
}

test("Trial XP is 5 for xp_small, else 10; only unfinished Trials count", () => {
    assert.equal(trialXP({rewardClass: "xp_small"}), 5);
    assert.equal(trialXP({rewardClass: "xp_large"}), 10);
    assert.equal(trialXP({rewardClass: ""}), 10);
    assert.deepEqual(remainingTrialRewards(TRIALS), {xp: 15, credits: 8});
    assert.deepEqual(
        remainingTrialRewards([{...TRIALS[0], status: "completed"}, TRIALS[1]]),
        {xp: 10, credits: 5}
    );
});

test("level helpers use the shared curve", () => {
    // Level 2 needs 1 XP, level 3 needs 1, level 4 needs 3, level 5 needs 4.
    assert.equal(xpForAnimalLevel(5), 4);
    assert.equal(levelReached(0, 10), animalLevel(10));
    assert.equal(levelReached(25, 25), null);
    assert.equal(oneTimeLevelLine(0, 10), `Lv 1 → Lv ${animalLevel(10)}`);
    // 100 XP is level 21; level 22 needs 111.
    assert.equal(animalLevel(100), 21);
    assert.equal(oneTimeLevelLine(100, 105), "6 XP to Lv 22");
    assert.equal(oneTimeLevelLine(MAX_ANIMAL_LEVEL_XP, MAX_ANIMAL_LEVEL_XP + 10), "Max level");
    assert.equal(winsToNextLevel(100), 2);
    assert.equal(winsToNextLevel(110), 1);
    assert.equal(winsToNextLevel(MAX_ANIMAL_LEVEL_XP), null);
    assert.equal(winsToLevelLine(1), "Lv↑ in 1 win");
    assert.equal(winsToLevelLine(3), "Lv↑ in 3 wins");
});

test("Training current: Training is next, Trials upcoming, repeat steps upcoming", () => {
    const loop = powerLoop(input({xp: 100}));
    assert.deepEqual(loop.steps.map((step) => step.status), ["current", "upcoming", "upcoming", "upcoming"]);
    assert.deepEqual(loop.steps[0].caption, ["+10 XP", "+1 Credit"]);
    assert.deepEqual(loop.steps[1].caption, ["+15 XP", "+8 Credits"]);
    assert.deepEqual(loop.steps[2].caption, ["+10 XP a win", "+3 XP a loss"]);
    assert.deepEqual(loop.steps[3].caption, ["New Power", "Costs 4 Credits"]);
    // 100 → 110 stays on 21 (22 needs 111); 110 → 125 reaches 23.
    assert.equal(loop.steps[0].levelChip, null);
    assert.equal(loop.steps[1].levelChip, "Lv 23");
    assert.equal(loop.steps[1].levelChipHasArrow, true);
    // From 125 (level 23, 24 needs 133): 8 XP → 1 win.
    assert.equal(loop.steps[2].levelChip, "Lv↑ in 1 win");
    assert.equal(loop.steps[3].levelChip, null);
    assert.deepEqual(loop.next, {
        step: "training",
        title: "Next: Training",
        sentence: "Answer 3 quick questions about this animal's Power.",
        reward: "+10 XP · +1 Credit",
        level: "1 XP to Lv 22",
        stake: null
    });
});

test("Training crossing a level shows a chip and a rise line", () => {
    const loop = powerLoop(input({xp: 0}));
    assert.equal(loop.steps[0].levelChip, `Lv ${animalLevel(10)}`);
    assert.equal(loop.next.level, `Lv 1 → Lv ${animalLevel(10)}`);
});

test("Trials current once Training is done; the preview starts from the card's XP", () => {
    const loop = powerLoop(input({xp: 100, training: {...TRAINING, completed: true}}));
    assert.deepEqual(loop.steps.map((step) => step.status), ["done", "current", "upcoming", "upcoming"]);
    assert.deepEqual(loop.steps[0].caption, ["Training complete"]);
    assert.equal(loop.next.step, "trials");
    assert.equal(loop.next.title, "Next: Trials");
    assert.equal(loop.next.sentence, POWER_LOOP_COPY.trialsSentence);
    assert.equal(loop.next.reward, "+15 XP · +8 Credits");
    // 100 → 115 reaches 22.
    assert.equal(loop.next.level, "Lv 21 → Lv 22");
    assert.equal(
        loop.accessibilityLabel,
        "Power Loop. Step 1 Training, done. Step 2 Trials, current, plus 15 XP and 8 Credits, reaches level 22. Step 3 Battles, upcoming, plus 10 XP a win and 3 XP a loss, Lv↑ in 1 win. Step 4 Fusion, upcoming, New Power and Costs 4 Credits."
    );
});

test("unavailable Training is done and Not needed", () => {
    const loop = powerLoop(input({training: {...TRAINING, available: false}}));
    assert.equal(loop.steps[0].status, "done");
    assert.deepEqual(loop.steps[0].caption, ["Not needed"]);
    assert.equal(loop.next.step, "trials");
    // A failed Training read gates nothing either.
    assert.equal(powerLoop(input({training: null})).steps[0].status, "done");
});

test("Power earned: Battles is next with the stake; Battles and Fusion repeat", () => {
    const loop = powerLoop(input({xp: 100, training: {...TRAINING, completed: true}, powerEarned: true}));
    assert.deepEqual(loop.steps.map((step) => step.status), ["done", "done", "current", "current"]);
    assert.deepEqual(loop.steps[1].caption, ["Power earned"]);
    assert.equal(loop.steps[1].levelChip, null);
    assert.equal(loop.steps[2].repeats, true);
    // Fusion opens with Battles, also repeating.
    assert.equal(loop.steps[3].status, "current");
    assert.equal(loop.steps[3].repeats, true);
    assert.equal(loop.steps[2].levelChip, "Lv↑ in 2 wins");
    assert.deepEqual(loop.next, {
        step: "battles",
        title: "Next: Battles",
        sentence: POWER_LOOP_COPY.battlesSentence,
        reward: "+10 XP a win · +3 XP a loss",
        level: "Lv↑ in 2 wins",
        stake: "Stake 10 Credits"
    });
});

test("a completed Trial also marks Trials done; unknown stake and cost fall back", () => {
    const loop = powerLoop(input({
        training: {...TRAINING, completed: true},
        trials: [{...TRIALS[0], status: "completed"}, TRIALS[1]],
        stake: null,
        fusionCost: null
    }));
    assert.equal(loop.steps[1].status, "done");
    assert.equal(loop.next.stake, "Credits are staked");
    assert.deepEqual(loop.steps[3].caption, ["New Power", "Costs Credits"]);
});

test("max level shows no chips and says Max level", () => {
    const loop = powerLoop(input({xp: MAX_ANIMAL_LEVEL_XP, training: {...TRAINING, completed: true}, powerEarned: true}));
    assert.ok(loop.steps.every((step) => step.levelChip === null));
    assert.equal(loop.next.level, "Max level");
    const owed = powerLoop(input({xp: MAX_ANIMAL_LEVEL_XP}));
    assert.ok(owed.steps.every((step) => step.levelChip === null));
    assert.equal(owed.next.level, "Max level");
});

test("nothing to earn: Trials are Not needed and Battles open", () => {
    const loop = powerLoop(input({training: null, trials: [], hasPowerToEarn: false}));
    assert.deepEqual(loop.steps[1].caption, ["Not needed"]);
    assert.equal(loop.next.step, "battles");
});

test("a Power with no Trial: Trials caption is Apply It Your Way, with no chip", () => {
    const loop = powerLoop(input({xp: 0, training: {...TRAINING, completed: true}, trials: []}));
    assert.equal(loop.steps[1].status, "current");
    assert.deepEqual(loop.steps[1].caption, ["Apply It Your Way"]);
    assert.equal(loop.steps[1].levelChip, null);
    assert.equal(loop.next.step, "trials");
});

test("Apply It Your Way is also the Next reward, with no level line (iOS)", () => {
    const loop = powerLoop(input({xp: 0, training: {...TRAINING, completed: true}, trials: []}));
    assert.equal(loop.next.reward, "Apply It Your Way");
    assert.equal(loop.next.level, null);
    assert.match(loop.accessibilityLabel, /Step 2 Trials, current, Apply It Your Way\. /);
});

test("a step worth no XP has no level line; max level still says so", () => {
    assert.equal(oneTimeLevelLine(100, 100), null);
    assert.equal(oneTimeLevelLine(MAX_ANIMAL_LEVEL_XP, MAX_ANIMAL_LEVEL_XP), "Max level");
    const loop = powerLoop(input({xp: 100, training: {...TRAINING, rewardXP: 0, rewardCredits: 0}}));
    assert.equal(loop.next.step, "training");
    assert.equal(loop.next.level, null);
    assert.equal(loop.next.reward, "");
});

test("the spoken bar matches iOS: upcoming steps say what they pay, Battles its wins", () => {
    const owed = powerLoop(input({xp: 100}));
    assert.ok(owed.accessibilityLabel.startsWith("Power Loop. Step 1 Training, current, plus 10 XP and 1 Credit. Step 2 Trials, upcoming, plus 15 XP and 8 Credits, reaches level 23."));
    assert.ok(owed.accessibilityLabel.includes("Step 3 Battles, upcoming, plus 10 XP a win and 3 XP a loss, Lv↑ in 1 win."));
    assert.ok(owed.accessibilityLabel.endsWith("Step 4 Fusion, upcoming, New Power and Costs 4 Credits."));

    // iOS PowerLoopTests: 4 XP, nothing owed, Power earned.
    const open = powerLoop(input({xp: 4, training: null, trials: [], powerEarned: true, fusionCost: null}));
    assert.ok(open.accessibilityLabel.includes("Step 3 Battles, current, repeats, plus 10 XP a win and 3 XP a loss, Lv↑ in 1 win"));
    assert.ok(open.accessibilityLabel.endsWith("Step 4 Fusion, current, repeats, New Power and Costs Credits."));
});

// MARK: - Fused Powers (FUSED_SPEC B)

const FUSED = {pending: 1, firstId: "lp-1", firstName: "Lookout Turn", firstStage: "training" as const, firstXP: 20, firstCredits: 3};

test("the repeat line names fused Powers' own Training and Trial", () => {
    assert.equal(
        POWER_LOOP_COPY.repeatLine,
        "Each fused Power brings its own Training and Trial. Battles repeat as often as you like."
    );
});

test("a pending fused Power makes Fusion current with '{n} to finish'", () => {
    // Training still owed: Fusion is current anyway, and Next stays on Training.
    const owed = powerLoop(input({xp: 100, fused: FUSED}));
    assert.equal(owed.steps[3].status, "current");
    assert.deepEqual(owed.steps[3].caption, ["1 to finish", "Costs 4 Credits"]);
    assert.equal(owed.next.step, "training");
    // Battles count from 100 + 10 Training + 15 Trials + 20 fused = 145 (Lv 25, 26 needs 157): 2 wins.
    assert.equal(owed.steps[2].levelChip, "Lv↑ in 2 wins");
    assert.equal(powerLoop(input({xp: 100})).steps[2].levelChip, "Lv↑ in 1 win");

    // Trials still open: Fusion is current too, and Next stays on Trials.
    const trialsOpen = powerLoop(input({xp: 100, training: {...TRAINING, completed: true}, fused: FUSED}));
    assert.deepEqual(trialsOpen.steps.map((step) => step.status), ["done", "current", "upcoming", "current"]);
    assert.equal(trialsOpen.next.step, "trials");

    const two = powerLoop(input({xp: 100, fused: {...FUSED, pending: 2}}));
    assert.deepEqual(two.steps[3].caption, ["2 to finish", "Costs 4 Credits"]);

    // None pending: unchanged.
    const none = powerLoop(input({xp: 100, fused: {...FUSED, pending: 0}}));
    assert.deepEqual(none.steps[3].caption, ["New Power", "Costs 4 Credits"]);
    assert.equal(none.steps[3].status, "upcoming");
});

test("both one-time steps done and a fused Power pending: Next is Finish {name}", () => {
    const loop = powerLoop(input({xp: 100, training: {...TRAINING, completed: true}, powerEarned: true, fused: FUSED}));
    assert.equal(loop.steps[3].status, "current");
    // 100 (level 21) → 120 reaches 22, which needs 111.
    assert.equal(loop.steps[3].levelChip, `Lv ${animalLevel(120)}`);
    assert.equal(loop.steps[3].levelChipHasArrow, true);
    // Battles count from 120 (Lv 22, 23 needs 121): 1 win.
    assert.equal(loop.steps[2].levelChip, "Lv↑ in 1 win");
    assert.deepEqual(loop.next, {
        step: "fusion",
        title: "Next: Finish Lookout Turn",
        sentence: "Train it, then prove it. Its boost switches on when it's earned.",
        reward: "+20 XP · +3 Credits",
        level: `Lv 21 → Lv ${animalLevel(120)}`,
        stake: null,
        fusedPowerId: "lp-1",
        button: "Finish Lookout Turn"
    });
    assert.ok(loop.accessibilityLabel.endsWith(`Step 4 Fusion, current, 1 to finish, plus 20 XP, reaches level ${animalLevel(120)}.`));
});

test("a fused Power already trained pays only its earn XP; a long name says Continue", () => {
    const loop = powerLoop(input({
        xp: 100,
        training: {...TRAINING, completed: true},
        powerEarned: true,
        fused: {...FUSED, firstStage: "proving", firstXP: 10, firstCredits: 1, firstName: "Patient Lookout"}
    }));
    assert.equal(loop.next.reward, "+10 XP · +1 Credit");
    assert.equal(loop.next.title, "Next: Finish Patient Lookout");
    assert.equal(loop.next.button, "Continue");
    assert.equal(loop.next.level, "1 XP to Lv 22");
    assert.equal(loop.steps[3].levelChip, null);
    assert.ok(loop.accessibilityLabel.endsWith("Step 4 Fusion, current, 1 to finish, plus 10 XP."));
});
