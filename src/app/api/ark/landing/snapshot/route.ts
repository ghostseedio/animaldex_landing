import {NextResponse} from "next/server";
import {readArkLandingSnapshot} from "@/data/ark-landing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET: the shared Ark as the home page's hero mounts it (`/ark/embed.html?snapshot=…`): the public read with every
 * bringer anonymous and nothing `mine` (`readArkLandingSnapshot`), in `/api/ark/voyage`'s shape with no founders, so
 * the same for everyone and cacheable. The public read itself is shared and kept five minutes per process.
 */
export async function GET() {
    const snapshot = await readArkLandingSnapshot();
    if (!snapshot) return NextResponse.json({available: false}, {status: 503, headers: {"Cache-Control": "no-store"}});
    return NextResponse.json(
        {available: true, snapshot, founders: {names: false, animals: {}}},
        {headers: {"Cache-Control": "public, s-maxage=120, stale-while-revalidate=600"}}
    );
}
