import nodeAssert from "node:assert/strict";
import test from "node:test";
import {
    ARK_KIN_NEWS_MAX_AGE_MS,
    ARK_KIN_QUIET_GAP_MS,
    arkIslandHours,
    type ArkKinAdmin,
    arkKindAwake,
    type ArkKinFacts,
    arkKinFactsForPrompt,
    arkKinPromptLines,
    type ArkKinTurn,
    arkSunElevation,
    arkTimeOfDay,
    arkZoneName,
    chooseArkKinMention,
    claimArkKinMention,
    freshArkKinNews,
    loadArkKinEnabled,
    loadArkKinFacts,
    parseArkKinFacts,
    resetArkKinFlagCache,
} from "@/lib/ask-animaldex/ark-kin-activity";
import { buildAskKindVerdictPrompt as buildKindVerdictPrompt, parseAskTurnRead as parseTurnRead } from "@/lib/ask-animaldex/kind-verdict";
import { isAwake, sunElevation } from "@/lib/ark-daylight";
import { islandHours } from "@/lib/ark-clock";

const assert = (value: unknown, message?: string) => nodeAssert.ok(value, message);
const assertEquals = (actual: unknown, expected: unknown, message?: string) => nodeAssert.deepStrictEqual(actual, expected, message);

// 07:30 UTC: morning on the island clock (UTC + 0).
const NOW = new Date("2026-11-12T07:30:00Z");
const OTTER = "11111111-1111-4111-8111-111111111111";
const HOURS = 3_600_000;
const ago = (hours: number) => new Date(NOW.getTime() - hours * HOURS).toISOString();

const facts = (over: Partial<ArkKinFacts> = {}): ArkKinFacts => ({
    enabled: true,
    speciesProfileId: OTTER,
    kindName: "Eurasian Otter",
    claimedToday: false,
    crisisRecent: false,
    recentLoss: false,
    lastKinMentionedAt: null,
    activity: "crepuscular",
    activityPhrase: "most active at dawn and dusk",
    socialityPhrase: "mostly solitary outside the breeding season",
    yours: { living: 2, born: 1, zones: ["river_lake"] },
    aboard: 3,
    news: [{ kind: "arrival", count: 1, at: ago(5), zone: "river_lake" }],
    hunters: [],
    ...over,
});

const turn = (over: Partial<ArkKinTurn> = {}): ArkKinTurn => ({
    greeting: true,
    asked: false,
    audience: "owner",
    call: false,
    focusSensitive: false,
    mealClaimed: false,
    now: NOW,
    ...over,
});

const linesFor = (f: ArkKinFacts | null, t: ArkKinTurn) => arkKinPromptLines(f, chooseArkKinMention(f, t), t.now);

// (a) Flag off: every prompt byte-identical ---------------------------------------------------

test("(a) flag off: the hello and the reply prompts are byte-identical", () => {
    const off = parseArkKinFacts({ enabled: false });
    assertEquals(off?.enabled, false);
    for (const t of [turn(), turn({ greeting: false, asked: true })]) {
        assertEquals(chooseArkKinMention(off, t), null);
        assertEquals(linesFor(off, t), []);
        assertEquals(linesFor(null, t), []);
    }
});

const verdictInput = {
    animalName: "Eurasian Otter",
    scientificName: "Lutra lutra",
    powerName: "Play to Learn",
    coreLesson: "Practise in play before it matters.",
    message: "What's happening on the Ark today?",
};

test("(a) flag off: the turn read asks no Ark question and its prompt is unchanged", () => {
    const before = buildKindVerdictPrompt(verdictInput);
    assertEquals(buildKindVerdictPrompt({ ...verdictInput, askArk: false }), before);
    assert(!/\bark\b/i.test(before.replace(/Ark today/g, "")), "no Ark question with the flag off");
    assert(before.includes('Chat: {"kind": "chat", "safety": true or false, "app": true or false}'));
    // And a read without the key never says ark.
    assertEquals("ark" in parseTurnRead({ kind: "chat", safety: false, app: false }), false);
});

