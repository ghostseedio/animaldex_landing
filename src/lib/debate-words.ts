/**
 * Debates in words (docs/debates/SPEC.md, section 2): a refusal said calmly,
 * a debate's state and result for the reader, the stake note, the vote count.
 * Pure, so the drawer, the Debates page, Discover and the card say each thing
 * the same way.
 */

import {fillWords, type CompanionWords} from "@/lib/companion-bond";
import {
    debateAnimalName,
    debateWinnerCredits,
    type Debate,
    type DebateParticipant,
    type DebateProblemCode,
    type DebateQuality,
    type DebateSolution
} from "@/lib/debates";

export function debateProblemText(code: DebateProblemCode | null | undefined, words: CompanionWords): string {
    const problems = words.debateWeb.problems;
    switch (code) {
        case "not_authenticated": return problems.signIn;
        case "debates_off": return problems.off;
        case "debate_not_public": return words.debate.notPublic;
        case "power_not_earned": return problems.powerNotEarned;
        case "no_hearts": return problems.noHearts;
        case "not_opted_in": return problems.notOptedIn;
        case "already_in_debate": return problems.alreadyInDebate;
        case "invalid_participants":
        case "too_many_animals":
        case "animal_unavailable":
        case "roster_unavailable": return problems.animalUnavailable;
        case "duplicate_species": return words.picker.alreadyHereHint;
        case "problem_too_short": return problems.tooShort;
        case "daily_limit":
        case "limit_reached": return problems.dailyLimit;
        case "not_eligible": return problems.notEligible;
        case "already_voted": return words.debate.voted;
        case "own_debate": return words.debate.cantVoteOwn;
        case "voting_closed": return problems.votingClosed;
        case "not_found":
        case "debate_not_finished": return problems.notFound;
        case "hearts_full": return words.heal.full;
        case "insufficient_credits": return problems.noCredits;
        case "text_too_long": return problems.textTooLong;
        // V2 and Ask the public (iOS `DebatesServiceError.userMessage`).
        case "no_more_animals":
        case "debate_full": return problems.noMoreAnimals;
        case "solution_too_short": return problems.solutionTooShort;
        case "already_offered": return problems.alreadyOffered;
        case "judge_unavailable":
        case "debate_check_unavailable":
        case "way_unavailable":
        default: return problems.generic;
    }
}

/**
 * "Each animal puts 1 heart on it. The winner's owner gets {credits} Credits.",
 * with `pickedCount` the other people's animals picked: since 2026-10-31 the
 * winner's owner gets 5 × (losing animals of other owners) − 1, so this is
 * what a win by the asker's own animal brings. With none, nothing is at stake
 * (`debate.ownOnly`).
 */
export function debateStakeNote(pickedCount: number, words: CompanionWords): string {
    return fillWords(words.debate.stakeNote, {credits: debateWinnerCredits(pickedCount + 1)});
}

export function debateVotesText(count: number | null | undefined, words: CompanionWords): string {
    return fillWords(words.debate.votesCount, {n: Math.max(0, count ?? 0)});
}

function winnerOf(debate: Debate): DebateParticipant | null {
    return debate.winnerParticipantId
        ? debate.participants.find((participant) => participant.id === debate.winnerParticipantId) ?? null
        : null;
}

/**
 * What became of it, for the reader: the winner (with the Credits, when the
 * winner is theirs), a heart their animal lost, a draw. Null while it is open.
 */
export function debateResultLines(debate: Debate, words: CompanionWords): string[] {
    if (debate.status === "draw") return [words.debate.draw];
    if (debate.status !== "settled") return [];
    const lines: string[] = [];
    const winner = winnerOf(debate);
    if (winner && debate.askedPublic) {
        // Asked in public: the community's pick, nothing won or lost.
        return [fillWords(words.debateWeb.communityPicked, {name: debateAnimalName(winner)})];
    }
    if (winner) {
        const name = debateAnimalName(winner);
        lines.push(winner.ownerIsMe && winner.creditsWon > 0
            ? fillWords(words.debate.won, {name, credits: winner.creditsWon})
            : fillWords(words.debateWeb.wonBy, {name}));
    }
    for (const participant of debate.participants) {
        if (participant.ownerIsMe && participant.heartLost) lines.push(fillWords(words.debate.lost, {name: debateAnimalName(participant)}));
    }
    return lines;
}

