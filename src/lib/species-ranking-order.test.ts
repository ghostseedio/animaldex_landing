import assert from "node:assert/strict";
import test from "node:test";
import {SPECIES_RANKING_ORDER, compareSpeciesRankingRows} from "@/lib/species-ranking-order";

test("ranked captures order by XP, then stats, then grade, then newest (iOS a989578b)", () => {
    const rows = [
        {capture_id: "a", total_progression_xp: 10, stat_total: 300, capture_grade: 9, capture_created_at: "2026-10-01T00:00:00Z"},
        {capture_id: "b", total_progression_xp: 40, stat_total: 100, capture_grade: 1, capture_created_at: "2026-01-01T00:00:00Z"},
        {capture_id: "c", total_progression_xp: 10, stat_total: 300, capture_grade: 7, capture_created_at: "2026-10-05T00:00:00Z"},
        {capture_id: "d", total_progression_xp: 10, stat_total: 350, capture_grade: 2, capture_created_at: "2026-02-01T00:00:00Z"},
        {capture_id: "e", total_progression_xp: 10, stat_total: 300, capture_grade: 9, capture_created_at: "2026-10-03T00:00:00Z"}
    ];
    assert.deepEqual([...rows].sort(compareSpeciesRankingRows).map((row) => row.capture_id), ["b", "d", "e", "a", "c"]);
});

test("missing sort keys count as zero and the id breaks a full tie", () => {
    const rows = [{capture_id: "z"}, {capture_id: "y", total_progression_xp: 1}, {capture_id: "x"}];
    assert.deepEqual([...rows].sort(compareSpeciesRankingRows).map((row) => row.capture_id), ["y", "x", "z"]);
});

test("the REST order names the same keys", () => {
    assert.equal(SPECIES_RANKING_ORDER, "total_progression_xp.desc,stat_total.desc,capture_grade.desc,capture_created_at.desc");
});
