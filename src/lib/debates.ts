/**
 * AnimalDex 3.2 Debates (docs/debates/SPEC.md), replacing Comparison Battles:
 * a clash of animals' lessons on the person's own problem, started from the
 * chat once the animal's Power is earned. Private (the person's own animals,
 * nothing at stake) or public (other people's animals from the roster, a heart
 * on each, and the community votes).
 *
 * The client RPCs (SPEC section 3; AnimalDex migration
 * 20261031150000_debates, docs/debates/SERVER.md): `debate_candidates_v1`,
 * `create_debate_v1`, `approve_public_debate_v1`, `cancel_debate_v1`,
 * `vote_debate_v1`, `debate_v1`, `my_debates_v1`, `debate_roster_v1`,
 * `set_debate_roster_v1`, `heal_capture_heart_v1`, `choose_debate_way_v1`,
 * and the Discover views `discover_debate_timeline_v1` /
 * `discover_debate_pinned_v1`. Their refusals come back as codes, said in
 * words by `debateProblemText`.
 *
 * Someone else's animal is never named by its card: the server sends a
 * participant's `capture_id` (and nickname, and hearts) only to its owner.
 * A participant is keyed by its participant id and its seat.
 *
 * Pure: the routes, the chat drawer, the Debates page, Discover, the card and
 * the tests share these decoders. A malformed field is dropped, never the
 * whole read, and every field takes the spellings the server might send.
 */

export type DebateVisibility = "private" | "public";

export type DebateStatus =
    | "drafting"
    | "approving"
    | "debating"
    | "reporting"
    | "voting"
    | "settled"
    | "draw"
    | "private_done"
    | "cancelled";

export type DebatePhase = "open" | "react" | "close";

/** One animal in a debate. Seat 0 is the host, the asker's own animal. */
export type DebateParticipant = {
    /** The participant id: what a vote and "Try {name}'s way" name. */
    id: string;
    /** The card, for the reader's own animals only. */
    captureId: string | null;
    seat: number;
    speciesProfileId: string | null;
    /** The species' icon-art slug, when known: the face in the thread is icon art, never a photo. */
    slug: string | null;
    animal: string;
    nickname: string | null;
    powerName: string | null;
    powerLesson: string | null;
    /** The asker's own animal (private debates: all of them). */
    isAskerOwned: boolean;
    /** The reader owns it. */
    ownerIsMe: boolean;
    /** Public: its votes so far. */
    votes: number | null;
    /** Its hearts now, when the server says. */
    hearts: number | null;
    heartLost: boolean;
    creditsWon: number;
    xpAwarded: number;
    /** Discover: its opening turn, as the post shows it. */
    opening: string | null;
    /** Discover: it won the vote. */
    isWinner: boolean;
};

export type DebateTurn = {seat: number; phase: DebatePhase; text: string; createdAt: string | null; index: number | null};

/** Each animal's way in the report: what it would do, the lesson behind it, where it fits, what it costs. */
export type DebateReportWay = {
    seat: number | null;
    participantId: string | null;
    captureId: string | null;
    way: string;
    lesson: string | null;
    fits: string | null;
    costs: string | null;
};

/** The deep report: the problem in one line, each animal's way, and one line on what to try first. Never a winner. */
export type DebateReport = {
    problem: string | null;
    ways: DebateReportWay[];
    tryFirst: string | null;
};

export type Debate = {
    id: string;
    visibility: DebateVisibility;
    status: DebateStatus;
    hostCaptureId: string | null;
    /** The asker is the reader. */
    askerIsMe: boolean;
    /** The asker's own words: only ever readable by the asker. */
    problemPrivate: string | null;
    /** The approved, anonymised text (public), or the server's draft while approving. */
    problemPublic: string | null;
    participants: DebateParticipant[];
    turns: DebateTurn[];
    report: DebateReport | null;
    roundIndex: number;
    votingDeadlineAt: string | null;
    rollovers: number;
    boosted: boolean;
    winnerParticipantId: string | null;
    createdAt: string | null;
    settledAt: string | null;
    /** Public: every vote cast. */
    totalVotes: number | null;
    /** The participant the reader voted for. Final. */
    myVote: string | null;
    canVote: boolean;
    /** Why not, as the server says it (`own_debate`, `not_eligible`, `voting_closed`, `already_voted`). */
    voteBlockedCode: string | null;
    /** The way the asker chose to try (private; never a vote). */
    chosenParticipantId: string | null;
    /** Why it ended unargued: `not_public` (too personal to post), `asker_cancelled`, … */
    cancelReason: string | null;
    /** The report's state: none | writing | ready | failed. */
    reportStatus: string | null;
    /** Public: what the winner's owner gets, from the server. */
    creditsForWinner: number | null;
    /** My debates: how it went for the reader (`won`, `lost_heart`, `draw`). */
    myResult: string | null;
};

