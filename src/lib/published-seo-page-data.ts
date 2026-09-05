import type {SpeciesBehaviorLesson} from "@/data/species-behavior-lessons";
import type {SpeciesEntry} from "@/data/species";
import animalSnapshot from "@/data/published-seo-animal-pages.json";
import lessonSnapshot from "@/data/published-seo-lesson-pages.json";
import publishedSeoSlugs from "@/data/published-seo-slugs.json";

type SnapshotFile<T> = {
    generatedAt: string;
    source: string;
    note: string;
    entries: T[];
};

const animalPages = animalSnapshot as SnapshotFile<SpeciesEntry>;
const lessonPages = lessonSnapshot as SnapshotFile<SpeciesBehaviorLesson>;

const snapshotAnimalsBySlug = new Map(
    animalPages.entries.map((entry) => [entry.slug, entry] as const)
);
const snapshotLessonsBySlug = new Map(
    lessonPages.entries.map((entry) => [entry.slug, entry] as const)
);

export function getSnapshotSpeciesBySlug(slug: string) {
    const normalized = slug.trim().toLowerCase();
    return snapshotAnimalsBySlug.get(normalized) ?? null;
}

export function getSnapshotLessonBySlug(slug: string) {
    const normalized = slug.trim().toLowerCase();
    return snapshotLessonsBySlug.get(normalized) ?? null;
}

export function listSnapshotAnimalSlugs() {
    return animalPages.entries.map((entry) => entry.slug);
}

export function listSnapshotLessonSlugs() {
    return lessonPages.entries.map((entry) => entry.slug);
}

export function getPublishedEnglishAnimalStaticParams() {
    return publishedSeoSlugs.animals.map((slug) => ({locale: "en", slug}));
}

export function getPublishedEnglishLessonStaticParams() {
    return publishedSeoSlugs.lessons.map((slug) => ({locale: "en", slug}));
}

export function getPublishedSeoSnapshotMeta() {
    return {
        animals: {
            generatedAt: animalPages.generatedAt,
            source: animalPages.source,
            count: animalPages.entries.length
        },
        lessons: {
            generatedAt: lessonPages.generatedAt,
            source: lessonPages.source,
            count: lessonPages.entries.length
        }
    };
}
