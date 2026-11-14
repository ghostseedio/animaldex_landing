/**
 * A tier on trial (`src/ark-scene/runtime/trial.ts`): a device that hides what it is (iOS WebKit) starts on the medium
 * tier and falls back to the low one, remembered on the device, when it does not hold it.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {TierTrial, TIER_TRIAL_KEY, TRIAL_HOLD_DAYS, TRIAL_PROVEN_S, trialHoldMs, type TrialStore} from "@/ark-scene/runtime/trial";

const DAY = 86_400_000;
function memory(): TrialStore & {map: Map<string, string>} {
    const map = new Map<string, string>();
    return {map, getItem: (key) => map.get(key) ?? null, setItem: (key, value) => void map.set(key, value)};
}

test("tier trial: a first visit starts on the medium tier; put away properly, so does the next", () => {
    const store = memory();
    const first = new TierTrial(store, 0, true);
    assert.equal(first.tier, "medium");
    assert.equal(first.on, true);
    assert.equal(first.state, "trial");
    // (Hidden, then gone: the page's own goodbye.)
    first.seen(false, 20_000);
    const second = new TierTrial(store, 60_000, true);
    assert.equal(second.tier, "medium");
});

test("tier trial: a page that went away in its first seconds on screen starts on the low tier next time, for a week", () => {
    const store = memory();
    new TierTrial(store, 0, true);
    // (No goodbye: the system ended it, or it crashed.)
    const after = new TierTrial(store, 30_000, true);
    assert.equal(after.tier, "low");
    assert.equal(after.held, "lost");
    assert.equal(after.on, false);
    assert.equal(new TierTrial(store, 6 * DAY, true).tier, "low");
    // The hold over: one more try, and a second failure holds twice as long.
    const again = new TierTrial(store, 30_000 + TRIAL_HOLD_DAYS * DAY + 1, true);
    assert.equal(again.tier, "medium");
    const lostAgain = new TierTrial(store, 9 * DAY, true);
    assert.equal(lostAgain.tier, "low");
    assert.equal(new TierTrial(store, 9 * DAY + 13 * DAY, true).tier, "low");
    assert.equal(new TierTrial(store, 9 * DAY + 14 * DAY + 1, true).tier, "medium");
    assert.equal(trialHoldMs(1), 7 * DAY);
    assert.equal(trialHoldMs(2), 14 * DAY);
    assert.equal(trialHoldMs(9), 56 * DAY);
});

test("tier trial: past its first seconds on screen the memory has held: going away then leaves no mark", () => {
    const store = memory();
    const trial = new TierTrial(store, 0, true);
    const left = trial.seen(true, 0);
    assert.equal(left, TRIAL_PROVEN_S * 1000);
    // (Hidden for an hour in between: only the time on screen counts.)
    trial.seen(false, 40_000);
    assert.equal(trial.tick(3_600_000), false);
    assert.equal(trial.seen(true, 3_600_000), (TRIAL_PROVEN_S - 40) * 1000);
    assert.equal(trial.tick(3_600_000 + (TRIAL_PROVEN_S - 40) * 1000), true);
    assert.equal(trial.state, "held");
    // The app swiped away an hour later, no goodbye: the next visit is on the medium tier.
    assert.equal(new TierTrial(store, 8_000_000, true).tier, "medium");
});

test("tier trial: a device that held the tier before is given one more go; two losses in a row count", () => {
    const store = memory();
    const proven = new TierTrial(store, 0, true);
    proven.tick(TRIAL_PROVEN_S * 1000);
    // Swiped away mid-load once: still the medium tier.
    new TierTrial(store, DAY, true);
    const once = new TierTrial(store, DAY + 20_000, true);
    assert.equal(once.tier, "medium");
    // And again at once: the low tier.
    assert.equal(new TierTrial(store, DAY + 40_000, true).tier, "low");
    // A proper goodbye in between breaks the run.
    const store2 = memory();
    new TierTrial(store2, 0, true).tick(TRIAL_PROVEN_S * 1000);
    new TierTrial(store2, DAY, true);
    const closed = new TierTrial(store2, DAY + 20_000, true);
    closed.seen(false, DAY + 30_000);
    new TierTrial(store2, 2 * DAY, true);
    assert.equal(new TierTrial(store2, 2 * DAY + 20_000, true).tier, "medium");
});

test("tier trial: the pacing's drop is remembered; a page not on screen is not on the clock; no storage, no memory", () => {
    const store = memory();
    const trial = new TierTrial(store, 0, true);
    trial.failed("pace", 50_000);
    assert.equal(trial.on, false);
    assert.equal(trial.state, "pace");
    const next = new TierTrial(store, 60_000, true);
    assert.equal(next.tier, "low");
    assert.equal(next.held, "pace");
    // Started unseen (a panel made before it is shown): nothing open, so nothing lost if it goes.
    const store2 = memory();
    new TierTrial(store2, 0, false);
    assert.equal(JSON.parse(store2.map.get(TIER_TRIAL_KEY) ?? "{}").state, "closed");
    assert.equal(new TierTrial(store2, 1000, true).tier, "medium");
    // No storage (or one that throws): every visit is a first.
    assert.equal(new TierTrial(null, 0, true).tier, "medium");
    const broken: TrialStore = {getItem: () => { throw new Error("denied"); }, setItem: () => { throw new Error("denied"); }};
    assert.equal(new TierTrial(broken, 0, true).tier, "medium");
    // A memo that is not ours is no memo.
    const junk = memory();
    junk.map.set(TIER_TRIAL_KEY, "{\"state\":\"nonsense\"}");
    assert.equal(new TierTrial(junk, 0, true).tier, "medium");
});
