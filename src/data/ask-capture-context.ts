import "server-only";

/**
 * The card the conversation is about, as the apps' `generate-applied-insight`
 * reads it (`loadCaptureRow`): whose it is, the name its owner gave it, and
 * the moment they met (for how_you_met). Plus the two small reads the drawer
 * shows: the species' canonical id and how many people have talked to it.
 *
 * Service role, server only. Every read fails quietly: an animal without its
 * card's context still talks.
 */

import {createSupabaseServiceClient} from "@/lib/supabase/server";
import {sanitizeAskNickname} from "@/lib/ask-animaldex/companion";

/** The moment the reader met the animal on this card, as how_you_met reads it. */
export type AskCardMoment = {
    captured_at: string | null;
    timezone: string | null;
    place: string | null;
    country_code: string | null;
    habitat: string | null;
    wild: string | null;
    weather: string | null;
    temp_c: number | null;
    note: string | null;
};

export type AskCaptureContext = {
    ownerId: string;
    /** `captures.title`, sanitised to a name. */
    nickname: string | null;
    latitude: number | null;
    moment: AskCardMoment;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function str(value: unknown): string | null {
    return typeof value === "string" && value.trim() ? value : null;
}

export async function loadAskCaptureContext(captureId: string | null): Promise<AskCaptureContext | null> {
    if (!captureId || !UUID_PATTERN.test(captureId)) return null;
    const service = createSupabaseServiceClient();
    if (!service) return null;
    try {
        const [captureRes, analysisRes] = await Promise.all([
            service.from("captures")
                .select("user_id, title, notes, captured_at, location_display_label, location_country_code, location_lat, weather_condition_label, weather_temp_c, weather_timezone_identifier")
                .eq("id", captureId).limit(1).maybeSingle(),
            service.from("analysis_results").select("place_or_habitat_label, zoo_or_wild").eq("capture_id", captureId).limit(1).maybeSingle()
        ]);
        const row = captureRes.data as Record<string, unknown> | null;
        if (!row || typeof row.user_id !== "string") return null;
        const analysis = analysisRes.data as Record<string, unknown> | null;
        return {
            ownerId: row.user_id,
            nickname: sanitizeAskNickname(row.title),
            latitude: typeof row.location_lat === "number" ? row.location_lat : null,
            moment: {
                captured_at: str(row.captured_at),
                timezone: str(row.weather_timezone_identifier),
                place: str(row.location_display_label),
                country_code: str(row.location_country_code),
                habitat: str(analysis?.place_or_habitat_label),
                wild: str(analysis?.zoo_or_wild),
                weather: str(row.weather_condition_label),
                temp_c: typeof row.weather_temp_c === "number" ? row.weather_temp_c : null,
                note: str(row.notes)
            }
        };
    } catch (error) {
        console.warn("[ask-animaldex] capture context unavailable", error instanceof Error ? error.message.slice(0, 200) : "unknown");
        return null;
    }
}

/** The owner's name as visitors see it: their display name, else their username. */
export async function loadAskOwnerName(ownerId: string): Promise<string | null> {
    const service = createSupabaseServiceClient();
    if (!service) return null;
    try {
        const {data} = await service.from("profiles").select("display_name, username").eq("id", ownerId).maybeSingle();
        const clean = (value: unknown) => typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, 60) || null : null;
        return clean(data?.display_name) ?? clean(data?.username);
    } catch {
        return null;
    }
}

/** The species a profile folds into, one canonical hop, as the apps resolve it. */
export async function resolveAskCanonicalSpeciesId(speciesProfileId: string | null | undefined): Promise<string | null> {
    if (!speciesProfileId || !UUID_PATTERN.test(speciesProfileId)) return null;
    const service = createSupabaseServiceClient();
    if (!service) return speciesProfileId;
    try {
        const {data} = await service
            .from("species_profiles")
            .select("id, canonical_species_profile_id")
            .eq("id", speciesProfileId)
            .limit(1)
            .maybeSingle();
        if (!data) return speciesProfileId;
        const canonical = typeof data.canonical_species_profile_id === "string" ? data.canonical_species_profile_id : null;
        return canonical && canonical !== data.id ? canonical : String(data.id);
    } catch {
        return speciesProfileId;
    }
}

/**
 * How many different people have talked to this animal (`species_chat_people_v1`,
 * AnimalDex 47548e8f): null until enough have that no one person's chats can
 * be picked out, and before the migration.
 */
export async function loadAskTalkCount(speciesProfileId: string | null): Promise<{people: number; peopleThisWeek: number} | null> {
    if (!speciesProfileId) return null;
    const service = createSupabaseServiceClient();
    if (!service) return null;
    try {
        const {data, error} = await service.rpc("species_chat_people_v1", {p_species_profile_id: speciesProfileId});
        if (error) return null;
        const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | null | undefined;
        const people = Number(row?.people);
        if (!row || !Number.isFinite(people) || people <= 0) return null;
        const week = Number(row.people_7d);
        return {people, peopleThisWeek: Number.isFinite(week) ? week : 0};
    } catch {
        return null;
    }
}
