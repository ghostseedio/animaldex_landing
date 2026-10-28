/**
 * The Play tab's Powers page: every animal the player has caught, sorted into
 * the step of the Power Loop it is waiting on — Train, Prove it, or Battle &
 * Fuse — plus the ones locked until the animal is caught again. Fused Powers
 * start the loop again, so a fused Power that still needs its Training or
 * proof shows in step 1 or 2 under its own name.
 *
 * Web twin of iOS `PlayJourney` (Models/PlayJourney.swift). Pure: every input
 * is a bulk read of the player's own rows (`/api/app/play-journey` and the
 * Trials read), so the page costs a handful of requests however many animals
 * there are. The card's own Play tab stays the authority: a row only says
 * where to go, and tapping it opens the card.
 *
 * Known approximations, harmless because the card corrects them (same as iOS):
 * - "Training owed" is "no Training row yet". A few Powers have no quiz, so
 *   those show Train and the card then opens on Prove it.
 * - A lock lifts on a NEWER card of the animal. The server compares
 *   `created_at`; this uses the capture time, which is never later.
 */

import type {PowerGateStatus} from "@/lib/animal-powers";
import {type AnimalTrial, isComplete, isInProgress, rewardXP} from "@/lib/animal-trials";
import {BATTLE_WIN_XP} from "@/lib/power-loop";

export type PlayJourneyStep = "train" | "proveIt" | "battleAndFuse" | "locked";

/** The three loop steps, in order. `locked` is not one of them. */
export const PLAY_JOURNEY_LOOP_STEPS = ["train", "proveIt", "battleAndFuse"] as const;

export const PLAY_JOURNEY_STEP_NUMBER: Record<Exclude<PlayJourneyStep, "locked">, 1 | 2 | 3> = {
    train: 1,
    proveIt: 2,
    battleAndFuse: 3
};

export const PLAY_JOURNEY_STEP_TITLE: Record<Exclude<PlayJourneyStep, "locked">, string> = {
    train: "Train",
    proveIt: "Prove it",
    battleAndFuse: "Battle & Fuse"
};

export function playJourneyAnchorId(step: PlayJourneyStep) {
    const number = step === "locked" ? 4 : PLAY_JOURNEY_STEP_NUMBER[step];
    return `play-journey-step-${number}`;
}

/** Which loop step a lock is about. */
export type PlayJourneyLockedStep = "train" | "proveIt";

/** Where step 2 stands for an animal, as far as its Trials say. */
export type PlayJourneyProofState =
    | {kind: "notStarted"}
    | {kind: "trialRunning"; deadline: string | null}
    | {kind: "underReview"};

export type PlayJourneySubject =
    | {kind: "animalPower"; name: string | null}
    | {kind: "fusedPower"; id: string; name: string};

export type PlayJourneyEntry = {
    id: string;
    step: PlayJourneyStep;
    speciesProfileId: string;
    /** The card a tap opens: the newest card of the animal, or the fused Power's own card. */
    captureId: string;
    animalName: string;
    imageSrc: string | null;
    subject: PlayJourneySubject;
    /** Step 1 and 2: what finishing it pays. Null where unknown. */
    rewardXP: number | null;
    proof: PlayJourneyProofState | null;
    /** Locked rows: which step was missed. */
    lockedStep: PlayJourneyLockedStep | null;
    /** For ordering inside a section: newest activity first (ms). */
    sortDate: number;
};

/** One of the player's own cards, as the page needs it. */
export type PlayJourneyCard = {
    captureId: string;
    /** Canonical. Null when the capture never resolved to a species. */
    speciesProfileId: string | null;
    animalName: string;
    /** ISO timestamp; null sorts as the distant past. */
    capturedAt: string | null;
    imageSrc: string | null;
    /** The animal's Power, when one is written. */
    powerName: string | null;
    gate: PowerGateStatus;
};

export type PlayJourneyStepFailure = {
    speciesProfileId: string;
    step: PlayJourneyLockedStep;
    failedAt: string;
};

