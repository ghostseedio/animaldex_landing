import {NextRequest, NextResponse} from "next/server";
import {ANIMAL_POWER_ICON_BATCH_LIMIT, isAnimalPowerIconId} from "@/lib/animal-power-icon";
import {fetchAnimalPowerIcons} from "@/lib/animal-power-icons-server";

/**
 * `GET /api/animal-power-icons?ids=a,b,c` → `{icons: {id: svg}}`, for the
 * client's batching `useAnimalPowerIcon`. Public data, no cookies, cached at the
 * CDN: an id missing from `icons` has no icon.
 */
export async function GET(request: NextRequest) {
    const ids = (request.nextUrl.searchParams.get("ids") ?? "")
        .split(",")
        .map((id) => id.trim())
        .filter(isAnimalPowerIconId)
        .slice(0, ANIMAL_POWER_ICON_BATCH_LIMIT);

    const icons = ids.length ? await fetchAnimalPowerIcons(ids) : {};

    return NextResponse.json({icons}, {
        headers: {
            "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
            "CDN-Cache-Control": "max-age=3600, stale-while-revalidate=86400"
        }
    });
}

export const dynamic = "force-dynamic";
