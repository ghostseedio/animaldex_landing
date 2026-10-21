import assert from "node:assert/strict";
import {test} from "node:test";
import {buildAskUserPrompt} from "@/lib/ask-animaldex/grounding";
import {
    askMemorySection,
    buildAskMemoryExtractionPrompts,
    parseAskMemoryFacts
} from "@/lib/ask-animaldex/memory-prompt";
import {buildAskStreamingSystemPrompt, buildAskSystemPrompt} from "@/lib/ask-animaldex/prompt";

const species = {
    slug: "weaver-ant",
    name: "Weaver Ant",
    scientificName: "Oecophylla smaragdina",
    category: null,
    summary: "Ants that weave leaves into nests.",
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
    power: null,
    systemDynamics: null,
    relatedSpecies: [],
    relatedLocations: []
};

test("memory facts are bounded, deduped and newest-last", () => {
    const facts = parseAskMemoryFacts([
        {fact: "Runs a bakery", animal: "Cheetah", noted_at: "2026-10-01"},
        {fact: "runs a bakery", animal: "Wolf", noted_at: "2026-10-02"},
        {fact: "x".repeat(400), animal: "Koala"},
        {fact: "Wants to finish projects", animal: "Ant"}
    ], 2);
    assert.equal(facts.length, 2);
    assert.equal(facts[0].fact.length, 160);
    assert.equal(facts[1].fact, "Wants to finish projects");
    assert.deepEqual(parseAskMemoryFacts(null), []);
});

test("a signed-in reader's prompt tells the animal what it remembers; a signed-out one says nothing", () => {
    const remembered = buildAskUserPrompt({
        userQuestion: "I can't get my mornings going.",
        packet: {
            scope: "species",
            species,
            candidateSpecies: [],
            pageContext: null,
            hasReaderPhoto: false,
            wildProfile: {summary: null},
            memory: [{fact: "Runs a bakery", animal: "Wolf", noted_at: "2026-10-02"}]
        }
    });
    assert.match(remembered, /what_you_remember_about_them/);
    assert.match(remembered, /Runs a bakery \(told to the Wolf, 2026-10-02\)/);

    const firstTime = buildAskUserPrompt({
        userQuestion: "Hi",
        packet: {scope: "species", species, candidateSpecies: [], pageContext: null, hasReaderPhoto: false, wildProfile: {summary: null}}
    });
    assert.match(firstTime, /what_you_remember_about_them: nothing yet/);

    const signedOut = buildAskUserPrompt({
        userQuestion: "Hi",
        packet: {scope: "species", species, candidateSpecies: [], pageContext: null, hasReaderPhoto: false}
    });
    assert.doesNotMatch(signedOut, /what_you_remember/);
    assert.equal(askMemorySection([]).includes("nothing yet"), true);
});

test("only the animal's own voice carries the memory rules", () => {
    for (const build of [buildAskSystemPrompt, buildAskStreamingSystemPrompt]) {
        assert.match(build({scope: "species", supportedVisuals: []}), /Animals share what they learn about a person/);
        assert.doesNotMatch(build({scope: "general", supportedVisuals: []}), /what_you_remember_about_them/);
    }
});

test("memory extraction asks for a merged list and refuses sensitive categories", () => {
    const {system, user} = buildAskMemoryExtractionPrompts({
        existing: [{fact: "Runs a bakery", animal: "Wolf", noted_at: "2026-10-02"}],
        animalName: "Cheetah",
        userMessage: "I'm moving the bakery to Leeds.",
        answer: "A move is a sprint for me too."
    });
    assert.match(system, /"facts":\[/);
    assert.match(system, /mental-health conditions, sexuality, religion, politics/);
    assert.match(system, /corrects, contradicts or supersedes/);
    assert.match(user, /animal_name: Cheetah/);
    assert.match(user, /Runs a bakery/);
});
