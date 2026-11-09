import assert from "node:assert/strict";
import test from "node:test";
import {
    ARK_EVENTS,
    arkChangeHasLoss,
    arkChangeRows,
    arkCountAt,
    arkDiaryVisibilityChoices,
    arkEffectiveVisibility,
    arkEntryState,
    arkIsReveal,
    arkIsRevision,
    arkMoneyBar,
    arkMoneyPercent,
    arkProfileSections,
    arkProblemCode,
    arkRevealAnchorId,
    arkRevealShownParams,
    arkRevisionAnchorId,
    arkRevisionDirection,
    arkRevisionShownParams,
    arkRowIsLoss,
    arkSignedMoney,
    arkSignedNumber,
    arkThreadChanges,
    arkVisibleStats,
    decodeArkAccept,
    decodeArkChange,
    decodeArkChanges,
    decodeArkStats,
    arkRevealSkipShowsNote,
    arkWithUndone
} from "@/lib/ark";
import {formatDisplayMoney} from "@/lib/account-settings";
import {decodeProblemDiary} from "@/lib/problem-diary";
import {decodeStepResult} from "@/lib/your-step";
import {ARK_COPY, COMPANION_WORDS_EN, companionWords} from "@/lib/companion-bond";
import en from "@/data/locales/en.json";
import id from "@/data/locales/id.json";

const id1 = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const STEP = id1(1);
const FOCUS = id1(2);
const SPECIES = id1(3);
const REVEAL = id1(10);
const REVISION = id1(11);

/** The contract's ledger entry (section 8), a Lesson: Money and Energy down, Reputation up, +2 Experience. */
const lessonRow = {
    id: REVEAL,
    kind: "lesson",
    source: "tap",
    parent_id: null,
    step_id: STEP,
    focus_id: FOCUS,
    species_profile_id: SPECIES,
    animal: "Komodo dragon",
    size: "medium",
    changes: [
        {stat: "reputation", before: 20, after: 24, delta: 4},
        {stat: "energy", before: 30, after: 28, delta: -2}
    ],
    money: {before_cents: 120000, after_cents: 114000, delta_cents: -6000},
    experience_delta: 2,
    ark_score: {before: 140, after: 143},
    story: ["You buy the lot before anyone else can.", "The £600 is gone by noon."],
    reaction: "Bold. Let's see what those materials are worth.",
    statement: null,
    chat_message_ref: null,
    created_at: "2026-11-09T10:00:00Z",
    undone_at: null
};

const revisionRow = {
    ...lessonRow,
    id: REVISION,
    kind: "revised",
    source: "chat",
    parent_id: REVEAL,
    changes: [],
    money: {before_cents: 114000, after_cents: 117600, delta_cents: 3600},
    experience_delta: 0,
    ark_score: {before: 143, after: 144},
    story: [],
    reaction: null,
    statement: "I actually got them for £400.",
    chat_message_ref: id1(500),
    created_at: "2026-11-10T10:00:00Z"
};

