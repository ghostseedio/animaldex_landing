import {NextResponse} from "next/server";
import {renderOgCard} from "@/lib/og/og-card";
import {resolveOgCard} from "@/lib/og/og-cards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Share card for a page: `/api/og/<kind>/<...slug>.png`. The `.png` suffix
 * lets the CDN cache it like any other image.
 */
export async function GET(_request: Request, {params}: {params: {key: string[]}}) {
    const segments = params.key.map((segment) => decodeURIComponent(segment));
    const last = segments.length - 1;
    if (last < 0 || !segments[last].endsWith(".png")) {
        return new NextResponse(null, {status: 404});
    }
    segments[last] = segments[last].slice(0, -".png".length);

    const spec = await resolveOgCard(segments).catch(() => null);
    if (!spec) {
        return new NextResponse(null, {status: 404});
    }
    return renderOgCard(spec);
}
