/**
 * The Ark ecology engine's own numbers, as the "Estimated time left" model reads them (lane ark-v3-timeleft).
 *
 * The engine lives in the AnimalDex repo (`supabase/functions/_shared/ark-ecology/`); the web cannot import it, so each
 * constant is written once here with the place it comes from, and `ark-time-left.test.ts` checks every one against the
 * engine's own source whenever a checkout is at hand (`ARK_ENGINE_DIR`, or `~/AnimalDex`): a changed engine constant
 * fails that test instead of silently drifting. Nothing here is a guess: a number with no engine source is not in this
 * file (the safe window of decision 389 D4, wounds, wild skill: see the hooks in `ark-time-left.ts`).
 *
 * 1 Ark day = 55.2 real minutes (365 Ark days to 14 real days).
 */

/** `rules.ts` ARK_DAYS_PER_REAL_DAY. */
export const ARK_DAYS_PER_REAL_DAY = 365 / 14;

/** `rules.ts` DEFAULT_CONFIG.oldLifeFrac: "old" from this share of the wild lifespan (the public read's `old_from_life_fraction`, 0.8). */
export const OLD_LIFE_FRACTION = 0.8;

/**
 * `rules.ts` DEFAULT_CONFIG.adultAge*: an arrival counts as grown on arrival (its age starts at 0.15 of the lifespan's middle,
 * 2 to 3650 days); a kind with no stored lifespan is grown from `defaultDays` (adultAgeDefaultDays).
 */
export const ADULT_AGE = {lifespanFraction: 0.15, minDays: 2, maxDays: 3650, defaultDays: 365} as const;

/** `rules.ts` DEFAULT_CONFIG.starve*: days of continuous hunger a predator lasts, 14 x kg^0.25, from 7 to 120 days. */
export const STARVE = {baseDays: 14, massExponent: 0.25, minDays: 7, maxDays: 120} as const;

/**
 * The live meal interval rule (`voyage_config.launch_ecology`, migration 20261115130000: mealIntervalRule "allometric",
 * endotherms 112 and ectotherms 448 Ark days x kg^0.27, from 7 to 365 days; a predator fed by ambient food hunts
 * 4 times less often, `fedHuntFactor`, which the read does not say and the model leaves out). `rules.ts` baseMealInterval / mealInterval.
 */
export const MEAL_INTERVAL = {endoDays: 112, ectoDays: 448, massExponent: 0.27, minDays: 7, maxDays: 365} as const;

/**
 * `encounter.ts`: a hunter that misses is still due and tries again at its next 15-Ark-minute step (`positions.ts`
 * STEPS_PER_ARK_DAY = 96), so a miss costs one step, not a meal interval (decision 389 D12 would add a cooldown).
 */
export const RETRY_AFTER_MISS_DAYS = 1 / 96;

/** `encounter.ts` (the floor of 3) and `rules.ts` DEFAULT_CONFIG.preySwitchMin: a kind is huntable only while this many are in the predator's pool. */
export const PREY_FLOOR = 3;

/**
 * The upper end of a wild lifespan over its lower end, for a kind whose upper end the read does not carry (the read's
 * `lifespan_days` is the lower end): the 10th, 50th and 90th percentile of the engine's own stored ranges,
 * `scripts/ark/data/lifespan_fill_2026-11-15.json` (615 kinds: 1.5, 2 and 3). Used only until the server sends the upper end.
 */
export const LIFESPAN_HI_OVER_LO = {low: 1.5, median: 2, high: 3} as const;

/**
 * The published hunting success of the predator kinds that have one (`voyage_species_traits.hunt_success`, decision 373;
 * `docs/ark/hunt-success.json` `for_record`, 22 kinds), by kind id: the range's middle is the engine's chance of a catch
 * (`encounter.ts`). Every other predator catches every time it tries.
 */
