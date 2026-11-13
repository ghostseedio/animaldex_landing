import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {dirname, join} from "node:path";
import test from "node:test";
import {fileURLToPath} from "node:url";

import {getTalkLandingPage, getTalkLandingPages, getTalkLandingSlugs, getTalkLandingStaticParams, resolveTalkLandingSlug, TALK_LANDING_SNAPSHOT} from "@/data/talk-landing-pages";
import {getExpandedRankingEntries, getRankingPage} from "@/data/rankings";
import {isPublishedAnimalSlug} from "@/lib/published-seo-slugs";
import {getPublishedSpeciesForContent} from "@/lib/static-species-overlay";
import {isSpeciesPageIndexable} from "@/lib/species-indexability";
import {isHumanSlug} from "@/lib/people-are-never-public";
import {
    TALK_LANDING_DESCRIPTION_MAX,
    talkLandingAnswers,
    talkLandingDescription,
    talkLandingFaq,
    talkLandingHeading,
    talkLandingOpening,
    talkLandingTitle,
    talkLandingWantsChat,
    type TalkLandingFacts
} from "@/lib/talk-landing";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const read = (relativePath: string) => readFileSync(join(root, relativePath), "utf8");

// MARK: - The snapshot list

test("the snapshot's 62 species all resolve to published, indexable species slugs", () => {
    const entries = TALK_LANDING_SNAPSHOT.entries;
    assert.equal(entries.length, 62);
    assert.equal(new Set(entries.map((entry) => entry.slug)).size, 62, "no slug twice");
    for (const entry of entries) {
        const slug = resolveTalkLandingSlug(entry.slug);
        assert.equal(slug, entry.slug, `${entry.slug} must be a published, indexable species slug (or be renamed in renamed-species-slugs.json)`);
        assert.ok(isPublishedAnimalSlug(slug), slug);
        assert.ok(!isHumanSlug(slug), "people are never public");
        const species = getPublishedSpeciesForContent(slug);
        assert.ok(species && species.slug === slug, slug);
        assert.ok(isSpeciesPageIndexable(species, slug), `${slug}: its /animals page must be indexable`);
    }
    assert.equal(getTalkLandingPages().length, 62);
    assert.deepEqual(getTalkLandingSlugs(), entries.map((entry) => entry.slug));
    // The measured top of species_chat_popularity (minus the one unpublished slug), the famous ones, the tier lists' #1s.
    assert.equal(entries.filter((entry) => entry.source === "chat_popularity").length, 14);
    assert.equal(entries.filter((entry) => entry.source === "tier_list_top").length, 12);
    assert.equal(entries.filter((entry) => entry.source === "fame").length, 36);
    assert.equal(entries[0].slug, "domestic-cat");
    assert.equal(resolveTalkLandingSlug("giant-oceanic-manta-ray"), null, "dropped: not a published slug");
    assert.equal(resolveTalkLandingSlug("human"), null);
    assert.equal(resolveTalkLandingSlug("definitely-not-a-real-animaldex-slug"), null);
});

test("each tier-list entry is the #1 of the tier list it names, as the ranking data has it", () => {
    for (const entry of TALK_LANDING_SNAPSHOT.entries.filter((item) => item.source === "tier_list_top")) {
        assert.ok(entry.tierList, `${entry.slug} names its tier list`);
        const page = getRankingPage(entry.tierList!);
        assert.ok(page, entry.tierList);
        assert.equal(getExpandedRankingEntries(page!)[0]?.speciesSlug, entry.slug, `${entry.tierList}'s #1`);
    }
});

test("the static params are the snapshot's slugs, English only", () => {
    const params = getTalkLandingStaticParams();
    assert.equal(params.length, 62);
    assert.ok(params.every((param) => param.locale === "en"));
    assert.deepEqual(params.map((param) => param.slug), getTalkLandingSlugs());
});

// MARK: - What each page says: field-guide lines only

/** The species entry's text for a cited field, so a page's lines can be checked against their source. */
function fieldText(slug: string, field: string, answer: string): string[] {
    const entry = getPublishedSpeciesForContent(slug)!;
    const guide = entry.databaseSource?.fieldGuide;
    switch (field) {
        case "fieldGuide.dietSummary": return [guide?.dietSummary ?? ""];
        case "fieldGuide.sleepPattern": return [guide?.sleepPattern ?? ""];
        case "fieldGuide.predatorsSummary": return [guide?.predatorsSummary ?? ""];
        case "fieldGuide.lifespanEstimate": return [guide?.lifespanEstimate ?? ""];
        case "fieldGuide.femaleOffspringNotes": return [guide?.femaleOffspringNotes ?? ""];
        case "fieldGuide.sexDifferenceNotes": return [guide?.sexDifferenceNotes ?? ""];
        case "analysis.habitat": return [entry.analysis.habitat];
        case "analysis.summary": return [entry.analysis.summary];
        case "analysis.identification": return [entry.analysis.identification.map((item) => item.replace(/\.?\s*$/, "")).join(". ") + "."];
        case "premiumDetails.behaviorTraits": return entry.premiumDetails.behaviorTraits;
        case "premiumDetails.whyInteresting": return entry.premiumDetails.whyInteresting;
        default: throw new Error(`${slug}: unknown field ${field} for "${answer.slice(0, 40)}"`);
    }
}

