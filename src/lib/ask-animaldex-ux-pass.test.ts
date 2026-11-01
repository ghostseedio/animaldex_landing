import assert from "node:assert/strict";
import test from "node:test";

// The UX / premium pass on Talk (2026-11-01): which chat /talk/<slug> opens
// (WEB-1), the picker's ranking and first animals (WEB-4, WEB-5), chat
// history on every device (docs/chat-sync/SPEC.md), "Ask another animal"
// (WEB-3), the error lines (WEB-40), people never public (DECISIONS section
// 11) and dictation's text (section 9).
import {resolveTalkSlug, talkCatalogSlugForEntry, type TalkCatalogIndex} from "@/lib/ask-animaldex/talk-resolve";
import {collectionIdentityMatchKeys} from "@/lib/collection-identity-aliases";
import {speciesEntries} from "@/data/species";
import {
    TALK_FEATURED_SLUGS,
    talkAskAnotherOffered,
    talkCapabilityAction,
    talkFeaturedAnimals,
    talkMergeRecentChats,
    talkPowerReadsAsLesson,
    talkRecentChats,
    talkSearch,
    talkSearchRank,
    type TalkAnimal
} from "@/lib/ask-animaldex/talk";
import {mergeServerThread, normalizeServerChatRows, serverThreadKey, type ServerChatRow} from "@/lib/ask-animaldex/chat-sync";
import {buildChatTranscript, chatMessageId, chatTranscriptSkip, isMissingRpc} from "@/lib/ask-animaldex/chat-history";
import {createAskMessage, type AskMessage} from "@/lib/ask-animaldex/thread";
import {AppRequestError, isHumanMessage, userFacingError} from "@/lib/user-facing-error";
import {isHomoSapiens, rowIsHomoSapiens} from "@/lib/people-never-public";
import {dictatedText, dictationClock} from "@/lib/ask-animaldex/dictation";
import {ANIMAL_PUBLIC_CHAT_RULES, buildAskStreamingSystemPrompt} from "@/lib/ask-animaldex/prompt";
import {ANIMAL_AUTO_MODE_RULES, ANIMAL_RELATIONSHIP_RULES} from "@/lib/ask-animaldex/companion";

// MARK: - WEB-1: /talk/<slug> never 404s for a species page

/** A slice of the live catalog (species_catalog_v1, 2026-11-01). */
const INDEX: TalkCatalogIndex = {
    slugs: new Set(["african-lion", "domestic-cat", "red-fox", "central-american-agouti", "gray-wolf", "egyptian-spiny-tailed-lizard"]),
    bySpeciesProfileId: new Map([
        ["5c5fab8a-0426-4588-8024-a1d30bcbbca2", "domestic-cat"],
        ["db5e0c2c-0e78-4872-9adc-82662f70b5f9", "central-american-agouti"],
        ["ccec0258-fdde-4ace-b35f-1a8fe1916617", "red-fox"]
    ]),
    byIdentity: new Map([
        ["african_lion", "african-lion"],
        ["domestic_cat", "domestic-cat"],
        ["red_fox", "red-fox"],
        ["egyptian_spiny_tailed_lizard", "egyptian-spiny-tailed-lizard"]
    ])
};

const resolve = (slug: string, entry: Parameters<typeof resolveTalkSlug>[0]["entry"]) =>
    resolveTalkSlug({slug, index: INDEX, entry, identityKeys: collectionIdentityMatchKeys});

test("a slug the catalog has is its chat", () => {
    assert.deepEqual(resolve("red-fox", null), {kind: "catalog", slug: "red-fox"});
});

test("a species page that is a catalog animal redirects to that animal's chat (lion, cat, agouti)", () => {
    // The species page's own resolution, as getResolvedSpeciesBySlug returned it (audit WEB-1 probe).
    assert.deepEqual(resolve("lion", {slug: "lion", name: "Lion", normalizedIdentityKey: "lion"}), {kind: "redirect", slug: "african-lion"});
    assert.deepEqual(resolve("cat", {slug: "cat", name: "Domestic Cat", speciesProfileId: "5C5FAB8A-0426-4588-8024-A1D30BCBBCA2"}), {kind: "redirect", slug: "domestic-cat"});
    assert.deepEqual(resolve("agouti", {slug: "agouti", name: "Central American Agouti", speciesProfileId: "db5e0c2c-0e78-4872-9adc-82662f70b5f9"}), {kind: "redirect", slug: "central-american-agouti"});
    assert.deepEqual(resolve("spiny-tailed-lizard", {slug: "spiny-tailed-lizard", name: "Spiny-tailed Lizard"}), {kind: "redirect", slug: "egyptian-spiny-tailed-lizard"});
    // /talk/african-lion is the catalog's; /animals/african-lion 308s to /animals/lion, which is the same animal.
    assert.equal(talkCatalogSlugForEntry({slug: "lion", name: "Lion"}, INDEX, collectionIdentityMatchKeys), "african-lion");
});

