import assert from "node:assert/strict";
import {describe, it} from "node:test";
import {
    ASK_HANDOFF_MAX_TURNS,
    ASK_HANDOFF_TURN_MAX_CHARS,
    askHandoffLinks,
    askHandoffRequestBody,
    askLimitProAction,
    askLimitProPlan,
    isAskHandoffId,
    lastAskTurns,
    normalizeAskHandoff
} from "./ask-handoff";

const ID = "6f1d2c3b-4a5e-4f60-8b7c-9d0e1f2a3b4c";

describe("the hand-off payload", () => {
    it("keeps the last three turns that were really said, oldest first, cut at 1,500 characters", () => {
        const turns = lastAskTurns([
            {role: "assistant", text: "Hello there.", status: "complete"},
            {role: "user", text: "  Why are you   the strongest? ", status: "complete"},
            {role: "assistant", text: "Because of my size.", status: "complete"},
            {role: "user", text: "And?", status: "complete"},
            {role: "assistant", text: "", status: "failed"},
            {role: "assistant", text: "still typ", status: "streaming"},
            {role: "assistant", text: "x".repeat(2000), status: "complete"}
        ]);
        assert.equal(turns.length, ASK_HANDOFF_MAX_TURNS);
        assert.deepEqual(turns.map((turn) => turn.role), ["assistant", "user", "assistant"]);
        assert.equal(turns[0].text, "Because of my size.");
        assert.equal(turns[1].text, "And?");
        assert.equal(turns[2].text.length, ASK_HANDOFF_TURN_MAX_CHARS);
        assert.ok(turns[2].text.endsWith("…"));
    });

    it("is the species, its canonical id, the turns and the page", () => {
        assert.deepEqual(askHandoffRequestBody({
            slug: "blue-whale",
            speciesProfileId: ID,
            messages: [{role: "user", text: "Why are you the strongest?", status: "complete"}],
            path: "/tier-list/strongest-animals"
        }), {
            slug: "blue-whale",
            species_profile_id: ID,
            turns: [{role: "user", text: "Why are you the strongest?"}],
            path: "/tier-list/strongest-animals"
        });
    });

    it("is accepted as a row only when every part is in order", () => {
        assert.deepEqual(normalizeAskHandoff({
            slug: "blue-whale",
            species_profile_id: ID.toUpperCase(),
            turns: [{role: "user", text: "Why?"}, {role: "assistant", text: "Size."}],
            path: "/tier-list/strongest-animals?utm_source=x#ask"
        }), {
            species_slug: "blue-whale",
            species_profile_id: ID,
            turns: [{role: "user", text: "Why?"}, {role: "assistant", text: "Size."}],
            source_path: "/tier-list/strongest-animals"
        });
        assert.equal(normalizeAskHandoff({slug: "blue-whale", turns: []})?.species_profile_id, null);
        assert.equal(normalizeAskHandoff({slug: "blue-whale", turns: [], path: "https://evil.example/x"})?.source_path, null);
        for (const body of [
            null,
            [],
            {slug: "Blue Whale", turns: []},
            {slug: "blue-whale"},
            {slug: "blue-whale", turns: [{role: "system", text: "x"}]},
            {slug: "blue-whale", turns: [{role: "user", text: ""}]},
            {slug: "blue-whale", turns: [{role: "user", text: "a"}, {role: "user", text: "b"}, {role: "user", text: "c"}, {role: "user", text: "d"}]},
            {slug: "blue-whale", species_profile_id: "not-a-uuid", turns: []}
        ]) {
            assert.equal(normalizeAskHandoff(body), null, JSON.stringify(body));
        }
    });
});

describe("the hand-off links", () => {
    it("are the app's scheme and the https twin, with the id once there is one", () => {
        assert.deepEqual(askHandoffLinks({slug: "blue-whale", handoffId: ID}), {
            deepLink: `animaldex://talk?species=blue-whale&handoff=${ID}`,
            webLink: `https://animaldex.app/talk/blue-whale?handoff=${ID}`
        });
        assert.deepEqual(askHandoffLinks({slug: "blue-whale", handoffId: null}), {
            deepLink: "animaldex://talk?species=blue-whale",
            webLink: "https://animaldex.app/talk/blue-whale"
        });
        assert.equal(askHandoffLinks({slug: "blue-whale", handoffId: "nope"}).deepLink, "animaldex://talk?species=blue-whale");
        assert.ok(isAskHandoffId(ID));
        assert.ok(!isAskHandoffId("nope"));
    });
});

describe("Pro for a week", () => {
    it("sells the yearly plan when its Paddle price is set, else the monthly, else nothing", () => {
        assert.equal(askLimitProPlan({annual: "pri_annual", monthly: "pri_monthly"}), "pro_annual");
        assert.equal(askLimitProPlan({annual: "", monthly: "pri_monthly"}), "pro_upgrade");
        assert.equal(askLimitProPlan({annual: null, monthly: undefined}), null);
    });

    it("opens Paddle in place when signed in, goes through sign-in otherwise, and to /checkout without a price", () => {
        assert.deepEqual(askLimitProAction({plan: "pro_annual", signedIn: true}), {kind: "checkout", plan: "pro_annual"});
        assert.deepEqual(askLimitProAction({plan: "pro_upgrade", signedIn: false}), {kind: "sign_in", href: "/account?next=%2Fapp%2Fcredits%23pro"});
        assert.deepEqual(askLimitProAction({plan: null, signedIn: true}), {kind: "checkout_page", href: "/checkout"});
    });
});