/** One row of `debate_candidates_v1`. */
export type DebateCandidate = {
    captureId: string;
    ownerIsMe: boolean;
    speciesProfileId: string | null;
    slug: string | null;
    animal: string;
    nickname: string | null;
    powerName: string | null;
    powerLesson: string | null;
    hearts: number | null;
    /** One of the (at most 3) the app suggests: "Fits this best". */
    fits: boolean;
};

/** What `choose_debate_way_v1` answers: whose chat opens, and with what. */
export type DebateWayChoice = {
    stepSource: "own_animal" | "host";
    speciesProfileId: string | null;
    /** The chat to open: their own card of that animal, or the host's. */
    captureId: string | null;
    /** The referral carrying the problem, when the server made one. */
    referralId: string | null;
};

/** Pick 1–3 other animals. */
export const DEBATE_MAX_PICKS = 3;
export const DEBATE_MIN_PICKS = 1;
/** A public debate's text, as approved. */
export const DEBATE_PUBLIC_TEXT_MAX = 400;
/** The asker's own words. */
export const DEBATE_PROBLEM_MAX = 1500;
/** Hearts per animal. */
export const DEBATE_MAX_HEARTS = 3;
/** Healing: 5 Credits a heart, any time below 3. */
export const HEART_HEAL_CREDITS = 5;
/** Every animal in a public debate puts 5 Credits' worth on it; the house keeps 1. */
export const DEBATE_STAKE_CREDITS = 5;
export const DEBATE_FEE_CREDITS = 1;
/** Boosted debates pinned at the top of Discover at once. */
export const DEBATE_MAX_PINNED = 2;

const STATUSES: DebateStatus[] = ["drafting", "approving", "debating", "reporting", "voting", "settled", "draw", "private_done", "cancelled"];
const OPEN_STATUSES = new Set<DebateStatus>(["drafting", "approving", "debating", "reporting", "voting"]);

/** The winning animal's owner gets 5 × (animals − 1) − 1 Credits. */
export function debateWinnerCredits(animals: number): number {
    const count = Math.max(2, Math.round(animals));
    return DEBATE_STAKE_CREDITS * (count - 1) - DEBATE_FEE_CREDITS;
}

export function debateIsOpen(debate: Pick<Debate, "status">): boolean {
    return OPEN_STATUSES.has(debate.status);
}

/** The turns still to come, or the report: the thread should keep the debate running. */
export function debateNeedsTurns(debate: Pick<Debate, "status">): boolean {
    return debate.status === "debating";
}

export function debateIsFinished(debate: Pick<Debate, "status">): boolean {
    return !debateIsOpen(debate);
}

