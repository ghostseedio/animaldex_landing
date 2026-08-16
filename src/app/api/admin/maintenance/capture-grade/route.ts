import {NextRequest, NextResponse} from "next/server";
import {getSupabaseHeaders, getSupabaseServiceKey, getSupabaseUrl} from "@/lib/supabase-http";
import {isSupportAdminRequestAuthorized} from "@/lib/support-admin-auth";
import {
    applyCaptureGradeInputs,
    gradeCaptureRow,
    readCaptureGradeInputs,
    type CaptureGradeEndorsements,
    type CaptureGradeInputs,
    type CaptureGradeRow
} from "@/lib/capture-grade-inputs";

/**
 * Read and correct the inputs behind one capture's grade.
 *
 * A grade is derived from the analysis, so it is fixed by fixing what the model
 * got wrong — confidence, image quality, setting, visible body detail, the market
 * modifiers — and letting the same engine the site grades with recompute it. The
 * recomputed value is also written to analysis_results.capture_grade, because
 * surfaces that read the stored grade would otherwise keep showing the old one.
 *
 * The previous values are kept in raw_json.admin_grade_edits: this edits a user's
 * record, and "what did it say before an operator touched it" needs an answer.
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

/** Endorsements lift the grade, so a preview without them would not match. */
async function loadEndorsements(captureId: string): Promise<CaptureGradeEndorsements> {
    const {url, key} = config();
    const params = new URLSearchParams({select: "endorsed_stat", capture_id: `eq.${captureId}`, limit: "1000"});
    const response = await fetch(`${url}/rest/v1/capture_endorsements?${params}`, {
        headers: getSupabaseHeaders(key, {Accept: "application/json"}),
        cache: "no-store"
    });

    const totals: CaptureGradeEndorsements = {dominance: 0, speed: 0, size: 0, intelligence: 0, rarity: 0};
    if (!response.ok) return totals;

    for (const row of await response.json() as Array<{endorsed_stat?: string}>) {
        const stat = row.endorsed_stat?.trim().toLowerCase();
        if (stat && stat in totals) totals[stat as keyof CaptureGradeEndorsements] += 1;
    }

    return totals;
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
        const [row, endorsements] = await Promise.all([loadAnalysis(captureId), loadEndorsements(captureId)]);

        if (!row) {
            return NextResponse.json({ok: false, error: "This capture has no analysis to grade"}, {status: 404});
        }

        return NextResponse.json({
            ok: true,
            captureId,
            animalName: row.animal_name ?? null,
            storedGrade: row.capture_grade ?? null,
            endorsements,
            // Only `model` is graded from raw_json, and the rest of that blob is
            // the full provider response. The panel previews against this copy;
            // saving re-reads the row server-side, so the client never writes it
            // back.
            row: {...row, raw_json: {model: (row.raw_json ?? {}).model ?? {}}},
            inputs: readCaptureGradeInputs(row),
            breakdown: gradeCaptureRow(row, endorsements)
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

    const payload = await request.json().catch(() => ({})) as {captureId?: string; inputs?: CaptureGradeInputs};
    const captureId = payload.captureId?.trim() ?? "";

    if (!UUID.test(captureId)) {
        return NextResponse.json({ok: false, error: "A capture id is required"}, {status: 400});
    }
    if (!payload.inputs || typeof payload.inputs !== "object") {
        return NextResponse.json({ok: false, error: "No changes were submitted"}, {status: 400});
    }

    try {
        const [current, endorsements] = await Promise.all([loadAnalysis(captureId), loadEndorsements(captureId)]);

        if (!current) {
            return NextResponse.json({ok: false, error: "This capture has no analysis to grade"}, {status: 404});
        }

        const next = applyCaptureGradeInputs(current, payload.inputs);
        const breakdown = gradeCaptureRow(next, endorsements);

        if (!breakdown) {
            return NextResponse.json({
                ok: false,
                error: "These inputs do not produce a grade — the capture has no identified animal"
            }, {status: 422});
        }

        const rawJson = {
            ...(next.raw_json ?? {}),
            admin_grade_edits: [
                ...(Array.isArray((current.raw_json ?? {}).admin_grade_edits)
                    ? (current.raw_json as {admin_grade_edits: unknown[]}).admin_grade_edits
                    : []),
                {
                    at: new Date().toISOString(),
                    from_grade: current.capture_grade ?? null,
                    to_grade: breakdown.grade,
                    previous_inputs: readCaptureGradeInputs(current)
                }
            ].slice(-20)
        };

        const {url, key} = config();
        const response = await fetch(`${url}/rest/v1/analysis_results?capture_id=eq.${captureId}`, {
            method: "PATCH",
            headers: getSupabaseHeaders(key, {"Content-Type": "application/json", Prefer: "return=minimal"}),
            cache: "no-store",
            body: JSON.stringify({
                confidence: next.confidence,
                zoo_or_wild: next.zoo_or_wild,
                signals: next.signals,
                observed_market_modifiers: next.observed_market_modifiers,
                raw_json: rawJson,
                capture_grade: breakdown.grade
            })
        });

        if (!response.ok) {
            throw new Error(`Saving the grade failed (${response.status}): ${await response.text()}`);
        }

        return NextResponse.json({
            ok: true,
            captureId,
            storedGrade: breakdown.grade,
            inputs: readCaptureGradeInputs({...next, capture_grade: breakdown.grade}),
            breakdown
        });
    } catch (error) {
        console.error("[admin-capture-grade]", error);
        return NextResponse.json({
            ok: false,
            error: error instanceof Error ? error.message : "Unable to save this capture's grade"
        }, {status: 500});
    }
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
