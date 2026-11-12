import {NextResponse, type NextRequest} from "next/server";
import {appStoreLink, googlePlayLink} from "@/lib/store-links";
import {getSiteUrl} from "@/lib/site";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET: where the home page's QR code goes (`home_qr`): the App Store on an iPhone or iPad, Google Play on Android,
 * and the home page's download section anywhere else. The phone's own store, so one code serves both.
 */
export function GET(request: NextRequest) {
    const agent = request.headers.get("user-agent") ?? "";
    const destination = /iPhone|iPad|iPod/i.test(agent) || (/Macintosh/i.test(agent) && /Mobile/i.test(agent))
        ? appStoreLink("home_qr")
        : /Android/i.test(agent)
            ? googlePlayLink("home_qr")
            : new URL("/#download", getSiteUrl()).toString();
    return NextResponse.redirect(destination, {status: 302, headers: {"Cache-Control": "private, no-store", "X-Robots-Tag": "noindex"}});
}