test("a ledger entry reads as the contract's shape, and every field is optional but its id and kind", () => {
    const change = decodeArkChange(lessonRow)!;
    assert.equal(change.kind, "lesson");
    assert.equal(change.source, "tap");
    assert.equal(change.stepId, STEP);
    assert.equal(change.animal, "Komodo dragon");
    assert.deepEqual(change.money, {beforeCents: 120000, afterCents: 114000, deltaCents: -6000, barBefore: arkMoneyBar(120000), barAfter: arkMoneyBar(114000)});
    assert.equal(change.direction, null);
    assert.deepEqual(change.arkScore, {before: 140, after: 143});
    assert.equal(change.story.length, 2);
    assert.equal(change.reaction, "Bold. Let's see what those materials are worth.");
    // As a JSON string too (PostgREST can send jsonb that way), and as part of a list or {changes}.
    assert.deepEqual(decodeArkChange(JSON.stringify(lessonRow)), change);
    assert.equal(decodeArkChanges({changes: [lessonRow, {kind: "earned"}, revisionRow]}).length, 2);
    assert.equal(decodeArkChanges([lessonRow]).length, 1);
    // Bad pieces go on their own: an unknown stat, a delta worked out from before and after, an unknown size.
    const tolerant = decodeArkChange({
        id: REVEAL,
        kind: "earned",
        size: "huge",
        changes: [{stat: "charisma", delta: 3}, {stat: "energy", before: 10, after: 14}, {stat: "relationships", delta: "2"}],
        story: ["", "  a beat  ", 3]
    })!;
    assert.equal(tolerant.size, null);
    assert.equal(tolerant.source, "tap");
    assert.deepEqual(tolerant.changes, [
        {stat: "energy", before: 10, after: 14, delta: 4},
        {stat: "relationships", before: 0, after: 2, delta: 2}
    ]);
    assert.deepEqual(tolerant.story, ["a beat"]);
    assert.equal(tolerant.money, null);
    assert.equal(tolerant.arkScore, null);
    assert.equal(decodeArkChange({id: "not-a-uuid", kind: "earned"}), null);
    assert.equal(decodeArkChange({id: REVEAL, kind: "won"}), null);
});

test("I'll do it: an old server's {step} alone has no reveal; a new one carries the reveal or why it was skipped", () => {
    const step = {id: STEP, step: "Buy the materials", accepted_at: "2026-11-09T10:00:00Z"};
    const old = decodeArkAccept({step}, decodeStepResult);
    assert.equal(old.step?.id, STEP);
    assert.equal(old.reveal, null);
    assert.equal(old.revealSkipped, null);
    const played = decodeArkAccept({step, reveal: lessonRow, reveal_skipped: null}, decodeStepResult);
    assert.equal(played.reveal?.id, REVEAL);
    for (const reason of ["sensitive", "animal_cap", "daily_cap", "already", "no_change"] as const) {
        assert.equal(decodeArkAccept({step, reveal: null, reveal_skipped: reason}, decodeStepResult).revealSkipped, reason);
    }
    assert.equal(decodeArkAccept({step, reveal: null, reveal_skipped: "weather"}, decodeStepResult).revealSkipped, null);
    // Only this animal's cap gets a quiet line; no_change, the old daily cap and unknown reasons show nothing.
    assert.deepEqual(["animal_cap", "daily_cap", "no_change", "sensitive", "already", "weather", null].map(arkRevealSkipShowsNote), [true, false, false, false, false, false, false]);
    // A revision or an undo is not a reveal.
    assert.equal(decodeArkAccept({step, reveal: revisionRow}, decodeStepResult).reveal, null);
});

test("ark_stats_v1 reads; the four life bars are null when the viewer may not see them; an old server reads as null", () => {
    const stats = decodeArkStats({
        ark_score: 143,
        is_self: true,
        bars_visible: true,
        bars: {money: {bar: 61, balance_cents: 114000}, relationships: 24, energy: 28, reputation: 24, experience: 2},
        last_changes: {money: {delta: -1, at: "2026-11-09T10:00:00Z"}, energy: {delta: -2, at: null}, reputation: {delta: 0}},
        steps: {total: 4, worked: 2, partly: 1, didnt_work: 1},
        powers_earned: 3
    })!;
    assert.equal(stats.arkScore, 143);
    assert.deepEqual(stats.bars.money, {bar: 61, balanceCents: 114000});
    assert.deepEqual(stats.lastChanges, {money: {delta: -1, at: "2026-11-09T10:00:00Z"}, energy: {delta: -2, at: null}});
    assert.deepEqual(stats.steps, {total: 4, worked: 2, partly: 1, didntWork: 1});
    assert.equal(stats.powersEarned, 3);
    assert.equal(stats.diaryVisibility, null);
    assert.deepEqual(arkVisibleStats(stats), ["money", "relationships", "energy", "reputation", "experience"]);

    const other = decodeArkStats({
        ark_score: 99,
        is_self: false,
        bars_visible: false,
        bars: {money: null, relationships: null, energy: null, reputation: null, experience: 7},
        steps: {total: 2},
        powers_earned: 1
    })!;
    assert.equal(other.bars.money, null);
    assert.equal(other.bars.energy, null);
    assert.equal(other.bars.experience, 7);
    assert.deepEqual(arkVisibleStats(other), ["experience"]);
    // Even if a server sent the bars anyway, a hidden diary hides them.
    assert.equal(decodeArkStats({ark_score: 1, bars_visible: false, bars: {energy: 50, experience: 0}})!.bars.energy, null);
    assert.equal(decodeArkStats(null), null);
    assert.equal(decodeArkStats({error: "function ark_stats_v1 does not exist"}), null);
    assert.equal(decodeArkStats({ark_score: 900, bars: {experience: 0}})!.arkScore, 500);
});

