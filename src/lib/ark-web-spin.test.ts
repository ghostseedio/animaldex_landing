import assert from "node:assert/strict";
import test from "node:test";
import {WEB_BUILD_SECONDS, WEB_CYCLE_SECONDS, threadOrder, webBuilt} from "@/ark-scene/props/web-spin";

test("a web is respun once an Ark day, each at its own moment, the same for every viewer", () => {
    assert.equal(webBuilt(0, 0), 0);
    assert.equal(webBuilt(0, WEB_BUILD_SECONDS / 2), 0.5);
    assert.equal(webBuilt(0, WEB_BUILD_SECONDS + 1), 1);
    assert.equal(webBuilt(0, WEB_CYCLE_SECONDS - 1), 1, "whole for the rest of its day");
    assert.ok(webBuilt(0, WEB_CYCLE_SECONDS + 10) < 0.1, "then taken down and spun again");
    assert.notEqual(webBuilt(0.2, 1000), webBuilt(0.7, 1000));
    assert.equal(webBuilt(0.3, 123456), webBuilt(0.3, 123456));
});

test("thread by thread as a spider lays them: the frame, the spokes, then the spiral from the rim inward", () => {
    assert.ok(threadOrder("anchor", 2, 3) < threadOrder("spoke", 0, 16));
    assert.ok(threadOrder("spoke", 15, 16) < threadOrder("spiral", 143, 144), "the hub's last turn comes after every spoke");
    assert.ok(threadOrder("spiral", 143, 144) < threadOrder("spiral", 0, 144), "the rim before the hub");
    assert.ok(threadOrder("spiral", 0, 144) <= 1);
});