const normalize = (text: string) => text.replace(/\s+/g, " ").trim();

test("every page's opening, exchange and questions are verbatim lines of the species' own field guide", () => {
    for (const page of getTalkLandingPages()) {
        // No snapshot carries a greeting today, so the opening is a fact shown as a neutral intro.
        assert.equal(page.opening.kind, "fact", page.slug);
        if (page.opening.kind === "fact") {
            assert.ok(fieldText(page.slug, page.opening.field, page.opening.text).map(normalize).includes(normalize(page.opening.text)), `${page.slug}: opening from ${page.opening.field}`);
        }
        assert.ok(page.exchange, `${page.slug}: a sample exchange`);
        assert.ok(fieldText(page.slug, page.exchange!.field, page.exchange!.answer).map(normalize).includes(normalize(page.exchange!.answer)), `${page.slug}: exchange from ${page.exchange!.field}`);
        assert.equal(page.questions.length, 3, `${page.slug}: three suggested questions`);
        for (const item of page.questions) {
            assert.ok(fieldText(page.slug, item.field, item.answer).map(normalize).includes(normalize(item.answer)), `${page.slug}: "${item.prompt}" from ${item.field}`);
            assert.notEqual(normalize(item.answer), normalize(page.exchange!.answer), `${page.slug}: a question never repeats the exchange`);
            assert.notEqual(normalize(item.answer), normalize(page.opening.text), `${page.slug}: a question never repeats the opening`);
            assert.match(item.prompt, /\?$|\.$/, "addressed to the animal");
            assert.ok(item.question.includes(page.name), `${page.slug}: the FAQ question names the animal`);
        }
        assert.ok(page.speciesPath === `/animals/${page.slug}`);
    }
});

test("FAQ structured data only where all three answers are the catalogue's field guide", () => {
    const pages = getTalkLandingPages();
    const withFaq = pages.filter((page) => page.faq);
    const without = pages.filter((page) => !page.faq);
    assert.ok(withFaq.length >= 40, String(withFaq.length));
    for (const page of withFaq) {
        assert.equal(page.faq!.length, 3);
        assert.ok(page.questions.every((item) => item.field.startsWith("fieldGuide.")), page.slug);
        assert.deepEqual(page.faq, page.questions.map((item) => ({question: item.question, answer: item.answer})));
    }
    // The group pages (lion, tiger, dolphin…) have no catalogue field guide: questions, but no FAQ claim.
    for (const page of without) {
        assert.ok(page.questions.some((item) => !item.field.startsWith("fieldGuide.")), page.slug);
        assert.equal(getPublishedSpeciesForContent(page.slug)!.databaseSource?.fieldGuide.dietSummary ?? null, null, page.slug);
    }
    assert.ok(without.some((page) => page.slug === "lion"));
    assert.ok(withFaq.some((page) => page.slug === "cheetah"));
});

test("titles read \"Talk to a <Species> (AI): Ask It Anything\" and descriptions stay under 155 characters", () => {
    for (const page of getTalkLandingPages()) {
        assert.equal(page.title, `${page.heading} (AI): Ask It Anything`);
        assert.match(page.title, /^Talk to an? .+ \(AI\): Ask It Anything$/);
        assert.ok(page.description.length < 155, `${page.slug}: ${page.description.length} characters`);
        assert.ok(page.description.length <= TALK_LANDING_DESCRIPTION_MAX);
        assert.match(page.description, /^Talk to an? /);
        assert.doesNotMatch(page.description, /…/);
    }
    assert.equal(talkLandingHeading("Cheetah"), "Talk to a Cheetah");
    assert.equal(talkLandingHeading("Ostrich"), "Talk to an Ostrich");
    assert.equal(talkLandingHeading("African Bush Elephant"), "Talk to an African Bush Elephant");
    assert.equal(talkLandingTitle("Gray Wolf"), "Talk to a Gray Wolf (AI): Ask It Anything");
    assert.equal(getTalkLandingPage("ostrich")!.title, "Talk to an Ostrich (AI): Ask It Anything");
    assert.equal(getTalkLandingPage("cheetah")!.description, "Talk to a Cheetah, an AI that answers from its real field guide. Ask what it eats, where it lives and what it fears. Free, in your browser.");
});

