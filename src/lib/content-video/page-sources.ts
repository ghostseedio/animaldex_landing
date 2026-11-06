import {getAnimalHybrid, animalHybridEntries} from "@/data/animal-hybrids";
import {getFusableSpecies, getPublishedAnimalFusion, publishedAnimalFusions} from "@/data/animal-fusions";
import {getLocationPage, locationPages} from "@/data/locations";
import {getRankingPage, rankingPages} from "@/data/rankings";
import {getSpeciesBySlug, speciesEntries} from "@/data/species";
import {getResolvedSpeciesArtworkUrl} from "@/data/species-artwork-index";
import {getComparisonPageData} from "@/data/species-comparisons";
import closedSeoNamespaceSlugs from "@/data/closed-seo-namespace-slugs.json";
import lessonSnapshot from "@/data/published-seo-lesson-pages.json";
import speciesPowers from "@/data/published-species-powers.json";
import {getAbsoluteUrl} from "@/lib/site";
import type {Fighter, SourceImage, SourceType, StatLine, VideoSource} from "@/lib/content-video/plan";
import {listVideoCandidates, loadVideoSource as loadBlogSource, type VideoCandidate} from "@/lib/content-video/source";
import {SOURCE_LABELS, sourcePath} from "@/lib/content-video/source-paths";
import {sourceSpecies} from "@/lib/content-video/stat-cards";
import {battlePowerFor} from "@/lib/content-video/battle-powers";
import {footageFor, scanRevealSpecies, type FootageClip} from "@/lib/content-video/footage";

// Every page family a video can be made from, as a VideoSource: comparisons
// (battle), hybrids and fusions (creature), rankings and locations
// (editorial, over the species artwork), animal lessons (/animal-powers, the
// dark & gold lesson format). Blog posts live in source.ts.

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
    const [powerA, powerB] = await Promise.all([battlePowerFor(entry.animalASlug), battlePowerFor(entry.animalBSlug)]);
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
        species: await sourceSpecies([{slug: entry.animalASlug, name: nameA, image: 1}, {slug: entry.animalBSlug, name: nameB, image: 2}]),
        battle: {a: fighter(entry.animalASlug, nameA, images, 1), b: fighter(entry.animalBSlug, nameB, images, 2), stats, scenarios, verdict: entry.quickVerdict, winner, powers: {a: powerA, b: powerB}}
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
    const species = await sourceSpecies(top.map((entry, offset) => ({slug: entry.speciesSlug, name: speciesName(entry.speciesSlug), image: images.some((image) => image.index === offset + 1) ? offset + 1 : null})));
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
        species,
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
    const species = await sourceSpecies(spots.map((spot, offset) => ({slug: spot.speciesSlug, name: speciesName(spot.speciesSlug), image: images.some((image) => image.index === offset + 1) ? offset + 1 : null})));
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
        species,
        brief: `A "WHAT YOU CAN SEE IN ${page.name.toUpperCase()}" GUIDE, written for search and AI answers as much as for views. ${ARTWORK_NOTE}
- The hook names the place and the most surprising animal you can see there.
- One scene per animal (5–7), using its photo; overlay is the animal's name; narration says where/how to spot it from the page (habitat, time of day, a tip).
- Say "${page.name}" naturally at least three times. Use 2 ai_clips in total (the hook and the rarest animal).`
    };
}

type LessonEntry = {slug: string; displayName?: string | null; principleName?: string | null; principleExpression?: string | null; coreLesson?: string | null; biologicalBasis?: string | null; shortMotto?: string | null; applicationExample?: string | null};

/**
 * Every animal with a lesson: the /animal-powers snapshot (with its biology
 * and a real-life example) and the catalog's species Powers, which cover
 * headline animals the snapshot lacks (the tiger, the orca, the honey badger).
 */
