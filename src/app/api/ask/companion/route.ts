import {NextResponse} from "next/server";

/**
 * The companion loop with one of the reader's own animals: what it is helping
 * them with, and the step it set on it (AnimalDex 20261028120000).
 *
 * GET ?speciesProfileId= reads `animal_companion_focus_v1`; POST
 * {action: "clear", speciesProfileId} is "Not this any more", which clears the
 * focus and the step on it through `clear_animal_companion_focus_v1`. Both run
 * as the reader, scoped to auth.uid() by the RPCs themselves. Signed-out
 * readers have no loop and get a 401.
 */

import {ASK_RESPONSE_HEADERS, resolveAskViewer} from "@/lib/ask-animaldex/request";
import {parseCompanionFocus} from "@/lib/ask-animaldex/companion-loop";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function speciesId(raw: unknown): string | null {
    const value = typeof raw === "string" ? raw.trim() : "";
    return UUID_PATTERN.test(value) ? value.toLowerCase() : null;
}

export async function GET(request: Request) {
    const viewer = await resolveAskViewer(request);
    if (!viewer.signedIn || !viewer.client) return signedOut();
    const speciesProfileId = speciesId(new URL(request.url).searchParams.get("speciesProfileId"));
    if (!speciesProfileId) return speciesRequired();
    const {data, error} = await viewer.client.rpc("animal_companion_focus_v1", {p_species_profile_id: speciesProfileId});
    if (error) return failed(error.message);
    return NextResponse.json({ok: true, loop: parseCompanionFocus(data)}, {headers: ASK_RESPONSE_HEADERS});
}

export async function POST(request: Request) {
    const viewer = await resolveAskViewer(request);
    if (!viewer.signedIn || !viewer.client) return signedOut();

    let body: Record<string, unknown>;
    try {
        body = await request.json() as Record<string, unknown>;
    } catch {
        body = {};
    }

    if (body.action !== "clear") {
        return NextResponse.json({ok: false, error: "unknown_action"}, {status: 400, headers: ASK_RESPONSE_HEADERS});
    }
    const speciesProfileId = speciesId(body.speciesProfileId);
    if (!speciesProfileId) return speciesRequired();
    const {data, error} = await viewer.client.rpc("clear_animal_companion_focus_v1", {p_species_profile_id: speciesProfileId});
    if (error) return failed(error.message);
    // False is "nothing was there to clear", which is still cleared.
    return NextResponse.json({ok: true, cleared: data === true}, {headers: ASK_RESPONSE_HEADERS});
}

function signedOut() {
    return NextResponse.json({ok: false, error: "sign_in_required"}, {status: 401, headers: ASK_RESPONSE_HEADERS});
}

function speciesRequired() {
    return NextResponse.json({ok: false, error: "species_required"}, {status: 400, headers: ASK_RESPONSE_HEADERS});
}

function failed(message: string) {
    console.warn("[ask-animaldex] companion request failed", message.slice(0, 200));
    return NextResponse.json({ok: false, error: "companion_unavailable"}, {status: 502, headers: ASK_RESPONSE_HEADERS});
}
