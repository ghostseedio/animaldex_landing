import assert from "node:assert/strict";
import test from "node:test";
import {COMPANION_WORDS_EN, companionWords} from "@/lib/companion-bond";
import {
    canHealHeart,
    debateRequestProblem,
    decodeDebateOffer,
    decodeDebateRequest,
    preselectedDebatePicks,
    suggestedDebatePicks,
    debateHasStakes,
    debateIsMine,
    debateIsOwnOnly,
    debateOpenings,
    debateProblemCode,
    debateVoteState,
    debateWinnerCredits,
    debatesWithCapture,
    decodeDebate,
    decodeDebateCandidates,
    decodeDebateReport,
    decodeDebateWayChoice,
    decodeDebates,
    decodeHeartsResult,
    orderedDebateTurns,
    pinnedDebates,
    reportWayFor,
    splitMyDebates,
    type Debate
} from "@/lib/debates";
import {debateCast, debateHeadline, debateLine, debateProblemText, debateResultLines, debateStakeNote, debateStatusText, debateVotesText} from "@/lib/debate-words";

const DEBATE = "7a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";
const HOST = "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d";
const OTHER = "2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d6e";
const THIRD = "3c4d5e6f-7a8b-4c9d-8e1f-2a3b4c5d6e7f";
const P_HOST = "aa000000-0000-4000-8000-000000000001";
const P_OTHER = "aa000000-0000-4000-8000-000000000002";
const P_THIRD = "aa000000-0000-4000-8000-000000000003";
const SPECIES = "0f2c1e5a-3b4d-4e6f-8a9b-1c2d3e4f5a6b";

function row(overrides: Record<string, unknown> = {}) {
    return {
        id: DEBATE,
        visibility: "public",
        status: "voting",
        host_capture_id: HOST,
        asker_is_me: false,
        problem_public: "Should I take the job in another city?",
        rollovers: 0,
        boosted: false,
        created_at: "2026-10-30T08:00:00Z",
        voting_deadline_at: "2026-10-31T08:00:00Z",
        can_vote: true,
        participants: [
            {id: P_OTHER, capture_id: OTHER, seat: 1, animal_name: "Eurasian Otter", nickname: null, power_name: "Play Keeps You Supple", votes: 2, species_profile_id: SPECIES, normalized_identity_key: "eurasian_otter"},
            {id: P_HOST, capture_id: HOST, seat: 0, animal_name: "Gray Wolf", nickname: "Luna", power_name: "The Pack Holds", is_asker_owned: true, votes: 3}
        ],
        turns: [
            {seat: 1, phase: "react", text: "Luna, a pack can be anywhere.", created_at: "2026-10-30T08:00:03Z"},
            {seat: 0, phase: "open", text: "Stay where your pack is.", created_at: "2026-10-30T08:00:01Z"},
            {seat: 1, phase: "open", text: "Go and play somewhere new.", created_at: "2026-10-30T08:00:02Z"},
            {seat: 0, phase: "seal", text: "Still: keep your pack close.", created_at: "2026-10-30T08:00:04Z"},
            {seat: 2, phase: "decide", text: "never shown", created_at: "2026-10-30T08:00:05Z"}
        ],
        report: {
            problem: "A job offer far from home.",
            ways: [
                {seat: 0, participant_id: P_HOST, way: "Stay near the people who hold you up.", lesson: "Wolves survive as a pack.", fits: "When support matters most.", costs: "A smaller job."},
                {capture_id: OTHER, way: "Go, and keep it playful.", why: "Otters learn by play.", fit: "When you're restless.", cost: "Starting over."}
            ],
            try_first: "Ask the new team what a week there looks like."
        },
        ...overrides
    };
}