const lessonEntries: LessonEntry[] = (() => {
    const bySlug = new Map<string, LessonEntry>();
    for (const entry of (lessonSnapshot as {entries: LessonEntry[]}).entries) {
        if (entry.slug && entry.principleName && entry.coreLesson) bySlug.set(entry.slug, entry);
    }
    const powers = (speciesPowers as {powers: Record<string, {name: string; expression: string | null; lesson: string | null; motto: string | null}>}).powers;
    for (const [slug, power] of Object.entries(powers)) {
        if (bySlug.has(slug) || !power.name || !power.lesson) continue;
        bySlug.set(slug, {slug, principleName: power.name, principleExpression: power.expression, coreLesson: power.lesson, shortMotto: power.motto});
    }
    return Array.from(bySlug.values());
})();

/**
 * Demand sits with the animals people already admire (Nov 2026 research:
 * lion / wolf / eagle "mindset" Shorts reach millions on tiny channels, a
 * crocodile or octopus one a few thousand). They get their lesson videos first.
 */
export const HEADLINE_LESSON_ANIMALS = [
    "african-lion", "gray-wolf", "bald-eagle", "golden-eagle", "bengal-tiger", "orca", "great-white-shark", "honey-badger",
    "saltwater-crocodile", "mountain-gorilla", "western-gorilla", "african-bush-elephant", "cheetah", "snow-leopard", "jaguar",
    "grizzly-bear", "polar-bear", "peregrine-falcon", "great-horned-owl", "snowy-owl", "king-cobra", "black-mamba", "komodo-dragon",
    "common-octopus", "spotted-hyena", "wolverine", "common-raven", "american-crow", "chimpanzee", "red-fox", "american-bison",
    "harpy-eagle", "mountain-lion", "eurasian-lynx", "common-hippopotamus", "humpback-whale", "blue-whale", "emperor-penguin",
    "peacock-mantis-shrimp", "sea-otter", "domestic-horse", "eurasian-wolf", "moose", "axolotl", "electric-eel"
] as const;

function lessonEntry(slug: string) {
    return lessonEntries.find((entry) => entry.slug === slug) ?? null;
}

async function lessonSource(slug: string): Promise<VideoSource | null> {
    const entry = lessonEntry(slug);
    if (!entry) return null;
    const name = entry.displayName?.trim() || speciesName(slug);
    const images = await artworkImages([{slug, alt: name}]);
    if (!images.length) return null;
    const facts = {
        animal: fighter(slug, name, images, 1),
        power: entry.principleName!.trim(),
        expression: entry.principleExpression?.trim() ?? "",
        lesson: entry.coreLesson!.trim(),
        motto: entry.shortMotto?.trim() ?? "",
        basis: entry.biologicalBasis?.trim() ?? "",
        application: entry.applicationExample?.trim() ?? ""
    };
    return {
        type: "lesson",
        format: "lesson",
        slug,
        title: `What the ${name} teaches you: ${facts.power}`,
        description: facts.lesson,
        url: getAbsoluteUrl("en", sourcePath("lesson", slug)),
        tags: [name, facts.power, "animal lessons", "life lessons from animals"],
        text: [`Power: ${facts.power}`, `Behaviour: ${facts.expression}`, `Biology: ${facts.basis}`, `Lesson: ${facts.lesson}`, `Motto: ${facts.motto}`, `In real life: ${facts.application}`].join("\n"),
        images,
        species: await sourceSpecies([{slug, name, image: 1}]),
        lesson: facts
    };
}

