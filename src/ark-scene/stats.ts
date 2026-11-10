/**
 * The five animal stats in the Ark (`species_profiles.canonical_game_stats`:
 * size, speed, dominance, rarity, intelligence, each 0–100), and what they
 * shape in the scene (`docs/ark-next.md`, "Addendum: animal stats in the
 * Ark"). They shape looks and behaviour only: never life or death, never
 * the Ark Score, never who gets eaten (the server decides every meal), and
 * nothing here is random: the same animal looks and moves the same for
 * every viewer.
 *
 * - size: how long it is drawn (`arkBody`);
 * - speed: how fast it moves (`bodyLengthsPerSecond`);
 * - dominance and rarity: where in its zone it stands (`placement.ts`);
 * - intelligence: how varied its idles are and how often it glances at a
 *   camera close by (`arkIdleBehaviour`, `glance`).
 *
 * Where they come from: the snapshot's own `stats` / `length_m` when the
 * server sends them, else `species-stats.json`, generated from the live
 * catalogue by `scripts/ark-species-stats.mts` (every species that can come
 * aboard).
 */

import table from "@/ark-scene/species-stats.json";
import type {TalkingBehaviour} from "@/lib/talking-models/behaviour";

export type ArkStats = {size: number; speed: number; dominance: number; rarity: number; intelligence: number};
export const ARK_STAT_KEYS = ["size", "speed", "dominance", "rarity", "intelligence"] as const;

/** An animal's own stats and stored length, as the snapshot may carry them. */
export type ArkStatsSource = {model_slug: string; stats?: Partial<ArkStats> | null; length_m?: number | null};

type Row = [number, number, number, number, number] | [number, number, number, number, number, number];
const SPECIES = (table as unknown as {species: Record<string, Row>}).species;

/** The middle of the scale, for a species the catalogue has no stats for. */
const MIDDLE: ArkStats = {size: 30, speed: 50, dominance: 50, rarity: 30, intelligence: 40};

const clamp = (value: number, low: number, high: number) => Math.min(Math.max(value, low), high);

function stat(value: unknown): number | null {
    return typeof value === "number" && Number.isFinite(value) ? clamp(value, 0, 100) : null;
}

/** Whether the catalogue (or the snapshot) knows this species' stats. */
export function hasArkStats(animal: ArkStatsSource): boolean {
    return Boolean(SPECIES[animal.model_slug]) || stat(animal.stats?.size) !== null;
}

/** The species' five stats: the snapshot's where it sends them, else the catalogue's, else the middle. */
export function arkStats(animal: ArkStatsSource): ArkStats {
    const row = SPECIES[animal.model_slug];
    const own = animal.stats ?? {};
    const out = {...MIDDLE};
    ARK_STAT_KEYS.forEach((key, i) => {
        out[key] = stat(own[key]) ?? (row ? row[i] : MIDDLE[key]);
    });
    return out;
}

/** A stored body length (m) for the species, if one is known. */
export function storedLength(animal: ArkStatsSource): number | null {
    const own = animal.length_m;
    if (typeof own === "number" && Number.isFinite(own) && own > 0) return own;
    const row = SPECIES[animal.model_slug];
    return row && row.length > 5 && row[5]! > 0 ? row[5]! : null;
}

// MARK: Size

/**
 * [body mass kg, size] anchors fitted to the catalogue's own ratings:
 * `supabase/functions/_shared/observed-size-scale.ts` MASS_SIZE_ANCHORS in
 * the AnimalDex repo (ant 1, mouse 5, cat 26, wolf 43, horse 70, elephant
 * 92, blue whale 100). Read the other way here: size to mass.
 */
const MASS_SIZE_ANCHORS: ReadonlyArray<readonly [number, number]> = [
    [0.000003, 1],
    [0.0001, 2],
    [0.02, 5],
    [0.1, 9],
    [0.4, 13],
    [1, 17],
    [3, 22],
    [5, 26],
    [15, 30],
    [40, 42],
    [80, 47],
    [150, 55],
    [250, 62],
    [500, 70],
    [1_000, 78],
    [3_000, 84],
    [6_000, 92],
    [30_000, 95],
    [150_000, 100]
];

/** The body mass (kg) the size stat stands for: the anchors, log-linear between them. */
export function massFromSize(size: number): number {
    const anchors = MASS_SIZE_ANCHORS;
    if (size <= anchors[0][1]) return anchors[0][0];
    const last = anchors[anchors.length - 1];
    if (size >= last[1]) return last[0];
    for (let i = 1; i < anchors.length; i++) {
        const [upperMass, upperSize] = anchors[i];
        if (size > upperSize) continue;
        const [lowerMass, lowerSize] = anchors[i - 1];
        const t = (size - lowerSize) / (upperSize - lowerSize);
        return 10 ** (Math.log10(lowerMass) + t * (Math.log10(upperMass) - Math.log10(lowerMass)));
    }
    return last[0];
}

/** Body length (m) from mass (kg): a body-density allometry. An estimate, and labelled as one. */
export function lengthFromMass(massKg: number): number {
    return 0.33 * Math.cbrt(massKg);
}

/** Drawn no smaller than this (m): below it the animal also gets a marker. */
export const ARK_SIZE_FLOOR = 0.18;
/** Drawn no larger than this (m): the whales. */
export const ARK_SIZE_CAP = 9;

