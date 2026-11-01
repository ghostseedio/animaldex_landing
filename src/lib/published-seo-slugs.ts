import publishedSeoSlugs from "@/data/published-seo-slugs.json";
import {isHumanSlug} from "@/lib/people-are-never-public";

// Refresh with `yarn refresh:published-seo` (slugs + page snapshots) before
// publishing newly catalogued species. `yarn refresh:published-seo-slugs` still
// updates the slug index only. Unknown slugs 404 locally and never fall back
// to Supabase. Newly published DB content is not an SEO page until the
// snapshot is refreshed and deployed.

// People are never public (DECISIONS §11): the human page is not a published page.
const publishedAnimalSlugs = new Set(publishedSeoSlugs.animals.filter((slug) => !isHumanSlug(slug)));
const publishedLessonSlugs = new Set(publishedSeoSlugs.lessons.filter((slug) => !isHumanSlug(slug)));

export function normalizePublishedSeoSlug(slug: string) {
    return slug.trim().toLowerCase();
}

export function isPublishedAnimalSlug(slug: string) {
    const normalized = normalizePublishedSeoSlug(slug);
    return Boolean(normalized) && publishedAnimalSlugs.has(normalized);
}

export function isPublishedLessonSlug(slug: string) {
    const normalized = normalizePublishedSeoSlug(slug);
    return Boolean(normalized) && publishedLessonSlugs.has(normalized);
}

export function getNextPublishedLessonSlug(slug: string) {
    const normalized = normalizePublishedSeoSlug(slug);
    const slugs = publishedSeoSlugs.lessons;
    const index = slugs.indexOf(normalized);

    if (index < 0 || slugs.length < 2) {
        return null;
    }

    return slugs[(index + 1) % slugs.length] ?? null;
}
