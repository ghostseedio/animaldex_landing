import {getAnimalHybrid, animalHybridEntries} from "@/data/animal-hybrids";
import {getFusableSpecies, getPublishedAnimalFusion, publishedAnimalFusions} from "@/data/animal-fusions";
import {getLocationPage, locationPages} from "@/data/locations";
import {getRankingPage, rankingPages} from "@/data/rankings";
import {getSpeciesBySlug} from "@/data/species";
import {getResolvedSpeciesArtworkUrl} from "@/data/species-artwork-index";
import {getComparisonPageData} from "@/data/species-comparisons";
import closedSeoNamespaceSlugs from "@/data/closed-seo-namespace-slugs.json";
import {getAbsoluteUrl} from "@/lib/site";
import type {Fighter, SourceImage, SourceType, StatLine, VideoSource} from "@/lib/content-video/plan";
import {listVideoCandidates, loadVideoSource as loadBlogSource, type VideoCandidate} from "@/lib/content-video/source";
import {SOURCE_LABELS, sourcePath} from "@/lib/content-video/source-paths";

// Every page family a video can be made from, as a VideoSource: comparisons
// (battle), hybrids and fusions (creature), rankings and locations
// (editorial, over the species artwork). Blog posts live in source.ts.

const TOP_RANKING_ENTRIES = 5;
const LOCATION_ANIMALS = 7;

export {SOURCE_LABELS, sourcePath};

