import assert from "node:assert/strict";
import test from "node:test";

import {
    askPersonaDials,
    askPersonaFrame,
    askPersonaLines,
    askPersonaStatsFrom,
    askRhythmFromDynamics,
    capAskEffort,
    chooseAskChatVoiceKey,
    parseAskPersonaFrame,
    parseAskStatQuantiles
} from "@/lib/ask-animaldex/persona";
import {
    askHistoryAsTurns,
    fallbackAskGreeting,
    OPENED_CHAT_TURN,
    type AskCompanionVoice
} from "@/lib/ask-animaldex/companion";
import {
    buildAskGreetingUserPrompt,
    buildAskUserPrompt,
    type AskGroundingPacket,
    type AskSpeciesGrounding
} from "@/lib/ask-animaldex/grounding";
import {buildAskStreamingSystemPrompt, buildAskSystemPrompt} from "@/lib/ask-animaldex/prompt";

// The same animals the apps' animal-persona.test.ts uses, so both copies are
// held to the same numbers.
const elephant = {dominance: 70, speed: 30, size: 95, intelligence: 60, rarity: 70};
const ant = {dominance: 10, speed: 40, size: 1, intelligence: 8, rarity: 5};

test("stats become dials on the live catalogue's percentiles", () => {
    const big = askPersonaDials({stats: elephant, dynamics: null, voice: null});
    assert.equal(big.intellect, "brilliant");
    assert.equal(big.presence, "commanding");
    assert.equal(big.build, "huge");
    assert.equal(big.effort, "high");
    const small = askPersonaDials({stats: ant, dynamics: null, voice: null});
    assert.equal(small.intellect, "instinct");
    assert.equal(small.presence, "yielding");
    assert.equal(small.build, "tiny");
    assert.equal(small.rarity, "common");
    assert.equal(small.effort, "low");
    // Big animals say less.
    assert.ok(big.wordBudget < small.wordBudget);
    assert.equal(big.wordBudget, 55);
    // On the size curve, not a step: a size-1 ant sits just under the top.
    assert.equal(small.wordBudget, 84);
    // A median animal is neither, and a species with no stats is the median.
    const median = askPersonaDials({stats: {dominance: 30, speed: 38, size: 16, intelligence: 32, rarity: 45}, dynamics: null, voice: null});
    assert.equal(median.intellect, "practical");
    assert.equal(median.presence, "steady");
    assert.equal(median.effort, "low");
    assert.deepEqual(askPersonaDials({stats: null, dynamics: null, voice: null}), median);
});

test("the bands cut where the apps cut them", () => {
    const at = (intelligence: number) => askPersonaDials({stats: {...ant, intelligence}, dynamics: null, voice: null});
    assert.equal(at(14).intellect, "instinct");
    assert.equal(at(15).intellect, "practical");
    assert.equal(at(42).intellect, "sharp");
    assert.equal(at(42).effort, "medium");
    assert.equal(at(60).intellect, "brilliant");
    const sized = (size: number) => askPersonaDials({stats: {...ant, size}, dynamics: null, voice: null}).build;
    assert.deepEqual([5, 6, 22, 46, 70].map(sized), ["tiny", "small", "medium", "large", "huge"]);
    const rare = (rarity: number) => askPersonaDials({stats: {...ant, rarity}, dynamics: null, voice: null}).rarity;
    assert.deepEqual([21, 22, 64, 78].map(rare), ["common", "uncommon", "rare", "legendary"]);
});

test("the card's pace sets typing speed and the speed stat nudges it", () => {
    const slow = askPersonaDials({stats: {...ant, speed: 5}, dynamics: null, voice: {pace: "slow"}});
    const quick = askPersonaDials({stats: {...ant, speed: 90}, dynamics: null, voice: {pace: "quick"}});
    // Faster than speech since 2026-10-23, each animal still at its own tempo.
    assert.equal(slow.typingCharsPerSecond, 15.5);
    assert.equal(quick.typingCharsPerSecond, 27.5);
    // No card: the speed stat alone picks the pace.
    assert.equal(askPersonaDials({stats: {...ant, speed: 40}, dynamics: null, voice: null}).typingCharsPerSecond, 21);
    assert.equal(askPersonaDials({stats: {...ant, speed: 60}, dynamics: null, voice: null}).typingCharsPerSecond, 27.5);
});

