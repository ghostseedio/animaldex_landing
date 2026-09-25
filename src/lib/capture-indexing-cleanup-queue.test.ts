import assert from "node:assert/strict";
import test from "node:test";
import {
    eligibleCountPath,
    eligiblePoolPath,
    ELIGIBLE_SOURCES,
    isIndexedNumber,
    MISSING_PROFILE_FILTER,
    mergeEligiblePoolRows,
    READY_CAPTURE_FILTERS,
    UNINDEXED_PROFILE_FILTER
} from "./capture-indexing-cleanup-queue";

// The admin page and the AnimalDex cron worker have to agree on what "eligible"
// means. They drifted once — both read a fixed head window of analysis_results
// (250 rows in the worker, 800 on the page) and dropped indexed rows afterwards,
// so when the oldest 250 all became indexed the worker went idle while the page
// still showed a backlog. These tests pin the shape that keeps them aligned.

test("both sources push the no-catalog-number condition into the query", () => {
    const unindexed = eligiblePoolPath("unindexed_profile", 800);
    const missing = eligiblePoolPath("missing_profile", 800);

    // Indexed rows are excluded by Postgres, not after the fetch.
    assert.ok(unindexed.includes(UNINDEXED_PROFILE_FILTER));
    assert.ok(unindexed.includes("species_profiles!inner"));
    // An analysis with no profile row at all stays eligible via the other source.
    assert.ok(missing.includes(MISSING_PROFILE_FILTER));
    assert.ok(!missing.includes("species_profiles!inner"));
});

test("every source carries the full capture eligibility filter set", () => {
    for (const source of ELIGIBLE_SOURCES) {
        const path = eligiblePoolPath(source, 800);
        const countPath = eligibleCountPath(source);
        for (const filter of READY_CAPTURE_FILTERS) {
            assert.ok(path.includes(filter), `${source} pool path is missing ${filter}`);
            assert.ok(countPath.includes(filter), `${source} count path is missing ${filter}`);
        }
        assert.ok(path.includes("captures!inner"));
    }
});

test("pool paths are ordered totally and bounded", () => {
    for (const source of ELIGIBLE_SOURCES) {
        const path = eligiblePoolPath(source, 42);
        // completed_at alone is not unique, so a limited page needs the tiebreak.
        assert.ok(path.includes("order=completed_at.asc,capture_id.asc"));
        assert.ok(path.includes("limit=42"));
    }
});

test("count paths ask for no rows, only the eligibility filters", () => {
    for (const source of ELIGIBLE_SOURCES) {
        const countPath = eligibleCountPath(source);
        assert.ok(!countPath.includes("limit="));
        assert.ok(!countPath.includes("order="));
        assert.ok(countPath.startsWith("select="));
    }
});

test("merging the sources de-duplicates and orders oldest analysis first", () => {
    const merged = mergeEligiblePoolRows([
        [
            {capture_id: "b", completed_at: "2026-07-02T00:00:00.000Z"},
            {capture_id: "a", completed_at: "2026-07-01T00:00:00.000Z"}
        ],
        [
            {capture_id: "c", completed_at: "2026-06-30T00:00:00.000Z"},
            // Same capture from both sources must appear once.
            {capture_id: "a", completed_at: "2026-07-01T00:00:00.000Z"}
        ]
    ]);

    assert.deepEqual(merged.map((row) => row.capture_id), ["c", "a", "b"]);
});

test("merging breaks completed_at ties by capture_id, deterministically", () => {
    const tied = "2026-07-01T00:00:00.000Z";
    const rows = [
        [{capture_id: "z", completed_at: tied}, {capture_id: "m", completed_at: tied}],
        [{capture_id: "a", completed_at: tied}]
    ];

    assert.deepEqual(mergeEligiblePoolRows(rows).map((row) => row.capture_id), ["a", "m", "z"]);
    assert.deepEqual(
        mergeEligiblePoolRows([...rows].reverse()).map((row) => row.capture_id),
        ["a", "m", "z"]
    );
});

test("merging drops rows with no capture id", () => {
    const merged = mergeEligiblePoolRows([
        [{capture_id: null, completed_at: "2026-07-01T00:00:00.000Z"}, {capture_id: "a", completed_at: "2026-07-02T00:00:00.000Z"}]
    ]);

    assert.deepEqual(merged.map((row) => row.capture_id), ["a"]);
});

test("isIndexedNumber matches the worker's predicate", () => {
    assert.equal(isIndexedNumber(1), true);
    assert.equal(isIndexedNumber(1152), true);
    assert.equal(isIndexedNumber(0), false);
    assert.equal(isIndexedNumber(null), false);
    assert.equal(isIndexedNumber(undefined), false);
    assert.equal(isIndexedNumber(Number.NaN), false);
    assert.equal(isIndexedNumber("5"), false);
});