function titleCase(slug: string) {
    return slug.split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

function speciesName(slug: string) {
    return getSpeciesBySlug(slug)?.name ?? getFusableSpecies(slug)?.name ?? titleCase(slug);
}

/** Species artwork (photoreal cut-outs, ~1200px) as numbered source images. */
async function artworkImages(species: Array<{slug: string; alt: string}>): Promise<SourceImage[]> {
    const urls = await Promise.all(species.map((entry) => getResolvedSpeciesArtworkUrl(entry.slug).catch(() => null)));
    return species.flatMap((entry, offset) => urls[offset]
        ? [{index: offset + 1, src: urls[offset]!, alt: entry.alt, caption: null, width: 1200, height: 900, license: null}]
        : []);
}

function fighter(slug: string, name: string, images: SourceImage[], index: number): Fighter {
    return {slug, name, image: images.find((image) => image.index === index)?.index ?? images[0]?.index ?? 1};
}

const ARTWORK_NOTE = "The photos are cut-out species ARTWORK on a plain background (not real photographs): every ai_clip needs a keyframe_prompt.";

async function comparisonSource(slug: string): Promise<VideoSource | null> {
    const data = await getComparisonPageData(slug);
    if (data.status !== "ready") return null;
    const entry = data.challenge;
    const nameA = entry.animalADisplayName ?? speciesName(entry.animalASlug);
    const nameB = entry.animalBDisplayName ?? speciesName(entry.animalBSlug);
    const images = await artworkImages([{slug: entry.animalASlug, alt: nameA}, {slug: entry.animalBSlug, alt: nameB}]);
    if (images.length < 2) return null;
    const side = (value: string) => (value === "animalA" ? "a" : value === "animalB" ? "b" : value);
    const scenarios = entry.scenarioBreakdown.map((scenario) => ({title: scenario.title, winner: side(scenario.winner) as "a" | "b" | "draw" | "depends", verdict: scenario.verdict}));
    // The page's overall call: the side most of its scenarios name, when that is clear.
    const wins = {a: scenarios.filter((scenario) => scenario.winner === "a").length, b: scenarios.filter((scenario) => scenario.winner === "b").length};
    const verdictText = `${entry.quickVerdict} ${entry.shortAnswer.join(" ")}`;
    const named = new RegExp(`\\b(${nameA}|${nameB})\\b[^.]{0,40}\\b(wins|would win|comes out ahead|has the edge|takes it)`, "i").exec(verdictText);
    const winner = named ? (named[1].toLowerCase() === nameA.toLowerCase() ? "a" : "b") : wins.a > wins.b ? "a" : wins.b > wins.a ? "b" : null;
    const stats: StatLine[] = entry.statCategories.map((stat) => ({
        label: stat.label,
        a: stat.animalAValue,
        b: stat.animalBValue,
        advantage: stat.advantage === "animalA" ? "a" : stat.advantage === "animalB" ? "b" : "even"
    }));
    return {
        type: "comparison",
        format: "battle",
        slug,
        title: entry.title,
        description: entry.description,
        url: getAbsoluteUrl("en", sourcePath("comparison", slug)),
        tags: entry.searchIntents.slice(0, 6),
        text: [entry.quickVerdict, ...entry.shortAnswer, ...entry.whyThisMatchupIsInteresting, ...entry.finalTake].join("\n"),
        images,
        battle: {a: fighter(entry.animalASlug, nameA, images, 1), b: fighter(entry.animalBSlug, nameB, images, 2), stats, scenarios, verdict: entry.quickVerdict, winner}
    };
}

async function hybridSource(slug: string): Promise<VideoSource | null> {
    const entry = getAnimalHybrid(slug);
    if (!entry) return null;
    const [first, second] = entry.parents;
    const images = await artworkImages([{slug: first.slug, alt: first.name}, {slug: second.slug, alt: second.name}]);
    if (images.length < 2) return null;
    return {
        type: "hybrid",
        format: "creature",
        slug,
        title: entry.title,
        description: entry.quickAnswer,
        url: getAbsoluteUrl("en", sourcePath("hybrid", slug)),
        tags: entry.searchIntents.slice(0, 6),
        text: [entry.quickAnswer, entry.appearance, entry.behaviorBlend, `${entry.ultimateAbility.name}: ${entry.ultimateAbility.description}`, entry.viability, entry.habitatRole].join("\n"),
        images,
        creature: {
            kind: "hybrid",
            name: entry.hybridName,
            parents: [fighter(first.slug, first.name, images, 1), fighter(second.slug, second.name, images, 2)],
            appearance: entry.appearance,
            behavior: entry.behaviorBlend,
            habitat: entry.habitatRole
        }
    };
}

async function fusionSource(slug: string): Promise<VideoSource | null> {
    const entry = getPublishedAnimalFusion(slug);
    if (!entry) return null;
    const receiver = speciesName(entry.receiverSlug);
    const donor = speciesName(entry.donorSlug);
    const images = await artworkImages([{slug: entry.receiverSlug, alt: receiver}, {slug: entry.donorSlug, alt: donor}]);
    if (images.length < 2) return null;
    return {
        type: "fusion",
        format: "creature",
        slug,
        title: `${receiver} learns ${entry.name} from the ${donor}`,
        description: entry.expression,
        url: getAbsoluteUrl("en", sourcePath("fusion", slug)),
        tags: entry.scenarioTags.slice(0, 6),
        text: [`${receiver}'s principle: ${entry.receiverPrinciple}`, `${donor}'s principle: ${entry.donorPrinciple}`, `What it learns (${entry.name}): ${entry.expression}`].join("\n"),
        images,
        creature: {
            kind: "fusion",
            name: entry.name,
            parents: [fighter(entry.receiverSlug, receiver, images, 1), fighter(entry.donorSlug, donor, images, 2)],
            appearance: `A ${receiver}, looking exactly like a real ${receiver}.`,
            behavior: entry.expression,
            habitat: `The ${receiver}'s natural habitat.`
        }
    };
}

async function rankingSource(slug: string): Promise<VideoSource | null> {
    const page = getRankingPage(slug);
    if (!page) return null;
    const top = [...page.entries].sort((a, b) => a.rank - b.rank).slice(0, TOP_RANKING_ENTRIES);
    const images = await artworkImages(top.map((entry) => ({slug: entry.speciesSlug, alt: `#${entry.rank} ${speciesName(entry.speciesSlug)} — ${entry.primaryMetric}`})));
    if (images.length < 3) return null;
    return {
        type: "ranking",
        format: "editorial",
        slug,
        title: page.headline ?? page.title,
        description: page.quickAnswer,
        url: getAbsoluteUrl("en", sourcePath("ranking", slug)),
        tags: page.searchIntents.slice(0, 6),
        text: [page.quickAnswer, ...page.introduction, ...top.map((entry) => `#${entry.rank} ${speciesName(entry.speciesSlug)} (${entry.primaryMetric}): ${entry.shortReason}`)].join("\n"),
        images,
        brief: `A TOP ${top.length} COUNTDOWN. ${ARTWORK_NOTE}
- Scene 1 (the hook) teases number one without naming it, over an ai_clip of number one's photo (with a keyframe_prompt).
- Then one scene per entry from #${top.length} down to #1, using that entry's photo; overlay is "#<rank> <NAME>" (e.g. "#3 PEREGRINE FALCON"); narration gives the metric and why, escalating.
- #1 is the payoff and gets an ai_clip; use 3 ai_clips in total (the hook, #2 and #1).`
    };
}

async function locationSource(slug: string): Promise<VideoSource | null> {
    const page = getLocationPage(slug);
    if (!page) return null;
    const spots = page.animalsToSpot.slice(0, LOCATION_ANIMALS);
    const images = await artworkImages(spots.map((spot) => ({slug: spot.speciesSlug, alt: `${speciesName(spot.speciesSlug)}${spot.rarityHint ? ` (${spot.rarityHint})` : ""}`})));
    if (images.length < 3) return null;
    return {
        type: "location",
        format: "editorial",
        slug,
        title: page.title,
        description: page.quickAnswer,
        url: getAbsoluteUrl("en", sourcePath("location", slug)),
        tags: page.searchIntents.slice(0, 6),
        text: [page.quickAnswer, ...page.introduction, "Animals:", ...spots.map((spot) => `- ${speciesName(spot.speciesSlug)}: ${spot.whyItFits}${spot.rarityHint ? ` (${spot.rarityHint})` : ""}`), "How to find them:", ...page.spottingTips].join("\n"),
        images,
        brief: `A "WHAT YOU CAN SEE IN ${page.name.toUpperCase()}" GUIDE, written for search and AI answers as much as for views. ${ARTWORK_NOTE}
- The hook names the place and the most surprising animal you can see there.
- One scene per animal (5–7), using its photo; overlay is the animal's name; narration says where/how to spot it from the page (habitat, time of day, a tip).
- Say "${page.name}" naturally at least three times. Use 2 ai_clips in total (the hook and the rarest animal).`
    };
}

export async function loadPageSource(type: SourceType, slug: string): Promise<VideoSource | null> {
    switch (type) {
        case "blog": return loadBlogSource(slug);
        case "comparison": return comparisonSource(slug);
        case "hybrid": return hybridSource(slug);
        case "fusion": return fusionSource(slug);
        case "ranking": return rankingSource(slug);
        case "location": return locationSource(slug);
    }
}

/** Pages of one family a video could be made from (newest/most important first where known). */
export async function listPageCandidates(type: SourceType): Promise<VideoCandidate[]> {
    const now = new Date().toISOString();
    switch (type) {
        case "blog": return listVideoCandidates();
        case "comparison": return (closedSeoNamespaceSlugs.comparisons ?? []).map((slug) => ({slug, title: titleCase(slug).replace(/ Vs /, " vs "), publishedAt: now, imageCount: 2}));
        case "hybrid": return animalHybridEntries.map((entry) => ({slug: entry.slug, title: entry.title, publishedAt: entry.updatedAt, imageCount: 2}));
        case "fusion": return publishedAnimalFusions.map((entry) => ({slug: entry.slug, title: `${speciesName(entry.receiverSlug)} learns ${entry.name} from ${speciesName(entry.donorSlug)}`, publishedAt: entry.updatedAt, imageCount: 2}));
        case "ranking": return rankingPages.map((page) => ({slug: page.slug, title: page.headline ?? page.title, publishedAt: page.publishedAt, imageCount: TOP_RANKING_ENTRIES}));
        case "location": return locationPages.map((page) => ({slug: page.slug, title: page.title, publishedAt: page.publishedAt, imageCount: LOCATION_ANIMALS}));
    }
}
