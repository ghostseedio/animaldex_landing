import assert from "node:assert/strict";
import test from "node:test";
import {COMPANION_WORDS_EN, DEBATE_COPY, fillWords} from "@/lib/companion-bond";
import {
    debateAskMoreCandidates,
    debateAskMoreRoom,
    debateAskPublicStage,
    debateCanOfferAnimal,
    debateCandidatePick,
    debateOffersAskMore,
    debateOffersSolve,
    debateOpenStepFor,
    debateParticipantIsWild,
    debatePicksFor,
    debatePicksParam,
    debateProblemCode,
    debateRecommendedParticipant,
    debateReportIsRated,
    debateStepOwner,
    decodeDebate,
    decodeDebateCandidates,
    decodeDebatePicks,
    decodeDebateQualities,
    decodeDebateReport,
    decodeDebateSolution,
    preselectedDebatePicks,
    type Debate
} from "@/lib/debates";
import {debateFitLabel, debateProblemText, debateQualitiesLabel, debateSolutionHeadline} from "@/lib/debate-words";

/**
 * Debates v2 (docs/debates/V2.md; iOS e15b474b, 390e5c2a, d2eb6fa4): what
 * `debate_v2`, `debate_candidates_v2` and the debate flows answer, and the
 * pure rules the web draws from them.
 */

const DEBATE = "7a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";
const HOST_CARD = "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d";
const OWN_CARD = "2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d6e";
const P_HOST = "aa000000-0000-4000-8000-000000000001";
const P_KITE = "aa000000-0000-4000-8000-000000000002";
const P_WOLF = "aa000000-0000-4000-8000-000000000003";
const ORIOLE = "bb000000-0000-4000-8000-000000000001";
const KITE = "bb000000-0000-4000-8000-000000000002";
const WOLF = "bb000000-0000-4000-8000-000000000003";
const HERON = "bb000000-0000-4000-8000-000000000004";

function v2Row(overrides: Record<string, unknown> = {}) {
    return {
        id: DEBATE,
        visibility: "private",
        status: "private_done",
        is_asker: true,
        problem: "My brother keeps borrowing money and never pays it back.",
        created_at: "2026-11-03T08:00:00Z",
        extensions: 0,
        can_ask_more: true,
        can_solve: true,
        can_ask_public: true,
        public_refused: false,
        asked_public: false,
        participants: [
            {participant_id: P_KITE, seat: 1, species_profile_id: KITE, animal: "Brahminy Kite", power_name: "Ride the Thermal", is_asker_owned: false, kind: "wild"},
            {participant_id: P_HOST, seat: 0, capture_id: HOST_CARD, species_profile_id: ORIOLE, animal: "Black-naped Oriole", nickname: "Sunny", power_name: "Sing Your Boundary", is_asker_owned: true, is_mine: true, kind: "own"},
            {participant_id: P_WOLF, seat: 2, capture_id: OWN_CARD, species_profile_id: WOLF, animal: "Gray Wolf", power_name: "The Pack Holds", is_asker_owned: true, is_mine: true, kind: "own"}
        ],
        report: {
            problem: "A brother who borrows and never pays back.",
            ways: [
                {participant_id: P_HOST, seat: 0, way: "Say the limit once, kindly.", lesson: "Orioles sing their edge.", fits_when: "you want to keep it warm", costs: "an awkward talk", fit: 82},
                {participant_id: P_KITE, seat: 1, way: "Wait for the right moment.", fit: "64"},
                {participant_id: P_WOLF, seat: 2, way: "Bring the family in.", fit: 82}
            ],
            recommended_seat: 0,
            recommended_why: "It keeps the bond and stops the money."
        },
        ...overrides
    };
}

