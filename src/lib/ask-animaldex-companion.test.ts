import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {join} from "node:path";
import {test} from "node:test";
import {
    dedupeCurrentQuestion,
    fallbackAskCompanionVoice,
    parseAskMemoryDelta,
    usableAskCompanionVoice
} from "@/lib/ask-animaldex/companion";
import {buildAskUserPrompt, type AskSpeciesGrounding} from "@/lib/ask-animaldex/grounding";
import {askMemorySection, parseAskMemoryFacts} from "@/lib/ask-animaldex/memory-prompt";
import {buildAskStreamingSystemPrompt, buildAskSystemPrompt} from "@/lib/ask-animaldex/prompt";

const repoRoot = process.cwd();
const readRepo = (...parts: string[]) => readFileSync(join(repoRoot, ...parts), "utf8");

const species: AskSpeciesGrounding = {
    slug: "cheetah",
    speciesProfileId: "sp-cheetah",
    name: "Cheetah",
    scientificName: "Acinonyx jubatus",
    category: null,
    summary: null,
    identification: [],
    habitat: null,
    nativeRange: null,
    diet: null,
    predators: null,
    sleepPattern: null,
    lifespan: null,
    reproduction: null,
    sexDifference: null,
    interestingFacts: [],
    behaviorTraits: [],
    spottingTips: [],
    power: {
        principleName: "Burst Commitment",
        principleExpression: null,
        coreLesson: "Wait for the clean chance, then commit fully.",
        shortMotto: "All in, briefly",
        corePattern: null,
        biologicalBasis: null,
        applicationExample: null,
        behavioralEvidence: [],
        powerContinuum: {deficientExpression: "never runs", balancedExpression: "runs when it counts", excessExpression: "sprints at everything and burns out"},
        embodimentPractices: [],
        reflectionQuestions: [],
        relatedPowers: []
    },
    systemDynamics: null,
    relatedSpecies: [],
    relatedLocations: []
};

const card = {
    temperament: [{trait: "patient until it isn't", source: "sd.modes"}],
    pace: "quick",
    stance: "sizes up the gap before anything else",
    advice_style: "Find the one clean opening and spend everything on it.",
    first_question: "How far away is the thing you want?",
    blind_spot: "can't keep going for long",
    speech_habits: ["counts in seconds"]
};

test("a trailing copy of the question is dropped from the history, and nothing else", () => {
    const history = [
        {role: "user" as const, content: "Hi"},
        {role: "assistant" as const, content: "Hello"},
        {role: "user" as const, content: "  Should I   quit? "}
    ];
    assert.equal(dedupeCurrentQuestion(history, "should i quit?").length, 2);
    assert.equal(dedupeCurrentQuestion(history, "something else").length, 3);
    assert.equal(dedupeCurrentQuestion(history.slice(0, 2), "Hello").length, 2);
});

test("a voice card is used only while it was written for the current Power", () => {
    assert.equal(usableAskCompanionVoice({voice: card, power_name: "Burst Commitment", review_status: "generated"}, "Burst Commitment")?.origin, "card");
    assert.equal(usableAskCompanionVoice({voice: card, power_name: "Old Power", review_status: "reviewed"}, "Burst Commitment"), null);
    assert.equal(usableAskCompanionVoice({voice: card, power_name: "Burst Commitment", review_status: "rejected"}, "Burst Commitment"), null);
    assert.equal(usableAskCompanionVoice({voice: {pace: "quick"}, power_name: "Burst Commitment"}, "Burst Commitment"), null);
    assert.equal(usableAskCompanionVoice(null, "Burst Commitment"), null);
});

test("the fallback voice is derived from the record, as the apps derive it", () => {
    const voice = fallbackAskCompanionVoice({species, qualities: ["Focus", "Timing"], speed: 95});
    assert.equal(voice.origin, "fallback");
    assert.equal(voice.pace, "quick");
    assert.deepEqual(voice.temperament.map((item) => item.trait), ['lives by "All in, briefly"', "focus", "timing"]);
    assert.equal(voice.stance, "looks at every problem through Burst Commitment");
    assert.equal(voice.advice_style, "Wait for the clean chance, then commit fully.");
    assert.equal(voice.blind_spot, "sprints at everything and burns out");
    assert.equal(fallbackAskCompanionVoice({species}).pace, "measured");
});

