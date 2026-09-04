import assert from "node:assert/strict";
import test from "node:test";
import {
    buildSpeciesAtAGlance,
    speciesHasSubstantiveFieldGuide
} from "@/lib/species-field-guide";

const orangutanKnowledge = {
    name: "Orangutan",
    summary: "Orangutans are large arboreal apes famous for deliberate movement, long learning periods, and strong dependence on complex tropical forest canopies.",
    habitat: "Lowland rainforest, peat swamp forest, hill forest, and mixed tropical canopy systems.",
    nativeRange: "Restricted to Borneo and Sumatra, with different species and isolated populations across remaining forests.",
    identification: [
        "Long reddish fur with very long arms and grasping hands",
        "Slow controlled climbing in the upper forest canopy",
        "Large adult males may show broad cheek pads and throat sacs"
    ],
    behaviorTraits: [
        "Builds fresh night nests in trees from bent branches and leaves",
        "Learns food routes, seasonal fruit timing, and travel structure over years"
    ],
    interestingFacts: [
        "Orangutans reveal how intelligence can be shaped by long-term forest memory rather than social crowding."
    ]
};

test("authored species pages have enough server-rendered knowledge to be indexable", () => {
    assert.equal(speciesHasSubstantiveFieldGuide(orangutanKnowledge), true);
});

test("thin catalog placeholders are not enough for indexability, and Ask answers cannot count", () => {
    assert.equal(speciesHasSubstantiveFieldGuide({
        name: "Unknown Skink",
        summary: "Unknown Skink is an indexed AnimalDex species with a field profile connected to live captures, canonical stats, and collection progress.",
        habitat: "Unknown Skink habitat data is maintained in the live AnimalDex field guide.",
        nativeRange: "Unknown Skink habitat data is maintained in the live AnimalDex field guide.",
        identification: ["Recognized in AnimalDex as Unknown Skink", "Indexed profile #1204"],
        behaviorTraits: ["Unknown Skink is an indexed AnimalDex species with a field profile connected to live captures."]
    }), false);
});

test("at-a-glance is a compact semantic summary, not IUCN invention", () => {
    const glance = buildSpeciesAtAGlance({
        category: "Mammal",
        habitat: "Lowland rainforest, peat swamp forest, hill forest",
        nativeRange: "Restricted to Borneo and Sumatra, with different species and isolated populations",
        rarityLabel: "Very rare",
        identification: orangutanKnowledge.identification,
        behaviorTraits: ["Mostly solitary adults in the forest canopy"],
        principleName: "Deliberate Intelligence"
    });

    assert.ok(glance.facts.some((fact) => /mammal/i.test(fact)));
    assert.ok(glance.facts.some((fact) => /borneo and sumatra/i.test(fact)));
    assert.equal(glance.facts.some((fact) => /with different/i.test(fact)), false);
    assert.ok(glance.facts.some((fact) => /solitary/i.test(fact)));
    assert.ok(glance.facts.some((fact) => /very rare/i.test(fact)));
    assert.equal(glance.facts.some((fact) => /critically endangered/i.test(fact)), false);
    assert.equal(glance.principleName, "Deliberate Intelligence");
    assert.ok(glance.knownFor.length >= 2);
});