/** Where it stands, one line. */
export function debateStatusText(debate: Debate, words: CompanionWords): string {
    switch (debate.status) {
        case "drafting":
        case "approving": return words.debateWeb.statusApproving;
        case "debating": return words.debateWeb.statusDebating;
        case "reporting": return words.debateWeb.statusReporting;
        case "voting": return debate.rollovers > 0 ? words.debate.rollover : words.debateWeb.statusVoting;
        case "private_done": return words.debateWeb.statusDone;
        case "draw": return words.debate.draw;
        case "settled": return debateResultLines(debate, words)[0] ?? words.debateWeb.statusDone;
        case "cancelled": return words.debateWeb.problems.notFound;
    }
}

/** The debate in one line: the approved public text, the asker's words for their own, or the report's problem. */
export function debateHeadline(debate: Debate): string {
    return debate.problemPublic
        ?? debate.report?.problem
        ?? (debate.askerIsMe ? debate.problemPrivate : null)
        ?? "";
}

/**
 * The debate in one line once it has started (SPEC section 6): "Luna, Pip
 * and Bruno: private debate", the names joined the reader's way.
 */
export function debateLine(debate: Pick<Debate, "participants" | "visibility">, words: CompanionWords, locale = "en"): string {
    const names = debate.participants.map(debateAnimalName).filter(Boolean);
    let joined = names.join(", ");
    try {
        joined = new Intl.ListFormat(locale, {style: "long", type: "conjunction"}).format(names);
    } catch {
        // The plain list, then.
    }
    return fillWords(debate.visibility === "public" ? words.debate.publicLine : words.debate.privateLine, {names: joined});
}

/** The animals in it, by name: "Wolf, Otter and Crow". */
export function debateCast(debate: Debate, and = "&"): string {
    const names = debate.participants.map(debateAnimalName).filter(Boolean);
    if (names.length <= 1) return names.join("");
    return `${names.slice(0, -1).join(", ")} ${and} ${names[names.length - 1]}`;
}

/**
 * The time left on a vote, in one unit (owner, 2026-11-09): under 1 hour
 * in minutes, under 48 hours in hours, otherwise in days rounded up. So a
 * new public vote of 48 hours reads in hours ("40 hours", never "1 day"),
 * and 2 days and an hour reads "3 days". Null once it has passed.
 */
export function debateTimeLeft(ms: number): {value: number; unit: "minute" | "hour" | "day"} | null {
    if (!Number.isFinite(ms) || ms <= 0) return null;
    const minutes = ms / 60_000;
    if (minutes < 60) return {value: Math.max(1, Math.round(minutes)), unit: "minute"};
    if (minutes < 48 * 60) return {value: Math.max(1, Math.min(47, Math.round(minutes / 60))), unit: "hour"};
    return {value: Math.ceil(minutes / (24 * 60)), unit: "day"};
}

/**
 * "Voting closes in 5 hours" (docs/rich-chat/SPEC.md, section 2.4): the
 * time left (`debateTimeLeft`), in the reader's language; null once it has
 * passed or when the debate has no deadline. Every vote countdown says it
 * this way: the chat's vote section and Explore's card.
 */
export function debateClosesIn(deadline: string | null | undefined, words: CompanionWords, locale = "en", now = Date.now()): string | null {
    const at = Date.parse(deadline ?? "");
    const left = Number.isFinite(at) ? debateTimeLeft(at - now) : null;
    if (!left) return null;
    const {value, unit} = left;
    let time = `${value} ${unit}${value === 1 ? "" : "s"}`;
    try {
        time = new Intl.NumberFormat(locale, {style: "unit", unit, unitDisplay: "long"}).format(value);
    } catch {
        // The English, then.
    }
    return fillWords(words.debate.votingClosesIn, {time});
}

