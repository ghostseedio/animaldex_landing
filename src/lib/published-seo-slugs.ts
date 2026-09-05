import publishedSeoSlugs from "@/data/published-seo-slugs.json";

const publishedAnimalSlugs = new Set(publishedSeoSlugs.animals);
const publishedLessonSlugs = new Set(publishedSeoSlugs.lessons);

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
