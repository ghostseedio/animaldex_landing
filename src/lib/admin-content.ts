import "server-only";
import type {BlogPost} from "@/data/blog/types";
import {blogPosts, getIndexedBlogPosts} from "@/data/blog";
import {answerPages} from "@/data/answer-pages";
import {getSupabaseHeaders, getSupabaseServiceKey, getSupabaseUrl} from "@/lib/supabase-http";

type ContentEntry = {
    id: string;
    content_type: "blog" | "page";
    slug: string;
    payload: unknown;
    is_published: boolean;
    created_at: string;
    updated_at: string;
};

const additionalEditablePages = [
    {slug: "animal-card-collection", title: "Animal Card Collection"},
    {slug: "animal-card-deck-creator", title: "Animal Card Deck Creator"},
    {slug: "animal-collection-game", title: "Animal Collection Game"},
    {slug: "animal-hybrids", title: "Animal Hybrids"},
    {slug: "animal-lessons", title: "Animal Lessons"},
    {slug: "animal-symbolism", title: "Animal Symbolism"},
    {slug: "animal-wisdom", title: "Animal Wisdom"},
    {slug: "animals", title: "Animals"},
    {slug: "blog", title: "AnimalDex Blog"},
    {slug: "branding", title: "AnimalDex Branding"},
    {slug: "capture-animals-app", title: "Capture Animals App"},
    {slug: "challenges", title: "Animal Challenges"},
    {slug: "collect-real-animals-app", title: "Collect Real Animals App"},
    {slug: "comparisons", title: "Animal Comparisons"},
    {slug: "contact", title: "Contact"},
    {slug: "custom-animal-card-deck", title: "Custom Animal Card Deck"},
    {slug: "legendary-earth-beasts", title: "Legendary Earth Beasts"},
    {slug: "locations", title: "Animal Locations"},
    {slug: "pokemon-animals", title: "Pokemon Animals"},
    {slug: "pokemon-like-animal-game", title: "Pokemon-Like Animal Game"},
    {slug: "qualities", title: "Animal Qualities"},
    {slug: "rankings", title: "Animal Rankings"},
    {slug: "support", title: "Support"},
    {slug: "tier-list", title: "Animal Tier Lists"},
    {slug: "top-trumps-animal-game", title: "Top Trumps Animal Game"},
    {slug: "use-cases", title: "AnimalDex Use Cases"},
    {slug: "what-animal-am-i", title: "What Animal Am I?"}
] satisfies Array<{slug: string; title: string}>;

function config() {
    const url = getSupabaseUrl();
    const key = getSupabaseServiceKey();
    return url && key ? {url, key} : null;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const resolved = config();
    if (!resolved) throw new Error("Supabase admin content storage is not configured");

    const response = await fetch(`${resolved.url}/rest/v1/${path}`, {
        ...init,
        headers: getSupabaseHeaders(resolved.key, {
            Accept: "application/json",
            ...(init?.body ? {"Content-Type": "application/json"} : {}),
            ...(init?.headers as Record<string, string> | undefined)
        }),
        cache: "no-store"
    });

    if (!response.ok) {
        throw new Error(`Content storage failed (${response.status}): ${await response.text()}`);
    }

    return response.status === 204 ? null as T : await response.json() as T;
}

export async function getContentEntry(type: "blog" | "page", slug: string) {
    const rows = await request<ContentEntry[]>(
        `admin_content_entries?content_type=eq.${encodeURIComponent(type)}&slug=eq.${encodeURIComponent(slug)}&limit=1`
    );
    return rows[0] ?? null;
}

export async function listContentEntries(type: "blog" | "page") {
    return request<ContentEntry[]>(
        `admin_content_entries?content_type=eq.${type}&select=id,content_type,slug,payload,is_published,created_at,updated_at&order=updated_at.desc`
    );
}

