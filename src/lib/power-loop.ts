/**
 * The Power Loop: the journey bar at the top of every animal's Play tab — the
 * viewer's own card and the animal (species) page alike. Three steps: Train,
 * Prove it, then Battle & Fuse, and every fused Power starts the loop again.
 * Same spec as iOS and Android (LOOP3), so the copy and the numbers below are
 * word for word what they show.
 *
 * Everything here is pure: the bar is built from data the Play tab already
 * loads (the card's XP, the Training read, the Trials list, the earned Power,
 * the stake). The level curve is `animal-level.ts`'s, never a copy of it.
 */

import {MAX_ANIMAL_LEVEL, animalLevel, xpForAnimalLevel} from "@/lib/animal-level";
import type {AnimalTrial} from "@/lib/animal-trials";
import {FUSED_COPY, type PendingFusedSummary, finishButtonTitle, finishTitle, toFinishLine} from "@/lib/fused-powers";
import {type SpeciesTraining, TRAINING_COPY, trainingIntroText, trainingRewardLine} from "@/lib/species-training";

// MARK: - Copy (identical on iOS, Android and web)

export const POWER_LOOP_COPY = {
    title: "Power Loop",
    subtitle: "Train, prove it, then battle and fuse. Every fused Power starts the loop again.",
    train: "Train",
    proveIt: "Prove it",
    battleAndFuse: "Battle & Fuse",
    /** The step's name as a screen reader says it. */
    battleAndFuseSpoken: "Battle and Fuse",
    notNeeded: "Not needed",
    powerEarned: "Power earned",
    trainingComplete: TRAINING_COPY.complete,
    applyItYourWay: "Apply It Your Way",
    fuseNewPowers: "Fuse new Powers",
    creditsStaked: "Credits are staked",
    repeatLine: FUSED_COPY.repeatLine,
    trialsSentence: "Prove the Power in real life. One Trial earns it.",
    battlesSentence: "Put this animal up against others. Win or lose, it earns XP.",
    catchIt: "Catch it",
    catchSentence: "Capture this animal to start.",
    signInSentence: "Sign in to start.",
    signInToStart: "Sign in to start",
    proveItButton: "Prove it",
    battle: "Battle",
    fusePowers: "Fuse Powers",
    maxLevel: "Max level"
} as const;

/** Paid to the card that fought, on settlement (migration 20261011190000). */
export const BATTLE_WIN_XP = 10;
export const BATTLE_LOSS_XP = 3;

export const winXPLine = (xp: number) => `+${xp} XP a win`;
export const lossXPLine = (xp: number) => `+${xp} XP a loss`;
export const stakeLine = (stake: number) => `Stake ${stake} Credits`;
export const nextStepTitle = (step: string) => `Next: ${step}`;
export const levelChipText = (level: number) => `Lv ${level}`;
export const levelRiseLine = (from: number, to: number) => `Lv ${from} → Lv ${to}`;
export const xpToLevelLine = (xp: number, level: number) => `${xp} XP to Lv ${level}`;
export const winsToLevelLine = (wins: number) => (wins === 1 ? "Lv↑ in 1 win" : `Lv↑ in ${wins} wins`);
/** "STEP 1 · TRAIN" over a Play section (iOS "STEP %d · %@"). */
export const stepEyebrow = (step: number, title: string) => `STEP ${step} · ${title.toUpperCase()}`;

// MARK: - Model

export type PowerLoopStepId = "train" | "prove" | "battleFuse";

/** `current` on Battle & Fuse means "open, and repeatable" — it never finishes. */
export type PowerLoopStepStatus = "done" | "current" | "upcoming";

/**
 * Who is looking, and at what. The bar shows on every animal Play tab except
 * someone else's card, where the caller does not build it at all.
 */
export type PowerLoopViewer = "ownCard" | "animalPageCaught" | "animalPageNotCaught" | "signedOut";

export type PowerLoopStep = {
    id: PowerLoopStepId;
    number: 1 | 2 | 3;
    title: string;
    status: PowerLoopStepStatus;
    /** Battle & Fuse: a ↻ badge instead of a check. */
    repeats: boolean;
    /** At most two short lines under the label. */
    caption: string[];
    /** "Lv 5" (drawn with an up-arrow) or "Lv↑ in 3 wins". Null when no level is crossed. */
    levelChip: string | null;
    /** True for "Lv {n}" chips, which carry a separate up-arrow. */
    levelChipHasArrow: boolean;
};

