import {NextRequest, NextResponse} from "next/server";
import {
    LESSON_VIDEOS_FUNCTION,
    LESSON_VIDEO_PAGE_SIZE,
    type LessonVideo,
    decodeLessonVideoPage,
    mergeLessonVideos
} from "@/lib/lesson-videos";
import {invokeAuthenticatedSupabaseFunctionResponse} from "@/lib/supabase/app-functions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * One page of the Home tab's lesson video feed: iOS
 * `StoryVideoLibrary.feed(before:locale:)`, which posts `{action: "feed"}` to
 * the `story-videos` edge function with the viewer's session.
 *
 * The function reads a window of rows and keeps the viewable ones, so a page
 * can come back empty while more exist further down. iOS would stop on such a
 * page; here a few windows are read until something is found.
 */
const MAX_WINDOWS = 3;

export async function GET(request: NextRequest) {
    const params = request.nextUrl.searchParams;
    const beforeParam = params.get("before")?.trim() || null;
    let before = beforeParam && !Number.isNaN(Date.parse(beforeParam)) ? beforeParam : null;
    const localeParam = params.get("locale")?.trim().toLowerCase() ?? "";
    const locale = /^[a-z]{2,3}(-[a-z0-9]{2,8})?$/.test(localeParam) ? localeParam : "en";

    let items: LessonVideo[] = [];
    let nextBefore: string | null = null;
    try {
        for (let window = 0; window < MAX_WINDOWS; window += 1) {
            const invoked = await invokeAuthenticatedSupabaseFunctionResponse(LESSON_VIDEOS_FUNCTION, {
                action: "feed",
                locale,
                limit: LESSON_VIDEO_PAGE_SIZE,
                ...(before ? {before} : {})
            });
            if (!invoked.ok) {
                const status = invoked.status === 401 ? 401 : 502;
                return NextResponse.json({error: status === 401 ? "Sign in to watch lesson videos." : "Couldn't load the videos."}, {status});
            }
            const page = decodeLessonVideoPage(invoked.payload);
            items = mergeLessonVideos(items, page.items);
            nextBefore = page.nextBefore;
            if (items.length > 0 || !nextBefore) break;
            before = nextBefore;
        }
    } catch (error) {
        const message = error instanceof Error ? error.message : "";
        const status = message === "Authentication required." ? 401 : 502;
        return NextResponse.json({error: status === 401 ? "Sign in to watch lesson videos." : "Couldn't load the videos."}, {status});
    }

    // Signed URLs, per viewer: never cached.
    return NextResponse.json({items, nextBefore}, {headers: {"Cache-Control": "private, no-store"}});
}
