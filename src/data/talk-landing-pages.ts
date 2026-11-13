import snapshot from "@/data/talk-landing-species.json";
import {isPublishedAnimalSlug} from "@/lib/published-seo-slugs";
import {getPublishedSpeciesForContent, speciesContentModifiedAt} from "@/lib/static-species-overlay";
import {isSpeciesPageIndexable} from "@/lib/species-indexability";
import {getCatalogSpeciesPower, type CatalogSpeciesPower} from "@/lib/species-power";
import {
    talkLandingAnswers,
    talkLandingDescription,
    talkLandingFaq,
    talkLandingHeading,
    talkLandingOpening,
    talkLandingTitle,
    type TalkLandingAnswer,
    type TalkLandingFacts,
    type TalkLandingOpening
} from "@/lib/talk-landing";
import renamedSpeciesSlugs from "@/data/renamed-species-slugs.json";

/**
 * The /talk/<slug> landing pages (CC 5): indexable, signed-out pages for the
 * species people talk to most, built from `talk-landing-species.json` and
 * the species snapshots alone. Under the SSG contract: a closed list in
 * src/data, every page's facts from `getPublishedSpeciesForContent` (the
 * overlay and the page snapshot), never the catalogue at build time. The
 * chat itself (`TalkChat`) is the same one every /talk/<slug> opens.
 */

export type TalkLandingSource = "chat_popularity" | "fame" | "tier_list_top";

export type TalkLandingPage = {
    slug: string;
    name: string;
    scientificName: string | null;
    source: TalkLandingSource;
    power: CatalogSpeciesPower | null;
    heading: string;
    title: string;
    description: string;
    opening: TalkLandingOpening;
    exchange: TalkLandingAnswer | null;
    questions: TalkLandingAnswer[];
    faq: Array<{question: string; answer: string}> | null;
    /** The species page the chat is grounded in. */
    speciesPath: string;
    /** When the page's facts last changed (the species page's own date). */
    updatedAt: string;
    /** The artwork file when the snapshot names one (`featuredImage.src` is the species-images route). */
    imageAlt: string;
};

type SnapshotEntry = {slug: string; source: TalkLandingSource; tierList?: string};

const entries = (snapshot as unknown as {entries: SnapshotEntry[]}).entries;
const renamed = (renamedSpeciesSlugs as {redirects: Record<string, string>}).redirects;

/** A snapshot slug as the species pages serve it: itself, or what a refresh renamed it to. */
export function resolveTalkLandingSlug(slug: string): string | null {
    const served = isPublishedAnimalSlug(slug) ? slug : renamed[slug] && isPublishedAnimalSlug(renamed[slug]) ? renamed[slug] : null;
    if (!served || served === "human") return null;
    const entry = getPublishedSpeciesForContent(served);
    if (!entry || entry.slug !== served || !isSpeciesPageIndexable(entry, served)) return null;
    return served;
}

let pagesCache: Map<string, TalkLandingPage> | null = null;

function buildPages(): Map<string, TalkLandingPage> {
    const pages = new Map<string, TalkLandingPage>();
    for (const item of entries) {
        const slug = resolveTalkLandingSlug(item.slug);
        if (!slug || pages.has(slug)) continue;
        const entry = getPublishedSpeciesForContent(slug);
        if (!entry) continue;
        const power = getCatalogSpeciesPower(slug);
        const facts: TalkLandingFacts = {
            name: entry.name,
            // No catalogue snapshot carries a greeting (2026-11-13); see talkLandingOpening.
            greeting: null,
            summary: entry.analysis.summary,
            habitat: entry.analysis.habitat,
            identification: entry.analysis.identification,
            behaviorTraits: entry.premiumDetails.behaviorTraits,
            interestingFacts: entry.premiumDetails.whyInteresting,
            fieldGuide: entry.databaseSource?.fieldGuide ?? null,
            powerName: power?.name ?? null
        };
        const opening = talkLandingOpening(facts);
        const {exchange, questions} = talkLandingAnswers(facts, opening);
        pages.set(slug, {
            slug,
            name: entry.name,
            scientificName: entry.analysis.scientificName || null,
            source: item.source,
            power,
            heading: talkLandingHeading(entry.name),
            title: talkLandingTitle(entry.name),
            description: talkLandingDescription(facts),
            opening,
            exchange,
            questions,
            faq: talkLandingFaq(questions),
            speciesPath: `/animals/${slug}`,
            updatedAt: speciesContentModifiedAt(entry),
            imageAlt: `${entry.name} artwork`
        });
    }
    return pages;
}

function pages(): Map<string, TalkLandingPage> {
    if (!pagesCache) pagesCache = buildPages();
    return pagesCache;
}

/** Every landing page, in the snapshot's order. */
export function getTalkLandingPages(): TalkLandingPage[] {
    return Array.from(pages().values());
}

export function getTalkLandingSlugs(): string[] {
    return Array.from(pages().keys());
}

export function isTalkLandingSlug(slug: string): boolean {
    return pages().has(slug);
}

export function getTalkLandingPage(slug: string): TalkLandingPage | null {
    return pages().get(slug) ?? null;
}

/**
 * The route's static params: English only. The facts are English, so an
 * /id twin would be the duplicate the collapsed detail families avoid; the
 * page's canonical and hreflang say English (see the route's metadata).
 */
export function getTalkLandingStaticParams(): Array<{locale: string; slug: string}> {
    return getTalkLandingSlugs().map((slug) => ({locale: "en", slug}));
}

/** The snapshot's own entries, for tests and the sitemap's lastmod. */
export const TALK_LANDING_SNAPSHOT = {
    generatedAt: (snapshot as {generatedAt: string}).generatedAt,
    entries
};