test("a debate decodes in seat order, with its votes, turns and report, whatever the spellings", () => {
    const debate = decodeDebate(row())!;
    assert.equal(debate.id, DEBATE);
    assert.equal(debate.visibility, "public");
    assert.equal(debate.status, "voting");
    assert.deepEqual(debate.participants.map((participant) => participant.seat), [0, 1]);
    assert.equal(debate.participants[0].nickname, "Luna");
    assert.equal(debate.participants[1].slug, "eurasian-otter");
    assert.equal(debate.totalVotes, 5);
    // A phase the debate does not have is dropped; the group engine's closing turn is a close.
    assert.deepEqual(debate.turns.map((turn) => turn.phase).sort(), ["close", "open", "open", "react"]);
    assert.deepEqual(orderedDebateTurns(debate.turns).map((turn) => turn.text), [
        "Stay where your pack is.",
        "Go and play somewhere new.",
        "Luna, a pack can be anywhere.",
        "Still: keep your pack close."
    ]);
    assert.equal(debateOpenings(debate).get(1), "Go and play somewhere new.");
    assert.equal(debate.report?.ways.length, 2);
    assert.equal(reportWayFor(debate.report, debate.participants[1])?.lesson, "Otters learn by play.");
    assert.equal(reportWayFor(debate.report, debate.participants[1])?.costs, "Starting over.");
    assert.equal(debate.report?.tryFirst, "Ask the new team what a week there looks like.");
    // Wrapped, or as a JSON string, it reads the same.
    assert.equal(decodeDebate({debate: row()})?.id, DEBATE);
    assert.equal(decodeDebate(JSON.stringify(row()))?.participants.length, 2);
    assert.equal(decodeDebate({status: "voting"}), null);
});

test("vote counts can come as their own map, and the reader's vote is kept", () => {
    const debate = decodeDebate(row({votes: {[P_HOST]: 4, [P_OTHER]: 1}, my_vote: P_OTHER, can_vote: false}))!;
    assert.equal(debate.participants.find((participant) => participant.id === P_HOST)?.votes, 4);
    assert.equal(debate.totalVotes, 5);
    assert.equal(debate.myVote, P_OTHER);
});

test("the vote buttons: vote, voted, the reader's own debate, signed out, closed", () => {
    const open = decodeDebate(row())!;
    assert.deepEqual(debateVoteState(open, true), {kind: "vote"});
    assert.deepEqual(debateVoteState(open, false), {kind: "signIn"});
    assert.deepEqual(debateVoteState({...open, myVote: P_HOST}, true), {kind: "voted", participantId: P_HOST});
    assert.deepEqual(debateVoteState({...open, askerIsMe: true}, true), {kind: "own"});
    const owned = {...open, participants: open.participants.map((participant, index) => ({...participant, ownerIsMe: index === 1}))};
    assert.deepEqual(debateVoteState(owned, true), {kind: "own"});
    assert.equal(debateIsMine(owned), true);
    assert.deepEqual(debateVoteState({...open, status: "settled"}, true), {kind: "closed"});
    assert.deepEqual(debateVoteState({...open, canVote: false}, true), {kind: "ineligible"});
    assert.deepEqual(debateVoteState({...open, visibility: "private"}, true), {kind: "closed"});
});

test("the winner's Credits are 5 for each other animal, less the 1 fee", () => {
    assert.equal(debateWinnerCredits(2), 4);
    assert.equal(debateWinnerCredits(3), 9);
    assert.equal(debateWinnerCredits(4), 14);
    assert.equal(debateWinnerCredits(1), 4);
    assert.equal(debateStakeNote(3, COMPANION_WORDS_EN), "Each animal puts 1 heart on it. The winner's owner gets 14 Credits.");
});

test("boosted debates pin for a viewer who has not voted: at most two, fewest votes first", () => {
    const base = decodeDebate(row({boosted: true, can_vote: true}))!;
    const make = (id: string, votes: number, changes: Partial<Debate> = {}): Debate => ({...base, id, totalVotes: votes, ...changes});
    const pinned = pinnedDebates([
        make("a", 4),
        make("b", 1),
        make("c", 2),
        make("d", 0, {myVote: P_HOST}),
        make("e", 0, {askerIsMe: true}),
        make("f", 0, {boosted: false}),
        make("g", 0, {status: "settled"}),
        // Pins are only for someone who can still vote on it.
        make("h", 0, {canVote: false})
    ]);
    assert.deepEqual(pinned.map((debate) => debate.id), ["b", "c"]);
});

