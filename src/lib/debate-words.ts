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
    type DebateProblemCode
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