export async function saveContentEntry(type: "blog" | "page", slug: string, payload: unknown, isPublished = true) {
    const rows = await request<ContentEntry[]>("admin_content_entries?on_conflict=content_type,slug", {
        method: "POST",
        headers: {Prefer: "resolution=merge-duplicates,return=representation"},
        body: JSON.stringify({
            content_type: type,
            slug,
            payload,
            is_published: isPublished,
            updated_at: new Date().toISOString()
        })
    });
    return rows[0];
}

function isBlogPost(value: unknown): value is BlogPost {
    if (!value || typeof value !== "object") return false;
    const post = value as Partial<BlogPost>;
    return typeof post.slug === "string"
        && typeof post.title === "string"
        && typeof post.description === "string"
        && Array.isArray(post.sections)
        && Boolean(post.featuredImage?.src);
}

export async function getManagedBlogPost(slug: string) {
    try {
        const entry = await getContentEntry("blog", slug);
        if (entry?.is_published && isBlogPost(entry.payload)) return entry.payload;
    } catch (error) {
        console.warn("[admin-content] Falling back to compiled blog post", {
            slug,
            error: error instanceof Error ? error.message : "Unknown error"
        });
    }
    return blogPosts.find((post) => post.slug === slug);
}

export async function getManagedBlogPosts() {
    const compiled = getIndexedBlogPosts();
    try {
        const overrides = await listContentEntries("blog");
        const overrideMap = new Map(
            overrides
                .filter((entry) => entry.is_published && isBlogPost(entry.payload))
                .map((entry) => [entry.slug, entry.payload as BlogPost])
        );
        const merged = compiled.map((post) => overrideMap.get(post.slug) ?? post);
        const compiledSlugs = new Set(compiled.map((post) => post.slug));
        overrides.forEach((entry) => {
            if (entry.is_published && isBlogPost(entry.payload) && !compiledSlugs.has(entry.slug)) {
                merged.push(entry.payload);
            }
        });
        return merged.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
    } catch (error) {
        console.warn("[admin-content] Falling back to compiled blog index", {
            error: error instanceof Error ? error.message : "Unknown error"
        });
        return compiled;
    }
}

export async function getManagedPage(slug: string) {
    try {
        const entry = await getContentEntry("page", slug);
        return entry?.is_published && isBlogPost(entry.payload) ? entry.payload : null;
    } catch (error) {
        console.warn("[admin-content] Unable to load managed page", {
            slug,
            error: error instanceof Error ? error.message : "Unknown error"
        });
        return null;
    }
}

export async function getManagedPages() {
    try {
        return (await listContentEntries("page"))
            .filter((entry) => entry.is_published && isBlogPost(entry.payload))
            .map((entry) => entry.payload as BlogPost);
    } catch {
        return [];
    }
}

export function getCompiledBlogSummaries() {
    return blogPosts.map((post) => ({
        slug: post.slug,
        title: post.title,
        description: post.description,
        featuredImage: post.featuredImage,
        updatedAt: post.updatedAt ?? post.publishedAt
    }));
}

