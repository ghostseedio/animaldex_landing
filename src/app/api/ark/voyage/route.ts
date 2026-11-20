import {NextResponse, type NextRequest} from "next/server";
import {arkVoyageReadOf, readArkVoyage, readArkVoyageAnonymousRaw, type ArkVoyageRead} from "@/data/ark-voyage";
import {arkPickEncoding, createArkEncodedBodyCache, type ArkEncodedBody} from "@/lib/ark-encoded-body";
import {requestHasSupabaseAuthCookie} from "@/lib/supabase/auth-cookie";
import {readArkIconAliases} from "@/data/ark-icon-aliases";
import {getSpeciesArtworkIndex} from "@/data/species-artwork-index";
import {arkFoundersOf} from "@/lib/ark-founders";
import {arkIconlessSlugs, arkNoIcon} from "@/lib/ark-icons";
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
 * listing is unavailable (every icon is then asked for, as before). A species
 * whose art is filed under another of its own names (its page's slug, its
 * identity key: `manta-ray.webp` for the Giant Oceanic Manta Ray) comes as
 * `[slug, file]` instead, from `species_profiles` (`data/ark-icon-aliases.ts`,
 * kept in memory as long as the listing is). The file is the catalog's own picture of the species: its page's slug
 * resolved as `/animals/{slug}` resolves it, then the app catalog's names (`arkIconAlias`).
 *
 * An anonymous answer carries a validator (`lib/ark-voyage-etag.ts`): the same Ark but for the read's own time answers
 * 304 to a reader holding it (the apps' panel reads every 45 s: ~400 KB each time before, nothing when unchanged now).
 * A signed-in answer stays `no-store`, as before. The anonymous answer is encoded once per shared read
 * (`lib/ark-encoded-body.ts`: JSON, gzip, brotli) and the same bytes go to every anonymous caller (2026-11-20: per-request
 * decode + encode + gzip of ~4 MB made 10 concurrent callers take 9–30 s on the web VM).
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
    if (requestHasSupabaseAuthCookie(request.headers.get("cookie"))) {
        // (The listing beside the read, never after it: cached in the server for 30 minutes, it costs the read nothing.)
        const [read, artwork] = await Promise.all([readArkVoyage(), getSpeciesArtworkIndex().catch(() => null)]);
        if (!read.available) return NextResponse.json({available: false}, {status: 503, headers: {"Cache-Control": "no-store"}});
        return NextResponse.json(await payloadOf(read, artwork), {headers: {"Cache-Control": "private, no-store"}});
    }
    // Anonymous: the same bytes for everyone while the shared read holds the same answer (encoded and compressed once).
    const [raw, artwork] = await Promise.all([readArkVoyageAnonymousRaw(), getSpeciesArtworkIndex().catch(() => null)]);
    if (!raw.ok) return NextResponse.json({available: false}, {status: 503, headers: {"Cache-Control": "no-store"}});
    let body: ArkEncodedBody;
    try {
        body = await anonymousBody.get([raw, artwork], async () => {
            const read = arkVoyageReadOf(raw, false);
            if (!read.available) throw new Error("undecodable");
            const payload = await payloadOf(read, artwork);
            return {payload, etag: arkVoyageEtag(payload)};
        });
    } catch {
        return NextResponse.json({available: false}, {status: 503, headers: {"Cache-Control": "no-store"}});
    }
    // Cloudflare may keep it (a cache rule must make /api/ark/voyage eligible and bypass it for the auth cookie).
    const headers: Record<string, string> = {"Cache-Control": ANONYMOUS_CACHE, ETag: body.etag, Vary: "Accept-Encoding"};
    if (arkEtagMatches(request.headers.get("if-none-match"), body.etag)) return new NextResponse(null, {status: 304, headers});
    const encoding = arkPickEncoding(request.headers.get("accept-encoding"));
    const bytes = encoding === "br" ? body.br : encoding === "gzip" ? body.gzip : body.json;
    if (encoding) headers["Content-Encoding"] = encoding;
    headers["Content-Type"] = "application/json";
    headers["Content-Length"] = String(bytes.length);
    return new NextResponse(new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.length), {status: 200, headers});
}

const ANONYMOUS_CACHE = "public, max-age=0, s-maxage=30, stale-while-revalidate=300";
const anonymousBody = createArkEncodedBodyCache();

async function payloadOf(read: Extract<ArkVoyageRead, {available: true}>, artwork: Awaited<ReturnType<typeof getSpeciesArtworkIndex>> | null) {
    const missing = artwork ? arkIconlessSlugs(read.snapshot.animals, artwork.bySlug) : null;
    const noIcon = artwork && missing ? arkNoIcon(missing, await readArkIconAliases(read.snapshot.animals, missing, artwork).catch(() => new Map<string, string>())) : undefined;
    return {available: true, snapshot: read.snapshot, founders: read.founders, ...(noIcon ? {noIcon} : {})};
}
