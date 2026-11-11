/**
 * How an animal rests now, in the tap card's plain words (the sleep lane: `src/ark-scene/sleep.ts` restStatus, told
 * by the scene's `onRest`): "Asleep in its den", "Asleep on one leg", "Keeping watch", "Dozing in the sun".
 */

import type {ArkRestWords} from "@/lib/ark-words";

/** The scene's rest status (`ArkRestStatus` in `src/ark-scene/sleep.ts`; kept as a string here so the page needs no scene code). */
export const ARK_REST_KEYS: Record<string, keyof ArkRestWords> = {
    asleep: "asleep",
    asleep_den: "asleepDen",
    asleep_burrow: "asleepBurrow",
    asleep_perch: "asleepPerch",
    asleep_hanging: "asleepHanging",
    asleep_standing: "asleepStanding",
    asleep_one_leg: "asleepOneLeg",
    asleep_water: "asleepWater",
    asleep_huddle: "asleepHuddle",
    resting: "resting",
    resting_den: "restingDen",
    dozing_sun: "dozingSun",
    basking: "basking",
    on_watch: "onWatch"
};

/** Its rest in words, or null (up and about, or words without the sleep lane's keys: the card then says "Asleep now" or nothing). */
export function arkRestWords(rest: string | null | undefined, words: Partial<ArkRestWords> | null | undefined): string | null {
    const key = rest ? ARK_REST_KEYS[rest] : undefined;
    return (key && words?.[key]) || null;
}

/** Whether a rest is sleep (the card's night-blue chip) rather than resting awake. */
export function arkRestIsSleep(rest: string | null | undefined): boolean {
    return Boolean(rest && rest.startsWith("asleep"));
}
