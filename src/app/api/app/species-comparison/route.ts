import {NextResponse} from "next/server";
import {resolveChallengeEntry} from "@/data/species-comparisons";
import {createSupabaseServerClient} from "@/lib/supabase/server";

export const runtime = "nodejs";

function buildPairSlug(animalA: string, animalB: string) {
    const a = animalA.trim().toLowerCase();
    const b = animalB.trim().toLowerCase();
    if (!a || !b || a === b) return null;
    return `${a}-vs-${b}`;
}

export async function GET(request: Request) {
    const supabase = createSupabaseServerClient();

    if (!supabase) {
        return NextResponse.json({error: "Supabase is not configured."}, {status: 503});
    }

    const {data: {user}} = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({error: "Authentication required."}, {status: 401});
    }

    const {searchParams} = new URL(request.url);
    const slugParam = String(searchParams.get("slug") ?? "").trim().toLowerCase();
    const animalA = String(searchParams.get("animalA") ?? "").trim().toLowerCase();
    const animalB = String(searchParams.get("animalB") ?? "").trim().toLowerCase();
    const slug = slugParam || buildPairSlug(animalA, animalB);

    if (!slug) {
        return NextResponse.json({error: "Comparison slug or animal pair is required."}, {status: 400});
    }

    try {
        const comparison = await resolveChallengeEntry(slug);
        if (!comparison) {
            return NextResponse.json({error: "Comparison unavailable."}, {status: 404});
        }
        return NextResponse.json({comparison});
    } catch (error) {
        const message = error instanceof Error ? error.message : "Comparison failed.";
        return NextResponse.json({error: message}, {status: 502});
    }
}