test("a species page with no catalog animal opens its own chat, the one its drawer has (fox, honey bee)", () => {
    assert.deepEqual(resolve("fox", {slug: "fox", name: "Fox"}), {kind: "species", slug: "fox", name: "Fox"});
    assert.deepEqual(resolve("honey-bee", {slug: "honey-bee", name: "Honey Bee"}), {kind: "species", slug: "honey-bee", name: "Honey Bee"});
    // An alias of a species page with no catalog animal: that page's chat.
    assert.deepEqual(resolve("old-fox-alias", {slug: "fox", name: "Fox"}), {kind: "redirect", slug: "fox"});
    // Nothing anywhere: a 404.
    assert.deepEqual(resolve("not-an-animal", null), {kind: "none"});
});

test("every species page slug resolves on /talk: a catalog chat, a redirect to one, or its own", () => {
    let checked = 0;
    for (const entry of speciesEntries) {
        const resolution = resolve(entry.slug, {slug: entry.slug, name: entry.name, speciesProfileId: entry.speciesProfileId ?? null, normalizedIdentityKey: entry.normalizedIdentityKey ?? null});
        assert.notEqual(resolution.kind, "none", entry.slug);
        if (resolution.kind === "redirect") assert.notEqual(resolution.slug, entry.slug);
        checked += 1;
    }
    assert.ok(checked > 100, String(checked));
});

// MARK: - WEB-4, WEB-5: the picker

const animal = (slug: string, name: string, power: string | null = "Some Power"): TalkAnimal => ({slug, name, power});

test("search: the name, then its head noun, then its start; the better known first within a rank", () => {
    // Most captured first, as the catalog route orders them.
    const animals = [animal("gray-wolf", "Gray Wolf"), animal("red-fox", "Red Fox"), animal("wolf-eel", "Wolf Eel"), animal("fox-moth", "Fox Moth"), animal("maned-wolf", "Maned Wolf"), animal("aardwolf", "Aardwolf")];
    assert.deepEqual(talkSearch(animals, "wolf").map((item) => item.slug).slice(0, 2), ["gray-wolf", "maned-wolf"]);
    assert.equal(talkSearch(animals, "wolf").map((item) => item.slug).indexOf("wolf-eel") > 1, true);
    assert.equal(talkSearch(animals, "fox")[0].slug, "red-fox");
    assert.equal(talkSearch(animals, "Gray Wolf")[0].slug, "gray-wolf");
    assert.equal(talkSearchRank("Gray Wolf", "gray wolf"), 0);
    assert.equal(talkSearchRank("Gray Wolf", "wolf"), 1);
    assert.equal(talkSearchRank("Wolf Eel", "wolf"), 2);
    assert.equal(talkSearchRank("Aardwolf", "wolf"), 4);
    assert.equal(talkSearchRank("Orca", "wolf"), -1);
});

