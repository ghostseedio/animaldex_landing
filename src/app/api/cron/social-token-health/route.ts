import {timingSafeEqual} from "crypto";
import {NextRequest, NextResponse} from "next/server";
import {checkOAuthConnection} from "@/lib/social/connection-health";
import {isOAuthPlatform} from "@/lib/social/oauth";
import {listConnectionRows} from "@/lib/social/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(request: NextRequest) {
    const secret = process.env.CRON_SECRET?.trim();
    const actual = request.headers.get("authorization")?.trim() ?? "";
    if (!secret) return false;
    const expected = Buffer.from(`Bearer ${secret}`);
    const supplied = Buffer.from(actual);
    return expected.length === supplied.length && timingSafeEqual(expected, supplied);
}

/** Daily refresh and validity check for connected YouTube, Instagram, Facebook and X accounts. */
export async function POST(request: NextRequest) {
    if (!authorized(request)) return NextResponse.json({error: "unauthorized"}, {status: 401});
    try {
        const rows = await listConnectionRows();
        const results = await Promise.all(rows.filter((row) => isOAuthPlatform(row.platform)).map(async (row) => {
            try {
                const connection = await checkOAuthConnection(row.platform);
                return {platform: row.platform, ok: true, expiresAt: connection.expiresAt?.toISOString() ?? null};
            } catch (cause) {
                const error = cause instanceof Error ? cause.message : "Unable to verify this connection.";
                console.error(`[social-token-health] ${row.platform} needs attention: ${error}`);
                return {platform: row.platform, ok: false, error};
            }
        }));
        const failed = results.filter((result) => !result.ok).length;
        return NextResponse.json({ok: failed === 0, checked: results.length, failed, results}, {status: failed ? 503 : 200});
    } catch (cause) {
        const error = cause instanceof Error ? cause.message : "Unable to check social connections.";
        console.error("[social-token-health] check failed", error);
        return NextResponse.json({ok: false, error}, {status: 503});
    }
}
