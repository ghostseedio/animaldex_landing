import {NextResponse} from "next/server";
import {createSupabaseServerClient} from "@/lib/supabase/server";
import {isUuid, sanitizeGuidePatch, sanitizeSpeciesPatch} from "@/lib/virtual-wildlife-guides";

const NO_STORE = {"Cache-Control": "private, no-store"};

function failure(message: string, status = 400) {
    return NextResponse.json({error: message}, {status, headers: NO_STORE});
}

/** Server error codes, as plain sentences for the editor. */
function readableError(message: string) {
    if (/guide_not_found/.test(message)) return "This guide is no longer available.";
    if (/species_not_on_guide/.test(message)) return "That animal is not on this guide.";
    if (/note_length/.test(message)) return "A note can be at most 1,000 characters.";
    if (/auth_required/.test(message)) return "Sign in to edit your guides.";
    return message;
}

async function signedIn() {
    const supabase = createSupabaseServerClient();
    if (!supabase) return {error: failure("Supabase is not configured.", 503)} as const;
    const {data: {user}} = await supabase.auth.getUser();
    if (!user) return {error: failure("Authentication required.", 401)} as const;
    return {supabase} as const;
}

export async function GET(request: Request, {params}: {params: {id: string}}) {
    if (!isUuid(params.id)) return failure("Guide not found.", 404);
    const supabase = createSupabaseServerClient();
    if (!supabase) return failure("Supabase is not configured.", 503);
    const owner = new URL(request.url).searchParams.get("owner") === "1";
    let data: unknown = null;
    if (owner) {
        const {data: {user}} = await supabase.auth.getUser();
        if (!user) return failure("Authentication required.", 401);
        const {data: mine, error} = await supabase.rpc("get_my_wildlife_guide", {p_listing_id: params.id});
        if (error) return failure(readableError(error.message));
        data = mine;
    } else {
        // With a session this is the viewer's version: their purchase, and the
        // notes and contacts when they bought it.
        const {data: guide, error} = await supabase.rpc("get_public_wildlife_guide", {p_listing_id: params.id});
        if (error) return failure(readableError(error.message));
        data = guide;
        if (!data) {
            // A buyer can always reopen a guide the author later paused.
            const {data: {user}} = await supabase.auth.getUser();
            if (user) {
                const {data: bought} = await supabase.rpc("get_bought_wildlife_guide", {p_listing_id: params.id});
                data = bought;
            }
        }
    }
    if (!data) return failure("Guide not found.", 404);
    return NextResponse.json({guide: data}, {headers: NO_STORE});
}

/**
 * One of three edits, by body shape:
 * - `{speciesProfileId, hidden?, note?}`: show/hide an animal, or set its note
 *   (`note: null` or "" clears it and brings back the draft);
 * - `{mediaId, hidden}`: show/hide a photo;
 * - otherwise the guide's own fields, only the ones that changed.
 */
export async function PATCH(request: Request, {params}: {params: {id: string}}) {
    if (!isUuid(params.id)) return failure("Guide not found.", 404);
    const auth = await signedIn();
    if ("error" in auth) return auth.error;
    const {supabase} = auth;
    const input = await request.json().catch(() => null) as Record<string, unknown> | null;
    if (!input || typeof input !== "object" || Array.isArray(input)) return failure("Send the guide changes as JSON.");

    if (input.speciesProfileId !== undefined) {
        if (typeof input.speciesProfileId !== "string" || !isUuid(input.speciesProfileId)) return failure("Unknown animal.");
        const {speciesProfileId, ...rest} = input;
        const result = sanitizeSpeciesPatch(rest);
        if ("error" in result) return failure(result.error);
        const {data, error} = await supabase.rpc("update_my_wildlife_guide_species", {
            p_listing_id: params.id,
            p_species_profile_id: speciesProfileId,
            p_patch: result.patch
        });
        if (error) return failure(readableError(error.message));
        return NextResponse.json({guide: data}, {headers: NO_STORE});
    }

    if (input.mediaId !== undefined) {
        if (typeof input.mediaId !== "string" || !isUuid(input.mediaId)) return failure("Unknown photo.");
        if (typeof input.hidden !== "boolean") return failure("hidden must be true or false.");
        const {data, error} = await supabase.rpc("update_my_wildlife_guide_media", {
            p_listing_id: params.id,
            p_media_id: input.mediaId,
            p_patch: {hidden: input.hidden}
        });
        if (error) return failure(readableError(error.message));
        return NextResponse.json({guide: data}, {headers: NO_STORE});
    }

    const result = sanitizeGuidePatch(input);
    if ("error" in result) return failure(result.error);
    const {data, error} = await supabase.rpc("update_my_wildlife_guide", {p_listing_id: params.id, p_patch: result.patch});
    if (error) return failure(readableError(error.message));
    if (!data) return failure("Guide not found.", 404);
    return NextResponse.json({guide: data}, {headers: NO_STORE});
}

export async function DELETE(_request: Request, {params}: {params: {id: string}}) {
    if (!isUuid(params.id)) return failure("Guide not found.", 404);
    const auth = await signedIn();
    if ("error" in auth) return auth.error;
    const {error} = await auth.supabase.rpc("delete_my_wildlife_guide", {p_listing_id: params.id});
    if (error) return failure(readableError(error.message));
    return NextResponse.json({ok: true}, {headers: NO_STORE});
}
