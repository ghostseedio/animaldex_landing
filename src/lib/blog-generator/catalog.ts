import "server-only";
import {ANIMAL_HYBRID_CANONICAL_BASE_PATH, animalHybridEntries} from "@/data/animal-hybrids";
import {blogPosts} from "@/data/blog";
import {getSitemapSpeciesEntries} from "@/data/database-species-pages";
import {locationPages} from "@/data/locations";
import publishedComparisons from "@/data/published-seo-comparison-pages.json";
import {RANKING_CANONICAL_BASE_PATH, rankingPages} from "@/data/rankings";
import {speciesEntries} from "@/data/species";
import {listContentEntries} from "@/lib/admin-content";

// Everything a generated article may link to on our own site. The writer only
// ever sees paths from here, and every internal link in its draft is checked
// against the same set, so a hallucinated URL never reaches a live page.

export type CatalogKind = "species" | "comparison" | "hybrid" | "ranking" | "location" | "blog" | "hub";

export type CatalogItem = {kind: CatalogKind; title: string; href: string; slug: string};

const HUBS: CatalogItem[] = [
    {kind: "hub", title: "Animal encyclopedia (every species)", href: "/animals", slug: "animals"},
    {kind: "hub", title: "Animal comparisons: who would win", href: "/comparisons", slug: "comparisons"},
    {kind: "hub", title: "Animal Hybrid Lab and fusions", href: "/animal-hybrids", slug: "animal-hybrids"},
    {kind: "hub", title: "Animal tier lists and rankings", href: "/tier-list", slug: "tier-list"},
    {kind: "hub", title: "Where to see animals: location guides", href: "/locations", slug: "locations"},
    {kind: "hub", title: "Animal qualities library", href: "/qualities", slug: "qualities"},
    {kind: "hub", title: "Animal behaviours", href: "/animal-behaviours", slug: "animal-behaviours"},
    {kind: "hub", title: "Legendary Earth beasts", href: "/legendary-earth-beasts", slug: "legendary-earth-beasts"},
    {kind: "hub", title: "Pokémon and their real animal matches", href: "/pokemon-animals", slug: "pokemon-animals"},
    {kind: "hub", title: "Animal challenges", href: "/challenges", slug: "challenges"},
    {kind: "hub", title: "Capture animals app (AnimalDex)", href: "/capture-animals-app", slug: "capture-animals-app"},
    {kind: "hub", title: "Wildlife experiences and guides", href: "/wildlife-experiences", slug: "wildlife-experiences"},
    {kind: "hub", title: "AnimalDex blog", href: "/blog", slug: "blog"}
];

type ComparisonFile = {entries: Array<{slug: string; title: string}>};

let staticCatalog: CatalogItem[] | null = null;

function buildStaticCatalog(): CatalogItem[] {
    return [
        ...HUBS,
        ...speciesEntries.map((entry) => ({kind: "species" as const, title: entry.name, href: `/animals/${entry.slug}`, slug: entry.slug})),
        ...(publishedComparisons as ComparisonFile).entries.map((entry) => ({kind: "comparison" as const, title: entry.title, href: `/comparisons/${entry.slug}`, slug: entry.slug})),
        ...animalHybridEntries.map((entry) => ({kind: "hybrid" as const, title: `${entry.title} (${entry.hybridName})`, href: `${ANIMAL_HYBRID_CANONICAL_BASE_PATH}/${entry.slug}`, slug: entry.slug})),
        ...rankingPages.map((page) => ({kind: "ranking" as const, title: page.headline || page.title, href: `${RANKING_CANONICAL_BASE_PATH}/${page.slug}`, slug: page.slug})),
        ...locationPages.map((page) => ({kind: "location" as const, title: `Animals in ${page.name}`, href: `/locations/${page.slug}`, slug: page.slug})),
        ...blogPosts.map((post) => ({kind: "blog" as const, title: post.title, href: `/blog/${post.slug}`, slug: post.slug}))
    ];
}

export type SiteCatalog = {
    items: CatalogItem[];
    hrefs: Set<string>;
    speciesSlugs: Set<string>;
    blogSlugs: Set<string>;
};