/** What the Next strip's button does. */
export type PowerLoopAction = "train" | "proveIt" | "battleAndFuse" | "finishFused" | "signIn" | "none";

export type PowerLoopNext = {
    step: PowerLoopStepId;
    action: PowerLoopAction;
    title: string;
    sentence: string;
    reward: string;
    /**
     * "Lv 4 → Lv 5", "6 XP to Lv 5", "Lv↑ in 2 wins" or "Max level". Null when
     * the step pays no XP the client can preview (Apply It Your Way, a 0 XP
     * Training), or there is no card to preview it on.
     */
    level: string | null;
    /** Battle & Fuse only. */
    stake: string | null;
    /** Finishing a fused Power only: the row the button scrolls to. */
    fusedPowerId?: string;
    /**
     * The button's label; absent when there is no button. Train never has
     * one: the Training band directly under the bar carries it.
     */
    button?: string;
};

export type PowerLoop = {
    viewer: PowerLoopViewer;
    steps: PowerLoopStep[];
    next: PowerLoopNext;
    /** The whole bar as one spoken sentence. */
    accessibilityLabel: string;
};

export type PowerLoopInput = {
    /** Defaults to the viewer's own card. */
    viewer?: PowerLoopViewer;
    /**
     * The card's current total progression XP. Null when there is no card to
     * preview levels on (an animal page that does not have it cheaply): no
     * level chips and no level lines.
     */
    xp: number | null;
    /** `get_species_training`; null when the read failed, which gates nothing. */
    training: {available: boolean; completed: boolean; rewardXP: number; rewardCredits: number; questionCount: number} | null;
    trials: Pick<AnimalTrial, "status" | "rewardClass" | "rewardCredits">[];
    /** The same flag the Play tab uses to show "Power earned". */
    powerEarned: boolean;
    /** False when the species has no Power and no Trial: there is nothing to earn. */
    hasPowerToEarn: boolean;
    /** The card's `challenge_stake`, when known. */
    stake: number | null;
    /** This card's fused Powers not yet earned; null or 0 pending when there are none. Own card only. */
    fused?: PendingFusedSummary | null;
};

/** The Training read as the loop needs it. */
export function loopTraining(training: SpeciesTraining | null): PowerLoopInput["training"] {
    return training ? {
        available: training.available,
        completed: training.completed,
        rewardXP: training.rewardXP,
        rewardCredits: training.rewardCredits,
        questionCount: training.questions.length
    } : null;
}

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
 * The three steps, the Next strip and the spoken label.
 *
 * The level preview walks the one-time steps still owed, in order, from the
 * card's XP. Training and Trial XP land on the NEWEST visible card of this
 * animal (server `submit_species_training` / `complete_animal_trial`), so the
 * preview is exact on that card and approximate on older duplicates — an
 * accepted trade. With no card (`xp: null`) there is no preview at all.
 */
