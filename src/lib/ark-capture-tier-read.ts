import "server-only";

import {decodeArkCaptureTier, type ArkCaptureTier} from "@/lib/ark-life";
import {clampArkHearts} from "@/lib/ark-hearts";
import {createSupabaseServiceClient} from "@/lib/supabase/server";

export type ArkCaptureFacts = {tier: ArkCaptureTier | null; hearts: number | null};

const NONE: ArkCaptureFacts = {tier: null, hearts: null};

/**
 * What the tap card shows of the capture that brought an Ark animal aboard (owner 2026-11-21): its battle tier
 * ("the tiers can we show that chip also on the animal ark card") and its hearts, the animal's lives in the Ark, on
 * every card, read-only (the restore stays the owner's, /api/ark/hearts).
 *
 * THE RULES:
 * - The tier is the server's `capture_tier_for_capture` (GRADING-2, the one tier function every other surface uses),
 *   never one worked out on the page, so a change of the bands on the server (Grading 3) shows here by itself.
 * - Hearts are `captures.challenge_health` (0..3, null = 3) exactly as /api/ark/hearts reads them: only while the
 *   server's `ark_hearts` switch is on, and only while the animal's bringer still holds that card (a card traded or
 *   deleted is no one's lives).
 * - Only an animal that arrived with a capture of its own has either (`voyage_arrival_sources`, source `capture`): one
 *   born on the Ark has no row there and answers neither (never its parent's).
 * - The capture id and owner stay on the server: the page gets a letter and a number. Null on any failure.
 */
export async function readArkCaptureFacts(animalId: string): Promise<ArkCaptureFacts> {
    const supabase = createSupabaseServiceClient();
    if (!supabase) return NONE;
    try {
        const [source, animal, enabled] = await Promise.all([
            supabase.from("voyage_arrival_sources").select("capture_id").eq("animal_id", animalId).eq("source", "capture").maybeSingle(),
            supabase.from("voyage_animals").select("owner_user_id, origin").eq("id", animalId).maybeSingle(),
            supabase.rpc("ark_hearts_enabled")
        ]);
        const captureId = typeof source.data?.capture_id === "string" ? source.data.capture_id : null;
        if (source.error || !captureId || animal.data?.origin === "born") return NONE;
        const [capture, tier] = await Promise.all([
            supabase.from("captures").select("id, user_id, challenge_health").eq("id", captureId).maybeSingle(),
            supabase.rpc("capture_tier_for_capture", {p_capture_id: captureId})
        ]);
        // A capture since deleted would read as power 0 ("E"): nothing for it instead.
        const card = capture.data as {id: string; user_id: string | null; challenge_health: number | null} | null;
        if (capture.error || !card) return NONE;
        const held = Boolean(card.user_id) && card.user_id === animal.data?.owner_user_id;
        return {
            tier: tier.error ? null : decodeArkCaptureTier(tier.data),
            hearts: enabled.error || enabled.data !== true || !held ? null : clampArkHearts(card.challenge_health ?? 3)
        };
    } catch {
        return NONE;
    }
}
