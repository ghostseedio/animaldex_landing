import {createHash} from "node:crypto";

/**
 * The Discover post id of one person's Trial. Matches
 * `md5(user_id || ':' || species_profile_id || ':' || frequency)::uuid` on
 * `discover_animal_trial_timeline_v1`, so a history tap lands on the same card
 * the feed already has — and the same card the phone opens.
 */
export function animalTrialDiscoverPostId(userId: string, speciesProfileId: string, frequency: string) {
    const raw = `${userId.toLowerCase()}:${speciesProfileId.toLowerCase()}:${frequency}`;
    const hex = createHash("md5").update(raw, "utf8").digest("hex");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