/** "Guess the animal" from a species page: its clue material, hardest first, and what to say after the reveal. */
async function guessSource(slug: string): Promise<VideoSource | null> {
    const entry = getSpeciesBySlug(slug);
    if (!entry) return null;
    const analysis = entry.analysis;
    const details = entry.premiumDetails;
    const clues = [
        ...(details?.behaviorTraits ?? []),
        analysis?.habitat,
        ...(analysis?.identification ?? []),
        analysis?.nativeRange
    ].filter((clue): clue is string => typeof clue === "string" && clue.trim().length > 0);
    if (clues.length < 3) return null;
    const images = await artworkImages([{slug, alt: entry.name}]);
    if (!images.length) return null;
    const lesson = lessonEntry(slug);
    const facts = {
        animal: fighter(slug, entry.name, images, 1),
        clues,
        facts: [...(details?.whyInteresting ?? []), analysis?.summary].filter((fact): fact is string => typeof fact === "string" && fact.trim().length > 0),
        lookalikes: (details?.lookalikes ?? []).slice(0, 3),
        lesson: lesson?.coreLesson?.trim() ?? null
    };
    return {
        type: "guess",
        format: "guess",
        slug,
        title: `Guess the animal: ${entry.name}`,
        description: analysis?.summary ?? entry.name,
        url: getAbsoluteUrl("en", sourcePath("guess", slug)),
        tags: [entry.name, "guess the animal", "animal quiz"],
        text: [`Clues: ${clues.join(" | ")}`, `Facts: ${facts.facts.join(" | ")}`, facts.lookalikes.length ? `Often mistaken for: ${facts.lookalikes.join(" | ")}` : "", facts.lesson ? `Its lesson: ${facts.lesson}` : ""].filter(Boolean).join("\n"),
        images,
        species: await sourceSpecies([{slug, name: entry.name, image: 1}]),
        guess: facts
    };
}

export const BIRTH_MONTH_PREFIX = "birth-month-";

/**
 * Twelve headline animals for a "your birth month = your animal" carousel,
 * drawn from the slug's seed (birth-month-<seed>), so a re-render keeps the
 * same twelve. Their lessons are the records every month's trait is built on.
 */
export async function birthMonthSource(slug: string): Promise<VideoSource | null> {
    const seed = slug.slice(BIRTH_MONTH_PREFIX.length) || "0";
    let hash = 0;
    for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
    const pool = HEADLINE_LESSON_ANIMALS.filter((animal) => lessonEntry(animal));
    // A seeded shuffle: different twelve on each carousel.
    const order = pool.map((animal, index) => ({animal, key: ((hash ^ (index * 2654435761)) >>> 0) % 1000003})).sort((a, b) => a.key - b.key).map((entry) => entry.animal);
    const chosen: Array<{slug: string; name: string}> = [];
    const images: SourceImage[] = [];
    for (const animal of order) {
        if (chosen.length === 12) break;
        const name = lessonEntry(animal)?.displayName?.trim() || speciesName(animal);
        const url = await getResolvedSpeciesArtworkUrl(animal).catch(() => null);
        if (!url) continue;
        chosen.push({slug: animal, name});
        images.push({index: chosen.length, src: url, alt: name, caption: null, width: 1200, height: 900, license: null});
    }
    if (chosen.length < 12) return null;
    return {
        type: "lesson",
        format: "lesson",
        slug,
        title: "Your birth month is your animal",
        description: "Twelve animals, one for each birth month, and the trait you share with yours.",
        url: getAbsoluteUrl("en", "/animal-powers"),
        tags: ["birth month", "spirit animal", "animal personality"],
        text: chosen.map((animal) => {
            const entry = lessonEntry(animal.slug)!;
            return `${animal.name}: Power "${entry.principleName}"${entry.principleExpression ? ` (${entry.principleExpression})` : ""}. Lesson: ${entry.coreLesson}`;
        }).join("\n"),
        images,
        species: await sourceSpecies(chosen.map((animal, index) => ({slug: animal.slug, name: animal.name, image: index + 1})))
    };
}