test("the Money bar is the contract's log scale", () => {
    assert.equal(arkMoneyBar(0), 0);
    assert.equal(arkMoneyBar(100_00), 40);
    assert.equal(arkMoneyBar(1_000_00), 60);
    assert.equal(arkMoneyBar(10_000_00), 80);
    assert.equal(arkMoneyBar(100_000_00), 100);
    assert.equal(arkMoneyBar(5_000_000_00), 100);
    assert.equal(arkMoneyBar(-500), 0);
});

test("Money shows in the reader's currency, signed with a true minus, and counts between the server's two values", () => {
    const gbp = (usd: number) => formatDisplayMoney(usd, "GBP", "en-GB");
    const usd = (value: number) => formatDisplayMoney(value, "USD", "en-US");
    assert.equal(arkSignedMoney(-6000, usd), "−$60.00");
    assert.equal(arkSignedMoney(3600, usd), "+$36.00");
    assert.equal(arkSignedMoney(-6000, gbp), `−${gbp(60)}`);
    assert.match(gbp(60), /^£\d+\.\d\d$/);
    assert.doesNotMatch(arkSignedMoney(-6000, gbp), /\$/);
    assert.equal(arkSignedNumber(4), "+4");
    assert.equal(arkSignedNumber(-2), "−2");
    assert.equal(arkSignedNumber(0), "0");
    assert.equal(arkCountAt(120000, 114000, 0), 120000);
    assert.equal(arkCountAt(120000, 114000, 1), 114000);
    assert.equal(arkCountAt(120000, 114000, 2), 114000);
    const mid = arkCountAt(120000, 114000, 0.5);
    assert.ok(mid < 120000 && mid > 114000);
    assert.equal(arkMoneyPercent({beforeCents: 120000, deltaCents: -6000}), -5);
    assert.equal(arkMoneyPercent({beforeCents: 0, deltaCents: 500}), 0);
    assert.equal(arkMoneyPercent(null), 0);
});

test("a change's rows: the life stats, Money, then Experience; a loss is a Lesson", () => {
    const lesson = decodeArkChange(lessonRow)!;
    const rows = arkChangeRows(lesson);
    assert.deepEqual(rows.map((row) => row.stat), ["energy", "reputation", "money", "experience"]);
    assert.deepEqual(rows.find((row) => row.stat === "money"), {stat: "money", before: arkMoneyBar(120000), after: arkMoneyBar(114000), delta: arkMoneyBar(114000) - arkMoneyBar(120000)});
    assert.equal(arkRowIsLoss(lesson, rows[0]), true);
    assert.equal(arkRowIsLoss(lesson, rows[1]), false);
    assert.equal(arkRowIsLoss(lesson, rows[2]), true);
    assert.equal(arkChangeHasLoss(lesson), true);
    const earned = decodeArkChange({...lessonRow, kind: "earned", changes: [{stat: "relationships", before: 20, after: 24, delta: 4}], money: null, experience_delta: 0})!;
    assert.equal(arkChangeHasLoss(earned), false);
    assert.deepEqual(arkChangeRows(earned).map((row) => row.stat), ["relationships"]);
});

