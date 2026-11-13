import assert from "node:assert/strict";
import test from "node:test";
import {ARK_LIVE_WILD_ISLAND} from "@/ark-scene/islands/wild-default";
import {arkMeasureWorld} from "@/ark-scene/runtime/measure-world";

test("measure page world: --islands measures the live default wild island (v2) unless --world v1", () => {
    assert.equal(ARK_LIVE_WILD_ISLAND, "v2");
    assert.equal(arkMeasureWorld("?seconds=90&islands=1&prebuild=1"), ARK_LIVE_WILD_ISLAND);
    assert.equal(arkMeasureWorld("?islands=1&world=v1"), "v1");
    assert.equal(arkMeasureWorld("?islands=1&world=v2"), "v2");
    // One island (islands off): today's world, as live without the switch; `?world=v2` alone the bigger island by itself.
    assert.equal(arkMeasureWorld("?seconds=20"), "v1");
    assert.equal(arkMeasureWorld(""), "v1");
    assert.equal(arkMeasureWorld("?islands=0"), "v1");
    assert.equal(arkMeasureWorld("?world=v2"), "v2");
    // (Nothing set in a process without a page: the module's choice is for the page only.)
    assert.equal((globalThis as {__ARK_WORLD__?: string}).__ARK_WORLD__, undefined);
});
