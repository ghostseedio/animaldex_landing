import assert from "node:assert/strict";
import test from "node:test";
import {arkChatAsksArk, arkChatPromptLines, startArkChatReads, type ArkChatAdmin, type ArkChatRead, type ArkChatTurn} from "./ask-animaldex/ark-chat";
import {resetArkKinFlagCache} from "./ask-animaldex/ark-kin-activity";
import {resetArkSelfFlagCache} from "./ask-animaldex/ark-chat-self";
import {buildAskKindVerdictPrompt, parseAskTurnRead} from "./ask-animaldex/kind-verdict";

// The web chat's wiring of the apps' chat-is-Ark modules (`ark-chat.ts`): the
// same RPCs, the same order (step, self, meal, kin) and the same claims as
// generate-applied-insight. Shapes are the documented RPC answers.

const NOW = new Date("2026-11-20T12:00:00Z");
const USER = "11111111-1111-4111-8111-111111111111";
const KIND = "bbbbbbbb-0000-4000-8000-000000000001";
const CAPTURE = "cccccccc-0000-4000-8000-000000000001";

const selfAlive = {
    enabled: true,
    aboard: true,
    animal_id: "aaaaaaaa-0000-4000-8000-000000000001",
    species: "Komodo Dragon",
    kind_species_profile_id: KIND,
    status: "alive",
    aboard_since: "2026-11-11T09:00:00Z",
    from_photo: "2026-11-07",
    hearts: 3,
    revives: 0,
    age: {ark_days: 81, stage: "adult"},
    activity: "diurnal",
    place: {island: "wild", zone: "grassland", region: "land", kept: false},
    state: {hunger: "fed", health: "well", young_recent: 0, eggs_waiting: 0, safety: "calm", hunters_here: [], hunter_kinds_here: 0, caught_here_lately: 0, hunting_has_started: false, thrive: "good"},
    family: {young: 2, living_young: 2},
    kind: {aboard: 4, near_me: 3},
    history: {
        entries: [
            {event_id: "501", at: "2026-11-20T08:00:00Z", what: "caught", prey: "Wild Boar"},
            {event_id: "400", at: "2026-11-18T08:00:00Z", what: "paired", with: "Komodo Dragon", same_kind: true, count: 2, eggs: true},
            {event_id: "300", at: "2026-11-11T09:00:00Z", what: "came_aboard"}
        ],
        more: 0,
        not_recorded: ["moves", "fights"]
    }
};

const selfGone = (diedAt: string) => ({
    ...selfAlive,
    status: "gone",
    hearts: 0,
    state: null,
    died: {at: diedAt, kind: "died_old", lives: 3, real_days_aboard: 7.9}
});

const mealFacts = {
    enabled: true,
    species_profile_id: KIND,
    claimed_today: false,
    crisis_recent: false,
    last_mentioned_at: null,
    meals: [{event_id: "501", at: "2026-11-20T08:00:00Z", phrase: "eats carrion and large prey", predator_species_id: KIND, prey_species_id: "dddddddd-0000-4000-8000-000000000001", prey_name: "Wild Boar"}]
};

const kinFacts = {
    enabled: true,
    species_profile_id: KIND,
    kind_name: "Komodo Dragon",
    claimed_today: false,
    crisis_recent: false,
    recent_loss: false,
    last_kin_mentioned_at: null,
    activity: "diurnal",
    yours: {living: 2, born: 1, zones: ["grassland"]},
    aboard: 4,
    news: [{kind: "birth", count: 2, at: "2026-11-20T06:00:00Z", zone: "grassland"}],
    hunters: []
};

type Answers = Record<string, unknown>;

function fakeAdmin(answers: Answers) {
    const calls: Array<{fn: string; args: Record<string, unknown>}> = [];
    const admin: ArkChatAdmin = {
        rpc: (fn, args) => {
            calls.push({fn, args});
            if (fn in answers) return Promise.resolve({data: answers[fn], error: null});
            return Promise.resolve({data: null, error: {message: `Could not find the function public.${fn}`}});
        }
    };
    return {admin, calls};
}

const ON: Answers = {
    voyage_chat_mention_enabled: true,
    voyage_ark_kin_enabled: true,
    voyage_chat_self_facts_v1: selfAlive,
    voyage_chat_mention_facts_v1: mealFacts,
    voyage_ark_kin_facts_v1: kinFacts,
    voyage_claim_chat_mention_v1: true,
    voyage_claim_ark_kin_mention_v1: true,
    voyage_step_thrive_facts_v1: {enabled: true, living_brought: 2, band_now: "good", band_if_worked: "prime"}
};

const turn = (over: Partial<ArkChatTurn> = {}): ArkChatTurn => ({userId: USER, speciesProfileId: KIND, captureId: CAPTURE, greeting: true, call: false, ...over});

async function linesFor(answers: Answers, over: Partial<ArkChatTurn> = {}, extra: {speaks?: boolean; focusSensitive?: boolean; read?: ArkChatRead} = {}) {
    resetArkKinFlagCache();
    resetArkSelfFlagCache();
    const {admin, calls} = fakeAdmin(answers);
    const t = turn(over);
    const read = extra.read ?? null;
    const reads = startArkChatReads(admin, t, Promise.resolve(read));
    const result = await arkChatPromptLines(admin, reads, {...t, speaks: extra.speaks ?? true, focusSensitive: extra.focusSensitive ?? false, read, now: NOW});
    return {...result, calls};
}

const heads = (lines: string[]) => lines.map((line) => line.split(" — ")[0]);

