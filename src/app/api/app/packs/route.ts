import {NextResponse} from "next/server";
import {
    getTrainAnimalPackById,
    getTrainPackCapturesByIds
} from "@/data/train-modules";
import {createSupabaseServerClient} from "@/lib/supabase/server";

export const runtime = "nodejs";

type MutationRow = {
    pack_id?: string;
};

type OpenRow = MutationRow & {
    capture_ids?: string[];
};

function friendlyPackError(error: unknown) {
    const message = error instanceof Error ? error.message : String(error ?? "");
    const normalized = message.toLowerCase();

    if (normalized.includes("insufficient_credits")) return "You do not have enough credits for this pack.";
    if (normalized.includes("seller_cannot_buy_own_pack")) return "You cannot buy your own pack.";
    if (normalized.includes("animal_pack_not_available") || normalized.includes("animal_pack_not_found")) return "That pack is no longer available.";
    if (normalized.includes("animal_pack_requires_ten_captures")) return "Select exactly 10 captures.";
    if (normalized.includes("animal_pack_duplicate_capture_ids")) return "Each selected capture must be unique.";
    if (normalized.includes("animal_pack_requires_tier_b_or_higher")) return "Your pack needs at least 1 Tier B or higher animal.";
    if (normalized.includes("animal_pack_capture_locked")) return "One or more selected captures are already locked.";
    if (normalized.includes("animal_pack_capture_not_public")) return "Only public, discoverable captures can be packed right now.";
    if (
        normalized.includes("animal_pack_capture_not_market_eligible")
        || normalized.includes("animal_pack_capture_missing_stats")
        || normalized.includes("animal_pack_capture_not_ready")
    ) {
        return "One or more selected captures are not eligible for sealed packs.";
    }
    if (normalized.includes("animal_pack_price_invalid")) return "Pack price must stay between 5 and 5000 credits.";
    if (
        normalized.includes("only_seller_can_cancel_animal_pack")
        || normalized.includes("animal_pack_not_cancellable")
        || normalized.includes("only_buyer_can_open_animal_pack")
        || normalized.includes("animal_pack_not_openable")
    ) {
        return "That pack action is no longer available.";
    }

    return message || "Pack action failed.";
}

async function getAuthenticatedClient() {
    const supabase = createSupabaseServerClient();
    if (!supabase) return {supabase: null, error: NextResponse.json({error: "Supabase is not configured."}, {status: 503})};

    const {data: {user}} = await supabase.auth.getUser();
    if (!user) return {supabase: null, error: NextResponse.json({error: "Authentication required."}, {status: 401})};

    return {supabase, error: null};
}

export async function POST(request: Request) {
    const {supabase, error} = await getAuthenticatedClient();
    if (error || !supabase) return error;

    const body = await request.json().catch(() => ({}));
    const captureIds = Array.isArray(body.captureIds)
        ? body.captureIds.map((value: unknown) => String(value).trim()).filter(Boolean)
        : [];
    const listedPrice = Math.trunc(Number(body.listedPrice ?? 25));

    if (captureIds.length !== 10) {
        return NextResponse.json({error: "Select exactly 10 captures."}, {status: 400});
    }

    if (!Number.isFinite(listedPrice) || listedPrice < 5 || listedPrice > 5000) {
        return NextResponse.json({error: "Pack price must stay between 5 and 5000 credits."}, {status: 400});
    }

    const {data, error: rpcError} = await supabase.rpc("create_animal_pack", {
        p_capture_ids: captureIds,
        p_listed_price: listedPrice
    });

    if (rpcError) {
        return NextResponse.json({error: friendlyPackError(rpcError)}, {status: 400});
    }

    const row = Array.isArray(data) ? data[0] as MutationRow | undefined : data as MutationRow | null;
    const packId = row?.pack_id;
    const pack = packId ? await getTrainAnimalPackById(packId) : null;

    if (!pack) {
        return NextResponse.json({error: "The pack was created, but the updated pack could not be loaded."}, {status: 502});
    }

    return NextResponse.json({pack});
}

export async function PATCH(request: Request) {
    const {supabase, error} = await getAuthenticatedClient();
    if (error || !supabase) return error;

    const body = await request.json().catch(() => ({}));
    const packId = String(body.packId ?? "").trim();
    const action = String(body.action ?? "").trim();

    if (!packId) return NextResponse.json({error: "Pack is required."}, {status: 400});

    if (action === "cancel") {
        const {data, error: rpcError} = await supabase.rpc("cancel_animal_pack", {
            p_pack_id: packId
        });

        if (rpcError) return NextResponse.json({error: friendlyPackError(rpcError)}, {status: 400});

        const row = Array.isArray(data) ? data[0] as MutationRow | undefined : data as MutationRow | null;
        const pack = row?.pack_id ? await getTrainAnimalPackById(row.pack_id) : null;

        return NextResponse.json({pack});
    }

    if (action === "open") {
        const {data, error: rpcError} = await supabase.rpc("open_animal_pack", {
            p_pack_id: packId
        });

        if (rpcError) return NextResponse.json({error: friendlyPackError(rpcError)}, {status: 400});

        const row = Array.isArray(data) ? data[0] as OpenRow | undefined : data as OpenRow | null;
        const updatedPackId = row?.pack_id ?? packId;
        const captureIds = Array.isArray(row?.capture_ids) ? row?.capture_ids ?? [] : [];
        const [pack, captures] = await Promise.all([
            getTrainAnimalPackById(updatedPackId),
            getTrainPackCapturesByIds(captureIds)
        ]);

        return NextResponse.json({pack, captures});
    }

    return NextResponse.json({error: "Unsupported pack action."}, {status: 400});
}
