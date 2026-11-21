import nodeAssert from "node:assert/strict";
import test from "node:test";
import {
    arkHistoryForPrompt,
    arkHowAmI,
    arkSelfMode,
    arkSelfPromptLines,
    type ArkSelfTurn,
    diedRecently,
    loadArkSelfEnabled,
    loadArkSelfFacts,
    ownMealEventIds,
    parseArkSelfFacts,
    resetArkSelfFlagCache,
} from "@/lib/ask-animaldex/ark-chat-self";
import { type ArkMeal, arkMealPromptLines } from "@/lib/ask-animaldex/ark-chat-mention";
import { type ArkKinFacts, arkKinPromptLines } from "@/lib/ask-animaldex/ark-kin-activity";

const assert = (value: unknown, message?: string) => nodeAssert.ok(value, message);
const assertEquals = (actual: unknown, expected: unknown, message?: string) => nodeAssert.deepStrictEqual(actual, expected, message);

// Shapes as voyage_chat_self_facts_v1 returned them for three real animals in
// a rolled-back read on production (2026-11-20), ids replaced.
const NOW = new Date("2026-11-20T12:00:00Z"); // midday on the island (offset 0)

const glider = () => ({
    enabled: true,
    aboard: true,
    animal_id: "aaaaaaaa-0000-4000-8000-000000000001",
    species: "Wandering Glider",
    kind_species_profile_id: "bbbbbbbb-0000-4000-8000-000000000001",
    status: "alive",
    aboard_since: "2026-11-11T09:00:00Z",
    from_photo: "2026-11-07",
    hearts: 2,
    revives: 1,
    ark_day: 304.007,
    age: { ark_days: 81, stage: "old" },
    activity: "diurnal",
    place: { island: "wild", zone: "river_lake", region: "fresh_water", kept: false },
    state: {
        hunger: "not_tracked",
        health: "well",
        young_recent: 2,
        eggs_waiting: 0,
        safety: "safe_for_now",
        hunters_here: [["Great Egret", 7], ["American Bullfrog", 4], ["Asian Common Toad", 4]],
        hunter_kinds_here: 64,
        caught_here_lately: 0,
        hunting_has_started: false,
        thrive: "ordinary",
    },
    family: { young: 8, living_young: 3 },
    kind: { aboard: 8, near_me: 7 },
    history: {
        entries: [
            { event_id: "18843", at: "2026-11-20T01:53:00Z", what: "egg_hatched" },
            { event_id: "18842", at: "2026-11-20T01:53:00Z", what: "egg_hatched" },
            { event_id: "18639", at: "2026-11-19T16:07:00Z", what: "paired", with: "Wandering Glider", same_kind: true, count: 2, eggs: true },
            { event_id: "18371", at: "2026-11-19T05:37:00Z", what: "egg_hatched" },
            { event_id: "11496", at: "2026-11-17T11:39:00Z", what: "came_back_young", hearts_left: 2 },
            { event_id: "9000", at: "2026-11-16T10:57:00Z", what: "grew_old" },
        ],
        more: 7,
        not_recorded: ["moves", "fights"],
    },
    last_talk_at: "2026-11-08T21:59:56Z",
});

const fly = () => ({
    enabled: true,
    aboard: true,
    animal_id: "aaaaaaaa-0000-4000-8000-000000000003",
    species: "House Fly",
    kind_species_profile_id: "bbbbbbbb-0000-4000-8000-000000000003",
    status: "gone",
    aboard_since: "2026-11-11T20:43:55Z",
    from_photo: "2026-10-18",
    hearts: 0,
    revives: 2,
    age: { ark_days: 24.4, stage: "old" },
    activity: "diurnal",
    place: { island: "town", zone: "farm_garden", region: "home", kept: false },
    family: { young: 0, living_young: 0 },
    kind: { aboard: 12, near_me: 12 },
    history: {
        entries: [
            { event_id: "18722", at: "2026-11-19T19:36:00Z", what: "grew_old" },
            { event_id: "18211", at: "2026-11-18T21:24:00Z", what: "came_back_young", hearts_left: 0 },
            { event_id: "7147", at: "2026-11-11T20:43:55Z", what: "came_aboard", from: "capture" },
        ],
        more: 0,
        not_recorded: ["moves", "fights"],
    },
    died: { at: "2026-11-19T19:36:00Z", kind: "died_old", lives: 3, real_days_aboard: 7.9, ark_days_aboard: 206 },
});