test("System Dynamics mode frequencies become a rhythm", () => {
    assert.equal(askRhythmFromDynamics({modes: [{frequency: "LOW"}]}), "calm");
    assert.equal(askRhythmFromDynamics({modes: [{frequency: "HIGH"}]}), "bursty");
    assert.equal(askRhythmFromDynamics({modes: [{frequency: "LOW"}, {frequency: "HIGH"}]}), "switching");
    assert.equal(askRhythmFromDynamics({baseline: "MID", triggered: "HIGH", modes: []}), "switching");
    assert.equal(askRhythmFromDynamics({modes: [{frequency: "LOW"}, {frequency: "MID"}]}), "even");
    assert.equal(askRhythmFromDynamics({modes: [{frequency: null}]}), "even");
    assert.equal(askRhythmFromDynamics(null), "even");
});

test("persona lines say how big, how sharp and how in-charge the animal is", () => {
    const big = askPersonaLines(askPersonaDials({stats: elephant, dynamics: {modes: [{frequency: "LOW"}]}, voice: null})).join("\n");
    assert.ok(big.includes("you speak sparingly"));
    assert.ok(big.includes("you stay in charge of this conversation"));
    assert.ok(big.includes("one of the sharpest animals there is"));
    assert.ok(big.includes("Nothing is urgent to you"));
    // No word counts: the moment sets the length, size the manner.
    assert.ok(big.includes("Length: like texting a friend, never a quota."));
    assert.equal(/about \d+ words/.test(big), false);
    const small = askPersonaLines(askPersonaDials({stats: ant, dynamics: null, voice: null})).join("\n");
    assert.ok(small.includes("instinct and senses"));
    assert.ok(small.includes("let them lead"));
    assert.ok(small.includes("tiny and busy"));
    assert.ok(small.includes("familiar, unfussy"));
    assert.ok(small.includes("Length: like texting a friend"));
    const group = askPersonaLines(askPersonaDials({stats: elephant, dynamics: null, voice: null}), {group: true}).join("\n");
    assert.ok(group.includes("In a group you set the direction"));
    assert.equal(group.includes("Length:"), false);
    // Every line is a bullet in the character section.
    assert.ok(askPersonaLines(askPersonaDials({stats: ant, dynamics: null, voice: null})).every((line) => line.startsWith("- ")));
});

test("the live catalogue's spread moves the bands, and a broken grid falls back to the measured cuts", () => {
    // Every value at 0..100 in step: the cuts land on the shares themselves.
    const linear = Array.from({length: 101}, (_, index) => index);
    const quantiles = {intelligence: linear, dominance: linear, speed: linear, rarity: linear};
    const at = (intelligence: number) => askPersonaDials({stats: {...ant, intelligence}, dynamics: null, voice: null, quantiles}).intellect;
    assert.equal(at(22), "instinct");
    assert.equal(at(23), "practical");
    assert.equal(at(79), "sharp");
    assert.equal(at(95), "brilliant");
    assert.equal(parseAskStatQuantiles({intelligence: linear, dominance: linear, speed: linear, rarity: linear.slice(1)}), null);
    assert.deepEqual(parseAskStatQuantiles({intelligence: linear, dominance: linear, speed: linear, rarity: linear}), quantiles);
    const broken = askPersonaDials({stats: {...ant, intelligence: 15}, dynamics: null, voice: null, quantiles: null});
    assert.equal(broken.intellect, "practical");
});