// MARK: - The pure helpers

const FACTS: TalkLandingFacts = {
    name: "Cheetah",
    greeting: null,
    summary: "Cheetahs are lightly built sprinting cats designed for speed, visual tracking, and short decisive chases.",
    habitat: "Open savanna, grassland, semi-desert, and lightly wooded plains with enough cover for the approach.",
    identification: ["Slender build with a deep chest", "Black tear marks from eye to mouth"],
    behaviorTraits: ["Stalks close before a short sprint, then rests after the chase."],
    interestingFacts: ["Cheetahs are extreme examples of trade-offs built around acceleration and turning control."],
    fieldGuide: {
        dietSummary: "Mainly small and medium antelopes, such as Thomson's gazelle, with hares and the young of larger antelopes.",
        predatorsSummary: "Lions, hyenas, leopards and wild dogs threaten cheetahs or steal kills.",
        sleepPattern: "Cheetahs are mainly diurnal or crepuscular, hunting when visibility favors precision.",
        lifespanEstimate: "Cheetahs often live around 10 to 12 years in the wild when they survive cubhood.",
        femaleOffspringNotes: null,
        sexDifferenceNotes: null
    },
    powerName: "Spring-Loaded Spine"
};

test("the opening is the greeting when the data has one, else the first fact as a neutral intro", () => {
    assert.deepEqual(talkLandingOpening(FACTS), {kind: "fact", text: FACTS.interestingFacts[0], field: "premiumDetails.whyInteresting"});
    assert.deepEqual(talkLandingOpening({...FACTS, greeting: "Keep up if you can."}), {kind: "greeting", text: "Keep up if you can."});
    assert.deepEqual(talkLandingOpening({...FACTS, interestingFacts: []}), {kind: "fact", text: FACTS.behaviorTraits[0], field: "premiumDetails.behaviorTraits"});
    assert.deepEqual(talkLandingOpening({...FACTS, interestingFacts: [], behaviorTraits: []}), {kind: "fact", text: FACTS.summary, field: "analysis.summary"});
    // The catalogue's placeholder copy is never quoted.
    assert.deepEqual(talkLandingOpening({...FACTS, interestingFacts: ["Recognized in AnimalDex as Cheetah, indexed profile #789 of the catalog"]}), {kind: "fact", text: FACTS.behaviorTraits[0], field: "premiumDetails.behaviorTraits"});
});

test("the exchange is the first field-guide field, the questions the next three, each verbatim", () => {
    const {exchange, questions} = talkLandingAnswers(FACTS);
    assert.deepEqual(exchange, {prompt: "What do you eat?", question: "What does the Cheetah eat?", topic: "Diet", answer: FACTS.fieldGuide!.dietSummary, field: "fieldGuide.dietSummary"});
    assert.deepEqual(questions.map((item) => item.field), ["fieldGuide.sleepPattern", "fieldGuide.predatorsSummary", "fieldGuide.lifespanEstimate"]);
    assert.equal(questions[1].answer, FACTS.fieldGuide!.predatorsSummary);
    assert.deepEqual(talkLandingFaq(questions), questions.map((item) => ({question: item.question, answer: item.answer})));
    // Without the catalogue's field guide, the page falls back to its own habitat and facts, and claims no FAQ.
    const bare = talkLandingAnswers({...FACTS, fieldGuide: null});
    assert.equal(bare.exchange?.field, "analysis.habitat");
    assert.deepEqual(bare.questions.map((item) => item.field), ["analysis.identification", "premiumDetails.behaviorTraits", "analysis.summary"]);
    assert.equal(talkLandingFaq(bare.questions), null);
    assert.equal(talkLandingFaq(questions.slice(0, 2)), null, "fewer than three questions: no FAQ");
    // A field the opening already quoted is not asked again.
    const repeated = talkLandingAnswers({...FACTS, fieldGuide: null, interestingFacts: [FACTS.interestingFacts[0]]});
    assert.ok(repeated.questions.every((item) => item.answer !== FACTS.interestingFacts[0]));
});

test("the description names only topics the field guide can answer", () => {
    assert.equal(talkLandingDescription(FACTS), "Talk to a Cheetah, an AI that answers from its real field guide. Ask what it eats, where it lives and what it fears. Free, in your browser.");
    assert.equal(talkLandingDescription({...FACTS, fieldGuide: null, powerName: null}), "Talk to a Cheetah, an AI that answers from its real field guide. Ask where it lives and how it lives. Free, in your browser.");
    const long = talkLandingDescription({...FACTS, name: "Extraordinarily Long Named Imaginary Antelope Of The Plains"});
    assert.ok(long.length <= TALK_LANDING_DESCRIPTION_MAX, long);
});

