import assert from "node:assert/strict";
import test from "node:test";
import {getExpandedRankingEntries, getRankingHeadline, rankingPages} from "@/data/rankings";
import {challengeEntries, getChallenge} from "@/data/challenges";
import {getSpeciesBySlug, speciesEntries} from "@/data/species";
import {getPublishedSpeciesForContent} from "@/lib/static-species-overlay";
import {
    comparisonAskQuestion,
    comparisonAskTarget,
    hasTierListAskBox,
    hasTierListInstallButtons,
    INLINE_ASK_WORDS_EN,
    inlineAskWords,
    rankingSubject,
    TIER_LIST_ASK_SLUGS,
    TIER_LIST_INSTALL_SLUGS,
    tierListAskQuestion,
    tierListUtmContent
} from "./tier-list-ask";

test("the twelve tier lists with the box, and the four with install buttons, exist and have a #1 animal", () => {
    assert.equal(TIER_LIST_ASK_SLUGS.length, 12);
    assert.equal(TIER_LIST_INSTALL_SLUGS.length, 4);
    for (const slug of TIER_LIST_INSTALL_SLUGS) assert.ok(hasTierListAskBox(slug), `${slug} has the box too`);
    for (const slug of TIER_LIST_ASK_SLUGS) {
        const page = rankingPages.find((entry) => entry.slug === slug);
        assert.ok(page, `${slug} is a ranking page`);
        const leader = getExpandedRankingEntries(page!, undefined, speciesEntries)[0];
        assert.ok(leader, `${slug} has a #1`);
        // Resolved the way the page resolves it (static entries, then the published overlay).
        const species = getSpeciesBySlug(leader.speciesSlug) ?? getPublishedSpeciesForContent(leader.speciesSlug);
        assert.ok(species?.name, `${slug}'s #1 (${leader.speciesSlug}) has a name`);
    }
    assert.equal(hasTierListAskBox("biggest-animals"), false);
    assert.equal(hasTierListInstallButtons("fastest-animals"), false);
});

test("the pre-filled question comes from the list's own headline, addressed to its #1 animal", () => {
    const question = (slug: string) => tierListAskQuestion(getRankingHeadline(rankingPages.find((entry) => entry.slug === slug)!));
    assert.equal(question("strongest-animals"), "Why are you the strongest?");
    assert.equal(question("smartest-animals"), "Why are you the smartest?");
    assert.equal(question("fastest-animals"), "Why are you the fastest?");
    assert.equal(question("most-dangerous-animals"), "Why are you the most dangerous?");
    assert.equal(question("most-loyal-animals"), "Why are you the most loyal?");
    assert.equal(question("ugliest-animals"), "Why are you the ugliest?");
    assert.equal(question("rarest-animals"), "Why are you the rarest?");
    // From the list's live headline ("Most Sexually Active Animals…"), not its slug.
    assert.equal(question("animals-with-highest-mating-drive"), "Why are you the most sexually active?");
    assert.equal(tierListAskQuestion("Animals with the Highest Mating Drive: Top 10 Ranked"), "Why do you have the highest mating drive?");
    assert.equal(question("animals-with-best-teamwork"), "Why do you have the best teamwork?");
    assert.equal(rankingSubject("Strongest Animals in the World: Top 10 Ranked"), "strongest animals");
    assert.equal(tierListAskQuestion("Animals That Work Together: Top 10 Ranked"), "Why are you #1 among the animals that work together?");
    for (const slug of TIER_LIST_ASK_SLUGS) {
        const text = question(slug);
        assert.match(text, /^Why (are you the|do you have the) [a-z ]+\?$/, `${slug}: ${text}`);
    }
});

test("install buttons name the list in utm_content", () => {
    assert.equal(tierListUtmContent("strongest-animals"), "tierlist_strongest-animals");
    assert.equal(tierListUtmContent("Animals/With?Weird chars"), "tierlist_animalswithweirdchars");
});

test("a comparison's box speaks to the animal its own scenarios favour, and asks how it would beat the other", () => {
    assert.equal(comparisonAskQuestion("Bull Shark"), "How would you beat a bull shark?");
    assert.equal(comparisonAskQuestion("African Elephant"), "How would you beat an african elephant?".replace("african", "African"));
    const tigerLion = getChallenge("tiger-vs-lion")!;
    const target = comparisonAskTarget({
        animalA: {slug: tigerLion.animalASlug, name: "Tiger"},
        animalB: {slug: tigerLion.animalBSlug, name: "Lion"},
        scenarios: tigerLion.scenarioBreakdown,
        stats: tigerLion.statCategories
    });
    assert.equal(target.target.slug, "tiger");
    assert.equal(target.basis, "scenarios");
    assert.equal(target.question, "How would you beat a lion?");
    // Tied scenarios: the stat edges decide; tied again: the first animal.
    const stats = comparisonAskTarget({
        animalA: {slug: "a", name: "A"},
        animalB: {slug: "b", name: "B"},
        scenarios: [{winner: "animalA"}, {winner: "animalB"}, {winner: "draw"}],
        stats: [{advantage: "animalB"}, {advantage: "even"}]
    });
    assert.equal(stats.target.slug, "b");
    assert.equal(stats.basis, "stats");
    const first = comparisonAskTarget({animalA: {slug: "a", name: "A"}, animalB: {slug: "b", name: "B"}, scenarios: [], stats: []});
    assert.equal(first.target.slug, "a");
    assert.equal(first.basis, "first");
    // Every hand-written comparison yields a target with a question that names the other animal.
    for (const entry of challengeEntries) {
        const a = getSpeciesBySlug(entry.animalASlug);
        const b = getSpeciesBySlug(entry.animalBSlug);
        if (!a || !b) continue;
        const picked = comparisonAskTarget({animalA: a, animalB: b, scenarios: entry.scenarioBreakdown, stats: entry.statCategories});
        assert.ok([a.slug, b.slug].includes(picked.target.slug));
        assert.match(picked.question, /^How would you beat an? .+\?$/);
    }
});

test("the box's words fall back to English key by key", () => {
    assert.deepEqual(inlineAskWords(null), INLINE_ASK_WORDS_EN);
    assert.equal(inlineAskWords({submit: "Tanya", title: ""}).submit, "Tanya");
    assert.equal(inlineAskWords({submit: "Tanya", title: ""}).title, INLINE_ASK_WORDS_EN.title);
    assert.match(INLINE_ASK_WORDS_EN.installBody, /Every animal has a lesson\./);
});