test("voices follow taxonomy, names and size, as the apps choose them", () => {
    const pick = (animalName: string, taxonomy: Record<string, string> | null, size = 20, speed = 40) =>
        chooseAskChatVoiceKey({animalName, taxonomy, stats: {dominance: 30, speed, size, intelligence: 30, rarity: 40}});
    assert.equal(pick("Giant Oceanic Manta Ray", {class_name: "Elasmobranchii", order_name: "Myliobatiformes"}), "ocean_glider");
    assert.equal(pick("Lion", {class_name: "Mammalia", order_name: "Carnivora", family_name: "Felidae"}, 60), "apex_big_cat");
    assert.equal(pick("Gray Wolf", {class_name: "Mammalia", order_name: "Carnivora", family_name: "Canidae"}), "pack_canine");
    assert.equal(pick("Red Fox", {class_name: "Mammalia", order_name: "Carnivora", family_name: "Canidae"}), "trickster");
    assert.equal(pick("Koala", {class_name: "Mammalia", order_name: "Diprotodontia", family_name: "Phascolarctidae"}), "sleepy");
    assert.equal(pick("Barn Owl", {class_name: "Aves", order_name: "Strigiformes"}), "night_owl");
    assert.equal(pick("King Cobra", {class_name: "Squamata", family_name: "Elapidae"}), "serpent");
    assert.equal(pick("Clownfish", {order_name: "Perciformes"}), "playful_marine");
    assert.notEqual(pick("Gray Wolf", null), "ocean_glider");
    assert.equal(pick("Mystery Animal", null, 90), "gentle_giant");
});

test("effort is capped by configuration, medium by default", () => {
    assert.equal(capAskEffort("high", "medium"), "medium");
    assert.equal(capAskEffort("low", "high"), "low");
    assert.equal(capAskEffort("high", null), "high");
    assert.equal(capAskEffort("high", "nonsense"), "high");
    assert.equal(capAskEffort("medium", " LOW "), "low");
});

test("stats are read whole or not at all", () => {
    assert.deepEqual(askPersonaStatsFrom({dominance: 70.4, speed: "30", size: 140, intelligence: -3, rarity: 70}), {
        dominance: 70, speed: 30, size: 100, intelligence: 0, rarity: 70
    });
    assert.equal(askPersonaStatsFrom({dominance: 70, speed: 30, size: 95, intelligence: 60}), null);
    assert.equal(askPersonaStatsFrom(null), null);
    assert.equal(askPersonaStatsFrom([1, 2, 3]), null);
});

test("the persona frame is the apps' frame, and the client drops a malformed one", () => {
    const dials = askPersonaDials({stats: elephant, dynamics: null, voice: {pace: "slow"}});
    const frame = askPersonaFrame({pace: "slow", temperament: [{trait: "unhurried"}, {trait: "protective"}, {trait: "old"}]}, dials);
    assert.deepEqual(frame, {
        pace: "slow",
        typing_cps: 17,
        build: "huge",
        presence: "commanding",
        intellect: "brilliant",
        tagline: "unhurried · protective"
    });
    assert.deepEqual(parseAskPersonaFrame(JSON.parse(JSON.stringify(frame))), frame);
    assert.equal(parseAskPersonaFrame({pace: "slow"}), null);
    assert.equal(parseAskPersonaFrame("fast"), null);
    assert.equal(parseAskPersonaFrame({typing_cps: 900, pace: "warp"})?.typing_cps, 30);
    assert.equal(parseAskPersonaFrame({typing_cps: 1, pace: "slow"})?.typing_cps, 6);
    assert.equal(parseAskPersonaFrame({typing_cps: 12, pace: "warp"})?.pace, "measured");
});

// MARK: - The prompt the dials feed

const mantaVoice: AskCompanionVoice = {
    temperament: [{trait: "trusts the water"}, {trait: "wide and receptive"}],
    pace: "slow",
    stance: "opens the view out before closing in",
    advice_style: "Move gently through a wide space and let what's useful come to you.",
    first_question: "If you trusted the flow a little more, what might come to you?",
    blind_spot: "Taking in everything without choosing.",
    speech_habits: ["long, calm, open sentences", "images of open ocean"],
    origin: "card"
};

