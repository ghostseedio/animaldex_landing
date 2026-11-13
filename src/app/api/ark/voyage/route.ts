import {NextResponse, type NextRequest} from "next/server";
import {readArkVoyage} from "@/data/ark-voyage";
import {getSpeciesArtworkSlugs} from "@/data/species-artwork-index";
import {arkFoundersOf} from "@/lib/ark-founders";
import {arkIconlessSlugs} from "@/lib/ark-icons";
import {arkEtagMatches, arkVoyageEtag} from "@/lib/ark-voyage-etag";

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
 * `noIcon` beside it: the answer's species with no icon art in the `animals`
 * bucket (`lib/ark-icons.ts`, from the bucket's listing, cached 30 minutes),
 * drawn as the generic figure without a request each; absent while the
 * listing is unavailable (every icon is then asked for, as before).
 *
 * An anonymous answer carries a validator (`lib/ark-voyage-etag.ts`): the same Ark but for the read's own time answers
 * 304 to a reader holding it (the apps' panel reads every 45 s: ~400 KB each time before, nothing when unchanged now).
 * A signed-in answer stays `no-store`, as before.
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
    // (The listing beside the read, never after it: cached in the server for 30 minutes, it costs the read nothing.)
    const [read, artwork] = await Promise.all([readArkVoyage(), getSpeciesArtworkSlugs().catch(() => null)]);
    const cache = read.signedIn ? "private, no-store" : "public, s-maxage=30, stale-while-revalidate=60";
    if (!read.available) return NextResponse.json({available: false}, {status: 503, headers: {"Cache-Control": "no-store"}});
    const noIcon = artwork ? arkIconlessSlugs(read.snapshot.animals, artwork) : undefined;
    const payload = {available: true, snapshot: read.snapshot, founders: read.founders, ...(noIcon ? {noIcon} : {})};
    if (read.signedIn) return NextResponse.json(payload, {headers: {"Cache-Control": cache}});
    const etag = arkVoyageEtag(payload);
    if (arkEtagMatches(request.headers.get("if-none-match"), etag)) return new NextResponse(null, {status: 304, headers: {"Cache-Control": cache, ETag: etag}});
    return NextResponse.json(payload, {headers: {"Cache-Control": cache, ETag: etag}});
}
