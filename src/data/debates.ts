import "server-only";
import {createSupabaseServerClient, createSupabaseServiceClient} from "@/lib/supabase/server";
import {
    decodeDebate,
    decodeDebates,
    type Debate,
    type DebateCandidate
} from "@/lib/debates";

/**
 * Debates on the server (docs/debates/SPEC.md, section 3), read as the
 * signed-in reader: the switch, their debates, one debate, the public roster
 * opt-in, and the debates in Discover. Each read fails soft: until the
 * migration is live, Debates are simply not there.
 */

type Supabase = NonNullable<ReturnType<typeof createSupabaseServerClient>>;

/**
 * `debates_enabled`, the server's switch (SPEC: `app_feature_flags`, or the
 * `arena_v2_config` row). Off when it cannot be read: a client never shows a
 * debate the server would refuse.
 */
export async function loadDebatesEnabled(): Promise<boolean> {
    const supabase = createSupabaseServerClient() ?? createSupabaseServiceClient();
    if (!supabase) return false;
    try {
        const viaRpc = await supabase.rpc("debates_enabled_v1");
        if (!viaRpc.error && typeof viaRpc.data === "boolean") return viaRpc.data;
        if (!viaRpc.error && viaRpc.data && typeof viaRpc.data === "object" && "debates_enabled" in viaRpc.data) {
            return (viaRpc.data as {debates_enabled?: unknown}).debates_enabled === true;
        }
    } catch {
        // Try the flag rows below.
    }
    for (const table of ["app_feature_flags", "arena_v2_config"]) {
        try {
            const {data, error} = await supabase.from(table).select("debates_enabled").limit(1).maybeSingle();
            if (!error && data && typeof (data as {debates_enabled?: unknown}).debates_enabled === "boolean") {
                return (data as {debates_enabled: boolean}).debates_enabled;
            }
        } catch {
            // Next.
        }
    }
    return false;
}

/** The icon art is filed by the species' identity key, written with hyphens. */
export async function debateSpeciesSlugs(ids: string[]): Promise<Map<string, string>> {
    const service = createSupabaseServiceClient();
    const wanted = Array.from(new Set(ids.filter(Boolean))).slice(0, 200);
    if (!service || wanted.length === 0) return new Map();
    try {
        const {data} = await service.from("species_profiles").select("id, normalized_identity_key").in("id", wanted);
        return new Map((data ?? []).flatMap((row) => {
            const key = typeof row.normalized_identity_key === "string" ? row.normalized_identity_key.trim() : "";
            return key ? [[String(row.id).toLowerCase(), key.toLowerCase().replace(/_/g, "-")] as [string, string]] : [];
        }));
    } catch {
        return new Map();
    }
}

/** Every animal's face is its species' icon art: the slug, where the RPC did not send one. */
export async function withDebateSlugs(debates: Debate[]): Promise<Debate[]> {
    const missing = debates.flatMap((debate) => debate.participants.filter((participant) => !participant.slug && participant.speciesProfileId).map((participant) => participant.speciesProfileId!));
    if (missing.length === 0) return debates;
    const slugs = await debateSpeciesSlugs(missing);
    return debates.map((debate) => ({
        ...debate,
        participants: debate.participants.map((participant) => participant.slug || !participant.speciesProfileId
            ? participant
            : {...participant, slug: slugs.get(participant.speciesProfileId) ?? null})
    }));
}

export async function withCandidateSlugs(candidates: DebateCandidate[]): Promise<DebateCandidate[]> {
    const missing = candidates.flatMap((candidate) => (!candidate.slug && candidate.speciesProfileId ? [candidate.speciesProfileId] : []));
    if (missing.length === 0) return candidates;
    const slugs = await debateSpeciesSlugs(missing);
    return candidates.map((candidate) => candidate.slug || !candidate.speciesProfileId
        ? candidate
        : {...candidate, slug: slugs.get(candidate.speciesProfileId) ?? null});
}

/** `my_debates_v1`: where the reader is the asker or an owner. Null when it cannot be read. */
export async function readMyDebates(supabase: Supabase): Promise<Debate[] | null> {
    const {data, error} = await supabase.rpc("my_debates_v1");
    if (error) {
        console.warn("[debates] my_debates_v1 failed", error.message.slice(0, 200));
        return null;
    }
    return withDebateSlugs(decodeDebates(data));
}

/** `debate_v1`: one debate as the reader may see it. */
export async function readDebate(supabase: Supabase, debateId: string): Promise<{debate: Debate | null; error: string | null}> {
    const {data, error} = await supabase.rpc("debate_v1", {p_debate_id: debateId});
    if (error) return {debate: null, error: error.message};
    const debate = decodeDebate(data);
    if (!debate) return {debate: null, error: "not_found"};
    const [withSlugs] = await withDebateSlugs([debate]);
    return {debate: withSlugs, error: null};
}

/**
 * Whether the reader's animals may join public debates (off by default).
 * Read through `debate_roster_v1`, else their own `debate_roster_settings`
 * row; null when neither can be read.
 */
export async function readRosterOptIn(supabase: Supabase): Promise<boolean | null> {
    try {
        const viaRpc = await supabase.rpc("debate_roster_v1");
        if (!viaRpc.error) {
            if (typeof viaRpc.data === "boolean") return viaRpc.data;
            const row = viaRpc.data && typeof viaRpc.data === "object" ? viaRpc.data as Record<string, unknown> : null;
            if (row && "opted_in" in row) return row.opted_in === true;
        }
    } catch {
        // The row below.
    }
    try {
        const {data: {user}} = await supabase.auth.getUser();
        if (!user) return null;
        const {data, error} = await supabase.from("debate_roster_settings").select("opted_in").eq("user_id", user.id).maybeSingle();
        if (error) return null;
        return data?.opted_in === true;
    } catch {
        return null;
    }
}

/** For a server page: the switch, and the reader's debates (empty when off or unreadable). */
export async function getMyDebatesPage(): Promise<{enabled: boolean; debates: Debate[]; available: boolean}> {
    const enabled = await loadDebatesEnabled();
    if (!enabled) return {enabled, debates: [], available: false};
    const supabase = createSupabaseServerClient();
    if (!supabase) return {enabled, debates: [], available: false};
    const debates = await readMyDebates(supabase);
    return {enabled, debates: debates ?? [], available: debates !== null};
}

export async function getDebateForViewer(debateId: string): Promise<Debate | null> {
    const supabase = createSupabaseServerClient();
    if (!supabase) return null;
    const {debate} = await readDebate(supabase, debateId);
    return debate;
}

/**
 * Public debates for the Discover feed (`discover_debates_v1`): open for
 * votes and finished, each as `debate_v1` shapes it for this viewer (their
 * vote, `can_vote`), boosted ones flagged. Private debates never appear.
 */
export async function getDiscoverDebates(limit = 12): Promise<Debate[]> {
    if (!(await loadDebatesEnabled())) return [];
    const supabase = createSupabaseServerClient();
    if (!supabase) return [];
    try {
        const {data, error} = await supabase.rpc("discover_debates_v1", {p_limit: limit});
        if (error) {
            if (error.code !== "PGRST202") console.warn("[debates] discover_debates_v1 failed", error.message.slice(0, 200));
            return [];
        }
        return withDebateSlugs(decodeDebates(data).filter((debate) => debate.visibility === "public"));
    } catch {
        return [];
    }
}
