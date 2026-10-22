import "server-only";

/**
 * How the animal on this page talks: its authored voice card from
 * `species_companion_voice` (service role only), or the record-derived
 * fallback the apps use for species that have no card yet.
 *
 * Keyed by the canonical species, as the apps' edge function does, and the
 * card is honoured only while its `power_name` still matches the Power the
 * species has now.
 */

import {createSupabaseServiceClient} from "@/lib/supabase/server";
import {
    fallbackAskCompanionVoice,
    usableAskCompanionVoice,
    type AskCompanionVoice
} from "@/lib/ask-animaldex/companion";
import type {AskSpeciesGrounding} from "@/lib/ask-animaldex/grounding";

export type AskCompanion = {
    voice: AskCompanionVoice;
    /** The canonical species id, for memory ordering and new facts. Null when unknown. */
    speciesProfileId: string | null;
};

function statSpeed(raw: unknown): number | null {
    if (!raw || typeof raw !== "object") return null;
    const value = Number((raw as Record<string, unknown>).speed);
    return Number.isFinite(value) ? Math.max(0, Math.min(100, Math.round(value))) : null;
}

export async function loadAskCompanion(species: AskSpeciesGrounding): Promise<AskCompanion> {
    const service = createSupabaseServiceClient();
    const id = species.speciesProfileId ?? null;
    if (!service || !id) {
        return {voice: fallbackAskCompanionVoice({species}), speciesProfileId: id};
    }

    try {
        const {data: profile} = await service
            .from("species_profiles")
            .select("id, canonical_species_profile_id")
            .eq("id", id)
            .limit(1)
            .maybeSingle();
        const canonicalRaw = profile?.canonical_species_profile_id;
        const canonicalId = typeof canonicalRaw === "string" && canonicalRaw ? canonicalRaw : (profile?.id as string | undefined) ?? id;

        const [voiceRes, statsRes, qualitiesRes] = await Promise.all([
            service
                .from("species_companion_voice")
                .select("voice, power_name, review_status")
                .eq("species_profile_id", canonicalId)
                .maybeSingle(),
            service
                .from("species_profiles")
                .select("canonical_game_stats")
                .eq("id", canonicalId)
                .limit(1)
                .maybeSingle(),
            service
                .from("species_best_for_power_assignments")
                .select("assignment_rank, canonical_best_for_tags(tag_label)")
                .eq("species_profile_id", canonicalId)
                .order("assignment_rank", {ascending: true})
        ]);

        const card = voiceRes.error
            ? null
            : usableAskCompanionVoice(voiceRes.data, species.power?.principleName ?? null);
        if (card) return {voice: card, speciesProfileId: canonicalId};

        const qualities = ((qualitiesRes.data ?? []) as Array<Record<string, unknown>>)
            .map((row) => {
                const joined = row.canonical_best_for_tags;
                const tag = (Array.isArray(joined) ? joined[0] : joined) as Record<string, unknown> | null | undefined;
                const label = typeof tag?.tag_label === "string" ? tag.tag_label.replace(/\s+/g, " ").trim().slice(0, 80) : "";
                return label || null;
            })
            .filter((label): label is string => label !== null)
            .slice(0, 8);

        return {
            voice: fallbackAskCompanionVoice({
                species,
                qualities,
                speed: statSpeed(statsRes.data?.canonical_game_stats)
            }),
            speciesProfileId: canonicalId
        };
    } catch (error) {
        console.warn("[ask-animaldex] companion voice unavailable", error instanceof Error ? error.message.slice(0, 200) : "unknown");
        return {voice: fallbackAskCompanionVoice({species}), speciesProfileId: id};
    }
}
