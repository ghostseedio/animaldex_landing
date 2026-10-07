import assert from "node:assert/strict";
import test from "node:test";
import publishedSeoSlugs from "@/data/published-seo-slugs.json";
import {resolveSpeciesBehaviorProfileForPage} from "@/data/species-behavior-lessons";
import {buildAnimalDreamReading, buildDreamQuestion, commonNameInSentence} from "@/lib/animal-dream-reading";

test("dream question reads like the search, with natural casing", () => {
    assert.equal(buildDreamQuestion("Lion"), "What does it mean to dream about a lion?");
    assert.equal(buildDreamQuestion("African Bush Elephant"), "What does it mean to dream about an African bush elephant?");
    assert.equal(commonNameInSentence("Sabine's Gull"), "Sabine's gull");
});

test("the reading is built from the animal's own principle and core lesson", () => {
    const reading = buildAnimalDreamReading({
        slug: "bengal-tiger",
        name: "Bengal Tiger",
        principle: "Silent Ascent",
        principleExpression: "Climb quietly until the moment is yours.",
        coreLesson: "Solitude becomes power when every step serves the same aim.",
        motto: "Climb in silence.",
        bestFor: ["Focus", "Courage", "Healthy Independence"]
    });
    assert.match(reading.answer, /Silent Ascent/);
    assert.match(reading.answer, /Solitude becomes power/);
    assert.equal(reading.scenarios.length, 4);
    assert.ok(reading.scenarios.every((scenario) => scenario.reading.length > 60));
});

test("almost every published animal page carries a dream reading", () => {
    const animals = publishedSeoSlugs.animals;
    const withReading = animals.filter((slug) => resolveSpeciesBehaviorProfileForPage(slug));
    assert.ok(withReading.length >= 2300, `only ${withReading.length} of ${animals.length} animal pages have a principle`);

    const answers = new Set(withReading.slice(0, 400).map((slug) => {
        const profile = resolveSpeciesBehaviorProfileForPage(slug)!;
        return buildAnimalDreamReading({
            slug,
            name: slug,
            principle: profile.principle,
            principleExpression: profile.principleExpression,
            coreLesson: profile.coreLesson,
            motto: profile.motto,
            bestFor: profile.bestFor
        }).answer;
    }));
    assert.equal(answers.size, 400, "each animal gets its own answer");
});
