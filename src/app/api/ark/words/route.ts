import {NextResponse, type NextRequest} from "next/server";
import {arkDirection, arkLanguage} from "@/lib/ark-languages";
import {getArkMessages} from "@/loaders/ark-words";

export const runtime = "nodejs";

/**
 * GET ?lang=<app language>: the Ark's words for the apps' Ark panel
 * (`/ark/embed.html?lang=`), in any of the apps' languages, English key by
 * key where one is missing: `{language, dir, ark, talkPage}`. The same for
 * everyone, so cached; an unknown language answers English.
 */
export async function GET(request: NextRequest) {
    const asked = request.nextUrl.searchParams.get("lang");
    const {language, messages} = await getArkMessages(arkLanguage(asked) ?? "en");
    return NextResponse.json(
        {language, dir: arkDirection(language), ark: messages.ark, talkPage: messages.talkPage},
        {headers: {"Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800"}}
    );
}