test("debate_v2 reads each animal's kind, Ask more, the solution and Ask the public", () => {
    const debate = decodeDebate(v2Row())!;
    assert.deepEqual(debate.participants.map((participant) => participant.seat), [0, 1, 2]);
    assert.equal(debateParticipantIsWild(debate.participants[1]), true);
    assert.equal(debateParticipantIsWild(debate.participants[0]), false);
    assert.equal(debate.canAskMore, true);
    assert.equal(debate.canSolve, true);
    assert.equal(debate.canAskPublic, true);
    assert.equal(debate.extensions, 0);
    assert.equal(debate.solution, null);
    // A read with the extras beside it names the kinds in a map.
    const mapped = decodeDebate({...v2Row(), participants: [{participant_id: P_KITE, seat: 1, animal: "Brahminy Kite"}], kinds: {[P_KITE]: "wild"}})!;
    assert.equal(mapped.participants[0].kind, "wild");
    // An older server says none of it.
    const older = decodeDebate({id: DEBATE, status: "private_done", participants: []})!;
    assert.equal(older.canAskMore, false);
    assert.equal(older.canSolve, false);
    assert.deepEqual(older.publicWays, {});
});

test("a rated report: a fit per way, one Recommended with its reason; an older report draws as before", () => {
    const debate = decodeDebate(v2Row())!;
    const report = debate.report!;
    assert.equal(debateReportIsRated(report), true);
    assert.deepEqual(report.ways.map((way) => way.fit), [82, 64, 82]);
    assert.equal(report.ways[0].fits, "you want to keep it warm");
    assert.equal(report.recommendedWhy, "It keeps the bond and stops the money.");
    assert.equal(debateRecommendedParticipant(debate)?.id, P_HOST);
    // No seat named: the highest fit, ties to the lower seat.
    const unnamed = {...debate, report: {...report, recommendedSeat: null}};
    assert.equal(debateRecommendedParticipant(unnamed)?.id, P_HOST);
    // Fits are clamped to 0–100.
    assert.equal(decodeDebateReport({ways: [{way: "x", fit: 140}]})?.ways[0].fit, 100);
    // A v1 report: no fit, no Recommended; a word under `fit` is where it fits.
    const older = decodeDebateReport({ways: [{way: "Go.", fit: "When you're restless."}], try_first: "Ask."})!;
    assert.equal(debateReportIsRated(older), false);
    assert.equal(older.ways[0].fits, "When you're restless.");
    assert.equal(debateRecommendedParticipant({...debate, report: older}), null);
    // One way without a fit: not rated.
    assert.equal(debateReportIsRated({ways: [{...report.ways[0]}, {...report.ways[1], fit: null}]}), false);
});

test("candidates v2: own cards by their card, wild animals by their species, each once", () => {
    const candidates = decodeDebateCandidates([
        {kind: "own", capture_id: OWN_CARD, owner_is_me: true, species_profile_id: WOLF, animal: "Gray Wolf", nickname: "Grey", power_name: "The Pack Holds", fits: true},
        {kind: "wild", capture_id: null, owner_is_me: false, species_profile_id: KITE, animal: "Brahminy Kite", power_name: "Ride the Thermal", fits: true},
        {kind: "wild", species_profile_id: KITE, animal: "dup"},
        {kind: "wild", species_profile_id: null, animal: "no species"},
        {species_profile_id: HERON, animal: "Grey Heron"}
    ]);
    assert.deepEqual(candidates.map((candidate) => [candidate.kind, candidate.id, candidate.captureId]), [
        ["own", OWN_CARD, OWN_CARD],
        ["wild", KITE, null],
        // No card and no kind: a wild animal.
        ["wild", HERON, null]
    ]);
    assert.deepEqual(debateCandidatePick(candidates[0]), {captureId: OWN_CARD});
    assert.deepEqual(debateCandidatePick(candidates[1]), {speciesProfileId: KITE});
    // The picks in the order picked, as create_debate_v2 takes them.
    const picks = debatePicksFor(candidates, [KITE, OWN_CARD, "unknown"]);
    assert.deepEqual(debatePicksParam(picks), [{species_profile_id: KITE}, {capture_id: OWN_CARD}]);
    // The setup pre-selects wild suggestions too.
    assert.deepEqual(preselectedDebatePicks(candidates, []), [OWN_CARD, KITE]);
});

