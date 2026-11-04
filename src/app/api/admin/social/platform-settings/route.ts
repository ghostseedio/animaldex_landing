import {NextRequest, NextResponse} from "next/server";
import {isSupportAdminRequestAuthorized} from "@/lib/support-admin-auth";
import {dailyCaps, SHARE_CONTENT_KINDS, type ShareContentKind} from "@/lib/social/auto-share-plan";
import {ADMIN_PAUSE_REASON, type PlatformPauses} from "@/lib/social/platform-pauses";
import {loadPlatformPauses, PLATFORM_SETTINGS_MIGRATION, savePlatformPause} from "@/lib/social/platform-settings";
import {isSocialPlatform, SOCIAL_PLATFORMS} from "@/lib/social/types";

// The auto-share's per-platform switches on /admin/story-videos: which
// platforms and kinds (videos, carousels, text posts) it posts to, and why a
// paused one is paused. GET reads them; POST flips one.

function payload(pauses: PlatformPauses) {
    const caps = dailyCaps(process.env.SOCIAL_DAILY_CAPS);
    return {
        ok: true,
        source: pauses.source,
        migration: PLATFORM_SETTINGS_MIGRATION,
        platforms: SOCIAL_PLATFORMS.map((platform) => ({
            platform,
            kinds: SHARE_CONTENT_KINDS.filter((kind) => caps[platform][kind] > 0).map((kind) => ({kind, ...pauses.entries[platform][kind]}))
        }))
    };
}

export async function GET(request: NextRequest) {
    if (!(await isSupportAdminRequestAuthorized(request))) return NextResponse.json({error: "Unauthorized"}, {status: 401});
    return NextResponse.json(payload(await loadPlatformPauses()));
}

/** `{platform, kind: "video" | "carousel" | "text" | "all", paused: boolean, reason?}`. */
export async function POST(request: NextRequest) {
    if (!(await isSupportAdminRequestAuthorized(request))) return NextResponse.json({error: "Unauthorized"}, {status: 401});
    const body = await request.json().catch(() => ({})) as {platform?: unknown; kind?: unknown; paused?: unknown; reason?: unknown};
    if (!isSocialPlatform(body.platform)) return NextResponse.json({error: "Unknown platform"}, {status: 400});
    const kinds: ShareContentKind[] | null = body.kind === "all" ? [...SHARE_CONTENT_KINDS] : SHARE_CONTENT_KINDS.find((kind) => kind === body.kind) ? [body.kind as ShareContentKind] : null;
    if (!kinds) return NextResponse.json({error: "Unknown kind"}, {status: 400});
    if (typeof body.paused !== "boolean") return NextResponse.json({error: "Say whether it is paused"}, {status: 400});
    const reason = typeof body.reason === "string" && body.reason.trim() ? body.reason.trim().slice(0, 140) : ADMIN_PAUSE_REASON;
    try {
        await savePlatformPause(body.platform, kinds, body.paused, reason);
        return NextResponse.json(payload(await loadPlatformPauses()));
    } catch (error) {
        return NextResponse.json({error: error instanceof Error ? error.message : "Saving failed"}, {status: 500});
    }
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
