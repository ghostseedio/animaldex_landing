/**
 * Trial Loop storyboards for surfaces whose source has no `motion_storyboard`
 * column (`arena_caught_trials_v1`, the Discover Trial posts). Reads
 * `trial_motion_storyboards_v1`, which anon and authenticated may select.
 */

import type {SupabaseClient} from "@supabase/supabase-js";
import {parseTrialStoryboard, type TrialStoryboard} from "./storyboard";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FREQUENCIES = ["LOW", "MID", "HIGH"];

export function trialMotionKey(speciesProfileId: string, frequency: string) {
    return `${speciesProfileId.toLowerCase()}:${frequency.toUpperCase()}`;
}

/** `<species id lowercased>:<FREQUENCY>` → storyboard, for the drawable ones only. */
export async function readTrialMotionStoryboards(
    supabase: SupabaseClient,
    speciesProfileIds: string[]
): Promise<Map<string, TrialStoryboard>> {
    const ids = Array.from(new Set(speciesProfileIds.filter((id) => UUID_PATTERN.test(id)).map((id) => id.toLowerCase())));
    const found = new Map<string, TrialStoryboard>();
    for (let start = 0; start < ids.length; start += 60) {
        const {data, error} = await supabase
            .from("trial_motion_storyboards_v1")
            .select("species_profile_id,frequency,motion_storyboard")
            .in("species_profile_id", ids.slice(start, start + 60));
        if (error) break;
        for (const row of (Array.isArray(data) ? data : []) as Array<{species_profile_id: string; frequency: string; motion_storyboard: unknown}>) {
            const frequency = String(row.frequency ?? "").toUpperCase();
            const storyboard = FREQUENCIES.includes(frequency) ? parseTrialStoryboard(row.motion_storyboard) : null;
            if (storyboard) found.set(trialMotionKey(String(row.species_profile_id), frequency), storyboard);
        }
    }
    return found;
}

/** Fills `motionStoryboard` on rows that arrived without one. Never fails the caller. */
export async function attachTrialMotionStoryboards<T extends {speciesProfileId: string; frequency: string; motionStoryboard: TrialStoryboard | null}>(
    supabase: SupabaseClient,
    trials: T[]
): Promise<T[]> {
    const missing = trials.filter((trial) => !trial.motionStoryboard);
    if (!missing.length) return trials;
    try {
        const storyboards = await readTrialMotionStoryboards(supabase, missing.map((trial) => trial.speciesProfileId));
        if (!storyboards.size) return trials;
        return trials.map((trial) => {
            if (trial.motionStoryboard) return trial;
            const storyboard = storyboards.get(trialMotionKey(trial.speciesProfileId, trial.frequency));
            return storyboard ? {...trial, motionStoryboard: storyboard} : trial;
        });
    } catch {
        return trials;
    }
}
