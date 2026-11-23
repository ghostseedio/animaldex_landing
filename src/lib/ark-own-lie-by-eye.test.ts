/**
 * ARK-CLIPS-2: the pilot rigs whose own lying clip is kept by eye (`OWN_LIE_BY_EYE`) are never also held standing or
 * made to take the posed lie, and they are all four-legged pilot rigs of the gaits set (rabbits, squirrels).
 */

import assert from "node:assert/strict";
import test from "node:test";
import {OWN_LIE_BY_EYE, POSED_LIE_HELD, POSED_LIE_OVER_PILOT} from "@/ark-scene/rig-player";

test("own lie by eye: none held standing, none given the posed lie over its own", () => {
    assert.ok(OWN_LIE_BY_EYE.size > 0);
    for (const slug of OWN_LIE_BY_EYE) {
        assert.ok(!POSED_LIE_HELD.has(slug), slug);
        assert.ok(!POSED_LIE_OVER_PILOT.has(slug), slug);
        assert.match(slug, /^[a-z0-9-]+$/, slug);
    }
});
