import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {join} from "node:path";
import test from "node:test";
import {
    type AskCaptureGrounding,
    type AskGroundingPacket,
    type AskSpeciesGrounding,
    buildAskUserPrompt,
    mergeCaptureGrounding
} from "@/lib/ask-animaldex/grounding";
import {buildAskSystemPrompt} from "@/lib/ask-animaldex/prompt";
import {EMPTY_ASK_THINKING_HINTS, askThinkingPhases} from "@/lib/ask-animaldex/thinking-phases";
import {
    WILD_PROFILE_FOLLOW_UP,
    decorateFollowUps,
    isWildProfileFollowUp,
    wildProfileSummary
} from "@/lib/ask-animaldex/wild-profile";

const OFFERS = ["How do I practise this?", "What's the opposite pattern?", "What should I watch out for?"];

function species(overrides: Partial<AskSpeciesGrounding> = {}): AskSpeciesGrounding {
    return {
        slug: "red-fox",
        name: "Red Fox",
        scientificName: "Vulpes vulpes",
        category: "Mammal",
        summary: "A catalogue summary.",
        identification: ["Rust coat"],
        habitat: "Woodland edge",
        nativeRange: "Northern Hemisphere",
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
        relatedLocations: [],
        ...overrides
    };
}

const capture: AskCaptureGrounding = {
    name: "Red Fox",
    scientificName: "Vulpes vulpes",
    summary: "What this sighting's analysis said.",
    identification: ["White tail tip"],
    habitat: "Suburban garden",
    diet: "Voles, fruit and what bins offer.",
    predators: "Few once adult.",
    sleepPattern: "Mostly nocturnal.",
    lifespan: "Two to five years wild.",
    sexDifference: "Males slightly larger.",
    interestingFacts: ["Hears a vole under snow."],
    power: null
};

function packet(overrides: Partial<AskGroundingPacket> = {}): AskGroundingPacket {
    return {
        scope: "species",
        species: species(),
        candidateSpecies: [],
        pageContext: null,
        hasReaderPhoto: false,
        ...overrides
    };
}

test("the summary names each role by its title, in Origin, Apex, Active order", () => {
    assert.equal(
        wildProfileSummary({
            active: {title: "The Scout"},
            origin: {title: " The Patient  Builder "},
            apex: {title: "The Closer"}
        }),
        "Origin: The Patient Builder | Apex: The Closer | Active: The Scout"
    );
});

test("a role without a title falls back to its meaning, and an empty role is left out", () => {
    assert.equal(
        wildProfileSummary({
            origin: {what_this_says_about_you: "You build slowly."},
            apex: {title: ""},
            active: {current_life_signal: "You are scanning."}
        }),
        "Origin: You build slowly. | Active: You are scanning."
    );
    assert.equal(wildProfileSummary({origin: {}, apex: null}), null);
    assert.equal(wildProfileSummary(null), null);
    assert.equal(wildProfileSummary("Origin: injected"), null);
});

test("the Wild Profile offer takes the third chip for a signed-in reader who has none", () => {
    assert.deepEqual(
        decorateFollowUps(OFFERS, {signedIn: true, hasWildProfile: false}),
        [OFFERS[0], OFFERS[1], WILD_PROFILE_FOLLOW_UP]
    );
    assert.equal(isWildProfileFollowUp(" Set up Wild Profile "), true);
    assert.equal(isWildProfileFollowUp("How do I set up Wild Profile?"), false);
});

test("a reader with a profile, or without an account, keeps the model's own three", () => {
    assert.deepEqual(decorateFollowUps(OFFERS, {signedIn: true, hasWildProfile: true}), OFFERS);
    assert.deepEqual(decorateFollowUps(OFFERS, {signedIn: false, hasWildProfile: false}), OFFERS);
    assert.deepEqual(
        decorateFollowUps([...OFFERS, "A fourth"], {signedIn: true, hasWildProfile: true}),
        OFFERS,
        "three is the display cap"
    );
});

