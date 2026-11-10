import {NextResponse} from "next/server";
import {readArkVoyage} from "@/data/ark-voyage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET: the shared Ark's public snapshot (`voyage_public_v1`), for the /ark
 * page's 45-second refresh and the apps' WebView. A signed-in reader's
 * answer marks their own animals, so it is never cached; an anonymous one
 * is the same for everyone and may be, briefly.
 */
export async function GET() {
    const read = await readArkVoyage();
    const cache = read.signedIn ? "private, no-store" : "public, s-maxage=30, stale-while-revalidate=60";
    if (!read.available) return NextResponse.json({available: false}, {status: 503, headers: {"Cache-Control": "no-store"}});
    return NextResponse.json({available: true, snapshot: read.snapshot}, {headers: {"Cache-Control": cache}});
}
