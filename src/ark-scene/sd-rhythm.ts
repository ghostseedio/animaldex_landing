/**
 * The schedule follows each species' System Dynamics (lane `ark-sd-align`, owner 2026-11-15; the rules are
 * `lib/ark-sd-rhythm.ts`, the per-species data `sd-rhythm.json` from `scripts/ark-sd-rhythm.mts`). SD is the researched
 * layer: where a species has it, the pull of its behaviours (`behaviour-schedule.ts` pick) is re-shared so its SD modes'
 * kinds take their weight's share of its choosing, and its choices are held for its tempo's bout (LOW long, HIGH slot by
 * slot). A species without SD, or one that flies (`flies` below), keeps today's rules, to the bit.
 *
 * Its own state moves one animal off its kind's rhythm (owner: "thriving would help the animal align"), by rule from
 * the server's `thrive` band and `condition` only (`arkRhythmShift`): prime its kind's rhythm in full, good close,
 * ordinary somewhat off (less of its modes, more idle); hungry searches more and rests less in broken bouts; old is
 * slower with longer rests. Visual only, deterministic: the same for every viewer, never an outcome.
 */

import table from "@/ark-scene/sd-rhythm.json";
import type {ArkBehaviour, ArkBehaviourProfile} from "@/ark-scene/behaviour-profile";
import type {ArkCondition, ArkThrive} from "@/ark-scene/types";
import {ARK_RHYTHM_COVER, arkRhythmShift, SD_CATEGORIES, SD_TEMPO, type SdCategory, type SdFrequency, type SdMix} from "@/lib/ark-sd-rhythm";

const ROWS = (table as {species: Record<string, string>}).species;

/** A species' SD rhythm as the scene keeps it. */
export type SpeciesSdRhythm = {target: SdMix; level: number; tempo: SdFrequency; page: string | null};

const decoded = new Map<string, SpeciesSdRhythm | null>();
export function speciesSdRhythm(slug: string): SpeciesSdRhythm | null {
    if (decoded.has(slug)) return decoded.get(slug)!;
    const row = ROWS[slug];
    let out: SpeciesSdRhythm | null = null;
    if (row) {
        const [level, kinds, page] = row.split("|");
        const target: SdMix = {};
        for (const pair of kinds ? kinds.split(",") : []) {
            const [k, v] = pair.split(":");
            if ((SD_CATEGORIES as readonly string[]).includes(k)) target[k as SdCategory] = Number(v) / 100;
        }
        const n = Number(level);
        out = {target, level: n, tempo: n < 0.67 ? "LOW" : n > 1.33 ? "HIGH" : "MID", page: page || null};
    }
    decoded.set(slug, out);
    return out;
}

/** Which kind each schedule behaviour is (null: neither a mode's kind nor waking idleness: a drink, a flight from danger). */
export const BEHAVIOUR_KIND: Record<ArkBehaviour, SdCategory | null> = {
    rest: "still", bask: "still", hide: "still", perch: "still",
    forage: "feed", graze: "feed", visit_flowers: "feed", stalk: "feed",
    wander: "move", fly: "move", soar: "move", swim: "move", dive: "move", climb: "move", flock: "move", circle_light: "move",
    burrow: "dig", groom: "care",
    drink: null, flee: null
};

/** One animal's choosing: its behaviours' pull and the slots its choice is held for. */
export type RhythmChoice = {weights: Partial<Record<ArkBehaviour, number>>; bout: number; /** Its social recipes' pull (`recipeIntent` socialPull). */ socialPull: number};

const choices = new Map<string, RhythmChoice | null>();

/**
 * Its choosing at its state, or null where its kind has no SD (today's rules). Remembered per species and state.
 */
