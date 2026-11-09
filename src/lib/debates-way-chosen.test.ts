import assert from "node:assert/strict";
import test from "node:test";

// The owner's report of 2026-11-09 (iOS), on the web: after a debate way is
// chosen the debate stays in the host's chat with the way marked (A), the
// confirmation says what happens next (B), and a public card never clips
// (E: three animals, then "+N more").
import {decodeDebate, mergeDebate, type Debate} from "@/lib/debates";
import {DEBATE_CARD_ANIMALS, DEBATE_CARD_DENSITIES, debateCardAnimals, debateCardNextDensity, debateDiscoverRows, debateStepAnimal, debateWayNextLine} from "@/lib/debate-words";
import {COMPANION_WORDS_EN, companionWords} from "@/lib/companion-bond";
import en from "@/data/locales/en.json";
import idLocale from "@/data/locales/id.json";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const participants = [
    {participant_id: id(101), capture_id: id(1), seat: 0, animal_name: "Gray Wolf", nickname: "Luna", power_name: "Pack Pursuit", is_asker_owned: true, owner_is_me: true},
    {participant_id: id(102), capture_id: id(2), seat: 1, animal_name: "European Hedgehog", nickname: "Pip", power_name: "Curl and Wait", is_asker_owned: true, owner_is_me: true},
    {participant_id: id(103), seat: 2, animal_name: "Komodo Dragon", power_name: "Patient Venom"}
];
const report = {problem: "Lead or stay?", ways: participants.map((item) => ({participant_id: item.participant_id, way: `${item.animal_name}'s way`}))};
const full = decodeDebate({id: id(900), visibility: "public", status: "voting", is_asker: true, turns: [], host_capture_id: id(1), participants, report, my_way: id(103), voting_deadline_at: "2026-11-11T00:00:00Z"}) as Debate;
// What My debates sends for it: no report, no chosen way.
const listRow = decodeDebate({id: id(900), visibility: "public", status: "voting", role: "asker", participants}) as Debate;

test("A: a full read is one with turns and is_asker; a summary only brings the vote (iOS DebateReadMerge)", () => {
    assert.equal(full.isFullRead, true);
    assert.equal(listRow.isFullRead, false);
    // A copy this site decoded once keeps its own word.
    assert.equal(decodeDebate(JSON.parse(JSON.stringify(full)))?.isFullRead, true);
    assert.equal(decodeDebate(JSON.parse(JSON.stringify(listRow)))?.isFullRead, false);
    const offered = {participant_id: id(104), seat: 3, animal_name: "Barn Owl", power_name: "Acoustic Precision", votes: 1};
    const summary = decodeDebate({
        id: id(900), visibility: "public", status: "settled", rollovers: 1, boosted: true, votes_total: 9,
        winner_participant_id: id(103), settled_at: "2026-11-12T00:00:00Z", voting_deadline_at: "2026-11-12T00:00:00Z",
        participants: [...participants.map((item, seat) => ({...item, votes: seat + 2, nickname: null, is_asker_owned: false, owner_is_me: false})), offered]
    }) as Debate;
    const merged = mergeDebate(full, summary);
    // Kept from the full read: the report, the chosen way, that it is theirs, their names for their animals.
    assert.equal(merged.report?.problem, "Lead or stay?");
    assert.equal(merged.chosenParticipantId, id(103));
    assert.equal(merged.askerIsMe, true);
    assert.equal(merged.isFullRead, true);
    assert.equal(merged.participants[0].nickname, "Luna");
    // Brought by the summary: where the vote stands, and the animal that joined.
    assert.equal(merged.status, "settled");
    assert.equal(merged.totalVotes, 9);
    assert.equal(merged.rollovers, 1);
    assert.equal(merged.boosted, true);
    assert.equal(merged.winnerParticipantId, id(103));
    assert.equal(merged.settledAt, summary.settledAt);
    assert.deepEqual(merged.participants.map((item) => item.votes), [2, 3, 4, 1]);
    assert.equal(merged.participants[3].animal, "Barn Owl");
    // A list row with no deadline keeps the one known.
    assert.equal(mergeDebate(full, listRow).votingDeadlineAt, full.votingDeadlineAt);
    // A full read replaces a full read, keeping the pick and the vote when it does not carry them.
    const reread = decodeDebate({id: id(900), visibility: "public", status: "voting", is_asker: true, turns: [], participants, report: {problem: "Lead or stay, again?", ways: []}}) as Debate;
    assert.equal(mergeDebate(full, reread).report?.problem, "Lead or stay, again?");
    assert.equal(mergeDebate(full, reread).chosenParticipantId, id(103));
    // A full read over a summary is taken whole; a summary over a summary keeps the report it lacks.
    assert.equal(mergeDebate(listRow, full).report?.problem, "Lead or stay?");
    assert.equal(mergeDebate({...listRow, report: full.report}, listRow).report?.problem, "Lead or stay?");
    // This site's own copy just after a choice carries it to a summary on screen.
    assert.equal(mergeDebate(listRow, {...listRow, chosenParticipantId: id(102)}).chosenParticipantId, id(102));
    // Another debate's copy is just that copy.
    assert.equal(mergeDebate(full, {...listRow, id: id(901)}).report, null);
});