/** A scan reveal: our own clips of the app scanning this animal, its result card and the animal itself (footage.ts). */
async function scanSource(slug: string): Promise<VideoSource | null> {
    const ref = (clip: FootageClip) => ({id: clip.id, path: clip.path, seconds: clip.seconds});
    const byKind = (kind: FootageClip["kind"]) => footageFor(slug, [kind]).sort((a, b) => b.seconds - a.seconds).map(ref);
    const clips = {scan: byKind("scan"), result: byKind("result"), animal: byKind("animal"), reaction: byKind("reaction")};
    if (!clips.scan.length && !clips.result.length) return null;
    const entry = getSpeciesBySlug(slug);
    const lesson = lessonEntry(slug);
    const name = entry?.name ?? lesson?.displayName?.trim() ?? speciesName(slug);
    // The artwork is only the fallback still and the end card's backdrop.
    const images = await artworkImages([{slug, alt: name}]);
    if (!images.length) return null;
    const facts = [
        ...(entry?.premiumDetails?.whyInteresting ?? []),
        ...(entry?.premiumDetails?.behaviorTraits ?? []),
        entry?.analysis?.summary,
        lesson?.biologicalBasis
    ].filter((fact): fact is string => typeof fact === "string" && fact.trim().length > 0);
    if (!facts.length) return null;
    return {
        type: "scan",
        format: "scan",
        slug,
        title: `I scanned a ${name}`,
        description: entry?.analysis?.summary ?? name,
        url: getAbsoluteUrl("en", sourcePath("scan", slug)),
        tags: [name, "animal scanner", "real footage"],
        text: facts.join("\n"),
        images,
        species: await sourceSpecies([{slug, name, image: 1}]),
        scan: {animal: fighter(slug, name, images, 1), clips, facts, lesson: lesson?.coreLesson?.trim() ?? null, power: lesson?.principleName?.trim() ?? null}
    };
}

/** The fewest source images a family's video can be made with: a lesson, a guess or a scan is one animal. */
export function minimumImages(type: SourceType) {
    return type === "lesson" || type === "guess" || type === "scan" ? 1 : 2;
}

export async function loadPageSource(type: SourceType, slug: string): Promise<VideoSource | null> {
    if (type === "lesson" && slug.startsWith(BIRTH_MONTH_PREFIX)) return birthMonthSource(slug);
    switch (type) {
        case "blog": return loadBlogSource(slug);
        case "comparison": return comparisonSource(slug);
        case "hybrid": return hybridSource(slug);
        case "fusion": return fusionSource(slug);
        case "ranking": return rankingSource(slug);
        case "location": return locationSource(slug);
        case "lesson": return lessonSource(slug);
        case "guess": return guessSource(slug);
        case "scan": return scanSource(slug);
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
        case "lesson": {
            // Demand before depth: headline animals, then animals with their own species page, then the rest.
            const headline = new Set<string>(HEADLINE_LESSON_ANIMALS);
            return lessonEntries.map((entry) => ({
                slug: entry.slug,
                title: `What the ${entry.displayName ?? speciesName(entry.slug)} teaches you`,
                publishedAt: now,
                imageCount: 1,
                priority: headline.has(entry.slug) ? 2 : getSpeciesBySlug(entry.slug) ? 1 : 0
            }));
        }
        case "scan":
            // The richest footage first: a scan or result shot plus the animal itself.
            return scanRevealSpecies().map((entry) => ({
                slug: entry.species,
                title: `I scanned a ${speciesName(entry.species)}`,
                publishedAt: now,
                imageCount: 1,
                priority: entry.kinds.includes("animal") && (entry.kinds.includes("result") || entry.kinds.length >= 3) ? 2 : 1
            }));
        case "guess": {
            // Famous animals make the best guesses (people get to be right); then those with a lesson to end on.
            const headline = new Set<string>(HEADLINE_LESSON_ANIMALS);
            return speciesEntries.map((entry) => ({
                slug: entry.slug,
                title: `Guess the animal: ${entry.name}`,
                publishedAt: now,
                imageCount: 1,
                priority: headline.has(entry.slug) ? 2 : lessonEntry(entry.slug) ? 1 : 0
            }));
        }
    }
}
