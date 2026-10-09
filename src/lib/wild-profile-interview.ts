import "server-only";
import type {SupabaseClient} from "@supabase/supabase-js";
import {invokeAuthenticatedSupabaseFunctionResponse} from "@/lib/supabase/app-functions";
import type {WildProfileNextResponse, WildProfileSession} from "@/lib/wild-profile-interview-types";

/**
 * Web side of the Wild Profile interview. Every step mirrors
 * SupabaseIdentityProfileService.swift in the iOS repo so both clients drive
 * the same sessions, answers and edge functions.
 */

const SESSION_SELECT = "id,user_id,status,schema_version,started_at,completed_at,generation_error,created_at,updated_at";
const OPEN_SESSION_STATUSES = ["in_progress", "ready_for_generation", "generating"];
// identity-interview-next keeps the first 1200 characters of an answer.
export const WILD_PROFILE_ANSWER_MAX_LENGTH = 1200;
const GENERATE_TIMEOUT_MS = 240_000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class WildProfileInterviewError extends Error {
    constructor(message: string, readonly status = 500) {
        super(message);
    }
}

export function isUuid(value: unknown): value is string {
    return typeof value === "string" && UUID_PATTERN.test(value);
}

function functionErrorMessage(payload: any, fallback: string) {
    const message = typeof payload?.message === "string" ? payload.message : null;
    const error = typeof payload?.error === "string" ? payload.error : null;
    return message || error || fallback;
}

export async function fetchOpenWildProfileSession(supabase: SupabaseClient, userId: string): Promise<WildProfileSession | null> {
    const {data, error} = await supabase
        .from("identity_questionnaire_sessions")
        .select(SESSION_SELECT)
        .eq("user_id", userId)
        .in("status", OPEN_SESSION_STATUSES)
        .order("created_at", {ascending: false})
        .limit(1);
    if (error) throw new WildProfileInterviewError(error.message);
    return (data?.[0] as WildProfileSession | undefined) ?? null;
}

async function ensureDefaultPrivacySettings(supabase: SupabaseClient, userId: string) {
    const {data, error} = await supabase
        .from("identity_privacy_settings")
        .select("user_id")
        .eq("user_id", userId)
        .limit(1);
    if (error || (data ?? []).length > 0) return;

    await supabase.from("identity_privacy_settings").insert({
        user_id: userId,
        show_origin_publicly: false,
        show_apex_publicly: false,
        show_active_publicly: false,
        show_summary_publicly: false,
        allow_collection_evidence: true,
        allow_journal_evidence: true,
        allow_mission_evidence: false
    });
}

export async function startWildProfileSession(supabase: SupabaseClient, userId: string): Promise<WildProfileSession> {
    // iOS treats this as best effort (`try?`), so a failure here never blocks the interview.
    await ensureDefaultPrivacySettings(supabase, userId).catch(() => undefined);

    const existing = await fetchOpenWildProfileSession(supabase, userId);
    if (existing) return existing;

    const {data, error} = await supabase
        .from("identity_questionnaire_sessions")
        .insert({user_id: userId, status: "in_progress", schema_version: "identity_phase1_v1"})
        .select(SESSION_SELECT)
        .single();
    if (error || !data) throw new WildProfileInterviewError(error?.message ?? "We couldn't start your Wild Profile interview.");
    return data as WildProfileSession;
}

export async function fetchNextWildProfileQuestion(sessionId: string): Promise<WildProfileNextResponse> {
    const invoked = await invokeAuthenticatedSupabaseFunctionResponse("identity-interview-next", {session_id: sessionId});
    if (!invoked.ok) {
        throw new WildProfileInterviewError(
            functionErrorMessage(invoked.payload, "We couldn't prepare your next Wild Profile question. Please try again."),
            invoked.status === 409 ? 409 : 502
        );
    }
    return invoked.payload as WildProfileNextResponse;
}

export async function saveWildProfileAnswer(
    supabase: SupabaseClient,
    userId: string,
    answer: {sessionId: string; questionId: string; freeText: string | null; skipped: boolean}
) {
    const freeText = answer.skipped ? null : (answer.freeText ?? "").trim().slice(0, WILD_PROFILE_ANSWER_MAX_LENGTH) || null;
    const {error} = await supabase
        .from("identity_questionnaire_answers")
        .upsert({
            session_id: answer.sessionId,
            question_id: answer.questionId,
            user_id: userId,
            selected_option_ids: [],
            free_text: freeText,
            skipped: answer.skipped,
            option_weight_map: {},
            client_context: null
        }, {onConflict: "session_id,question_id"});
    if (error) throw new WildProfileInterviewError(error.message);
}

async function findGeneratedProfile(supabase: SupabaseClient, userId: string, sessionId: string) {
    const {data} = await supabase
        .from("user_identity_profiles")
        .select("id,session_id")
        .eq("user_id", userId)
        .eq("status", "active")
        .order("generated_at", {ascending: false})
        .limit(1);
    const latest = data?.[0] as {id: string; session_id: string | null} | undefined;
    return latest?.session_id === sessionId ? latest : null;
}

/** Mirrors iOS waitForGeneratedIdentityProfile: 8 checks, 3 seconds apart. */
async function waitForGeneratedProfile(supabase: SupabaseClient, userId: string, sessionId: string) {
    for (let attempt = 0; attempt < 8; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 3_000));
        if (await findGeneratedProfile(supabase, userId, sessionId).catch(() => null)) return true;
    }
    return false;
}

export async function generateWildProfile(supabase: SupabaseClient, userId: string, sessionId: string) {
    let invoked: Awaited<ReturnType<typeof invokeAuthenticatedSupabaseFunctionResponse>> | null = null;
    try {
        invoked = await Promise.race([
            invokeAuthenticatedSupabaseFunctionResponse("generate-identity-profile", {session_id: sessionId}),
            new Promise<null>((resolve) => setTimeout(() => resolve(null), GENERATE_TIMEOUT_MS))
        ]);
    } catch {
        invoked = null;
    }

    if (invoked?.ok) return;

    // A timeout or gateway error can still finish server-side; look for the profile before failing.
    if (!invoked || invoked.status >= 500) {
        if (await waitForGeneratedProfile(supabase, userId, sessionId)) return;
    }
    if (!invoked) {
        throw new WildProfileInterviewError("Wild Profile is taking longer than usual. Please try Generate again in a moment.", 504);
    }
    throw new WildProfileInterviewError(
        functionErrorMessage(invoked.payload, "We couldn't generate your Wild Profile. Please try again."),
        invoked.status >= 500 ? 502 : invoked.status
    );
}

export async function resetWildProfileSessions(supabase: SupabaseClient, userId: string) {
    const {error} = await supabase
        .from("identity_questionnaire_sessions")
        .update({status: "abandoned", abandoned_at: new Date().toISOString(), generation_error: null})
        .eq("user_id", userId)
        .in("status", OPEN_SESSION_STATUSES);
    if (error) throw new WildProfileInterviewError(error.message);
}
