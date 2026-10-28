import "server-only";

/**
 * The parts of an animal's record the website's species grounding does not
 * carry, read the way the apps' `loadAnimalVoiceGrounding` reads them: its
 * ready Trials, the curated qualities its Power is best for, the field guide's
 * best time of day, and its taxonomy (for its nature: senses, sociality and
 * its archetype). Keyed by the canonical species; service role; anything that
 * fails is simply absent.
 */

import {createSupabaseServiceClient} from "@/lib/supabase/server";
import type {AskAnimalTrial} from "@/lib/ask-animaldex/grounding";
import type {AskSpeciesTaxonomy} from "@/lib/ask-animaldex/persona";

export type AskRecordExtras = {
    trials: AskAnimalTrial[];
    qualities: string[];
    bestTimeOfDay: string | null;
    taxonomy: AskSpeciesTaxonomy | null;
};

function text(value: unknown, max: number): string | null {
    if (typeof value !== "string") return null;
    const trimmed = value.replace(/\s+/g, " ").trim();
    if (!trimmed) return null;
    return trimmed.length > max ? trimmed.slice(0, max).trimEnd() : trimmed;
}

export async function loadAskRecordExtras(speciesProfileId: string | null): Promise<AskRecordExtras | null> {
    if (!speciesProfileId) return null;
    const service = createSupabaseServiceClient();
    if (!service) return null;
    try {
        const [trialsRes, qualitiesRes, guideRes, taxonomyRes] = await Promise.all([
            service.from("species_trials")
                .select("frequency,title,objective,instructions,animal_rule,mechanism_connection")
                .eq("species_profile_id", speciesProfileId)
                .eq("generation_status", "ready")
                .order("frequency", {ascending: true}),
            service.from("species_best_for_power_assignments")
                .select("assignment_rank, canonical_best_for_tags(tag_label)")
                .eq("species_profile_id", speciesProfileId)
                .order("assignment_rank", {ascending: true}),
            service.from("species_field_guide").select("best_time_of_day").eq("species_profile_id", speciesProfileId).maybeSingle(),
            service.from("species_taxonomy").select("class_name, order_name, family_name").eq("species_profile_id", speciesProfileId).maybeSingle()
        ]);
        const trials = ((trialsRes.data ?? []) as Array<Record<string, unknown>>).flatMap((row): AskAnimalTrial[] => {
            const title = text(row.title, 160);
            if (!title) return [];
            return [{
                frequency: text(row.frequency, 8) ?? "",
                title,
                objective: text(row.objective, 300) ?? "",
                instructions: text(row.instructions, 500) ?? "",
                animal_rule: text(row.animal_rule, 300) ?? "",
                mechanism_connection: text(row.mechanism_connection, 300) ?? ""
            }];
        });
        const qualities = ((qualitiesRes.data ?? []) as Array<Record<string, unknown>>)
            .map((row) => {
                const joined = row.canonical_best_for_tags;
                const tag = (Array.isArray(joined) ? joined[0] : joined) as Record<string, unknown> | null | undefined;
                return text(tag?.tag_label, 80);
            })
            .filter((label): label is string => label !== null)
            .slice(0, 8);
        const taxonomy = taxonomyRes.data && typeof taxonomyRes.data === "object"
            ? taxonomyRes.data as AskSpeciesTaxonomy
            : null;
        return {
            trials,
            qualities,
            bestTimeOfDay: text((guideRes.data as Record<string, unknown> | null)?.best_time_of_day, 200),
            taxonomy
        };
    } catch (error) {
        console.warn("[ask-animaldex] record extras unavailable", error instanceof Error ? error.message.slice(0, 200) : "unknown");
        return null;
    }
}