test("flag on: the turn read asks it, and an answer of true is kept", () => {
    const on = buildKindVerdictPrompt({ ...verdictInput, askArk: true });
    assert(on.includes("ark: are they asking about the Ark"));
    assert(on.includes('Chat: {"kind": "chat", "safety": true or false, "app": true or false, "ark": true or false}'));
    assertEquals(parseTurnRead({ kind: "chat", safety: false, app: false, ark: true }).ark, true);
    assertEquals("ark" in parseTurnRead({ kind: "chat", safety: false, app: false, ark: false }), false);
    assertEquals("ark" in parseTurnRead({ kind: "chat", safety: false, app: false, ark: "yes" }), false);
});

// (b) Flag on + a hello + the day's reference unspent: the block is there -----------------------

test("(b) flag on, a hello, the day unspent: the kin facts block is in the hello", () => {
    assertEquals(chooseArkKinMention(facts(), turn()), "greeting");
    const lines = linesFor(facts(), turn());
    assertEquals(lines.length, 1);
    assert(lines[0].startsWith("ark_kin — "));
    assert(lines[0].includes('"what":"arrived"'));
    assert(lines[0].includes('"where":"the rivers and lakes"'));
    assert(lines[0].includes("once, in your own words"));
});

// (c) A sensitive chat: never ----------------------------------------------------------------

test("(c) a hard focus, a recent crisis, or one that cannot be told: absent, hello or question", () => {
    for (const t of [turn(), turn({ greeting: false, asked: true })]) {
        assertEquals(linesFor(facts(), { ...t, focusSensitive: true }), []);
        assertEquals(linesFor(facts({ crisisRecent: true }), t), []);
        assertEquals(linesFor(facts({ crisisRecent: null }), t), []);
    }
});

// (d) The day's one reference already spent: absent --------------------------------------------

test("(d) the day already spent, by a meal or another chat: no kin in the hello", () => {
    assertEquals(linesFor(facts({ claimedToday: true }), turn()), []);
    assertEquals(linesFor(facts(), turn({ mealClaimed: true })), []);
});

test("a question about the Ark is answered from the facts even when the day is spent", () => {
    // The day's budget is for unprompted references (the proposal's decision 1).
    assertEquals(chooseArkKinMention(facts({ claimedToday: true }), turn({ greeting: false, asked: true })), "asked");
    assertEquals(chooseArkKinMention(facts(), turn({ greeting: false, asked: false })), null);
});

// The other rules ----------------------------------------------------------------------------

test("never on a call or in a visitor's or public chat", () => {
    for (const t of [turn(), turn({ greeting: false, asked: true })]) {
        assertEquals(chooseArkKinMention(facts(), { ...t, call: true }), null);
        assertEquals(chooseArkKinMention(facts(), { ...t, audience: "visitor" }), null);
        assertEquals(chooseArkKinMention(facts(), { ...t, audience: "public" }), null);
    }
});

test("a hello is quiet the day one of theirs died on the Ark, or when that cannot be told", () => {
    assertEquals(chooseArkKinMention(facts({ recentLoss: true }), turn()), null);
    assertEquals(chooseArkKinMention(facts({ recentLoss: null }), turn()), null);
    // A question is still answered; the facts never hold the death.
    assertEquals(chooseArkKinMention(facts({ recentLoss: true }), turn({ greeting: false, asked: true })), "asked");
});

