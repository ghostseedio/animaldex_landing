/**
 * Every animal sleeps (owner, 2026-11-15: "why is an animal awake all day, every animal sleeps"). One active at any hour
 * (its activity "any": a giraffe, a zebra, an elephant, a mallard, an ant) sleeps its kind's hours a day in bouts of its
 * own, placed by its id: the shared position module's `sleepWindows` over `sleep.json` (AnimalDex
 * scripts/ark/generate_sleep_hours.py: hours by rule from its taxonomy, each rule with its source). The server's awake
 * time (encounter hunting, hunger) reads the same file through the same functions, so the scene's sleepers are the
 * server's. Every other activity keeps the sun's rule, exactly as before.
 */
import table from "@/ark-scene/positions/sleep.json";
import {awakeAtHour, sleepOf, sleepWindows, type Sleep, type SleepTable} from "@/ark-scene/positions/positions";

const SLEEP = table as unknown as SleepTable;

/** Each animal's sleep, worked out once (the scene asks every frame; the same object, so its windows are remembered too). */
const known = new Map<string, {sleep: Sleep | null}>();

function entryOf(animal: {id: string; species_profile_id?: string | null; kind_species_profile_id?: string | null}) {
    const key = `${animal.id}|${animal.kind_species_profile_id ?? ""}|${animal.species_profile_id ?? ""}`;
    let entry = known.get(key);
    if (!entry) {
        const sleep = sleepOf(SLEEP, animal.id, animal.kind_species_profile_id ?? null, animal.species_profile_id ?? null);
        entry = {sleep};
        if (known.size > 20000) known.clear();
        known.set(key, entry);
    }
    return entry;
}

/** Its own sleep (its kind's row first, a breed sleeping as its kind), or null: the sun's rule for its activity. */
export function arkSleepOf(animal: {id: string; species_profile_id?: string | null; kind_species_profile_id?: string | null}): Sleep | null {
    return entryOf(animal).sleep;
}

const windowsBy = new WeakMap<Sleep, number[]>();

/**
 * Awake at an island hour: the sun's rule for its activity, its own bouts for one active at any hour that sleeps. The
 * same answer as the shared module's `awakeAtHour` (tested), its windows remembered per sleep.
 */
export function arkAwakeAtHour(activity: string | null | undefined, hours: number, sleep: Sleep | null | undefined): boolean {
    if (activity !== "any" || !sleep) return awakeAtHour(activity, hours, sleep ?? null);
    let windows = windowsBy.get(sleep);
    if (!windows) windowsBy.set(sleep, (windows = sleepWindows(sleep)));
    const h = ((hours % 24) + 24) % 24;
    for (let i = 0; i < windows.length; i += 2) if (h >= windows[i] && h < windows[i + 1]) return false;
    return true;
}

export type {Sleep};