/** On-screen length (m) for a body length (m): L^0.6 keeps a mouse visible beside an elephant. */
export function screenLength(lengthM: number): number {
    return clamp(1.2 * Math.max(lengthM, 0) ** 0.6, ARK_SIZE_FLOOR, ARK_SIZE_CAP);
}

/** Body lengths (m) by body plan, for a species with neither a stored length nor stats (a visitor the catalogue lacks). */
const PLAN_LENGTH_M: Record<string, number> = {
    mammal: 1.2,
    bird: 0.45,
    reptile: 1,
    turtle: 0.8,
    frog: 0.1,
    fish: 0.6,
    ray: 1.5,
    cetacean: 6,
    arthropod: 0.2,
    insect: 0.05,
    sessile: 0.2,
    jellyfish: 0.4,
    cephalopod: 0.8,
    worm: 0.2
};

export type ArkBody = {
    /** Body length in metres. */
    metres: number;
    /** stored: a measurement; estimate: from the size stat through mass; plan: the body plan's typical length. */
    source: "stored" | "estimate" | "plan";
    /** Drawn length in world metres. */
    display: number;
    /** At the floor: it gets a marker so it can be found. */
    floor: boolean;
};

/** How long the animal is, and how long it is drawn. */
export function arkBody(animal: ArkStatsSource, plan?: string | null): ArkBody {
    const stored = storedLength(animal);
    let metres: number;
    let source: ArkBody["source"];
    if (stored !== null) {
        metres = stored;
        source = "stored";
    } else if (hasArkStats(animal)) {
        metres = lengthFromMass(massFromSize(arkStats(animal).size));
        source = "estimate";
    } else {
        metres = PLAN_LENGTH_M[plan ?? ""] ?? 1;
        source = "plan";
    }
    const raw = 1.2 * metres ** 0.6;
    return {metres, source, display: screenLength(metres), floor: raw <= ARK_SIZE_FLOOR};
}

// MARK: Speed

/** How fast it moves, in its own body lengths a second: 0.6 at speed 0, 2 at speed 100. */
export function bodyLengthsPerSecond(speed: number): number {
    return clamp(0.6 + clamp(speed, 0, 100) / 100 * 1.4, 0.6, 2);
}

/** How fast it moves on screen (m/s), from its drawn length. A chase at full pace. */
export function moveSpeed(animal: ArkStatsSource, display: number): number {
    return clamp(bodyLengthsPerSecond(arkStats(animal).speed) * display, 0.25, 9);
}

/** Its idle loops (a swimmer's, a flyer's) against the middle of the scale: about 0.6× to 1.5×. */
export function loopPace(animal: ArkStatsSource): number {
    return bodyLengthsPerSecond(arkStats(animal).speed) / 1.3;
}

// MARK: Intelligence

/** The idles that read on the Ark's light models (root motion only), most telling first. */
const VARIED: ReadonlyArray<"look" | "sniff" | "shake" | "bob"> = ["look", "sniff", "shake", "bob"];

/**
 * The model's idle profile, shaped by intelligence: a sharper animal does
 * more different things (look, sniff, shake, bob are added, and what it
 * does often no longer swamps the rest, so it repeats less); a creature of
 * instinct keeps to what it does most. Visual only.
 */
export function arkIdleBehaviour(behaviour: TalkingBehaviour | null | undefined, intelligence: number): TalkingBehaviour {
    const q = clamp(intelligence, 0, 100) / 100;
    const idle: Record<string, number> = {...(behaviour?.idle ?? {})};
    const level = (kind: string) => Math.max(0, Math.min(3, Math.trunc(Number(idle[kind]) || 0)));
    if (q < 0.25) {
        // Instinct: what it does most, again and again.
        const most = Math.max(0, ...Object.keys(idle).map(level));
        for (const kind of Object.keys(idle)) if (level(kind) < most) idle[kind] = 0;
        if (most === 0) idle.look = 1;
    } else {
        // One more kind of idle for each fifth of the scale past the first.
        const extra = Math.min(VARIED.length, Math.floor((q - 0.05) * 5));
        for (const kind of VARIED.slice(0, extra)) idle[kind] = Math.max(level(kind), 1);
        // Sharp ones even out: nothing "often" (9 to 1) over the rest, at most "sometimes" (4 to 1).
        if (q >= 0.6) for (const kind of Object.keys(idle)) idle[kind] = Math.min(level(kind), 2);
    }
    return {...(behaviour ?? {}), idle};
}

/** Seconds between glances at a camera close by: about 26 s for a creature of instinct, 8 s for the sharpest. */
export function glancePeriod(intelligence: number): number {
    return 26 - 18 * clamp(intelligence, 0, 100) / 100;
}

const GLANCE_SECONDS = 2.4;

/**
 * How far into a glance at the camera it is now (0 not glancing, 1 looking
 * straight at it): eased in and out over 2.4 s, once a period, its phase
 * from the animal's own hash.
 */
export function glance(intelligence: number, time: number, phase: number): number {
    const period = glancePeriod(intelligence);
    const into = ((time + phase * period) % period + period) % period;
    if (into >= GLANCE_SECONDS) return 0;
    const t = into / GLANCE_SECONDS;
    const edge = Math.min(t / 0.25, (1 - t) / 0.3, 1);
    return edge * edge * (3 - 2 * edge);
}
