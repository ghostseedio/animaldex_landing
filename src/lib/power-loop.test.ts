import assert from "node:assert/strict";
import test from "node:test";
import {
    POWER_LOOP_COPY,
    type PowerLoopInput,
    levelReached,
    oneTimeLevelLine,
    powerLoop,
    remainingTrialRewards,
    stepEyebrow,
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

test("Train current: Train is next, Prove it and Battle & Fuse upcoming", () => {
    const loop = powerLoop(input({xp: 100}));
    assert.equal(loop.viewer, "ownCard");
    assert.deepEqual(loop.steps.map((step) => step.id), ["train", "prove", "battleFuse"]);
    assert.deepEqual(loop.steps.map((step) => step.title), ["Train", "Prove it", "Battle & Fuse"]);
    assert.deepEqual(loop.steps.map((step) => step.status), ["current", "upcoming", "upcoming"]);
    assert.deepEqual(loop.steps[0].caption, ["+10 XP", "+1 Credit"]);
    assert.deepEqual(loop.steps[1].caption, ["+15 XP", "+8 Credits"]);
    assert.deepEqual(loop.steps[2].caption, ["+10 XP a win", "Fuse new Powers"]);
    assert.equal(loop.steps[2].repeats, true);
    // 100 → 110 stays on 21 (22 needs 111); 110 → 125 reaches 23.
    assert.equal(loop.steps[0].levelChip, null);
    assert.equal(loop.steps[1].levelChip, "Lv 23");
    assert.equal(loop.steps[1].levelChipHasArrow, true);
    // From 125 (level 23, 24 needs 133): 8 XP → 1 win.
    assert.equal(loop.steps[2].levelChip, "Lv↑ in 1 win");
    assert.deepEqual(loop.next, {
        step: "train",
        action: "startTraining",
        title: "Next: Train",
        sentence: "Answer 3 quick questions about this animal's Power.",
        reward: "+10 XP · +1 Credit",
        level: "1 XP to Lv 22",
        stake: null,
        button: "Start Training"
    });
});

test("Training crossing a level shows a chip and a rise line", () => {
    const loop = powerLoop(input({xp: 0}));
    assert.equal(loop.steps[0].levelChip, `Lv ${animalLevel(10)}`);
    assert.equal(loop.next.level, `Lv 1 → Lv ${animalLevel(10)}`);
});

test("Prove it current once Training is done; the preview starts from the card's XP", () => {
    const loop = powerLoop(input({xp: 100, training: {...TRAINING, completed: true}}));
    assert.deepEqual(loop.steps.map((step) => step.status), ["done", "current", "upcoming"]);
    assert.deepEqual(loop.steps[0].caption, ["Training complete"]);
    assert.equal(loop.next.step, "prove");
    assert.equal(loop.next.action, "proveIt");
    assert.equal(loop.next.title, "Next: Prove it");
    assert.equal(loop.next.button, "Prove it");
    assert.equal(loop.next.sentence, POWER_LOOP_COPY.trialsSentence);
    assert.equal(loop.next.reward, "+15 XP · +8 Credits");
    // 100 → 115 reaches 22.
    assert.equal(loop.next.level, "Lv 21 → Lv 22");
    assert.equal(
        loop.accessibilityLabel,
        "Power Loop. Step 1 Train, done. Step 2 Prove it, current, plus 15 XP and 8 Credits, reaches level 22. Step 3 Battle and Fuse, upcoming, repeats."
    );
});

test("unavailable Training is done and Not needed", () => {
    const loop = powerLoop(input({training: {...TRAINING, available: false}}));
    assert.equal(loop.steps[0].status, "done");
    assert.deepEqual(loop.steps[0].caption, ["Not needed"]);
    assert.equal(loop.next.step, "prove");
    // A failed Training read gates nothing either.
    assert.equal(powerLoop(input({training: null})).steps[0].status, "done");
});

test("Power earned: Battle & Fuse is current, repeats, never done; Next carries the stake", () => {
    const loop = powerLoop(input({xp: 100, training: {...TRAINING, completed: true}, powerEarned: true}));
    assert.deepEqual(loop.steps.map((step) => step.status), ["done", "done", "current"]);
    assert.deepEqual(loop.steps[1].caption, ["Power earned"]);
    assert.equal(loop.steps[1].levelChip, null);
    assert.equal(loop.steps[2].levelChip, "Lv↑ in 2 wins");
    assert.deepEqual(loop.next, {
        step: "battleFuse",
        action: "battleAndFuse",
        title: "Next: Battle & Fuse",
        sentence: POWER_LOOP_COPY.battlesSentence,
        reward: "+10 XP a win · +3 XP a loss",
        level: "Lv↑ in 2 wins",
        stake: "Stake 10 Credits"
    });
    assert.ok(loop.accessibilityLabel.endsWith("Step 3 Battle and Fuse, current, repeats."));
});

test("a completed Trial also marks Prove it done; an unknown stake falls back", () => {
    const loop = powerLoop(input({
        training: {...TRAINING, completed: true},
        trials: [{...TRIALS[0], status: "completed"}, TRIALS[1]],
        stake: null
    }));
    assert.equal(loop.steps[1].status, "done");
    assert.equal(loop.next.stake, "Credits are staked");
});

test("max level shows no chips and says Max level", () => {
    const loop = powerLoop(input({xp: MAX_ANIMAL_LEVEL_XP, training: {...TRAINING, completed: true}, powerEarned: true}));
    assert.ok(loop.steps.every((step) => step.levelChip === null));
    assert.equal(loop.next.level, "Max level");
    const owed = powerLoop(input({xp: MAX_ANIMAL_LEVEL_XP}));
    assert.ok(owed.steps.every((step) => step.levelChip === null));
    assert.equal(owed.next.level, "Max level");
});

test("nothing to earn: Prove it is Not needed and Battle & Fuse opens", () => {
    const loop = powerLoop(input({training: null, trials: [], hasPowerToEarn: false}));
    assert.deepEqual(loop.steps[1].caption, ["Not needed"]);
    assert.equal(loop.next.step, "battleFuse");
});

test("a Power with no Trial: Prove it caption is Apply It Your Way, with no chip", () => {
    const loop = powerLoop(input({xp: 0, training: {...TRAINING, completed: true}, trials: []}));
    assert.equal(loop.steps[1].status, "current");
    assert.deepEqual(loop.steps[1].caption, ["Apply It Your Way"]);
    assert.equal(loop.steps[1].levelChip, null);
    assert.equal(loop.next.step, "prove");
    assert.equal(loop.next.reward, "Apply It Your Way");
    assert.equal(loop.next.level, null);
    assert.match(loop.accessibilityLabel, /Step 2 Prove it, current, Apply It Your Way\. /);
});

test("a step worth no XP has no level line; max level still says so", () => {
    assert.equal(oneTimeLevelLine(100, 100), null);
    assert.equal(oneTimeLevelLine(MAX_ANIMAL_LEVEL_XP, MAX_ANIMAL_LEVEL_XP), "Max level");
    const loop = powerLoop(input({xp: 100, training: {...TRAINING, rewardXP: 0, rewardCredits: 0}}));
    assert.equal(loop.next.step, "train");
    assert.equal(loop.next.level, null);
    assert.equal(loop.next.reward, "");
});

test("the spoken bar follows the three steps (spec example)", () => {
    const loop = powerLoop(input({xp: 3, training: {...TRAINING, completed: true}}));
    const reached = animalLevel(3 + 15);
    assert.equal(
        loop.accessibilityLabel,
        `Power Loop. Step 1 Train, done. Step 2 Prove it, current, plus 15 XP and 8 Credits, reaches level ${reached}. Step 3 Battle and Fuse, upcoming, repeats.`
    );
    const owed = powerLoop(input({xp: 100}));
    assert.ok(owed.accessibilityLabel.startsWith("Power Loop. Step 1 Train, current, plus 10 XP and 1 Credit. Step 2 Prove it, upcoming, plus 15 XP and 8 Credits, reaches level 23."));
});

// MARK: - Viewer contexts

test("own card is the default viewer", () => {
    assert.deepEqual(powerLoop(input({xp: 100})), powerLoop(input({xp: 100, viewer: "ownCard"})));
});

test("animal page, caught, with no card XP: the state shows, no chips, no level lines, Fuse new Powers", () => {
    const owed = powerLoop(input({viewer: "animalPageCaught", xp: null, stake: null, fused: FUSED_PENDING()}));
    assert.deepEqual(owed.steps.map((step) => step.status), ["current", "upcoming", "upcoming"]);
    assert.ok(owed.steps.every((step) => step.levelChip === null));
    assert.equal(owed.next.action, "startTraining");
    assert.equal(owed.next.level, null);
    // Fused Powers are per card: the animal page never counts them.
    assert.deepEqual(owed.steps[2].caption, ["+10 XP a win", "Fuse new Powers"]);

    const open = powerLoop(input({viewer: "animalPageCaught", xp: null, stake: null, training: {...TRAINING, completed: true}, powerEarned: true}));
    assert.deepEqual(open.steps.map((step) => step.status), ["done", "done", "current"]);
    assert.equal(open.next.action, "battleAndFuse");
    assert.equal(open.next.title, "Next: Battle & Fuse");
    assert.equal(open.next.level, null);
    assert.equal(open.next.stake, "Credits are staked");

    // With the card's XP to hand, chips come back.
    const withXP = powerLoop(input({viewer: "animalPageCaught", xp: 100}));
    assert.equal(withXP.steps[1].levelChip, "Lv 23");
});

test("animal page, not caught: all upcoming with rewards, Next: Catch it, no button", () => {
    const loop = powerLoop(input({viewer: "animalPageNotCaught", xp: null, stake: null}));
    assert.deepEqual(loop.steps.map((step) => step.status), ["upcoming", "upcoming", "upcoming"]);
    assert.deepEqual(loop.steps[0].caption, ["+10 XP", "+1 Credit"]);
    assert.deepEqual(loop.steps[1].caption, ["+15 XP", "+8 Credits"]);
    assert.deepEqual(loop.steps[2].caption, ["+10 XP a win", "Fuse new Powers"]);
    assert.ok(loop.steps.every((step) => step.levelChip === null));
    assert.deepEqual(loop.next, {
        step: "train",
        action: "none",
        title: "Next: Catch it",
        sentence: "Capture this animal to start.",
        reward: "",
        level: null,
        stake: null
    });
    // Even an XP passed by mistake previews nothing for someone without the animal.
    assert.ok(powerLoop(input({viewer: "animalPageNotCaught", xp: 100})).steps.every((step) => step.levelChip === null));
});

test("signed out: all upcoming with rewards, Next: Train, Sign in to start Training", () => {
    const loop = powerLoop(input({viewer: "signedOut", xp: null, stake: null}));
    assert.deepEqual(loop.steps.map((step) => step.status), ["upcoming", "upcoming", "upcoming"]);
    assert.ok(loop.steps.every((step) => step.levelChip === null));
    assert.deepEqual(loop.next, {
        step: "train",
        action: "signIn",
        title: "Next: Train",
        sentence: "Sign in to start.",
        reward: "+10 XP · +1 Credit",
        level: null,
        stake: null,
        button: "Sign in to start Training"
    });
    assert.equal(
        loop.accessibilityLabel,
        "Power Loop. Step 1 Train, upcoming, plus 10 XP and 1 Credit. Step 2 Prove it, upcoming, plus 15 XP and 8 Credits. Step 3 Battle and Fuse, upcoming, repeats."
    );
    // An animal with no Training starts at Prove it.
    const noTraining = powerLoop(input({viewer: "signedOut", xp: null, training: null}));
    assert.equal(noTraining.steps[0].status, "upcoming");
    assert.deepEqual(noTraining.steps[0].caption, ["Not needed"]);
    assert.equal(noTraining.next.title, "Next: Prove it");
    assert.equal(noTraining.next.action, "signIn");
});

test("STEP eyebrows read STEP n · TITLE", () => {
    assert.equal(stepEyebrow(1, POWER_LOOP_COPY.train), "STEP 1 · TRAIN");
    assert.equal(stepEyebrow(2, POWER_LOOP_COPY.proveIt), "STEP 2 · PROVE IT");
    assert.equal(stepEyebrow(3, POWER_LOOP_COPY.battleAndFuse), "STEP 3 · BATTLE & FUSE");
});

// MARK: - Fused Powers (FUSED_SPEC B)

const FUSED = {pending: 1, firstId: "lp-1", firstName: "Lookout Turn", firstStage: "training" as const, firstXP: 20, firstCredits: 3};
function FUSED_PENDING() {
    return {...FUSED};
}

test("the repeat line says the loop starts again", () => {
    assert.equal(
        POWER_LOOP_COPY.repeatLine,
        "Battles repeat as often as you like. Each fused Power brings its own Training and Trial, so the loop starts again."
    );
    assert.equal(POWER_LOOP_COPY.subtitle, "Train, prove it, then battle and fuse. Every fused Power starts the loop again.");
});

test("a pending fused Power makes Battle & Fuse current with '{n} to finish'", () => {
    // Training still owed: Battle & Fuse is current anyway, and Next stays on Train.
    const owed = powerLoop(input({xp: 100, fused: FUSED}));
    assert.deepEqual(owed.steps.map((step) => step.status), ["current", "upcoming", "current"]);
    assert.deepEqual(owed.steps[2].caption, ["+10 XP a win", "1 to finish"]);
    assert.equal(owed.next.step, "train");
    // Battles count from 100 + 10 Training + 15 Trials + 20 fused = 145 (Lv 25, 26 needs 157): 2 wins.
    assert.equal(owed.steps[2].levelChip, "Lv↑ in 2 wins");
    assert.equal(powerLoop(input({xp: 100})).steps[2].levelChip, "Lv↑ in 1 win");

    // Trials still open: current too, and Next stays on Prove it.
    const trialsOpen = powerLoop(input({xp: 100, training: {...TRAINING, completed: true}, fused: FUSED}));
    assert.deepEqual(trialsOpen.steps.map((step) => step.status), ["done", "current", "current"]);
    assert.equal(trialsOpen.next.step, "prove");

    const two = powerLoop(input({xp: 100, fused: {...FUSED, pending: 2}}));
    assert.deepEqual(two.steps[2].caption, ["+10 XP a win", "2 to finish"]);

    // None pending: unchanged.
    const none = powerLoop(input({xp: 100, fused: {...FUSED, pending: 0}}));
    assert.deepEqual(none.steps[2].caption, ["+10 XP a win", "Fuse new Powers"]);
    assert.equal(none.steps[2].status, "upcoming");
});

test("both one-time steps done and a fused Power pending: Next is Finish {name}", () => {
    const loop = powerLoop(input({xp: 100, training: {...TRAINING, completed: true}, powerEarned: true, fused: FUSED}));
    assert.equal(loop.steps[2].status, "current");
    // Battles count from 120 (Lv 22, 23 needs 121): 1 win.
    assert.equal(loop.steps[2].levelChip, "Lv↑ in 1 win");
    assert.deepEqual(loop.next, {
        step: "battleFuse",
        action: "finishFused",
        title: "Next: Finish Lookout Turn",
        sentence: "Train it, then prove it. Its boost switches on when it's earned.",
        reward: "+20 XP · +3 Credits",
        level: `Lv 21 → Lv ${animalLevel(120)}`,
        stake: null,
        fusedPowerId: "lp-1",
        button: "Finish Lookout Turn"
    });
    assert.ok(loop.accessibilityLabel.endsWith(`Step 3 Battle and Fuse, current, repeats, 1 to finish, plus 20 XP, reaches level ${animalLevel(120)}.`));
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
    assert.ok(loop.accessibilityLabel.endsWith("Step 3 Battle and Fuse, current, repeats, 1 to finish, plus 10 XP."));
});