test("a hello needs kin of theirs aboard, and fresh news or a quiet week", () => {
    assertEquals(chooseArkKinMention(facts({ yours: { living: 0, born: 0, zones: [] } }), turn()), null);
    const quiet = facts({ news: [] });
    assertEquals(chooseArkKinMention(quiet, turn()), "greeting");
    assertEquals(chooseArkKinMention({ ...quiet, lastKinMentionedAt: ago(48) }, turn()), null);
    assertEquals(
        chooseArkKinMention({ ...quiet, lastKinMentionedAt: new Date(NOW.getTime() - ARK_KIN_QUIET_GAP_MS).toISOString() }, turn()),
        "greeting",
    );
    // Fresh news since the last reference speaks sooner than a week.
    assertEquals(chooseArkKinMention(facts({ lastKinMentionedAt: ago(48) }), turn()), "greeting");
});

test("news: inside 3 days, not ahead of the clock, after the last reference; newest first", () => {
    const edge = new Date(NOW.getTime() - ARK_KIN_NEWS_MAX_AGE_MS).toISOString();
    const f = facts({
        news: [
            { kind: "laid", count: 3, at: edge, zone: "river_lake" },
            { kind: "birth", count: 2, at: ago(20), zone: "river_lake" },
            { kind: "arrival", count: 1, at: ago(80), zone: null },
            { kind: "hatch", count: 1, at: ago(-2), zone: null },
        ],
    });
    assertEquals(freshArkKinNews(f, NOW).map((n) => n.kind), ["birth", "laid"]);
    assertEquals(freshArkKinNews({ ...f, lastKinMentionedAt: ago(30) }, NOW).map((n) => n.kind), ["birth"]);
});

test("the facts as the model gets them: news, now, usually, and hunters only when asked", () => {
    const f = facts({ hunters: [{ name: "Red Fox", zone: "river_lake" }] });
    const greeting = arkKinFactsForPrompt(f, "greeting", NOW);
    assertEquals(greeting, {
        news: [{ what: "arrived", how_many: 1, when: "about 5 hours ago", where: "the rivers and lakes" }],
        now: { your_kin_aboard: 2, born_aboard: 1, where: ["the rivers and lakes"], of_your_kind_aboard_in_all: 3 },
        usually: {
            ark_time: "morning",
            // 07:30: the sun is above 22 degrees, past a crepuscular kind's waking band.
            your_kind_at_this_hour: "asleep",
            when_your_kind_is_active: "most active at dawn and dusk",
            your_kinds_company: "mostly solitary outside the breeding season",
        },
    });
    assertEquals((arkKinFactsForPrompt(f, "asked", NOW) as { hunters_here?: string[] }).hunters_here, ["Red Fox"]);
    // No stored activity: the hour is not guessed.
    const plain = arkKinFactsForPrompt(facts({ activity: null, activityPhrase: null }), "greeting", NOW) as { usually: object };
    assertEquals(plain.usually, { ark_time: "morning", your_kinds_company: "mostly solitary outside the breeding season" });
});