const manta: AskSpeciesGrounding = {
    slug: "giant-oceanic-manta-ray",
    speciesProfileId: "sp-manta",
    name: "Giant Oceanic Manta Ray",
    scientificName: "Mobula birostris",
    category: null,
    summary: null,
    identification: ["Huge wings"],
    habitat: "Open ocean and offshore islands.",
    nativeRange: null,
    diet: "Zooplankton.",
    predators: null,
    sleepPattern: null,
    lifespan: null,
    reproduction: null,
    sexDifference: null,
    interestingFacts: [],
    behaviorTraits: [],
    spottingTips: [],
    power: {
        principleName: "Open Grace",
        principleExpression: null,
        coreLesson: "Glide wide.",
        shortMotto: null,
        corePattern: null,
        biologicalBasis: null,
        applicationExample: null,
        behavioralEvidence: [],
        powerContinuum: null,
        embodimentPractices: [],
        reflectionQuestions: [],
        relatedPowers: []
    },
    systemDynamics: {
        archetypeName: "Wide Filter",
        mechanism: null,
        frequency: {primary: "LOW", behavior: "Single", modes: [{name: "Gliding", frequency: "LOW"}]},
        crossDomain: [{domain: "Business", entries: [{equivalent: "Broad scouting", reasoning: "Take in a lot, keep a little"}]}],
        failureModes: [{title: "Drifting", explanation: "Takes in everything, chooses nothing."}],
        transition: null
    },
    relatedSpecies: [],
    relatedLocations: []
};

const mantaStats = {dominance: 40, speed: 45, size: 80, intelligence: 50, rarity: 66};

function mantaPacket(overrides: Partial<AskGroundingPacket> = {}): AskGroundingPacket {
    return {
        scope: "species",
        species: manta,
        candidateSpecies: [],
        pageContext: {path: "/animals/giant-oceanic-manta-ray", title: "Giant Oceanic Manta Ray", kind: "species", summary: null},
        hasReaderPhoto: false,
        mode: "chat",
        stats: mantaStats,
        ...overrides
    };
}

test("the character leads the system prompt, and the record goes last for caching", () => {
    const persona = askPersonaDials({stats: mantaStats, dynamics: manta.systemDynamics?.frequency ?? null, voice: mantaVoice});
    for (const build of [buildAskStreamingSystemPrompt, buildAskSystemPrompt]) {
        const system = build({
            scope: "species",
            voice: mantaVoice,
            animalName: manta.name,
            species: manta,
            stats: mantaStats,
            persona,
            mode: "chat",
            supportedVisuals: []
        });
        const who = system.indexOf("Who you are");
        assert.ok(who > 0 && who < system.indexOf("How you talk:"), "who you are comes before how you talk");
        assert.ok(system.indexOf("You ARE the animal named in animal_name") < who);
        assert.ok(system.includes("where you live: open ocean and offshore islands"));
        assert.ok(system.includes("what you eat: zooplankton"));
        assert.ok(system.includes("What you are known for: Huge wings."));
        assert.ok(system.includes("You speak slowly"));
        assert.ok(system.includes("you are enormous"));
        assert.ok(system.includes("Your energy: low and even."));
        // The record is the last thing in the system prompt, stats included.
        assert.ok(system.lastIndexOf("animal_record —") > system.lastIndexOf("Follow-ups:"));
        assert.ok(system.lastIndexOf("available_content —") > system.lastIndexOf("animal_record —"));
        // Nothing after the content index: every rule is above the cached record.
        assert.ok(/- failure_modes \(1\): Drifting\n- field_guide_sections \(\d\): [a-z_; ]+$/.test(system));
        assert.ok(system.includes('"stats":{"dominance":40'));
        assert.ok(system.includes('"principle_name":"Open Grace"'));
        // Chat mode does not end every reply on an offer.
        assert.equal(system.includes("End with ONE short question"), false);
        assert.ok(system.includes("End the way a person would"));
        // The crisis exception rides with the role, as in the apps.
        assert.ok(system.includes("set the animal aside for that reply"));
    }

    const user = buildAskUserPrompt({
        userQuestion: "hi",
        packet: mantaPacket(),
        conversationHistory: [{role: "assistant", content: "Hello."}],
        recordInSystem: true,
        historyAsTurns: true
    });
    assert.equal(user.includes("animal_record —"), false);
    assert.equal(user.includes("available_content —"), false);
    assert.equal(user.includes("recent_conversation"), false);
    assert.ok(user.startsWith("user_message: hi"));
});

test("two animals' system prompts differ in the character, not just the name", () => {
    const cheetahVoice: AskCompanionVoice = {...mantaVoice, pace: "quick", speech_habits: ["very short, fast sentences"], stance: "picks the one sprint worth running"};
    const a = buildAskStreamingSystemPrompt({scope: "species", voice: mantaVoice, animalName: "Manta"});
    const b = buildAskStreamingSystemPrompt({scope: "species", voice: cheetahVoice, animalName: "Cheetah"});
    assert.ok(a.includes("You speak slowly") && !a.includes("You speak fast"));
    assert.ok(b.includes("You speak fast") && !b.includes("You speak slowly"));
    // The general assistant has no character at all.
    assert.equal(buildAskStreamingSystemPrompt({scope: "general", voice: mantaVoice, animalName: "Manta"}).includes("Who you are"), false);
});

