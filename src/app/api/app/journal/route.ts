import {NextResponse} from "next/server";
import {fetchDailyCompanionData, parseJournalLogFromApi} from "@/data/daily-companion";
import {invokeAuthenticatedSupabaseFunction} from "@/lib/supabase/app-functions";
import {localLogDate} from "@/lib/daily-companion-utils";

export async function GET() {
    const data = await fetchDailyCompanionData();
    if (!data) return NextResponse.json({error: "Authentication required."}, {status: 401});
    return NextResponse.json(data);
}

export async function POST(request: Request) {
    const body = await request.json().catch(() => ({})) as {userProblem?: string; slottedCaptureIds?: string[]; logDate?: string};
    const problem = body.userProblem?.trim();
    if (!problem || problem.length < 3 || problem.length > 1200) {
        return NextResponse.json({error: "Write between 3 and 1200 characters."}, {status: 400});
    }

    try {
        const result = await invokeAuthenticatedSupabaseFunction("nature-alignment-journal", {
            user_problem: problem,
            log_date: body.logDate?.trim() || localLogDate(),
            slotted_capture_ids: body.slottedCaptureIds ?? []
        });

        const refreshed = await fetchDailyCompanionData();
        const parsedLog = parseJournalLogFromApi((result as {log?: unknown})?.log);
        const today = parsedLog ?? refreshed?.today ?? null;

        return NextResponse.json({
            ...result,
            today,
            recentLogs: refreshed?.recentLogs ?? [],
            proofsByLogId: refreshed?.proofsByLogId ?? {},
            progress: refreshed?.progress ?? []
        });
    } catch (error) {
        return NextResponse.json({error: error instanceof Error ? error.message : "Journal generation failed"}, {status: 400});
    }
}
