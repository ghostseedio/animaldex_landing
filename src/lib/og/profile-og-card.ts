import type {OgCardSpec} from "@/lib/og/og-card";
import {ogImagePath} from "@/lib/og/og-image";

/**
 * A collector's share card (/u/<handle>): their name and handle, with their
 * best animals as the pictures. Pure, so the route's data read stays apart.
 */

export type ProfileOgCollector = {
    displayName: string;
    username: string;
    captureCount: number;
    speciesCount: number;
};

export type ProfileOgAnimal = {slug: string; name: string};

function count(value: number, one: string, many: string) {
    const rounded = Math.max(0, Math.round(value));
    return `${rounded.toLocaleString("en-US")} ${rounded === 1 ? one : many}`;
}

export function profileOgCard(collector: ProfileOgCollector, animals: ProfileOgAnimal[]): OgCardSpec {
    const handle = `@${collector.username}`;
    const sameName = collector.displayName.trim().toLowerCase() === collector.username.trim().toLowerCase();
    return {
        kicker: "AnimalDex collector",
        title: sameName ? handle : `${collector.displayName.trim()} (${handle})`,
        // Shown when there is one picture or none; with more, the animals say it.
        subtitle: `${count(collector.captureCount, "capture", "captures")} · ${count(collector.speciesCount, "species", "species")}`,
        tiles: animals.slice(0, 3).map((animal) => ({image: {artwork: animal.slug}, label: animal.name}))
    };
}

/** Each species once, best capture first, with that capture's name (the route prefers the species' own). */
export function profileOgAnimals(captures: Array<{speciesSlug: string | null; animalName: string}>): ProfileOgAnimal[] {
    const seen = new Set<string>();
    const animals: ProfileOgAnimal[] = [];
    for (const capture of captures) {
        const slug = capture.speciesSlug?.trim();
        const name = capture.animalName.trim();
        if (!slug || !name || seen.has(slug)) continue;
        seen.add(slug);
        animals.push({slug, name});
    }
    return animals;
}

/**
 * The card's URL. `v` is the capture count, so the card a platform caches is
 * replaced once the collection grows instead of when the CDN entry expires.
 */
export function profileOgImagePath(username: string, captureCount: number) {
    return `${ogImagePath("profile", username)}?v=${Math.max(0, Math.round(captureCount))}`;
}