test("B: the chosen way says whose step it becomes and what doing it earns (iOS DebateCopy.chosenNext)", () => {
    const komodo = full.participants[2];
    const pip = full.participants[1];
    const luna = full.participants[0];
    // Not one of theirs: the host turns it into its own step.
    assert.equal(debateStepAnimal(full, komodo)?.nickname, "Luna");
    assert.equal(debateWayNextLine(full, komodo, COMPANION_WORDS_EN), "Next: Luna turns Komodo Dragon's way into your step. Doing it earns Luna's Power, Pack Pursuit.");
    // One of theirs, or the host's own: that animal's own step and Power.
    assert.equal(debateWayNextLine(full, pip, COMPANION_WORDS_EN), "Next: Pip gives you a step from this way. Doing it earns Pip's Power, Curl and Wait.");
    assert.equal(debateWayNextLine(full, luna, COMPANION_WORDS_EN), "Next: Luna gives you a step from this way. Doing it earns Luna's Power, Pack Pursuit.");
    // That Power already theirs: no Power to earn, tell it how it went.
    assert.equal(debateWayNextLine(full, pip, COMPANION_WORDS_EN, true), "Next: Pip gives you a step from this way. Do it, then tell Pip how it went.");
    assert.equal(debateWayNextLine(full, komodo, COMPANION_WORDS_EN, true), "Next: Luna gives you a step from this way. Do it, then tell Luna how it went.");
    // No Power name known: still says doing it earns the Power, never that choosing does.
    const noPower = {...full, participants: full.participants.map((item) => ({...item, powerName: null}))};
    assert.equal(debateWayNextLine(noPower, komodo, COMPANION_WORDS_EN), "Next: Luna turns Komodo Dragon's way into your step. Doing it earns Luna's Power.");
    assert.equal(debateWayNextLine(noPower, noPower.participants[1], COMPANION_WORDS_EN), "Next: Pip gives you a step from this way. Doing it earns Pip's Power.");
    assert.equal(debateWayNextLine({participants: [komodo]}, komodo, COMPANION_WORDS_EN), null);
    const indonesian = companionWords((idLocale as unknown as {companions: unknown}).companions);
    assert.equal(debateWayNextLine(full, pip, indonesian), "Berikutnya: Pip memberi Anda satu langkah dari cara ini. Dengan melakukannya, Anda mendapatkan Kekuatan Pip, Curl and Wait.");
});

