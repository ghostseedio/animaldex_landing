import assert from "node:assert/strict";
import test from "node:test";

// Debates in the thread, like Your step (docs/rich-chat/SPEC.md, section 2):
// the setup's rows, a started debate kept on the offer's message, the turn's
// name line, the vote's deadline and the section-2.6 words.
import {debateSetupRows, type DebateCandidate} from "@/lib/debates";
import {debateClosesIn, debateSpeakerLine, debateTimeLeft} from "@/lib/debate-words";
import {COMPANION_WORDS_EN} from "@/lib/companion-bond";
import {createAskMessage, loadAskThreads, saveAskThreads, type AskThreadStorage} from "@/lib/ask-animaldex/thread";

function candidate(n: number, fits = false, ownerIsMe = true): DebateCandidate {
    const captureId = `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
    return {
        id: captureId, captureId, kind: ownerIsMe ? "own" : "roster",
        ownerIsMe, speciesProfileId: `s${n}`, slug: `animal-${n}`, animal: `Animal ${n}`,
        nickname: null, powerName: `Power ${n}`, powerLesson: null, hearts: 3, fits
    };
}

test("the setup lists the suggestions, then six more at a time", () => {
    const all = [candidate(1), candidate(2, true), candidate(3), candidate(4, true), ...Array.from({length: 10}, (_, index) => candidate(index + 5))];
    const first = debateSetupRows(all, [], 0);
    assert.deepEqual(first.rows.map((row) => row.animal), ["Animal 2", "Animal 4"]);
    assert.equal(first.hasMore, true);
    // A pick outside the suggestions stays listed.
    assert.deepEqual(debateSetupRows(all, [all[0].id], 0).rows.map((row) => row.animal), ["Animal 1", "Animal 2", "Animal 4"]);
    const more = debateSetupRows(all, [], 6);
    assert.equal(more.rows.length, 8);
    assert.deepEqual(more.rows.slice(0, 3).map((row) => row.animal), ["Animal 1", "Animal 2", "Animal 3"]);
    const everything = debateSetupRows(all, [], 12);
    assert.equal(everything.rows.length, all.length);
    assert.equal(everything.hasMore, false);
    // Nothing fits best: the first few, then more.
    assert.deepEqual(debateSetupRows(all.filter((row) => !row.fits), [], 0).rows.map((row) => row.animal), ["Animal 1", "Animal 3", "Animal 5"]);
});

test("a debate started from an offer is kept on that message, through a reload", () => {
    const debateId = "5D6E7F80-1A2B-4C3D-8E9F-0A1B2C3D4E5F";
    const offer = createAskMessage("assistant", "A hedgehog would tell you the opposite.", {debateId, cardsDismissed: true});
    assert.equal(offer.debateId, debateId.toLowerCase());
    assert.equal(createAskMessage("assistant", "x", {debateId: "not-an-id"}).debateId, undefined);
    const store = new Map<string, string>();
    const storage: AskThreadStorage = {
        getItem: (key) => store.get(key) ?? null,
        setItem: (key, value) => void store.set(key, value),
        removeItem: (key) => void store.delete(key)
    };
    saveAskThreads(storage, {"capture:x": [offer]});
    assert.equal(loadAskThreads(storage)["capture:x"][0].debateId, debateId.toLowerCase());
});

test("each turn's name: the nickname for the asker's own animals, else the species, then its Power", () => {
    const base = {nickname: "Pip", animal: "Eurasian Otter", powerName: "Playful Persistence", isAskerOwned: true, ownerIsMe: true};
    assert.equal(debateSpeakerLine(base), "Pip · Playful Persistence");
    assert.equal(debateSpeakerLine({...base, isAskerOwned: false, ownerIsMe: false}), "Eurasian Otter · Playful Persistence");
    assert.equal(debateSpeakerLine({...base, powerName: null}), "Pip");
});

test("Voting closes in a short time, in the reader's language, and says nothing once it has passed", () => {
    const now = Date.parse("2026-10-31T12:00:00Z");
    assert.equal(debateClosesIn("2026-10-31T17:00:00Z", COMPANION_WORDS_EN, "en", now), "Voting closes in 5h");
    assert.equal(debateClosesIn("2026-10-31T12:20:00Z", COMPANION_WORDS_EN, "en", now), "Voting closes in 20m");
    assert.equal(debateClosesIn("2026-11-03T12:00:00Z", COMPANION_WORDS_EN, "en", now), "Voting closes in 3 days");
    assert.equal(debateClosesIn("2026-10-31T13:00:00Z", COMPANION_WORDS_EN, "en", now), "Voting closes in 1h");
    assert.equal(debateClosesIn("2026-10-31T11:00:00Z", COMPANION_WORDS_EN, "en", now), null);
    assert.equal(debateClosesIn(null, COMPANION_WORDS_EN, "en", now), null);
    assert.match(debateClosesIn("2026-10-31T17:00:00Z", {...COMPANION_WORDS_EN, debate: {...COMPANION_WORDS_EN.debate, votingClosesIn: "Voting ditutup dalam {time}"}}, "id", now) ?? "", /^Voting ditutup dalam 5 j$/);
});

test("one vote clock, the apps' (iOS DebateVoteClock): minutes up, hours down under 48 h, then days up", () => {
    const hour = 3600e3;
    const minute = 60e3;
    const now = Date.parse("2026-11-09T12:00:00Z");
    const at = (ms: number) => new Date(now + ms).toISOString();
    // The owner's report: a 48-hour vote with about 40 hours left said "1 day".
    assert.equal(debateClosesIn(at(40 * hour + 12 * minute), COMPANION_WORDS_EN, "en", now), "Voting closes in 40h");
    assert.deepEqual(debateTimeLeft(40 * hour + 12 * minute), {value: 40, unit: "hour"});
    assert.deepEqual(debateTimeLeft(47 * hour + 59 * minute), {value: 47, unit: "hour"});
    assert.deepEqual(debateTimeLeft(hour), {value: 1, unit: "hour"});
    assert.deepEqual(debateTimeLeft(35 * minute), {value: 35, unit: "minute"});
    assert.deepEqual(debateTimeLeft(34 * minute + 1000), {value: 35, unit: "minute"});
    assert.deepEqual(debateTimeLeft(20e3), {value: 1, unit: "minute"});
    assert.equal(debateClosesIn(at(35 * minute), COMPANION_WORDS_EN, "en", now), "Voting closes in 35m");
    assert.deepEqual(debateTimeLeft(48 * hour), {value: 2, unit: "day"});
    assert.deepEqual(debateTimeLeft(49 * hour), {value: 3, unit: "day"});
    assert.deepEqual(debateTimeLeft(72 * hour), {value: 3, unit: "day"});
    assert.equal(debateClosesIn(at(49 * hour), COMPANION_WORDS_EN, "en", now), "Voting closes in 3 days");
    assert.equal(debateTimeLeft(0), null);
    assert.equal(debateTimeLeft(-60e3), null);
    assert.equal(debateTimeLeft(Number.NaN), null);
    assert.equal(debateClosesIn(at(-1000), COMPANION_WORDS_EN, "en", now), null);
});

test("the in-thread debate words are the SPEC's", () => {
    const words = COMPANION_WORDS_EN.debate;
    assert.equal(words.setUp, "Set up the debate");
    assert.equal(words.quiet, "Debate");
    assert.equal(words.moreAnimals, "More animals");
    assert.equal(words.editingQuestion, "Editing the debate's question");
    assert.equal(words.editingPublic, "Editing what people will see");
    assert.equal(words.save, "Save");
    assert.equal(words.communityVote, "Community vote");
    assert.equal(words.votingClosesIn, "Voting closes in {time}");
    assert.equal(words.youChose, "You chose {name}'s way");
    assert.equal(words.tryFirst, "Try first: {text}");
    assert.equal(words.itsWay, "Its way:");
    assert.equal(words.fitsWhen, "Fits when {text}");
    assert.equal(words.costs, "Costs {text}");
    assert.equal(words.writingReport, "Writing the debate report");
});
