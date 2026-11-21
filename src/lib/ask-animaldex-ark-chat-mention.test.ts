import nodeAssert from "node:assert/strict";
import test from "node:test";
import {
    ARK_MEAL_MAX_AGE_MS,
    type ArkChatMentionFacts,
    type ArkMeal,
    arkMealAgo,
    arkMealPromptLines,
    type ArkMentionAdmin,
    type ArkMentionTurn,
    chooseArkMeal,
    claimArkChatMention,
    loadArkChatMentionFacts,
    parseArkChatMentionFacts,
} from "@/lib/ask-animaldex/ark-chat-mention";

const assert = (value: unknown, message?: string) => nodeAssert.ok(value, message);
const assertEquals = (actual: unknown, expected: unknown, message?: string) => nodeAssert.deepStrictEqual(actual, expected, message);

const NOW = new Date("2026-11-12T12:00:00Z");
const TIGER = "11111111-1111-4111-8111-111111111111";
const PIG = "22222222-2222-4222-8222-222222222222";
const HOURS = 3_600_000;

const meal = (over: Partial<ArkMeal> = {}): ArkMeal => ({
    eventId: "41",
    at: new Date(NOW.getTime() - 5 * HOURS).toISOString(),
    phrase: "feeds on wild pigs, deer and water buffalo",
    predatorSpeciesId: TIGER,
    preySpeciesId: PIG,
    preyName: "Wild Boar",
    ...over,
});

const facts = (over: Partial<ArkChatMentionFacts> = {}): ArkChatMentionFacts => ({
    enabled: true,
    speciesProfileId: TIGER,
    claimedToday: false,
    crisisRecent: false,
    lastMentionedAt: null,
    meals: [meal()],
    ...over,
});

const turn = (over: Partial<ArkMentionTurn> = {}): ArkMentionTurn => ({
    greeting: true,
    audience: "owner",
    call: false,
    focusSensitive: false,
    now: NOW,
    ...over,
});

test("an owner's greeting carries its animal's newest meal", () => {
    const older = meal({ eventId: "40", at: new Date(NOW.getTime() - 30 * HOURS).toISOString() });
    assertEquals(chooseArkMeal(facts({ meals: [older, meal()] }), turn())?.eventId, "41");
});

test("flag off: nothing, whatever else is true", () => {
    assertEquals(chooseArkMeal(facts({ enabled: false }), turn()), null);
    assertEquals(chooseArkMeal(null, turn()), null);
    const off = parseArkChatMentionFacts({ enabled: false });
    assertEquals(off?.enabled, false);
    assertEquals(chooseArkMeal(off, turn()), null);
});

test("never mid-conversation, on a call, or in a visitor's or public chat", () => {
    assertEquals(chooseArkMeal(facts(), turn({ greeting: false })), null);
    assertEquals(chooseArkMeal(facts(), turn({ call: true })), null);
    assertEquals(chooseArkMeal(facts(), turn({ audience: "visitor" })), null);
    assertEquals(chooseArkMeal(facts(), turn({ audience: "public" })), null);
});

test("one Ark mention a day, a hard focus, or a crisis in the last day: skipped", () => {
    assertEquals(chooseArkMeal(facts({ claimedToday: true }), turn()), null);
    assertEquals(chooseArkMeal(facts(), turn({ focusSensitive: true })), null);
    assertEquals(chooseArkMeal(facts({ crisisRecent: true }), turn()), null);
    // Cannot tell: treated as a crisis.
    assertEquals(chooseArkMeal(facts({ crisisRecent: null }), turn()), null);
});

test("older than 3 days: skipped; just inside: kept", () => {
    const edge = new Date(NOW.getTime() - ARK_MEAL_MAX_AGE_MS).toISOString();
    assertEquals(chooseArkMeal(facts({ meals: [meal({ at: edge })] }), turn())?.eventId, "41");
    const old = new Date(NOW.getTime() - ARK_MEAL_MAX_AGE_MS - 1).toISOString();
    assertEquals(chooseArkMeal(facts({ meals: [meal({ at: old })] }), turn()), null);
    const future = new Date(NOW.getTime() + HOURS).toISOString();
    assertEquals(chooseArkMeal(facts({ meals: [meal({ at: future })] }), turn()), null);
});

