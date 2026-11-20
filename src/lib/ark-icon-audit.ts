import {arkIconAlias, arkIconKeys, type ArkIconProfile} from "@/lib/ark-icons";
import {isArkPlaceholderSlug} from "@/ark-scene/placeholder-icon";

export type ArkIconAuditAnimal = {model_slug: string; species_profile_id: string};

export type ArkIconAudit = {
    animals: number;
    species: number;
    /** Animals (and species) whose own Ark slug has no `<slug>.webp`: what the page draws as the generic figure without the alias. */
    placeholderAnimals: number;
    placeholderSpecies: number;
    /** Of those, the ones with a file under another of their own names: fixed by the alias. */
    fixableAnimals: number;
    fixableSpecies: number;
    /** Still the generic figure with the alias: no file under any of their names. */
    remainingAnimals: number;
    remainingSpecies: number;
    fixed: Array<{slug: string; file: string; animals: number}>;
    remaining: Array<{slug: string; animals: number; tried: string[]}>;
};

/**
 * Over an Ark read (animals), the bucket's listing (`artwork`) and the profiles of the species aboard: how many animals
 * would be drawn as the generic figure although the bucket holds a file for one of their keys (`arkIconAlias`). Pure;
 * `scripts/ark-icon-audit.mts` feeds it the live public read.
 */
export function arkIconAudit(animals: readonly ArkIconAuditAnimal[], artwork: {has: (slug: string) => boolean}, profiles: ReadonlyMap<string, ArkIconProfile>): ArkIconAudit {
    const bySlug = new Map<string, {animals: number; ids: Set<string>}>();
    const speciesAboard = new Set<string>();
    for (const {model_slug: slug, species_profile_id: id} of animals) {
        speciesAboard.add(slug);
        if (!slug || isArkPlaceholderSlug(slug) || artwork.has(slug)) continue;
        const one = bySlug.get(slug) ?? {animals: 0, ids: new Set<string>()};
        one.animals += 1;
        one.ids.add(id);
        bySlug.set(slug, one);
    }
    const audit: ArkIconAudit = {animals: animals.length, species: speciesAboard.size, placeholderAnimals: 0, placeholderSpecies: bySlug.size, fixableAnimals: 0, fixableSpecies: 0, remainingAnimals: 0, remainingSpecies: 0, fixed: [], remaining: []};
    for (const [slug, one] of Array.from(bySlug.entries()).sort(([a], [b]) => (a < b ? -1 : 1))) {
        audit.placeholderAnimals += one.animals;
        const named = Array.from(one.ids).flatMap((id) => profiles.get(id) ?? []);
        const file = arkIconAlias(named, artwork);
        if (file) {
            audit.fixableAnimals += one.animals;
            audit.fixableSpecies += 1;
            audit.fixed.push({slug, file, animals: one.animals});
        } else {
            audit.remainingAnimals += one.animals;
            audit.remainingSpecies += 1;
            audit.remaining.push({slug, animals: one.animals, tried: Array.from(new Set(named.flatMap(arkIconKeys)))});
        }
    }
    return audit;
}
