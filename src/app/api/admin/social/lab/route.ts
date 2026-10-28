import {NextRequest, NextResponse} from "next/server";
import {isSupportAdminRequestAuthorized} from "@/lib/support-admin-auth";
import {listAutomationRuns} from "@/lib/automation-runs";
import {labReport} from "@/lib/social-lab/experiments";
import {lastMetricsSync, listPostMetrics, runMetricsSync} from "@/lib/social-lab/metrics";
import {listPosts} from "@/lib/social/store";

/** The hook lab: what each arm scores so far, the latest per-post numbers, and the metrics sync's last runs. */
export async function GET(request: NextRequest) {
    if (!(await isSupportAdminRequestAuthorized(request))) return NextResponse.json({error: "Unauthorized"}, {status: 401});
    try {
        const [report, metrics, posts, lastSync, runs] = await Promise.all([
            labReport(),
            listPostMetrics(),
            listPosts(600),
            lastMetricsSync(),
            listAutomationRuns("social-metrics-sync", 5).catch(() => [])
        ]);
        const byPost = new Map(metrics.map((row) => [row.post_id, row]));
        const recent = posts
            .filter((post) => post.status === "published" && post.mode === "post" && byPost.has(post.id))
            .slice(0, 80)
            .map((post) => {
                const row = byPost.get(post.id)!;
                return {
                    id: post.id,
                    platform: post.platform,
                    kind: post.media_kind,
                    title: post.title ?? post.species_name ?? post.media_path,
                    url: post.external_url,
                    createdAt: post.created_at,
                    views: row.views,
                    likes: row.likes,
                    shares: row.shares,
                    hold3s: row.hold_3s,
                    completion: row.completion,
                    avgViewPct: row.avg_view_pct
                };
            });
        return NextResponse.json({ok: true, report, recent, lastSync, runs});
    } catch (error) {
        return NextResponse.json({error: error instanceof Error ? error.message : "Unable to load the hook lab"}, {status: 500});
    }
}

/** `{action: "sync"}`: reads every platform's per-post numbers now. */
export async function POST(request: NextRequest) {
    if (!(await isSupportAdminRequestAuthorized(request))) return NextResponse.json({error: "Unauthorized"}, {status: 401});
    const body = await request.json().catch(() => ({})) as {action?: string};
    if (body.action !== "sync") return NextResponse.json({error: "Unknown action"}, {status: 400});
    try {
        return NextResponse.json({ok: true, ...(await runMetricsSync("admin"))});
    } catch (error) {
        return NextResponse.json({error: error instanceof Error ? error.message : "Sync failed"}, {status: 500});
    }
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