test("the prompt lines: facts and principles, never a line to say", () => {
    const [hello] = linesFor(facts(), turn());
    const [asked] = linesFor(facts({ hunters: [{ name: "Red Fox", zone: null }] }), turn({ greeting: false, asked: true }));
    for (const line of [hello, asked]) {
        // Kin, not self (A2), and nothing happens to the companion.
        assert(line.includes("They are your kin: other individuals, not you."));
        assert(line.includes("happens to them and never to you"));
        // The truthfulness rule: what happened, what is, what the kind does.
        assert(line.includes('"news" happened'));
        assert(line.includes('"usually" is what your kind does at this time'));
        assert(line.includes("never as something anyone saw happen"));
        // Privacy.
        assert(line.includes("Never say who brought any animal, never speak of anyone else's animals"));
        // No quoted sentence to repeat, no first-person script.
        assert(!/"(I|We|My|One of my)\b/.test(line));
        assert(!/\bI (spent|saw|was|ate)\b/.test(line));
    }
    assert(hello.includes("you never bring it up again later"));
    assert(asked.includes("they are asking about the Ark"));
    assert(asked.includes("never make up what happened there"));
    assert(asked.includes("one of your kind that is no longer aboard, that is not yours to tell"));
    assert(asked.includes("hunters_here are kinds that hunt yours"));
    assert(asked.includes("never as something that happened"));
    // The hunters principle only when there are hunters, and never in a hello.
    assert(!hello.includes("hunters_here"));
    assert(!linesFor(facts(), turn({ greeting: false, asked: true }))[0].includes("hunters_here"));
});

test("no death, hunger or owner ever reaches the facts", () => {
    const parsed = parseArkKinFacts({
        enabled: true,
        species_profile_id: OTTER,
        claimed_today: false,
        crisis_recent: false,
        recent_loss: false,
        activity: "crepuscular",
        yours: { living: 1, born: 0, zones: ["river_lake"], owner: "someone" },
        aboard: 4,
        news: [
            { kind: "arrival", count: 1, at: ago(2), zone: "river_lake", brought_by: "lendawg" },
            { kind: "eaten", count: 1, at: ago(1) },
            { kind: "starved", count: 1, at: ago(1) },
            { kind: "hungry", count: 1, at: ago(1) },
            { kind: "meal", count: 1, at: ago(1) },
        ],
        hunters: [{ name: "Red Fox", zone: "river_lake", owner_user_id: "u2" }, { zone: "x" }],
    })!;
    assertEquals(parsed.news.map((n) => n.kind), ["arrival"]);
    assertEquals(parsed.hunters, [{ name: "Red Fox", zone: "river_lake" }]);
    const line = linesFor(parsed, turn({ greeting: false, asked: true }))[0];
    for (const word of ["lendawg", "someone", "u2", "eaten", "starved", "hungry"]) assert(!line.includes(word), word);
});

test("parse: the RPC's shape, defensively", () => {
    assertEquals(parseArkKinFacts(null), null);
    assertEquals(parseArkKinFacts([]), null);
    const sparse = parseArkKinFacts({ enabled: true, species_profile_id: OTTER })!;
    assertEquals(sparse.crisisRecent, null);
    assertEquals(sparse.recentLoss, null);
    assertEquals(sparse.yours, { living: 0, born: 0, zones: [] });
    assertEquals(sparse.activity, null);
    assertEquals(parseArkKinFacts({ enabled: true, activity: "sometimes" })!.activity, null);
    // Unknown crisis or loss: never a hello.
    assertEquals(chooseArkKinMention(sparse, turn()), null);
});

// The island clock: the web's shared layer, mirrored -------------------------------------------

test("the island clock matches the web's sun curve and waking rule", () => {
    // landing src/lib/ark-daylight.ts: sunElevation(h) = 58 sin(2π(h-6)/24);
    // isAwake: any always; nocturnal below 8°; crepuscular between -14° and 22°; else above -4°.
    assertEquals(arkIslandHours(new Date("2026-11-12T00:00:00Z")), 0);
    assertEquals(arkIslandHours(new Date("2026-11-12T07:30:00Z")), 7.5);
    assertEquals(arkIslandHours(new Date("2026-11-12T23:45:00Z")), 23.75);
    assertEquals(Math.round(arkSunElevation(12)), 58);
    assertEquals(Math.round(arkSunElevation(0)), -58);
    assertEquals(Math.round(arkSunElevation(6)), 0);
    const table: Array<[number, Record<string, boolean>]> = [
        [2, { diurnal: false, nocturnal: true, crepuscular: false, any: true }],
        [6, { diurnal: true, nocturnal: true, crepuscular: true, any: true }],
        [12, { diurnal: true, nocturnal: false, crepuscular: false, any: true }],
        [7.5, { diurnal: true, nocturnal: false, crepuscular: false, any: true }],
        [18.5, { diurnal: false, nocturnal: true, crepuscular: true, any: true }],
        [22, { diurnal: false, nocturnal: true, crepuscular: false, any: true }],
    ];
    for (const [hours, expected] of table) {
        for (const [activity, awake] of Object.entries(expected)) {
            assertEquals(arkKindAwake(activity as "diurnal", hours), awake, `${activity} at ${hours}`);
        }
    }
    assertEquals([0, 5.8, 8, 12, 15, 18, 21].map(arkTimeOfDay), ["night", "dawn", "morning", "midday", "afternoon", "dusk", "night"]);
    // The web's own shared layer, the one the scene runs on: the port must agree with it hour by hour.
    for (let quarter = 0; quarter < 96; quarter++) {
        const at = new Date(Date.UTC(2026, 10, 12) + quarter * 15 * 60_000);
        const hours = arkIslandHours(at);
        assertEquals(hours, islandHours(at.getTime()), `island hours at ${at.toISOString()}`);
        for (const activity of ["diurnal", "nocturnal", "crepuscular", "any"] as const) {
            assertEquals(arkKindAwake(activity, hours), isAwake(activity, sunElevation(hours)), `${activity} at ${hours}`);
        }
    }
    assertEquals(arkZoneName("river_lake"), "the rivers and lakes");
    assertEquals(arkZoneName("nowhere"), null);
});

// Reads and the claim --------------------------------------------------------------------------

const fakeAdmin = (answers: Record<string, { data: unknown; error: { message: string } | null } | Error>) => {
    const calls: Array<{ fn: string; args: Record<string, unknown> }> = [];
    const admin: ArkKinAdmin = {
        rpc: (fn, args) => {
            calls.push({ fn, args });
            const answer = answers[fn];
            if (answer instanceof Error) return Promise.reject(answer);
            return Promise.resolve(answer ?? { data: null, error: { message: `Could not find the function public.${fn}` } });
        },
    };
    return { admin, calls };
};

test("the flag: off when missing or failing, cached for a minute", async () => {
    resetArkKinFlagCache();
    assertEquals(await loadArkKinEnabled(fakeAdmin({}).admin, 0), false);
    resetArkKinFlagCache();
    assertEquals(await loadArkKinEnabled(fakeAdmin({ voyage_ark_kin_enabled: new Error("timeout") }).admin, 0), false);
    resetArkKinFlagCache();
    const on = fakeAdmin({ voyage_ark_kin_enabled: { data: true, error: null } });
    assertEquals(await loadArkKinEnabled(on.admin, 1_000), true);
    assertEquals(await loadArkKinEnabled(on.admin, 30_000), true);
    assertEquals(on.calls.length, 1);
    assertEquals(await loadArkKinEnabled(on.admin, 62_000), true);
    assertEquals(on.calls.length, 2);
    resetArkKinFlagCache();
});

test("loader and claim: nothing on any failure; the claim is true only when written", async () => {
    const missing = fakeAdmin({});
    assertEquals(await loadArkKinFacts(missing.admin, { userId: "u", speciesProfileId: OTTER, asked: false }), null);
    assertEquals(await claimArkKinMention(missing.admin, { userId: "u", speciesProfileId: OTTER }), false);
    const ok = fakeAdmin({
        voyage_ark_kin_facts_v1: { data: { enabled: false }, error: null },
        voyage_claim_ark_kin_mention_v1: { data: true, error: null },
    });
    assertEquals((await loadArkKinFacts(ok.admin, { userId: "u", speciesProfileId: OTTER, asked: true }))?.enabled, false);
    assert(await claimArkKinMention(ok.admin, { userId: "u", speciesProfileId: OTTER }));
    assertEquals(ok.calls, [
        { fn: "voyage_ark_kin_facts_v1", args: { p_user_id: "u", p_species_profile_id: OTTER, p_asked: true } },
        { fn: "voyage_claim_ark_kin_mention_v1", args: { p_user_id: "u", p_species_profile_id: OTTER } },
    ]);
    const lost = fakeAdmin({ voyage_claim_ark_kin_mention_v1: { data: false, error: null } });
    assertEquals(await claimArkKinMention(lost.admin, { userId: "u", speciesProfileId: OTTER }), false);
});