test("the eaten animal is never spoken of in its own chat", () => {
    // The prey's chat: the predator is not this species.
    assertEquals(chooseArkMeal(facts({ speciesProfileId: PIG }), turn()), null);
    // Prey of the chat's own species, or unknown: nothing.
    assertEquals(chooseArkMeal(facts({ meals: [meal({ preySpeciesId: TIGER })] }), turn()), null);
    assertEquals(chooseArkMeal(facts({ meals: [meal({ preySpeciesId: null })] }), turn()), null);
    assertEquals(chooseArkMeal(facts({ meals: [meal({ preyName: null })] }), turn()), null);
});

test("once: nothing at or before the last meal mentioned in this chat", () => {
    const mentioned = meal().at;
    assertEquals(chooseArkMeal(facts({ lastMentionedAt: mentioned }), turn()), null);
    const newer = meal({ eventId: "42", at: new Date(NOW.getTime() - 1 * HOURS).toISOString() });
    assertEquals(chooseArkMeal(facts({ lastMentionedAt: mentioned, meals: [meal(), newer] }), turn())?.eventId, "42");
});

test("ties break on the event id, deterministically", () => {
    const a = meal({ eventId: "9" });
    const b = meal({ eventId: "10" });
    assertEquals(chooseArkMeal(facts({ meals: [a, b] }), turn())?.eventId, "10");
    assertEquals(chooseArkMeal(facts({ meals: [b, a] }), turn())?.eventId, "10");
});

test("parse: the RPC's shape, defensively", () => {
    assertEquals(parseArkChatMentionFacts(null), null);
    assertEquals(parseArkChatMentionFacts([]), null);
    const parsed = parseArkChatMentionFacts({
        enabled: true,
        species_profile_id: TIGER,
        claimed_today: false,
        crisis_recent: false,
        last_mentioned_at: null,
        meals: [
            { event_id: 41, at: meal().at, phrase: " eats pigs ", predator_species_id: TIGER, prey_species_id: PIG, prey_name: "Wild Boar" },
            { event_id: null, at: meal().at },
            "junk",
        ],
    });
    assertEquals(parsed?.meals.length, 1);
    assertEquals(parsed?.meals[0].eventId, "41");
    assertEquals(parsed?.meals[0].phrase, "eats pigs");
    assertEquals(parseArkChatMentionFacts({ enabled: true, meals: [] })?.crisisRecent, null);
});

test("the prompt line: facts and a principle, no line to say", () => {
    assertEquals(arkMealPromptLines(null, NOW), []);
    const [line, ...rest] = arkMealPromptLines(meal(), NOW);
    assertEquals(rest, []);
    assert(line.startsWith("ark_meal — "));
    assert(line.includes('"ate":"Wild Boar"'));
    assert(line.includes('"when":"about 5 hours ago"'));
    assert(line.includes('"from_your_record":"feeds on wild pigs, deer and water buffalo"'));
    assert(line.includes("once, in this hello only, in your own words"));
    assert(line.includes("Never say who brought the other animal"));
    // Not the owner's example, nor any quoted sentence to repeat.
    assert(!/I ate|I was hungry|one of my kind/i.test(line));
    assert(!/first person/i.test(line), "the Ark animal is not the companion: no first-person meal");
    assertEquals(arkMealAgo(new Date(NOW.getTime() - 20 * 60_000).toISOString(), NOW), "within the last hour");
    assertEquals(arkMealAgo(new Date(NOW.getTime() - 1 * HOURS).toISOString(), NOW), "about 1 hour ago");
    assertEquals(arkMealAgo(new Date(NOW.getTime() - 50 * HOURS).toISOString(), NOW), "about 2 days ago");
});

test("flag off: nothing joins the companion lines, so the greeting prompt is unchanged", () => {
    assertEquals(arkMealPromptLines(chooseArkMeal(parseArkChatMentionFacts({ enabled: false }), turn()), NOW), []);
    // On, the line joins the companion lines, so it reaches the hello.
    const on = arkMealPromptLines(chooseArkMeal(facts(), turn()), NOW);
    assertEquals(on.length, 1);
    assert(on[0].startsWith("ark_meal — "));
});

