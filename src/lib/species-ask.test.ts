import assert from "node:assert/strict";
import test from "node:test";
import {
    askLimitForViewer,
    buildCatalogFallbackAnswer,
    buildSpeciesAskSuggestions,
    inferAskProductRoutes,
    SPECIES_ASK_DAILY_LIMITS,
    SPECIES_ASK_LAYER_BODY_MAX,
    SPECIES_ASK_LAYER_META,
    type SpeciesAskGrounding
} from "@/lib/species-ask";

function orangutanGrounding(overrides: Partial<SpeciesAskGrounding> = {}): SpeciesAskGrounding {
    return {
        slug: "orangutan",
        name: "Orangutan",
        scientificName: "Pongo pygmaeus",
        category: "Great ape",
        summary: "Orangutans are highly intelligent, mostly solitary great apes adapted to life in Southeast Asia's forest canopy.",
        identification: ["Biological Superpower: extremely long arms for canopy travel"],
        habitat: "Tropical rainforest canopy of Borneo and Sumatra",
        nativeRange: "Borneo and Sumatra",
        diet: "Primarily fruit, with leaves, bark, and insects when fruit is scarce.",
        predators: "Humans are the main threat; young animals can be taken by large predators.",
        sleepPattern: "They build a new nest in the trees each night.",
        lifespan: "Often several decades in the wild.",
        reproduction: "Females usually raise a single young for many years.",
        sexDifference: "Males can develop cheek pads and a throat pouch.",
        interestingFacts: ["A baby may stay with its mother for seven years or more."],
        behaviorTraits: ["Mostly solitary adults", "Slow, deliberate movement through the canopy"],
        spottingTips: ["Watch fruiting trees from a respectful distance."],
        principleName: "Deliberate Intelligence",
        principleExpression: "Move with understanding, not urgency.",
        coreLesson: "Not every problem rewards speed. Some reward observation and deliberate action.",
        corePattern: "Navigate complexity through reach, planning, and unhurried movement.",
        biologicalBasis: "Orangutans move deliberately through complex forest canopies and spend years learning from their mothers.",
        shortMotto: "Move with understanding.",
        relatedSpecies: [{slug: "chimpanzee", name: "Chimpanzee"}, {slug: "western-gorilla", name: "Gorilla"}],
        relatedLocations: [{slug: "borneo", name: "Borneo"}, {slug: "sumatra", name: "Sumatra"}],
        ...overrides
    };
}

test("suggested questions change with the species, not a generic chatbot prompt", () => {
    const orangutan = buildSpeciesAskSuggestions(orangutanGrounding());
    assert.ok(orangutan.some((item) => /solitary/i.test(item.prompt)));
    assert.ok(orangutan.some((item) => /trees/i.test(item.prompt)));
    assert.ok(orangutan.some((item) => /teach/i.test(item.prompt)));
    assert.ok(orangutan.some((item) => /chimpanzee/i.test(item.label)));
    assert.equal(orangutan.some((item) => /chat with ai/i.test(item.label)), false);

    const turtle = buildSpeciesAskSuggestions(orangutanGrounding({
        slug: "alligator-snapping-turtle",
        name: "Alligator Snapping Turtle",
        summary: "A powerful freshwater turtle with a bite strong enough to defend itself on land, but it cannot hide completely in its shell.",
        habitat: "Rivers and swamp bottoms",
        nativeRange: "Southeastern United States",
        diet: "Fish, carrion, and other animals caught with an ambush lure.",
        sleepPattern: "Mostly sit-and-wait hunters on river bottoms.",
        identification: ["Heavy armored shell", "Powerful bite"],
        behaviorTraits: ["Aggressive on land", "Ambush predator in water"],
        principleName: "Armored Patience"
    }));
    assert.ok(turtle.some((item) => /defend/i.test(item.prompt)));
    assert.equal(turtle.some((item) => /solitary/i.test(item.prompt)), false);

    const whaleShark = buildSpeciesAskSuggestions(orangutanGrounding({
        slug: "whale-shark",
        name: "Whale Shark",
        summary: "The largest fish uses filter feeding to take in tiny prey.",
        habitat: "Warm coastal and open ocean water",
        diet: "Filter feeding on plankton and tiny prey.",
        identification: ["Filter feeding"],
        behaviorTraits: ["Cruise productive water"],
        principleName: "Selective Abundance"
    }));
    assert.ok(whaleShark.some((item) => /tiny prey/i.test(item.prompt)));
});