test("the first animals offered: the featured six in order, each with its own art and a lesson for a Power", () => {
    assert.deepEqual([...TALK_FEATURED_SLUGS], ["gray-wolf", "common-octopus", "little-owl", "orca", "african-bush-elephant", "western-honey-bee"]);
    const bySlug = new Map<string, TalkAnimal>([
        ["gray-wolf", animal("gray-wolf", "Gray Wolf", "Cooperation")],
        ["common-octopus", animal("common-octopus", "Common Octopus", "Flexible Intelligence")],
        ["little-owl", animal("little-owl", "Little Owl", "Night Focus Strategy")],
        ["orca", animal("orca", "Orca", "Pod Intelligence")],
        ["african-bush-elephant", animal("african-bush-elephant", "African Bush Elephant", "Memory Path")],
        ["western-honey-bee", animal("western-honey-bee", "Western Honey Bee", "Colony Teamwork Strategy")],
        ["house-fly", animal("house-fly", "House Fly", "Uninvited")],
        ["cheetah", animal("cheetah", "Cheetah", "Spring-Loaded Spine")],
        ["human", animal("human", "Human", "Culture")]
    ]);
    const picked = talkFeaturedAnimals({bySlug, talkedTo: ["house-fly", "human", "cheetah"], hasArt: (slug) => slug !== "orca", max: 12});
    // Orca has no art here: left out, never shown with a placeholder. The fly's Power is a stub; people are never offered.
    assert.deepEqual(picked.map((item) => item.slug), ["gray-wolf", "common-octopus", "little-owl", "african-bush-elephant", "western-honey-bee", "cheetah"]);
    assert.equal(talkPowerReadsAsLesson("Cooperation"), true);
    assert.equal(talkPowerReadsAsLesson("Foresight"), true);
    assert.equal(talkPowerReadsAsLesson("Urban"), false);
    assert.equal(talkPowerReadsAsLesson("Uninvited"), false);
    assert.equal(talkPowerReadsAsLesson(""), false);
});

// MARK: - WEB-3, JRN-6: Ask another, and what a locked capability offers

test("Ask another animal shows under a finished answer to a real problem, never once today's messages are spent", () => {
    assert.equal(talkAskAnotherOffered({publicChat: true, quotaReached: false, finished: true, realProblem: true}), true);
    assert.equal(talkAskAnotherOffered({publicChat: true, quotaReached: true, finished: true, realProblem: true}), false);
    assert.equal(talkAskAnotherOffered({publicChat: true, quotaReached: false, finished: false, realProblem: true}), false);
    assert.equal(talkAskAnotherOffered({publicChat: false, quotaReached: false, finished: true, realProblem: true}), false);
    assert.equal(talkAskAnotherOffered({publicChat: true, quotaReached: false, finished: true, realProblem: false}), false);
});

test("steps, debates and Trials need an animal of their own: the app, signed in or not (an account alone unlocks none)", () => {
    for (const signedIn of [false, true]) {
        assert.equal(talkCapabilityAction("step", {signedIn}), "app");
        assert.equal(talkCapabilityAction("debates", {signedIn}), "app");
        assert.equal(talkCapabilityAction("trial", {signedIn}), "catch");
    }
});

// MARK: - Chat history on every device

const REQUEST = "6f0c1d2e-3a4b-4c5d-8e6f-7a8b9c0d1e2f";
const row = (overrides: Partial<ServerChatRow>): ServerChatRow => ({
    id: overrides.id ?? `row-${Math.random().toString(36).slice(2)}`,
    role: "assistant",
    body: "Hello.",
    client_message_id: null,
    reply_to: null,
    is_greeting: false,
    meta: {},
    created_at: "2026-11-01T08:00:00.000Z",
    ...overrides
});
const local = (role: "user" | "assistant", text: string, createdAt: string, extra: Partial<AskMessage> = {}): AskMessage =>
    createAskMessage(role, text, {createdAt, ...extra});

test("an empty thread here takes the account's whole thread, in order, and a hello on its way stays at the end", () => {
    const rows = [
        row({role: "assistant", body: "Hi, I'm Luna.", is_greeting: true, created_at: "2026-10-30T08:00:00Z"}),
        row({role: "user", body: "Should I take the job?", client_message_id: REQUEST, created_at: "2026-10-30T08:01:00Z"}),
        row({role: "assistant", body: "Take it.", reply_to: REQUEST, created_at: "2026-10-30T08:01:20Z"})
    ];
    assert.deepEqual(mergeServerThread([], rows)?.map((message) => message.text), ["Hi, I'm Luna.", "Should I take the job?", "Take it."]);
    // Their own message keeps its request id: the next merge finds it.
    assert.equal(mergeServerThread([], rows)?.[1].id, REQUEST);
    const hello = createAskMessage("assistant", "", {status: "thinking", isGreeting: true, createdAt: "2026-11-01T09:00:00Z"});
    const merged = mergeServerThread([hello], rows) ?? [];
    assert.equal(merged[merged.length - 1], hello);
    assert.equal(merged.length, 4);
});