export const HUNT_SUCCESS: Readonly<Record<string, readonly [number, number]>> = {
    "9064b7e7-4441-4820-bcf2-bd5cdc678eba": [0.275, 0.275], // Common Buzzard
    "b4ff3d58-08ba-440d-8852-4096529fabb4": [0.21, 0.38], // Great Crested Grebe
    "4d02364b-30ba-4f45-8280-1ce36c5ed26a": [0.48, 0.96], // Great Egret
    "30cac9d2-521a-4570-8644-f0d74c2b71d9": [0.588, 0.588], // Laughing Kookaburra
    "be03b0da-67af-46e4-9d72-f0a570ee1e5e": [0.56, 0.6], // Little Blue Heron
    "677ed09d-bc0c-4d05-b869-ee168f6ec6ed": [0.2805, 0.2805], // Neotropic Cormorant
    "360d1b44-2874-4312-aa80-c4f99d5e1156": [0.5, 0.74], // Osprey
    "7e2ffcc3-79dc-4677-87be-b2481eec26c2": [0.61, 0.79], // Red-tailed Hawk
    "9187d87d-ec83-43f2-985a-bc09b0af1554": [0.93, 0.93], // Western Yellow Wagtail
    "9f99b80f-8643-4a43-b568-773bcececf05": [0.56, 0.56], // Axolotl
    "180adbb0-b186-4cbd-aa32-e637fd78ceef": [0.255, 0.3], // Banded Archerfish
    "5552fa2a-8b92-489e-b075-93d7513eb218": [0.18, 0.2], // European Perch
    "ea6149a8-b84f-4d21-824a-4cb573af853b": [0.14, 0.78], // Northern Pike
    "2c519194-962c-40f5-8b33-64e2198c816f": [0.26, 0.26], // Red-bellied Piranha
    "90acc70d-acb7-4234-a25d-9ac2cbdef9f7": [0.05, 0.5], // Flower Crab Spider
    "9a7d1f87-c392-4e71-b14d-8a39e10b6a7d": [0.28, 0.31], // Common Darter
    "7e7080ec-9c17-4a75-9d85-5a4f6a38e430": [0.15, 0.38], // African Lion
    "355114d7-d9b2-44bd-a567-cf23bd454456": [0.26, 0.26], // Eurasian Wolf
    "0b577f88-55a7-4ff3-abbc-5e7d3916cfab": [0.23, 0.23], // European Otter
    "739c19a0-5085-4945-af28-3542e74fb3ba": [0.38, 0.8], // Harbor Seal
    "8baa3fba-b3dd-4328-b3f6-e2c2d9ebdab0": [0.15, 0.33], // Spotted Hyena
    "696281b7-35ee-4f2a-b571-cbd4dd3d7522": [0.15, 0.15] // Common Snapping Turtle
};

/**
 * The Homo sapiens species profiles (AnimalDex 2fabfa9a, #2068, and the stray "Human" 0fd32bd2 without a scientific name):
 * the web's `town-humans.ts` `HUMAN_SPECIES_IDS` (the test checks both). A human is outside the food web (the links refuse Homo:
 * never prey, never a predator) and has no stored lifespan (AnimalDex decisions 378 and 380: no traits row, no old age).
 */
export const HUMAN_SPECIES_IDS: readonly string[] = ["2fabfa9a-6ec9-4d71-8cf2-1933edaef6d2", "0fd32bd2-669f-489d-8a1b-8e917aa5117d"];

/**
 * A human is grown 18 Ark years after it is born (the server's courtship `GROWN_DAYS`, `couples.ts`); an arrival counts as
 * grown on arrival. This is a human's `adultAgeDays` here, not the engine's default year for a kind with no stored lifespan.
 */
export const HUMAN_GROWN_DAYS = 18 * 365;

/**
 * Human old age (AnimalDex decision 442, `_shared/ark-ecology/human-life.ts` DEFAULT_HUMAN_OLD_AGE; while the server's
 * `human_old_age` is on its read sends a human's Prime lifespan as `lifespan_days` / `lifespan_days_hi`): the share of the
 * remaining life each condition band lives, and an arrival's age, an unknown point of its adult life (the engine draws it
 * by the animal's id; the web never reads or guesses that draw, it uses the rule's own spread).
 */
export const HUMAN_LIFE_FACTOR = {prime: 1, good: 0.95, ordinary: 0.85} as const;
