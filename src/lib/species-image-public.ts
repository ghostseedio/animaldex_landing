import type {SpeciesEntry} from "@/data/species";
import {getSpeciesArtworkRoute} from "@/data/species-artwork";
import type {CaptureGradeBreakdown} from "@/lib/capture-grade";

export const SPECIES_NO_IMAGE_SRC = "/images/placeholders/species-no-image.svg";

export type FeaturedMedia = {
    captureId: string | null;
    imageBucket: string | null;
    imagePath: string | null;
    mimeType: string | null;
    mediaKind: string | null;
    imageGrade: string | null;
    gradeBreakdown: CaptureGradeBreakdown | null;
    animalName: string | null;
    username: string | null;
    contextLabel: string | null;
    locationDisplayLabel: string | null;
};

export type SpeciesImageReference = FeaturedMedia;

export type SpeciesDirectoryImageState = {
    hasPublicCapture: boolean;
    captureId: string | null;
};

type SpeciesImageAltVariant = "featured" | "thumbnail" | "metadata";

export function getSpeciesImageRoute(slug: string, captureId?: string | null) {
    if (!captureId) {
        return getSpeciesArtworkRoute(slug);
    }

    const searchParams = new URLSearchParams({captureId});
    return `/api/species-images/${slug}?${searchParams.toString()}`;
}

export function getSpeciesImageAltText(entry: SpeciesEntry, variant: SpeciesImageAltVariant = "featured") {
    const scientificName = entry.analysis.scientificName ? ` (${entry.analysis.scientificName})` : "";

    switch (variant) {
        case "thumbnail":
            return `${entry.name}${scientificName} thumbnail image on AnimalDex`;
        case "metadata":
            return `${entry.name}${scientificName} animal image and species guide on AnimalDex`;
        default:
            return `${entry.name}${scientificName} featured animal image on AnimalDex`;
    }
}

export function getSpeciesImageAttribution(reference: SpeciesImageReference | null) {
    if (!reference?.imagePath) {
        return null;
    }

    return reference.username
        ? `Captured by @${reference.username}`
        : "Captured by AnimalDex member";
}
