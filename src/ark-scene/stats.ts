/**
 * The five animal stats in the Ark (`species_profiles.canonical_game_stats`:
 * size, speed, dominance, rarity, intelligence, each 0–100), and what they
 * shape in the scene (`docs/ark-next.md`, "Addendum: animal stats in the
 * Ark"). They shape looks and behaviour only: never life or death, never
 * the Ark Score, never who gets eaten (the server decides every meal), and
 * nothing here is random: the same animal looks and moves the same for
 * every viewer.
 *
 * - size: how long it is drawn (`arkBody`): its true length, in real metres
 *   (true-scale lane, motion pass §3: no curve, no floor, no cap);
 * - speed: how fast it moves (`bodyLengthsPerSecond`);
 * - dominance and rarity: where in its zone it stands (`placement.ts`);
 * - intelligence: how varied its idles are and how often it glances at a
 *   camera close by (`arkIdleBehaviour`, `glance`).
 *
 * Where they come from: the snapshot's own `stats` / `length_m` when the
 * server sends them, else `species-stats.json`, generated from the live
 * catalogue, the data-gap lengths and the ark models by
 * `scripts/ark-species-stats.mts` (every species that can come aboard; its
 * sizes and their sources are listed in `docs/ark/true-scale.md`).
 */

import table from "@/ark-scene/species-stats.json";
import type {TalkingBehaviour} from "@/lib/talking-models/behaviour";

import {ARK_STAT_KEYS, type ArkStats} from "@/ark-scene/stat-keys";

export {ARK_STAT_KEYS, type ArkStats} from "@/ark-scene/stat-keys";

/** An animal's own stats and stored length, as the snapshot may carry them. */
export type ArkStatsSource = {model_slug: string; stats?: Partial<ArkStats> | null; length_m?: number | null};

type Row = [number, number, number, number, number];
/** [drawn length of the model along its body axis (m), body length (m), index into `sources`]. */
type LengthRow = [number, number, number];
const TABLE = table as unknown as {species: Record<string, Row>; lengths: Record<string, LengthRow>; sources: string[]};
const SPECIES = TABLE.species;
const LENGTHS = TABLE.lengths;

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

