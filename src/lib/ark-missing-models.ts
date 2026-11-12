/**
 * Species aboard the Ark with no Ark model (owner decision A13): drawn as
 * the placeholder figure until one is made. /admin/ark-models lists them,
 * from the server's `voyage_missing_models_v1` (service role) when it is
 * applied, else worked out here from the public read and the model set's
 * manifest.
 */

import {isArkPlaceholderSlug} from "@/ark-scene/placeholder-icon";
import type {ArkSnapshot} from "@/ark-scene/types";

export type ArkMissingModel = {
    speciesProfileId: string;
    name: string;
    scientificName: string | null;
    /** The species' slug when the server knows one (the model would be made under it). */
    slug: string | null;
    /** Living aboard now. */
    animals: number;
    /** Ever aboard (the RPC only). */
    animalsEver: number | null;
    /** Worked steps that would bring one (the RPC only): the need to come. */
    workedSteps: number | null;
    animaldexNumber: number | null;
    /** Its kind when it is a breed (A1), whose model it would wear if the kind had one. */
    kindName: string | null;
    firstArrivedAt: string | null;
    /** Why it has none: the server sent no slug, or the model set doesn't list the slug. */
    reason: "no_slug" | "not_in_manifest" | string;
};

function text(value: unknown): string | null {
    return typeof value === "string" && value.trim() ? value.trim() : null;
}

function count(value: unknown): number | null {
    const n = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
}

/**
 * `voyage_missing_models_v1()`'s rows (an array, or `{rows}` / `{species}`),
 * checked: `species_profile_id, name, scientific_name, animaldex_number,
 * identity_kind, kind_species_profile_id, kind_name, animals_living,
 * animals_ever, worked_steps` (20261113120000). Its order is kept: the most
 * living first, then the most worked steps.
 */
export function decodeArkMissingModels(raw: unknown): ArkMissingModel[] {
    const list = Array.isArray(raw) ? raw : raw && typeof raw === "object" ? ((raw as Record<string, unknown>).rows ?? (raw as Record<string, unknown>).species) : null;
    if (!Array.isArray(list)) return [];
    return list
        .map((item) => (item && typeof item === "object" ? item as Record<string, unknown> : null))
        .filter((row): row is Record<string, unknown> => row !== null)
        .map((row) => {
            const animals = count(row.animals_living ?? row.animals ?? row.count) ?? 0;
            const slug = text(row.model_slug) ?? text(row.slug);
            const kindId = text(row.kind_species_profile_id);
            return {
                speciesProfileId: text(row.species_profile_id) ?? "",
                name: text(row.name) ?? text(row.species) ?? "",
                scientificName: text(row.scientific_name),
                slug: slug && !isArkPlaceholderSlug(slug) ? slug : null,
                animals,
                animalsEver: count(row.animals_ever),
                workedSteps: count(row.worked_steps),
                animaldexNumber: count(row.animaldex_number),
                kindName: kindId && kindId !== text(row.species_profile_id) ? text(row.kind_name) : null,
                firstArrivedAt: text(row.first_arrived_at) ?? text(row.first_at),
                reason: text(row.reason) ?? (slug ? "not_in_manifest" : "no_slug")
            };
        })
        .filter((row) => row.speciesProfileId || row.name);
}

/**
 * Worked out from a snapshot and the model set's manifest: every species
 * aboard that came as a placeholder, or whose slug the manifest doesn't list.
 * With no manifest (it couldn't be read), only the placeholders.
 */
export function arkMissingModels(snapshot: ArkSnapshot | null, listed: ReadonlySet<string> | null): ArkMissingModel[] {
    const bySpecies = new Map<string, ArkMissingModel>();
    for (const animal of snapshot?.animals ?? []) {
        const placeholder = animal.placeholder === true || isArkPlaceholderSlug(animal.model_slug);
        const unlisted = !placeholder && listed !== null && !listed.has(animal.model_slug);
        if (!placeholder && !unlisted) continue;
        const key = animal.species_profile_id || animal.model_slug;
        const row = bySpecies.get(key);
        if (row) {
            row.animals++;
            if (!row.firstArrivedAt || animal.arrived_at < row.firstArrivedAt) row.firstArrivedAt = animal.arrived_at;
            continue;
        }
        bySpecies.set(key, {
            speciesProfileId: animal.species_profile_id,
            name: animal.name,
            scientificName: animal.scientific_name,
            slug: isArkPlaceholderSlug(animal.model_slug) ? null : animal.model_slug,
            animals: 1,
            animalsEver: null,
            workedSteps: null,
            animaldexNumber: null,
            kindName: animal.kind_name ?? null,
            firstArrivedAt: animal.arrived_at,
            reason: placeholder ? "no_slug" : "not_in_manifest"
        });
    }
    return Array.from(bySpecies.values()).sort((a, b) => b.animals - a.animals || a.name.localeCompare(b.name));
}