/** A fused Power row on one of the player's cards (`capture_learned_sub_principles`). */
export type PlayJourneyFused = {
    id: string;
    captureId: string;
    name: string;
    createdAt: string;
    trainingCompletedAt: string | null;
    earnedAt: string | null;
    trainingFailedAt: string | null;
    proofFailedAt: string | null;
};

export type PlayJourney = {
    train: PlayJourneyEntry[];
    proveIt: PlayJourneyEntry[];
    battleAndFuse: PlayJourneyEntry[];
    locked: PlayJourneyEntry[];
};

export const PLAY_JOURNEY_TRAINING_REWARD_XP = 10;

export const EMPTY_PLAY_JOURNEY: PlayJourney = {train: [], proveIt: [], battleAndFuse: [], locked: []};

export function journeyEntries(journey: PlayJourney, step: PlayJourneyStep) {
    return journey[step];
}

export function journeyIsEmpty(journey: PlayJourney) {
    return !journey.train.length && !journey.proveIt.length && !journey.battleAndFuse.length && !journey.locked.length;
}

/** Animals with their Power earned. Fused rows never sit in step 3. */
export function journeyPowersEarned(journey: PlayJourney) {
    return journey.battleAndFuse.length;
}

/** The first step with something to do is the one lit: start here. */
export function journeyFocus(journey: PlayJourney): Exclude<PlayJourneyStep, "locked"> | null {
    return PLAY_JOURNEY_LOOP_STEPS.find((step) => journey[step].length > 0) ?? null;
}

function time(value: string | null | undefined) {
    const parsed = value ? Date.parse(value) : NaN;
    return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
}

