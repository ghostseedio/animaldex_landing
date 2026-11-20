/**
 * Tail postures of the rigged mammals (lane SIG-OTHER, 2026-11-20): the way a species carries or moves its tail, from its
 * own catalogue row (`tail-postures.json`, built by `scripts/ark-tail-postures.mts` from AnimalDex
 * docs/ark/signature-behaviours.json, never edited by hand): a dog wags it as a social signal, a coati carries its ringed
 * tail straight up like a flag while it walks, a chipmunk runs with its tail held up, a hamadryas baboon holds it in an
 * arch, an olive baboon bends it sharply near the base, a toque macaque carries its long tail in an S.
 *
 * Drawn by the locomotion layer's legged driver (`locomotion/legged.ts`): its tail is a chain of springs (tail0-tail2 of
 * the rig), and this adds a posture on top of the links' own angles: a pitch each link holds (up is positive), a wag's yaw
 * swinging down the chain a little later at each link (the tip last). A species with no row, or a rig with no tail, is
 * left as it was. Visual only: nothing here decides anything on the Ark. The social signal is the scene's: the dog looks at
 * another animal or at the camera, or is at play; the posture is a pure function of the clock and the animal's seed.
 */

import table from "@/ark-scene/tail-postures.json";

/** When the posture is held: always; only while it moves (the locomotion layer's `motion`, 0-1); only while it signals socially (0-1, the scene's). */
export type TailHold = "always" | "moving" | "social";
export type TailPostureSpec = {
    name: string;
    id: string;
    quote: string;
    line: string;
    when: TailHold;
    /** The pitch (rad) each link holds at full hold (up is positive; the base link first). */
    pitch: number[];
    /** The share of the pitch kept when it is not held (a coati's tail rests half up). */
    idle?: number;
    /** A wag: the yaw swing (rad) of each link at full social strength, and its rate (Hz). */
    wag?: {amp: number[]; rate: number};
};

const SPECIES = (table as unknown as {species: Record<string, TailPostureSpec>}).species;

/** The species' tail posture, or null (most species: the tail's own springs alone). */
export function tailPostureOf(slug: string | null | undefined): TailPostureSpec | null {
    return (slug && SPECIES[slug]) || null;
}

/** Every species with a tail posture (the tests and the harness). */
export function tailPostureSpecies(): Array<[string, TailPostureSpec]> {
    return Object.entries(SPECIES);
}

/** What the legged driver knows when it poses the tail. */
export type TailNow = {motion: number; social: number; clock: number; seed: number};

/** How much the posture is held now (0-1). */
export function tailHold(spec: TailPostureSpec, now: Pick<TailNow, "motion" | "social">): number {
    const raw = spec.when === "always" ? 1 : spec.when === "moving" ? now.motion : now.social;
    return Math.min(Math.max(raw, 0), 1);
}

export type TailLinks = {pitch: number[]; yaw: number[]};

/**
 * The posture's angles for each of the rig's `links` tail bones, to add to the springs' own: pitch (up positive), and the
 * wag's yaw, the swing arriving later down the chain. Pure in its inputs.
 */
export function tailPostureLinks(spec: TailPostureSpec, now: TailNow, links: number): TailLinks {
    const hold = tailHold(spec, now);
    const keep = spec.idle ?? 0;
    const share = keep + (1 - keep) * hold;
    const pitch: number[] = [];
    const yaw: number[] = [];
    for (let k = 0; k < links; k++) {
        const at = Math.min(k, spec.pitch.length - 1);
        pitch.push(spec.pitch[at] * share);
        if (spec.wag && now.social > 0.001) {
            const beat = Math.PI * 2 * (spec.wag.rate * now.clock + now.seed) - k * 0.9;
            yaw.push(spec.wag.amp[Math.min(k, spec.wag.amp.length - 1)] * Math.min(now.social, 1) * Math.sin(beat));
        } else yaw.push(0);
    }
    return {pitch, yaw};
}

/** Where the social signal wants to be now (0 or 1), from what the scene sees of the animal. */
export function socialTarget(spec: TailPostureSpec, seen: {looking: string | null; doing: string | null}): number {
    if (spec.when !== "social") return 0;
    if (seen.doing === "play") return 1;
    // It looks at another animal (an id) or at the camera: a greeting. (Not a sound, a spot or nothing.)
    return seen.looking && seen.looking !== "sound" && seen.looking !== "spot" ? 1 : 0;
}

/** One frame: the social strength follows its target (up in about a third of a second, down over a second or two). */
export function stepSocial(strength: number, target: number, dt: number): number {
    if (!(dt > 0)) return strength;
    const step = (target > strength ? 3 : 0.6) * dt;
    return target > strength ? Math.min(strength + step, target) : Math.max(strength - step, target);
}
