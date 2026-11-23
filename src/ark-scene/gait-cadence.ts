// ARK-ANIM: the most gait cycles a second a rig clip plays, by body size.
//
// Played by the distance covered, a gait's feet stay planted (`cyclesFor`); above this cap they slide a little instead.
// Decision 447 (the owner's blue-tongued skink "too shaky") set one cap of 6 Hz for every animal: a short-legged clip played
// at 3.5 times its pace ran its legs at 20-30 cycles a second, a blur at 60 frames a second. But small animals really
// stride faster than that: by dynamic similarity stride frequency goes as 1/√(length) (the same √(g·L) the scene's
// `moveSpeed` paces them by), so a rat or a hamster at its own run needs 7-9 cycles a second, and at 6 its feet slid
// 20-30%. The cap now follows the animal's true body length (`arkBody(...).metres`, head and body for a mammal): 6 Hz at
// half a metre and above (every animal that size or larger, the skink among them, exactly as before), rising as 1/√L to
// at most 10 Hz (12.5 cm and smaller). Never above 10, so nothing ever plays the blur 447 removed.

/** The cap for an animal half a metre long or longer (decision 447's single cap). */
export const GAIT_HZ_MAX = 6;
/** The most any animal's gait plays, however small. */
export const GAIT_HZ_MAX_SMALL = 10;
/** The body length (m) at and above which the cap is GAIT_HZ_MAX. */
export const GAIT_HZ_FULL_LENGTH = 0.5;

/** The most gait cycles a second for an animal `metres` long (its true body length); 6 for an unknown length. */
export function gaitHzMax(metres: number | null | undefined): number {
    if (!(typeof metres === "number" && Number.isFinite(metres) && metres > 0)) return GAIT_HZ_MAX;
    return Math.min(GAIT_HZ_MAX_SMALL, Math.max(GAIT_HZ_MAX, GAIT_HZ_MAX * Math.sqrt(GAIT_HZ_FULL_LENGTH / metres)));
}
