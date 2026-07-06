import {NextResponse} from "next/server";
import {invokeAuthenticatedSupabaseFunction} from "@/lib/supabase/app-functions";

export async function POST(request: Request) {
    const body = await request.json().catch(() => ({})) as {userProblem?: string; slottedCaptureIds?: string[]};
    const problem = body.userProblem?.trim();
    if (!problem || problem.length < 3 || problem.length > 1200) return NextResponse.json({error: "Write between 3 and 1200 characters."}, {status: 400});
    try {
        const result = await invokeAuthenticatedSupabaseFunction("nature-alignment-journal", {user_problem: problem, log_date: new Date().toISOString().slice(0, 10), slotted_capture_ids: body.slottedCaptureIds ?? []});
        return NextResponse.json(result);
    } catch (error) {
        return NextResponse.json({error: error instanceof Error ? error.message : "Journal generation failed"}, {status: 400});
    }
}
