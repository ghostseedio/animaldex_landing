import assert from "node:assert/strict";
import test from "node:test";
import {getChallenge} from "@/data/challenges";
import {getExpandedRankingEntries, getRankingPage, getRankingSeoTitle} from "@/data/rankings";
import {speciesEntries} from "@/data/species";

// Search Console, 13 Nov 2026: these pages had the site's largest impression
// counts at positions 7–9 with 0.1–0.6% CTR. Each title names the page's real
// #1 (the first row it renders), a number and the surprise; each description
// ends with the same call to action. docs/seo/titles-2026-11.md has the table.

const CTA = "Ask the #1 yourself.";
const TITLE_MAX = 59; // "under 60"
const DESCRIPTION_MAX = 154; // "under 155"

const speciesNames = new Map(speciesEntries.map((entry) => [entry.slug, entry.name]));

const rankingTitles: Record<string, string> = {
    "strongest-animals": "Strongest Animal? Not the Elephant: Blue Whale Leads 100",
    "smartest-animals": "Smartest Animal? Not the Chimp: Dolphin Tops 100 Ranked",
    "fastest-animals": "Fastest Animal? Not the Cheetah: Peregrine Falcon Leads 100",
    "most-dangerous-animals": "Most Dangerous Animal? Not the Shark: Crocodile Tops 100",
    "most-loyal-animals": "Most Loyal Animal? Not the Dog: Gray Wolf Leads the Top 10",
    "rarest-animals": "Rarest Animal? Not the Panda: Black Rhino Tops 250 Ranked",
    "animals-with-best-eyesight": "Best Eyesight in Animals? Eagle Beats the Owl: 100 Ranked",
    "most-gentle-animals": "Most Gentle Animal? Not the Sloth: Manatee Leads the Top 10",
    "most-patient-animals": "Most Patient Animal? Not the Tortoise: Crocodile Tops 10"
};

/** The #1's name, as the page shows it (quality lists name species the catalog may not). */
function topAnimalName(slug: string) {
    const page = getRankingPage(slug)!;
    const top = getExpandedRankingEntries(page)[0];
    assert.ok(top, `${slug} renders a #1`);
    return speciesNames.get(top.speciesSlug) ?? top.speciesSlug.replace(/-/g, " ");
}

function assertAnswerFirst(label: string, title: string, description: string, winnerName: string) {
    assert.ok(title.length <= TITLE_MAX, `${label} title is ${title.length} chars: ${title}`);
    assert.ok(description.length <= DESCRIPTION_MAX, `${label} description is ${description.length} chars`);
    assert.ok(description.endsWith(CTA), `${label} description ends with "${CTA}": ${description}`);
    assert.match(title, /\d/, `${label} title carries a number: ${title}`);
    assert.match(title, /\bNot\b|\bBeats\b/, `${label} title leads with the surprise: ${title}`);
    // Some word of the #1's name (Black Rhinoceros → "Black", American Crocodile → "Crocodile").
    const words = winnerName.split(/\s+/).filter((word) => word.length >= 4);
    assert.ok(
        words.some((word) => title.toLowerCase().includes(word.toLowerCase())),
        `${label} title names the #1 (${winnerName}): ${title}`
    );
    assert.doesNotMatch(title, /AnimalDex/);
}

for (const [slug, expectedTitle] of Object.entries(rankingTitles)) {
    test(`tier list ${slug}: answer-first title names the page's #1`, () => {
        const page = getRankingPage(slug);
        assert.ok(page, slug);
        const title = getRankingSeoTitle(page);
        assert.equal(title, expectedTitle);
        assertAnswerFirst(slug, title, page.description, topAnimalName(slug));
    });
}

const comparisonTitles: Record<string, {title: string; winner: string}> = {
    "gorilla-vs-orangutan": {title: "Gorilla vs Orangutan: 2x Heavier Gorilla Wins, Not in Trees", winner: "Gorilla"},
    "honey-badger-vs-snake": {title: "Honey Badger vs Snake: Badger Wins 2 of 4, Not Venom-Immune", winner: "Honey Badger"},
    "great-white-shark-vs-bull-shark": {title: "Great White Beats Bull Shark: 5 m vs 3.5 m, Not in Rivers", winner: "Great White Shark"}
};

for (const [slug, {title: expectedTitle, winner}] of Object.entries(comparisonTitles)) {
    test(`comparison ${slug}: answer-first title names the verdict's winner`, () => {
        const challenge = getChallenge(slug);
        assert.ok(challenge, slug);
        assert.equal(challenge.seoTitle, expectedTitle);
        assert.ok(challenge.seoDescription, `${slug} has a seoDescription`);
        assertAnswerFirst(slug, challenge.seoTitle!, challenge.seoDescription!, winner);
        // The verdict names the same winner (animalA on all three).
        assert.match(challenge.quickVerdict.toLowerCase(), new RegExp(winner.split(" ")[0].toLowerCase()));
        // The H1 is untouched: the page keeps its original title.
        assert.notEqual(challenge.title, challenge.seoTitle);
    });
}

test("the scenario counts in the comparison copy are the pages' own", () => {
    const wins = (slug: string, side: "animalA" | "animalB") =>
        getChallenge(slug)!.scenarioBreakdown.filter((scenario) => scenario.winner === side).length;
    assert.equal(wins("honey-badger-vs-snake", "animalA"), 2);
    assert.equal(getChallenge("honey-badger-vs-snake")!.scenarioBreakdown.length, 4);
    assert.equal(wins("gorilla-vs-orangutan", "animalB"), 1);
    assert.equal(getChallenge("gorilla-vs-orangutan")!.scenarioBreakdown.length, 3);
    assert.equal(wins("great-white-shark-vs-bull-shark", "animalB"), 1);
});