test("my debates: open first and past after, newest first; cancelled ones are not listed", () => {
    const debates = decodeDebates({debates: [
        row({id: "11111111-1111-4111-8111-111111111111", status: "settled", created_at: "2026-10-01T00:00:00Z"}),
        row({id: "22222222-2222-4222-8222-222222222222", status: "debating", created_at: "2026-10-02T00:00:00Z"}),
        row({id: "33333333-3333-4333-8333-333333333333", status: "voting", created_at: "2026-10-03T00:00:00Z"}),
        row({id: "44444444-4444-4444-8444-444444444444", status: "cancelled"}),
        row({id: "55555555-5555-4555-8555-555555555555", status: "private_done", visibility: "private", created_at: "2026-10-04T00:00:00Z"})
    ]});
    const {open, past} = splitMyDebates(debates);
    assert.deepEqual(open.map((debate) => debate.id[0]), ["3", "2"]);
    assert.deepEqual(past.map((debate) => debate.id[0]), ["5", "1"]);
    assert.equal(debatesWithCapture(debates, OTHER.toUpperCase()).length, 4);
    assert.equal(debatesWithCapture(debates, THIRD).length, 0);
});

test("candidates decode once each, with the suggestions marked", () => {
    const candidates = decodeDebateCandidates([
        {capture_id: OTHER, owner_is_me: true, animal: "Eurasian Otter", power_name: "Play", hearts: 3, fits: true},
        {capture_id: OTHER, animal: "dup"},
        {capture_id: THIRD, animal: {name: "Crow", species_profile_id: SPECIES, slug: "carrion_crow"}, hearts: "1", fits: false},
        {capture_id: "nope"}
    ]);
    assert.equal(candidates.length, 2);
    assert.equal(candidates[0].fits, true);
    assert.equal(candidates[1].animal, "Crow");
    assert.equal(candidates[1].slug, "carrion-crow");
    assert.equal(candidates[1].hearts, 1);
    assert.equal(decodeDebateCandidates({candidates: [{capture_id: HOST, animal: "Wolf"}]}).length, 1);
});

test("choosing a way says whose chat opens", () => {
    assert.deepEqual(decodeDebateWayChoice({step_source: "host", species_profile_id: SPECIES, referral_id: P_HOST}), {
        stepSource: "host", speciesProfileId: SPECIES, captureId: null, referralId: P_HOST
    });
    assert.equal(decodeDebateWayChoice({step_source: "vote"}), null);
});

test("healing: one heart at a time below 3, for 5 Credits", () => {
    assert.deepEqual(canHealHeart(3, 100), {can: false, reason: "full"});
    assert.deepEqual(canHealHeart(2, 4), {can: false, reason: "credits"});
    assert.deepEqual(canHealHeart(0, 5), {can: true, reason: null});
    assert.deepEqual(canHealHeart(1, null), {can: true, reason: null});
    assert.deepEqual(decodeHeartsResult({hearts: 2, credits: 40}), {hearts: 2, credits: 40});
    assert.deepEqual(decodeHeartsResult({challenge_health: 9}), {hearts: 3, credits: null});
    assert.equal(decodeHeartsResult({}), null);
});

test("refusals map to their codes, and each is said in words", () => {
    assert.equal(debateProblemCode("debate_not_public"), "debate_not_public");
    assert.equal(debateProblemCode("ERROR: already_voted"), "already_voted");
    assert.equal(debateProblemCode("participant_cannot_vote"), "own_debate");
    assert.equal(debateProblemCode("not_enough_credits"), "insufficient_credits");
    assert.equal(debateProblemCode("boom"), "debate_unavailable");
    assert.equal(debateProblemCode(undefined), "debate_unavailable");
    const words = COMPANION_WORDS_EN;
    assert.equal(debateProblemText("debate_not_public", words), "This one stays private. It's too personal to post.");
    assert.equal(debateProblemText("own_debate", words), "You can't vote on a debate you're in.");
    assert.equal(debateProblemText("already_voted", words), "You voted");
    assert.equal(debateProblemText("debate_unavailable", words), words.debateWeb.problems.generic);
    // Every code reads in Indonesian too.
    const id = companionWords({debateWeb: {problems: {generic: "Gagal terkirim."}}});
    assert.equal(debateProblemText(null, id), "Gagal terkirim.");
});

