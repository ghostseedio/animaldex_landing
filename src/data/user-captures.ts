import type {SpeciesEntry} from "@/data/species";
import {createSupabaseServerClient} from "@/lib/supabase/server";

export type UserCaptureSummary = {
    captureId: string;
    animalName: string;
    speciesSlug: string | null;
    score: number;
    capturedAt: string | null;
    imageBucket: string | null;
    imagePath: string | null;
    contextLabel: string | null;
    locationDisplayLabel: string | null;
};

type DiscoverFeedUserRow = {
    capture_id?: string;
    animal_name?: string | null;
    normalized_identity_key?: string | null;
    score?: number | null;
    capture_created_at?: string | null;
    image_bucket?: string | null;
    image_path?: string | null;
    human_context?: string | null;
    zoo_or_wild?: string | null;
    location_display_label?: string | null;
};

function getContextLabel(row: Pick<DiscoverFeedUserRow, "zoo_or_wild" | "human_context">) {
    const zooOrWild = row.zoo_or_wild?.trim();

    if (zooOrWild && zooOrWild !== "Unknown") {
        return zooOrWild;
    }

    switch (row.human_context?.trim()) {
        case "Pet":
            return "Domestic";
        case "Livestock":
            return "Farm";
        case "Captive":
            return "Zoo";
        case "Free-ranging":
            return "Wild";
        default:
            return null;
    }
}

function toUserCaptureSummary(row: DiscoverFeedUserRow): UserCaptureSummary | null {
    const captureId = row.capture_id?.trim();

    if (!captureId) {
        return null;
    }

    return {
        captureId,
        animalName: row.animal_name?.trim() ?? "Animal",
        speciesSlug: row.normalized_identity_key?.trim() ?? null,
        score: row.score ?? 0,
        capturedAt: row.capture_created_at ?? null,
        imageBucket: row.image_bucket ?? null,
        imagePath: row.image_path ?? null,
        contextLabel: getContextLabel(row),
        locationDisplayLabel: row.location_display_label?.trim() ?? null
    };
}

export async function getAuthenticatedUserId() {
    const supabase = createSupabaseServerClient();

    if (!supabase) {
        return null;
    }

    const {data: {user}} = await supabase.auth.getUser();

    return user?.id ?? null;
}

export async function getUserCaptures(limit = 120): Promise<UserCaptureSummary[]> {
    const supabase = createSupabaseServerClient();

    if (!supabase) {
        return [];
    }

    const {data: {user}} = await supabase.auth.getUser();

    if (!user) {
        return [];
    }

    const {data, error} = await supabase
        .from("discover_feed_v1")
        .select("capture_id,animal_name,normalized_identity_key,score,capture_created_at,image_bucket,image_path,human_context,zoo_or_wild,location_display_label")
        .eq("user_id", user.id)
        .order("score", {ascending: false})
        .order("capture_created_at", {ascending: false})
        .limit(limit);

    if (error || !data) {
        return [];
    }

    return (data as DiscoverFeedUserRow[])
        .map(toUserCaptureSummary)
        .filter((item): item is UserCaptureSummary => Boolean(item));
}

export async function getUserCapturesForSpecies(entry: SpeciesEntry, limit = 24): Promise<UserCaptureSummary[]> {
    const captures = await getUserCaptures(Math.max(limit * 3, 48));
    const slug = entry.slug;
    const identityKey = (entry.normalizedIdentityKey ?? slug).toLowerCase();
    const profileId = entry.speciesProfileId;
    const animalName = entry.name.trim().toLowerCase();

    return captures.filter((capture) => {
        const captureKey = capture.speciesSlug?.toLowerCase() ?? null;

        if (captureKey === slug || captureKey === identityKey) {
            return true;
        }

        if (profileId && captureKey === profileId.toLowerCase()) {
            return true;
        }

        return capture.animalName.trim().toLowerCase() === animalName;
    }).slice(0, limit);
}

export async function getAuthenticatedUserProfile() {
    const supabase = createSupabaseServerClient();

    if (!supabase) {
        return null;
    }

    const {data: {user}} = await supabase.auth.getUser();

    if (!user) {
        return null;
    }

    const {data: profile} = await supabase
        .from("profiles")
        .select("display_name,username,avatar_url")
        .eq("id", user.id)
        .maybeSingle();

    return {
        id: user.id,
        email: user.email ?? null,
        displayName: profile?.display_name?.trim() ?? null,
        username: profile?.username?.trim() ?? null,
        avatarUrl: profile?.avatar_url?.trim() ?? null
    };
}
