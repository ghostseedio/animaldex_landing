import {NextResponse} from "next/server";
import {readArkLandingSnapshotBody} from "@/data/ark-landing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET: the shared Ark as the home page's hero mounts it (`/ark/embed.html?snapshot=…`): the public read with every
 * bringer anonymous and nothing `mine` (`readArkLandingSnapshot`), in `/api/ark/voyage`'s shape with no founders, so
 * it is the same for everyone and safe to share from a cache.
 *
 * Why `.bin` (decision 258): Cloudflare caches by file extension and never caches JSON by default, so this path's
 * extension makes the answer edge-cacheable with no Cloudflare setting changed; the edge keeps it `s-maxage` (10
 * minutes, the hero's refresh) and the body is still JSON (`Content-Type: application/json`). A Cloudflare cache rule
 * on this path would do the same under any name.
 */
export async function GET() {
    const body = await readArkLandingSnapshotBody();
    if (!body) return NextResponse.json({available: false}, {status: 503, headers: {"Cache-Control": "no-store"}});
    return new NextResponse(body, {
        headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Cache-Control": "public, max-age=120, s-maxage=600, stale-while-revalidate=600",
            "X-Robots-Tag": "noindex"
        }
    });
}
