import {answerPages} from "@/data/answer-pages";
import type {MaterialFile} from "@/lib/blog-generator/materials";
import type {TopicIdea} from "@/lib/blog-generator/pipeline";
import {listSupportArticles} from "@/lib/support-articles";

// Search-led guides about using AnimalDex, for the blog auto-generate's second
// daily slot (alternating with seo-topics.ts). Each targets what people type
// ("identify animal from photo", "real life pokemon app") and is written from
// our own feature pages and help articles, attached as reference material, so
// the generator describes the product as it is: no invented features, prices
// or steps. Written once each, in order.

export type GuideTopic = {id: string; idea: TopicIdea; answerSlugs: string[]; helpCategories: string[]};

const PRODUCT_RULE = "For anything about how AnimalDex works (features, steps, credits, prices, availability, limits), use ONLY the attached AnimalDex documentation and never invent or round up; link the relevant AnimalDex pages. General animal facts come from research as usual. Make it practical: numbered steps, tips that make the result better, what to do when it goes wrong, and a short FAQ.";

function guide(id: string, primaryKeyword: string, title: string, angle: string, hook: string, answerSlugs: string[], helpCategories: string[]): GuideTopic {
    return {
        id,
        answerSlugs,
        helpCategories,
        idea: {title, angle: `${angle} ${PRODUCT_RULE}`, hook, primaryKeyword, format: "guide", whyNow: `Search demand for "${primaryKeyword}"; AnimalDex product guide`, sources: []}
    };
}

export const GUIDE_TOPICS: GuideTopic[] = [
    guide("talk-to-animals-app", "talk to animals app", "How to Talk to Any Animal on AnimalDex",
        "Step by step: pick or scan an animal, open the chat, what to ask, and what the answers are based on (the species' real biology, not a translation of one animal).",
        "You can ask a cheetah why it naps 18 hours a day, and it answers as a cheetah.", ["talk-to-animals", "learn-from-animals"], ["getting-started"]),
    guide("identify-animal-from-photo", "identify animal from photo", "How to Identify Any Animal From a Photo",
        "How photo identification works, how to take a photo that identifies well (distance, angle, light, several features in frame), gallery uploads, and what to do with a wrong or uncertain result.",
        "The best identification photo is rarely the prettiest one.", ["animal-identifier-app", "ai-animal-scanner", "best-animal-identification-app"], ["scanning-captures", "identification"]),
    guide("identify-bird-by-photo", "identify bird by photo", "How to Identify a Bird From a Photo",
        "Field marks that matter (bill, wing bars, eye ring, tail), photographing birds that will not sit still, and identifying them with AnimalDex.",
        "Two birds can look identical until you check one small mark near the eye.", ["identify-birds"], ["identification", "scanning-captures"]),
    guide("insect-identifier", "insect identifier", "Insect Identifier: How to Name Any Bug From a Photo",
        "Photographing insects and spiders well, the features that separate lookalikes, and identifying them with AnimalDex.",
        "Most insects are identified by details smaller than a grain of rice.", ["identify-insects"], ["identification", "scanning-captures"]),
    guide("snake-identifier", "snake identifier", "How to Identify a Snake or Lizard From a Photo, Safely",
        "Safety first (distance, never handle), what a photo can and cannot tell you, identifying reptiles with AnimalDex, and why no app should decide whether a snake is safe to approach.",
        "Colour rhymes and head shape are both unreliable rules for venomous snakes.", ["identify-reptiles"], ["identification"]),
    guide("dog-breed-identifier", "dog breed identifier", "What Breed Is My Dog? How to Find Out From a Photo",
        "What a photo can tell you about a dog's breed or mix, its limits next to a DNA test, and how AnimalDex handles pets and breeds.",
        "Most dogs in shelters are mixes, and photos are often wrong about which.", ["identify-pets", "animal-breed-grading-app"], ["animaldex-numbers", "identification"]),
    guide("real-life-pokemon-app", "real life pokemon app", "Pokémon Go With Real Animals: How AnimalDex Works",
        "The collecting loop with real animals: scan, collect, numbers, rarity and grades, cards and battles, and how it differs from catching virtual creatures.",
        "Every card in your collection is an animal you actually saw.", ["pokemon-like-animal-app", "animal-collection-app", "what-is-animal-collecting"], ["collections-cards", "animaldex-numbers"]),
    guide("animal-collection-app", "animal collection app", "How to Build an Animal Collection and Find the Rare Ones",
        "Where and when to look, how rarity works, rescanning and upgrading, group cards versus species cards, and planning trips around what you have not collected.",
        "Some of the rarest animals you can collect live in an ordinary garden.", ["animal-collection-app", "wildlife-discovery-app"], ["collections-cards", "animaldex-numbers"]),
    guide("earn-from-wildlife-photos", "earn money from wildlife photos", "How to Earn From Your Wildlife Photos on AnimalDex",
        "What Credits, Earnings and Creator Rewards are, how they are earned, what they are and are not worth, and realistic expectations.",
        "Not every reward is money, and the difference matters.", ["sell-custom-animal-cards"], ["earnings", "credits-purchases"]),
    guide("become-a-wildlife-guide", "become a wildlife guide", "How to Become a Local Wildlife Guide on AnimalDex",
        "What a Wildlife Guide is on AnimalDex, how to make one for your area, and how purchases and payments work.",
        "Your local park's wildlife is a guide someone nearby wants.", [], ["wildlife-guides"]),
    guide("import-instagram-wildlife", "import wildlife photos from instagram", "Turn Your Instagram Wildlife Photos Into an Animal Collection",
        "Connecting Instagram, how posts are screened for animals, confirming species and locations, Reels, costs, and what happens after import.",
        "Years of wildlife posts can become a collection in minutes.", [], ["instagram-import"]),
    guide("learn-from-animals", "what animals can teach us", "What Animals Can Teach You, and How AnimalDex Turns It Into Lessons",
        "Real animal strategies (patience, cooperation, adaptation) and how AnimalDex reads a lesson from each animal's biology.",
        "A crocodile's best move is usually waiting.", ["learn-from-animals"], [])
];

