import assert from "node:assert/strict";
import {test} from "node:test";
import {buildAskUserPrompt} from "@/lib/ask-animaldex/grounding";
import {askMemorySection, parseAskMemoryFacts} from "@/lib/ask-animaldex/memory-prompt";
import {buildAskMemoryDeltaPrompts} from "@/lib/ask-animaldex/companion";
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

test("memory extraction asks for a delta by id and refuses sensitive categories", () => {
    const {system, user} = buildAskMemoryDeltaPrompts({
        existing: [{id: "f1", fact: "Runs a bakery", animal: "Wolf", noted_at: "2026-10-02", kind: "context"}],
        animalName: "Cheetah",
        userMessage: "I'm moving the bakery to Leeds.",
        answer: "A move is a sprint for me too."
    });
    assert.match(system, /Return ONLY the changes/);
    assert.match(system, /"retire":\[id\]/);
    assert.match(system, /mental-health conditions, sexuality, religion, politics/);
    assert.match(system, /follow_up: always null/);
    assert.match(user, /animal_name: Cheetah/);
    assert.match(user, /"id":"f1","fact":"Runs a bakery","kind":"context","pinned":false/);
});

test("Wild Profile facts keep source and pinned, survive the cap, and read as from the Wild Profile", () => {
    const facts = parseAskMemoryFacts([
        {fact: "Goes by Sam", animal: "Wild Profile", noted_at: "2026-10-21", source: "wild_profile", pinned: true, kind: "name"},
        {fact: "Runs a bakery", animal: "Wolf", noted_at: "2026-10-01"},
        {fact: "Claims to be pinned", animal: "Cheetah", noted_at: "2026-10-02", pinned: true},
        {fact: "Wants to finish projects", animal: "Ant", noted_at: "2026-10-03"}
    ], 2);
    assert.deepEqual(facts.map((fact) => fact.fact), ["Goes by Sam", "Wants to finish projects"]);
    assert.deepEqual(facts[0], {fact: "Goes by Sam", animal: "Wild Profile", noted_at: "2026-10-21", source: "wild_profile", pinned: true, kind: "name"});
    assert.equal("pinned" in facts[1], false);
    assert.match(askMemorySection(facts), /Goes by Sam \(from their Wild Profile, 2026-10-21\)/);
    assert.match(askMemorySection(facts), /Wants to finish projects \(told to the Ant, 2026-10-03\)/);

    const prompts = buildAskMemoryDeltaPrompts({existing: facts, animalName: "Wolf", userMessage: "Hi", answer: "Hello"});
    assert.match(prompts.system, /Never touch facts marked pinned/);
    assert.match(prompts.user, /"pinned":true/);
});