export function powerLoop(input: PowerLoopInput): PowerLoop {
    const viewer: PowerLoopViewer = input.viewer ?? "ownCard";
    // Only someone who has the animal can be anywhere on the loop. Everyone
    // else sees all three steps ahead of them, with what each pays.
    const canProgress = viewer === "ownCard" || viewer === "animalPageCaught";
    const knowsXP = canProgress && input.xp != null;
    const x0 = Math.max(0, Math.floor(input.xp != null && Number.isFinite(input.xp) ? input.xp : 0));
    const training = input.training;

    // 1. Train
    const trainingNeeded = Boolean(training?.available);
    const trainingDone = !trainingNeeded || Boolean(training?.completed);
    const trainingXP = trainingDone ? 0 : Math.max(0, training?.rewardXP ?? 0);
    const x1 = x0 + trainingXP;
    const trainingReward = trainingNeeded && training
        ? trainingRewardLine(training.rewardXP, training.rewardCredits)
        : "";

    // 2. Prove it
    const remaining = remainingTrialRewards(input.trials);
    const anyTrialComplete = input.trials.some((trial) => trial.status === "completed");
    const trialsNeeded = input.hasPowerToEarn || input.trials.length > 0;
    const trialsDone = !trialsNeeded || input.powerEarned || anyTrialComplete;
    const x2 = x1 + (trialsDone ? 0 : remaining.xp);
    const trialsReward = trainingRewardLine(remaining.xp, remaining.credits);
    // A Power with no Trial is earned only by Apply It Your Way, which pays no
    // XP the client can preview — so that is the caption, with no chip.
    const applyOnly = input.hasPowerToEarn && input.trials.length === 0;

    const trainingLevel = !knowsXP || trainingDone ? null : levelReached(x0, x1);
    const trialsLevel = !knowsXP || trialsDone || applyOnly ? null : levelReached(x1, x2);

    // 3. A fused Power still to finish is a one-time step too: its Training,
    // then earning it. Fused Powers are per card, so only the own card has one.
    const fused = viewer === "ownCard" && input.fused && input.fused.pending > 0 ? input.fused : null;
    const fusedXP = fused ? Math.max(0, fused.firstXP) : 0;
    const x3 = x2 + fusedXP;
    // Battles count from after every one-time step, pending fused XP included (iOS).
    const wins = knowsXP ? winsToNextLevel(x3) : null;

    // Someone without the animal is shown where the loop starts: the first
    // step it actually has is current, the rest upcoming.
    const trainStatus: PowerLoopStepStatus = !canProgress
        ? trainingNeeded ? "current" : "upcoming"
        : trainingDone ? "done" : "current";
    const proveStatus: PowerLoopStepStatus = !canProgress
        ? trainingNeeded ? "upcoming" : "current"
        : trialsDone ? "done" : trainingDone ? "current" : "upcoming";
    // Open once the Power is proved, and also whenever a fused Power waits to be finished.
    const battleOpen = canProgress && (trialsDone || Boolean(fused));

    const steps: PowerLoopStep[] = [
        {
            id: "train",
            number: 1,
            title: POWER_LOOP_COPY.train,
            status: trainStatus,
            repeats: false,
            caption: !trainingNeeded
                ? [POWER_LOOP_COPY.notNeeded]
                : trainingDone ? [POWER_LOOP_COPY.trainingComplete] : splitReward(trainingReward),
            levelChip: trainingLevel == null ? null : levelChipText(trainingLevel),
            levelChipHasArrow: trainingLevel != null
        },
        {
            id: "prove",
            number: 2,
            title: POWER_LOOP_COPY.proveIt,
            status: proveStatus,
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
            id: "battleFuse",
            number: 3,
            title: POWER_LOOP_COPY.battleAndFuse,
            status: battleOpen ? "current" : "upcoming",
            repeats: true,
            caption: [winXPLine(BATTLE_WIN_XP), fused ? toFinishLine(fused.pending) : POWER_LOOP_COPY.fuseNewPowers],
            levelChip: wins == null ? null : winsToLevelLine(wins),
            levelChipHasArrow: false
        }
    ];

    let next: PowerLoopNext;
    if (viewer === "signedOut") {
        // Training first when the animal has one, as it will be once signed in.
        next = trainingNeeded ? {
            step: "train",
            action: "signIn",
            title: nextStepTitle(POWER_LOOP_COPY.train),
            sentence: POWER_LOOP_COPY.signInSentence,
            reward: steps[0].caption.join(" · "),
            level: null,
            stake: null
        } : {
            step: "prove",
            action: "signIn",
            title: nextStepTitle(POWER_LOOP_COPY.proveIt),
            sentence: POWER_LOOP_COPY.signInSentence,
            reward: steps[1].caption.join(" · "),
            level: null,
            stake: null,
            button: POWER_LOOP_COPY.signInToStart
        };
    } else if (viewer === "animalPageNotCaught") {
        next = {
            step: "train",
            action: "none",
            title: nextStepTitle(POWER_LOOP_COPY.catchIt),
            sentence: POWER_LOOP_COPY.catchSentence,
            reward: "",
            level: null,
            stake: null
        };
    } else if (!trainingDone) {
        next = {
            step: "train",
            action: "train",
            title: nextStepTitle(POWER_LOOP_COPY.train),
            sentence: trainingIntroText(training?.questionCount ?? 0),
            reward: steps[0].caption.join(" · "),
            level: knowsXP ? oneTimeLevelLine(x0, x1) : null,
            stake: null
        };
    } else if (!trialsDone) {
        next = {
            step: "prove",
            action: "proveIt",
            title: nextStepTitle(POWER_LOOP_COPY.proveIt),
            sentence: POWER_LOOP_COPY.trialsSentence,
            // "Apply It Your Way" for a Power with no Trial, as the node says.
            reward: steps[1].caption.join(" · "),
            level: knowsXP ? oneTimeLevelLine(x1, x2) : null,
            stake: null,
            button: POWER_LOOP_COPY.proveItButton
        };
    } else if (fused) {
        const name = fused.firstName ?? "";
        next = {
            step: "battleFuse",
            action: "finishFused",
            title: finishTitle(name),
            sentence: FUSED_COPY.finishSentence,
            reward: trainingRewardLine(fusedXP, fused.firstCredits),
            level: knowsXP ? oneTimeLevelLine(x2, x3) : null,
            stake: null,
            fusedPowerId: fused.firstId ?? undefined,
            button: finishButtonTitle(name)
        };
    } else {
        next = {
            step: "battleFuse",
            action: "battleAndFuse",
            title: nextStepTitle(POWER_LOOP_COPY.battleAndFuse),
            sentence: POWER_LOOP_COPY.battlesSentence,
            reward: `${winXPLine(BATTLE_WIN_XP)} · ${lossXPLine(BATTLE_LOSS_XP)}`,
            level: !knowsXP ? null : wins == null ? POWER_LOOP_COPY.maxLevel : winsToLevelLine(wins),
            stake: input.stake != null && input.stake > 0 ? stakeLine(input.stake) : POWER_LOOP_COPY.creditsStaked
        };
    }

    const reached = {train: trainingLevel, prove: trialsLevel};
    const fusedLevel = fused && knowsXP ? levelReached(x2, x3) : null;
    return {
        viewer,
        steps,
        next,
        accessibilityLabel: spokenLoop(steps, reached, fused ? {pending: fused.pending, xp: fusedXP, level: fusedLevel} : null)
    };
}

