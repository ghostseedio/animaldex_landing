import {NextRequest, NextResponse} from "next/server";
import {getSupabaseHeaders, getSupabaseServiceKey, getSupabaseUrl} from "@/lib/supabase-http";
import {isSupportAdminRequestAuthorized} from "@/lib/support-admin-auth";

/**
 * Captures whose photo never arrived.
 *
 * analyze-capture downloads the primary image once and throws when it is not
 * there, which leaves the capture sitting in "analyzing" forever: the analysis
 * will never be retried, and the object it wants does not exist. The member sees
 * a spinner that cannot resolve.
 *
 * GET lists them, having checked storage rather than trusting the row. POST
 * closes them out as failed with a reason a person can read, so the member's
 * collection stops pretending something is in flight.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STUCK_MINUTES = 10;

type Row = Record<string, unknown>;

function config() {
    const url = getSupabaseUrl();
    const key = getSupabaseServiceKey();
    if (!url || !key) throw new Error("Supabase maintenance access is not configured");
    return {url, key};
}

async function query(path: string, init?: RequestInit) {
    const {url, key} = config();
    const response = await fetch(`${url}/rest/v1/${path}`, {
        ...init,
        headers: getSupabaseHeaders(key, {Accept: "application/json", ...(init?.headers as Record<string, string>)}),
        cache: "no-store"
    });
    if (!response.ok) throw new Error(`${path.split("?")[0]} failed (${response.status}): ${await response.text()}`);
    return response;
}

/** Asks storage itself: a row can name an object that was never written. */
async function objectExists(bucket: string, path: string) {
    const {url, key} = config();
    try {
        const response = await fetch(`${url}/storage/v1/object/${bucket}/${path}`, {
            method: "HEAD",
            headers: getSupabaseHeaders(key),
            cache: "no-store"
        });
        return response.ok;
    } catch {
        return false;
    }
}

async function findBroken(limit: number) {
    const cutoff = new Date(Date.now() - STUCK_MINUTES * 60_000).toISOString();
    const captures = await (await query(`captures?${new URLSearchParams({
        select: "id,user_id,status,created_at",
        // Every pre-completion state in capture_status; "ready" and "failed" are terminal.
        status: "in.(pending,uploading,ready_for_analysis,analyzing)",
        created_at: `lt.${cutoff}`,
        order: "created_at.desc",
        limit: String(limit)
    })}`)).json() as Row[];

    if (!captures.length) return [];

    const images = await (await query(`capture_images?${new URLSearchParams({
        select: "capture_id,storage_bucket,storage_path,sort_order",
        capture_id: `in.(${captures.map((row) => row.id).join(",")})`,
        order: "sort_order.asc"
    })}`)).json() as Row[];

    const primaryByCapture = new Map<string, Row>();
    for (const image of images) {
        const id = String(image.capture_id);
        if (!primaryByCapture.has(id)) primaryByCapture.set(id, image);
    }

    const broken: Array<{id: string; userId: string; status: string; createdAt: string; reason: string}> = [];

    for (const capture of captures) {
        const id = String(capture.id);
        const image = primaryByCapture.get(id);
        const present = image
            ? await objectExists(String(image.storage_bucket), String(image.storage_path))
            : false;

        if (present) continue;

        broken.push({
            id,
            userId: String(capture.user_id),
            status: String(capture.status),
            createdAt: String(capture.created_at),
            reason: image ? "The photo was never written to storage" : "No image row was ever created"
        });
    }

    return broken;
}

export async function GET(request: NextRequest) {
    if (!(await isSupportAdminRequestAuthorized(request))) {
        return NextResponse.json({ok: false, error: "Unauthorized"}, {status: 401});
    }

    try {
        const limit = Math.min(200, Math.max(10, Number(request.nextUrl.searchParams.get("limit")) || 100));
        return NextResponse.json({ok: true, captures: await findBroken(limit), stuckMinutes: STUCK_MINUTES});
    } catch (error) {
        console.error("[admin-broken-captures]", error);
        return NextResponse.json({
            ok: false,
            error: error instanceof Error ? error.message : "Unable to check captures"
        }, {status: 500});
    }
}

export async function POST(request: NextRequest) {
    if (!(await isSupportAdminRequestAuthorized(request))) {
        return NextResponse.json({ok: false, error: "Unauthorized"}, {status: 401});
    }

    const body = await request.json().catch(() => ({})) as {captureIds?: string[]};
    const ids = (body.captureIds ?? []).filter((id) => UUID.test(id));

    if (!ids.length) {
        return NextResponse.json({ok: false, error: "No captures were given"}, {status: 400});
    }

    try {
        // Only ever closes captures whose object really is missing, so a slow
        // upload that landed in the meantime is left alone.
        const broken = new Set((await findBroken(200)).map((row) => row.id));
        const closable = ids.filter((id) => broken.has(id));
        const skipped = ids.filter((id) => !broken.has(id));

        if (closable.length) {
            await query(`captures?id=in.(${closable.join(",")})`, {
                method: "PATCH",
                headers: {"Content-Type": "application/json", Prefer: "return=minimal"},
                body: JSON.stringify({status: "failed", updated_at: new Date().toISOString()})
            });

            await query(`analysis_results?capture_id=in.(${closable.join(",")})`, {
                method: "PATCH",
                headers: {"Content-Type": "application/json", Prefer: "return=minimal"},
                body: JSON.stringify({
                    error_message: "upload_incomplete: the photo never finished uploading, so there was nothing to analyse"
                })
            });
        }

        return NextResponse.json({ok: true, closed: closable.length, skipped: skipped.length, skippedIds: skipped});
    } catch (error) {
        console.error("[admin-broken-captures]", error);
        return NextResponse.json({
            ok: false,
            error: error instanceof Error ? error.message : "Unable to close those captures"
        }, {status: 500});
    }
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
