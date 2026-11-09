import assert from "node:assert/strict";
import test from "node:test";

// The owner's report of 2026-11-09 (iOS), on the web: after a debate way is
// chosen the debate stays in the host's chat with the way marked (A), the
// confirmation says what happens next (B), and a public card never clips
// (E: three animals, then "+N more").
import {decodeDebate, mergeDebate, type Debate} from "@/lib/debates";
import {DEBATE_CARD_ANIMALS, debateCardAnimals, debateStepAnimal, debateWayNextLine} from "@/lib/debate-words";
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
const full = decodeDebate({id: id(900), visibility: "public", status: "voting", is_asker: true, host_capture_id: id(1), participants, report, my_way: id(103), voting_deadline_at: "2026-11-11T00:00:00Z"}) as Debate;
// What My debates sends for it: no report, no chosen way.
const listRow = decodeDebate({id: id(900), visibility: "public", status: "voting", role: "asker", participants}) as Debate;

test("A: a sparser copy never takes away the report, the chosen way or that they asked it", () => {
    const merged = mergeDebate(full, listRow);
    assert.equal(merged.chosenParticipantId, id(103));
    assert.equal(merged.report?.problem, "Lead or stay?");
    assert.equal(merged.askerIsMe, true);
    assert.equal(merged.hostCaptureId, id(1));
    assert.equal(merged.votingDeadlineAt, full.votingDeadlineAt);
    assert.ok(merged.votingDeadlineAt);
    // A public copy that leaves the asker unsaid keeps the debate theirs (the chat lists only theirs).
    assert.equal(mergeDebate(full, {...listRow, askerIsMe: false}).askerIsMe, true);
    // The server's own word still moves them: a newer status, and a way reopened after it didn't work.
    assert.equal(mergeDebate(full, {...listRow, status: "settled"}).status, "settled");
    assert.equal(mergeDebate(full, {...listRow, triedParticipantIds: [id(103)]}).chosenParticipantId, null);
    assert.equal(mergeDebate(full, {...listRow, chosenParticipantId: id(102)}).chosenParticipantId, id(102));
    // Another debate's copy is just that copy.
    assert.equal(mergeDebate(full, {...listRow, id: id(901)}).report, null);
});

test("B: the chosen way says whose step it becomes and the Power doing it earns", () => {
    const komodo = full.participants[2];
    const pip = full.participants[1];
    // Not one of theirs: the host turns it into its own step.
    assert.equal(debateStepAnimal(full, komodo)?.nickname, "Luna");
    assert.equal(debateWayNextLine(full, komodo, COMPANION_WORDS_EN), "Next: Luna gives you a step from this way. Doing it earns Luna's Power, Pack Pursuit.");
    // One of theirs: that animal's own step and Power.
    assert.equal(debateWayNextLine(full, pip, COMPANION_WORDS_EN), "Next: Pip gives you a step from this way. Doing it earns Pip's Power, Curl and Wait.");
    // No Power name known: still says doing it earns the Power, never that choosing does.
    const noPower = {...full, participants: full.participants.map((item) => (item.seat === 0 ? {...item, powerName: null} : item))};
    assert.equal(debateWayNextLine(noPower, komodo, COMPANION_WORDS_EN), "Next: Luna gives you a step from this way. Doing it earns Luna's Power.");
    assert.equal(debateWayNextLine({participants: [komodo]}, komodo, COMPANION_WORDS_EN), null);
    const indonesian = companionWords((idLocale as unknown as {companions: unknown}).companions);
    assert.match(debateWayNextLine(full, pip, indonesian) ?? "", /^Berikutnya: Pip memberimu langkah dari cara ini\. .*Curl and Wait\.$/);
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

test("the new debate words ship in English and Indonesian", () => {
    const debateWords = (locale: unknown) => (locale as {companions: {debate: Record<string, string>}}).companions.debate;
    for (const key of ["wayNext", "wayNextNoPower", "moreCount"] as const) {
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
