import {NextResponse} from "next/server";
import {readArkLandingSummary} from "@/data/ark-landing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET: the home page's live Ark (`src/data/ark-landing.ts`): counts, the last 24 hours' births and meals, who is
 * awake at each island hour and every population since the voyage began. The same for everyone, never a name;
 * worked out at most once a minute per process and cached a minute at the edge.
 */
export async function GET() {
    const summary = await readArkLandingSummary();
    return NextResponse.json(summary, {
        status: summary.available ? 200 : 503,
        headers: {"Cache-Control": summary.available ? "public, s-maxage=60, stale-while-revalidate=300" : "no-store"}
    });
}
