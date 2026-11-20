/**
 * Powers you can see (AnimalDex decision 420, phase 1): each kind's real Animal Power sorted into one visible survival
 * mechanism. The table (`power-mechanisms.json`) is built from `data/ark/power-mechanisms.json`, where every species'
 * Power is listed with its mechanism and a one-line reason quoting the Power; kinds whose Power is not a survival trait
 * are left out. Keyed by the first 8 hex of the species profile id (unique across the 2,701 Power rows and their
 * canonical ids; a folded duplicate's mechanism is under its canonical kind's key when that kind has none of its own).
 *
 * Light on purpose (no three.js): the tap card's lazy line and the scene's lazy layer (`power-show.ts`) both read it.
 * Never loaded by /ark's first JavaScript (`ark-page-weight.test.ts`).
 */

import table from "@/ark-scene/power-mechanisms.json";
import type {ArkAnimal, ArkThrive} from "@/ark-scene/types";

export const ARK_POWER_MECHANISMS = ["camouflage", "speed", "armour", "warning", "vigilance", "group", "hiding", "climb", "mimicry"] as const;
export type ArkPowerMechanism = (typeof ARK_POWER_MECHANISMS)[number];

/** A mimic's look: bands of the mimicked colour (a wasp's, a coral snake's), eyespots, feigning death or injury, or a tint. */
export type ArkMimicLook = {kind: "bands" | "eyes" | "feign" | "tint"; colour: string | null};

export type ArkPower = {mechanism: ArkPowerMechanism; mimic: ArkMimicLook | null};

const LETTERS: Record<string, ArkPowerMechanism> = {c: "camouflage", s: "speed", a: "armour", w: "warning", v: "vigilance", g: "group", h: "hiding", u: "climb", m: "mimicry"};
const LOOKS: Record<string, ArkMimicLook["kind"]> = {b: "bands", e: "eyes", f: "feign", t: "tint"};
const KINDS = (table as unknown as {kinds: Record<string, string>}).kinds;
const cache = new Map<string, ArkPower | null>();

function decode(code: string | undefined): ArkPower | null {
    if (!code) return null;
    const [letter, look, colour] = code.split(":");
    const mechanism = LETTERS[letter];
    if (!mechanism) return null;
    return {mechanism, mimic: mechanism === "mimicry" ? {kind: LOOKS[look] ?? "tint", colour: colour ?? null} : null};
}

/** A species profile id's mechanism, or null (no Power aboard the table, or one that is not a survival trait). */
export function arkPowerOfKind(id: string | null | undefined): ArkPower | null {
    if (!id) return null;
    const key = id.slice(0, 8).toLowerCase();
    if (!cache.has(key)) cache.set(key, decode(KINDS[key]));
    return cache.get(key) ?? null;
}

/** An animal's: its kind's (the canonical kind the read names), else its own species profile's. */
export function arkPowerOf(animal: Pick<ArkAnimal, "species_profile_id" | "kind_species_profile_id"> | null | undefined): ArkPower | null {
    if (!animal) return null;
    return arkPowerOfKind(animal.kind_species_profile_id) ?? arkPowerOfKind(animal.species_profile_id);
}

/**
 * How strongly its Power shows (decision 420: prime clearly, good partly, ordinary not). The band is the server's
 * thrive band, raised by its bringer's steps that worked: a Power earned and kept up. Visual only.
 */
export function arkPowerStrength(band: ArkThrive | null | undefined): number {
    return band === "prime" ? 1 : band === "good" ? 0.45 : 0;
}

/** Every key in the table (the tests). */
export function arkPowerKinds(): string[] {
    return Object.keys(KINDS);
}
