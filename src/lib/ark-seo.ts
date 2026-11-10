/**
 * The Ark's share links and search words (AnimalDex docs/ark-next.md, Part 4c
 * and 4d): who a shared `/ark` or `/ark?focus=<species>` shows, its share
 * card's path, and the link a share button hands out. Pure: it reads a
 * public snapshot and nothing else, and it says counts and species only,
 * never who brought an animal.
 */

import type {ArkSnapshot} from "@/ark-scene/types";
import {arkFocusAnimals, arkPairStatus, arkPopulation, type ArkPairStatus} from "@/lib/ark-population";

/** A slug the share card may draw: the catalog's own shape, nothing else. */
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isArkSlug(value: string | null | undefined): value is string {
    return typeof value === "string" && value.length <= 120 && SLUG.test(value);
}

/** One species on the Ark, as a share card or the page's list says it. */
export type ArkSpeciesCount = {slug: string; speciesProfileId: string; name: string; count: number; status: ArkPairStatus};

/** Every species aboard, the most numerous first (then by name): the share card's picks and the page's list order. */
export function arkSpeciesCounts(snapshot: ArkSnapshot | null): ArkSpeciesCount[] {
    return arkPopulation(snapshot).regions
        .flatMap((group) => group.species)
        .map((row) => ({slug: row.slug, speciesProfileId: row.speciesProfileId, name: row.name, count: row.count, status: row.status}))
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/**
 * `?focus=` (a species_profile_id or a model slug) as the species' model slug,
 * when that species is aboard; a well-formed slug that is not aboard comes
 * back as itself (the card then says "not aboard yet"); anything else null.
 */
export function arkFocusSlug(snapshot: ArkSnapshot | null, focus: string | null | undefined): string | null {
    const wanted = focus?.trim().toLowerCase();
    if (!wanted) return null;
    const aboard = arkFocusAnimals(snapshot, wanted)[0];
    if (aboard) return isArkSlug(aboard.model_slug) ? aboard.model_slug : null;
    return isArkSlug(wanted) ? wanted : null;
}

/** One species on the Ark: how many of it are aboard (0 when none), and its name when it is. */
export function arkSpeciesShare(snapshot: ArkSnapshot | null, slug: string): {name: string | null; count: number; status: ArkPairStatus | null} {
    const animals = arkFocusAnimals(snapshot, slug);
    return {name: animals[0]?.name ?? null, count: animals.length, status: animals.length ? arkPairStatus(animals.length) : null};
}

/**
 * The share card's path: `/api/og/ark.png`, or `/api/og/ark/<slug>.png` for a
 * species. `v` changes with the count, so a scraper that cached the old card
 * fetches the new one once more come aboard; the route itself ignores it.
 */
export function arkOgImagePath(slug: string | null, count: number): string {
    const path = slug ? `/api/og/ark/${encodeURIComponent(slug)}.png` : "/api/og/ark.png";
    return `${path}?v=${Math.max(0, Math.floor(count))}`;
}

/**
 * The link a share button hands out: the Ark (or one species in it) with
 * `from=share`, which the Ark's measurement reads as "came from a shared
 * link". `localePath` is the page's own path without the query ("/ark" or "/id/ark").
 */
export function arkShareUrl(origin: string, localePath: string, slug: string | null): string {
    const url = new URL(localePath, origin);
    if (slug && isArkSlug(slug)) url.searchParams.set("focus", slug);
    url.searchParams.set("from", "share");
    return url.toString();
}

/** One stored diet link of a species, either way round, with the other side's name and page slug. */
export type ArkFoodLink = {
    /** `eats`: this species eats the other; `eatenBy`: the other eats it. */
    direction: "eats" | "eatenBy";
    /** The other species' name, or the group its diet names ("birds"). */
    name: string;
    /** The other species' page slug, when the link is to one species. */
    slug: string | null;
};

/** A `voyage_food_links` row as read (contract: predator, prey, basis 'species'|'group', group_label, realm_ok). */
export type ArkFoodLinkRow = {predator?: unknown; prey?: unknown; basis?: unknown; group_label?: unknown; realm_ok?: unknown};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function idText(value: unknown): string | null {
    return typeof value === "string" && UUID.test(value.trim()) ? value.trim().toLowerCase() : null;
}

/**
 * The species a page has to name for its diet links: what it eats as a
 * species (what it eats by a group its diet names, "birds", is said as the
 * group) and everything that eats it. Links the realm check refused are left out.
 */
export function arkFoodLinkOthers(rows: ArkFoodLinkRow[], speciesProfileId: string): string[] {
    const id = speciesProfileId.trim().toLowerCase();
    const others = new Set<string>();
    for (const row of rows) {
        if (row.realm_ok === false) continue;
        const predator = idText(row.predator);
        const other = predator === id ? (row.basis === "group" ? null : idText(row.prey)) : idText(row.prey) === id ? predator : null;
        if (other) others.add(other);
    }
    return Array.from(others);
}

/** The diet links in plain words: once per name and direction, in the stored order. */
export function arkFoodLinks(rows: ArkFoodLinkRow[], speciesProfileId: string, names: ReadonlyMap<string, {name: string; slug: string | null}>): ArkFoodLink[] {
    const id = speciesProfileId.trim().toLowerCase();
    const links: ArkFoodLink[] = [];
    const seen = new Set<string>();
    for (const row of rows) {
        if (row.realm_ok === false) continue;
        const predator = idText(row.predator);
        const prey = idText(row.prey);
        const direction = predator === id ? "eats" : prey === id ? "eatenBy" : null;
        if (!direction) continue;
        const group = direction === "eats" && row.basis === "group" && typeof row.group_label === "string" && row.group_label.trim() ? row.group_label.trim() : null;
        const other = names.get((direction === "eats" ? prey : predator) ?? "");
        const name = group ?? other?.name ?? null;
        if (!name) continue;
        const key = `${direction}:${name.toLowerCase()}`;
        if (seen.has(key)) continue;
        seen.add(key);
        links.push({direction, name, slug: group ? null : other?.slug ?? null});
    }
    return links;
}