/** A timestamp, or null when it is missing (so the caller's fallback applies). */
function optionalTime(value: string | null | undefined) {
    const parsed = time(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function key(id: string) {
    return id.toLowerCase();
}

/** Running, under review, then not started. */
function proofRank(proof: PlayJourneyProofState | null) {
    switch (proof?.kind) {
        case "trialRunning": return 0;
        case "underReview": return 1;
        default: return 2;
    }
}

const FREQUENCY_ORDER: Record<string, number> = {LOW: 0, MID: 1, HIGH: 2};

function proofState(trials: AnimalTrial[]): {proof: PlayJourneyProofState; reward: number | null; date: number | null} {
    const open = trials.filter((trial) => !isComplete(trial));
    const review = open.find((trial) => trial.status === "proof_submitted" && isInProgress(trial));
    if (review) return {proof: {kind: "underReview"}, reward: rewardXP(review), date: optionalTime(review.activatedAt)};
    const running = open.find((trial) => (trial.status === "active" || trial.status === "pending_activation") && isInProgress(trial));
    if (running) {
        return {
            proof: {kind: "trialRunning", deadline: running.completionDeadlineAt},
            reward: rewardXP(running),
            date: optionalTime(running.activatedAt)
        };
    }
    const first = open
        .filter((trial) => trial.status === "notStarted")
        .sort((left, right) => (FREQUENCY_ORDER[left.frequency] ?? 9) - (FREQUENCY_ORDER[right.frequency] ?? 9))[0];
    return {proof: {kind: "notStarted"}, reward: first ? rewardXP(first) : null, date: null};
}

/**
 * Builds the page.
 *
 * - `cards`: the player's own cards. Cards with no species or no Power take no
 *   part: there is nothing to earn on them.
 * - `trainedSpecies`: species with a passed Training.
 * - `failures`: the last missed step per species.
 * - `earnedSpecies`: species whose Power is earned, beyond what `gate` says.
 * - `openTrials`: Trials for caught animals, finished ones included.
 * - `completedTrialSpecies`: species with any completed Trial (it earns the
 *   Power and satisfies Training).
 * - `fused`: the player's fused Powers.
 */
export function buildPlayJourney(input: {
    cards: PlayJourneyCard[];
    trainedSpecies: Iterable<string>;
    failures: PlayJourneyStepFailure[];
    earnedSpecies: Iterable<string>;
    openTrials: AnimalTrial[];
    completedTrialSpecies: Iterable<string>;
    fused: PlayJourneyFused[];
}): PlayJourney {
    const train: PlayJourneyEntry[] = [];
    const prove: PlayJourneyEntry[] = [];
    const battle: PlayJourneyEntry[] = [];
    const locked: PlayJourneyEntry[] = [];

    const trained = new Set(Array.from(input.trainedSpecies, key));
    const earnedSpecies = new Set(Array.from(input.earnedSpecies, key));
    const completedTrialSpecies = new Set(Array.from(input.completedTrialSpecies, key));

    const bySpecies = new Map<string, PlayJourneyCard[]>();
    for (const card of input.cards) {
        if (!card.speciesProfileId) continue;
        const species = key(card.speciesProfileId);
        bySpecies.set(species, [...(bySpecies.get(species) ?? []), card]);
    }
    const trialsBySpecies = new Map<string, AnimalTrial[]>();
    for (const trial of input.openTrials) {
        const species = key(trial.speciesProfileId);
        trialsBySpecies.set(species, [...(trialsBySpecies.get(species) ?? []), trial]);
    }
    const failureBySpecies = new Map<string, number>();
    for (const failure of input.failures) {
        const failureKey = `${key(failure.speciesProfileId)}|${failure.step}`;
        failureBySpecies.set(failureKey, Math.max(failureBySpecies.get(failureKey) ?? Number.NEGATIVE_INFINITY, time(failure.failedAt)));
    }

    function newestCard(cards: PlayJourneyCard[]) {
        return cards.reduce<PlayJourneyCard | null>((newest, card) => (!newest || time(card.capturedAt) > time(newest.capturedAt) ? card : newest), null);
    }

    /** Locked while the miss is newer than every card of the animal. */
    function isLocked(species: string, missedAt: number | undefined) {
        if (missedAt == null || !Number.isFinite(missedAt)) return false;
        const newest = newestCard(bySpecies.get(species) ?? []);
        if (!newest) return false;
        return time(newest.capturedAt) <= missedAt;
    }

    for (const [species, speciesCards] of Array.from(bySpecies.entries())) {
        const newest = newestCard(speciesCards);
        if (!newest) continue;
        const hasPower = speciesCards.some((card) => card.gate === "earned" || card.gate === "not_earned");
        const trials = trialsBySpecies.get(species) ?? [];
        if (!hasPower && !trials.length) continue;

        const powerName = speciesCards.find((card) => card.powerName)?.powerName
            ?? (trials[0]?.principleName.trim() || null);
        const earned = earnedSpecies.has(species)
            || completedTrialSpecies.has(species)
            || trials.some(isComplete)
            || speciesCards.some((card) => card.gate === "earned");

        const entry = (
            step: PlayJourneyStep,
            options: {reward?: number | null; proof?: PlayJourneyProofState | null; lockedStep?: PlayJourneyLockedStep | null; date?: number | null} = {}
        ): PlayJourneyEntry => ({
            id: `${step}-${species}`,
            step,
            speciesProfileId: newest.speciesProfileId ?? species,
            captureId: newest.captureId,
            animalName: newest.animalName,
            imageSrc: newest.imageSrc,
            subject: {kind: "animalPower", name: powerName},
            rewardXP: options.reward ?? null,
            proof: options.proof ?? null,
            lockedStep: options.lockedStep ?? null,
            sortDate: options.date ?? time(newest.capturedAt)
        });

        if (earned) {
            battle.push(entry("battleAndFuse"));
            continue;
        }

        if (!trained.has(species)) {
            const missedAt = failureBySpecies.get(`${species}|train`);
            if (isLocked(species, missedAt)) {
                locked.push(entry("locked", {lockedStep: "train", date: missedAt}));
            } else {
                train.push(entry("train", {reward: PLAY_JOURNEY_TRAINING_REWARD_XP}));
            }
            continue;
        }

        const missedAt = failureBySpecies.get(`${species}|proveIt`);
        if (isLocked(species, missedAt)) {
            locked.push(entry("locked", {lockedStep: "proveIt", date: missedAt}));
            continue;
        }
        const state = proofState(trials);
        prove.push(entry("proveIt", {reward: state.reward, proof: state.proof, date: state.date}));
    }

    // Fused Powers: the loop again, on one card.
    const cardsById = new Map<string, PlayJourneyCard>();
    for (const card of input.cards) {
        if (!cardsById.has(key(card.captureId))) cardsById.set(key(card.captureId), card);
    }
    for (const power of input.fused) {
        if (power.earnedAt) continue;
        const card = cardsById.get(key(power.captureId));
        if (!card) continue;
        const species = card.speciesProfileId ? key(card.speciesProfileId) : null;
        const fusedEntry = (step: PlayJourneyStep, date: number, options: {reward?: number; lockedStep?: PlayJourneyLockedStep} = {}): PlayJourneyEntry => ({
            id: `${step}-fused-${key(power.id)}`,
            step,
            speciesProfileId: card.speciesProfileId ?? card.captureId,
            captureId: card.captureId,
            animalName: card.animalName,
            imageSrc: card.imageSrc,
            subject: {kind: "fusedPower", id: power.id, name: power.name},
            rewardXP: options.reward ?? null,
            proof: step === "proveIt" ? {kind: "notStarted"} : null,
            lockedStep: options.lockedStep ?? null,
            sortDate: date
        });
        // A fused lock re-arms with a new card of the CARD's animal.
        const fusedLocked = (missedAt: string | null) => {
            if (!missedAt) return false;
            if (!species) return true;
            return isLocked(species, time(missedAt));
        };
        if (!power.trainingCompletedAt) {
            if (fusedLocked(power.trainingFailedAt)) {
                locked.push(fusedEntry("locked", time(power.trainingFailedAt ?? power.createdAt), {lockedStep: "train"}));
            } else {
                train.push(fusedEntry("train", time(power.createdAt), {reward: PLAY_JOURNEY_TRAINING_REWARD_XP}));
            }
        } else if (fusedLocked(power.proofFailedAt)) {
            locked.push(fusedEntry("locked", time(power.proofFailedAt ?? power.createdAt), {lockedStep: "proveIt"}));
        } else {
            prove.push(fusedEntry("proveIt", time(power.trainingCompletedAt ?? power.createdAt)));
        }
    }

    // Newest first; step 2 puts running Trials first — they are on a clock.
    const ordered = (rows: PlayJourneyEntry[]) => rows.sort((left, right) => {
        const byRank = proofRank(left.proof) - proofRank(right.proof);
        if (byRank !== 0) return byRank;
        if (left.sortDate !== right.sortDate) return right.sortDate > left.sortDate ? 1 : -1;
        const byName = left.animalName.localeCompare(right.animalName, undefined, {sensitivity: "base"});
        if (byName !== 0) return byName;
        return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
    });

    return {
        train: ordered(train),
        proveIt: ordered(prove),
        battleAndFuse: ordered(battle),
        locked: ordered(locked)
    };
}

// MARK: - Copy (word for word with iOS PlayJourneyViews)

export const PLAY_JOURNEY_COPY = {
    toTrain: "to train",
    toProve: "to prove",
    powerEarned: "Power earned",
    powersEarned: "Powers earned",
    findBattle: "Find a battle",
    showLess: "Show less",
    locked: "LOCKED",
    // A miss locks until the next day, or a new card of the animal, whichever
    // is first (AnimalDex 20261028120000; it used to need a new card).
    tryAgainTomorrow: "TRY AGAIN TOMORROW",
    fused: "FUSED",
    trialRunning: "Trial running",
    proofUnderReview: "Proof under review",
    trainingMissed: "Training missed",
    proofNotAccepted: "Proof not accepted",
    emptyTitle: "Catch an animal to start",
    emptyDetail: "Every animal you catch has a Power to earn. Train, prove it, then battle and fuse.",
    rowHint: "Opens this animal's Play tab"
} as const;

export const lockedSummaryLine = (count: number) => `${count} locked · try again tomorrow`;
export const showAllLine = (count: number) => `Show all ${count}`;
export const trialRunningLine = (left: string) => `Trial running · ${left} left`;

export function sectionRailTrailing(step: PlayJourneyStep) {
    switch (step) {
        case "train": return `+${PLAY_JOURNEY_TRAINING_REWARD_XP} XP EACH`;
        case "proveIt": return "EARNS THE POWER";
        case "battleAndFuse": return `+${BATTLE_WIN_XP} XP A WIN`;
        default: return "";
    }
}

export function sectionEmptyLine(step: PlayJourneyStep) {
    switch (step) {
        case "train": return "Nothing to train. New catches start here.";
        case "proveIt": return "Nothing to prove right now.";
        case "battleAndFuse": return "Earn a Power to unlock battles and Fusion.";
        default: return "";
    }
}

/** More than this folds behind "Show all". */
export const PLAY_JOURNEY_FOLD_LIMIT = 4;

export function visibleEntries(entries: PlayJourneyEntry[], expanded: boolean) {
    return expanded || entries.length <= PLAY_JOURNEY_FOLD_LIMIT + 1 ? entries : entries.slice(0, PLAY_JOURNEY_FOLD_LIMIT);
}

/** "2d", "5h", "12m". Null once the time is up. */
export function journeyTimeLeft(deadline: string, now = Date.now()) {
    const seconds = (time(deadline) - now) / 1000;
    if (!(seconds > 0)) return null;
    const minutes = Math.floor(seconds / 60);
    if (minutes >= 60 * 24) return `${Math.floor(minutes / (60 * 24))}d`;
    if (minutes >= 60) return `${Math.floor(minutes / 60)}h`;
    return `${Math.max(1, minutes)}m`;
}

/** The row's status line and its tone, or null. */
export function journeyStatusLine(entry: PlayJourneyEntry, now = Date.now()): {text: string; tone: "warn" | "muted" | "fail"} | null {
    switch (entry.step) {
        case "proveIt":
            if (entry.proof?.kind === "trialRunning") {
                const left = entry.proof.deadline ? journeyTimeLeft(entry.proof.deadline, now) : null;
                return {text: left ? trialRunningLine(left) : PLAY_JOURNEY_COPY.trialRunning, tone: "warn"};
            }
            if (entry.proof?.kind === "underReview") return {text: PLAY_JOURNEY_COPY.proofUnderReview, tone: "muted"};
            return null;
        case "locked":
            return {
                text: entry.lockedStep === "train" ? PLAY_JOURNEY_COPY.trainingMissed : PLAY_JOURNEY_COPY.proofNotAccepted,
                tone: "fail"
            };
        default:
            return null;
    }
}

// MARK: - Powers history

/** One Power earned: the animal's own, or a fused one. */
export type PlayPowerHistoryItem = {
    id: string;
    speciesProfileId: string;
    captureId: string | null;
    animalName: string;
    imageSrc: string | null;
    powerName: string;
    isFused: boolean;
    /** "Earned by Trial" etc. */
    route: string | null;
    earnedAt: string | null;
};

export function powerHistoryDetailLine(item: PlayPowerHistoryItem) {
    const parts = [item.animalName];
    if (item.route) parts.push(item.route);
    if (item.earnedAt && Number.isFinite(Date.parse(item.earnedAt))) {
        parts.push(new Date(item.earnedAt).toLocaleDateString(undefined, {day: "numeric", month: "short", year: "numeric"}));
    }
    return parts.join(" · ");
}

export function sortPowerHistory(items: PlayPowerHistoryItem[]) {
    return [...items].sort((left, right) => time(right.earnedAt) - time(left.earnedAt));
}
