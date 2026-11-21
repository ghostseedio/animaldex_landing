import {NextResponse} from "next/server";
import {cookies} from "next/headers";
import {isMissingArkFunction} from "@/lib/ark-story";
import {requestHasSupabaseAuthCookie} from "@/lib/supabase/auth-cookie";
import {createSupabasePublicClient, createSupabaseServerClient} from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HEADERS = {"Cache-Control": "private, no-store"} as const;

/**
 * GET ?id=<Ark animal>: its care from visitors (AnimalDex GIFTS-CARE, decision 387; `ark_animal_care_v1`): what was
 * given in the last week, as the reader may see it, and the care gifts the reader could give now (`catalog`, the same
 * answer as `get_gift_catalog_v2` on its card; a send goes to POST /api/app/gifts with catalogSource "v2").
 * Read as the reader (their session, so the server knows who asks), or anonymously when signed out (no names, no
 * offers). `{care: null}` while the server's `gift_care` switch is off, and until the function exists: nothing shows.
 */
export async function GET(request: Request) {
    const id = new URL(request.url).searchParams.get("id")?.trim() ?? "";
    if (!UUID.test(id)) return NextResponse.json({care: null}, {status: 400, headers: HEADERS});
    const signedIn = requestHasSupabaseAuthCookie(cookies().getAll());
    const supabase = signedIn ? createSupabaseServerClient() : createSupabasePublicClient();
    if (!supabase) return NextResponse.json({care: null}, {headers: HEADERS});
    const {data, error} = await supabase.rpc("ark_animal_care_v1", {p_animal_id: id});
    if (error) {
        if (!isMissingArkFunction(error)) console.warn("[ark] ark_animal_care_v1 failed", error.message.slice(0, 200));
        return NextResponse.json({care: null, off: isMissingArkFunction(error)}, {headers: HEADERS});
    }
    const row = data && typeof data === "object" ? (data as Record<string, unknown>) : null;
    // `off`: the switch is off (the card stops asking until the page is opened again).
    return NextResponse.json(row && row.enabled === true ? {care: row} : {care: null, off: row?.enabled === false}, {headers: HEADERS});
}