test("only what is missing joins, in time order; a pair already here is never doubled", () => {
    const asked = local("user", "Should I take the job?", "2026-10-30T08:01:00Z", {id: REQUEST});
    const answered = local("assistant", "Take it.", "2026-10-30T08:01:20Z");
    const later = "1a2b3c4d-1111-4222-8333-444455556666";
    const rows = [
        row({role: "user", body: "Should I take the job?", client_message_id: REQUEST, created_at: "2026-10-30T08:01:00Z"}),
        row({role: "assistant", body: "Take it, on your terms.", reply_to: REQUEST, created_at: "2026-10-30T08:01:20Z"}),
        row({role: "user", body: "I told them.", client_message_id: later, created_at: "2026-10-31T10:00:00Z"}),
        row({role: "assistant", body: "Good. How did it land?", reply_to: later, created_at: "2026-10-31T10:00:15Z"})
    ];
    const merged = mergeServerThread([asked, answered], rows) ?? [];
    assert.deepEqual(merged.map((message) => message.text), ["Should I take the job?", "Take it.", "I told them.", "Good. How did it land?"]);
    // Nothing missing: nothing written.
    assert.equal(mergeServerThread(merged, rows), null);
    assert.equal(mergeServerThread(merged, []), null);
});

test("a reply joins right after the message it answers, even when the question is here and its answer is not", () => {
    const asked = local("user", "And then?", "2026-10-31T10:00:00Z", {id: REQUEST});
    const newer = local("user", "Something else", "2026-10-31T11:00:00Z");
    const merged = mergeServerThread([asked, newer], [row({role: "assistant", body: "Then you wait.", reply_to: REQUEST, created_at: "2026-10-31T10:00:30Z"})]) ?? [];
    assert.deepEqual(merged.map((message) => message.text), ["And then?", "Then you wait.", "Something else"]);
});

test("a hello joins by time, but never beside a local hello of the same minute", () => {
    const hello = local("assistant", "Hi, I'm Luna.", "2026-11-01T08:00:10Z", {isGreeting: true});
    assert.equal(mergeServerThread([hello], [row({body: "Hi there, I'm Luna.", is_greeting: true, created_at: "2026-11-01T08:00:40Z"})]), null);
    const older = mergeServerThread([hello], [row({body: "Morning. I'm Luna.", is_greeting: true, created_at: "2026-10-29T07:00:00Z"})]) ?? [];
    assert.deepEqual(older.map((message) => message.text), ["Morning. I'm Luna.", "Hi, I'm Luna."]);
});

test("local-only rows stay where they are, and a turn in flight is never touched", () => {
    const warmup = local("assistant", "", "2026-11-01T08:00:00Z", {warmup: {runId: "run", speciesProfileId: "s", index: 0, total: 2, prompt: "Which?", choices: ["a", "b"]}});
    const question = createAskMessage("user", "Now?", {createdAt: "2026-11-01T08:05:00Z"});
    const placeholder = createAskMessage("assistant", "", {status: "streaming", createdAt: "2026-11-01T08:05:01Z"});
    const merged = mergeServerThread([warmup, question, placeholder], [
        row({role: "user", body: "Earlier", client_message_id: REQUEST, created_at: "2026-10-31T08:00:00Z"}),
        row({role: "assistant", body: "Earlier answer", reply_to: REQUEST, created_at: "2026-10-31T08:00:10Z"})
    ]) ?? [];
    assert.deepEqual(merged.map((message) => message.text), ["Earlier", "Earlier answer", "", "Now?", ""]);
    assert.equal(merged[2], warmup);
    assert.equal(merged[4], placeholder);
});

test("rows from the RPC are read tolerantly; the account keys a thread by its card or its canonical species", () => {
    const rows = normalizeServerChatRows([
        {id: "1", role: "user", body: "Hi", client_message_id: REQUEST.toUpperCase(), reply_to: null, is_greeting: false, meta: {}, created_at: "2026-11-01T08:00:00Z"},
        {id: "2", role: "system", body: "x", created_at: "2026-11-01T08:00:00Z"},
        {id: "3", role: "assistant", body: "", created_at: "2026-11-01T08:00:00Z"},
        null
    ]);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].client_message_id, REQUEST);
    assert.equal(serverThreadKey({captureId: null, speciesProfileId: "59F1A1A9-CF08-4418-9BAF-B20DDD00CEB3"}), "species:59f1a1a9-cf08-4418-9baf-b20ddd00ceb3");
    assert.equal(serverThreadKey({captureId: "8D84BC94-B135-4974-AEE8-74FAF3E239B0", speciesProfileId: "59f1a1a9-cf08-4418-9baf-b20ddd00ceb3"}), "capture:8d84bc94-b135-4974-aee8-74faf3e239b0");
    assert.equal(serverThreadKey({captureId: null, speciesProfileId: null}), null);
});

