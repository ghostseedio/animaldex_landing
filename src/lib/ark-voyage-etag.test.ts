import assert from "node:assert/strict";
import test from "node:test";
import {arkEtagMatches, arkVoyageEtag} from "@/lib/ark-voyage-etag";

const DAY_MS = (86_400_000 * 14) / 365;
const read = (asOf: number, day: number, animals = [{id: "a", zone: "forest", thrive: {hunger: 0.4}}]) => ({available: true, snapshot: {as_of: new Date(asOf).toISOString(), ark_day: day, animals, voyage: {slug: "first"}}, founders: {names: true, animals: {}}});

test("the voyage's validator: the same Ark read 45 s later is the same; any change to an animal, the founders, or a new day step is not", () => {
    const t = Date.UTC(2026, 10, 14, 10, 0, 0);
    const first = arkVoyageEtag(read(t, 90.101));
    assert.match(first, /^W\/"ark-/);
    assert.equal(arkVoyageEtag(read(t + 45_000, 90.101 + 45_000 / DAY_MS)), first);
    assert.notEqual(arkVoyageEtag(read(t, 90.101, [{id: "a", zone: "forest", thrive: {hunger: 0.5}}])), first);
    assert.notEqual(arkVoyageEtag({...read(t, 90.101), founders: {names: false, animals: {}}}), first);
    // The day moves on a 0.05 step (~2.7 minutes): a new validator, so the young's ages and the nests follow.
    assert.notEqual(arkVoyageEtag(read(t + 200_000, 90.101 + 200_000 / DAY_MS)), first);
});

test("If-None-Match: a list, weak or strong, or *", () => {
    const tag = 'W/"ark-abc"';
    assert.ok(arkEtagMatches('W/"ark-abc"', tag));
    assert.ok(arkEtagMatches('"ark-abc"', tag));
    assert.ok(arkEtagMatches('W/"x", W/"ark-abc"', tag));
    assert.ok(arkEtagMatches("*", tag));
    assert.ok(!arkEtagMatches('W/"ark-abd"', tag));
    assert.ok(!arkEtagMatches(null, tag));
});