/** The next guide not yet written, in list order. */
export function nextGuideTopic(done: ReadonlySet<string>): GuideTopic | null {
    return GUIDE_TOPICS.find((entry) => !done.has(entry.id)) ?? null;
}

function answerPageMarkdown(slug: string) {
    const page = answerPages.find((entry) => entry.slug === slug);
    if (!page) return null;
    const list = (items: string[]) => items.map((item) => `- ${item}`).join("\n");
    return [
        `# ${page.heroTitle} (https://animaldex.app/${page.slug})`,
        page.intro,
        "## Direct answer", list(page.directAnswer),
        "## How it works", list(page.howItWorks),
        "## What AnimalDex does differently", list(page.comparisonAnimalDex),
        "## Who it is for", list(page.whoItsFor),
        "## Features", page.features.map((feature) => `- ${feature.title}: ${feature.description}`).join("\n"),
        "## FAQ", page.faq.map((item) => `Q: ${item.question}\nA: ${item.answer}`).join("\n\n")
    ].join("\n\n");
}

/** The guide's reference material: its feature pages and its help-centre categories, as Markdown files. */
export function guideMaterials(topic: GuideTopic): MaterialFile[] {
    const files: MaterialFile[] = [];
    for (const slug of topic.answerSlugs) {
        const markdown = answerPageMarkdown(slug);
        if (markdown) files.push({name: `animaldex-${slug}.md`, data: Buffer.from(markdown, "utf8")});
    }
    const articles = listSupportArticles().filter((article) => topic.helpCategories.includes(article.categorySlug) && article.status === "published");
    if (articles.length) {
        const markdown = articles.map((article) => `## ${article.title} (https://animaldex.app/support/${article.categorySlug}/${article.slug})\n\n${article.body}`).join("\n\n");
        files.push({name: "animaldex-help-centre.md", data: Buffer.from(`# AnimalDex help centre\n\n${markdown}`, "utf8")});
    }
    return files;
}