test("a revision is better or worse by what it moved, its Money move counting even when the bar holds", () => {
    const better = decodeArkChange(revisionRow)!;
    assert.equal(arkIsRevision(better), true);
    assert.equal(arkIsReveal(better), false);
    assert.equal(arkRevisionDirection(better), "better");
    const worse = decodeArkChange({...revisionRow, money: {before_cents: 114000, after_cents: 100000, delta_cents: -14000}, experience_delta: 3})!;
    assert.equal(arkRevisionDirection(worse), "worse");
    assert.equal(arkRevisionDirection(decodeArkChange({...revisionRow, money: null})!), "none");
    assert.deepEqual(arkRevisionShownParams(better), {direction: "better", source: "chat"});
});

test("a revision goes under the message that caused it: by id, else by its time; never anywhere else", () => {
    const messages = [
        {id: id1(400), role: "assistant", createdAt: "2026-11-10T09:59:00Z"},
        {id: id1(500), role: "user", createdAt: "2026-11-10T10:00:00Z"},
        {id: "local-1", role: "user", createdAt: "2026-11-10T11:00:00Z"}
    ];
    assert.equal(arkRevisionAnchorId({chatMessageRef: id1(500).toUpperCase()}, messages), id1(500));
    assert.equal(arkRevisionAnchorId({chatMessageRef: "2026-11-10T11:02:00Z"}, messages), "local-1");
    // A stable id not in the loaded thread is not matched by time.
    assert.equal(arkRevisionAnchorId({chatMessageRef: id1(999)}, messages), null);
    assert.equal(arkRevisionAnchorId({chatMessageRef: "2026-11-10T12:30:00Z"}, messages), null);
    assert.equal(arkRevisionAnchorId({chatMessageRef: null}, messages), null);
    assert.equal(arkRevisionAnchorId({chatMessageRef: "yesterday"}, messages), null);
});

test("a reveal goes under the reply that set its step; the thread reads one reveal per step and the revisions oldest first", () => {
    const messages = [
        {id: "a", role: "assistant", createdAt: "", status: "complete", companionEvent: {stepSet: {id: STEP.toUpperCase()}}},
        {id: "b", role: "assistant", createdAt: "", status: "streaming", companionEvent: {stepSet: {id: STEP}}}
    ];
    assert.equal(arkRevealAnchorId(STEP, messages), "a");
    assert.equal(arkRevealAnchorId(id1(77), messages), null);
    const older = {...revisionRow, id: id1(12), created_at: "2026-11-09T12:00:00Z"};
    const {reveals, revisions} = arkThreadChanges(decodeArkChanges([revisionRow, older, lessonRow, {...lessonRow, id: id1(13)}]));
    assert.deepEqual(Array.from(reveals.keys()), [STEP]);
    assert.equal(reveals.get(STEP)?.id, REVEAL);
    assert.deepEqual(revisions.map((revision) => revision.id), [id1(12), REVISION]);
});

test("the profile's Stats tab is in the contract's order, and its Ark sections drop out on an old server", () => {
    assert.deepEqual(arkProfileSections({ark: true, isSelf: true}), [
        "arkScore", "bars", "stepsPowers", "qualities", "crew", "problems", "follows", "weekly", "collecting", "bodyStats"
    ]);
    assert.deepEqual(arkProfileSections({ark: true, isSelf: false, hasPublicDiary: false, hasFollows: true}), [
        "arkScore", "bars", "stepsPowers", "qualities", "crew", "follows", "weekly", "collecting", "bodyStats"
    ]);
    assert.deepEqual(arkProfileSections({ark: false, isSelf: false, hasPublicDiary: true, hasFollows: false}), [
        "qualities", "crew", "problems", "weekly", "collecting", "bodyStats"
    ]);
});

test("the Diary's switch: public by default, a teen is always private with no public option", () => {
    assert.deepEqual(arkDiaryVisibilityChoices(false), ["public", "private"]);
    assert.deepEqual(arkDiaryVisibilityChoices(true), ["private"]);
    assert.equal(arkEffectiveVisibility(null, false), "public");
    assert.equal(arkEffectiveVisibility("private", false), "private");
    assert.equal(arkEffectiveVisibility("public", true), "private");
});

