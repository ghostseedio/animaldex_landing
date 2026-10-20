import {NextRequest, NextResponse} from "next/server";
import {isSupportAdminRequestAuthorized} from "@/lib/support-admin-auth";
import {listAutomationRuns} from "@/lib/automation-runs";
import {nextTimerRun} from "@/lib/automation-schedule";
import {runAutoGenerate} from "@/lib/content-video/auto-generate";
import {contentVideoBusy} from "@/lib/content-video/runner";
import {previewAutoShare, runAutoShare} from "@/lib/social/auto-share";

/** The two VM-timer automations: recent runs, next scheduled run, and what is next in line. */
export async function GET(request: NextRequest) {
    if (!(await isSupportAdminRequestAuthorized(request))) return NextResponse.json({error: "Unauthorized"}, {status: 401});
    try {
        const now = new Date();
        const [shareRuns, generateRuns, preview] = await Promise.all([
            listAutomationRuns("social-auto-share", 15),
            listAutomationRuns("video-auto-generate", 15),
            previewAutoShare().catch((error) => ({error: error instanceof Error ? error.message : String(error)}))
        ]);
        return NextResponse.json({
            ok: true,
            share: {
                runs: shareRuns,
                nextRunAt: nextTimerRun("social-auto-share", now).toISOString(),
                disabled: process.env.SOCIAL_AUTO_SHARE_DISABLED?.trim() === "1",
                preview
            },
            generate: {
                runs: generateRuns,
                nextRunAt: nextTimerRun("video-auto-generate", now).toISOString(),
                disabled: process.env.CONTENT_VIDEO_AUTO_DISABLED?.trim() === "1",
                busy: contentVideoBusy()
            }
        });
    } catch (error) {
        return NextResponse.json({error: error instanceof Error ? error.message : "Unable to load automation"}, {status: 500});
    }
}

/** Runs one automation now, as its timer would: `{job: "social-auto-share" | "video-auto-generate"}`. */
export async function POST(request: NextRequest) {
    if (!(await isSupportAdminRequestAuthorized(request))) return NextResponse.json({error: "Unauthorized"}, {status: 401});
    const body = await request.json().catch(() => ({})) as {job?: string};
    try {
        if (body.job === "social-auto-share") return NextResponse.json(await runAutoShare());
        if (body.job === "video-auto-generate") return NextResponse.json(await runAutoGenerate());
        return NextResponse.json({error: "Unknown job"}, {status: 400});
    } catch (error) {
        return NextResponse.json({error: error instanceof Error ? error.message : "Run failed"}, {status: 500});
    }
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