test("follow-ups are written as the person, because a click sends them as the person", () => {
    const system = buildAskStreamingSystemPrompt({scope: "species", voice: mantaVoice, animalName: "Manta", mode: "chat"});
    assert.ok(system.includes("written AS THEM, to you —"));
    assert.ok(system.includes("Never in your own voice ('Let me show you…')"));
    assert.equal(system.includes("Write them as things you will do or show next"), false);
    const trial = buildAskStreamingSystemPrompt({scope: "species", voice: mantaVoice, animalName: "Manta", aboutTrial: true});
    assert.ok(trial.includes("'What should my proof show?'"));
    // A Trial thread keeps its offers on the Trial: no index in the record.
    const withRecord = buildAskStreamingSystemPrompt({scope: "species", voice: mantaVoice, animalName: "Manta", aboutTrial: true, species: manta});
    assert.ok(withRecord.includes("animal_record —"));
    assert.equal(withRecord.includes("available_content —"), false);
});

test("the greeting speaks first and offers replies in the person's voice", () => {
    const greeting = buildAskGreetingUserPrompt({packet: mantaPacket(), recordInSystem: true});
    assert.ok(greeting.includes("Speak first"));
    assert.ok(greeting.includes("under 45 words"));
    assert.ok(greeting.includes("Never 'I missed you'"));
    assert.ok(greeting.includes("written AS"));
    assert.equal(greeting.includes("user_message"), false);
    assert.equal(greeting.includes("animal_record —"), false);
    // Not on someone else's card: nothing about an owner is in the turn.
    assert.equal(greeting.includes("your_owner —"), false);
    // A hello is as short as this animal's: the words come from its size.
    assert.ok(buildAskGreetingUserPrompt({packet: mantaPacket({shortWords: 24}), recordInSystem: true}).includes("under 24 words"));
    // A signed-in reader's memory rides along, so a known reader is greeted as known.
    const known = buildAskGreetingUserPrompt({
        packet: mantaPacket({
            wildProfile: {summary: null},
            memory: [{fact: "Runs a dive shop", animal: "Giant Oceanic Manta Ray", noted_at: "2026-10-20", species_profile_id: "sp-manta"}],
            memorySpeciesProfileId: "sp-manta"
        }),
        recordInSystem: true
    });
    assert.ok(known.includes("Runs a dive shop (told to you, 2026-10-20)"));
    assert.throws(() => buildAskGreetingUserPrompt({packet: mantaPacket({scope: "general", species: null})}));
});

test("the fallback greeting is the card's own question, never a template", () => {
    const fallback = fallbackAskGreeting({animalName: "Giant Oceanic Manta Ray", voice: mantaVoice});
    assert.ok(fallback.text.startsWith("I'm the Giant Oceanic Manta Ray."));
    assert.ok(fallback.text.includes("trusted the flow"));
    assert.equal(fallback.followUps.length, 3);
    // A record-derived card has no authored question to ask.
    const derived = fallbackAskGreeting({animalName: "Gray Wolf", voice: {...mantaVoice, origin: "fallback"}});
    assert.equal(derived.text, "I'm the Gray Wolf. What's on your mind?");
});

test("history goes to the model as turns, opening with a stand-in when the animal spoke first", () => {
    const turns = askHistoryAsTurns([
        {role: "assistant", content: "Hello from the deep."},
        {role: "user", content: "Hi"},
        {role: "user", content: "Still there?"},
        {role: "assistant", content: "  "},
        {role: "assistant", content: "Always."}
    ]);
    assert.deepEqual(turns, [
        {role: "user", content: OPENED_CHAT_TURN},
        {role: "assistant", content: "Hello from the deep."},
        {role: "user", content: "Hi\n\nStill there?"},
        {role: "assistant", content: "Always."}
    ]);
    assert.deepEqual(askHistoryAsTurns([]), []);
});
