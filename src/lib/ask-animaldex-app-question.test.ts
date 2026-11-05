import {describe, it} from "node:test";
import assert from "node:assert/strict";
import {looksLikeAppQuestion} from "./ask-animaldex/turn-kind";

describe("app questions (the fallback word list)", () => {
    it("needs app context before 'credit' means the app", () => {
        // Found by the uniqueness eval, 2026-11-06: this got the app-facts block.
        assert.equal(looksLikeAppQuestion("my coworker keeps taking credit for my work"), false);
        assert.equal(looksLikeAppQuestion("I'm out of credits"), true);
        assert.equal(looksLikeAppQuestion("how do credits work?"), true);
        assert.equal(looksLikeAppQuestion("can I buy credits?"), true);
    });
});
