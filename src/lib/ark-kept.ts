/**
 * Kept populations (AnimalDex decision 444; engine `supabase/functions/_shared/ark-ecology/kept.ts`, docs/ark/kept-populations.md):
 * what the tap card says about a kept animal, and how the population graph names animals that left the Ark alive.
 *
 * - "Born in a zoo" / "Born in a home" / "Born on a farm": an animal born aboard (`origin` 'born') that lives in a kept
 *   place was born there (the engine's captive-born; with `captive_breeding` on, its young come less easily). A fact
 *   whatever the switches say.
 * - "Neutered": only while the server's `human_use` is on, a pet of a kind people neuter, at the kind's share, fixed by
 *   the animal's id with the engine's own draw (`arkKeptUnit` = kept.ts `unitOf`).
 * - "Eggs collected": only while `human_use` is on, a laying bird kept at a home or a farm (its eggs are mostly taken
 *   for food; a broody hen is let sit now and then).
 * - Ended "Rehomed" / "Went to market" / "Moved to another zoo": the life read's `died.kind` for an animal born aboard that
 *   human use took off the Ark alive (statuses `rehomed`, `to_market`, `moved_zoo`, AnimalDex migration 20261223120000).
 *
 * Pure.
 */

import type {ArkAnimal} from "@/ark-scene/types";

/** The ways an animal leaves the Ark alive. */
export const ARK_LEFT_KINDS = ["rehomed", "to_market", "moved_zoo"] as const;
export type ArkLeftKind = (typeof ARK_LEFT_KINDS)[number];

export function isArkLeftKind(value: unknown): value is ArkLeftKind {
    return value === "rehomed" || value === "to_market" || value === "moved_zoo";
}

/**
 * Share neutered, by kind (kept.ts DOMESTIC `neuter`; owner surveys, docs section 3). The engine's table is the source:
 * `ark-kept.test.ts` reads it from the AnimalDex checkout when one is beside this one.
 */
export const ARK_NEUTER_SHARE: Readonly<Record<string, number>> = {
    "c54e5eca-48bc-4b31-bef6-7f69515e76f7": 0.72, // Domestic Dog
    "5c5fab8a-0426-4588-8024-a1d30bcbbca2": 0.88, // Domestic Cat
    "b1a61d2c-1e09-48df-94a4-9a7eeacdf257": 0.5, // Domestic Rabbit
    "172450b2-8c61-41a3-a626-6f2493e01cb7": 0.5, // Domestic Ferret
    "25b96449-280e-4624-8bb9-76bdb4334d4c": 0.1 // Guinea Pig
};

/** The laying birds whose eggs people collect (kept.ts DOMESTIC with `broody`). */
export const ARK_LAYING_KINDS: ReadonlySet<string> = new Set([
    "cf059266-56af-4199-adba-64d2d7c0e623", // Domestic Chicken
    "18f53290-95ab-4586-bb7e-2b5f7620a563", // Domestic Duck
    "0bf9ae47-74fb-4198-99ca-18ed92677be0", // Muscovy Duck
    "268f5132-fbda-4c29-bc28-a81a84220539", // Domestic Goose
    "aaa0aa71-be0b-406d-a6c4-5035fcc22465", // Domestic Turkey
    "2ea68ac2-065c-4870-ae14-7eddb0258688", // Japanese Quail
    "fd4dd10a-e6c5-4bd1-ae65-52b0c37d82e7", // Helmeted Guineafowl
    "5a370930-2d55-46b3-a52e-30d52498b362" // Domestic Pigeon
]);

/** The engine's draw (kept.ts `unitOf`): FNV-1a, then murmur3's fmix32. In [0, 1). */
export function arkKeptUnit(key: string): number {
    let h = 0x811c9dc5;
    for (let i = 0; i < key.length; i++) {
        h ^= key.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    h >>>= 0;
    h ^= h >>> 16;
    h = Math.imul(h, 0x85ebca6b);
    h ^= h >>> 13;
    h = Math.imul(h, 0xc2b2ae35);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
}

/** The server's switches (`/api/ark/kept`); both off until the read exists. */
export type ArkKeptFlags = {captiveBreeding: boolean; humanUse: boolean};
export const ARK_KEPT_OFF: ArkKeptFlags = {captiveBreeding: false, humanUse: false};

export type ArkKeptLine = "bornZoo" | "bornHome" | "bornFarm" | "neutered" | "eggsCollected";

type KeptAnimal = Pick<ArkAnimal, "id" | "species_profile_id" | "kind_species_profile_id" | "area" | "origin">;

/** What the card says about a kept animal, in order (empty for a wild one). */
export function arkKeptLines(animal: KeptAnimal, flags: ArkKeptFlags, born: boolean = animal.origin === "born"): ArkKeptLine[] {
    const area = animal.area ?? null;
    if (area !== "zoo" && area !== "house" && area !== "farm") return [];
    const out: ArkKeptLine[] = [];
    if (born) out.push(area === "zoo" ? "bornZoo" : area === "house" ? "bornHome" : "bornFarm");
    if (!flags.humanUse || area === "zoo") return out;
    const kind = animal.kind_species_profile_id || animal.species_profile_id;
    const share = ARK_NEUTER_SHARE[kind];
    if (share && arkKeptUnit(`neuter|${animal.id}`) < share) out.push("neutered");
    if (ARK_LAYING_KINDS.has(kind)) out.push("eggsCollected");
    return out;
}

/** `/api/ark/kept`'s answer, checked. */
export function decodeArkKeptFlags(raw: unknown): ArkKeptFlags {
    const row = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : null;
    return {captiveBreeding: row?.captive_breeding === true, humanUse: row?.human_use === true};
}

let cached: Promise<ArkKeptFlags> | null = null;

/** The switches, read once per page load (they change only when the owner switches them). */
export function readArkKeptFlags(fetcher: typeof fetch = fetch): Promise<ArkKeptFlags> {
    cached ??= fetcher("/api/ark/kept")
        .then((response) => (response.ok ? response.json() : null))
        .then((body) => decodeArkKeptFlags(body?.kept ?? null))
        .catch(() => ARK_KEPT_OFF);
    return cached;
}
