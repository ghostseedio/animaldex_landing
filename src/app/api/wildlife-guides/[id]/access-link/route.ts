import {NextResponse} from "next/server";
import {createSupabaseServiceClient} from "@/lib/supabase/server";
import {isUuid, isValidBuyerEmail} from "@/lib/virtual-wildlife-guides";
import {sendGuideAccessEmail} from "@/lib/wildlife-guide-fulfillment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * "Email me a new link": a guest who bought a guide by card and lost or let
 * the sign-in link expire gets a fresh one. Always answers the same way, so it
 * never tells anyone whether an email bought a guide; at most one email per
 * purchase every 10 minutes (Resend idempotency key).
 */
export async function POST(request: Request, {params}: {params: {id: string}}) {
    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const done = NextResponse.json({ok: true}, {headers: {"Cache-Control": "private, no-store"}});
    if (!isUuid(params.id) || !isValidBuyerEmail(email)) return done;
    const service = createSupabaseServiceClient();
    if (!service) return done;
    const {data} = await service
        .from("guide_purchases")
        .select("id")
        .eq("listing_id", params.id)
        .eq("buyer_email", email)
        .in("status", ["paid", "released"])
        .order("paid_at", {ascending: false})
        .limit(1)
        .maybeSingle();
    if (!data?.id) return done;
    const bucket = Math.floor(Date.now() / 600_000);
    try {
        await sendGuideAccessEmail(service, {email, listingId: params.id, idempotencyKey: `wildlife-guide-access:${data.id}:${bucket}`});
    } catch (error) {
        console.error("[wildlife-guide-access-link] email failed", data.id, error);
    }
    return done;
}
