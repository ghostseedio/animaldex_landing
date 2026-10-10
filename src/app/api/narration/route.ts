import {NextResponse} from "next/server";
import {createCloudNarration, findCloudNarration} from "@/lib/narration/cloud-voice";
import {NARRATION_MAX_CHARS, normalizeNarrationText} from "@/lib/narration-text";
import {checkRateLimit} from "@/lib/rate-limit";
import {createSupabaseServerClient} from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// A long article is voiced in a few parallel pieces; the first listen can take a
// while. No `maxDuration`: Next 13.4 rejects it at build time, and the
// self-hosted server has no function time limit.

/**
 * The AI voiceover behind the Listen / Play buttons, for signed-in readers.
 * Returns the saved reading when someone has already listened to this text,
 * otherwise voices it (Google Cloud TTS, else OpenAI) and saves it for the
 * next reader. Signed-out readers get 401 and keep the browser voice.
 */
export async function POST(request: Request) {
    const supabase = createSupabaseServerClient();
    if (!supabase) return NextResponse.json({error: "Supabase is not configured."}, {status: 503});

    const {data: {user}} = await supabase.auth.getUser();
    if (!user) return NextResponse.json({error: "Sign in to hear the AI voice."}, {status: 401});

    const body = await request.json().catch(() => null) as {text?: unknown; locale?: unknown} | null;
    const text = typeof body?.text === "string" ? normalizeNarrationText(body.text) : "";
    const locale = typeof body?.locale === "string" ? body.locale.slice(0, 12) : "en";
    if (!text) return NextResponse.json({error: "Nothing to read."}, {status: 400});
    if (text.length > NARRATION_MAX_CHARS) return NextResponse.json({error: "Too long to read aloud."}, {status: 413});

    try {
        const saved = await findCloudNarration(text, locale);
        if (saved) return NextResponse.json(saved);

        // Only new readings cost anything, so only they count against the limit.
        const hourly = checkRateLimit(`narration:h:${user.id}`, 12, 60 * 60_000);
        const daily = hourly.allowed ? checkRateLimit(`narration:d:${user.id}`, 40, 24 * 60 * 60_000) : hourly;
        if (!hourly.allowed || !daily.allowed) {
            const retryAfterSeconds = Math.max(hourly.retryAfterSeconds, daily.retryAfterSeconds);
            return NextResponse.json({error: "AI voice limit reached. Try again later."}, {status: 429, headers: {"Retry-After": String(retryAfterSeconds)}});
        }

        return NextResponse.json(await createCloudNarration(text, locale));
    } catch (error) {
        console.error("[narration]", error);
        return NextResponse.json({error: "The AI voice is unavailable right now."}, {status: 502});
    }
}
