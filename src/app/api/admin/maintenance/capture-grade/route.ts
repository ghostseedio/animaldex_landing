import {NextRequest, NextResponse} from "next/server";
import {getSupabaseHeaders, getSupabaseServiceKey, getSupabaseUrl} from "@/lib/supabase-http";
import {isSupportAdminRequestAuthorized} from "@/lib/support-admin-auth";
import {
    buildCaptureGradeSource,
    readCaptureGradeInputs,
    type CaptureGradeRow
} from "@/lib/capture-grade-inputs";
import {storedGradeFields} from "@/lib/stored-capture-grade";

/**
 * Inspect the inputs behind one capture's grade (read-only).
 *
 * The grade is the server's: `analysis_results.capture_grade` is written once,
 * by the server, from the first delivered result, and is the one value every
 * surface shows. This route used to recompute a grade with the website's own
 * arithmetic and PATCH it over the stored one, which would put a second grade
 * authority back into the table (old scale, endorsement lift, no caps). It now
 * only reads: the POST is refused, and the breakdown it returns explains the
 * stored grade rather than replacing it.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const GRADE_COLUMNS = [
    "capture_id",
    "animal_name",
    "scientific_name",
    "breed_guess",
    "human_context",
    "zoo_or_wild",
    "confidence",
    "breed_confidence",
    "signals",
    "premium_details",
    "observed_market_modifiers",
    "raw_json",
    "capture_grade"
].join(",");

function config() {
    const url = getSupabaseUrl();
    const key = getSupabaseServiceKey();
    if (!url || !key) throw new Error("Supabase maintenance access is not configured");
    return {url, key};
}

async function loadAnalysis(captureId: string) {
    const {url, key} = config();
    const params = new URLSearchParams({select: GRADE_COLUMNS, capture_id: `eq.${captureId}`, limit: "1"});
    const response = await fetch(`${url}/rest/v1/analysis_results?${params}`, {
        headers: getSupabaseHeaders(key, {Accept: "application/json"}),
        cache: "no-store"
    });

    if (!response.ok) throw new Error(`analysis_results query failed (${response.status})`);

    const [row] = await response.json() as CaptureGradeRow[];
    return row ?? null;
}

export async function GET(request: NextRequest) {
    if (!(await isSupportAdminRequestAuthorized(request))) {
        return NextResponse.json({ok: false, error: "Unauthorized"}, {status: 401});
    }

    const captureId = request.nextUrl.searchParams.get("captureId")?.trim() ?? "";
    if (!UUID.test(captureId)) {
        return NextResponse.json({ok: false, error: "A capture id is required"}, {status: 400});
    }

    try {
        const row = await loadAnalysis(captureId);

        if (!row) {
            return NextResponse.json({ok: false, error: "This capture has no analysis to grade"}, {status: 404});
        }

        return NextResponse.json({
            ok: true,
            captureId,
            animalName: row.animal_name ?? null,
            storedGrade: row.capture_grade ?? null,
            // Only `model` is graded from raw_json, and the rest of that blob is
            // the full provider response. The panel previews against this copy.
            row: {...row, raw_json: {model: (row.raw_json ?? {}).model ?? {}}},
            inputs: readCaptureGradeInputs(row),
            // Explains the stored grade; null when the capture has none.
            breakdown: storedGradeFields(buildCaptureGradeSource(row)).gradeBreakdown
        });
    } catch (error) {
        console.error("[admin-capture-grade]", error);
        return NextResponse.json({
            ok: false,
            error: error instanceof Error ? error.message : "Unable to load this capture's grade"
        }, {status: 500});
    }
}

export async function POST(request: NextRequest) {
    if (!(await isSupportAdminRequestAuthorized(request))) {
        return NextResponse.json({ok: false, error: "Unauthorized"}, {status: 401});
    }

    // Grades are owned by the server (GRADING-1). Writing one from here would
    // overwrite it with a figure from a different formula.
    return NextResponse.json({
        ok: false,
        error: "Capture grades are set by the server and can no longer be edited from the website."
    }, {status: 409});
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
