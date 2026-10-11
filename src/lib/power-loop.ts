/**
 * The Power Loop: the journey bar at the top of an animal's Play tab. Training,
 * then a Trial, then Battles, then Fusion — and the last two repeat. Same spec
 * as iOS and Android, so the copy and the numbers below are word for word what
 * they show.
 *
 * Everything here is pure: the bar is built from data the Play tab already
 * loads (the card's XP, the Training read, the Trials list, the earned Power,
 * the stake and the fusion cost). The level curve is `animal-level.ts`'s, never
 * a copy of it.
 */

import {MAX_ANIMAL_LEVEL, animalLevel, xpForAnimalLevel} from "@/lib/animal-level";
import type {AnimalTrial} from "@/lib/animal-trials";
import {TRAINING_COPY, trainingIntroText, trainingRewardLine} from "@/lib/species-training";

// MARK: - Copy (identical on iOS, Android and web)

export const POWER_LOOP_COPY = {
    title: "Power Loop",
    subtitle: "Train, pass a Trial, battle, then fuse. Then do it again.",
    training: "Training",
    trials: "Trials",
    battles: "Battles",
    fusion: "Fusion",
    notNeeded: "Not needed",
    powerEarned: "Power earned",
    trainingComplete: TRAINING_COPY.complete,
    applyItYourWay: "Apply It Your Way",
    newPower: "New Power",
    costsCredits: "Costs Credits",
    creditsStaked: "Credits are staked",
    repeatLine: "Battles and Fusion repeat as often as you like. Every new animal starts a new loop.",
    trialsSentence: "Prove the Power in real life. One Trial earns it.",
    battlesSentence: "Put this animal up against others. Win or lose, it earns XP.",
    startTraining: TRAINING_COPY.start,
    goToTrials: "Go to Trials",
    battle: "Battle",
    fusePowers: "Fuse Powers",
    maxLevel: "Max level"
} as const;

/** Paid to the card that fought, on settlement (migration 20261011190000). */
export const BATTLE_WIN_XP = 10;
export const BATTLE_LOSS_XP = 3;

export const winXPLine = (xp: number) => `+${xp} XP a win`;
export const lossXPLine = (xp: number) => `+${xp} XP a loss`;
export const costsCreditsLine = (cost: number) => `Costs ${cost} Credits`;
export const stakeLine = (stake: number) => `Stake ${stake} Credits`;
export const nextStepTitle = (step: string) => `Next: ${step}`;
export const levelChipText = (level: number) => `Lv ${level}`;
export const levelRiseLine = (from: number, to: number) => `Lv ${from} → Lv ${to}`;
export const xpToLevelLine = (xp: number, level: number) => `${xp} XP to Lv ${level}`;
export const winsToLevelLine = (wins: number) => (wins === 1 ? "Lv↑ in 1 win" : `Lv↑ in ${wins} wins`);
export const stepEyebrow = (step: number) => `STEP ${step}`;

// MARK: - Model

export type PowerLoopStepId = "training" | "trials" | "battles" | "fusion";

/** `current` on Battles and Fusion means "open, and repeatable" — they never finish. */
export type PowerLoopStepStatus = "done" | "current" | "upcoming";

export type PowerLoopStep = {
    id: PowerLoopStepId;
    number: 1 | 2 | 3 | 4;
    title: string;
    status: PowerLoopStepStatus;
    /** Battles and Fusion: a ↻ badge instead of a check. */
    repeats: boolean;
    /** At most two short lines under the label. */
    caption: string[];
    /** "Lv 5" (drawn with an up-arrow) or "Lv↑ in 3 wins". Null when no level is crossed. */
    levelChip: string | null;
    /** True for "Lv {n}" chips, which carry a separate up-arrow. */
    levelChipHasArrow: boolean;
};

export type PowerLoopNext = {
    step: PowerLoopStepId;
    title: string;
    sentence: string;
    reward: string;
    /**
     * "Lv 4 → Lv 5", "6 XP to Lv 5", "Lv↑ in 2 wins" or "Max level". Null when
     * the step pays no XP the client can preview (Apply It Your Way, a 0 XP
     * Training), as on iOS, rather than quoting a distance it does not close.
     */
    level: string | null;
    /** Battles only. */
    stake: string | null;
};

export type PowerLoop = {
    steps: PowerLoopStep[];
    next: PowerLoopNext;
    /** The whole bar as one spoken sentence. */
    accessibilityLabel: string;
};

export type PowerLoopInput = {
    /** This card's current total progression XP. */
    xp: number;
    /** `get_species_training`; null when the read failed, which gates nothing. */
    training: {available: boolean; completed: boolean; rewardXP: number; rewardCredits: number; questionCount: number} | null;
    trials: Pick<AnimalTrial, "status" | "rewardClass" | "rewardCredits">[];
    /** The same flag the Play tab uses to show "Power earned". */
    powerEarned: boolean;
    /** False when the species has no Power and no Trial: there is nothing to earn. */
    hasPowerToEarn: boolean;
    /** The card's `challenge_stake`, when known. */
    stake: number | null;
    /** The fusion UI's cost for this card, when known. */
    fusionCost: number | null;
};

