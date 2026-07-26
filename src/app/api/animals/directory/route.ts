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
    type SpeciesRarityStatusKey
} from "@/data/species";

export const runtime = "nodejs";

function getSingleParam(value: string | null) {
    return value?.trim() || "";
}

function isSpeciesRarityStatusKey(value: string): value is SpeciesRarityStatusKey {
    return ["very-rare", "rare", "uncommon", "relatively-common"].includes(value);
}

export async function GET(request: Request) {
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

    const unifiedSpeciesEntries = await getUnifiedSpeciesEntries();
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
        entries: unifiedSpeciesEntries
    });
    const directoryImageState = Object.fromEntries(
        (await buildSpeciesDirectoryImageState(directoryPage.entries)).entries()
    );

    return NextResponse.json({
        entries: directoryPage.entries,
        directoryImageState,
        currentPage: directoryPage.currentPage,
        totalPages: directoryPage.totalPages,
        total: directoryPage.total,
        hasMore: directoryPage.currentPage < directoryPage.totalPages
    });
}