test("E: a card shows at most three animals, then +N more", () => {
    const seven = Array.from({length: 7}, (_, index) => index);
    assert.equal(DEBATE_CARD_ANIMALS, 3);
    assert.deepEqual(debateCardAnimals(seven), {shown: [0, 1, 2], more: 4});
    assert.deepEqual(debateCardAnimals(seven, true), {shown: seven, more: 0});
    assert.deepEqual(debateCardAnimals([0, 1, 2]), {shown: [0, 1, 2], more: 0});
    assert.deepEqual(debateCardAnimals([0, 1, 2, 3]), {shown: [0, 1, 2], more: 1});
    assert.equal(COMPANION_WORDS_EN.debate.moreCount.replace("{n}", "4"), "+4 more");
});

test("E: Explore's card keeps the viewer's vote or the winner among its three, and steps down rather than scroll", () => {
    const seven = Array.from({length: 7}, (_, seat) => ({id: `p${seat}`, seat}));
    const shuffled = [seven[4], seven[0], seven[6], seven[2], seven[1], seven[5], seven[3]];
    const ids = (rows: {id: string}[]) => rows.map((row) => row.id);
    assert.deepEqual(ids(debateDiscoverRows(shuffled, null).shown), ["p0", "p1", "p2"]);
    assert.deepEqual(ids(debateDiscoverRows(shuffled, null).hidden), ["p3", "p4", "p5", "p6"]);
    // Their vote (or the winner) takes the third row, in seat order.
    assert.deepEqual(ids(debateDiscoverRows(shuffled, "p5").shown), ["p0", "p1", "p5"]);
    assert.deepEqual(ids(debateDiscoverRows(shuffled, "p5").hidden), ["p2", "p3", "p4", "p6"]);
    assert.deepEqual(ids(debateDiscoverRows(shuffled, "p1").shown), ["p0", "p1", "p2"]);
    assert.deepEqual(debateDiscoverRows(seven.slice(0, 3), "p9").hidden, []);
    assert.deepEqual([...DEBATE_CARD_DENSITIES], ["full", "noOpenings", "minimal", "faces"]);
    assert.equal(debateCardNextDensity("full"), "noOpenings");
    assert.equal(debateCardNextDensity("minimal"), "faces");
    assert.equal(debateCardNextDensity("faces"), null);
});

test("the new debate words ship in English and Indonesian", () => {
    const debateWords = (locale: unknown) => (locale as {companions: {debate: Record<string, string>}}).companions.debate;
    for (const key of ["wayNext", "wayNextNoPower", "wayNextTurns", "wayNextTurnsNoPower", "wayNextEarned", "moreCount", "askPublicNote"] as const) {
        assert.equal(debateWords(en)[key], COMPANION_WORDS_EN.debate[key]);
        assert.ok(debateWords(idLocale)[key]?.trim(), `id.json companions.debate.${key}`);
        assert.notEqual(debateWords(idLocale)[key], COMPANION_WORDS_EN.debate[key]);
    }
});

test("the chat reads a chosen way as the apps' function does (companion.chosen_way)", async () => {
    const {parseCompanionChosenWay, companionPromptLines} = await import("@/lib/ask-animaldex/companion-focus");
    assert.equal(parseCompanionChosenWay(null), null);
    assert.equal(parseCompanionChosenWay({animal: "Cat"}), null);
    const way = parseCompanionChosenWay({debate_id: "d1", animal: "  Komodo   Dragon ", yours: false, problem: "Lead or stay", way: "Watch first"});
    assert.deepEqual(way, {debate_id: "d1", animal: "Komodo Dragon", yours: false, problem: "Lead or stay", way: "Watch first"});
    const lines = companionPromptLines({
        state: {focus: null, open_trial: null, your_trials_done: 0, recent_done: [], referral: null, chosen_way: way},
        roster: [],
        powerEarned: false
    } as Parameters<typeof companionPromptLines>[0]).join("\n");
    assert.match(lines, /"chosen_way":\{"yours":false,"animal":"Komodo Dragon","problem":"Lead or stay","way":"Watch first"\}/);
});
