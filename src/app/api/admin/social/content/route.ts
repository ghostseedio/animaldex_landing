import {NextRequest, NextResponse} from "next/server";
import {isSupportAdminRequestAuthorized} from "@/lib/support-admin-auth";
import {publicStorageUrl} from "@/lib/content-video/store";
import {shareContentNow} from "@/lib/social/auto-share";
import {listPosts} from "@/lib/social/store";
import {runContentGenerate} from "@/lib/social-content/auto";
import {generateCarousel, generateTextPosts} from "@/lib/social-content/generate";
import {getSocialContent, listSocialContent, updateSocialContent} from "@/lib/social-content/store";
import {contentIdFromMediaPath} from "@/lib/social-content/types";

// Carousels and text posts for /admin/story-videos: the list (with slide URLs
// and where each item went), "Generate now", "Share now" and "Archive".
// Generation takes a minute or two (Claude, then rendering), longer than the
// proxy waits, so it runs in the background and the panel polls the list.

let generating: string | null = null;

export async function GET(request: NextRequest) {
    if (!(await isSupportAdminRequestAuthorized(request))) return NextResponse.json({error: "Unauthorized"}, {status: 401});
    try {
        const [items, posts] = await Promise.all([listSocialContent(undefined, 60), listPosts(1500)]);
        const sharesById = new Map<string, Array<{platform: string; status: string; url: string | null; error: string | null}>>();
        for (const post of posts) {
            const id = post.options?.content ?? contentIdFromMediaPath(post.media_path);
            if (!id) continue;
            sharesById.set(id, [...(sharesById.get(id) ?? []), {platform: post.platform, status: post.status, url: post.external_url, error: post.error}]);
        }
        return NextResponse.json({
            ok: true,
            generating,
            items: items.filter((item) => !item.archived_at).map((item) => ({
                ...item,
                slideUrls: (item.images.feed ?? []).map(publicStorageUrl),
                shares: sharesById.get(item.id) ?? []
            }))
        });
    } catch (error) {
        return NextResponse.json({error: error instanceof Error ? error.message : "Unable to load carousels and text posts"}, {status: 500});
    }
}

/** `{action: "generate", kind: "carousel" | "text" | "auto"}` or `{action: "share", id}`. */
export async function POST(request: NextRequest) {
    if (!(await isSupportAdminRequestAuthorized(request))) return NextResponse.json({error: "Unauthorized"}, {status: 401});
    const body = await request.json().catch(() => ({})) as {action?: string; kind?: string; id?: string};
    try {
        if (body.action === "generate") {
            if (generating) return NextResponse.json({error: `Already making ${generating}`}, {status: 409});
            const kind = body.kind === "carousel" || body.kind === "text" ? body.kind : "auto";
            generating = kind === "auto" ? "the stock top-up" : kind === "carousel" ? "a carousel" : "text posts";
            const job = kind === "carousel" ? generateCarousel() : kind === "text" ? generateTextPosts(4) : runContentGenerate();
            void job.catch((error) => console.error("[social-content] generate failed", error)).finally(() => {
                generating = null;
            });
            return NextResponse.json({ok: true, started: generating});
        }
        if (body.action === "share" && body.id) {
            const item = await getSocialContent(body.id);
            if (!item || item.archived_at || item.status !== "ready") return NextResponse.json({error: "Not found"}, {status: 404});
            return NextResponse.json({ok: true, ...(await shareContentNow(item))});
        }
        return NextResponse.json({error: "Unknown action"}, {status: 400});
    } catch (error) {
        return NextResponse.json({error: error instanceof Error ? error.message : "Request failed"}, {status: 500});
    }
}

/** `{id}`: archives an item so the auto-share never posts it. */
export async function DELETE(request: NextRequest) {
    if (!(await isSupportAdminRequestAuthorized(request))) return NextResponse.json({error: "Unauthorized"}, {status: 401});
    const id = request.nextUrl.searchParams.get("id") ?? "";
    try {
        if (!(await getSocialContent(id))) return NextResponse.json({error: "Not found"}, {status: 404});
        await updateSocialContent(id, {archived_at: new Date().toISOString()});
        return NextResponse.json({ok: true});
    } catch (error) {
        return NextResponse.json({error: error instanceof Error ? error.message : "Archive failed"}, {status: 500});
    }
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