function answerPageToManagedPage(entry: (typeof answerPages)[number]): BlogPost {
    const bestAppQuickAnswer = entry.slug === "best-animal-identification-app" ? [{
        title: "Five excellent apps. Five different jobs.",
        paragraphs: [],
        html: `<section aria-labelledby="quick-answer" class="overflow-hidden rounded-[2.25rem] border border-line-300 bg-surface-900/70 shadow-2xl">
  <div class="border-b border-line-300 bg-gradient-to-r from-primary-500/15 to-transparent px-6 py-6 md:px-10">
    <p class="text-xs font-black uppercase tracking-[0.2em] text-primary-200">Quick answer</p>
    <h2 id="quick-answer" class="mt-1 font-display text-3xl font-bold text-white md:text-5xl">Five excellent apps. Five different jobs.</h2>
  </div>
  <div class="divide-y divide-line-300">
    <div class="grid gap-2 px-6 py-6 md:grid-cols-[2.2rem_18rem_1fr] md:items-center md:px-10">
      <span class="font-display text-2xl font-bold text-ink-500">01</span>
      <div><p class="text-xs font-black uppercase tracking-[0.14em] text-primary-200">Best overall for collecting + learning</p><h3 class="mt-1 text-2xl font-bold text-white">AnimalDex</h3></div>
      <p class="text-base leading-7 text-ink-200">Turns sightings into a collection and learning system.</p>
    </div>
    <div class="grid gap-2 px-6 py-6 md:grid-cols-[2.2rem_18rem_1fr] md:items-center md:px-10">
      <span class="font-display text-2xl font-bold text-ink-500">02</span>
      <div><p class="text-xs font-black uppercase tracking-[0.14em] text-sky-300">Best for wildlife science</p><h3 class="mt-1 text-2xl font-bold text-white">iNaturalist</h3></div>
      <p class="text-base leading-7 text-ink-200">Community-reviewed observations that can support research.</p>
    </div>
    <div class="grid gap-2 px-6 py-6 md:grid-cols-[2.2rem_18rem_1fr] md:items-center md:px-10">
      <span class="font-display text-2xl font-bold text-ink-500">03</span>
      <div><p class="text-xs font-black uppercase tracking-[0.14em] text-amber-300">Best for beginners and families</p><h3 class="mt-1 text-2xl font-bold text-white">Seek</h3></div>
      <p class="text-base leading-7 text-ink-200">Private, approachable, offline and built around exploration.</p>
    </div>
    <div class="grid gap-2 px-6 py-6 md:grid-cols-[2.2rem_18rem_1fr] md:items-center md:px-10">
      <span class="font-display text-2xl font-bold text-ink-500">04</span>
      <div><p class="text-xs font-black uppercase tracking-[0.14em] text-rose-300">Best bird specialist</p><h3 class="mt-1 text-2xl font-bold text-white">Merlin Bird ID</h3></div>
      <p class="text-base leading-7 text-ink-200">Excellent photo, sound and step-by-step bird identification.</p>
    </div>
    <div class="grid gap-2 px-6 py-6 md:grid-cols-[2.2rem_18rem_1fr] md:items-center md:px-10">
      <span class="font-display text-2xl font-bold text-ink-500">05</span>
      <div><p class="text-xs font-black uppercase tracking-[0.14em] text-violet-300">Best general visual search</p><h3 class="mt-1 text-2xl font-bold text-white">Google Lens</h3></div>
      <p class="text-base leading-7 text-ink-200">Fastest route from almost any image to broad web results.</p>
    </div>
  </div>
</section>`
    }] : [];

    return {
        slug: entry.slug,
        title: entry.heroTitle,
        description: entry.metaDescription,
        publishedAt: entry.updatedAt,
        updatedAt: entry.updatedAt,
        featuredImage: {
            src: "/images/og.png",
            alt: `${entry.shortTitle} — AnimalDex`,
            width: 1200,
            height: 630
        },
        readingMinutes: Math.max(4, Math.ceil([
            ...entry.directAnswer,
            ...entry.howItWorks,
            ...entry.comparisonTypical,
            ...entry.comparisonAnimalDex,
            ...entry.whoItsFor,
            ...entry.features.map((feature) => feature.description),
            ...entry.faq.map((item) => item.answer)
        ].join(" ").split(/\s+/).length / 220)),
        author: "AnimalDex Editorial Team",
        tags: ["AnimalDex guide"],
        searchIntents: entry.searchIntents,
        speciesSlugs: entry.speciesSlugs,
        sections: [
            ...bestAppQuickAnswer,
            {kicker: "Overview", title: "The direct answer", paragraphs: entry.directAnswer},
            {kicker: "Workflow", title: "How it works", paragraphs: entry.howItWorks},
            {
                kicker: "Why AnimalDex",
                title: "What makes AnimalDex different",
                paragraphs: entry.comparisonAnimalDex
            },
            {
                kicker: "Who it is for",
                title: "Designed for real animal discovery",
                paragraphs: entry.whoItsFor
            },
            ...entry.features.map((feature) => ({
                kicker: "Feature",
                title: feature.title,
                paragraphs: [feature.description]
            })),
            ...entry.faq.map((item) => ({
                kicker: "FAQ",
                title: item.question,
                paragraphs: [item.answer]
            }))
        ]
    };
}