/**
 * How an animal is named over its turns (section 2.3): the nickname for the
 * asker's own animals, else the species, then " · " and its Power.
 */
export function debateSpeakerLine(participant: Pick<DebateParticipant, "nickname" | "animal" | "powerName" | "isAskerOwned" | "ownerIsMe">): string {
    const name = (participant.isAskerOwned || participant.ownerIsMe) && participant.nickname?.trim() ? participant.nickname.trim() : participant.animal;
    return participant.powerName?.trim() ? `${name} · ${participant.powerName.trim()}` : name;
}

/** Names joined the reader's way: "Luna, Pip and Bruno". */
function joinedNames(names: string[], locale: string): string {
    try {
        return new Intl.ListFormat(locale, {style: "long", type: "conjunction"}).format(names);
    } catch {
        return names.join(", ");
    }
}

/**
 * What "I solved it my way" found, in one line (V2 section 5): "You used ideas
 * from Luna and Pip", each by its name in the debate; with none, "You found
 * your own way".
 */
export function debateSolutionHeadline(debate: Pick<Debate, "participants">, solution: DebateSolution, words: CompanionWords, locale = "en"): string {
    const names = solution.used.map((used) => {
        const participant = debate.participants.find((item) => item.seat === used.seat);
        return participant ? debateAnimalName(participant) : used.animal;
    }).filter(Boolean);
    return names.length === 0 ? words.debate.usedNone : fillWords(words.debate.usedIdeas, {names: joinedNames(names, locale)});
}

/** "Your qualities: Patience, Coordination", as a screen reader says the chips. */
export function debateQualitiesLabel(qualities: readonly DebateQuality[], words: CompanionWords): string {
    return fillWords(words.debate.qualitiesLine, {qualities: qualities.map((quality) => quality.label).join(", ")});
}

/** "Fit: 82 out of 100": a fit bar read aloud (no number on screen). */
export function debateFitLabel(fit: number, words: CompanionWords): string {
    return fillWords(words.debate.fitLabel, {fit: Math.max(0, Math.min(100, Math.round(fit)))});
}

/**
 * Whose step a chosen way becomes (`choose_debate_way_v1`, SERVER.md): the
 * asker's own animal of that kind when the way is one of theirs, else the
 * host's, which turns another animal's way into its own step. Null when
 * the debate does not say who its host is.
 */
export function debateStepAnimal(debate: Pick<Debate, "participants">, chosen: DebateParticipant): DebateParticipant | null {
    if (chosen.isAskerOwned || chosen.ownerIsMe) return chosen;
    return debate.participants.find((participant) => participant.seat === 0) ?? null;
}

/**
 * Under the chosen way (owner, 2026-11-09): what happens next, never only
 * the qualities. "Next: Luna gives you a step from this way. Doing it earns
 * Luna's Power, Patient Pressure." The Power is earned by doing the step,
 * never by choosing.
 */
export function debateWayNextLine(debate: Pick<Debate, "participants">, chosen: DebateParticipant, words: CompanionWords): string | null {
    const animal = debateStepAnimal(debate, chosen);
    if (!animal) return null;
    const name = debateAnimalName(animal);
    const power = animal.powerName?.trim();
    return power
        ? fillWords(words.debate.wayNext, {animal: name, power})
        : fillWords(words.debate.wayNextNoPower, {animal: name});
}

/** A public debate's card shows at most this many animals, then "+N more" (owner, 2026-11-09). */
export const DEBATE_CARD_ANIMALS = 3;

/** The animals a card shows, and how many more there are ("+4 more"). */
export function debateCardAnimals<T>(participants: readonly T[], expanded = false, max = DEBATE_CARD_ANIMALS): {shown: T[]; more: number} {
    if (expanded || participants.length <= max) return {shown: [...participants], more: 0};
    return {shown: participants.slice(0, max), more: participants.length - max};
}
