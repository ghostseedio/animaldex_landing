import "server-only";

import type {PowerSetAlbum, PowerSetTierName} from "@/data/power-sets";
import {powerSetTierRewardBreakdown} from "@/data/power-set-rewards";
import {createSupabaseServerClient} from "@/lib/supabase/server";

export type ProfilePowerSetCompletion = {
    powerKey: string;
    powerLabel: string;
    tier: PowerSetTierName;
    speciesCount: number;
    catalogLinkedCount: number | null;
    rewardPoints: number;
    completedAt: string;
};

type CompletionUpsertRow = {
    power_key: string;
    power_label: string;
    tier: PowerSetTierName;
    species_count: number;
    catalog_linked_count: number | null;
    reward_points: number;
    completed_at: string;
};

export function buildPowerSetCompletionRecords(albums: PowerSetAlbum[]): ProfilePowerSetCompletion[] {
    const completedAt = new Date().toISOString();

    return albums.flatMap((album) => album.tierStatuses
        .filter((status) => status.isCompleted)
        .map((status) => ({
            powerKey: album.key,
            powerLabel: album.title,
            tier: status.tier,
            speciesCount: status.progressCount,
            catalogLinkedCount: album.catalogLinkedCount > 0 ? album.catalogLinkedCount : null,
            rewardPoints: status.completionReward ?? powerSetTierRewardBreakdown(
                status.tier,
                [],
                status.targetCount,
                album.catalogLinkedCount
            ).totalPoints,
            completedAt
        })));
}

function toUpsertRow(record: ProfilePowerSetCompletion): CompletionUpsertRow {
    return {
        power_key: record.powerKey,
        power_label: record.powerLabel,
        tier: record.tier,
        species_count: record.speciesCount,
        catalog_linked_count: record.catalogLinkedCount,
        reward_points: record.rewardPoints,
        completed_at: record.completedAt
    };
}

export async function fetchPowerSetCompletions(): Promise<ProfilePowerSetCompletion[]> {
    const supabase = createSupabaseServerClient();

    if (!supabase) {
        return [];
    }

    const {data: {user}} = await supabase.auth.getUser();

    if (!user) {
        return [];
    }

    const {data, error} = await supabase
        .from("profile_power_set_completions")
        .select("power_key,power_label,tier,species_count,catalog_linked_count,reward_points,completed_at")
        .eq("user_id", user.id)
        .order("completed_at", {ascending: false});

    if (error || !data) {
        return [];
    }

    return data.map((row) => ({
        powerKey: String(row.power_key),
        powerLabel: String(row.power_label),
        tier: String(row.tier) as PowerSetTierName,
        speciesCount: Number(row.species_count ?? 0),
        catalogLinkedCount: row.catalog_linked_count == null ? null : Number(row.catalog_linked_count),
        rewardPoints: Number(row.reward_points ?? 0),
        completedAt: String(row.completed_at)
    }));
}

export async function upsertPowerSetCompletions(records: ProfilePowerSetCompletion[]) {
    if (records.length === 0) {
        return;
    }

    const supabase = createSupabaseServerClient();

    if (!supabase) {
        return;
    }

    const {data: {user}} = await supabase.auth.getUser();

    if (!user) {
        return;
    }

    await supabase.rpc("upsert_profile_power_set_completions", {
        p_completions: records.map(toUpsertRow)
    });
}

export async function syncPowerSetCompletions(albums: PowerSetAlbum[]) {
    const records = buildPowerSetCompletionRecords(albums);

    if (records.length === 0) {
        return;
    }

    try {
        await upsertPowerSetCompletions(records);
    } catch {
        // Match iOS best-effort sync behavior.
    }
}
