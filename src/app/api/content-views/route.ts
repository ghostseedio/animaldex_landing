import {NextResponse} from "next/server";
import {recordContentPageView} from "@/lib/content-page-views";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Records one view of a blog post or page.
 *
 * The public routes are ISR, so a server render happens on regeneration rather
 * than per visit and cannot be the counter — the browser reports the view
 * instead. Crawlers do not run the beacon, so they are excluded for free.
 *
 * Always answers 200: a view that cannot be recorded is not worth surfacing to
 * a reader, and a failing beacon must never show up as a console error on a
 * public page.
 */
export async function POST(request: Request) {
    const body = await request.json().catch(() => null) as {type?: string; slug?: string} | null;
    const type = body?.type === "page" ? "page" : body?.type === "blog" ? "blog" : null;
    const slug = body?.slug?.trim().toLowerCase() ?? "";

    if (!type || !SLUG.test(slug)) {
        return NextResponse.json({ok: false}, {status: 200});
    }

    const views = await recordContentPageView(type, slug);

    return NextResponse.json({ok: views !== null, views});
}