const owner: ArkSelfTurn = { audience: "owner", call: false, captureThread: true };

test("flag off: nothing, so every prompt is unchanged", () => {
    const off = parseArkSelfFacts({ enabled: false });
    assert(off && !off.enabled);
    assertEquals(arkSelfMode(off, owner), null);
    assertEquals(arkSelfPromptLines(off, { mode: arkSelfMode(off, owner), greeting: false, asked: true, now: NOW }), []);
    assertEquals(arkSelfPromptLines(null, { mode: "self", greeting: false, asked: true, now: NOW }), []);
    assertEquals(parseArkSelfFacts(null), null);
    assertEquals(parseArkSelfFacts([]), null);
    // A card that brought nothing aboard.
    const none = parseArkSelfFacts({ enabled: true, aboard: false });
    assertEquals(arkSelfMode(none, owner), null);
});

test("only the owner's own card thread speaks as the Ark animal (decision 438 point 1)", () => {
    const facts = parseArkSelfFacts(glider());
    assertEquals(arkSelfMode(facts, owner), "self");
    assertEquals(arkSelfMode(facts, { ...owner, captureThread: false }), null); // a species thread keeps A2
    assertEquals(arkSelfMode(facts, { ...owner, audience: "visitor" }), null);
    assertEquals(arkSelfMode(facts, { ...owner, audience: "public" }), null);
    assertEquals(arkSelfMode(facts, { ...owner, call: true }), null);
    assertEquals(arkSelfMode(parseArkSelfFacts(fly()), owner), "kin_after_death"); // point 2
});

test("how_am_i: the mood is a label over the record's facts, by priority", () => {
    const facts = parseArkSelfFacts(glider())!;
    const how = arkHowAmI(facts, NOW)!;
    assertEquals(how.mood, "busy");
    assert(how.because.includes("young_of_mine_born_lately:2"));
    assertEquals(how.needs.rest, "awake");
    assertEquals(how.needs.family, "raising_young");
    assertEquals(how.needs.safety, "safe_for_now");
    assertEquals(how.needs.age, "old");
    // Not modelled, so not offered.
    assert(!("mating" in how.needs) && !("thirst" in how.needs));

    const at = (over: Record<string, unknown>, top: Record<string, unknown> = {}) =>
        arkHowAmI(parseArkSelfFacts({ ...glider(), ...top, state: { ...glider().state, ...over } })!, NOW)!.mood;
    assertEquals(at({ health: "recovering" }, { status: "recovering" }), "resting");
    assertEquals(at({ season: "dormant", hunger: "hungry" }), "sleeping_the_season");
    assertEquals(at({ hunger: "hungry", safety: "wary" }), "hungry");
    assertEquals(at({ safety: "wary" }), "watchful");
    assertEquals(at({ young_recent: 0 }, { activity: "nocturnal" }), "sleepy");
    assertEquals(at({ young_recent: 0, thrive: "prime" }), "content");
    assertEquals(at({ young_recent: 0 }), "settled");
    assertEquals(arkHowAmI(parseArkSelfFacts(fly())!, NOW), null);
});

test("a hello carries the identity only, never a volunteered Ark fact", () => {
    const facts = parseArkSelfFacts(glider());
    const [line, ...rest] = arkSelfPromptLines(facts, { mode: "self", greeting: true, asked: false, now: NOW });
    assertEquals(rest, []);
    assert(line.startsWith("ark_self — you are the very Wandering Glider that this card brought aboard"));
    assert(line.includes("In this hello say nothing of your Ark life"));
    assert(line.includes("never in a hello"));
    assert(!line.includes("how_am_i"));
    assert(!line.includes("grew_old\""));
});

