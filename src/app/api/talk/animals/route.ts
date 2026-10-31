import {NextResponse} from "next/server";
import {getTalkCatalog} from "@/data/talk-animals";

/**
 * The Talk page's animal picker (docs/rich-chat/SPEC.md, section 4.3): every
 * animal by name and Power for the search, the popular ones and the pairs
 * that disagree. Public and the same for everyone, so it is shared-cached;
 * read at request time, never during the static build.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
    const catalog = await getTalkCatalog();
    return NextResponse.json(catalog, {
        headers: {
            "Cache-Control": catalog.animals.length > 0
                ? "public, s-maxage=3600, stale-while-revalidate=86400"
                : "no-store",
            "X-Robots-Tag": "noindex"
        }
    });
}
