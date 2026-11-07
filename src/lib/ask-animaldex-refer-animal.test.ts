import assert from "node:assert/strict";
import test from "node:test";
import {referAnimalReply, referAnimalUpstreamBody} from "./ask-animaldex/refer-animal";

// "Ask another animal" (2026-11-07): the web passes the request to the apps'
// function (mode refer_animal), which checks it.

test("the function is sent the four fields and nothing else", () => {
    const body = referAnimalUpstreamBody({
        from_species_profile_id: "a", to_species_profile_id: "b", to_capture_id: "c", problem: "I can't decide.", user_id: "someone-else"
    });
    assert.deepEqual(body, {
        mode: "refer_animal",
        refer_animal: {from_species_profile_id: "a", to_species_profile_id: "b", to_capture_id: "c", problem: "I can't decide."}
    });
    assert.deepEqual(referAnimalUpstreamBody({}), {
        mode: "refer_animal",
        refer_animal: {from_species_profile_id: null, to_species_profile_id: null, to_capture_id: null, problem: null}
    });
});

test("a made referral comes back as its id and the referral the chat opens", () => {
    assert.deepEqual(referAnimalReply(200, {referral_id: "r1", referral: {id: "r1", species_profile_id: "s", capture_id: "c"}}), {
        status: 200,
        body: {referral_id: "r1", referral: {id: "r1", species_profile_id: "s", capture_id: "c"}}
    });
});

test("a refusal keeps the function's status and code; anything else is unavailable", () => {
    assert.deepEqual(referAnimalReply(403, {error: "not_your_animal"}), {status: 403, body: {error: "not_your_animal"}});
    assert.deepEqual(referAnimalReply(429, {error: "rate_limited"}), {status: 429, body: {error: "rate_limited"}});
    assert.deepEqual(referAnimalReply(403, {error: "age_restricted", reason: "under_13"}), {status: 403, body: {error: "age_restricted", reason: "under_13"}});
    assert.deepEqual(referAnimalReply(200, {}), {status: 502, body: {error: "unavailable"}});
    assert.deepEqual(referAnimalReply(500, null), {status: 500, body: {error: "unavailable"}});
});