export function rhythmChoice(profile: ArkBehaviourProfile, thrive: ArkThrive | null | undefined, condition: ArkCondition | null | undefined): RhythmChoice | null {
    const key = `${profile.slug}|${thrive ?? "ordinary"}|${condition ?? ""}`;
    if (choices.has(key)) return choices.get(key)!;
    const sd = speciesSdRhythm(profile.slug);
    let out: RhythmChoice | null = null;
    if (sd && !flies(profile)) {
        const shift = arkRhythmShift(thrive ?? "ordinary", condition === "hungry" || condition === "old" ? condition : null);
        const base = profile.weights;
        const entries = Object.entries(base) as Array<[ArkBehaviour, number]>;
        const mass = entries.reduce((s, [, w]) => s + w, 0);
        // Its modes' kinds it has a behaviour for (a kind it cannot show, a seal's digging, is left to the audit).
        const has = (kind: SdCategory) => entries.some(([b, w]) => w > 0 && BEHAVIOUR_KIND[b] === kind);
        const kinds = (Object.entries(sd.target) as Array<[SdCategory, number]>).filter(([k, v]) => v > 0 && has(k));
        const kindTotal = kinds.reduce((s, [, v]) => s + v, 0);
        const weights: Partial<Record<ArkBehaviour, number>> = {};
        if (kindTotal > 0 && mass > 0) {
            const inModes = new Set(kinds.map(([k]) => k));
            const rest = entries.filter(([b]) => !inModes.has(BEHAVIOUR_KIND[b] as SdCategory));
            const restMass = rest.reduce((s, [, w]) => s + w, 0);
            const cover = restMass > 0 ? shift.cover : 1;
            for (const [kind, share] of kinds) {
                const own = entries.filter(([b]) => BEHAVIOUR_KIND[b] === kind);
                const ownMass = own.reduce((s, [, w]) => s + w, 0);
                for (const [b, w] of own) weights[b] = (cover * mass * (share / kindTotal) * w) / ownMass;
            }
            for (const [b, w] of rest) weights[b] = ((1 - cover) * mass * w) / restMass;
        } else Object.assign(weights, base);
        for (const b of Object.keys(weights) as ArkBehaviour[]) {
            const kind = BEHAVIOUR_KIND[b];
            weights[b] = weights[b]! * (kind === "feed" ? shift.feed : kind === "still" ? shift.still : kind === "move" ? shift.move : 1);
        }
        // (Its social modes, courting, calling, its nest, are recipes, not behaviours: their chance is raised by its
        // SD social share, up to four times at a wholly social kind kept in prime.)
        const social = (sd.target.social ?? 0) * (shift.cover / ARK_RHYTHM_COVER.prime);
        out = {weights, bout: Math.max(Math.round(SD_TEMPO[sd.tempo].bout * shift.bout), 1), socialPull: 1 + 3 * social};
    }
    choices.set(key, out);
    return out;
}

/**
 * Anything that flies keeps today's choosing whole (lane ark-sd-align's motion note, AnimalDex
 * docs/ark/sd-alignment-audit-2026-11.md): its slots are the flight lanes' take-offs, sweeps and landings, guarded on
 * today's mix (MA1-MA4, the town's roofs). Re-shared, the guards met edge cases they had never sampled: a walk-first
 * duck taking off 7.5 times an hour, a heron's 4.9 m hop flight, a swallow's sweeps under the crowns, a peregrine
 * foraging into a town building. Its SD tempo and shares are the audit's gap for those lanes.
 */
function flies(profile: Pick<ArkBehaviourProfile, "move" | "moves">): boolean {
    return profile.move === "fly" || profile.moves.includes("fly");
}

/** Its schedule follows its kind's SD (and its own state moves it off): SD the Ark can show, and it does not fly. */
export function followsSd(profile: Pick<ArkBehaviourProfile, "slug" | "move" | "moves">): boolean {
    return Boolean(speciesSdRhythm(profile.slug)) && !flies(profile);
}

/** Where its bouts start (slots), its own for life: not every animal of a kind switching on one slot. */
export function boutPhase(hash: number, bout: number): number {
    return bout > 1 ? hash % bout : 0;
}
