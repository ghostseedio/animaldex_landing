import {NextResponse} from "next/server";
import {getUnifiedSpeciesEntries} from "@/data/database-species-pages";
import {buildSpeciesDirectoryImageState} from "@/data/species-images";
import {isNativeRangeRegionKey} from "@/data/native-range";
import {getLocationPage} from "@/data/locations";
import {
    getDefaultSpeciesDirectorySortOrder,
    getSpeciesDirectoryPage,
    isSpeciesDirectorySort,
    isSpeciesDirectorySortOrder,
    isSpeciesDirectoryTierFilter,
    speciesEntries,
    type SpeciesRarityStatusKey
} from "@/data/species";
import {getAppCaptures} from "@/data/authenticated-app";
import {getSpeciesImageRoute} from "@/lib/species-image-public";
import {buildCollectionDiscoveryIndex, isCatalogEntryDiscovered, latestCaptureForCatalogEntry} from "@/lib/collection-discovery";
import {requestHasSupabaseAuthCookie} from "@/lib/supabase/auth-cookie";

export const runtime = "nodejs";
export const revalidate = 86400;

function getSingleParam(value: string | null) {
    return value?.trim() || "";
}

function isSpeciesRarityStatusKey(value: string): value is SpeciesRarityStatusKey {
    return ["very-rare", "rare", "uncommon", "relatively-common"].includes(value);
}

export async function GET(request: Request) {
    const signedIn = requestHasSupabaseAuthCookie(request.headers.get("cookie"));
    const url = new URL(request.url);
    const query = getSingleParam(url.searchParams.get("q"));
    const letter = getSingleParam(url.searchParams.get("letter")) || "all";
    const regionParam = getSingleParam(url.searchParams.get("region"));
    const region = regionParam && isNativeRangeRegionKey(regionParam) ? regionParam : "all";
    const locationParam = getSingleParam(url.searchParams.get("location"));
    const location = locationParam && getLocationPage(locationParam) ? locationParam : "all";
    const statusParam = getSingleParam(url.searchParams.get("status"));
    const status = statusParam && isSpeciesRarityStatusKey(statusParam) ? statusParam : "all";
    const sortParam = getSingleParam(url.searchParams.get("sort"));
    const sort = sortParam && isSpeciesDirectorySort(sortParam) ? sortParam : "number";
    const orderParam = getSingleParam(url.searchParams.get("order")).toLowerCase();
    const order = orderParam && isSpeciesDirectorySortOrder(orderParam)
        ? orderParam
        : getDefaultSpeciesDirectorySortOrder(sort);
    const tierParam = getSingleParam(url.searchParams.get("tier")).toUpperCase();
    const tier = tierParam && isSpeciesDirectoryTierFilter(tierParam) ? tierParam : "all";
    const page = Number.parseInt(getSingleParam(url.searchParams.get("page")) || "1", 10);

    const catalogEntries = signedIn ? await getUnifiedSpeciesEntries() : speciesEntries;
    const directoryPage = getSpeciesDirectoryPage({
        query,
        letter,
        region,
        location,
        status,
        sort,
        order,
        tier,
        page: Number.isFinite(page) ? page : 1,
        entries: catalogEntries
    });
    const [captures, directoryImageState] = await Promise.all([
        signedIn ? getAppCaptures() : Promise.resolve([]),
        signedIn
            ? buildSpeciesDirectoryImageState(directoryPage.entries)
            : Promise.resolve(new Map(directoryPage.entries.map((entry) => [entry.slug, {hasPublicCapture: false, captureId: null}])))
    ]);
    const discoveryIndex = buildCollectionDiscoveryIndex(captures);
    const capturedSpecies = Object.fromEntries(directoryPage.entries.map((entry) => [
        entry.slug,
        isCatalogEntryDiscovered({
            speciesProfileId: entry.speciesProfileId,
            normalizedIdentityKey: entry.normalizedIdentityKey
        }, discoveryIndex)
    ]));
    const speciesImages = Object.fromEntries(directoryPage.entries.map((entry) => {
        const capture = latestCaptureForCatalogEntry({
            speciesProfileId: entry.speciesProfileId,
            normalizedIdentityKey: entry.normalizedIdentityKey
        }, discoveryIndex);
        const publicCaptureId = directoryImageState.get(entry.slug)?.captureId ?? null;
        return [entry.slug, getSpeciesImageRoute(entry.slug, capture?.captureId ?? publicCaptureId)];
    }));
    const publicCaptureSpecies = Object.fromEntries(directoryPage.entries.map((entry) => [
        entry.slug,
        directoryImageState.get(entry.slug)?.hasPublicCapture ?? false
    ]));

    return NextResponse.json({
        entries: directoryPage.entries,
        capturedSpecies,
        speciesImages,
        publicCaptureSpecies,
        currentPage: directoryPage.currentPage,
        totalPages: directoryPage.totalPages,
        total: directoryPage.total,
        hasMore: directoryPage.currentPage < directoryPage.totalPages
    }, {
        headers: signedIn
            ? {"Cache-Control": "private, no-store"}
            : {"Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400"}
    });
}
