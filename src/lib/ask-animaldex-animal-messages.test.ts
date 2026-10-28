import assert from "node:assert/strict";
import test from "node:test";

import {deliverableAskAnimalMessages, mergeAskAnimalMessages, parseAskAnimalMessages} from "@/lib/ask-animaldex/animal-messages";
import {askReplyReport, isAskReportChoice} from "@/lib/ask-animaldex/report";
import {createAskMessage} from "@/lib/ask-animaldex/thread";

const make = (message: {id: string; body: string; createdAt: string}) =>
    createAskMessage("assistant", message.body, {animalMessageId: message.id, createdAt: message.createdAt});

test("an animal's own messages join the owner's thread in time order, under their own ids", () => {
    const thread = [
        createAskMessage("assistant", "Hello.", {createdAt: "2026-10-20T08:00:00Z", isGreeting: true}),
        createAskMessage("user", "Hi", {createdAt: "2026-10-20T08:01:00Z"}),
        createAskMessage("assistant", "Glide wide.", {createdAt: "2026-10-20T08:02:00Z"})
    ];
    const incoming = parseAskAnimalMessages([
        {id: "m2", body: "Did the pitch go well?", created_at: "2026-10-22T18:00:00Z", read_at: null},
        {id: "m1", body: "The current turned today.", created_at: "2026-10-21T09:00:00Z", read_at: null},
        {id: "bad", body: "  ", created_at: "2026-10-21T09:00:00Z", read_at: null}
    ]);
    const merged = mergeAskAnimalMessages(incoming, thread, make);
    assert.deepEqual(merged.merged, ["m1", "m2"]);
    assert.deepEqual(merged.messages.map((message) => message.text), ["Hello.", "Hi", "Glide wide.", "The current turned today.", "Did the pitch go well?"]);
    // Opened again: nothing joins twice.
    assert.deepEqual(mergeAskAnimalMessages(incoming, merged.messages, make).merged, []);
});

test("a read message comes back only when it is newer than the thread, so a cleared chat stays clear", () => {
    const read = parseAskAnimalMessages([{id: "old", body: "Morning.", created_at: "2026-10-21T09:00:00Z", read_at: "2026-10-21T10:00:00Z"}]);
    assert.deepEqual(deliverableAskAnimalMessages(read, []), []);
    const older = [createAskMessage("user", "Hi", {createdAt: "2026-10-20T08:00:00Z"})];
    assert.equal(deliverableAskAnimalMessages(read, older).length, 1);
    const newer = [createAskMessage("user", "Hi", {createdAt: "2026-10-22T08:00:00Z"})];
    assert.deepEqual(deliverableAskAnimalMessages(read, newer), []);
});

test("a message written while an older conversation went on sits where it was written", () => {
    const thread = [
        createAskMessage("user", "First", {createdAt: "2026-10-20T08:00:00Z"}),
        createAskMessage("assistant", "Later", {createdAt: "2026-10-23T08:00:00Z"})
    ];
    const incoming = parseAskAnimalMessages([{id: "m", body: "Between", created_at: "2026-10-21T08:00:00Z", read_at: null}]);
    assert.deepEqual(mergeAskAnimalMessages(incoming, thread, make).messages.map((message) => message.text), ["First", "Between", "Later"]);
});

test("a report of an animal's reply files no person, the card, the choice and a capped snapshot", () => {
    assert.equal(isAskReportChoice("Offensive or harmful"), true);
    assert.equal(isAskReportChoice("Boring"), false);
    const report = askReplyReport({choice: "Inaccurate or misleading", animalName: "Gray Wolf", replyText: "x".repeat(2000), captureId: "1E0A1B2C-3D4E-4F50-8A6B-7C8D9E0F1A2B"});
    assert.equal(report.reason, "animal_reply: Inaccurate or misleading");
    assert.equal(report.contentId, "1e0a1b2c-3d4e-4f50-8a6b-7c8d9e0f1a2b");
    assert.ok(report.snapshot.startsWith("Gray Wolf: xxx"));
    assert.equal(report.snapshot.length, 1500);
    assert.equal(askReplyReport({choice: "Something else", animalName: " ", replyText: "Hi", captureId: "not-a-card"}).contentId, null);
    assert.equal(askReplyReport({choice: "Something else", animalName: " ", replyText: "Hi", captureId: null}).snapshot, "Animal: Hi");
});