// MARK: - Rewards and levels

/** Per spec: 5 XP for `xp_small`, else 10. */
export function trialXP(trial: Pick<AnimalTrial, "rewardClass">) {
    return trial.rewardClass === "xp_small" ? 5 : 10;
}

/** XP and Credits still on offer from Trials not yet completed. */
export function remainingTrialRewards(trials: PowerLoopInput["trials"]) {
    return trials
        .filter((trial) => trial.status !== "completed")
        .reduce((sum, trial) => ({
            xp: sum.xp + trialXP(trial),
            credits: sum.credits + Math.max(0, trial.rewardCredits)
        }), {xp: 0, credits: 0});
}

/** The level a one-time step reaches, or null when it crosses none (or the card is maxed). */
export function levelReached(before: number, after: number) {
    const from = animalLevel(before);
    const to = animalLevel(after);
    return from < MAX_ANIMAL_LEVEL && to > from ? to : null;
}

/**
 * The Next strip's level line for a one-time step worth `after - before` XP.
 * Null when it is worth none: there is no level line to show (iOS `levelLine`).
 */
export function oneTimeLevelLine(before: number, after: number): string | null {
    const from = animalLevel(before);
    if (from >= MAX_ANIMAL_LEVEL) return POWER_LOOP_COPY.maxLevel;
    if (Math.floor(after) <= Math.floor(before)) return null;
    const to = animalLevel(after);
    if (to > from) return levelRiseLine(from, to);
    return xpToLevelLine(xpForAnimalLevel(from + 1) - Math.floor(after), from + 1);
}

/** Wins from `xp` to the next level, at +10 each. Null at max level. */
export function winsToNextLevel(xp: number) {
    const level = animalLevel(xp);
    if (level >= MAX_ANIMAL_LEVEL) return null;
    return Math.max(1, Math.ceil((xpForAnimalLevel(level + 1) - Math.floor(xp)) / BATTLE_WIN_XP));
}

// MARK: - The loop

/**
 * The four steps, the Next strip and the spoken label.
 *
 * The level preview walks the one-time steps still owed, in order, from the
 * card's XP. Training and Trial XP land on the NEWEST visible card of this
 * animal (server `submit_species_training` / `complete_animal_trial`), so the
 * preview is exact on that card and approximate on older duplicates — an
 * accepted trade, since the bar only ever shows on the viewer's own card.
 */
