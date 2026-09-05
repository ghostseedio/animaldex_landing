import assert from "node:assert/strict";
import test from "node:test";
import {normalizeDiscoverPostId, parseDiscoverPostId} from "./discover-post";

test("invalid discover post ids fail closed without a database lookup", () => {
    assert.equal(parseDiscoverPostId(""), null);
    assert.equal(parseDiscoverPostId("not-a-post"), null);
    assert.equal(parseDiscoverPostId("capture-"), null);
    assert.equal(parseDiscoverPostId("../animals/lion"), null);
    assert.equal(normalizeDiscoverPostId("   "), null);
});

test("accepted discover post ids stay scoped to one entity", () => {
    assert.deepEqual(parseDiscoverPostId("capture-158d89d7-fdae-4cae-8158-013bddd5e3b6"), {
        kind: "capture",
        entityId: "158d89d7-fdae-4cae-8158-013bddd5e3b6",
        postId: "capture-158d89d7-fdae-4cae-8158-013bddd5e3b6"
    });
    assert.equal(parseDiscoverPostId("158d89d7-fdae-4cae-8158-013bddd5e3b6")?.postId, "capture-158d89d7-fdae-4cae-8158-013bddd5e3b6");
});