/** "+10 XP · +1 Credit" → ["+10 XP", "+1 Credit"], so a narrow column wraps on the dot. */
function splitReward(line: string) {
    return line ? line.split(" · ").slice(0, 2) : [];
}

/**
 * The whole bar as one sentence, word for word with iOS
 * `PowerLoopCopy.accessibilityLabel`: Train and Prove it say what they pay
 * while not done, then the level they reach; Battle & Fuse says it repeats.
 *
 * "Power Loop. Step 1 Train, done. Step 2 Prove it, current, plus 15 XP and 8
 * Credits, reaches level 5. Step 3 Battle and Fuse, upcoming, repeats."
 */
function spokenLoop(
    steps: PowerLoopStep[],
    reached: {train: number | null; prove: number | null},
    fused: {pending: number; xp: number; level: number | null} | null
) {
    const parts = steps.map((step) => {
        if (step.id === "battleFuse") {
            let sentence = `Step ${step.number} ${POWER_LOOP_COPY.battleAndFuseSpoken}, ${step.status}, repeats`;
            if (fused) {
                // "…, current, repeats, 1 to finish, plus 20 XP, reaches level 6."
                sentence += `, ${toFinishLine(fused.pending)}`;
                if (fused.xp > 0) sentence += `, plus ${fused.xp} XP`;
                if (fused.level != null) sentence += `, reaches level ${fused.level}`;
            }
            return `${sentence}.`;
        }
        let sentence = `Step ${step.number} ${step.title}, ${step.status}`;
        if (step.status !== "done" && step.caption.length > 0) {
            // "+15 XP", "+8 Credits" → "plus 15 XP and 8 Credits".
            const spoken = step.caption.map((line) => (line.startsWith("+") ? line.slice(1) : line)).join(" and ");
            sentence += `, ${step.caption[0].startsWith("+") ? "plus " : ""}${spoken}`;
        }
        const level = reached[step.id];
        if (level != null) sentence += `, reaches level ${level}`;
        return `${sentence}.`;
    });
    return `${POWER_LOOP_COPY.title}. ${parts.join(" ")}`;
}