test("results: the winner with Credits for its owner, a heart the reader's animal lost, a draw", () => {
    const words = COMPANION_WORDS_EN;
    const settled = decodeDebate(row({
        status: "settled",
        winner_participant_id: P_OTHER,
        participants: [
            {id: P_HOST, capture_id: HOST, seat: 0, animal_name: "Gray Wolf", nickname: "Luna", owner_is_me: true, heart_lost: true},
            {id: P_OTHER, capture_id: OTHER, seat: 1, animal_name: "Eurasian Otter", credits_won: 4}
        ]
    }))!;
    assert.deepEqual(debateResultLines(settled, words), ["Eurasian Otter's way won.", "Luna lost a heart."]);
    const mine = {...settled, participants: settled.participants.map((participant) => participant.id === P_OTHER ? {...participant, ownerIsMe: true} : participant)};
    assert.equal(debateResultLines(mine, words)[0], "Eurasian Otter's way won. +4 Credits");
    assert.deepEqual(debateResultLines({...settled, status: "draw"}, words), ["Not enough votes came in. No hearts or Credits moved."]);
    assert.deepEqual(debateResultLines({...settled, status: "voting"}, words), []);
    assert.equal(debateStatusText({...settled, status: "voting", rollovers: 2}, words), "Not enough votes yet. Voting stays open another day.");
    assert.equal(debateVotesText(7, words), "7 votes");
    assert.equal(debateHeadline(settled), "Should I take the job in another city?");
    assert.equal(debateHeadline({...settled, problemPublic: null, report: null, askerIsMe: true, problemPrivate: "my words"}), "my words");
    assert.equal(debateCast(settled), "Luna & Eurasian Otter");
});

test("a report needs something in it", () => {
    assert.equal(decodeDebateReport({}), null);
    assert.equal(decodeDebateReport({ways: [{lesson: "no way given"}]}), null);
    assert.equal(decodeDebateReport({problem: "Moving"})?.problem, "Moving");
});

test("the server's shapes: someone else's animal has no card, My debates says its role, a Discover row its viewer", () => {
    // debate_v1 for a voter: no capture ids, nicknames or hearts for animals that are not theirs.
    const viewed = decodeDebate({
        id: DEBATE, visibility: "public", status: "voting", is_asker: false,
        problem: "Should I move cities?", problem_public: "Should I move cities?", problem_private: null,
        votes_total: 6, my_vote: null, can_vote: true, cant_vote_reason: null, my_way: null,
        credits_for_winner: 4, report_status: "ready",
        participants: [
            {participant_id: P_HOST, seat: 0, capture_id: null, animal: "Gray Wolf", power_name: "The Pack Holds", is_mine: false, votes: null},
            {participant_id: P_OTHER, seat: 1, capture_id: null, animal: "Eurasian Otter", power_name: "Play", is_mine: false, votes: null}
        ],
        turns: [{turn_index: 1, seat: 1, participant_id: P_OTHER, phase: "open", text: "Go and play."}, {turn_index: 0, seat: 0, phase: "open", text: "Stay."}]
    })!;
    assert.equal(viewed.participants.length, 2);
    assert.equal(viewed.participants[0].captureId, null);
    assert.equal(viewed.participants[1].id, P_OTHER);
    assert.equal(viewed.totalVotes, 6);
    assert.equal(viewed.problemPrivate, null);
    assert.equal(viewed.creditsForWinner, 4);
    assert.deepEqual(orderedDebateTurns(viewed.turns).map((turn) => turn.text), ["Stay.", "Go and play."]);
    assert.deepEqual(debateVoteState(viewed, true), {kind: "vote"});

    // A row of my_debates_v1: the role, the asker's own words in `problem`, the host's card (theirs).
    const mine = decodeDebate({
        id: DEBATE, visibility: "private", status: "private_done", role: "asker", problem: "My own words", my_result: null, report_ready: true,
        participants: [{participant_id: P_HOST, seat: 0, capture_id: HOST, animal: "Gray Wolf", is_mine: true}]
    })!;
    assert.equal(mine.askerIsMe, true);
    assert.equal(mine.problemPrivate, "My own words");
    assert.equal(mine.hostCaptureId, HOST);
    assert.equal(mine.reportStatus, "ready");
    assert.equal(decodeDebate({id: DEBATE, role: "owner", problem: "Public words"})?.problemPrivate, null);

    // A Discover row: the viewer's vote, whether they can, and each animal's opening.
    const post = decodeDebate({
        debate_id: DEBATE, created_at: "2026-10-30T09:00:00Z", status: "voting", problem_public: "Moving?",
        votes_total: 2, viewer_vote_participant_id: null, viewer_can_vote: false, viewer_cant_vote_reason: "own_debate", viewer_is_participant: true,
        boosted: true, participants: [
            {participant_id: P_HOST, seat: 0, animal: "Gray Wolf", opening: "Stay with your pack.", votes: 1, is_winner: false},
            {participant_id: P_OTHER, seat: 1, animal: "Eurasian Otter", opening: "Go play.", votes: 1, is_winner: false}
        ]
    })!;
    assert.equal(post.id, DEBATE);
    assert.equal(post.voteBlockedCode, "own_debate");
    assert.equal(debateOpenings(post).get(1), "Go play.");
    assert.deepEqual(debateVoteState({...post, visibility: "public"}, true), {kind: "own"});

});

