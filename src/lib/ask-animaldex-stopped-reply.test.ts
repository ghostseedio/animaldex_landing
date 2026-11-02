import assert from "node:assert/strict";
import test from "node:test";

// Leaving a chat mid-reply keeps what arrived; Stop keeps what was seen; nothing received keeps nothing.
import {askStoppedReplyText} from "@/lib/ask-animaldex/stopped-reply";

test("Stop keeps exactly the words on screen", () => {
    assert.equal(askStoppedReplyText({kept: "A wolf doesn't take", closing: false, received: "A wolf doesn't take every scrap"}), "A wolf doesn't take");
    assert.equal(askStoppedReplyText({kept: "A wolf doesn't take", closing: true, received: "A wolf doesn't take every scrap"}), "A wolf doesn't take");
});

test("leaving the chat keeps what had arrived", () => {
    assert.equal(askStoppedReplyText({kept: null, closing: true, received: "A wolf doesn't take every scrap"}), "A wolf doesn't take every scrap");
});

test("a stop with nothing shown and nothing received keeps nothing", () => {
    assert.equal(askStoppedReplyText({kept: null, closing: false, received: "A wolf doesn't take every scrap"}), null);
    assert.equal(askStoppedReplyText({kept: "  ", closing: true, received: "   "}), null);
    assert.equal(askStoppedReplyText({kept: null, closing: true, received: ""}), null);
});