test("the route reads the client's picks: a card or a species, each once, at most three", () => {
    assert.deepEqual(decodeDebatePicks([
        {captureId: OWN_CARD},
        {speciesProfileId: KITE},
        {capture_id: OWN_CARD},
        {species_profile_id: "nope"},
        {speciesProfileId: HERON},
        {speciesProfileId: WOLF}
    ]), [{captureId: OWN_CARD}, {speciesProfileId: KITE}, {speciesProfileId: HERON}]);
    assert.deepEqual(decodeDebatePicks("not a list"), []);
});

test("Ask more animals: new kinds only, never the host, six at most, the best fits picked up to the room left", () => {
    const debate = decodeDebate(v2Row())!;
    const rows = decodeDebateCandidates([
        {kind: "wild", species_profile_id: KITE, animal: "Brahminy Kite", fits: true},
        {kind: "wild", species_profile_id: HERON, animal: "Grey Heron", fits: true},
        ...Array.from({length: 8}, (_, index) => ({kind: "wild", species_profile_id: `cc000000-0000-4000-8000-00000000000${index}`, animal: `Animal ${index}`, fits: index < 3}))
    ]);
    const {rows: shown, picked} = debateAskMoreCandidates(rows, debate);
    assert.equal(shown.some((candidate) => candidate.id === KITE), false, "the kite is in it already");
    assert.equal(shown.length, 6);
    assert.equal(debateAskMoreRoom(debate), 3);
    assert.deepEqual(picked, [HERON, "cc000000-0000-4000-8000-000000000000", "cc000000-0000-4000-8000-000000000001"]);
    // Six in it: room for one more.
    const six = {...debate, participants: [...debate.participants, ...debate.participants.map((participant) => ({...participant, id: `${participant.id}x`, seat: participant.seat + 3}))]};
    assert.equal(debateAskMoreRoom(six), 1);
    assert.equal(debateAskMoreCandidates(rows, six).picked.length, 1);
});

test("Ask more and I solved it my way: the asker's, before a way is chosen, while the server allows", () => {
    const debate = decodeDebate(v2Row())!;
    assert.equal(debateOffersAskMore(debate), true);
    assert.equal(debateOffersSolve(debate), true);
    assert.equal(debateOffersAskMore({...debate, chosenParticipantId: P_HOST}), false);
    assert.equal(debateOffersSolve({...debate, chosenParticipantId: P_HOST}), false);
    assert.equal(debateOffersAskMore({...debate, askerIsMe: false}), false);
    assert.equal(debateOffersSolve({...debate, canSolve: false}), false);
});

test("the solution: whose ideas they used, the Powers it earned, the qualities, in one line", () => {
    const flow = {
        ok: true,
        solution: {
            used: [
                {seat: 0, participant_id: P_HOST, animal: "Black-naped Oriole", species_profile_id: ORIOLE, kind: "own", caught: true, note: "You said the limit once."},
                {seat: 1, participant_id: P_KITE, animal: "Brahminy Kite", species_profile_id: KITE, kind: "wild", caught: false}
            ],
            powers_earned: [{species_profile_id: ORIOLE, animal: "Black-naped Oriole", power_name: "Sing Your Boundary", capture_id: HOST_CARD}, {animal: "no power"}],
            qualities: [{tag_key: "patience", label: "Patience"}, {tag_key: "patience", label: "Patience"}, {tag_key: "timing", tag_label: "Right Timing"}]
        }
    };
    const solution = decodeDebateSolution(flow)!;
    assert.equal(solution.used.length, 2);
    assert.equal(solution.used[0].caught, true);
    assert.equal(solution.used[1].kind, "wild");
    assert.equal(solution.powersEarned.length, 1);
    assert.deepEqual(solution.qualities.map((quality) => quality.label), ["Patience", "Right Timing"]);
    // The solution itself reads the same; nothing is null.
    assert.equal(decodeDebateSolution(flow.solution)?.used.length, 2);
    assert.equal(decodeDebateSolution({ok: true}), null);
    assert.equal(decodeDebateSolution(null), null);
    // On the debate, as debate_v2 keeps it.
    const debate = decodeDebate(v2Row({solution: flow.solution, can_solve: false}))!;
    assert.equal(debate.solution?.powersEarned[0].powerName, "Sing Your Boundary");
    // Named as they are in the debate: the nickname for their own.
    assert.equal(debateSolutionHeadline(debate, solution, COMPANION_WORDS_EN), "You used ideas from Sunny and Brahminy Kite");
    assert.equal(debateSolutionHeadline(debate, {...solution, used: []}, COMPANION_WORDS_EN), "You found your own way");
    assert.equal(debateQualitiesLabel(solution.qualities, COMPANION_WORDS_EN), "Your qualities: Patience, Right Timing");
    assert.deepEqual(decodeDebateQualities([{tag_key: "a", label: "Calm"}, {tag_key: "b"}]), [{tagKey: "a", label: "Calm"}]);
    assert.equal(debateFitLabel(82.4, COMPANION_WORDS_EN), "Fit: 82 out of 100");
});

