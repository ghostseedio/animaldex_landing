import {NextRequest, NextResponse} from "next/server";
import {isSupportAdminRequestAuthorized} from "@/lib/support-admin-auth";
import {listAutomationRuns} from "@/lib/automation-runs";
import {writeTrendTopicNow} from "@/lib/blog-generator/auto-generate";
import {runTrendRadar} from "@/lib/trend-radar/radar";
import {listTrendTopics, updateTrendTopic} from "@/lib/trend-radar/store";

// The trend radar for /admin/story-videos: its ideas and last runs, "Refresh"
// (a pass takes a minute or two, longer than the proxy waits, so it runs in the
// background and the panel polls), "Write now" and "Skip".

let refreshing = false;

export async function GET(request: NextRequest) {
    if (!(await isSupportAdminRequestAuthorized(request))) return NextResponse.json({error: "Unauthorized"}, {status: 401});
    try {
        const [topics, runs] = await Promise.all([listTrendTopics(80), listAutomationRuns("trend-radar", 6).catch(() => [])]);
        return NextResponse.json({ok: true, refreshing, topics, runs});
    } catch (error) {
        return NextResponse.json({error: error instanceof Error ? error.message : "Unable to load the trend radar"}, {status: 500});
    }
}

/** `{action: "refresh"}`, `{action: "write", id}` or `{action: "skip", id}`. */
export async function POST(request: NextRequest) {
    if (!(await isSupportAdminRequestAuthorized(request))) return NextResponse.json({error: "Unauthorized"}, {status: 401});
    const body = await request.json().catch(() => ({})) as {action?: string; id?: string};
    try {
        if (body.action === "refresh") {
            if (!refreshing) {
                refreshing = true;
                void runTrendRadar("admin").catch((error) => console.error("[trend-radar]", error)).finally(() => {
                    refreshing = false;
                });
            }
            return NextResponse.json({ok: true, refreshing: true});
        }
        if (body.action === "write" && body.id) return NextResponse.json(await writeTrendTopicNow(body.id));
        if (body.action === "skip" && body.id) {
            await updateTrendTopic(body.id, {status: "skipped", used_ref: "skipped by an admin"});
            return NextResponse.json({ok: true});
        }
        return NextResponse.json({error: "Unknown action"}, {status: 400});
    } catch (error) {
        return NextResponse.json({error: error instanceof Error ? error.message : "Request failed"}, {status: 500});
    }
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
