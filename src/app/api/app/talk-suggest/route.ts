import {NextResponse} from "next/server";
import {invokeAuthenticatedSupabaseFunctionResponse} from "@/lib/supabase/app-functions";
import {debateSpeciesSlugs} from "@/data/debates";
import {talkAnimalsForSpeciesProfiles} from "@/data/talk-animals";
import {frontDoorText} from "@/lib/talk-front-door";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The Talk front door's suggestion (AnimalDex docs/talk-front-door/SPEC.md,
 * section 6.1), as the signed-in reader: `generate-applied-insight` with
 * `mode: "talk_suggest"` and their own session, as the debates' "Fits this
 * best" is asked. It never writes to a conversation and never takes a chat
 * message; the server caps it per day.
 *
 * POST {text, include_wild, exclude_species}
 *   200 {ok: true, suggestion}: the server's answer, each candidate with the
 *       `slug` its face and its chat use (the Talk catalog's, else the
 *       species' icon-art slug).
 *   Anything else carries the server's status and error (401 invalid_token,
 *   400 invalid_request, 403 age_restricted, 409 feature_paused): the box
 *   keeps the animal it has, with no message.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PRIVATE = {"Cache-Control": "private, no-store"};

function refuse(error: string, status: number) {
    return NextResponse.json({ok: false, error}, {status, headers: PRIVATE});
}

type RawCandidate = Record<string, unknown> & {species_profile_id?: unknown};

function isCandidate(value: unknown): value is RawCandidate {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function speciesOf(candidate: RawCandidate): string | null {
    return typeof candidate.species_profile_id === "string" && UUID.test(candidate.species_profile_id) ? candidate.species_profile_id.toLowerCase() : null;
}

/** Each candidate's chat slug: the Talk catalog's when it has the species, else its icon-art slug. */
async function withSlugs(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    const all = [payload.pick, ...(Array.isArray(payload.also) ? payload.also : []), ...(Array.isArray(payload.candidates) ? payload.candidates : [])]
        .filter(isCandidate);
    const ids = Array.from(new Set(all.map(speciesOf).filter((id): id is string => id !== null)));
    if (ids.length === 0) return payload;
    const catalog = await talkAnimalsForSpeciesProfiles(ids).catch(() => new Map<string, {slug: string}>());
    const missing = ids.filter((id) => !catalog.has(id));
    const identity = missing.length > 0 ? await debateSpeciesSlugs(missing) : new Map<string, string>();
    const slugFor = (candidate: unknown) => {
        if (!isCandidate(candidate)) return candidate;
        const id = speciesOf(candidate);
        const slug = id ? catalog.get(id)?.slug ?? identity.get(id) ?? null : null;
        return {...candidate, slug};
    };
    return {
        ...payload,
        pick: payload.pick ? slugFor(payload.pick) : null,
        also: Array.isArray(payload.also) ? payload.also.map(slugFor) : [],
        candidates: Array.isArray(payload.candidates) ? payload.candidates.map(slugFor) : []
    };
}

export async function POST(request: Request) {
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    const text = typeof body?.text === "string" ? frontDoorText(body.text) : "";
    if (!text) return refuse("invalid_request", 400);
    const exclude = (body && Array.isArray(body.exclude_species) ? body.exclude_species as unknown[] : [])
        .filter((id): id is string => typeof id === "string" && UUID.test(id))
        .map((id) => id.toLowerCase())
        .slice(0, 40);

    let invoked: Awaited<ReturnType<typeof invokeAuthenticatedSupabaseFunctionResponse>>;
    try {
        invoked = await invokeAuthenticatedSupabaseFunctionResponse("generate-applied-insight", {
            mode: "talk_suggest",
            talk_suggest: {text, include_wild: body?.include_wild === true, exclude_species: exclude}
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : "";
        return /authentication required/i.test(message) ? refuse("invalid_token", 401) : refuse("unavailable", 503);
    }
    if (!invoked.ok || !invoked.payload || typeof invoked.payload !== "object") {
        const error = typeof invoked.payload?.error === "string" ? invoked.payload.error : "unavailable";
        return refuse(error, invoked.status >= 400 ? invoked.status : 502);
    }
    return NextResponse.json({ok: true, suggestion: await withSlugs(invoked.payload as Record<string, unknown>)}, {headers: PRIVATE});
}
