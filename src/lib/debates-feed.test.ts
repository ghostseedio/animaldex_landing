import assert from "node:assert/strict";
import test from "node:test";
import {
    debateFeedSlotId,
    debateFeedSlots,
    decodeDiscoverDebateFeed,
    mergeDiscoverDebateViews,
    pinnedDebates,
    planDebateFeed,
    type Debate,
    type DebateFeedSlot
} from "@/lib/debates";
import {discoverSeenPostForItemId, DiscoverSeenOutbox, isDiscoverSeenPost, itemIdsScrolledPast} from "@/lib/discover-seen";

const ID = (n: number) => `7a1b2c3d-4e5f-4a6b-8c7d-${String(n).padStart(12, "0")}`;
const P = (n: number) => `aa000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

/** One row as `discover_debate_feed_v1` (and the timeline view) answers it. */
function feedRow(n: number, overrides: Record<string, unknown> = {}) {
    return {
        debate_id: ID(n),
        created_at: `2026-11-1${n}T08:00:00Z`,
        status: "voting",
        problem_public: `Problem ${n}`,
        report: null,
        voting_deadline_at: "2026-11-20T08:00:00Z",
        rollovers: 0,
        boosted: false,
        settled_at: null,
        winner_participant_id: null,
        votes_total: n,
        viewer_vote_participant_id: null,
        viewer_can_vote: true,
        viewer_cant_vote_reason: null,
        viewer_is_participant: false,
        credits_for_winner: null,
        participants: [
            {participant_id: P(n * 10 + 1), seat: 0, animal: "Gray Wolf", power_name: "The Pack Holds", opening: "Stay together.", votes: null, is_winner: false},
            {participant_id: P(n * 10 + 2), seat: 1, animal: "Otter", power_name: "Play", opening: "Play first.", votes: null, is_winner: false}
        ],
        asked_public: false,
        ...overrides
    };
}

const post = (id: string, date: string) => ({id, date});

test("the feed function's pinned flag decides boosted, and the server's order is kept", () => {
    const debates = decodeDiscoverDebateFeed([
        feedRow(2, {pinned: true, boosted: true, novelty: 1}),
        feedRow(1, {pinned: true, boosted: true, novelty: 1}),
        // Listed but not pinned: the server's word wins over the row's own `boosted`.
        feedRow(3, {pinned: false, boosted: true, novelty: 1}),
        feedRow(4, {pinned: false, novelty: 0.004, seen_at: "2026-11-16T10:00:00Z"})
    ])!;
    assert.deepEqual(debates.map((debate) => debate.id), [ID(2), ID(1), ID(3), ID(4)]);
    assert.deepEqual(debates.map((debate) => debate.boosted), [true, true, false, false]);
    assert.ok(debates.every((debate) => debate.visibility === "public"));
});

test("an answer that is not a list falls back to the two views (null), a repeated debate is read once", () => {
    assert.equal(decodeDiscoverDebateFeed(null), null);
    assert.equal(decodeDiscoverDebateFeed({message: "Could not find the function"}), null);
    assert.deepEqual(decodeDiscoverDebateFeed([]), []);
    const twice = decodeDiscoverDebateFeed([feedRow(1, {pinned: true}), feedRow(1)])!;
    assert.equal(twice.length, 1);
    assert.equal(twice[0].boosted, true);
});

test("the two-view fallback: pins first and boosted, then the newest, once each", () => {
    const merged = mergeDiscoverDebateViews(
        [feedRow(3, {boosted: true})],
        [feedRow(4), feedRow(3, {boosted: true}), feedRow(2)]
    );
    assert.deepEqual(merged.map((debate) => debate.id), [ID(3), ID(4), ID(2)]);
    assert.deepEqual(merged.map((debate) => debate.boosted), [true, false, false]);
    assert.deepEqual(mergeDiscoverDebateViews(undefined, [feedRow(1)]).map((debate) => debate.id), [ID(1)]);
});

test("a voted pinned debate keeps its slot when the same debates are read again", () => {
    const posts = Array.from({length: 7}, (_, i) => post(`capture-${i}`, `2026-11-17T0${8 - i}:00:00Z`));
    const first = decodeDiscoverDebateFeed([
        feedRow(1, {pinned: true, boosted: true}),
        feedRow(2, {pinned: true, boosted: true}),
        feedRow(5)
    ])!;
    const plan = planDebateFeed(first);
    const before = debateFeedSlots(posts, first, plan);
    assert.deepEqual(before.slice(0, 2).map(debateFeedSlotId), [`debate-${ID(1)}`, `debate-${ID(2)}`]);

    // The viewer votes on the first one: the same read, now with their vote and no pin from the server.
    const voted = decodeDiscoverDebateFeed([
        feedRow(1, {pinned: false, boosted: false, viewer_vote_participant_id: P(11), viewer_can_vote: false, viewer_cant_vote_reason: "already_voted"}),
        feedRow(2, {pinned: true, boosted: true}),
        feedRow(5)
    ])!;
    // What the old feed did: the voted debate leaves the pins, the head shifts and it drops to its date.
    assert.deepEqual(pinnedDebates(voted).map((debate) => debate.id), [ID(2)]);
    // What it does now: same plan, same slots, new content.
    const after = debateFeedSlots(posts, voted, planDebateFeed(voted, plan));
    assert.deepEqual(after.map(debateFeedSlotId), before.map(debateFeedSlotId));
    const slot = after[0] as Extract<DebateFeedSlot<{id: string; date: string}>, {kind: "debate"}>;
    assert.equal(slot.pinned, true);
    assert.equal(slot.debate.myVote, P(11));
    assert.equal(slot.debate.canVote, false);
});

test("a debate that arrives later joins the rest, never the head; one that left is gone", () => {
    const first = decodeDiscoverDebateFeed([feedRow(1, {pinned: true, boosted: true}), feedRow(2)])!;
    const plan = planDebateFeed(first);
    const later = decodeDiscoverDebateFeed([feedRow(3, {pinned: true, boosted: true}), feedRow(1, {pinned: true, boosted: true}), feedRow(2)])!;
    const next = planDebateFeed(later, plan);
    assert.deepEqual(next.pinned, [ID(1)]);
    assert.deepEqual(next.order, [ID(1), ID(2), ID(3)]);
    const gone = planDebateFeed(decodeDiscoverDebateFeed([feedRow(2)])!, next);
    assert.deepEqual(gone.pinned, []);
    assert.deepEqual(gone.order, [ID(2)]);
    // No debates yet: the first real read still decides the pins.
    const empty = planDebateFeed([]);
    assert.deepEqual(planDebateFeed(first, empty).pinned, [ID(1)]);
});

test("the debates keep the server's order among themselves, slotted among the posts by date", () => {
    // Server order: 4 (unseen, newest), 2 (unseen, older), then 3 (seen, newer than 2 but sunk).
    const debates = decodeDiscoverDebateFeed([
        feedRow(4, {created_at: "2026-11-16T12:00:00Z", novelty: 1}),
        feedRow(2, {created_at: "2026-11-16T06:00:00Z", novelty: 1}),
        feedRow(3, {created_at: "2026-11-16T09:00:00Z", novelty: 0.004})
    ])!;
    const posts = [
        post("capture-a", "2026-11-17T00:00:00Z"),
        post("capture-b", "2026-11-16T10:00:00Z"),
        post("capture-c", "2026-11-16T07:00:00Z"),
        post("capture-d", "2026-11-16T01:00:00Z")
    ];
    const slots = debateFeedSlots(posts, debates, planDebateFeed(debates));
    assert.deepEqual(slots.map(debateFeedSlotId), [
        "capture-a",
        `debate-${ID(4)}`,
        "capture-b",
        "capture-c",
        `debate-${ID(2)}`,
        `debate-${ID(3)}`, // its own date is newer than 2's, but it stays behind 2
        "capture-d"
    ]);
});

test("a debate with no date goes after the posts, and with no posts the debates are the feed", () => {
    const dateless = decodeDiscoverDebateFeed([feedRow(1, {created_at: null}), feedRow(2)])!;
    const slots = debateFeedSlots([post("capture-a", "2026-11-17T00:00:00Z")], dateless, planDebateFeed(dateless));
    assert.equal(slots.length, 3);
    assert.equal(slots[0].kind, "post");
    assert.equal(debateFeedSlots([], dateless, planDebateFeed(dateless)).length, 2);
});

test("a debate is seen as type 'debate' with the bare id", () => {
    assert.deepEqual(discoverSeenPostForItemId(`debate-${ID(1)}`), {type: "debate", id: ID(1)});
    assert.equal(discoverSeenPostForItemId("debate-nope"), null);
    assert.equal(isDiscoverSeenPost({type: "debate", id: ID(1)}), true);
    // A debate slot scrolled past is in the ids above the leading one.
    const slotIds = [`debate-${ID(1)}`, "capture-a", `debate-${ID(2)}`];
    assert.deepEqual(itemIdsScrolledPast(slotIds, `debate-${ID(2)}`), [`debate-${ID(1)}`, "capture-a"]);
});

test("the outbox sends a debate mark once, with the type the ledger accepts", async () => {
    const sent: Array<Array<{type: string; id: string}>> = [];
    const outbox = new DiscoverSeenOutbox("11111111-1111-4111-8111-111111111111", null, async (posts) => {
        sent.push(posts);
        return true;
    });
    assert.equal(outbox.enqueue([{type: "debate", id: ID(1)}, {type: "debate", id: ID(1)}]), 1);
    await outbox.flush();
    assert.deepEqual(sent, [[{type: "debate", id: ID(1)}]]);
    assert.equal(outbox.has({type: "debate", id: ID(1)}), true);
});