test("Ask the public, the asker's side: offered, drafting, reviewing, posted, refused", () => {
    const debate = decodeDebate(v2Row())!;
    assert.deepEqual(debateAskPublicStage(debate), {kind: "available"});
    assert.equal(debateAskPublicStage({...debate, askerIsMe: false}), null);
    assert.equal(debateAskPublicStage({...debate, canAskPublic: false}), null);
    assert.deepEqual(debateAskPublicStage({...debate, publicRefused: true, canAskPublic: false}), {kind: "refused"});
    const asked = decodeDebate(v2Row({
        visibility: "public", status: "approving", asked_public: true, problem_public: "A sibling who borrows and never pays back.",
        public_ways: [{participant_id: P_HOST, way: "Say the limit once."}, {participant_id: P_KITE, way: "Wait for the moment."}, {participant_id: "bad", way: "x"}]
    }))!;
    assert.deepEqual(debateAskPublicStage({...asked, status: "drafting"}), {kind: "drafting"});
    assert.deepEqual(debateAskPublicStage(asked), {kind: "reviewing", text: "A sibling who borrows and never pays back."});
    assert.deepEqual(debateAskPublicStage({...asked, status: "voting"}), {kind: "posted", text: "A sibling who borrows and never pays back."});
    assert.equal(debateAskPublicStage({...asked, status: "cancelled"}), null);
    assert.deepEqual(asked.publicWays, {[P_HOST]: "Say the limit once.", [P_KITE]: "Wait for the moment."});
});

test("Add one of your animals: someone else, while it is voting, who could vote, with room left", () => {
    const post: Debate = {...decodeDebate(v2Row({visibility: "public", status: "voting", asked_public: true, is_asker: false, can_vote: true}))!};
    assert.equal(debateCanOfferAnimal(post), true);
    assert.equal(debateCanOfferAnimal({...post, askerIsMe: true}), false);
    assert.equal(debateCanOfferAnimal({...post, canVote: false}), false);
    assert.equal(debateCanOfferAnimal({...post, status: "settled"}), false);
    assert.equal(debateCanOfferAnimal({...post, askedPublic: false}), false);
    const full = {...post, participants: Array.from({length: 7}, (_, index) => ({...post.participants[0], id: String(index), seat: index}))};
    assert.equal(debateCanOfferAnimal(full), false);
});

