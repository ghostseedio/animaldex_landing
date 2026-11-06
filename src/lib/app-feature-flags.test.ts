import assert from "node:assert/strict";
import test from "node:test";
import {decodeAppFeatureFlags, devAllFlagsOn, isAppFeatureOn, withDevOverride} from "@/lib/app-feature-flags";

test("a switch is on only when the server said true; a key never heard of is off", () => {
    const flags = decodeAppFeatureFlags({talk_front_door: true, trades: false, "Bad Key": true, card_packs: "true"});
    assert.deepEqual(flags, {talk_front_door: true, trades: false});
    assert.equal(isAppFeatureOn(flags, "talk_front_door"), true);
    assert.equal(isAppFeatureOn(flags, "trades"), false);
    assert.equal(isAppFeatureOn(flags, "card_packs"), false);
    assert.equal(isAppFeatureOn(decodeAppFeatureFlags({trades: false}), "talk_front_door"), false);
    assert.equal(isAppFeatureOn(decodeAppFeatureFlags(null), "talk_front_door"), false);
    assert.equal(isAppFeatureOn(decodeAppFeatureFlags([true]), "talk_front_door"), false);
    assert.equal(isAppFeatureOn(null, "talk_front_door"), false);
});

test("the development override turns the website's switches on, never in production", () => {
    assert.equal(devAllFlagsOn({NODE_ENV: "development", ANIMALDEX_DEV_ALL_FLAGS: "1"}), true);
    assert.equal(devAllFlagsOn({NODE_ENV: "production", ANIMALDEX_DEV_ALL_FLAGS: "1"}), false);
    assert.equal(devAllFlagsOn({NODE_ENV: "development"}), false);
    assert.deepEqual(withDevOverride({trades: false}, true), {trades: false, talk_front_door: true});
    assert.deepEqual(withDevOverride({talk_front_door: false}, false), {talk_front_door: false});
});
