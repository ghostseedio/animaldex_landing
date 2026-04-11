import {NextRequest, NextResponse} from "next/server";
import {getSpeciesSubtitle} from "@/data/species-subtitles";

export async function GET(request: NextRequest, {params}: {params: {slug: string}}) {
    const locale = request.nextUrl.searchParams.get("locale") ?? "en";
    const {descriptor, subtitleStory} = await getSpeciesSubtitle(params.slug, locale, {fresh: true});
    const heroSubtitle = [descriptor ? `${descriptor}.` : null, subtitleStory]
        .filter(Boolean)
        .join(" ");

    return NextResponse.json({
        descriptor,
        subtitleStory,
        heroSubtitle
    }, {
        headers: {
            "Cache-Control": "no-store"
        }
    });
}

export function generateStaticParams() {
    return [];
}

export const dynamic = "force-dynamic";
