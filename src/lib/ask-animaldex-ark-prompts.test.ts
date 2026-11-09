import assert from "node:assert/strict";
import test from "node:test";

// Life Sim's prompt side on the web's own chat (AnimalDex
// docs/life-sim/CONTRACT.md, sections 4 to 7), written to the contract ahead
// of the apps' edge lane. The existing parity test
// (`ask-animaldex-your-step-parity.test.ts`) still holds every older line to
// the apps' words; this one holds the new lines to the contract.
import {
    ANIMAL_VISITOR_ARK_PRIVACY_RULES,
    ARK_MEMORY_MIN_CHARACTERS,
    ARK_REVISION_MENTION_RULE,
    MEMORY_MIN_CHARACTERS,
    arkRecentStepsSection,
    arkRevisionPromptLine,
    buildStepSimTagPrompts,
    memoryMinCharacters,
    parseArkMemoryOutcomes,
    parseStepSimTags,
    type ArkRecentStep
} from "@/lib/ask-animaldex/ark-prompts";
import {buildAskMemoryDeltaPrompts} from "@/lib/ask-animaldex/companion";
import {companionPromptLines, parseCompanionRoster, parseCompanionState} from "@/lib/ask-animaldex/companion-focus";
import {buildAskStreamingSystemPrompt} from "@/lib/ask-animaldex/prompt";

const STEP = "00000000-0000-4000-8000-000000000001";
const OTHER = "00000000-0000-4000-8000-000000000002";
const steps: ArkRecentStep[] = [
    {id: STEP, step: "Buy the candle materials now", animal: "Komodo dragon", kind: "lesson"},
    {id: OTHER, step: "Ask your sister to lunch", animal: "Javan rhino", kind: "earned"}
];

test("section 6: the memory call gets every animal's recent steps and asks for step_outcomes and focus_sensitive", () => {
    const {system, user} = buildAskMemoryDeltaPrompts({
        existing: [],
        animalName: "Javan rhino",
        userMessage: "sold out!!",
        answer: "That is a fine weekend.",
        recentSteps: steps
    });
    // The schema stays one JSON object: follow_up, then the Ark's two keys, then the brace.
    assert.match(system, /"follow_up":\{"topic":string,"revisit_after_days":number\} \| null,\n "step_outcomes":\[\{"step_id":string,"direction":"better\|worse\|none","statement":string\}\], "focus_sensitive":boolean\}/);
    assert.match(system, /from any of their animals, not just this one/);
    assert.match(system, /"I might get them cheaper"\) is not an outcome/);
    assert.match(system, /When unsure, true\./);
    assert.match(user, /recent_steps — steps they took on in the last 30 days, from every animal:\n\[\{"id":"00000000-0000-4000-8000-000000000001","step":"Buy the candle materials now","animal":"Komodo dragon","kind":"lesson"\}/);
    // The older lines are untouched, and with no steps the section says so.
    assert.match(system, /Return ONLY the changes/);
    assert.match(buildAskMemoryDeltaPrompts({existing: [], animalName: "Wolf", userMessage: "Hello there friend, how are you", answer: "Fine"}).user, /from every animal:\n\(none\)/);
    assert.equal(arkRecentStepsSection([]), "recent_steps — steps they took on in the last 30 days, from every animal:\n(none)");
});

test("section 6: the 20-character floor drops to 3 while they have a revealed step", () => {
    assert.equal(MEMORY_MIN_CHARACTERS, 20);
    assert.equal(ARK_MEMORY_MIN_CHARACTERS, 3);
    assert.equal(memoryMinCharacters([]), 20);
    assert.equal(memoryMinCharacters(steps), 3);
});

test("section 6: only clear better/worse outcomes on steps that were sent are kept, each step once", () => {
    const read = parseArkMemoryOutcomes({
        step_outcomes: [
            {step_id: STEP.toUpperCase(), direction: "better", statement: "  I actually got them for £400.  "},
            {step_id: STEP, direction: "worse", statement: "again"},
            {step_id: OTHER, direction: "none", statement: "maybe"},
            {step_id: "00000000-0000-4000-8000-000000000099", direction: "worse", statement: "made up"},
            {step_id: OTHER, direction: "worse", statement: ""},
            {step_id: OTHER, direction: "worse", statement: "x".repeat(400)}
        ],
        focus_sensitive: true
    }, steps);
    assert.deepEqual(read.stepOutcomes, [
        {step_id: STEP, direction: "better", statement: "I actually got them for £400."},
        {step_id: OTHER, direction: "worse", statement: "x".repeat(200)}
    ]);
    assert.equal(read.focusSensitive, true);
    assert.deepEqual(parseArkMemoryOutcomes(null, steps), {stepOutcomes: [], focusSensitive: false});
    assert.equal(parseArkMemoryOutcomes({focus_sensitive: "yes"}, steps).focusSensitive, false);
});

