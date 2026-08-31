import {NextResponse} from "next/server";
import {createSupabaseServerClient} from "@/lib/supabase/server";
import {assertPaddleApiConfigured, paddleApiRequest} from "@/lib/paddle-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
    const configError = assertPaddleApiConfigured();
    if (configError) {
        return NextResponse.json({error: configError, code: "paddle_not_configured"}, {status: 503});
    }
    const supabase = createSupabaseServerClient();
    if (!supabase) return NextResponse.json({error: "Authentication required."}, {status: 401});
    const {data: {user}} = await supabase.auth.getUser();
    if (!user) return NextResponse.json({error: "Authentication required."}, {status: 401});

    const {data: status} = await supabase.rpc("get_my_web_billing_status");
    const provider = (status as {pro_provider?: string} | null)?.pro_provider;
    if (provider === "apple") {
        return NextResponse.json({
            error: "Manage this subscription in the App Store.",
            code: "manage_on_apple"
        }, {status: 409});
    }
    if (provider === "google") {
        return NextResponse.json({
            error: "Manage this subscription in Google Play.",
            code: "manage_on_google"
        }, {status: 409});
    }
    if (provider !== "paddle") {
        return NextResponse.json({
            error: "No web subscription to manage.",
            code: "no_paddle_subscription"
        }, {status: 404});
    }

    const {data: subscriptionRow} = await supabase
        .from("paddle_subscriptions")
        .select("paddle_customer_id,paddle_subscription_id")
        .eq("user_id", user.id)
        .in("status", ["active", "trialing", "past_due", "paused"])
        .order("updated_at", {ascending: false})
        .limit(1)
        .maybeSingle();
    const subscription = subscriptionRow as {paddle_customer_id?: string; paddle_subscription_id?: string} | null;
    const customerId = subscription?.paddle_customer_id;
    if (!customerId) {
        return NextResponse.json({error: "No web subscription to manage."}, {status: 404});
    }

    const portal = await paddleApiRequest<{data?: {urls?: {general?: {overview?: string}}}}>(
        `/customers/${encodeURIComponent(customerId)}/portal-sessions`,
        {
            method: "POST",
            body: JSON.stringify(subscription?.paddle_subscription_id
                ? {subscription_ids: [subscription.paddle_subscription_id]}
                : {})
        }
    );
    const url = portal.data?.urls?.general?.overview;
    if (!url) return NextResponse.json({error: "Could not open subscription management."}, {status: 502});
    return NextResponse.json({ok: true, url});
}
