/**
 * What the Collection's band shows (iOS `CollectionScreenView`, 208f1b15 and
 * d1fa2511): "12 of 2,613 found" only once there is a catalog to count, and
 * the completion bar only from 5%, under which it reads as an empty spinner.
 */

export function collectionShowsCount(catalogTotal: number): boolean {
    return catalogTotal > 0;
}

export function collectionShowsProgress(found: number, catalogTotal: number): boolean {
    return catalogTotal > 0 && found / catalogTotal >= 0.05;
}

/**
 * "Find a Great Blue Heron …" / "Find an Ocelot …": English picks "an"
 * before a vowel sound, and "a" before a "you" sound (iOS `findLine`).
 */
export function speciesTakesAn(species: string): boolean {
    const first = species.trim().toLowerCase();
    const youSound = ["eu", "uni", "ur", "us", "uga", "one"].some((prefix) => first.startsWith(prefix));
    return !youSound && /^[aeiou]/.test(first);
}
