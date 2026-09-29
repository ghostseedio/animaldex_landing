import "server-only";

import {wildProfileSummary} from "@/lib/ask-animaldex/wild-profile";
import {createSupabaseServerClient} from "@/lib/supabase/server";

export type AskWildProfile = {
    hasWildProfile: boolean;
    summary: string | null;
};

const NONE: AskWildProfile = {hasWildProfile: false, summary: null};

/**
 * The signed-in reader's own active Wild Profile, read with their session.
 *
 * Read server-side from the row rather than taken from the request: a client
 * that could post its own summary could put any sentence it liked into the
 * prompt under a heading the model is told to trust.
 */
export async function getAskWildProfile(userId: string | null): Promise<AskWildProfile> {
    if (!userId) return NONE;

    const supabase = createSupabaseServerClient();
    if (!supabase) return NONE;

    const {data, error} = await supabase
        .from("user_identity_profiles")
        .select("id,private_report")
        .eq("user_id", userId)
        .eq("status", "active")
        .order("generated_at", {ascending: false})
        .limit(1)
        .maybeSingle();

    if (error || !data?.id) return NONE;

    return {hasWildProfile: true, summary: wildProfileSummary(data.private_report)};
}
