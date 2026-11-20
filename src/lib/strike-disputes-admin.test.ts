import assert from "node:assert/strict";
import {test} from "node:test";
import {
    ageInDays,
    captureImageToSign,
    describeResolveError,
    findingsList,
    normalizeStatusFilter,
    parseDecisionRequest,
} from "./strike-disputes-admin";

const id = "0f9d6c1e-1b2a-4c3d-8e9f-0a1b2c3d4e5f";

test("status filter defaults to the open queue", () => {
    assert.equal(normalizeStatusFilter(null), "submitted");
    assert.equal(normalizeStatusFilter("bogus"), "submitted");
    assert.equal(normalizeStatusFilter(" Upheld "), "upheld");
    assert.equal(normalizeStatusFilter("all"), "all");
});

test("an overturn needs only a dispute id", () => {
    assert.deepEqual(parseDecisionRequest({disputeId: id, decision: "overturn"}), {ok: true, value: {disputeId: id, decision: "overturn", note: null}});
    assert.deepEqual(parseDecisionRequest({disputeId: id, decision: "overturn", note: "  checks out "}), {
        ok: true,
        value: {disputeId: id, decision: "overturn", note: "checks out"},
    });
});

test("an uphold needs a note, because the person is told why", () => {
    const missing = parseDecisionRequest({disputeId: id, decision: "uphold", note: "   "});
    assert.equal(missing.ok, false);
    assert.deepEqual(parseDecisionRequest({disputeId: id, decision: "uphold", note: "Scanlines are visible."}), {
        ok: true,
        value: {disputeId: id, decision: "uphold", note: "Scanlines are visible."},
    });
});

test("anything else is refused before the database", () => {
    assert.equal(parseDecisionRequest(null).ok, false);
    assert.equal(parseDecisionRequest({disputeId: "x", decision: "overturn"}).ok, false);
    assert.equal(parseDecisionRequest({disputeId: id, decision: "revoke"}).ok, false);
    assert.equal(parseDecisionRequest({disputeId: id, decision: "overturn", note: "x".repeat(1001)}).ok, false);
});

test("database errors read as sentences", () => {
    assert.match(describeResolveError('{"message":"dispute_already_decided"}'), /already decided/);
    assert.match(describeResolveError("Could not find the function public.admin_resolve_strike_dispute"), /20261017235500/);
    assert.match(describeResolveError("boom"), /^The decision failed: boom$/);
});

test("the flagged photo signs the card first, never a video original", () => {
    const base = {bucket: "captures", path: "u/a.jpg", cardBucket: null, cardPath: null, mediaKind: "photo"};
    assert.equal(captureImageToSign({capture: null}), null);
    assert.deepEqual(captureImageToSign({capture: {image: base} as never}), {bucket: "captures", path: "u/a.jpg"});
    assert.deepEqual(captureImageToSign({capture: {image: {...base, cardBucket: "cards", cardPath: "u/a_640.jpg"}} as never}), {
        bucket: "cards",
        path: "u/a_640.jpg",
    });
    assert.equal(captureImageToSign({capture: {image: {...base, mediaKind: "video"}} as never}), null);
});

test("findings keep only strings", () => {
    assert.deepEqual(findingsList(["paper texture", 3, "", "glare"]), ["paper texture", "glare"]);
    assert.deepEqual(findingsList({a: 1}), []);
});

test("age in whole days", () => {
    const now = new Date("2026-11-20T12:00:00Z");
    assert.equal(ageInDays("2026-11-18T13:00:00Z", now), 1);
    assert.equal(ageInDays("not a date", now), 0);
    assert.equal(ageInDays("2026-11-21T00:00:00Z", now), 0);
});