/** The snapshot's own stored body length (m), if the server sends one. */
export function storedLength(animal: ArkStatsSource): number | null {
    const own = animal.length_m;
    return typeof own === "number" && Number.isFinite(own) && own > 0 ? own : null;
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

/** Body lengths (m) by body plan, for a species with neither a known length nor stats (a visitor the catalogue lacks). */
const PLAN_LENGTH_M: Record<string, number> = {
    mammal: 1.2,
    bird: 0.45,
    reptile: 1,
    turtle: 0.8,
    frog: 0.1,
    fish: 0.6,
    ray: 1.5,
    cetacean: 6,
    arthropod: 0.02,
    insect: 0.015,
    butterfly: 0.05,
    sessile: 0.2,
    jellyfish: 0.3,
    cephalopod: 0.6,
    worm: 0.1,
    snake: 1.2,
    eel: 0.8,
    flatfish: 0.4,
    slow_invertebrate: 0.04
};

/**
 * Where a size comes from (`docs/ark/true-scale.md`):
 * - stored: the catalogue's own measurement (the traits lane's `length_m`, or the stats basis' size clause);
 * - data-gap: a generated typical adult length (the data-gap work's way: kept apart and labelled), where nothing is stored;
 * - estimate: the size stat through the catalogue's mass anchors (`L = 0.33 · mass^(1/3)`);
 * - plan: the body plan's typical length, for a species the catalogue lacks.
 */
export type ArkSizeSource = "stored" | "data-gap" | "estimate" | "plan";

export type ArkBody = {
    /** Body length in metres: head and body for a mammal (no tail), the whole animal otherwise. */
    metres: number;
    source: ArkSizeSource;
    /** Drawn length (m) along the model's body axis (`bodyAxisExtent`): true to life, nothing compressed or capped. */
    display: number;
    /**
     * Always false at true scale (nothing is drawn larger than life, so there is no floor): kept for the scene's
     * marker rule, which marks any animal a few pixels across (`sizes.ts` findMarker).
     */
    floor: boolean;
};

/** How long the animal is, and how long its model is drawn: true to life (motion pass §3). */
export function arkBody(animal: ArkStatsSource, plan?: string | null): ArkBody {
    const row = LENGTHS[animal.model_slug];
    const stored = storedLength(animal);
    if (stored !== null) {
        // The server's own measurement: drawn in the same proportion as the table draws the species (its tail).
        const along = row && row[1] > 0 ? row[0] / row[1] : 1;
        return {metres: stored, source: "stored", display: stored * along, floor: false};
    }
    // A known length (stored, else the data-gap value) wins over the size stat, which only estimates one.
    if (row) {
        return {metres: row[1], source: (TABLE.sources[row[2]] ?? "estimate") as ArkSizeSource, display: row[0], floor: false};
    }
    if (hasArkStats(animal)) {
        const metres = lengthFromMass(massFromSize(arkStats(animal).size));
        return {metres, source: "estimate", display: metres, floor: false};
    }
    const metres = PLAN_LENGTH_M[plan ?? ""] ?? 1;
    return {metres, source: "plan", display: metres, floor: false};
}

/**
 * Birds measured bill to tail, along the body, however tall they stand: on
 * long legs or a long neck (waders, cranes, ratites), or level-bodied with
 * the head held up (fowl, ducks, geese, grebes).
 */
const ALONG = /(heron|egret|bittern|stork|jabiru|marabou|adjutant|openbill|crane|brolga|flamingo|ibis|spoonbill|shoebill|hamerkop|hammerkop|secretarybird|bustard|seriema|ostrich|emu|rhea|cassowary|stilt|avocet|limpkin|trumpeter|fowl|duck|goose|grebe)/;
/** Birds whose body runs upright, measured top to bottom. */
const UPRIGHT_BIRDS = /(?:^|-)(?:penguin|owl|potoo|frogmouth)(?:-|$)/;
/** Others measured top to bottom because that is how their body runs: seahorses, sea dragons, garden eels, gibbons. */
const UPRIGHT = /(?:^|-)(?:seahorse|seadragon|garden-eel|gibbon|siamang)(?:-|$)/;
/** Body plans with no head-to-tail axis lying down: measured by their height. */
const UPRIGHT_PLANS = new Set(["sessile", "jellyfish", "worm"]);

/**
 * The model's extent along the axis its body length is measured on, so the
 * model is scaled by `D / this` (L is a body length, head to tail).
 *
 * - Along z (the models face +z): a giraffe, a flamingo or a heron then
 *   stands as tall as its legs and neck make it, a snake and a fish lie
 *   along their length.
 * - Along y for an animal whose body runs upright, measured top to bottom
 *   (penguins, owls, perched birds that sit up tall such as hawks and
 *   macaws, seahorses, gibbons, corals, jellyfish, worms): its height.
 * - A z extent that is degenerate (under a fifth of the longest side):
 *   the longest horizontal one.
 */
export function bodyAxisExtent(slug: string, plan: string | null | undefined, extent: {x: number; y: number; z: number}): number {
    const x = Math.max(extent.x, 0.001);
    const y = Math.max(extent.y, 0.001);
    const z = Math.max(extent.z, 0.001);
    const bird = plan === "bird";
    const upright = UPRIGHT.test(slug) || (bird && UPRIGHT_BIRDS.test(slug)) || (UPRIGHT_PLANS.has(plan ?? "") && y > z) || (bird && y > z * 1.2 && !ALONG.test(slug));
    if (upright) return y;
    if (z < 0.2 * Math.max(x, y, z)) return Math.max(x, z);
    return z;
}

// MARK: Speed

/** How fast it moves, in its own body lengths a second: 0.6 at speed 0, 2 at speed 100. */
export function bodyLengthsPerSecond(speed: number): number {
    return clamp(0.6 + clamp(speed, 0, 100) / 100 * 1.4, 0.6, 2);
}

/**
 * How fast it moves on screen (m/s), from its drawn length: a chase at full pace. True scale (motion pass §3): by
 * dynamic similarity (`√(g·L)`, as legged gaits scale), so a 25 m whale is not 25 times a 1 m antelope's pace and a
 * mouse still darts; the speed stat sets the share of it (a quarter at 0, all of it at 100), so a cheetah outruns a lion.
 */
export function moveSpeed(animal: ArkStatsSource, display: number): number {
    const share = 0.25 + 0.75 * clamp(arkStats(animal).speed, 0, 100) / 100;
    return clamp(share * Math.sqrt(9.81 * Math.max(display, 0)), 0.03, 12);
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