// MARK: - Decoding

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function object(value: unknown): Record<string, unknown> | null {
    if (typeof value === "string") {
        try {
            return object(JSON.parse(value));
        } catch {
            return null;
        }
    }
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function list(value: unknown): unknown[] {
    if (typeof value === "string") {
        try {
            return list(JSON.parse(value));
        } catch {
            return [];
        }
    }
    return Array.isArray(value) ? value : [];
}

function text(value: unknown): string | null {
    return typeof value === "string" && value.trim() ? value.trim() : null;
}

function first(row: Record<string, unknown>, ...keys: string[]): unknown {
    for (const key of keys) {
        if (row[key] !== undefined && row[key] !== null) return row[key];
    }
    return undefined;
}

function firstText(row: Record<string, unknown>, ...keys: string[]): string | null {
    for (const key of keys) {
        const value = text(row[key]);
        if (value) return value;
    }
    return null;
}

export function debateUuid(value: unknown): string | null {
    const candidate = text(value);
    return candidate && UUID_PATTERN.test(candidate) ? candidate.toLowerCase() : null;
}

function int(value: unknown): number | null {
    const parsed = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : Number.NaN;
    return Number.isFinite(parsed) ? Math.round(parsed) : null;
}

function bool(value: unknown): boolean {
    return value === true || value === "true" || value === 1;
}

function isoDate(value: unknown): string | null {
    const raw = text(value);
    return raw && Number.isFinite(Date.parse(raw)) ? raw : null;
}

/** The icon art is filed by the species' identity key, written with hyphens. */
function slugOf(row: Record<string, unknown>): string | null {
    const raw = firstText(row, "slug", "species_slug", "icon_slug", "normalized_identity_key");
    return raw ? raw.toLowerCase().replace(/_/g, "-") : null;
}

export function debateVisibility(value: unknown): DebateVisibility | null {
    return value === "public" || value === "private" ? value : null;
}

export function debateStatus(value: unknown): DebateStatus | null {
    return STATUSES.find((status) => status === value) ?? null;
}

function phaseOf(value: unknown): DebatePhase | null {
    if (value === "open" || value === "react" || value === "close") return value;
    // The group engine's closing turn.
    if (value === "seal") return "close";
    return null;
}

/** The animal's name in a sentence: the nickname, else the animal. */
export function debateAnimalName(animal: {nickname: string | null; animal: string}): string {
    return animal.nickname?.trim() || animal.animal;
}

export function decodeDebateParticipant(raw: unknown, index = 0): DebateParticipant | null {
    const row = object(raw);
    if (!row) return null;
    const captureId = debateUuid(first(row, "capture_id", "captureId"));
    const id = debateUuid(first(row, "participant_id", "participantId", "id")) ?? captureId;
    if (!id) return null;
    const animalRow = object(row.animal);
    const animal = firstText(row, "animal_name", "animalName", "species_name", "common_name")
        ?? (typeof row.animal === "string" ? text(row.animal) : null)
        ?? (animalRow ? firstText(animalRow, "name", "animal_name", "common_name") : null)
        ?? "";
    return {
        id,
        captureId,
        seat: int(first(row, "seat")) ?? index,
        speciesProfileId: debateUuid(first(row, "species_profile_id", "speciesProfileId")) ?? (animalRow ? debateUuid(animalRow.species_profile_id) : null),
        slug: slugOf(row) ?? (animalRow ? slugOf(animalRow) : null),
        animal,
        nickname: firstText(row, "nickname"),
        powerName: firstText(row, "power_name", "powerName", "principle_name"),
        powerLesson: firstText(row, "power_lesson", "powerLesson", "core_lesson"),
        isAskerOwned: bool(first(row, "is_asker_owned", "isAskerOwned")),
        ownerIsMe: bool(first(row, "owner_is_me", "ownerIsMe", "is_mine")),
        votes: int(first(row, "votes", "vote_count", "votes_count")),
        hearts: (() => {
            const hearts = int(first(row, "hearts", "challenge_health"));
            return hearts === null ? null : clampHearts(hearts);
        })(),
        heartLost: bool(first(row, "heart_lost", "heartLost")),
        creditsWon: Math.max(0, int(first(row, "credits_won", "creditsWon")) ?? 0),
        xpAwarded: Math.max(0, int(first(row, "xp_awarded", "xpAwarded")) ?? 0),
        opening: firstText(row, "opening"),
        isWinner: bool(first(row, "is_winner", "isWinner"))
    };
}

export function decodeDebateTurn(raw: unknown): DebateTurn | null {
    const row = object(raw);
    if (!row) return null;
    const seat = int(row.seat);
    const phase = phaseOf(row.phase);
    const said = text(first(row, "text", "content", "body"));
    if (seat === null || !phase || !said) return null;
    return {seat, phase, text: said, createdAt: isoDate(first(row, "created_at", "createdAt")), index: int(first(row, "turn_index", "index"))};
}

export function decodeDebateReport(raw: unknown): DebateReport | null {
    const row = object(raw);
    if (!row) return null;
    const ways = list(first(row, "ways", "animals", "points", "participants")).flatMap((item): DebateReportWay[] => {
        const way = object(item);
        if (!way) return [];
        const said = firstText(way, "way", "point", "approach", "summary");
        if (!said) return [];
        return [{
            seat: int(way.seat),
            participantId: debateUuid(first(way, "participant_id", "participantId", "id")),
            captureId: debateUuid(first(way, "capture_id", "captureId")),
            way: said,
            lesson: firstText(way, "lesson", "why", "lesson_behind"),
            fits: firstText(way, "fits_when", "fits", "fit", "where_it_fits", "best_for"),
            costs: firstText(way, "costs", "cost", "what_it_costs", "tradeoff")
        }];
    });
    const problem = firstText(row, "problem", "problem_line", "summary");
    const tryFirst = firstText(row, "try_first", "tryFirst", "first_try", "first_step", "try");
    if (!problem && ways.length === 0 && !tryFirst) return null;
    return {problem, ways, tryFirst};
}

/** `debate_v1`, a row of `my_debates_v1`, or a Discover debate post. Null without an id. */
export function decodeDebate(raw: unknown): Debate | null {
    const outer = object(raw);
    const row = outer && object(outer.debate) ? object(outer.debate)! : outer;
    if (!row) return null;
    const id = debateUuid(first(row, "id", "debate_id", "debateId"));
    if (!id) return null;
    const participants = list(first(row, "participants") ?? outer?.participants)
        .map((item, index) => decodeDebateParticipant(item, index))
        .filter((item): item is DebateParticipant => item !== null)
        .sort((a, b) => a.seat - b.seat);
    const turns = list(first(row, "turns") ?? outer?.turns)
        .map(decodeDebateTurn)
        .filter((item): item is DebateTurn => item !== null);
    const votes = object(first(row, "vote_counts", "votes"));
    // Vote counts may come as their own map (participant id → n).
    const counted = votes
        ? participants.map((participant) => ({...participant, votes: int(votes[participant.id]) ?? participant.votes}))
        : participants;
    const summed = counted.some((participant) => participant.votes !== null)
        ? counted.reduce((sum, participant) => sum + (participant.votes ?? 0), 0)
        : null;
    const myVote = debateUuid(first(row, "my_vote", "myVote", "viewer_vote_participant_id", "viewer_vote", "my_vote_participant_id", "voted_participant_id"))
        ?? (object(row.my_vote) ? debateUuid(object(row.my_vote)!.participant_id) : null);
    // `debate_v1` says `is_asker`; a row of My debates says its `role`.
    const askerIsMe = bool(first(row, "asker_is_me", "askerIsMe", "is_asker")) || row.role === "asker";
    return {
        id,
        visibility: debateVisibility(row.visibility) ?? "private",
        status: debateStatus(row.status) ?? "debating",
        hostCaptureId: debateUuid(first(row, "host_capture_id", "hostCaptureId")) ?? counted.find((participant) => participant.seat === 0)?.captureId ?? null,
        askerIsMe,
        // `problem` is the asker's own words for the asker, and the public text for anyone else.
        problemPrivate: firstText(row, "problem_private", "problemPrivate") ?? (askerIsMe ? firstText(row, "problem") : null),
        problemPublic: firstText(row, "problem_public", "problemPublic", "public_text", "draft_public", "draft_public_text"),
        participants: counted,
        turns,
        report: decodeDebateReport(first(row, "report") ?? outer?.report),
        roundIndex: int(first(row, "round_index", "roundIndex")) ?? 0,
        votingDeadlineAt: isoDate(first(row, "voting_deadline_at", "votingDeadlineAt")),
        rollovers: Math.max(0, int(row.rollovers) ?? 0),
        boosted: bool(row.boosted),
        winnerParticipantId: debateUuid(first(row, "winner_participant_id", "winnerParticipantId")) ?? counted.find((participant) => participant.isWinner)?.id ?? null,
        createdAt: isoDate(first(row, "created_at", "createdAt")),
        settledAt: isoDate(first(row, "settled_at", "settledAt")),
        totalVotes: int(first(row, "votes_total", "total_votes", "totalVotes", "vote_count")) ?? (typeof row.votes === "number" ? int(row.votes) : null) ?? summed,
        myVote,
        canVote: bool(first(row, "can_vote", "canVote", "viewer_can_vote")),
        voteBlockedCode: firstText(row, "voteBlockedCode", "cant_vote_reason", "viewer_cant_vote_reason", "vote_block", "vote_blocked", "cannot_vote_reason", "vote_blocked_reason")
            ?? (bool(row.viewer_is_participant) ? "own_debate" : null),
        chosenParticipantId: debateUuid(first(row, "my_way", "chosen_participant_id", "asker_choice", "chosenParticipantId")),
        cancelReason: firstText(row, "cancel_reason", "cancelReason"),
        reportStatus: firstText(row, "report_status", "reportStatus") ?? (row.report_ready === true ? "ready" : null),
        creditsForWinner: int(first(row, "credits_for_winner", "creditsForWinner")),
        myResult: firstText(row, "my_result", "myResult")
    };
}

export function decodeDebates(raw: unknown): Debate[] {
    const outer = object(raw);
    const rows = outer && !debateUuid(outer.id) ? list(first(outer, "debates", "items", "rows")) : list(raw);
    return rows.map(decodeDebate).filter((item): item is Debate => item !== null);
}

export function decodeDebateCandidates(raw: unknown): DebateCandidate[] {
    const outer = object(raw);
    const rows = outer ? list(first(outer, "candidates", "animals", "items")) : list(raw);
    const seen = new Set<string>();
    return rows.flatMap((item): DebateCandidate[] => {
        const row = object(item);
        const captureId = row ? debateUuid(first(row, "capture_id", "captureId", "id")) : null;
        if (!row || !captureId || seen.has(captureId)) return [];
        seen.add(captureId);
        const animalRow = object(row.animal);
        return [{
            captureId,
            ownerIsMe: bool(first(row, "owner_is_me", "ownerIsMe")),
            speciesProfileId: debateUuid(first(row, "species_profile_id", "speciesProfileId")) ?? (animalRow ? debateUuid(animalRow.species_profile_id) : null),
            slug: slugOf(row) ?? (animalRow ? slugOf(animalRow) : null),
            animal: (typeof row.animal === "string" ? text(row.animal) : null)
                ?? (animalRow ? firstText(animalRow, "name", "animal_name", "common_name") : null)
                ?? firstText(row, "animal_name", "species_name")
                ?? "",
            nickname: firstText(row, "nickname"),
            powerName: firstText(row, "power_name", "powerName"),
            powerLesson: firstText(row, "power_lesson", "powerLesson"),
            hearts: int(first(row, "hearts", "challenge_health")),
            fits: bool(first(row, "fits", "suggested"))
        }];
    });
}

export function decodeDebateWayChoice(raw: unknown): DebateWayChoice | null {
    const row = object(raw);
    if (!row) return null;
    const said = String(first(row, "step_source", "stepSource", "source") ?? "").toLowerCase();
    const source = said === "own_animal" ? "own_animal" : said === "host" ? "host" : null;
    if (!source) return null;
    return {
        stepSource: source,
        speciesProfileId: debateUuid(first(row, "species_profile_id", "speciesProfileId")),
        captureId: debateUuid(first(row, "capture_id", "captureId", "chat_capture_id")),
        referralId: debateUuid(first(row, "referral_id", "referralId"))
    };
}

export type HeartsResult = {hearts: number; credits: number | null};

export function decodeHeartsResult(raw: unknown): HeartsResult | null {
    const row = object(raw);
    const hearts = row ? int(first(row, "hearts", "challenge_health")) : null;
    if (!row || hearts === null) return null;
    return {hearts: clampHearts(hearts), credits: int(first(row, "credits", "credit_balance", "balance"))};
}

export function clampHearts(value: number | null | undefined): number {
    return Math.max(0, Math.min(DEBATE_MAX_HEARTS, Math.round(value ?? DEBATE_MAX_HEARTS)));
}

/** Healing is any time below 3, a heart at a time. */
export function canHealHeart(hearts: number | null | undefined, credits: number | null | undefined): {can: boolean; reason: "full" | "credits" | null} {
    const now = clampHearts(hearts);
    if (now >= DEBATE_MAX_HEARTS) return {can: false, reason: "full"};
    if (typeof credits === "number" && credits < HEART_HEAL_CREDITS) return {can: false, reason: "credits"};
    return {can: true, reason: null};
}

/**
 * The suggestions to pre-select (SPEC section 6): the ones marked "Fits this
 * best", best first, at most `max`, never two of one species.
 */
export function suggestedDebatePicks(candidates: DebateCandidate[], max = DEBATE_MAX_PICKS): string[] {
    const species = new Set<string>();
    const picks: string[] = [];
    for (const candidate of candidates) {
        if (!candidate.fits || picks.length >= max) continue;
        if (candidate.speciesProfileId && species.has(candidate.speciesProfileId)) continue;
        if (candidate.speciesProfileId) species.add(candidate.speciesProfileId);
        picks.push(candidate.captureId);
    }
    return picks;
}

/**
 * A call turn's `done.debate_request: {problem}` (SPEC section 6): they said
 * yes on the call to hearing other animals; the problem in one line, from
 * their side. Null when there is none.
 */
export function debateRequestProblem(raw: unknown): string | null {
    const row = object(raw);
    const problem = row && typeof row.problem === "string" ? row.problem.replace(/\s+/g, " ").trim().slice(0, DEBATE_PROBLEM_MAX) : "";
    return problem || null;
}

// MARK: - The thread and the feed

/** Its turns as the thread shows them: open, then react, then close, each in seat order within the round. */
export function orderedDebateTurns(turns: DebateTurn[]): DebateTurn[] {
    const rank: Record<DebatePhase, number> = {open: 0, react: 1, close: 2};
    return turns
        .map((turn, index) => ({turn, index}))
        .sort((a, b) => {
            if (a.turn.index !== null && b.turn.index !== null && a.turn.index !== b.turn.index) return a.turn.index - b.turn.index;
            const at = a.turn.createdAt ? Date.parse(a.turn.createdAt) : Number.NaN;
            const bt = b.turn.createdAt ? Date.parse(b.turn.createdAt) : Number.NaN;
            if (Number.isFinite(at) && Number.isFinite(bt) && at !== bt) return at - bt;
            return rank[a.turn.phase] - rank[b.turn.phase] || a.index - b.index;
        })
        .map((entry) => entry.turn);
}

/** Each animal's opening (its first `open` turn), by seat: the Discover post shows these. */
export function debateOpenings(debate: Pick<Debate, "turns" | "participants">): Map<number, string> {
    const openings = new Map<number, string>();
    for (const turn of orderedDebateTurns(debate.turns)) {
        if (turn.phase === "open" && !openings.has(turn.seat)) openings.set(turn.seat, turn.text);
    }
    // A Discover post carries each animal's opening on the animal itself.
    for (const participant of debate.participants) {
        if (participant.opening && !openings.has(participant.seat)) openings.set(participant.seat, participant.opening);
    }
    return openings;
}

export function debateParticipantAt(debate: Pick<Debate, "participants">, seat: number): DebateParticipant | null {
    return debate.participants.find((participant) => participant.seat === seat) ?? null;
}

/** The report's way for one animal: by participant, then capture, then seat. */
export function reportWayFor(report: DebateReport | null, participant: DebateParticipant): DebateReportWay | null {
    if (!report) return null;
    return report.ways.find((way) => way.participantId === participant.id)
        ?? (participant.captureId ? report.ways.find((way) => way.captureId === participant.captureId) : undefined)
        ?? report.ways.find((way) => way.seat === participant.seat)
        ?? null;
}

/**
 * Boosted debates, pinned at the top of Discover for a viewer who can still
 * vote on them (SERVER.md: the asker, the owners, signed-out readers and
 * ineligible accounts never get pins): open for votes, at most two, fewest
 * votes first.
 */
export function pinnedDebates(debates: Debate[], max = DEBATE_MAX_PINNED): Debate[] {
    return debates
        .filter((debate) => debate.visibility === "public" && debate.status === "voting" && debate.boosted && debate.canVote && !debate.myVote && !debateIsMine(debate))
        .sort((a, b) => (a.totalVotes ?? 0) - (b.totalVotes ?? 0) || Date.parse(a.createdAt ?? "") - Date.parse(b.createdAt ?? ""))
        .slice(0, max);
}

/** The reader is in it: they asked, or one of the animals is theirs. They never vote on it. */
export function debateIsMine(debate: Pick<Debate, "askerIsMe" | "participants">): boolean {
    return debate.askerIsMe || debate.participants.some((participant) => participant.ownerIsMe);
}

/** Open debates first, newest first; then past ones, newest first. Cancelled ones are not listed. */
export function splitMyDebates(debates: Debate[]): {open: Debate[]; past: Debate[]} {
    const newest = (a: Debate, b: Debate) => Date.parse(b.createdAt ?? "") - Date.parse(a.createdAt ?? "");
    const listed = debates.filter((debate) => debate.status !== "cancelled" && debate.status !== "drafting");
    return {
        open: listed.filter(debateIsOpen).sort(newest),
        past: listed.filter((debate) => !debateIsOpen(debate)).sort(newest)
    };
}

/** The debates one card was in (the card's tab). */
export function debatesWithCapture(debates: Debate[], captureId: string): Debate[] {
    const id = captureId.toLowerCase();
    return debates.filter((debate) => debate.status !== "cancelled" && debate.participants.some((participant) => participant.captureId === id));
}

// MARK: - Refusals

export const DEBATE_PROBLEM_CODES = [
    "not_authenticated",
    "debates_off",
    "debate_not_public",
    "power_not_earned",
    "no_hearts",
    "not_opted_in",
    "roster_unavailable",
    "already_in_debate",
    "invalid_participants",
    "too_many_animals",
    "daily_limit",
    "limit_reached",
    "not_eligible",
    "already_voted",
    "own_debate",
    "voting_closed",
    "not_found",
    "hearts_full",
    "insufficient_credits",
    "text_too_long",
    "problem_too_short",
    "animal_unavailable",
    "duplicate_species",
    "debate_not_finished",
    "account_suspended",
    "debate_unavailable"
] as const;

export type DebateProblemCode = (typeof DEBATE_PROBLEM_CODES)[number];

/** A refusal's code, from the RPC's message or the route's `code`. Anything unknown is `debate_unavailable`. */
export function debateProblemCode(message: unknown): DebateProblemCode {
    const said = typeof message === "string" ? message.toLowerCase() : "";
    if (said.includes("participant_cannot_vote") || said.includes("cannot_vote_own")) return "own_debate";
    if (said.includes("not_enough_credits") || said.includes("insufficient_balance")) return "insufficient_credits";
    if (said.includes("health_full") || said.includes("already_full")) return "hearts_full";
    if (said.includes("rate_limit") || said.includes("too_many_debates") || said.includes("debate_limit")) return "daily_limit";
    if (said.includes("problem_too_long")) return "text_too_long";
    if (said.includes("debate_not_found") || said.includes("capture_not_found")) return "not_found";
    if (said.includes("participant_busy") || said.includes("participant_invalid") || said.includes("invalid_participant")) return "animal_unavailable";
    if (said.includes("host_power_not_earned")) return "power_not_earned";
    if (said.includes("host_no_hearts")) return "no_hearts";
    return DEBATE_PROBLEM_CODES.find((code) => said.includes(code)) ?? "debate_unavailable";
}

/** The vote buttons' state for the reader. */
export function debateVoteState(debate: Pick<Debate, "visibility" | "status" | "myVote" | "canVote" | "askerIsMe" | "participants" | "voteBlockedCode">, signedIn: boolean):
    | {kind: "vote"}
    | {kind: "voted"; participantId: string}
    | {kind: "own"}
    | {kind: "signIn"}
    | {kind: "closed"}
    | {kind: "ineligible"} {
    if (debate.visibility !== "public") return {kind: "closed"};
    if (debate.myVote) return {kind: "voted", participantId: debate.myVote};
    if (debateIsMine(debate) || debate.voteBlockedCode === "own_debate") return {kind: "own"};
    if (debate.status !== "voting") return {kind: "closed"};
    if (!signedIn) return {kind: "signIn"};
    if (debate.canVote) return {kind: "vote"};
    return {kind: "ineligible"};
}
