import assert from "node:assert/strict";
import test from "node:test";
import {agentSuggestions, confirmationTitle, sanitizeAgentReply, sanitizeAgentTurns} from "./wildlife-guide-agent";

const GUIDE = "0b6f5c1e-2d3a-4b5c-8d9e-0f1a2b3c4d5e";

test("the chat sent to the agent is trimmed and must end with the author's message", () => {
    assert.deepEqual(sanitizeAgentTurns([{role: "user", text: " Make it cheaper "}]), [{role: "user", text: "Make it cheaper"}]);
    assert.equal(sanitizeAgentTurns([{role: "user", text: "Hi"}, {role: "assistant", text: "Done."}]), null);
    assert.equal(sanitizeAgentTurns([{role: "system", text: "x"}]), null);
    assert.equal(sanitizeAgentTurns([]), null);
    assert.equal(sanitizeAgentTurns(Array.from({length: 60}, (_, index) => ({role: index % 2 ? "assistant" : "user", text: `m${index}`})).concat([{role: "user", text: "last"}]))?.length, 40);
});

test("only well-formed confirmations reach the buttons", () => {
    const reply = sanitizeAgentReply({
        reply: "I can hide it.",
        changedGuideIds: [GUIDE, "nope"],
        confirmations: [
            {kind: "hide_guide", guideId: GUIDE, guideTitle: "Ubud"},
            {kind: "delete_guide"},
            {kind: "share_all"},
            {kind: "drop_table"}
        ],
        turnsLeft: 7
    });
    assert.deepEqual(reply.changedGuideIds, [GUIDE]);
    assert.deepEqual(reply.confirmations, [{kind: "hide_guide", guideId: GUIDE, guideTitle: "Ubud"}, {kind: "share_all"}]);
    assert.equal(reply.turnsLeft, 7);
});

test("copy matches the app", () => {
    assert.equal(confirmationTitle({kind: "delete_guide", guideId: GUIDE, guideTitle: "Ubud"}), "Delete \"Ubud\"");
    assert.equal(confirmationTitle({kind: "hide_guide", guideId: GUIDE}), "Hide \"this guide\"");
    assert.equal(confirmationTitle({kind: "share_all"}), "Share all my guides");
    assert.deepEqual(agentSuggestions("Ubud"), ["Write a better title for \"Ubud\"", "Check the draft notes in \"Ubud\"", "Make \"Ubud\" cheaper"]);
    assert.equal(agentSuggestions().length, 3);
});
