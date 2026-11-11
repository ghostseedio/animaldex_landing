import {NextResponse} from "next/server";
import {createClient} from "@supabase/supabase-js";
import {isMissingArkFunction} from "@/lib/ark-story";

export const runtime = "nodejs";
export const revalidate = 15;

const HEADERS = {"Cache-Control": "public, max-age=15, s-maxage=15, stale-while-revalidate=30"} as const;
const ISLANDS = new Set(["wild", "town"]);

/**
 * GET ?island=wild: the stored records of animals that were controlled (`voyage_animal_states_v1`, AnimalDex migration
 * 20261119100000): each one's release plan and home override, never a user id. The scene walks each released animal
 * on its plan, then back into its schedule (player control's hand-back, design §3.3). Empty before the migration.
 */
export async function GET(request: Request) {
    const island = new URL(request.url).searchParams.get("island") ?? "wild";
    if (!ISLANDS.has(island)) return NextResponse.json({states: []}, {status: 400, headers: HEADERS});
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return NextResponse.json({states: []}, {headers: HEADERS});
    const supabase = createClient(url, key, {auth: {persistSession: false}});
    const {data, error} = await supabase.rpc("voyage_animal_states_v1", {p_island: island});
    if (error) {
        if (!isMissingArkFunction(error)) console.warn("[ark] voyage_animal_states_v1 failed", error.message?.slice(0, 200));
        return NextResponse.json({states: []}, {headers: HEADERS});
    }
    return NextResponse.json({states: Array.isArray(data) ? data : []}, {headers: HEADERS});
}
