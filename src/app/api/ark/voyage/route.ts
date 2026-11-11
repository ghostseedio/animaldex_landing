import {NextResponse, type NextRequest} from "next/server";
import {readArkVoyage} from "@/data/ark-voyage";
import {arkFoundersOf} from "@/lib/ark-founders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET: the shared Ark's public snapshot (`voyage_public_v2`, else v1), for the /ark
 * page's 45-second refresh and the apps' WebView. A signed-in reader's
 * answer marks their own animals, so it is never cached; an anonymous one
 * is the same for everyone and may be, briefly.
 *
 * `founders` beside it (founders contract): the named founders and shared
 * stories of the same answer, `{names: false, animals: {}}` while the
 * server's `founder_names` switch is off or on a server without it.
 *
 * In development, `?fixture=1` answers the v2 fixture (as `/ark?fixture=1`),
 * for `/ark/embed.html?fixture=1`, as names-on answers it (bringers as their
 * @usernames, owner 2026-11-11); `&founders=0`, as a server that names nobody.
 */
export async function GET(request: NextRequest) {
    if (process.env.NODE_ENV === "development" && request.nextUrl.searchParams.get("fixture") === "1") {
        const base = (await import("@/ark-scene/fixtures/snapshot-v2.json")).default;
        const fixture = request.nextUrl.searchParams.get("founders") !== "0" ? (await import("@/lib/ark-founders-fixture")).withArkFixtureFounders(base) : base;
        return NextResponse.json({available: true, snapshot: fixture, founders: arkFoundersOf(fixture)}, {headers: {"Cache-Control": "no-store"}});
    }
    const read = await readArkVoyage();
    const cache = read.signedIn ? "private, no-store" : "public, s-maxage=30, stale-while-revalidate=60";
    if (!read.available) return NextResponse.json({available: false}, {status: 503, headers: {"Cache-Control": "no-store"}});
    return NextResponse.json({available: true, snapshot: read.snapshot, founders: read.founders}, {headers: {"Cache-Control": cache}});
}