test("the server's refusals say themselves", () => {
    assert.equal(debateProblemCode("capture_health_full"), "hearts_full");
    assert.equal(debateProblemCode("animal_unavailable"), "animal_unavailable");
    assert.equal(debateProblemCode("duplicate_species"), "duplicate_species");
    assert.equal(debateProblemCode("problem_too_short"), "problem_too_short");
    assert.equal(debateProblemCode("problem_too_long"), "text_too_long");
    assert.equal(debateProblemCode("debate_not_found"), "not_found");
    assert.equal(debateProblemText("animal_unavailable", COMPANION_WORDS_EN), "One of those animals can't join right now. Pick another.");
    assert.equal(debateProblemText("problem_too_short", COMPANION_WORDS_EN), "Say a little more about it: a sentence or two.");
});

test("the setup pre-selects the suggestions: best first, at most three, one per species", () => {
    const candidate = (id: string, fits: boolean, species: string | null) => ({
        captureId: id, ownerIsMe: true, speciesProfileId: species, slug: null, animal: id, nickname: null, powerName: null, powerLesson: null, hearts: 3, fits
    });
    assert.deepEqual(suggestedDebatePicks([
        candidate("a", true, "s1"),
        candidate("b", false, "s2"),
        candidate("c", true, "s1"),
        candidate("d", true, "s3"),
        candidate("e", true, null),
        candidate("f", true, "s4")
    ]), ["a", "d", "e"]);
    assert.deepEqual(suggestedDebatePicks([candidate("b", false, "s2")]), []);
});

test("once started, the setup is one line: the animals by name, private or public", () => {
    const debate = decodeDebate(row({visibility: "private"}))!;
    assert.equal(debateLine(debate, COMPANION_WORDS_EN, "en"), "Luna and Eurasian Otter: private debate");
    const three = {...debate, visibility: "public" as const, participants: [...debate.participants, {...debate.participants[1], id: P_THIRD, seat: 2, animal: "Crow"}]};
    assert.equal(debateLine(three, COMPANION_WORDS_EN, "en"), "Luna, Eurasian Otter, and Crow: public debate");
    const id = companionWords({debate: {privateLine: "{names}: debat pribadi"}});
    assert.equal(debateLine(debate, id, "id"), "Luna dan Eurasian Otter: debat pribadi");
});

test("a call that ended on yes carries the problem for the setup", () => {
    assert.equal(debateRequestProblem({problem: "  Whether to take\nthe job  "}), "Whether to take the job");
    assert.equal(debateRequestProblem({problem: ""}), null);
    assert.equal(debateRequestProblem(null), null);
});

const HEDGEHOG_CARD = "00000000-0000-4000-8000-0000000000c1";
const WOLF_CARD = "00000000-0000-4000-8000-0000000000c2";
const HEDGEHOG = "00000000-0000-4000-8000-0000000000a1";
const WOLF = "00000000-0000-4000-8000-0000000000a2";