test("a Diary entry carries its Ark state, its changes and sensitive, never a public summary; an old server's has none", () => {
    const base = {key: `focus:${FOCUS}`, problem: "Should I spend £600 on materials?", status: "working", animal: "Komodo dragon"};
    const [withArk] = decodeProblemDiary([{...base, ark: {state: "revised", changes: [lessonRow, revisionRow]}, public_summary: "Someone weighed a big purchase.", hidden: true, sensitive: false}]);
    assert.equal(withArk.focusId, FOCUS);
    assert.equal(withArk.ark?.state, "revised");
    assert.equal(withArk.ark?.changes.length, 2);
    // The Diary has no public summaries (owner, 2026-11-09): a server's leftover fields are not read.
    assert.equal("publicSummary" in withArk, false);
    assert.equal("hidden" in withArk, false);
    assert.equal(withArk.sensitive, false);
    const [old] = decodeProblemDiary([base]);
    assert.equal(old.ark, null);
    assert.equal(arkEntryState(old.ark), null);
    // The state from the changes when the server sends none: Revised, then Lesson, then Earned.
    const reveal = decodeArkChange(lessonRow)!;
    const revision = decodeArkChange(revisionRow)!;
    assert.equal(arkEntryState({state: null, changes: [reveal, revision]}), "revised");
    assert.equal(arkEntryState({state: null, changes: [reveal, {...revision, undoneAt: "2026-11-11T00:00:00Z"}]}), "lesson");
    assert.equal(arkEntryState({state: null, changes: [{...reveal, kind: "earned", changes: [], money: null}]}), "earned");
    assert.equal(decodeProblemDiary(JSON.stringify([base])).length, 1);
});

test("analytics: the contract's event names and parameters", () => {
    assert.deepEqual(Object.values(ARK_EVENTS), [
        "ark_reveal_shown", "ark_reveal_skipped", "ark_revision_shown", "ark_revision_undone",
        "diary_visibility_changed"
    ]);
    assert.deepEqual(arkRevealShownParams(decodeArkChange(lessonRow)!, null), {size: "medium", kind: "lesson", animal_species_id: SPECIES, money_pct: -5});
    assert.equal(arkRevealShownParams(decodeArkChange({...lessonRow, size: null, species_profile_id: null})!, id1(4)).animal_species_id, id1(4));
    assert.equal(arkRevealShownParams(decodeArkChange({...lessonRow, size: null})!, null).size, "medium");
    assert.equal(arkProblemCode("ERROR: diary_private_for_teens"), "diary_private_for_teens");
    assert.equal(arkProblemCode("boom"), "ark_unavailable");
});

test("every Ark word ships in every locale the site has, and the reader's locale lays over English", () => {
    const keys = (value: unknown, prefix = ""): string[] => Object.entries(value as Record<string, unknown>).flatMap(([key, item]) => (
        typeof item === "string" ? [`${prefix}${key}`] : keys(item, `${prefix}${key}.`)
    ));
    const english = keys(ARK_COPY).sort();
    for (const [name, locale] of [["en", en], ["id", id]] as const) {
        const ark = (locale as unknown as {companions: {ark: unknown}}).companions.ark;
        assert.deepEqual(keys(ark).sort(), english, `${name}.json companions.ark`);
    }
    assert.deepEqual((en as unknown as {companions: {ark: unknown}}).companions.ark, JSON.parse(JSON.stringify(ARK_COPY)));
    const indonesian = companionWords((id as unknown as {companions: unknown}).companions);
    assert.equal(indonesian.ark.lesson, "Pelajaran");
    assert.equal(indonesian.ark.stats.money, "Uang");
    assert.equal(COMPANION_WORDS_EN.ark.score, "Ark Score");
    // The placeholders survive translation.
    for (const key of ["lessonExperience", "scoreChange", "revisedFrom", "skippedAnimalCap", "latest", "crewLine", "scoreShort"] as const) {
        const placeholders = (text: string) => (text.match(/\{\w+\}/g) ?? []).sort();
        assert.deepEqual(placeholders(indonesian.ark[key]), placeholders(ARK_COPY[key]), key);
    }
});