test("switches off: no Ark line, nothing claimed, and the turn read asks no Ark question", async () => {
    const off = {voyage_chat_mention_enabled: false, voyage_ark_kin_enabled: false};
    for (const over of [{}, {greeting: false}]) {
        const result = await linesFor(off, over, {read: {safety: false}});
        assert.deepEqual(result.lines, []);
        assert.equal(result.afterReply, null);
        assert.equal(result.calls.some((call) => call.fn.startsWith("voyage_claim")), false);
    }
    resetArkKinFlagCache();
    resetArkSelfFlagCache();
    assert.equal(await arkChatAsksArk(fakeAdmin(off).admin, {captureThread: true}), false);
    assert.equal(await arkChatAsksArk(fakeAdmin({}).admin, {captureThread: true}), false, "a missing function is off");
    resetArkKinFlagCache();
    resetArkSelfFlagCache();
    assert.equal(await arkChatAsksArk(fakeAdmin({voyage_chat_mention_enabled: true}).admin, {captureThread: true}), true);
});

test("a hello in the card's own thread: who it is, then its own meal, claimed as the day's one Ark news", async () => {
    const result = await linesFor(ON);
    assert.deepEqual(heads(result.lines), ["ark_self", "ark_meal"]);
    assert.match(result.lines[1], /you yourself ate recently/, "its own meal, in the first person");
    assert.equal(result.calls.filter((call) => call.fn === "voyage_claim_chat_mention_v1").length, 1);
    // The kin share the day: a hello that carried the meal does not also claim theirs.
    assert.equal(result.calls.some((call) => call.fn === "voyage_claim_ark_kin_mention_v1"), false);
    assert.deepEqual(result.noted, {self: "self", meal: true, kin: null, step: false});
});

test("a canned hello (the model does not speak) claims nothing", async () => {
    const result = await linesFor(ON, {}, {speaks: false});
    assert.deepEqual(heads(result.lines), ["ark_self"]);
    assert.equal(result.calls.some((call) => call.fn.startsWith("voyage_claim")), false);
});

test("no meal: the hello's one Ark news is its kin's, claimed", async () => {
    const result = await linesFor({...ON, voyage_chat_mention_facts_v1: {...mealFacts, meals: []}});
    assert.deepEqual(heads(result.lines), ["ark_self", "ark_kin"]);
    assert.equal(result.calls.filter((call) => call.fn === "voyage_claim_ark_kin_mention_v1").length, 1);
});

test("an owner's turn: the step's line and how it is there; asked about the Ark, its history and its kin, claimed after the reply", async () => {
    const plain = await linesFor(ON, {greeting: false}, {read: {safety: false}});
    assert.deepEqual(heads(plain.lines), ["ark_step", "ark_self"]);
    assert.match(plain.lines[1], /"where_am_i":\{"island":"the wild island","place":"the grassland"/);
    assert.equal(plain.afterReply, null);
    const asked = await linesFor(ON, {greeting: false}, {read: {ark: true, safety: false}});
    assert.deepEqual(heads(asked.lines), ["ark_step", "ark_self", "ark_my_history", "ark_kin"]);
    assert.equal(asked.calls.some((call) => call.fn === "voyage_claim_ark_kin_mention_v1"), false, "not before the reply");
    assert.ok(asked.afterReply);
    await asked.afterReply!();
    assert.equal(asked.calls.filter((call) => call.fn === "voyage_claim_ark_kin_mention_v1").length, 1);
    // A read that says someone is hurting them: the identity alone, no Ark facts.
    const safety = await linesFor(ON, {greeting: false}, {read: {ark: true, safety: true}});
    assert.deepEqual(heads(safety.lines), ["ark_step", "ark_self"]);
    assert.match(safety.lines[1], /say nothing of your Ark life in this reply/);
});

test("after its final death the kind speaks as kin, and for 3 days the hello carries no other Ark news", async () => {
    const recent = await linesFor({...ON, voyage_chat_self_facts_v1: selfGone("2026-11-19T19:36:00Z")});
    assert.deepEqual(heads(recent.lines), ["ark_card_life_ended"]);
    assert.equal(recent.calls.some((call) => call.fn.startsWith("voyage_claim")), false);
    const older = await linesFor({...ON, voyage_chat_self_facts_v1: selfGone("2026-11-10T19:36:00Z")});
    assert.deepEqual(heads(older.lines), ["ark_card_life_ended", "ark_meal"]);
    assert.match(older.lines[1], /one of your kind that they brought aboard ate recently/, "as kin (A2), never its own");
});

test("a call reads nothing", async () => {
    const result = await linesFor(ON, {call: true});
    assert.deepEqual(result.lines, []);
    assert.deepEqual(result.calls, []);
});

test("the web's turn read asks its Ark question only when told to, and keeps a true answer", () => {
    const input = {animalName: "Komodo Dragon", message: "What is my dragon doing on the Ark?"};
    const off = buildAskKindVerdictPrompt(input);
    assert.equal(off.includes("ark: are they asking about the Ark"), false);
    assert.ok(off.includes('Chat: {"kind": "chat", "safety": true or false, "app": true or false}'));
    const on = buildAskKindVerdictPrompt({...input, askArk: true});
    assert.ok(on.includes("ark: are they asking about the Ark"));
    assert.ok(on.includes('Chat: {"kind": "chat", "safety": true or false, "app": true or false, "ark": true or false}'));
    assert.equal(parseAskTurnRead({kind: "chat", safety: false, app: false, ark: true}).ark, true);
    assert.equal("ark" in parseAskTurnRead({kind: "chat", safety: false, app: false, ark: false}), false);
});