test("species scope carries the voice card, chat mode and the relationship rules; general scope does not", () => {
    const voice = usableAskCompanionVoice({voice: card, power_name: "Burst Commitment"}, "Burst Commitment");
    for (const build of [buildAskSystemPrompt, buildAskStreamingSystemPrompt]) {
        const prompt = build({scope: "species", supportedVisuals: [], voice, animalName: "Cheetah", mode: "chat"});
        assert.match(prompt, /Who you are — your manner as the Cheetah/);
        assert.match(prompt, /- Pace: quick\. Quick, short sentences/);
        assert.match(prompt, /The kind of question you ask first: "How far away is the thing you want\?"/);
        assert.match(prompt, /Conversation mode: chat\./);
        assert.match(prompt, /Never say you missed them, waited for them, worried about them, need them or love them\./);
        assert.match(prompt, /answer from failure_modes by name\./);
        assert.doesNotMatch(prompt, /failure_modes by title/);

        const trial = build({scope: "species", supportedVisuals: [], aboutTrial: true, voice, animalName: "Cheetah", mode: "training"});
        assert.doesNotMatch(trial, /Conversation mode: chat/);
        assert.match(trial, /Relationship — how you speak about you and them:/);

        const general = build({scope: "general", supportedVisuals: [], voice, animalName: "Cheetah", mode: "chat"});
        assert.doesNotMatch(general, /Who you are —|Conversation mode|Relationship —/);
    }
});

test("chat mode drops the advice-led closing; facts told to this animal come first, as told to you", () => {
    const facts = parseAskMemoryFacts([
        {id: "a", fact: "Runs a bakery", animal: "Wolf", noted_at: "2026-10-01", kind: "context", species_profile_id: "sp-wolf"},
        {id: "b", fact: "Wants to run a 5k", animal: "Cheetah", noted_at: "2026-10-02", kind: "goal", species_profile_id: "sp-cheetah"}
    ]);
    assert.equal(facts[1].id, "b");
    assert.equal(facts[1].species_profile_id, "sp-cheetah");
    const prompt = buildAskUserPrompt({
        userQuestion: "Morning",
        packet: {
            scope: "species",
            species,
            candidateSpecies: [],
            pageContext: null,
            hasReaderPhoto: false,
            wildProfile: {summary: null},
            memory: facts,
            memorySpeciesProfileId: "sp-cheetah",
            mode: "chat"
        }
    });
    assert.match(prompt, /Talk with them as yourself, in your own manner\./);
    assert.doesNotMatch(prompt, /End with one short question offering the next step\./);
    const section = askMemorySection(facts, "sp-cheetah");
    assert.ok(section.indexOf("Wants to run a 5k [goal] (told to you, 2026-10-02)") < section.indexOf("Runs a bakery [context] (told to the Wolf"));
});

test("the memory delta keeps only allowed facts and known ids", () => {
    const delta = parseAskMemoryDelta({
        add: [{fact: "Opens a second bakery in spring", kind: "goal"}, {fact: "Takes medication for anxiety", kind: "context"}, {fact: "ok"}],
        update: [{id: "a", fact: "Runs two bakeries now"}, {id: "zzz", fact: "Unknown fact id here"}],
        retire: ["a", "nope"],
        follow_up: {topic: "the bakery", revisit_after_days: 7}
    }, new Set(["a"]));
    assert.deepEqual(delta.add, [{fact: "Opens a second bakery in spring", kind: "goal"}]);
    assert.deepEqual(delta.update, [{id: "a", fact: "Runs two bakeries now"}]);
    assert.deepEqual(delta.retire, ["a"]);
});

test("the web meters through the v2 ledger with the service role and honours personalisation", () => {
    const request = readRepo("src/lib/ask-animaldex/request.ts");
    assert.match(request, /take_animal_chat_turn_v2/);
    assert.match(request, /refund_animal_chat_turn_v2/);
    assert.match(request, /p_allow_credits/);
    assert.match(request, /createSupabaseServiceClient/);
    const route = readRepo("src/app/api/ask/stream/route.ts");
    assert.match(route, /dedupeCurrentQuestion/);
    assert.match(route, /creditOverflow/);
    assert.match(route, /paid_with/);
    assert.match(route, /personalise/);
    const memory = readRepo("src/lib/ask-animaldex/memory.ts");
    assert.match(memory, /apply_animal_chat_memory_delta/);
    assert.match(memory, /animal_chat_settings_for/);
    assert.doesNotMatch(memory, /\.upsert\(/);
    const memoryRoute = readRepo("src/app/api/ask/memory/route.ts");
    assert.match(memoryRoute, /forget_animal_chat_memory_fact_by_id/);
    assert.match(memoryRoute, /correct_animal_chat_memory_fact/);
    const hook = readRepo("src/components/ask-animaldex/use-ask-thread.ts");
    assert.match(hook, /askConversationHistory\(current\)/);
    assert.match(hook, /requestId/);
    assert.match(hook, /payWithCredits/);
});
