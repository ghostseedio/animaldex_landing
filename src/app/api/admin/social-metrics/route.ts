import {NextRequest, NextResponse} from "next/server";
import {isSupportAdminRequestAuthorized} from "@/lib/support-admin-auth";
import {
    SOCIAL_METRIC_PROVIDERS,
    loadSnapshots,
    syncSocialAccounts,
    syncSocialAccountsIfStale,
    syncableProviders,
    type SnapshotRow,
    type SocialMetric
} from "@/lib/social/account-metrics";

/** Latest stored value per platform, with change against the previous distinct sync. */
function summarize(rows: SnapshotRow[], syncable: Set<string>) {
    const byPlatform = new Map<string, SnapshotRow[]>();
    for (const row of rows) byPlatform.set(row.platform, [...(byPlatform.get(row.platform) ?? []), row]);
    const metrics: SocialMetric[] = SOCIAL_METRIC_PROVIDERS.map((platform) => {
        const [latest, previous] = byPlatform.get(platform.toLowerCase()) ?? [];
        return {
            platform,
            configured: syncable.has(platform),
            followers: latest?.followers ?? null,
            views: latest?.views ?? null,
            posts: latest?.posts ?? null,
            followerChange: latest?.followers != null && previous?.followers != null ? latest.followers - previous.followers : null,
            viewChange: latest?.views != null && previous?.views != null ? latest.views - previous.views : null,
            recordedAt: latest?.recorded_at ?? null
        };
    });
    const lastSyncedAt = rows[0]?.recorded_at ?? null;
    return {metrics, lastSyncedAt};
}

/** Reads stored snapshots, and takes a new one in the background when the last is a few hours old. */
export async function GET(request: NextRequest) {
    if (!(await isSupportAdminRequestAuthorized(request))) return NextResponse.json({ok: false, error: "Unauthorized"}, {status: 401});
    const [rows, syncable] = await Promise.all([loadSnapshots(), syncableProviders()]);
    syncSocialAccountsIfStale(rows[0]?.recorded_at ?? null);
    return NextResponse.json({ok: true, ...summarize(rows, syncable)});
}

/** Calls each provider (API key or Story videos login) once and stores one snapshot row per platform. */
export async function POST(request: NextRequest) {
    if (!(await isSupportAdminRequestAuthorized(request))) return NextResponse.json({ok: false, error: "Unauthorized"}, {status: 401});
    const results = await syncSocialAccounts();
    const [rows, syncable] = await Promise.all([loadSnapshots(), syncableProviders()]);
    const errors = results.filter((item) => item.error).map((item) => `${item.platform}: ${item.error}`);
    const notes = results.filter((item) => item.note && !item.error).map((item) => `${item.platform}: ${item.note}`);
    return NextResponse.json({ok: true, ...summarize(rows, syncable), errors, notes});
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
