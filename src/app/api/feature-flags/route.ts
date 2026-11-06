import {NextResponse} from "next/server";
import {loadAppFeatureFlags} from "@/data/app-feature-flags";

/**
 * The apps' remote switches (`app_feature_flags_v1()`, lib/app-feature-flags)
 * for a page that is cached for everyone, like /talk: the same for every
 * reader, so shared-cached for a minute. A key it lacks is off.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
    const flags = await loadAppFeatureFlags();
    return NextResponse.json({flags}, {
        headers: {
            "Cache-Control": "public, max-age=0, s-maxage=60, stale-while-revalidate=300",
            "X-Robots-Tag": "noindex"
        }
    });
}
