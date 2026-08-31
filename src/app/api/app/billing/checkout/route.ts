import {NextResponse} from "next/server";
import {createSupabaseServerClient, createSupabaseServiceClient} from "@/lib/supabase/server";
import {
    assertPaddleCheckoutConfigured,
    paddlePriceIdForProduct,
    resolvePaddleEnvironment
} from "@/lib/paddle-server";
import {
    sanitizeBillingReturnPath,
    validateCheckoutRequestBody
} from "@/lib/web-store-catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
    const configError = assertPaddleCheckoutConfigured();
    if (configError) {
        return NextResponse.json({error: configError, code: "paddle_not_configured"}, {status: 503});
    }
    const environment = resolvePaddleEnvironment();
    if (environment !== "production" && environment !== "sandbox") {
        return NextResponse.json({error: "Paddle is not configured.", code: "paddle_not_configured"}, {status: 503});
    }

    const supabase = createSupabaseServerClient();
    if (!supabase) return NextResponse.json({error: "Authentication required."}, {status: 401});
    const {data: {user}} = await supabase.auth.getUser();
    if (!user) return NextResponse.json({error: "Authentication required."}, {status: 401});

    const body = await request.json().catch(() => ({}));
    const validated = validateCheckoutRequestBody(body as Record<string, unknown>);
    if (!validated.ok) {
        return NextResponse.json({error: validated.error}, {status: validated.status});
    }
    const productCode = validated.productCode;

    const returnPath = sanitizeBillingReturnPath(typeof body.returnPath === "string" ? body.returnPath : undefined);
    const {data: status} = await supabase.rpc("get_my_web_billing_status");
    const alreadyPro = Boolean(status && (status as {is_pro?: boolean}).is_pro);
    if (productCode === "pro_upgrade" && alreadyPro) {
        return NextResponse.json({
            error: "This account already has AnimalDex Pro.",
            code: "already_pro",
            provider: (status as {pro_provider?: string})?.pro_provider ?? "unknown"
        }, {status: 409});
    }

    const priceId = paddlePriceIdForProduct(productCode);
    const service = createSupabaseServiceClient();
    if (!service) return NextResponse.json({error: "Checkout registration is not configured."}, {status: 503});
    const {data: purchaseId, error: registerError} = await service.rpc("register_web_purchase", {
        p_user_id: user.id,
        p_provider: "paddle",
        p_product_code: productCode,
        p_return_path: returnPath,
        p_provider_price_id: priceId
    });
    if (registerError) {
        return NextResponse.json({error: registerError.message}, {status: 400});
    }

    return NextResponse.json({
        ok: true,
        provider: "paddle",
        environment,
        clientToken: process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN,
        purchaseId,
        priceId,
        productCode,
        userId: user.id,
        customerEmail: user.email ?? undefined
    });
}
