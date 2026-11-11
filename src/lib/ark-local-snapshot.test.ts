import assert from "node:assert/strict";
import test from "node:test";
import fixtureV2 from "@/ark-scene/fixtures/snapshot-v2.json";
import {withArkFixtureFounders} from "@/lib/ark-founders-fixture";
import {arkLocalSnapshotOf, arkLocalSnapshotPath} from "@/lib/ark-local-snapshot";

test("?snapshot= is development only, and only a plain .json path under /public", () => {
    assert.equal(arkLocalSnapshotPath("/ark-local/real.json", true), "/ark-local/real.json");
    assert.equal(arkLocalSnapshotPath("/ark-scale/population-1x.json", true), "/ark-scale/population-1x.json");
    // Never in production.
    assert.equal(arkLocalSnapshotPath("/ark-local/real.json", false), null);
    // Nothing that climbs out of /public, no other kind of file, no URL.
    for (const bad of ["/../secrets.json", "/ark-local/../../x.json", "/ark-local/./real.json", "ark-local/real.json", "/ark-local/real.js", "https://example.com/a.json", "//x.json", "/a b.json", "/.env.json", "", null, 3]) {
        assert.equal(arkLocalSnapshotPath(bad, true), null, String(bad));
    }
});

test("a local file reads as the live answer: the snapshot, and its founders beside it", () => {
    const raw = withArkFixtureFounders(fixtureV2);
    const read = arkLocalSnapshotOf(raw);
    assert.ok(read);
    assert.equal(read.snapshot.animals.length, fixtureV2.animals.length);
    assert.equal(read.founders.names, true);
    assert.ok(Object.keys(read.founders.animals).length > 0);
    // `/api/ark/voyage`'s shape reads the same.
    const wrapped = arkLocalSnapshotOf({available: true, snapshot: raw, founders: null});
    assert.deepEqual(wrapped?.founders, read.founders);
    assert.equal(arkLocalSnapshotOf({nothing: true}), null);
});
