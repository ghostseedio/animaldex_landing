import {NextResponse} from "next/server";
import {mapOwnedGuideListing} from "@/lib/guide-marketplace-seller";
import {isUuid} from "@/lib/guide-marketplace-admin";
import {createSupabaseServerClient} from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
    const supabase = createSupabaseServerClient();
    if (!supabase) {
        return NextResponse.json({ok: false, error: "Supabase is not configured."}, {status: 503});
    }

    const {data: {user}} = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.json({ok: false, error: "Authentication required."}, {status: 401});
    }

    const formData = await request.formData();
    const listingId = String(formData.get("listingId") ?? "");
    const file = formData.get("file");

    if (!isUuid(listingId)) {
        return NextResponse.json({ok: false, error: "Listing id is required."}, {status: 400});
    }
    if (!(file instanceof File) || file.size === 0) {
        return NextResponse.json({ok: false, error: "Cover image is required."}, {status: 400});
    }

    const owned = await supabase.from("guide_listings").select("id").eq("id", listingId).eq("seller_user_id", user.id).maybeSingle();
    if (owned.error || !owned.data) {
        return NextResponse.json({ok: false, error: "Listing not found."}, {status: 404});
    }

    const path = `${user.id.toLowerCase()}/${listingId.toLowerCase()}.jpg`;
    const bytes = Buffer.from(await file.arrayBuffer());
    const coverBucket = "guide-listing-covers";

    const upload = await supabase.storage.from(coverBucket).upload(path, bytes, {
        contentType: file.type || "image/jpeg",
        upsert: true,
        cacheControl: "3600"
    });
    if (upload.error) {
        return NextResponse.json({ok: false, error: upload.error.message}, {status: 400});
    }

    const {data: publicData} = supabase.storage.from(coverBucket).getPublicUrl(path);
    const coverUrl = `${publicData.publicUrl}?v=${Date.now()}`;

    const {data, error} = await supabase.rpc("set_guide_listing_cover", {
        p_listing_id: listingId,
        p_cover_image_url: coverUrl
    });
    if (error) {
        return NextResponse.json({ok: false, error: error.message}, {status: 400});
    }

    return NextResponse.json({ok: true, listing: mapOwnedGuideListing(data as Record<string, unknown>)});
}
