import "server-only";

import {getSpeciesBySlug} from "@/data/species";
import {getSpeciesImageRoute} from "@/data/species-images";
import {getCaptureImageRoute} from "@/lib/capture-storage-image";
import {createSupabaseServerClient} from "@/lib/supabase/server";

type QueryRow = Record<string, unknown>;

export type DiscoverCollectorItem = {
    userId: string;
    displayName: string;
    username: string | null;
    avatarUrl: string | null;
    bio: string | null;
    overallScore: number;
    captureCount: number;
    uniqueSpecies: number;
    indexedSpeciesCount: number;
    rareFinds: number;
    wildCaptures: number;
    bestFindAnimalName: string | null;
    bestFindImageSrc: string | null;
    href: string | null;
};

function readString(row: QueryRow, key: string) {
    const value = row[key];
    return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readNumber(row: QueryRow, key: string) {
    const value = Number(row[key] ?? 0);
    return Number.isFinite(value) ? value : 0;
}

function resolveBestFindImage(captureId: string | null, slug: string | null) {
    if (!captureId) return null;
    if (slug) {
        const species = getSpeciesBySlug(slug);
        if (species) return getSpeciesImageRoute(species.slug, captureId);
    }

    return getCaptureImageRoute(captureId);
}

export async function getDiscoverCollectors(limit = 24, offset = 0): Promise<DiscoverCollectorItem[]> {
    const supabase = createSupabaseServerClient();
    if (!supabase) return [];

    const summarySelect = "user_id,overall_score,capture_count,unique_species,indexed_species_count,rare_finds,wild_captures,best_find_id";
    const {data: summaries} = await supabase
        .from("member_profile_summaries_v1")
        .select(summarySelect)
        .order("overall_score", {ascending: false})
        .order("user_id", {ascending: true})
        .range(offset, offset + limit - 1);

    const summaryRows = (summaries ?? []) as unknown as QueryRow[];
    if (!summaryRows.length) return [];

    const userIds = summaryRows.map((row) => readString(row, "user_id")).filter(Boolean) as string[];
    const bestFindIds = summaryRows.map((row) => readString(row, "best_find_id")).filter(Boolean) as string[];

    const [{data: profiles}, {data: bestFinds}] = await Promise.all([
        supabase.from("profiles").select("id,display_name,username,avatar_url,bio").in("id", userIds),
        bestFindIds.length
            ? supabase.from("discover_feed_v1").select("capture_id,animal_name,normalized_identity_key").in("capture_id", bestFindIds)
            : Promise.resolve({data: [] as unknown as QueryRow[]})
    ]);

    const profilesById = new Map(((profiles ?? []) as unknown as QueryRow[]).map((row) => [readString(row, "id") ?? "", row]));
    const bestFindsById = new Map(((bestFinds ?? []) as unknown as QueryRow[]).map((row) => [readString(row, "capture_id") ?? "", row]));

    return summaryRows.map((summary) => {
        const userId = readString(summary, "user_id") ?? "";
        const profile = profilesById.get(userId);
        const username = readString(profile ?? {}, "username");
        const bestFindId = readString(summary, "best_find_id");
        const bestFind = bestFindId ? bestFindsById.get(bestFindId) : null;
        const bestFindSlug = toSpeciesSlug(readString(bestFind ?? {}, "normalized_identity_key"));

        return {
            userId,
            displayName: readString(profile ?? {}, "display_name") ?? (username ? `@${username}` : "Collector"),
            username,
            avatarUrl: readString(profile ?? {}, "avatar_url"),
            bio: readString(profile ?? {}, "bio"),
            overallScore: readNumber(summary, "overall_score"),
            captureCount: readNumber(summary, "capture_count"),
            uniqueSpecies: readNumber(summary, "unique_species"),
            indexedSpeciesCount: readNumber(summary, "indexed_species_count"),
            rareFinds: readNumber(summary, "rare_finds"),
            wildCaptures: readNumber(summary, "wild_captures"),
            bestFindAnimalName: readString(bestFind ?? {}, "animal_name"),
            bestFindImageSrc: resolveBestFindImage(bestFindId, bestFindSlug),
            href: username ? `/u/${encodeURIComponent(username)}` : null
        };
    });
}

function toSpeciesSlug(identityKey: string | null | undefined) {
    if (!identityKey) return null;
    const slug = identityKey.trim().toLowerCase().replace(/_/g, "-");
    return slug || null;
}
