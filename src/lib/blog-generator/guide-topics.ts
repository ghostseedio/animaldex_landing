import {answerPages} from "@/data/answer-pages";
import type {MaterialFile} from "@/lib/blog-generator/materials";
import type {TopicIdea} from "@/lib/blog-generator/pipeline";
import {listSupportArticles} from "@/lib/support-articles";

// Search-led guides about using AnimalDex, for the blog auto-generate's search
// lane (after the problem-led pages in seo-topics.ts). Each targets what
// people type and is written from our own feature pages and help articles,
// attached as reference material, so the generator describes the product as
// it is: no invented features, prices or steps. Written once each, in order.
// Since Nov 2026 only the guides that fit "take any idea to an animal" stay
// in the queue: the identification, collecting, earning, Wildlife Guide and
// Instagram import guides left it with the topic policy (topic-policy.ts).

export type GuideTopic = {id: string; idea: TopicIdea; answerSlugs: string[]; helpCategories: string[]};

const PRODUCT_RULE = "For anything about how AnimalDex works (features, steps, credits, prices, availability, limits), use ONLY the attached AnimalDex documentation and never invent or round up; link the relevant AnimalDex pages. General animal facts come from research as usual. Make it practical: numbered steps, examples of what to ask, what the answers are built on, and a short FAQ.";

function guide(id: string, primaryKeyword: string, title: string, angle: string, hook: string, answerSlugs: string[], helpCategories: string[]): GuideTopic {
    return {
        id,
        answerSlugs,
        helpCategories,
        idea: {title, angle: `${angle} ${PRODUCT_RULE}`, hook, primaryKeyword, format: "guide", whyNow: `Search demand for "${primaryKeyword}"; AnimalDex product guide`, sources: []}
    };
}

export const GUIDE_TOPICS: GuideTopic[] = [
    guide("talk-to-animals-app", "talk to animals app", "How to Take Any Idea to an Animal on AnimalDex",
        "Step by step: pick an animal, tell it the idea, plan or decision in your own words, and what its answer is built on (a real behaviour of its species, not a translation of one animal's sounds). Show two worked examples (\"Start a podcast\", \"Move abroad\"): the usual answer, then the animal's take. Mention that the animals are AI.",
        "Ask a lion about your podcast idea and it starts by counting the room.", ["talk-to-animals", "learn-from-animals"], ["getting-started", "your-animals"]),
    guide("learn-from-animals", "what animals can teach us", "What Animals Can Teach You, Behaviour by Behaviour",
        "Real animal strategies (waiting, cooperating, moving on, building slowly), each told with its science, and how AnimalDex turns a species' real behaviour into a take on your own idea.",
        "A crocodile's best move is usually waiting.", ["learn-from-animals", "talk-to-animals"], ["your-animals"])
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
