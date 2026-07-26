import type {SpeciesEntry} from "@/data/species";
import {catalogLookupToken} from "@/lib/collection-discovery";
import {collectionIdentityMatchKeys} from "@/lib/collection-identity-aliases";
import {resolveCanonicalIdentityKey} from "@/lib/species-life-stage-policy";
import {countCaptureSettingLabels, getCaptureContextLabel, type CaptureSettingRow} from "@/lib/capture-setting-label";
import {createSupabaseServerClient} from "@/lib/supabase/server";

export type UserCaptureSummary = {
    captureId: string;
    animalName: string;
    scientificName: string | null;
    speciesSlug: string | null;
    speciesProfileId: string | null;
    lifeStage: string | null;
    confidence: number | null;
    score: number;
    captureValidity: string | null;
    learnedScenarioTags: string[];
    capturedAt: string | null;
    imageBucket: string | null;
    imagePath: string | null;
    contextLabel: string | null;
    locationDisplayLabel: string | null;
};

export type UserCaptureStats = {
    captureCount: number;
    uniqueSpecies: number;
    collectorScore: number;
    wild: number;
    zoo: number;
    domestic: number;
    farm: number;
    sampledCount: number;
    sampleLimitReached: boolean;
};

type OwnedCaptureManifestRow = {
    capture_id?: string;
    animal_name?: string | null;
    scientific_name?: string | null;
    species_profile_id?: string | null;
    normalized_identity_key?: string | null;
    life_stage?: string | null;
    confidence?: number | null;
    error_message?: string | null;
    completed_at?: string | null;
    total_progression_xp?: number | null;
    capture_created_at?: string | null;
    image_bucket?: string | null;
    image_path?: string | null;
    human_context?: string | null;
    zoo_or_wild?: string | null;
    location_display_label?: string | null;
    learned_sub_principles?: unknown;
    raw_json?: unknown;
};

type DiscoverFeedStatsRow = Pick<OwnedCaptureManifestRow, "capture_id" | "animal_name" | "normalized_identity_key" | "total_progression_xp" | "human_context" | "zoo_or_wild">;

function getContextLabel(row: Pick<OwnedCaptureManifestRow, "zoo_or_wild" | "human_context">) {
    return getCaptureContextLabel(row);
}

function isEligibleManifestRow(row: OwnedCaptureManifestRow) {
    if (!row.capture_id?.trim() || !row.completed_at) return false;
    return !row.error_message?.trim();
}

function parseCaptureValidity(raw: unknown) {
    if (!raw || typeof raw !== "object") {
        return null;
    }

    const model = (raw as {model?: unknown}).model;

    if (!model || typeof model !== "object") {
        return null;
    }

    const validity = (model as {capture_validity?: unknown}).capture_validity;

    return typeof validity === "string" ? validity.trim() : null;
}

function parseLearnedScenarioTags(value: unknown) {
    if (!Array.isArray(value)) {
        return [] as string[];
    }

    const tags: string[] = [];

    for (const item of value) {
        if (!item || typeof item !== "object") {
            continue;
        }

        const scenarioTags = (item as {scenario_tags?: unknown; scenarioTags?: unknown}).scenario_tags
            ?? (item as {scenarioTags?: unknown}).scenarioTags;

        if (!Array.isArray(scenarioTags)) {
            continue;
        }

        for (const tag of scenarioTags) {
            if (typeof tag === "string" && tag.trim()) {
                tags.push(tag.trim());
            }
        }
    }

    return tags;
}

function toUserCaptureSummary(row: OwnedCaptureManifestRow): UserCaptureSummary | null {
    const captureId = row.capture_id?.trim();

    if (!captureId || !isEligibleManifestRow(row)) {
        return null;
    }

    return {
        captureId,
        animalName: row.animal_name?.trim() ?? "Animal",
        scientificName: row.scientific_name?.trim() ?? null,
        speciesSlug: row.normalized_identity_key?.trim() ?? null,
        speciesProfileId: row.species_profile_id?.trim() ?? null,
        lifeStage: row.life_stage?.trim() ?? null,
        confidence: row.confidence ?? null,
        score: Number(row.total_progression_xp ?? 0),
        captureValidity: parseCaptureValidity(row.raw_json),
        learnedScenarioTags: parseLearnedScenarioTags(row.learned_sub_principles),
        capturedAt: row.capture_created_at ?? null,
        imageBucket: row.image_bucket ?? null,
        imagePath: row.image_path ?? null,
        contextLabel: getContextLabel(row),
        locationDisplayLabel: row.location_display_label?.trim() ?? null
    };
}

const USER_CAPTURE_MANIFEST_SELECT = [
    "capture_id",
    "animal_name",
    "scientific_name",
    "species_profile_id",
    "normalized_identity_key",
    "life_stage",
    "confidence",
    "total_progression_xp",
    "error_message",
    "completed_at",
    "capture_created_at",
    "image_bucket",
    "image_path",
    "human_context",
    "zoo_or_wild",
    "location_display_label",
    "learned_sub_principles",
    "raw_json"
].join(",");

export async function getAuthenticatedUserId() {
    const supabase = createSupabaseServerClient();

    if (!supabase) {
        return null;
    }

    const {data: {user}} = await supabase.auth.getUser();

    return user?.id ?? null;
}

