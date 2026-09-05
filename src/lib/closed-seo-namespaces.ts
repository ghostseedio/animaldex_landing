import {NextRequest, NextResponse} from "next/server";
import closedSeoNamespaceSlugs from "@/data/closed-seo-namespace-slugs.json";
import {
    COLLAPSED_ID_DETAIL_FAMILIES,
    isCollapsedEnglishDetailPath,
    type CollapsedIdDetailFamily
} from "@/lib/english-detail-routes";
import {
    isPublishedAnimalSlug,
    isPublishedLessonSlug,
    normalizePublishedSeoSlug
} from "@/lib/published-seo-slugs";
import {splitLocalePath} from "@/lib/request-routing";

const CLOSED_FAMILIES = new Set<string>(COLLAPSED_ID_DETAIL_FAMILIES);
const POKEMON_SLUGS = new Set(closedSeoNamespaceSlugs.pokemon);
const HYBRID_SLUGS = new Set(closedSeoNamespaceSlugs.hybrids);
const RESERVED_SLUGS: Partial<Record<CollapsedIdDetailFamily, ReadonlySet<string>>> = {
    animals: new Set(["search"])
};

export const CLOSED_SEO_NAMESPACE_HEADER = "x-animaldex-closed-seo-namespace";

const CLOSED_SEO_404_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="robots" content="noindex, nofollow">
<title>Not found</title>
</head>
<body>
<h1>Not found</h1>
</body>
</html>
`;

export function isClosedSeoNamespaceFamily(segment: string | undefined): segment is CollapsedIdDetailFamily {
    return Boolean(segment && CLOSED_FAMILIES.has(segment));
}

export function isPublishedClosedSeoSlug(family: CollapsedIdDetailFamily, slug: string) {
    const normalized = normalizePublishedSeoSlug(slug);
    if (!normalized) {
        return false;
    }
    if (family === "animals") {
        return isPublishedAnimalSlug(normalized);
    }
    if (family === "animal-lessons") {
        return isPublishedLessonSlug(normalized);
    }
    if (family === "pokemon-animals") {
        return POKEMON_SLUGS.has(normalized);
    }
    return HYBRID_SLUGS.has(normalized);
}

export type ClosedSeoNamespaceResolution =
    | {action: "allow"; reason: "hub" | "reserved" | "published"; family: CollapsedIdDetailFamily; slug?: string}
    | {action: "block"; reason: "unknown-slug" | "nested"; family: CollapsedIdDetailFamily; slug?: string};

export function resolveClosedSeoNamespacePath(pathname: string): ClosedSeoNamespaceResolution | null {
    const {appPath} = splitLocalePath(pathname);
    const parts = appPath.split("/").filter(Boolean);
    const family = parts[0];
    if (!family || !isClosedSeoNamespaceFamily(family)) {
        return null;
    }

    const closedFamily = family as CollapsedIdDetailFamily;
    if (parts.length === 1) {
        return {action: "allow", reason: "hub", family: closedFamily};
    }

    const slug = normalizePublishedSeoSlug(parts[1] ?? "");
    if (parts.length === 2 && RESERVED_SLUGS[closedFamily]?.has(slug)) {
        return {action: "allow", reason: "reserved", family: closedFamily, slug};
    }

    if (parts.length > 2) {
        return {action: "block", reason: "nested", family: closedFamily, slug};
    }

    if (isPublishedClosedSeoSlug(closedFamily, slug)) {
        return {action: "allow", reason: "published", family: closedFamily, slug};
    }

    return {action: "block", reason: "unknown-slug", family: closedFamily, slug};
}

export function closedSeoNamespaceNotFoundResponse() {
    return new NextResponse(CLOSED_SEO_404_HTML, {
        status: 404,
        headers: {
            "content-type": "text/html; charset=utf-8",
            "cache-control": "public, max-age=60, s-maxage=86400, stale-while-revalidate=604800",
            "x-robots-tag": "noindex, nofollow",
            [CLOSED_SEO_NAMESPACE_HEADER]: "1"
        }
    });
}

export function englishOnlyDetailLinkHeader(origin: string, englishPath: string) {
    const canonical = `${origin.replace(/\/$/, "")}${englishPath}`;
    return `<${canonical}>; rel="alternate"; hreflang="en", <${canonical}>; rel="alternate"; hreflang="x-default"`;
}

export function applyEnglishOnlyDetailLinkHeader(response: NextResponse, request: NextRequest) {
    const {appPath} = splitLocalePath(request.nextUrl.pathname);
    if (!isCollapsedEnglishDetailPath(appPath)) {
        return response;
    }

    const englishPath = appPath.replace(/\/+$/, "") || "/";
    response.headers.set("Link", englishOnlyDetailLinkHeader(request.nextUrl.origin, englishPath));
    return response;
}