test("the website stores a turn as the server does: the message by its request id, then the reply answering it", async () => {
    const base = {
        userId: "11111111-2222-4333-8444-555555555555",
        captureId: null,
        speciesProfileId: "59F1A1A9-CF08-4418-9BAF-B20DDD00CEB3",
        call: false,
        aboutTrial: false,
        greeting: false,
        requestId: REQUEST,
        question: "  Should I take the job?  ",
        answer: "Take it.",
        askedAt: new Date("2026-11-01T08:00:00Z")
    };
    const turn = await buildChatTranscript(base);
    assert.equal(turn?.p_thread_key, "species:59f1a1a9-cf08-4418-9baf-b20ddd00ceb3");
    assert.equal(turn?.p_surface, "web");
    assert.deepEqual(turn?.p_messages, [
        {role: "user", body: "Should I take the job?", client_message_id: REQUEST, at: "2026-11-01T08:00:00.000Z"},
        {role: "assistant", body: "Take it.", reply_to: REQUEST}
    ]);
    const hello = await buildChatTranscript({...base, greeting: true, requestId: null, question: ""});
    assert.deepEqual(hello?.p_messages, [{role: "assistant", body: "Take it.", is_greeting: true}]);
    // Never a signed-out reader, a call, a Trial thread or an unanswered turn.
    assert.equal(chatTranscriptSkip({...base, userId: null}), "signed_out");
    assert.equal(chatTranscriptSkip({...base, call: true}), "call");
    assert.equal(chatTranscriptSkip({...base, aboutTrial: true}), "trial");
    assert.equal(chatTranscriptSkip({...base, answer: " "}), "unanswered");
    assert.equal(chatTranscriptSkip({...base, speciesProfileId: null}), "no_thread");
    // A card's thread is the card's.
    assert.equal((await buildChatTranscript({...base, captureId: "8D84BC94-B135-4974-AEE8-74FAF3E239B0"}))?.p_thread_key, "capture:8d84bc94-b135-4974-aee8-74faf3e239b0");
    // A non-UUID request id becomes a stable UUID, the server's way.
    const derived = await chatMessageId("ask-legacy-1");
    assert.match(derived, /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    assert.equal(await chatMessageId("ask-legacy-1"), derived);
    // Before the migration, the RPC's absence is today's behaviour, not a failure.
    assert.equal(isMissingRpc({code: "PGRST202", message: "Could not find the function public.animal_chat_threads_v1"}), true);
    assert.equal(isMissingRpc({code: "42501", message: "auth_required"}), false);
});

test("Recent chats: this browser's and the account's threads, one row each, newest first", () => {
    const now = new Date("2026-11-01T15:00:00").getTime();
    const localGroups = talkRecentChats({"species:red-fox": [local("user", "hi", new Date(now - 3600e3).toISOString())]}, {}, now);
    const merged = talkMergeRecentChats(localGroups, [
        {key: "species:red-fox", serverKey: "species:ccec0258-fdde-4ace-b35f-1a8fe1916617", slug: "red-fox", name: "Red Fox", captureId: null, preview: "Take it.", lastAt: now - 60e3},
        {key: "species:gray-wolf", serverKey: "species:59f1a1a9-cf08-4418-9baf-b20ddd00ceb3", slug: "gray-wolf", name: "Gray Wolf", captureId: null, preview: "Pack first.", lastAt: now - 30 * 3600e3}
    ], now);
    assert.deepEqual(merged.map((group) => group.group), ["today", "yesterday"]);
    assert.equal(merged[0].chats.length, 1);
    assert.equal(merged[0].chats[0].serverKey, "species:ccec0258-fdde-4ace-b35f-1a8fe1916617");
    assert.equal(merged[0].chats[0].lastAt, now - 60e3);
    assert.equal(merged[0].chats[0].preview, "hi");
    assert.equal(merged[1].chats[0].slug, "gray-wolf");
});

// MARK: - Public species chats: the apps' rules, verbatim

test("a public species chat gets the apps' public rules in place of the step offers", () => {
    assert.deepEqual(ANIMAL_PUBLIC_CHAT_RULES, [
        "This person has not captured one of your kind: you are meeting them, and you are nobody's companion here. Talk",
        "their life through with them as yourself, but set no steps, offer no Warmup, Trials or debates, and send no cards.",
        "If they ask about those, say in your own words that they come once they capture one of your kind."
    ]);
    const prompt = buildAskStreamingSystemPrompt({scope: "species", animalName: "Red Fox", mode: "auto", supportedVisuals: [], publicChat: true});
    const lines = prompt.split("\n");
    const at = lines.indexOf(ANIMAL_PUBLIC_CHAT_RULES[0]);
    assert.ok(at > 0);
    // As the server's loopRules: the mode's lines, a blank, these, a blank, the relationship rules.
    assert.deepEqual(lines.slice(at - ANIMAL_AUTO_MODE_RULES.length - 1, at - 1), ANIMAL_AUTO_MODE_RULES);
    assert.deepEqual(lines.slice(at + 4, at + 4 + ANIMAL_RELATIONSHIP_RULES.length), ANIMAL_RELATIONSHIP_RULES);
    assert.equal(buildAskStreamingSystemPrompt({scope: "species", animalName: "Red Fox", mode: "auto", supportedVisuals: []}).includes(ANIMAL_PUBLIC_CHAT_RULES[0]), false);
});

// MARK: - WEB-40: one error mapper

test("errors: offline as offline, a route's own sentence as it is, anything else as our side", () => {
    const words = {errorOffline: "You're offline. We'll try again when you're back.", errorServer: "Something went wrong on our side. Try again in a moment."};
    const quiet = console.warn;
    console.warn = () => undefined;
    try {
        assert.equal(userFacingError(new TypeError("Failed to fetch"), words, {online: false}).message, words.errorOffline);
        assert.equal(userFacingError(new TypeError("Failed to fetch"), words, {online: true}).message, words.errorServer);
        assert.equal(userFacingError(new AppRequestError(409, "That username is already taken."), words, {online: true}).message, "That username is already taken.");
        assert.equal(userFacingError(new AppRequestError(400, "duplicate key value violates unique constraint \"profiles_username_key\""), words, {online: true}).message, words.errorServer);
        assert.equal(userFacingError(new AppRequestError(503, "Supabase is not configured."), words, {online: true}).message, words.errorServer);
        assert.equal(userFacingError(new AppRequestError(401, "Authentication required."), words, {online: true}).kind, "server");
        assert.equal(userFacingError({error: "insufficient_credits"}, words, {online: true, known: {insufficient_credits: "Not enough Credits."}}).message, "Not enough Credits.");
        assert.equal(isHumanMessage("Current password is incorrect."), true);
        assert.equal(isHumanMessage("JWT expired"), false);
    } finally {
        console.warn = quiet;
    }
});

// MARK: - People are never public

test("a Homo sapiens item is never public: by scientific name, any case, or the human slug", () => {
    assert.equal(isHomoSapiens({scientificName: "Homo sapiens"}), true);
    assert.equal(isHomoSapiens({scientificName: "HOMO SAPIENS sapiens"}), true);
    assert.equal(isHomoSapiens({slug: "human"}), true);
    assert.equal(isHomoSapiens({identityKey: "homo_sapiens"}), true);
    assert.equal(isHomoSapiens({animalName: "Human"}), true);
    assert.equal(isHomoSapiens({scientificName: "Homo naledi"}), false);
    assert.equal(isHomoSapiens({slug: "humpback-whale", animalName: "Humpback Whale"}), false);
    assert.equal(rowIsHomoSapiens({scientific_name: "Homo sapiens", animal_name: "Person"}), true);
    assert.equal(rowIsHomoSapiens({scientific_name: "Vulpes vulpes", animal_name: "Red Fox"}), false);
});

// MARK: - Dictation

test("dictated words join what was in the field; the strip's clock reads at a glance", () => {
    assert.equal(dictatedText("", "  should I   take it "), "should I take it");
    assert.equal(dictatedText("My boss", "asked me again"), "My boss asked me again");
    assert.equal(dictatedText("My boss ", "asked"), "My boss asked");
    assert.equal(dictatedText("Kept", "   "), "Kept");
    assert.equal(dictationClock(7.9), "0:07");
    assert.equal(dictationClock(65), "1:05");
});
