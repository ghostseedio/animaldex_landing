/**
 * Young that look and act young (liveliness pass, section 4): how old each
 * animal is, how big it is drawn for its age, whether it follows a parent,
 * rides on one, stays at the nest or den, and how much it plays; eggs sat on
 * or left; old animals a little slower.
 *
 * Ages come from the server's log only (`born_ark_day`, `laid_ark_day`, the
 * `condition` "old"), so the scene agrees with the life stories. Visual
 * only: nothing here changes a birth, a meal, a death or a score.
 *
 * Care comes from the species' stored text (`care.json`, built by
 * `scripts/ark-care.mts` from `species_field_guide.female_offspring_notes`);
 * where the text is silent, from the body plan, flagged `plan_default`.
 * Growth times are the plan's (or twice a stated independence age), in Ark
 * days, which the ecology counts as days of life.
 */

import careTable from "@/ark-scene/care.json";
import {decodeCare, type ArkCare, type ArkCareKind} from "@/lib/ark-care";
import {hash32} from "@/lib/ark-clock";

const CARE = (careTable as unknown as {species: Record<string, [string, number, string]>}).species;

/** A species' care: its text's, else its plan's default (flagged). */
export function speciesCare(slug: string | null | undefined, plan: string | null | undefined): ArkCare {
    return decodeCare(slug ? CARE[slug] : null, plan);
}

/** Days from birth to full size, by plan (where the text gives no independence age). */
const PLAN_GROW_DAYS: Record<string, number> = {
    mammal: 300, cetacean: 700, bird: 70, reptile: 700, turtle: 1500, frog: 200, fish: 300, ray: 500,
    arthropod: 120, insect: 40, sessile: 200, jellyfish: 60, cephalopod: 200, worm: 60
};
/** Size at birth or hatching, times the adult's (drawn, before the scene's size floor). */
const PLAN_BIRTH_SCALE: Record<string, number> = {
    mammal: 0.35, cetacean: 0.4, bird: 0.3, reptile: 0.25, turtle: 0.2, frog: 0.3, fish: 0.2, ray: 0.3,
    arthropod: 0.35, insect: 0.4, sessile: 0.3, jellyfish: 0.3, cephalopod: 0.25, worm: 0.4
};
/** How much the young play (extra idle movement), where the body plan allows it. */
const PLAN_PLAY: Record<string, number> = {mammal: 1, cetacean: 0.6, bird: 0.35};

export type ArkAgeStage = "egg" | "young" | "adult" | "old";

export type ArkAgeInput = {
    id: string;
    origin?: "arrived" | "born" | null;
    /** The Ark day it was born or hatched (the server's). */
    born_ark_day?: number | null;
    /** An egg, or one that hatched from an egg: the day it was laid. */
    laid_ark_day?: number | null;
    /** An egg's hatch day, when the server sends it (`nests[].hatch_ark_day`). */
    hatch_ark_day?: number | null;
    status?: string | null;
    condition?: "well_fed" | "hungry" | "old" | null;
    /** Its parents' ids that are still aboard (a birth's `parents`). */
    parents?: string[] | null;
};

export type ArkAge = {
    stage: ArkAgeStage;
    /** Days since birth; null for an arrival (it came aboard grown) or an egg. */
    ageDays: number | null;
    /** 0 newborn … 1 full grown. */
    growth: number;
    /** Times the species' drawn length (the scene's size floor and marker still apply after it). */
    scale: number;
    /** The parent it keeps close to, and how close (in the parent's body lengths); null when on its own. */
    follow: {parentId: string; distance: number} | null;
    /** Riding on (or clinging to) the parent. */
    carried: boolean;
    /** Kept at the nest or den (the parent comes and goes). */
    atHome: boolean;
    /** 0–1 extra idle play. */
    play: number;
    /** Times its walking pace and idle rate. */
    pace: number;
    /** An egg's progress to hatching (0–1), and whether a parent sits on it. */
    egg: {progress: number; satOn: boolean} | null;
    care: ArkCareKind;
    careBasis: ArkCare["basis"];
};

function clamp01(v: number): number {
    return Math.min(Math.max(v, 0), 1);
}

/** The parent a young one keeps to: one of those aboard, chosen from its own id so every viewer agrees. */
export function chosenParent(id: string, parents: string[] | null | undefined): string | null {
    const aboard = Array.from(new Set((parents ?? []).filter(Boolean))).sort();
    if (!aboard.length) return null;
    return aboard[hash32(id, "parent") % aboard.length];
}

export function ageOf(animal: ArkAgeInput, arkDay: number, plan: string | null | undefined, care: ArkCare): ArkAge {
    const p = plan ?? "";
    const base = {care: care.kind, careBasis: care.basis};
    if (animal.status === "egg") {
        const laid = animal.laid_ark_day ?? arkDay;
        const hatch = animal.hatch_ark_day ?? null;
        const progress = hatch != null && hatch > laid ? clamp01((arkDay - laid) / (hatch - laid)) : 0;
        return {...base, stage: "egg", ageDays: null, growth: 0, scale: 0, follow: null, carried: false, atHome: true, play: 0, pace: 0,
            egg: {progress, satOn: p === "bird" || care.kind === "nest" || care.kind === "guard"}};
    }
    const old = animal.condition === "old";
    const adult = (stage: ArkAgeStage, ageDays: number | null): ArkAge => ({
        ...base, stage, ageDays, growth: 1, scale: 1, follow: null, carried: false, atHome: false, play: 0, pace: stage === "old" ? 0.82 : 1, egg: null
    });
    if (animal.origin !== "born" || animal.born_ark_day == null) return adult(old ? "old" : "adult", null);

    const ageDays = Math.max(0, arkDay - animal.born_ark_day);
    const growDays = care.independentDays ? Math.max(care.independentDays * 2, 10) : PLAN_GROW_DAYS[p] ?? 200;
    const independent = care.independentDays ?? growDays * 0.5;
    const f = clamp01(ageDays / growDays);
    if (f >= 1) return adult(old ? "old" : "adult", ageDays);

    const growth = 1 - (1 - f) ** 2;
    const birth = PLAN_BIRTH_SCALE[p] ?? 0.3;
    const scale = birth + (1 - birth) * growth;
    const dependent = ageDays < independent;
    const parentId = chosenParent(animal.id, animal.parents);
    let follow: ArkAge["follow"] = null;
    let carried = false;
    let atHome = false;
    if (dependent) {
        switch (care.kind) {
            case "carry":
                // Carried for the first third of its dependence, then at heel.
                carried = parentId != null && ageDays < independent / 3;
                if (parentId) follow = {parentId, distance: carried ? 0 : 0.7};
                break;
            case "follow":
                if (parentId) follow = {parentId, distance: 0.7 + 0.8 * f};
                break;
            case "nest":
                atHome = true;
                break;
            case "guard":
                // Guarded at first, then off on its own.
                if (parentId && ageDays < independent * 0.3) follow = {parentId, distance: 1.5};
                break;
            case "none":
                break;
        }
    }
    const play = (PLAN_PLAY[p] ?? 0) * Math.sqrt(1 - f) * (care.kind === "none" ? 0.3 : 1);
    return {...base, stage: "young", ageDays, growth, scale, follow, carried, atHome, play, pace: 1, egg: null};
}