test("an owner turn carries how_am_i + where_am_i; an asked one adds my_history", () => {
    const facts = parseArkSelfFacts(glider());
    const plain = arkSelfPromptLines(facts, { mode: "self", greeting: false, asked: false, now: NOW });
    assertEquals(plain.length, 1);
    assert(plain[0].includes('"mood":"busy"'));
    assert(plain[0].includes('"place":"the rivers and lakes"'));
    assert(plain[0].includes('"hunting_has_started":false'));
    assert(plain[0].includes("otherwise it is background"));
    assert(plain[0].includes("never that you are lonely, miss them or need them"));
    assert(plain[0].includes("Your hearts (lives) only if they ask"));

    const asked = arkSelfPromptLines(facts, { mode: "self", greeting: false, asked: true, now: NOW });
    assertEquals(asked.length, 2);
    assert(asked[1].startsWith("ark_my_history — "));
    assert(asked[1].includes('"not_recorded":["moves","fights"]'));
    assert(asked[1].includes('"more_not_shown":7'));
    assert(asked[1].includes("The deaths in it were yours and you came back each time"));

    const quiet = arkSelfPromptLines(facts, { mode: "self", greeting: false, asked: true, quiet: true, now: NOW });
    assertEquals(quiet.length, 1);
    assert(!quiet[0].includes("{"));
});

test("my_history groups a clutch's hatchings and names mates by species only", () => {
    const history = arkHistoryForPrompt(parseArkSelfFacts(glider())!, NOW);
    assertEquals(history[0], { when: "about 10 hours ago", what: "egg_hatched", how_many: 2 });
    assertEquals(history[1], { when: "about 20 hours ago", what: "paired", with: "another Wandering Glider", eggs: 2 });
    assertEquals(history[3], { when: "about 3 days ago", what: "came_back_young", hearts_left: 2 });
    const aboard = arkHistoryForPrompt(parseArkSelfFacts(fly())!, NOW).at(-1);
    assertEquals(aboard?.from_their_photo_of, "2026-10-18");
});

test("after a final death the kind speaks as kin, never as the dead animal (point 2)", () => {
    const facts = parseArkSelfFacts(fly());
    for (const greeting of [true, false]) {
        const [line, ...rest] = arkSelfPromptLines(facts, { mode: "kin_after_death", greeting, asked: true, now: NOW });
        assertEquals(rest, []);
        assert(line.startsWith("ark_card_life_ended — the House Fly this card brought aboard"));
        assert(line.includes('"how":"grew_old"'));
        assert(line.includes('"lives_on_the_ark":3'));
        assert(line.includes('"real_days_aboard":8'));
        assert(line.includes('"of_your_kind_still_on_the_ark":12'));
        assert(line.includes("You are not that animal: you are its kind, speaking as kin"));
        assert(line.includes("Never bring its death up yourself, in a hello or in passing"));
        assert(line.includes("It was never their fault"));
        assert(line.includes("no heart, no purchase"));
        assert(!line.includes("hearts"));
    }
    assert(diedRecently(facts, NOW));
    assert(!diedRecently(facts, new Date("2026-11-24T12:00:00Z")));
    assert(!diedRecently(parseArkSelfFacts(glider()), NOW));
});

test("nothing about a person is carried", () => {
    const raw = { ...glider(), owner_user_id: "u1", bringer_ids: ["u2"], brought_by: "lendawg" };
    const lines = arkSelfPromptLines(parseArkSelfFacts(raw), { mode: "self", greeting: false, asked: true, now: NOW }).join("\n");
    for (const word of ["u1", "u2", "lendawg", "bringer", "owner_user"]) assert(!lines.includes(word), word);
});

