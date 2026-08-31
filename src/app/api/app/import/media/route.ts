import {NextResponse} from "next/server";
import {createSupabaseServerClient} from "@/lib/supabase/server";
import {isAllowedInstagramMediaHost} from "@/lib/instagram-import";

export const dynamic = "force-dynamic";

function deny(status = 400) {
    return new NextResponse("Media unavailable.", {status});
}

export async function GET(request: Request) {
    const supabase = createSupabaseServerClient();
    if (!supabase) return deny(503);
    const {data: {user}} = await supabase.auth.getUser();
    if (!user) return deny(401);

    const raw = new URL(request.url).searchParams.get("url")?.trim();
    if (!raw) return deny();
    let target: URL;
    try {
        target = new URL(raw);
    } catch {
        return deny();
    }
    if (target.protocol !== "https:") return deny();
    if (!isAllowedInstagramMediaHost(target.hostname)) return deny();

    const headers: HeadersInit = {Accept: "video/mp4,video/*,image/*,*/*"};
    const range = request.headers.get("range");
    if (range) headers.Range = range;

    const upstream = await fetch(target.toString(), {
        headers,
        cache: "no-store",
        redirect: "follow"
    });
    if (!upstream.ok && upstream.status !== 206) return deny(upstream.status === 404 ? 404 : 502);

    const finalHost = new URL(upstream.url).hostname;
    if (!isAllowedInstagramMediaHost(finalHost)) return deny();

    const responseHeaders = new Headers();
    const passthrough = ["content-type", "content-length", "content-range", "accept-ranges", "cache-control"];
    for (const name of passthrough) {
        const value = upstream.headers.get(name);
        if (value) responseHeaders.set(name, value);
    }
    responseHeaders.set("Cache-Control", "private, no-store");
    return new NextResponse(upstream.body, {
        status: upstream.status,
        headers: responseHeaders
    });
}