// MARK: - The route: the landing is the signed-out render; the chat is one cookie or query away

test("a signed-in reader, a card, a carried question or ?chat=1 gets the chat; anyone else the landing", () => {
    assert.equal(talkLandingWantsChat("", ""), false);
    assert.equal(talkLandingWantsChat("?utm_source=x", "adx_ft=1; animaldex-theme=light"), false);
    assert.equal(talkLandingWantsChat("?chat=1", ""), true);
    assert.equal(talkLandingWantsChat("?ask=Should%20I%20wait", ""), true);
    assert.equal(talkLandingWantsChat("?card=00000000-0000-4000-8000-0000000000c1", ""), true);
    assert.equal(talkLandingWantsChat("", "sb-wwhsdzpczekgdlobwaej-auth-token=abc"), true);
});

test("the talk route serves the landing from the snapshot and keeps the chat for every other slug", () => {
    const page = read("app/[locale]/talk/[slug]/page.tsx");
    assert.match(page, /export const revalidate = 86400/);
    assert.match(page, /export const dynamicParams = true/);
    assert.match(page, /return getTalkLandingStaticParams\(\);/);
    assert.match(page, /if \(isTalkLandingSlug\(params\.slug\)\)/);
    assert.match(page, /const landing = getTalkLandingPage\(params\.slug\);\n    if \(landing\) return talkLandingMetadata\(landing, params\.locale\);/);
    assert.match(page, /alternates: englishOnlyLanguageAlternates\(path\)/);
    assert.match(page, /title: templateSafeTitle\(page\.title\)/);
    // The chat's own metadata and resolution stay after the landing's early return.
    assert.match(page, /robots: \{index: false, follow: true/);
    assert.match(page, /resolveTalkPage\(params\.slug\)/);
    assert.match(page, /<TalkChat/);
    assert.match(page, /await TalkLanding\(\{page: landing, locale: params\.locale\}\)/);

    const landing = read("app/[locale]/talk/[slug]/talk-landing.tsx");
    assert.doesNotMatch(landing, /talk-animals|supabase/i, "the landing never reads the catalogue");
    assert.match(landing, /<SpeciesAskAnimalDex/);
    assert.match(landing, /<AskSubjectBridge scope="species"/);
    assert.match(landing, /<SpeciesArtworkImage/);
    assert.match(landing, /<StoreLink store="app_store" placement="page_talk"/);
    assert.match(landing, /<StoreLink store="google_play" placement="page_talk"/);
    assert.match(landing, /href=\{page\.speciesPath\}/);
    assert.match(landing, /"@type": "FAQPage"/);
    assert.match(landing, /if \(page\.faq\) \{/);
    assert.match(landing, /TODO\(CC 2\)/);
    assert.match(landing, /TODO\(CC 3\)/);
    // The artwork goes through the redirecting route, so the image is unoptimized (SpeciesArtworkImage does that).
    assert.match(read("app/[locale]/(composited)/animals/species-artwork-image.tsx"), /unoptimized/);

    const sw = read("app/[locale]/talk/[slug]/talk-landing-switch.tsx");
    assert.match(sw, /return <TalkChat key=\{slug\} slug=\{slug\} name=\{name\} power=\{power\} locale=\{locale\} \/>;/);
    assert.match(sw, /talkLandingWantsChat\(window\.location\.search, document\.cookie\)/);

    const data = read("data/talk-landing-pages.ts");
    assert.doesNotMatch(data, /talk-animals|supabase|fetch\(/, "built from the snapshots alone");
    assert.match(data, /getPublishedSpeciesForContent/);
    assert.match(data, /isSpeciesPageIndexable/);
});

test("the sitemap lists every landing page, English only, and the id branch none", () => {
    const sitemap = read("lib/build-sitemap.ts");
    const idBranch = sitemap.slice(sitemap.indexOf("if (locale !== localeConfig.defaultLocale)"), sitemap.indexOf("const staticEntries"));
    assert.match(sitemap.slice(sitemap.indexOf("const staticEntries")), /getTalkLandingPages\(\)\.map\(\(page\) => \(\{url: getAbsoluteUrl\(locale, `\/talk\/\$\{page\.slug\}`\)/);
    assert.doesNotMatch(idBranch, /getTalkLandingPages/);
    const urls = getTalkLandingPages().map((page) => `/talk/${page.slug}`);
    assert.equal(urls.length, 62);
    assert.ok(urls.includes("/talk/gray-wolf"));
    assert.ok(getTalkLandingPages().every((page) => !Number.isNaN(Date.parse(page.updatedAt))));
});