test("Ask routes people through AnimalDex instead of ending in a chatbot", () => {
    const grounding = orangutanGrounding();
    const where = inferAskProductRoutes("Where can I see orangutans?", grounding);
    assert.ok(where.some((route) => route.href === "/locations/borneo"));
    assert.ok(where.some((route) => route.href === "/wildlife-experiences"));

    const compare = inferAskProductRoutes("Orangutan vs chimpanzee?", grounding);
    assert.ok(compare.some((route) => route.href === "/comparisons/orangutan-vs-chimpanzee"));

    const lesson = inferAskProductRoutes("What can an orangutan teach me?", grounding);
    assert.ok(lesson.some((route) => route.href === "#animal-power"));

    const photo = inferAskProductRoutes("I've photographed one before.", grounding);
    assert.ok(photo.some((route) => route.href.includes("instagram")));

    const intelligence = inferAskProductRoutes("How intelligent are Orangutan?", grounding);
    assert.equal(intelligence.some((route) => /aardvark/i.test(route.label)), false);
    assert.ok(intelligence.some((route) => route.href === "#animal-power"));
});

test("fallback answers keep biology, why, and lesson in separate layers", () => {
    const result = buildCatalogFallbackAnswer(
        "What can orangutans teach us about rushing a decision?",
        orangutanGrounding()
    );
    assert.deepEqual(result.layers.map((layer) => layer.kind), ["biology", "why", "lesson"]);
    assert.equal(result.layers[0].title, SPECIES_ASK_LAYER_META.biology.title);
    assert.equal(result.layers[1].title, SPECIES_ASK_LAYER_META.why.title);
    assert.equal(result.layers[2].title, SPECIES_ASK_LAYER_META.lesson.title);
    assert.match(result.layers[0].body, /solitary great apes/i);
    assert.match(result.layers[1].body, /planning|reach|unhurried/i);
    assert.match(result.layers[2].body, /Deliberate Intelligence/);
    assert.equal(result.layers.some((layer) => layer.kind === "symbolism"), false);
    assert.ok(result.layers.every((layer) => layer.body.length <= SPECIES_ASK_LAYER_BODY_MAX + 1));

    const symbolism = buildCatalogFallbackAnswer("What does an orangutan symbolize?", orangutanGrounding());
    assert.ok(symbolism.layers.some((layer) => layer.kind === "symbolism"));
    assert.equal(symbolism.layers.find((layer) => layer.kind === "symbolism")?.title, SPECIES_ASK_LAYER_META.symbolism.title);
    assert.match(symbolism.layers.find((layer) => layer.kind === "symbolism")!.body, /interpretation/i);
});

test("anonymous, signed-in, and Pro Ask limits are deterministic", () => {
    assert.deepEqual(SPECIES_ASK_DAILY_LIMITS, {anonymous: 3, signedIn: 10, pro: 30});
    assert.equal(askLimitForViewer({signedIn: false, isPro: false}), 3);
    assert.equal(askLimitForViewer({signedIn: true, isPro: false}), 10);
    assert.equal(askLimitForViewer({signedIn: true, isPro: true}), 30);
});

test("every answer includes product follow-ups instead of a dead-end chat", () => {
    const routes = inferAskProductRoutes("How intelligent are Orangutan?", orangutanGrounding());
    assert.ok(routes.some((route) => route.href === "/comparisons/orangutan-vs-chimpanzee"));
    assert.ok(routes.some((route) => route.href === "#animal-power"));
    assert.ok(routes.some((route) => route.href === "#where"));
    assert.ok(routes.some((route) => route.href === "/wildlife-experiences"));
    assert.equal(routes.some((route) => route.intent === "collect"), false);
});