test("SPEC section 6: the offer's quick replies and setup come from done.companion.debate_offer, the call's from debate_request", () => {
    const offer = decodeDebateOffer({
        problem: "  Whether to take the promotion\n away from my friends ",
        with: [
            {capture_id: HEDGEHOG_CARD, species_profile_id: HEDGEHOG, animal: "European Hedgehog", nickname: "Pip"},
            {capture_id: HEDGEHOG_CARD, species_profile_id: HEDGEHOG, animal: "European Hedgehog", nickname: "Pip"},
            {capture_id: "c2", animal: "Gray Wolf"},
            {capture_id: WOLF_CARD, species_profile_id: WOLF, animal: "Gray Wolf", nickname: null}
        ]
    });
    assert.deepEqual(offer, {
        problem: "Whether to take the promotion away from my friends",
        with: [
            {captureId: HEDGEHOG_CARD, speciesProfileId: HEDGEHOG, animal: "European Hedgehog", nickname: "Pip"},
            {captureId: WOLF_CARD, speciesProfileId: WOLF, animal: "Gray Wolf", nickname: null}
        ]
    });
    // As the thread stores it, read back the same.
    assert.deepEqual(decodeDebateOffer(JSON.parse(JSON.stringify(offer))), offer);
    assert.deepEqual(decodeDebateOffer({problem: null, with: []}), {problem: null, with: []});
    assert.equal(decodeDebateOffer(null), null);

    assert.deepEqual(decodeDebateRequest({problem: "Whether to move for the job", with: [{capture_id: WOLF_CARD, species_profile_id: WOLF, animal: "Gray Wolf", nickname: null}]}), {
        problem: "Whether to move for the job",
        with: [{captureId: WOLF_CARD, speciesProfileId: WOLF, animal: "Gray Wolf", nickname: null}]
    });
    assert.deepEqual(decodeDebateRequest({problem: "Whether to move for the job"}), {problem: "Whether to move for the job", with: []});
    assert.equal(decodeDebateRequest({problem: " ", with: []}), null);
});

test("SPEC section 6: the animals it named are pre-selected first, then the suggestions, never two of a species", () => {
    const candidate = (id: string, fits: boolean, species: string | null) => ({
        captureId: id, ownerIsMe: true, speciesProfileId: species, slug: null, animal: id, nickname: null, powerName: null, powerLesson: null, hearts: 3, fits
    });
    const candidates = [candidate("a", true, "s1"), candidate("b", false, "s2"), candidate("c", true, "s3"), candidate("d", true, "s4"), candidate("w", false, WOLF)];
    const named = (captureId: string, speciesProfileId: string | null) => ({captureId, speciesProfileId, animal: "x", nickname: null});
    // The wolf it named is not a suggestion, but goes first; then the suggestions fill up to 3.
    assert.deepEqual(preselectedDebatePicks(candidates, [named("w", WOLF)]), ["w", "a", "c"]);
    // Another card of a species it named: the candidate of that species.
    assert.deepEqual(preselectedDebatePicks(candidates, [named("other-card", "s2")]), ["b", "a", "c"]);
    // Named animals that are not candidates (a public debate's roster) leave the suggestions.
    assert.deepEqual(preselectedDebatePicks(candidates, [named("zzz", "s9")]), suggestedDebatePicks(candidates));
    assert.deepEqual(preselectedDebatePicks(candidates, []), ["a", "c", "d"]);
});

test("ask the public: nothing at stake, the community's pick, and only public words for others", () => {
    const wolf = "11111111-0000-4000-8000-0000000000a1";
    const heron = "11111111-0000-4000-8000-0000000000a3";
    // A Discover post names no visibility and no has_stakes, only asked_public.
    const post = decodeDebate({
        debate_id: "11111111-0000-4000-8000-000000000001", status: "settled", visibility: "public", asked_public: true,
        problem_public: "My manager keeps piling work on me.", winner_participant_id: wolf,
        participants: [
            {participant_id: wolf, seat: 0, animal: "Gray Wolf"},
            {participant_id: heron, seat: 1, animal: "Grey Heron", kind: "community", is_asker_owned: false}
        ]
    });
    assert.ok(post);
    assert.equal(post.askedPublic, true);
    assert.equal(debateHasStakes(post), false);
    assert.equal(debateIsOwnOnly(post), false, "not the own-animals note: it was asked in public");
    assert.deepEqual(debateResultLines(post, COMPANION_WORDS_EN), ["The community picked Gray Wolf's way."]);
    assert.equal(debateHeadline(post), "My manager keeps piling work on me.");
    // An older row says nothing: as before.
    const older = decodeDebate({id: "11111111-0000-4000-8000-000000000002", status: "voting", visibility: "public", participants: []});
    assert.equal(older?.askedPublic, false);
});