function additionalPageToManagedPage(entry: (typeof additionalEditablePages)[number]): BlogPost {
    const now = new Date().toISOString().slice(0, 10);
    return {
        slug: entry.slug,
        title: entry.title,
        description: `${entry.title} page on AnimalDex.`,
        publishedAt: now,
        updatedAt: now,
        featuredImage: {
            src: "/images/og.png",
            alt: `${entry.title} — AnimalDex`,
            width: 1200,
            height: 630
        },
        readingMinutes: 4,
        author: "AnimalDex Editorial Team",
        tags: ["AnimalDex page"],
        searchIntents: [entry.title.toLowerCase(), "AnimalDex"],
        speciesSlugs: [],
        sections: [{
            kicker: "Live page",
            title: entry.title,
            paragraphs: [`This page is source-migrated from /${entry.slug} when opened in the admin editor.`]
        }]
    };
}

export function getCompiledPage(slug: string) {
    const entry = answerPages.find((page) => page.slug === slug);
    if (entry) return answerPageToManagedPage(entry);
    const additional = additionalEditablePages.find((page) => page.slug === slug);
    return additional ? additionalPageToManagedPage(additional) : null;
}

export function getCompiledPageSummaries() {
    const answerSummaries = answerPages.map((entry) => {
        const page = answerPageToManagedPage(entry);
        return {
            slug: page.slug,
            title: page.title,
            description: page.description,
            featuredImage: page.featuredImage,
            updatedAt: page.updatedAt ?? page.publishedAt
        };
    });
    const existingSlugs = new Set(answerSummaries.map((page) => page.slug));
    const additionalSummaries = additionalEditablePages
        .filter((page) => !existingSlugs.has(page.slug))
        .map((page) => {
            const compiled = additionalPageToManagedPage(page);
            return {
                slug: compiled.slug,
                title: compiled.title,
                description: compiled.description,
                featuredImage: compiled.featuredImage,
                updatedAt: compiled.updatedAt ?? compiled.publishedAt
            };
        });
    return [...answerSummaries, ...additionalSummaries].sort((left, right) => left.title.localeCompare(right.title));
}

export async function getManagedPageSummaries() {
    const compiled = getCompiledPageSummaries();
    try {
        const overrides = await listContentEntries("page");
        const overrideMap = new Map(
            overrides
                .filter((entry) => entry.is_published && isBlogPost(entry.payload))
                .map((entry) => [entry.slug, entry.payload as BlogPost])
        );
        const merged = compiled.map((page) => {
            const override = overrideMap.get(page.slug);
            return override ? {
                slug: override.slug,
                title: override.title,
                description: override.description,
                featuredImage: override.featuredImage,
                updatedAt: override.updatedAt ?? override.publishedAt
            } : page;
        });
        const compiledSlugs = new Set(compiled.map((page) => page.slug));
        overrides.forEach((entry) => {
            if (entry.is_published && isBlogPost(entry.payload) && !compiledSlugs.has(entry.slug)) {
                const page = entry.payload;
                merged.push({
                    slug: page.slug,
                    title: page.title,
                    description: page.description,
                    featuredImage: page.featuredImage,
                    updatedAt: page.updatedAt ?? page.publishedAt
                });
            }
        });
        return merged.sort((left, right) => left.title.localeCompare(right.title));
    } catch {
        return compiled;
    }
}
