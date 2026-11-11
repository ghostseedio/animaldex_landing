/**
 * Very popular species (owner decision A14, 2026-11-10): no cap on how many
 * of a kind are aboard. A species with more than `ARK_HERD_FROM` aboard is a
 * herd: a few representatives are drawn one by one (alive: idles, sleep,
 * pickable, followable), and the rest stand where the server placed them as
 * the herd, drawn cheaply (the far model, standing still, nearest the camera
 * first; past that a tinted figure a few pixels across), with a count badge
 * over it. Tapping the herd gives the species, with its count.
 *
 * Pure: which animals are representatives, from the snapshot alone (and
 * what the viewer is looking at now), so every viewer sees the same herd.
 *
 * Who is a representative, in order, up to `live`:
 * 1. any animal the page or a replay needs (`pinned`: selected, followed,
 *    acted out);
 * 2. the reader's own (up to half the representatives);
 * 3. the newest three arrivals (their entrance is seen);
 * 4. each cluster's first one by slot (the herd's heart outward), then
 *    each cluster's second, and so on: alive across the herd, never one
 *    knot of it.
 */

import type {ArkAnimal} from "@/ark-scene/types";

/** A species with more than this many aboard is drawn as a herd. */
export const ARK_HERD_FROM = 24;
/** Representatives drawn one by one per herd (half in the lighter view). */
export const ARK_HERD_LIVE = 24;
export const ARK_HERD_LIVE_LITE = 12;

/** The same key as the population panel's (`arkSpeciesKey`). */
export function herdKey(animal: Pick<ArkAnimal, "species_profile_id" | "model_slug">): string {
    return animal.species_profile_id || `slug:${animal.model_slug}`;
}

export type ArkHerd = {
    key: string;
    slug: string;
    name: string;
    /** Everyone of the species aboard (the count the badge says). */
    count: number;
    mine: number;
    /** The representatives' ids. */
    live: string[];
    /** The rest: drawn as the herd. */
    massed: string[];
};

export type ArkRepresentatives = {
    /** Every animal drawn one by one: everyone of a species that isn't a herd, and the herds' representatives. */
    live: Set<string>;
    herds: Map<string, ArkHerd>;
};

/** Which species are herds (more than `from` aboard). */
export function arkHerdKeys(animals: ArkAnimal[], from = ARK_HERD_FROM): Set<string> {
    const counts = new Map<string, number>();
    for (const animal of animals) if (animal.area !== "house" && animal.area !== "farm") counts.set(herdKey(animal), (counts.get(herdKey(animal)) ?? 0) + 1);
    return new Set(Array.from(counts.entries()).filter(([, n]) => n > from).map(([key]) => key));
}

export function arkRepresentatives(animals: ArkAnimal[], options: {pinned?: ReadonlySet<string>; live?: number; from?: number} = {}): ArkRepresentatives {
    const from = options.from ?? ARK_HERD_FROM;
    const cap = Math.max(options.live ?? ARK_HERD_LIVE, 1);
    const pinned = options.pinned ?? new Set<string>();
    const bySpecies = new Map<string, ArkAnimal[]>();
    const live = new Set<string>();
    for (const animal of animals) {
        // A hamlet resident (a captured pet or farm animal, `map/hamlet.ts`) is never massed into a herd: it lives on its
        // plot, and the hamlet's rotation decides who of them is out of doors.
        if (animal.area === "house" || animal.area === "farm") {
            live.add(animal.id);
            continue;
        }
        const key = herdKey(animal);
        const list = bySpecies.get(key);
        if (list) list.push(animal);
        else bySpecies.set(key, [animal]);
    }
    const herds = new Map<string, ArkHerd>();
    bySpecies.forEach((members, key) => {
        if (members.length <= from) {
            for (const animal of members) live.add(animal.id);
            return;
        }
        const chosen: string[] = [];
        const taken = new Set<string>();
        const take = (animal: ArkAnimal) => {
            if (taken.has(animal.id)) return;
            taken.add(animal.id);
            chosen.push(animal.id);
        };
        for (const animal of members) if (pinned.has(animal.id)) take(animal);
        const mine = members.filter((animal) => animal.mine).sort((a, b) => b.arrived_at.localeCompare(a.arrived_at) || a.id.localeCompare(b.id));
        for (const animal of mine.slice(0, Math.max(Math.floor(cap / 2), 1))) if (chosen.length < cap) take(animal);
        const newest = [...members].sort((a, b) => b.arrived_at.localeCompare(a.arrived_at) || a.id.localeCompare(b.id));
        for (const animal of newest.slice(0, 3)) if (chosen.length < cap) take(animal);
        // Rank by rank: every cluster's first, then every cluster's second, ...; clusters by slot.
        const ordered = [...members].sort((a, b) => (a.slot_rank ?? 0) - (b.slot_rank ?? 0) || (a.slot ?? 0) - (b.slot ?? 0) || a.arrived_at.localeCompare(b.arrived_at) || a.id.localeCompare(b.id));
        for (const animal of ordered) {
            if (chosen.length >= cap) break;
            take(animal);
        }
        for (const id of chosen) live.add(id);
        const first = members[0];
        herds.set(key, {
            key,
            slug: first.model_slug,
            name: first.name,
            count: members.length,
            mine: mine.length,
            live: chosen,
            massed: members.filter((animal) => !taken.has(animal.id)).map((animal) => animal.id)
        });
    });
    return {live, herds};
}

/** Per tier: how many of a herd are drawn as the far model (nearest first); the rest as a few-pixel figure. */
export const HERD_FIGURE_BUDGET = {high: 900, medium: 450, low: 160} as const;
/** Smaller than this on screen (CSS px), a herd member is drawn as the tinted figure, never the model. */
export const HERD_SPECK_BELOW_PIXELS = 7;