export function powerLoop(input: PowerLoopInput): PowerLoop {
    const x0 = Math.max(0, Math.floor(Number.isFinite(input.xp) ? input.xp : 0));
    const training = input.training;

    // 1. Training
    const trainingNeeded = Boolean(training?.available);
    const trainingDone = !trainingNeeded || Boolean(training?.completed);
    const trainingXP = trainingDone ? 0 : Math.max(0, training?.rewardXP ?? 0);
    const x1 = x0 + trainingXP;
    const trainingReward = trainingNeeded && training
        ? trainingRewardLine(training.rewardXP, training.rewardCredits)
        : "";

    // 2. Trials
    const remaining = remainingTrialRewards(input.trials);
    const anyTrialComplete = input.trials.some((trial) => trial.status === "completed");
    const trialsNeeded = input.hasPowerToEarn || input.trials.length > 0;
    const trialsDone = !trialsNeeded || input.powerEarned || anyTrialComplete;
    const x2 = x1 + (trialsDone ? 0 : remaining.xp);
    const trialsReward = trainingRewardLine(remaining.xp, remaining.credits);
    // A Power with no Trial is earned only by Apply It Your Way, which pays no
    // XP the client can preview — so that is the caption, with no chip.
    const applyOnly = input.hasPowerToEarn && input.trials.length === 0;

    const trainingLevel = trainingDone ? null : levelReached(x0, x1);
    const trialsLevel = trialsDone || applyOnly ? null : levelReached(x1, x2);
    const wins = winsToNextLevel(x2);
    const repeatOpen = trialsDone;

    const steps: PowerLoopStep[] = [
        {
            id: "training",
            number: 1,
            title: POWER_LOOP_COPY.training,
            status: trainingDone ? "done" : "current",
            repeats: false,
            caption: !trainingNeeded
                ? [POWER_LOOP_COPY.notNeeded]
                : trainingDone ? [POWER_LOOP_COPY.trainingComplete] : splitReward(trainingReward),
            levelChip: trainingLevel == null ? null : levelChipText(trainingLevel),
            levelChipHasArrow: trainingLevel != null
        },
        {
            id: "trials",
            number: 2,
            title: POWER_LOOP_COPY.trials,
            status: trialsDone ? "done" : trainingDone ? "current" : "upcoming",
            repeats: false,
            caption: !trialsNeeded
                ? [POWER_LOOP_COPY.notNeeded]
                : trialsDone
                    ? [POWER_LOOP_COPY.powerEarned]
                    : applyOnly ? [POWER_LOOP_COPY.applyItYourWay] : splitReward(trialsReward),
            levelChip: trialsLevel == null ? null : levelChipText(trialsLevel),
            levelChipHasArrow: trialsLevel != null
        },
        {
            id: "battles",
            number: 3,
            title: POWER_LOOP_COPY.battles,
            status: repeatOpen ? "current" : "upcoming",
            repeats: true,
            caption: [winXPLine(BATTLE_WIN_XP), lossXPLine(BATTLE_LOSS_XP)],
            levelChip: wins == null ? null : winsToLevelLine(wins),
            levelChipHasArrow: false
        },
        {
            id: "fusion",
            number: 4,
            title: POWER_LOOP_COPY.fusion,
            status: repeatOpen ? "current" : "upcoming",
            repeats: true,
            // Fusion pays a stat boost's worth of XP (1–2): too small to preview.
            caption: [POWER_LOOP_COPY.newPower, input.fusionCost != null && input.fusionCost > 0 ? costsCreditsLine(input.fusionCost) : POWER_LOOP_COPY.costsCredits],
            levelChip: null,
            levelChipHasArrow: false
        }
    ];

    let next: PowerLoopNext;
    if (!trainingDone) {
        next = {
            step: "training",
            title: nextStepTitle(POWER_LOOP_COPY.training),
            sentence: trainingIntroText(training?.questionCount ?? 0),
            reward: steps[0].caption.join(" · "),
            level: oneTimeLevelLine(x0, x1),
            stake: null
        };
    } else if (!trialsDone) {
        next = {
            step: "trials",
            title: nextStepTitle(POWER_LOOP_COPY.trials),
            sentence: POWER_LOOP_COPY.trialsSentence,
            // "Apply It Your Way" for a Power with no Trial, as the node says.
            reward: steps[1].caption.join(" · "),
            level: oneTimeLevelLine(x1, x2),
            stake: null
        };
    } else {
        next = {
            step: "battles",
            title: nextStepTitle(POWER_LOOP_COPY.battles),
            sentence: POWER_LOOP_COPY.battlesSentence,
            reward: `${winXPLine(BATTLE_WIN_XP)} · ${lossXPLine(BATTLE_LOSS_XP)}`,
            level: wins == null ? POWER_LOOP_COPY.maxLevel : winsToLevelLine(wins),
            stake: input.stake != null && input.stake > 0 ? stakeLine(input.stake) : POWER_LOOP_COPY.creditsStaked
        };
    }

    const reached: Record<PowerLoopStepId, number | null> = {training: trainingLevel, trials: trialsLevel, battles: null, fusion: null};
    return {steps, next, accessibilityLabel: spokenLoop(steps, reached, wins)};
}

/** "+10 XP · +1 Credit" → ["+10 XP", "+1 Credit"], so a narrow column wraps on the dot. */
function splitReward(line: string) {
    return line ? line.split(" · ").slice(0, 2) : [];
}

/**
 * The whole bar as one sentence, word for word with iOS
 * `PowerLoopCopy.accessibilityLabel`: every step not yet done says what it
 * pays, upcoming ones included, then its level chip.
 *
 * "Power Loop. Step 1 Training, done. Step 2 Trials, current, plus 15 XP and 8
 * Credits, reaches level 5. Step 3 Battles, upcoming, plus 10 XP a win and 3 XP
 * a loss, Lv↑ in 2 wins. Step 4 Fusion, upcoming, New Power and Costs 4 Credits."
 */
function spokenLoop(steps: PowerLoopStep[], reached: Record<PowerLoopStepId, number | null>, wins: number | null) {
    const parts = steps.map((step) => {
        const status = step.status === "current" && step.repeats ? "current, repeats" : step.status;
        let sentence = `Step ${step.number} ${step.title}, ${status}`;
        if (step.status !== "done" && step.caption.length > 0) {
            // "+15 XP", "+8 Credits" → "plus 15 XP and 8 Credits".
            const spoken = step.caption.map((line) => (line.startsWith("+") ? line.slice(1) : line)).join(" and ");
            sentence += `, ${step.caption[0].startsWith("+") ? "plus " : ""}${spoken}`;
        }
        const level = reached[step.id];
        if (level != null) sentence += `, reaches level ${level}`;
        if (step.id === "battles" && wins != null) sentence += `, ${winsToLevelLine(wins)}`;
        return `${sentence}.`;
    });
    return `${POWER_LOOP_COPY.title}. ${parts.join(" ")}`;
}