/** The compiled catalog plus Content Studio posts, which only exist in the DB. */
export async function loadSiteCatalog(): Promise<SiteCatalog> {
    staticCatalog ??= buildStaticCatalog();
    const managed: CatalogItem[] = [];
    const draftSlugs: string[] = [];
    // Species pages served from the database catalog (most of /animals). The
    // blog page only auto-links code species, so these stay out of speciesSlugs
    // and are linked as ordinary inline links.
    const codeSpecies = new Set(speciesEntries.map((entry) => entry.slug));
    try {
        for (const entry of await getSitemapSpeciesEntries()) {
            if (codeSpecies.has(entry.slug)) continue;
            const title = entry.slug.split("-").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
            managed.push({kind: "species", title, href: `/animals/${entry.slug}`, slug: entry.slug});
        }
    } catch (error) {
        console.warn("[blog-generator] Database species unavailable for the catalog", error instanceof Error ? error.message : error);
    }
    try {
        const entries = await listContentEntries("blog");
        for (const entry of entries) {
            draftSlugs.push(entry.slug);
            const title = (entry.payload as {title?: unknown} | null)?.title;
            if (entry.is_published && typeof title === "string") {
                managed.push({kind: "blog", title, href: `/blog/${entry.slug}`, slug: entry.slug});
            }
        }
    } catch (error) {
        console.warn("[blog-generator] Content Studio posts unavailable for the catalog", error instanceof Error ? error.message : error);
    }
    const seen = new Set<string>();
    const items = [...staticCatalog, ...managed].filter((item) => (seen.has(item.href) ? false : (seen.add(item.href), true)));
    return {
        items,
        hrefs: new Set(items.map((item) => item.href)),
        // Only code species: these are the ones the blog page links automatically.
        speciesSlugs: codeSpecies,
        // Every blog slug, published or not, so a new post never overwrites one.
        blogSlugs: new Set([...items.filter((item) => item.kind === "blog").map((item) => item.slug), ...draftSlugs])
    };
}

function tokens(value: string) {
    return value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter((word) => word.length > 1);
}

/** Keyword search over the catalog: what the research step calls to find pages to link. */
export function searchCatalog(catalog: SiteCatalog, query: string, kinds?: CatalogKind[], limit = 12): CatalogItem[] {
    const words = tokens(query);
    if (!words.length) return [];
    const phrase = words.join(" ");
    return catalog.items
        .filter((item) => !kinds?.length || kinds.includes(item.kind))
        .map((item) => {
            const haystack = tokens(`${item.title} ${item.slug.replace(/-/g, " ")}`).join(" ");
            let score = 0;
            for (const word of words) if (haystack.includes(word)) score += word.length > 3 ? 2 : 1;
            if (haystack.includes(phrase)) score += 6;
            if (item.kind === "species" && tokens(item.title).join(" ") === phrase) score += 10;
            return {item, score};
        })
        .filter(({score}) => score >= Math.min(2, words.length * 2))
        .sort((a, b) => b.score - a.score || a.item.title.length - b.item.title.length)
        .slice(0, limit)
        .map(({item}) => item);
}

/** A compact summary the topic step reads to see what we already cover. */
export function describeCatalog(catalog: SiteCatalog) {
    const count = (kind: CatalogKind) => catalog.items.filter((item) => item.kind === kind).length;
    const recentBlogTitles = catalog.items.filter((item) => item.kind === "blog").map((item) => item.title);
    return {
        counts: {
            species: count("species"),
            comparisons: count("comparison"),
            hybrids: count("hybrid"),
            rankings: count("ranking"),
            locations: count("location"),
            blogPosts: count("blog")
        },
        hubs: HUBS.map((hub) => `${hub.title}: ${hub.href}`),
        locations: catalog.items.filter((item) => item.kind === "location").map((item) => item.slug),
        rankings: catalog.items.filter((item) => item.kind === "ranking").map((item) => item.title),
        existingBlogTitles: recentBlogTitles
    };
}