export async function getUserCaptures(limit = 2000): Promise<UserCaptureSummary[]> {
    const supabase = createSupabaseServerClient();

    if (!supabase) {
        return [];
    }

    const {data: {user}} = await supabase.auth.getUser();

    if (!user) {
        return [];
    }

    const pageSize = 240;
    const rows: OwnedCaptureManifestRow[] = [];

    for (let offset = 0; offset < limit; offset += pageSize) {
        const {data, error} = await supabase
            .from("owned_capture_manifest_v1")
            .select(USER_CAPTURE_MANIFEST_SELECT)
            .eq("user_id", user.id)
            .not("completed_at", "is", null)
            .order("capture_created_at", {ascending: false})
            .range(offset, offset + pageSize - 1);

        if (error || !data?.length) {
            break;
        }

        rows.push(...(data as OwnedCaptureManifestRow[]));
        if (data.length < pageSize) {
            break;
        }
    }

    return rows
        .map(toUserCaptureSummary)
        .filter((item): item is UserCaptureSummary => Boolean(item));
}

export async function getUserCaptureStats(sampleLimit = 5000): Promise<UserCaptureStats> {
    const emptyStats: UserCaptureStats = {
        captureCount: 0,
        uniqueSpecies: 0,
        collectorScore: 0,
        wild: 0,
        zoo: 0,
        domestic: 0,
        farm: 0,
        sampledCount: 0,
        sampleLimitReached: false
    };
    const supabase = createSupabaseServerClient();

    if (!supabase) {
        return emptyStats;
    }

    const {data: {user}} = await supabase.auth.getUser();

    if (!user) {
        return emptyStats;
    }

    const {data, error, count} = await supabase
        .from("owned_capture_manifest_v1")
        .select("capture_id,animal_name,normalized_identity_key,human_context,zoo_or_wild,total_progression_xp,completed_at,error_message", {count: "exact"})
        .eq("user_id", user.id)
        .not("completed_at", "is", null)
        .order("capture_created_at", {ascending: false})
        .limit(sampleLimit);

    if (error || !data) {
        return emptyStats;
    }

    const rows = (data as OwnedCaptureManifestRow[]).filter(isEligibleManifestRow);
    const uniqueSpecies = new Set(
        rows.map((row) => row.normalized_identity_key?.trim() || row.animal_name?.trim().toLowerCase() || row.capture_id?.trim())
            .filter(Boolean)
    );
    const {wild, zoo, domestic, farm} = countCaptureSettingLabels(rows);
    const captureCount = count ?? rows.length;

    return {
        captureCount,
        uniqueSpecies: uniqueSpecies.size,
        collectorScore: rows.reduce((sum, row) => sum + Number(row.total_progression_xp ?? 0), 0),
        wild,
        zoo,
        domestic,
        farm,
        sampledCount: rows.length,
        sampleLimitReached: rows.length < captureCount
    };
}

export async function getUserCaptureSettingCounts() {
    const empty = {wild: 0, zoo: 0, domestic: 0, farm: 0};
    const supabase = createSupabaseServerClient();
    if (!supabase) return empty;

    const {data: {user}} = await supabase.auth.getUser();
    if (!user) return empty;

    const rows: CaptureSettingRow[] = [];
    const pageSize = 500;

    for (let offset = 0; offset < 10000; offset += pageSize) {
        const {data, error} = await supabase
            .from("owned_capture_manifest_v1")
            .select("zoo_or_wild,human_context,completed_at,error_message,capture_id")
            .eq("user_id", user.id)
            .not("completed_at", "is", null)
            .order("capture_created_at", {ascending: false})
            .range(offset, offset + pageSize - 1);

        if (error || !data?.length) {
            break;
        }

        for (const row of data as OwnedCaptureManifestRow[]) {
            if (isEligibleManifestRow(row)) {
                rows.push(row);
            }
        }

        if (data.length < pageSize) {
            break;
        }
    }

    if (rows.length > 0) {
        return countCaptureSettingLabels(rows);
    }

    for (let offset = 0; offset < 5000; offset += pageSize) {
        const {data, error} = await supabase
            .from("discover_feed_v1")
            .select("zoo_or_wild,human_context")
            .eq("user_id", user.id)
            .order("capture_created_at", {ascending: false})
            .range(offset, offset + pageSize - 1);

        if (error || !data?.length) {
            break;
        }

        rows.push(...(data as CaptureSettingRow[]));
        if (data.length < pageSize) {
            break;
        }
    }

    return countCaptureSettingLabels(rows);
}

export async function getUserCapturesForSpecies(entry: SpeciesEntry, limit = 24): Promise<UserCaptureSummary[]> {
    const captures = await getUserCaptures(Math.max(limit * 3, 48));
    const slug = entry.slug;
    const identityKey = (entry.normalizedIdentityKey ?? slug).toLowerCase();
    const canonicalIdentityKey = resolveCanonicalIdentityKey(identityKey) ?? identityKey;
    const identityMatchKeys = new Set(collectionIdentityMatchKeys(canonicalIdentityKey));
    const profileId = entry.speciesProfileId?.toLowerCase() ?? null;
    const animalName = entry.name.trim().toLowerCase();

    return captures.filter((capture) => {
        const captureKey = capture.speciesSlug?.toLowerCase() ?? null;
        const animalToken = catalogLookupToken(capture.animalName);
        const scientificToken = catalogLookupToken(capture.scientificName);

        if (captureKey && identityMatchKeys.has(captureKey)) {
            return true;
        }

        if (captureKey === slug || captureKey === identityKey || captureKey === canonicalIdentityKey) {
            return true;
        }

        if (animalToken && identityMatchKeys.has(animalToken)) {
            return true;
        }

        if (scientificToken && identityMatchKeys.has(scientificToken)) {
            return true;
        }

        if (profileId && capture.speciesProfileId?.toLowerCase() === profileId) {
            return true;
        }

        if (profileId && captureKey === profileId) {
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