test("section 4: unmentioned revisions go into the next reply's companion lines, and nothing changes without them", () => {
    const state = parseCompanionState({focus: {id: "f", focus: "Candle business"}, open_trial: null, your_trials_done: 1});
    const roster = parseCompanionRoster([]);
    const without = companionPromptLines({state, roster, powerEarned: false});
    assert.deepEqual(companionPromptLines({state, roster, powerEarned: false, arkRevisions: []}), without);
    const lines = companionPromptLines({
        state,
        roster,
        powerEarned: false,
        arkRevisions: [{id: "r1", step: "Buy the candle materials now", animal: "Komodo dragon", direction: "better", statement: "I got them for £400"}]
    });
    assert.deepEqual(lines.slice(0, without.length), without);
    assert.equal(lines.length, without.length + 1);
    assert.equal(lines[lines.length - 1], `${ARK_REVISION_MENTION_RULE}\n[{"step":"Buy the candle materials now","animal":"Komodo dragon","went":"better","they_said":"I got them for £400"}]`);
    assert.match(ARK_REVISION_MENTION_RULE, /Never a number, a score or a stat name/);
    assert.equal(arkRevisionPromptLine([]), "");
});

test("section 7: a visitor's animal never mentions the owner's diary, stats or problems; the owner's chat has no such line", () => {
    const visitor = buildAskStreamingSystemPrompt({scope: "species", mode: "auto", animalName: "African Lion", speakingTo: "visitor"});
    assert.equal(visitor.includes(ANIMAL_VISITOR_ARK_PRIVACY_RULES.join("\n")), true);
    const relayed = buildAskStreamingSystemPrompt({scope: "species", mode: "auto", animalName: "African Lion", speakingTo: "visitor", visitorRelay: true});
    assert.equal(relayed.includes(ANIMAL_VISITOR_ARK_PRIVACY_RULES.join("\n")), true);
    const owner = buildAskStreamingSystemPrompt({scope: "species", mode: "auto", animalName: "African Lion", supportedVisuals: ["card"], companionLoop: {offersSteps: true}});
    assert.equal(owner.includes(ANIMAL_VISITOR_ARK_PRIVACY_RULES[0]), false);
    assert.match(ANIMAL_VISITOR_ARK_PRIVACY_RULES.join(" "), /your_owner\.public_diary/);
});

test("section 5: the tag call asks for size, costs, sensitive, story and reaction, and reads its answer tolerantly", () => {
    const {system, user} = buildStepSimTagPrompts({
        animalName: "Komodo dragon",
        power: "Patient Venom",
        problem: "Should I spend £600 on materials for my candle business?",
        step: "Buy the materials today",
        way: {costs: "the money up front", fitsWhen: "you have orders waiting"}
    });
    assert.match(system, /"size":"small\|medium\|large","costs":\["money"\|"relationships"\|"energy"\|"reputation"\],"sensitive":boolean/);
    assert.match(system, /When unsure, true/);
    assert.match(system, /you never write a number for a stat/);
    assert.match(user, /^animal: Komodo dragon\nits_power: Patient Venom\nproblem: Should I spend £600/);
    assert.match(user, /way_costs: the money up front\nway_fits_when: you have orders waiting$/);
    assert.match(buildStepSimTagPrompts({animalName: "Fox", problem: null, step: "Walk", teen: true}).system, /13 to 17/);

    assert.deepEqual(parseStepSimTags({
        size: "LARGE",
        costs: ["money", "money", "charisma", "energy"],
        sensitive: false,
        story: ["You buy it all.", "", "The shelves fill.", "One too many."],
        reaction: "Bold."
    }), {size: "large", costs: ["money", "energy"], sensitive: false, story: ["You buy it all.", "The shelves fill.", "One too many."], reaction: "Bold."});
    // Untagged size is medium; anything but a plain false is sensitive, and then no story.
    assert.deepEqual(parseStepSimTags({size: "?", costs: [], story: ["x"], reaction: "y"}), {size: "medium", costs: [], sensitive: true, story: [], reaction: ""});
    assert.equal(parseStepSimTags(null), null);
    assert.equal(parseStepSimTags([1]), null);
});
