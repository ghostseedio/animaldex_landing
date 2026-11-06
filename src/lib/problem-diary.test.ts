import assert from "node:assert/strict";
import test from "node:test";
import {
    PROBLEM_DIARY_WORDS_EN as WORDS,
    decodeProblemDiary,
    diaryAnimalName,
    diaryEventDetail,
    diaryEventIsWin,
    diaryEventTitle,
    diaryEvents,
    diaryOutcome,
    diaryOutcomeIsWin,
    diaryOutcomeText,
    diaryStatusText,
    joinNames,
    type ProblemDiaryEntry
} from "@/lib/problem-diary";

const STEP_A = "11111111-1111-4111-8111-111111111111";
const STEP_B = "22222222-2222-4222-8222-222222222222";
const DEBATE = "33333333-3333-4333-8333-333333333333";
const SPECIES = "44444444-4444-4444-8444-444444444444";

const row = (extra: Record<string, unknown> = {}) => ({
    key: "k1",
    problem: "I can't stop putting things off",
    status: "working",
    started_at: "2026-11-01T09:00:00Z",
    last_at: "2026-11-03T09:00:00Z",
    species_profile_id: SPECIES,
    animal: "Red Fox",
    capture_id: null,
    nickname: null,
    ...extra
});

const entry = (extra: Record<string, unknown> = {}): ProblemDiaryEntry => decodeProblemDiary([row(extra)])[0];

test("the diary reads a list or {entries}, and drops only the rows it cannot read", () => {
    const rows = [row(), {key: "no problem"}, row({key: "k2", problem: "  "}), row({key: "k3"})];
    assert.deepEqual(decodeProblemDiary(rows).map((item) => item.key), ["k1", "k3"]);
    assert.deepEqual(decodeProblemDiary({entries: [row()]}).map((item) => item.key), ["k1"]);
    assert.deepEqual(decodeProblemDiary(null), []);
    assert.deepEqual(decodeProblemDiary("nope"), []);
});

test("an entry decodes its steps, debates and Powers as iOS does", () => {
    const decoded = entry({
        status: "moved_on",
        nickname: " Luna ",
        steps: [
            {id: STEP_A, step: "Write the first line", status: "done", set_at: "2026-11-01T10:00:00Z", done_at: "2026-11-02T10:00:00Z", outcome: "partly", account: "Did half", media_paths: ["u/s/a.jpg"]},
            {id: "not-a-uuid", step: "Dropped"},
            {id: STEP_B, step: "Do ten minutes", status: "open", set_at: "2026-11-02T11:00:00Z"}
        ],
        debates: [
            {id: DEBATE, created_at: "2026-11-01T12:00:00Z", animals: ["Owl", "Fox"], chosen: {animal: "Owl", way: "Start small", at: "2026-11-01T13:00:00Z"}, tried: [{animal: "Fox", way: "Sprint"}, {way: "no animal"}]},
            {created_at: "no id"}
        ],
        powers: [{animal: "Red Fox", power_name: "Pounce", earned_at: "2026-11-03T08:00:00Z"}, {animal: "x"}]
    });
    assert.equal(decoded.status, "moved_on");
    assert.equal(diaryAnimalName(decoded), "Luna");
    assert.equal(decoded.steps.length, 2);
    assert.deepEqual([decoded.steps[0].isDone, decoded.steps[0].outcome, decoded.steps[0].record.account], [true, "partly", "Did half"]);
    assert.deepEqual([decoded.steps[1].isDone, decoded.steps[1].outcome], [false, null]);
    assert.equal(decoded.debates.length, 1);
    assert.deepEqual(decoded.debates[0].tried, [{animal: "Fox", way: "Sprint", at: null}]);
    assert.deepEqual(decoded.powers, [{animal: "Red Fox", powerName: "Pounce", earnedAt: "2026-11-03T08:00:00Z"}]);
    assert.equal(decoded.speciesProfileId, SPECIES);
    assert.equal(diaryStatusText(decoded.status, WORDS), "Moved on");
});

test("the row's outcome: what worked, a Power first", () => {
    const done = {id: STEP_A, step: "Write the first line", status: "done", outcome: "worked"};
    assert.deepEqual(diaryOutcome(entry({steps: [done], powers: [{animal: "Red Fox", power_name: "Pounce"}]})), {kind: "earned", power: "Pounce"});
    assert.deepEqual(diaryOutcome(entry({steps: [done]})), {kind: "stepDone", step: "Write the first line"});
    // A step told before outcomes were kept counts as worked.
    assert.deepEqual(diaryOutcome(entry({steps: [{...done, outcome: null}]})), {kind: "stepDone", step: "Write the first line"});
    assert.deepEqual(diaryOutcome(entry({debates: [{id: DEBATE, animals: ["Owl"], solved: {account: "My way", used: []}}]})), {kind: "solved"});
    assert.equal(diaryOutcomeIsWin({kind: "solved"}), true);
});

