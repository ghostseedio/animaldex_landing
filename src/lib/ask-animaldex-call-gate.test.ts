import assert from "node:assert/strict";
import test from "node:test";

import {askCallsOffered} from "./ask-animaldex/call-gate";

test("production offers no call until the switch is on", () => {
    assert.equal(askCallsOffered(true, {NODE_ENV: "production"}), false);
    assert.equal(askCallsOffered(true, {NODE_ENV: "production", NEXT_PUBLIC_ANIMAL_CALLS: "off"}), false);
    assert.equal(askCallsOffered(true, {NODE_ENV: "production", NEXT_PUBLIC_ANIMAL_CALLS: "on"}), true);
});

test("a signed-out reader never calls in production", () => {
    assert.equal(askCallsOffered(false, {NODE_ENV: "production", NEXT_PUBLIC_ANIMAL_CALLS: "on"}), false);
});

test("development offers the call to anyone, to try it locally", () => {
    assert.equal(askCallsOffered(false, {NODE_ENV: "development"}), true);
    assert.equal(askCallsOffered(true, {}), true);
});
