import assert from "node:assert/strict";
import test from "node:test";
import {CONTENT_POLICY_RULES, passesContentPolicy, policyProblems} from "./content-policy";

// What generated public content never says: other AI products by name,
// clinical words, "life advice" framing, psychological labels.

test("other AI products are caught; a star sign, a first name and real animals are not", () => {
    assert.deepEqual(policyProblems("ChatGPT says start small. The lion says roar once."), ['names another AI product: "chatgpt"']);
    assert.equal(passesContentPolicy("What Google Gemini gets wrong about lions"), false);
    assert.equal(passesContentPolicy("Ask Claude AI or a lion"), false);
    assert.equal(passesContentPolicy("Copilot vs the cheetah"), false);
    assert.equal(passesContentPolicy("What a Gemini and a lion have in common"), true);
    assert.equal(passesContentPolicy("Claude Monet painted water lilies; frogs sat on them"), true);
    assert.equal(passesContentPolicy("Llamas spit when they are annoyed"), true);
    assert.equal(passesContentPolicy("The usual answer vs the lion's take"), true);
});

test("clinical words, life-advice framing and labels are caught", () => {
    assert.deepEqual(policyProblems("Animal therapy for anxiety"), ['clinical word: "therapy"', 'clinical word: "anxiety"']);
    assert.equal(passesContentPolicy("How octopuses heal their arms"), false);
    assert.equal(passesContentPolicy("Life advice from a crow"), false);
    assert.equal(passesContentPolicy("Self-improvement tips from wolves"), false);
    assert.equal(passesContentPolicy("For every overthinker: the heron's patience"), false);
    assert.equal(passesContentPolicy("Overthinking? Ask a heron"), false);
    assert.equal(passesContentPolicy("Your INFJ animal"), false);
    assert.equal(passesContentPolicy("Introverts and owls"), false);
    assert.equal(passesContentPolicy("A people-pleaser's guide"), false);
});

test("ordinary idea and animal copy passes", () => {
    for (const text of [
        "Should you start a podcast? A lion would count the room first.",
        "The fastest bird on Earth knows when to stop",
        "Poison dart frogs are toxic to touch",
        "Bees vote on a new home with a dance",
        "Moving abroad, the hermit crab way: queue for a better shell"
    ]) assert.equal(passesContentPolicy(text), true, text);
});

test("the prompt rule names each thing the check enforces", () => {
    assert.match(CONTENT_POLICY_RULES, /Never name another AI product/);
    assert.match(CONTENT_POLICY_RULES, /the usual answer/);
    assert.match(CONTENT_POLICY_RULES, /therapy, anxiety/);
    assert.match(CONTENT_POLICY_RULES, /"life advice"/);
    assert.match(CONTENT_POLICY_RULES, /overthinker/);
});