test("the offer is never added twice", () => {
    const already = [OFFERS[0], WILD_PROFILE_FOLLOW_UP, OFFERS[2]];
    assert.deepEqual(decorateFollowUps(already, {signedIn: true, hasWildProfile: false}), already);
});

test("a signed-in reader's prompt carries their profile, or says it is not set", () => {
    const withProfile = buildAskUserPrompt({
        userQuestion: "How do I use this at work?",
        packet: packet({wildProfile: {summary: "Origin: The Patient Builder"}})
    });
    assert.match(withProfile, /wild_profile_summary:\nOrigin: The Patient Builder/);

    const without = buildAskUserPrompt({
        userQuestion: "How do I use this at work?",
        packet: packet({wildProfile: {summary: null}})
    });
    assert.match(without, /wild_profile_summary: not_set/);
    assert.match(without, /setting up Wild Profile helps AnimalDex tailor application — then still offer a general pattern-based answer/);
});

test("a signed-out reader's prompt says nothing about a Wild Profile", () => {
    const prompt = buildAskUserPrompt({userQuestion: "How do I use this at work?", packet: packet()});
    assert.doesNotMatch(prompt, /wild_profile|Wild Profile/);
});

test("the species system prompt carries the iOS Wild Profile grounding rule verbatim", () => {
    const system = buildAskSystemPrompt({scope: "species", supportedVisuals: [], languageName: null});
    assert.match(system, /- Wild Profile: when supplied, personalize application to the user's stated Origin\/Apex\/Active animals\./);
});

test("an application question is matched to the Wild Profile only when there is one", () => {
    const hints = {...EMPTY_ASK_THINKING_HINTS, animalName: "Red Fox", principleName: "Edge Foraging"};
    assert.ok(askThinkingPhases("How do I apply this?", {...hints, hasWildProfile: true})
        .includes("Matching it to your Wild Profile…"));
    assert.ok(askThinkingPhases("How do I apply this?", hints)
        .includes("Working out how it applies to you…"));
    assert.ok(askThinkingPhases("What about my team?", {...hints, hasWildProfile: true})
        .includes("Matching it to your Wild Profile…"), "'my ' alone is an application question");
});

test("the catalogue leads and the capture only fills what it leaves empty", () => {
    const merged = mergeCaptureGrounding(species(), capture, "red-fox");
    assert.ok(merged);
    assert.equal(merged.summary, "A catalogue summary.");
    assert.equal(merged.habitat, "Woodland edge");
    assert.deepEqual(merged.identification, ["Rust coat"]);
    assert.equal(merged.diet, "Voles, fruit and what bins offer.");
    assert.equal(merged.lifespan, "Two to five years wild.");
    assert.deepEqual(merged.interestingFacts, ["Hears a vole under snow."]);
    assert.equal(merged.nativeRange, "Northern Hemisphere");
});

test("with no catalogue row the capture stands alone, so the scope stays on that animal", () => {
    const merged = mergeCaptureGrounding(null, capture, "animal");
    assert.ok(merged);
    assert.equal(merged.name, "Red Fox");
    assert.equal(merged.slug, "animal");
    assert.equal(merged.summary, "What this sighting's analysis said.");
    assert.equal(merged.systemDynamics, null);

    assert.equal(mergeCaptureGrounding(null, null, "animal"), null);
    assert.deepEqual(mergeCaptureGrounding(species(), null, "red-fox"), species());
});

test("the Wild Profile is read from the reader's row, never taken from the request", () => {
    const root = join(__dirname, "..");
    const stream = readFileSync(join(root, "app/api/ask/stream/route.ts"), "utf8");
    const reader = readFileSync(join(root, "data/ask-wild-profile.ts"), "utf8");
    assert.match(stream, /getAskWildProfile\(viewer\.userId\)/);
    assert.doesNotMatch(stream, /body\.wild|wild_profile_summary/);
    assert.match(reader, /\.eq\("user_id", userId\)/);
});