test("a debate's page shows the open step its chosen way became, from the animal whose chat holds it", () => {
    const debate = decodeDebate(v2Row())!;
    const chose = (participantId: string | null, askerIsMe = true) => ({...debate, chosenParticipantId: participantId, askerIsMe});
    // The host's own way, and another of their own animals: that animal's step.
    assert.equal(debateStepOwner(chose(P_HOST))?.speciesProfileId, ORIOLE);
    assert.equal(debateStepOwner(chose(P_WOLF))?.speciesProfileId, WOLF);
    // A wild animal's way: the host took it on.
    assert.equal(debateStepOwner(chose(P_KITE))?.speciesProfileId, ORIOLE);
    assert.equal(debateStepOwner(chose(null)), null);
    assert.equal(debateStepOwner(chose(P_HOST, false)), null);
    const step = (speciesProfileId: string, setAt: string | null, captureId: string | null = null) => ({speciesProfileId, captureId, setAt, step: "Say it once."});
    const older = step(ORIOLE, "2026-11-02T08:00:00Z");
    const fresh = step(ORIOLE, "2026-11-03T08:10:00Z");
    const otherAnimal = step(WOLF, "2026-11-03T08:10:00Z");
    assert.equal(debateOpenStepFor(chose(P_KITE), [older]), null);
    assert.equal(debateOpenStepFor(chose(P_KITE), [otherAnimal, fresh]), fresh);
    // A minute's grace, and a step with no time is the animal's step.
    assert.equal(debateOpenStepFor(chose(P_HOST), [step(ORIOLE, "2026-11-03T07:59:30Z")])?.setAt, "2026-11-03T07:59:30Z");
    assert.equal(debateOpenStepFor(chose(P_HOST), [step(ORIOLE, null)])?.setAt, null);
    // By card, when the species is not known.
    assert.equal(debateOpenStepFor(chose(P_WOLF), [step("dd000000-0000-4000-8000-000000000000", null, OWN_CARD)])?.captureId, OWN_CARD);
    assert.equal(debateOpenStepFor(chose(null), [fresh]), null);
});

test("V2's refusals have their own words", () => {
    assert.equal(debateProblemCode("ERROR: no_more_animals"), "no_more_animals");
    assert.equal(debateProblemCode("debate_full"), "debate_full");
    assert.equal(debateProblemCode("solution_too_short"), "solution_too_short");
    assert.equal(debateProblemCode("judge_unavailable"), "judge_unavailable");
    assert.equal(debateProblemCode("already_offered"), "already_offered");
    assert.equal(debateProblemCode("debate_check_unavailable"), "debate_check_unavailable");
    const words = COMPANION_WORDS_EN;
    assert.equal(debateProblemText("no_more_animals", words), "That's as many animals as one debate holds.");
    assert.equal(debateProblemText("debate_full", words), "That's as many animals as one debate holds.");
    assert.equal(debateProblemText("solution_too_short", words), "Tell them a little more about what you did.");
    assert.equal(debateProblemText("already_offered", words), "One of your animals is already in this debate.");
    assert.equal(debateProblemText("already_in_debate", words), "An animal of that kind is already in this debate.");
    assert.equal(debateProblemText("judge_unavailable", words), "That didn't go through. Try again in a moment.");
});

test("the V2 words are iOS's, word for word", () => {
    assert.equal(DEBATE_COPY.wild, "Wild");
    assert.equal(DEBATE_COPY.wildNote, "Not caught yet");
    assert.equal(DEBATE_COPY.askMore, "Ask more animals");
    assert.equal(DEBATE_COPY.askMoreTitle, "Who else should weigh in?");
    assert.equal(DEBATE_COPY.askMoreGo, "Bring them in");
    assert.equal(DEBATE_COPY.recommended, "Recommended");
    assert.equal(DEBATE_COPY.fitCaption, "How well each way fits what you told them");
    assert.equal(DEBATE_COPY.solvedMine, "I solved it my way");
    assert.equal(DEBATE_COPY.solvedTitle, "How did you solve it?");
    assert.equal(DEBATE_COPY.solvedPlaceholder, "What did you do?");
    assert.equal(DEBATE_COPY.solvedSend, "Tell them");
    assert.equal(fillWords(DEBATE_COPY.powerEarned, {power: "Sing Your Boundary"}), "Sing Your Boundary is yours");
    assert.equal(DEBATE_COPY.askPublic, "Ask the public");
    assert.equal(DEBATE_COPY.askPublicGo, "Prepare it");
    assert.equal(DEBATE_COPY.askPublicPost, "Post it");
    assert.equal(DEBATE_COPY.offerAnimal, "Add one of your animals");
    assert.equal(COMPANION_WORDS_EN.debateWeb.emptyBody, "Debates start in a chat. Bring an animal a problem, and when it offers a debate, say yes.");
});
