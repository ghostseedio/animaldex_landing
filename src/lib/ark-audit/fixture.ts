/**
 * The behaviour audit's synthetic Ark (visual audit only; nothing here is
 * the server's): every catalogue species from `data/ark/behaviour-profiles.json`,
 * one animal for a solitary species, two for a pair, four for a social one
 * (herd, flock, school, troop, pack, group, colony, swarm), in their stored
 * zones.
 *
 * Arrival order decides where the scene puts them (`placement.ts` fills each
 * zone's slots in arrival order, as the server does), so the order is the
 * fixture's one lever on who stands next to whom:
 *   - "shuffled": a seeded shuffle of the species (a plausible real Ark);
 *   - "adjacent": the same, but each predator's group arrives straight after
 *     a group of one of its prey in its zone (the owner's "wolves next to
 *     deer"), so every predator has prey a slot away.
 *
 * Pure and deterministic: the same files give the same Ark on every tree.
 */

import type {ArkAnimal} from "@/ark-scene/types";

export type AuditProfile = {
    slug: string;
    id: string;
    name: string;
    zone: ArkAnimal["zone"];
    excluded: string | null;
    plan: string;
    rig: string | null;
    gait: number | null;
    move: string;
    moves: string[];
    activity: "diurnal" | "nocturnal" | "crepuscular" | "any";
    roost: string;
    social: string;
    diet: string;
    size: number | null;
    speed: number | null;
    dominance: number | null;
    behaviours: Record<string, number>;
    interactions: string[];
    altitude: string | null;
    breathes: boolean;
    seabed: boolean;
};

export type AuditFixtureOrder = "shuffled" | "adjacent";

export const GROUPED_SOCIAL: ReadonlySet<string> = new Set(["herd", "flock", "school", "troop", "pack", "group", "colony", "swarm"]);
/** Social species that move as one on purpose: following another of its kind is right for these. */
export const FLOCKING_SOCIAL: ReadonlySet<string> = new Set(["flock", "school", "colony", "swarm"]);

export function groupSize(social: string): number {
    return GROUPED_SOCIAL.has(social) ? 4 : social === "pair" ? 2 : 1;
}

function hash(text: string): number {
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
    return h >>> 0;
}

/** A stable uuid-shaped id for the n-th animal of a species. */
export function auditAnimalId(slug: string, n: number): string {
    const parts = [hash(`${slug}#${n}#a`), hash(`${slug}#${n}#b`), hash(`${slug}#${n}#c`), hash(`${slug}#${n}#d`)].map((v) => v.toString(16).padStart(8, "0"));
    const hex = parts.join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

/** Decodes `data/ark/audit-predator-prey.json` (prey as base-36 indices into the profiles) to slug → prey slugs. */
export function decodePreyTable(raw: {prey: Record<string, string>}, profiles: AuditProfile[]): Map<string, Set<string>> {
    const out = new Map<string, Set<string>>();
    for (const [predator, list] of Object.entries(raw.prey)) {
        const prey = new Set<string>();
        for (const token of list.split(".")) {
            const profile = profiles[parseInt(token, 36)];
            if (profile) prey.add(profile.slug);
        }
        out.set(predator, prey);
    }
    return out;
}

export type AuditFixture = {
    animals: ArkAnimal[];
    profileOf: Map<string, AuditProfile>;
    /** Species in the fixture, in arrival order. */
    order: string[];
};

/** The synthetic Ark. `profiles` is `behaviour-profiles.json`'s `profiles` (excluded ones are left out). */
export function auditFixture(profiles: AuditProfile[], preyOf: Map<string, Set<string>>, order: AuditFixtureOrder = "adjacent", start = Date.UTC(2026, 9, 26)): AuditFixture {
    const kept = profiles.filter((p) => !p.excluded && p.zone);
    const profileOf = new Map(kept.map((p) => [p.slug, p]));
    const shuffled = Array.from(kept).sort((a, b) => hash(`${a.slug}#order`) - hash(`${b.slug}#order`) || a.slug.localeCompare(b.slug));
    let sequence = shuffled.map((p) => p.slug);
    if (order === "adjacent") {
        // Each predator goes straight after the first of its prey (in shuffled order) that lives in its zone.
        const after = new Map<string, string[]>();
        const moved = new Set<string>();
        const position = new Map(sequence.map((slug, i) => [slug, i]));
        for (const predator of sequence) {
            const prey = preyOf.get(predator);
            if (!prey) continue;
            const zone = profileOf.get(predator)!.zone;
            const target = Array.from(prey).filter((slug) => profileOf.get(slug)?.zone === zone && !preyOf.has(slug)).sort((a, b) => position.get(a)! - position.get(b)!)[0];
            if (!target) continue;
            after.set(target, [...(after.get(target) ?? []), predator]);
            moved.add(predator);
        }
        const out: string[] = [];
        for (const slug of sequence) {
            if (moved.has(slug)) continue;
            out.push(slug);
            for (const predator of after.get(slug) ?? []) out.push(predator);
        }
        sequence = out;
    }
    const animals: ArkAnimal[] = [];
    let index = 0;
    for (const slug of sequence) {
        const profile = profileOf.get(slug)!;
        const count = groupSize(profile.social);
        for (let n = 0; n < count; n++) {
            animals.push({
                id: auditAnimalId(slug, n),
                species_profile_id: profile.id,
                name: profile.name,
                scientific_name: null,
                model_slug: slug,
                zone: profile.zone,
                arrived_at: new Date(start + index++ * 1000).toISOString(),
                brought_by: {label: "A voyager", named: false},
                mine: false,
                activity: profile.activity,
                sociality: GROUPED_SOCIAL.has(profile.social) ? "group" : profile.social === "pair" ? "pair" : "solitary"
            });
        }
    }
    return {animals, profileOf, order: sequence};
}