const fakeAdmin = (answers: Record<string, { data: unknown; error: { message: string } | null } | Error>) => {
    const calls: Array<{ fn: string; args: Record<string, unknown> }> = [];
    const admin: ArkMentionAdmin = {
        rpc: (fn, args) => {
            calls.push({ fn, args });
            const answer = answers[fn];
            if (answer instanceof Error) return Promise.reject(answer);
            return Promise.resolve(answer ?? { data: null, error: { message: `Could not find the function public.${fn}` } });
        },
    };
    return { admin, calls };
};

test("loader: a missing function, an error or a throw is nothing", async () => {
    const missing = fakeAdmin({});
    assertEquals(await loadArkChatMentionFacts(missing.admin, { userId: "u", speciesProfileId: TIGER }), null);
    const thrown = fakeAdmin({ voyage_chat_mention_facts_v1: new Error("timeout") });
    assertEquals(await loadArkChatMentionFacts(thrown.admin, { userId: "u", speciesProfileId: TIGER }), null);
    const ok = fakeAdmin({ voyage_chat_mention_facts_v1: { data: { enabled: false }, error: null } });
    assertEquals((await loadArkChatMentionFacts(ok.admin, { userId: "u", speciesProfileId: TIGER }))?.enabled, false);
    assertEquals(ok.calls, [{ fn: "voyage_chat_mention_facts_v1", args: { p_user_id: "u", p_species_profile_id: TIGER } }]);
});

test("claim: true only when the row was written", async () => {
    const won = fakeAdmin({ voyage_claim_chat_mention_v1: { data: true, error: null } });
    assert(await claimArkChatMention(won.admin, { userId: "u", speciesProfileId: TIGER, meal: meal() }));
    assertEquals(won.calls[0].args, { p_user_id: "u", p_species_profile_id: TIGER, p_event_id: "41", p_event_at: meal().at });
    const lost = fakeAdmin({ voyage_claim_chat_mention_v1: { data: false, error: null } });
    assertEquals(await claimArkChatMention(lost.admin, { userId: "u", speciesProfileId: TIGER, meal: meal() }), false);
    const missing = fakeAdmin({});
    assertEquals(await claimArkChatMention(missing.admin, { userId: "u", speciesProfileId: TIGER, meal: meal() }), false);
    // Not a bigint id: never sent.
    const odd = fakeAdmin({ voyage_claim_chat_mention_v1: { data: true, error: null } });
    assertEquals(await claimArkChatMention(odd.admin, { userId: "u", speciesProfileId: TIGER, meal: meal({ eventId: "x" }) }), false);
    assertEquals(odd.calls.length, 0);
});

test("kin, not self (A2): the Ark animal is another of its kind, never the companion", () => {
    const [line] = arkMealPromptLines(meal(), NOW);
    // The principle, not words to say: it ate, one of their kind did; the companion did not.
    assert(line.includes("one of your kind that they brought aboard ate recently"));
    assert(line.includes("your kin, another individual, not you"));
    assert(line.includes("never as something you did yourself"));
    assert(!/\byou ate\b/i.test(line));
});

test("an Ark death never makes the companion talk as if it died (A2)", () => {
    const [line] = arkMealPromptLines(meal(), NOW);
    assert(line.includes("happens to them and never to you"));
    assert(line.includes("never speak as if you had died, been eaten or were in danger"));
    // Nothing about an Ark death ever reaches a greeting except as this principle:
    // no meal, no line at all.
    assertEquals(arkMealPromptLines(null, NOW), []);
});

test("kinds (A1): a meal by the person's animal of the chat's kind is the companion's kin's meal", () => {
    // The facts RPC returns kinds: a Labrador chat (kind Domestic Dog) gets the meal
    // of the person's Poodle (kind Domestic Dog); the prey's kind is never the chat's.
    const DOG = "33333333-3333-4333-8333-333333333333";
    const kin = facts({ speciesProfileId: DOG, meals: [meal({ predatorSpeciesId: DOG })] });
    assertEquals(chooseArkMeal(kin, turn())?.eventId, "41");
    assertEquals(chooseArkMeal(facts({ speciesProfileId: DOG, meals: [meal({ predatorSpeciesId: DOG, preySpeciesId: DOG })] }), turn()), null);
});