test("its own meal is told in the first person; a kin's meal stays kin's; elsewhere A2 is unchanged", () => {
    const meal: ArkMeal = {
        eventId: "41",
        at: new Date(NOW.getTime() - 5 * 3_600_000).toISOString(),
        phrase: "feeds on wild pigs",
        predatorSpeciesId: "t",
        preySpeciesId: "p",
        preyName: "Wild Boar",
    };
    const facts = parseArkSelfFacts({
        ...glider(),
        history: { entries: [{ event_id: "41", at: meal.at, what: "caught", prey: "Wild Boar" }], more: 0 },
    });
    assert(ownMealEventIds(facts).has("41"));
    const [own] = arkMealPromptLines(meal, NOW, { own: true, self: true });
    assert(own.includes("you yourself ate recently"));
    assert(own.includes("in the first person"));
    assert(!own.includes("never to you"));
    const [kin] = arkMealPromptLines(meal, NOW, { self: true });
    assert(kin.includes("another of your kind that they brought aboard ate recently"));
    assert(kin.includes("happens to them, not to you"));
    assert(!kin.includes("never speak as if you had died"));
    // Species threads: byte-identical to before decision 438.
    assertEquals(arkMealPromptLines(meal, NOW, {}), arkMealPromptLines(meal, NOW));
    assert(arkMealPromptLines(meal, NOW)[0].includes("happens to them and never to you"));
});

test("kin lines in its own card's thread: it is not counted among its kin, and their news is not told", () => {
    const kinFacts: ArkKinFacts = {
        enabled: true,
        speciesProfileId: "k",
        kindName: "Wandering Glider",
        claimedToday: false,
        crisisRecent: false,
        recentLoss: false,
        lastKinMentionedAt: null,
        activity: "diurnal",
        activityPhrase: null,
        socialityPhrase: null,
        yours: { living: 4, born: 3, zones: ["river_lake"] },
        aboard: 8,
        news: [{ kind: "hatch", count: 2, at: "2026-11-20T01:53:00Z", zone: "river_lake" }],
        hunters: [],
    };
    const [self] = arkKinPromptLines(kinFacts, "asked", NOW, { self: true, selfAboard: true });
    assert(self.includes('"your_kin_aboard":3'));
    assert(!self.includes('"news":['));
    assert(self.includes("your own Ark life is what ark_self says"));
    assert(!self.includes("happens to them and never to you"));
    const [plain] = arkKinPromptLines(kinFacts, "asked", NOW);
    assert(plain.includes('"your_kin_aboard":4'));
    assert(plain.includes("happens to them and never to you"));
    assertEquals(arkKinPromptLines(kinFacts, "asked", NOW, {}), arkKinPromptLines(kinFacts, "asked", NOW));
});

test("reads fail closed", async () => {
    const failing = { rpc: () => Promise.resolve({ data: null, error: { message: "missing" } }) };
    assertEquals(await loadArkSelfFacts(failing, { userId: "u", captureId: "c" }), null);
    const throwing = { rpc: () => Promise.reject(new Error("timeout")) };
    assertEquals(await loadArkSelfFacts(throwing, { userId: "u", captureId: "c" }), null);
    resetArkSelfFlagCache();
    assertEquals(await loadArkSelfEnabled(throwing, 0), false);
    resetArkSelfFlagCache();
    const calls: string[] = [];
    const on = { rpc: (fn: string) => (calls.push(fn), Promise.resolve({ data: true, error: null })) };
    assertEquals(await loadArkSelfEnabled(on, 1), true);
    assertEquals(await loadArkSelfEnabled(on, 2), true);
    assertEquals(calls, ["voyage_chat_mention_enabled"]);
    resetArkSelfFlagCache();
    const asked: Array<Record<string, unknown>> = [];
    const ok = { rpc: (_fn: string, args: Record<string, unknown>) => (asked.push(args), Promise.resolve({ data: glider(), error: null })) };
    const facts = await loadArkSelfFacts(ok, { userId: "u", captureId: "c" });
    assertEquals(facts?.status, "alive");
    assertEquals(asked, [{ p_user_id: "u", p_capture_id: "c" }]);
});