test("the server's own shape (DB lane f8875782): direction, Money always sent with its bars, undo as its own row", () => {
    // Money unmoved is still sent (delta 0): no Money row then.
    const unmoved = decodeArkChange({...lessonRow, money: {before_cents: 114000, after_cents: 114000, delta_cents: 0, bar_before: 60, bar_after: 60}})!;
    assert.equal(arkChangeRows(unmoved).some((row) => row.stat === "money"), false);
    // The bars are the server's when it sends them.
    const moved = decodeArkChange({...lessonRow, money: {before_cents: 120000, after_cents: 114000, delta_cents: -6000, bar_before: 61, bar_after: 60}})!;
    assert.deepEqual(arkChangeRows(moved).find((row) => row.stat === "money"), {stat: "money", before: 61, after: 60, delta: -1});
    // A revision says its direction: it wins over what the numbers suggest.
    assert.equal(arkRevisionDirection(decodeArkChange({...revisionRow, direction: "worse"})!), "worse");
    // An undo is a row of its own (kind undone, parent = the revision): the revision reads undone, the undo row is dropped.
    const undo = {...revisionRow, id: id1(14), kind: "undone", source: "tap", parent_id: REVISION, created_at: "2026-11-11T09:00:00Z"};
    const merged = arkWithUndone(decodeArkChanges([undo, revisionRow, lessonRow]));
    assert.deepEqual(merged.map((change) => change.id), [REVISION, REVEAL]);
    assert.equal(merged[0].undoneAt, "2026-11-11T09:00:00Z");
    assert.equal(arkEntryState({state: null, changes: decodeArkChanges([lessonRow, revisionRow, undo])}), "lesson");
    const {revisions} = arkThreadChanges(decodeArkChanges([undo, revisionRow]));
    assert.equal(revisions.length, 1);
    assert.equal(revisions[0].undoneAt, "2026-11-11T09:00:00Z");
    // The owner's diary block on ark_stats_v1.
    const own = decodeArkStats({ark_score: 10, is_self: true, bars_visible: true, bars: {experience: 0}, diary: {visibility: "private", can_be_public: true}})!;
    assert.equal(own.diaryVisibility, "private");
    assert.equal(own.teen, false);
    const teen = decodeArkStats({ark_score: 10, is_self: true, bars_visible: false, bars: {experience: 0}, diary: {visibility: "private", can_be_public: false}})!;
    assert.equal(teen.teen, true);
    assert.equal(decodeArkStats({ark_score: 10, bars: {experience: 0}})!.teen, null);
});

test("a report's revision (no message ref) goes under their report on that step, else under the reply that set it", () => {
    const report = decodeArkChange({...revisionRow, source: "report", chat_message_ref: null})!;
    const withReport = [
        {id: "set", role: "assistant", createdAt: "", status: "complete", companionEvent: {stepSet: {id: STEP}}},
        {id: "report", role: "user", createdAt: "", stepReportId: STEP.toUpperCase()},
        {id: "reply", role: "assistant", createdAt: "", status: "complete"}
    ];
    assert.equal(arkRevisionAnchorId(report, withReport), "report");
    assert.equal(arkRevisionAnchorId(report, withReport.filter((message) => message.id !== "report")), "set");
    assert.equal(arkRevisionAnchorId(report, []), null);
});

test("the Diary's public notice says what public means, and no Diary word mentions summaries or hiding", () => {
    for (const words of [COMPANION_WORDS_EN.ark.diary, companionWords((id as {companions?: unknown}).companions).ark.diary]) {
        const all = Object.values(words).join(" ").toLowerCase();
        assert.doesNotMatch(all, /summar|ringkasan|hide|sembunyi|approve|setuj/);
    }
    assert.match(COMPANION_WORDS_EN.ark.diary.publicNotice, /debates you asked in public/);
    assert.match(COMPANION_WORDS_EN.ark.diary.publicNotice, /life bars/);
    assert.equal("summaryTitle" in COMPANION_WORDS_EN.ark.diary, false);
});