test("the row's outcome: else the open step, else how the last step went", () => {
    const open = {id: STEP_B, step: "Do ten minutes", status: "open"};
    const partly = {id: STEP_A, step: "Write the first line", status: "done", outcome: "partly"};
    const missed = {id: STEP_A, step: "Write the first line", status: "done", outcome: "didnt_work"};
    assert.deepEqual(diaryOutcome(entry({steps: [partly, open]})), {kind: "stepOpen", step: "Do ten minutes"});
    assert.deepEqual(diaryOutcome(entry({steps: [partly]})), {kind: "partly", step: "Write the first line"});
    assert.deepEqual(diaryOutcome(entry({steps: [missed]})), {kind: "didntWork", step: "Write the first line"});
    assert.equal(diaryOutcomeIsWin({kind: "partly", step: "x"}), false);
});

test("the row's outcome: else the way chosen, the debate, or the talk", () => {
    assert.deepEqual(diaryOutcome(entry({debates: [{id: DEBATE, animals: ["Owl", "Fox"], chosen: {animal: "Owl"}}]})), {kind: "triedWay", animal: "Owl"});
    assert.deepEqual(diaryOutcome(entry({debates: [{id: DEBATE, animals: ["Owl", "Fox", "Bee"]}]})), {kind: "debated", count: 3});
    assert.deepEqual(diaryOutcome(entry({nickname: "Luna"})), {kind: "talking", animal: "Luna"});
    assert.deepEqual(diaryOutcome(entry({status: "moved_on"})), {kind: "movedOn"});
});

test("the outcome sentences are iOS's words", () => {
    assert.equal(diaryOutcomeText({kind: "earned", power: "Pounce"}, WORDS), "Earned Pounce");
    assert.equal(diaryOutcomeText({kind: "solved"}, WORDS), "Solved it your way");
    assert.equal(diaryOutcomeText({kind: "triedWay", animal: "Owl"}, WORDS), "Tried Owl's way");
    assert.equal(diaryOutcomeText({kind: "stepDone", step: "Walk"}, WORDS), "Done: Walk");
    assert.equal(diaryOutcomeText({kind: "stepOpen", step: "Walk"}, WORDS), "Your step: Walk");
    assert.equal(diaryOutcomeText({kind: "partly", step: "Walk"}, WORDS), "Partly worked: Walk");
    assert.equal(diaryOutcomeText({kind: "didntWork", step: "Walk"}, WORDS), "Didn't work: Walk");
    assert.equal(diaryOutcomeText({kind: "debated", count: 3}, WORDS), "3 animals weighed in");
    assert.equal(diaryOutcomeText({kind: "talking", animal: "Luna"}, WORDS), "Talking it through with Luna");
    assert.equal(diaryOutcomeText({kind: "movedOn"}, WORDS), "Moved on");
});

test("the story runs in the order it happened; what has no date keeps its place", () => {
    const decoded = entry({
        steps: [
            {id: STEP_A, step: "Write the first line", status: "done", set_at: "2026-11-01T10:00:00Z", done_at: "2026-11-02T10:00:00Z", outcome: "worked", account: "Wrote it"},
            {id: STEP_B, step: "Do ten minutes", status: "open", set_at: "2026-11-02T11:00:00Z"}
        ],
        debates: [{
            id: DEBATE,
            created_at: "2026-11-01T09:30:00Z",
            animals: ["Owl", "Fox", "Bee"],
            tried: [{animal: "Fox", way: "Sprint", at: "2026-11-01T09:40:00Z"}],
            chosen: {animal: "Owl", way: "Start small", at: "2026-11-01T09:50:00Z"},
            solved: {account: "I did it my way", used: ["Owl", "Bee"]}
        }],
        powers: [{animal: "Red Fox", power_name: "Pounce", earned_at: "2026-11-02T10:00:01Z"}]
    });
    const events = diaryEvents(decoded);
    assert.deepEqual(events.map((event) => event.kind), ["brought", "debate", "chose", "chose", "solved", "stepDone", "earned", "stepSet"]);
    const titles = events.map((event) => diaryEventTitle(event, WORDS, "en"));
    assert.deepEqual(titles, [
        "You brought it to Red Fox",
        "Owl, Fox, and Bee weighed in",
        "You chose Fox's way",
        "You chose Owl's way",
        "You solved it your way",
        "Write the first line",
        "Pounce is yours",
        "Your step: Do ten minutes"
    ]);
    assert.equal(diaryEventDetail(events[3], WORDS, "en"), "Start small");
    assert.equal(diaryEventDetail(events[4], WORDS, "en"), "You used ideas from Owl and Bee\nYou said: “I did it my way”");
    assert.equal(diaryEventDetail(events[5], WORDS, "en"), "You said: “Wrote it”");
    assert.equal(diaryEventDetail(events[0], WORDS, "en"), null);
    assert.deepEqual(events.map(diaryEventIsWin), [false, false, false, false, true, true, true, false]);
});

test("a step that partly worked or did not says so under it, and is not neon", () => {
    const decoded = entry({steps: [{id: STEP_A, step: "Walk", status: "done", outcome: "didnt_work"}]});
    const done = diaryEvents(decoded).find((event) => event.kind === "stepDone")!;
    assert.equal(diaryEventDetail(done, WORDS, "en"), "It didn't work");
    assert.equal(diaryEventIsWin(done), false);
});

test("names join in the reader's language", () => {
    assert.equal(joinNames(["Owl"], "en"), "Owl");
    assert.equal(joinNames(["Owl", "Fox"], "en"), "Owl and Fox");
    assert.equal(joinNames(["Owl", "Fox"], "id"), "Owl dan Fox");
});
