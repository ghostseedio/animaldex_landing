import assert from "node:assert/strict";
import test from "node:test";
import {askReplyCards, decodeAskChatCard} from "@/lib/ask-animaldex/chat-cards";
import {askReplyPieces} from "@/lib/ask-animaldex/thread-layout";
import {askStepCardMessageId, createAskMessage, loadAskThreads, saveAskThreads, type AskThreadStorage} from "@/lib/ask-animaldex/thread";

const STEP = "5d6e7f80-1a2b-4c3d-8e9f-0a1b2c3d4e5f";

function memoryStorage(): AskThreadStorage {
    const map = new Map<string, string>();
    return {
        getItem: (key) => map.get(key) ?? null,
        setItem: (key, value) => void map.set(key, value),
        removeItem: (key) => void map.delete(key)
    };
}

const reply = (cards: string[]) => [
    "Here is how my kind would see it.",
    "",
    ...cards.flatMap((card) => ["```animaldex-card", card, "```", ""]),
    "Shall we?"
].join("\n");

test("the Warmup and the Trials are the only cards the chat draws; only their kind is read", () => {
    assert.deepEqual(decodeAskChatCard('{"kind":"training","title":"Your lesson check","cta":"Take it"}'), {kind: "training"});
    assert.deepEqual(decodeAskChatCard('{"kind":"trial","frequency":"mid","title":"Your MID Trial"}'), {kind: "trial", frequency: "MID"});
    assert.deepEqual(decodeAskChatCard('{"kind":"trial"}'), {kind: "trial", frequency: null});
    // The apps' retired cards are no card here.
    assert.equal(decodeAskChatCard('{"kind":"apply","domain":"BUSINESS"}'), null);
    assert.equal(decodeAskChatCard('{"kind":"comparison"}'), null);
    assert.equal(decodeAskChatCard("not json"), null);
});

test("a reply's cards come out in order, one of each kind, and a fence still arriving is none yet", () => {
    const text = reply(['{"kind":"training"}', '{"kind":"trial","frequency":"LOW"}', '{"kind":"training"}']);
    assert.deepEqual(askReplyCards(text), [{kind: "training"}, {kind: "trial", frequency: "LOW"}]);
    assert.deepEqual(askReplyCards("Hello\n```animaldex-card\n{\"kind\":\"training\"}"), []);
    assert.deepEqual(askReplyCards("No cards here."), []);
});

test("a card is never drawn as a bubble or a drawing, finished or still arriving", () => {
    const text = reply(['{"kind":"training"}']);
    const pieces = askReplyPieces(text, true);
    assert.deepEqual(pieces.map((piece) => piece.kind), ["bubble", "bubble"]);
    assert.equal(pieces.some((piece) => piece.kind === "bubble" && piece.text.includes("animaldex-card")), false);
    const arriving = askReplyPieces("Here.\n\n```animaldex-card\n{\"kind\":\"tra", false);
    assert.deepEqual(arriving.map((piece) => piece.kind), ["bubble"]);
});

test("a report keeps its step through a reload, and a skipped card stays skipped", () => {
    const storage = memoryStorage();
    const said = createAskMessage("user", "I spoke first and it went fine.", {stepReportId: STEP});
    const answered = createAskMessage("assistant", reply(['{"kind":"training"}']), {cardsDismissed: true});
    saveAskThreads(storage, {"capture:x": [said, answered]});
    const [restoredSaid, restoredAnswered] = loadAskThreads(storage)["capture:x"];
    assert.equal(restoredSaid.stepReportId, STEP);
    assert.equal(restoredAnswered.cardsDismissed, true);
    assert.equal(createAskMessage("user", "hi").stepReportId, undefined);
});

test("the open step's card is under the reply that set it when that reply is loaded; otherwise it is pinned", () => {
    const set = createAskMessage("assistant", "Try this.", {companionEvent: {stepSet: {id: STEP, step: "Say it first"}}});
    const later = createAskMessage("assistant", "And again.", {companionEvent: {stepSet: {id: STEP, step: "Say it first"}}});
    const other = createAskMessage("assistant", "Something else.", {companionEvent: {stepSet: {id: "6e7f8091-2b3c-4d4e-9f0a-1b2c3d4e5f60", step: "Old"}}});
    const asked = createAskMessage("user", "Help me speak up.");
    // The newest reply that set it carries the card, so it shows once.
    assert.equal(askStepCardMessageId([asked, set, later], STEP), later.id);
    // Set in an earlier conversation, or trimmed away: no card in the thread, so it is pinned.
    assert.equal(askStepCardMessageId([asked, other], STEP), null);
    assert.equal(askStepCardMessageId([], STEP), null);
    // A reply still arriving does not carry it yet; nor does no step at all.
    assert.equal(askStepCardMessageId([{...set, status: "streaming"}], STEP), null);
    assert.equal(askStepCardMessageId([set], null), null);
});
