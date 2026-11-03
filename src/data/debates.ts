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
 * `debates_enabled`, the server's switch (`arena_v2_config.debates_enabled`,
 * read through `debates_config_v1()`, else `debates_enabled()`). Off when it
 * cannot be read: a client never shows a debate the server would refuse.
 */
export async function loadDebatesEnabled(): Promise<boolean> {
    const supabase = createSupabaseServerClient() ?? createSupabaseServiceClient();
    if (!supabase) return false;
    try {
        const config = await supabase.rpc("debates_config_v1");
        const row = !config.error && config.data && typeof config.data === "object" ? config.data as Record<string, unknown> : null;
        if (row && typeof row.debates_enabled === "boolean") return row.debates_enabled;
        const flag = await supabase.rpc("debates_enabled");
        if (!flag.error && typeof flag.data === "boolean") return flag.data;
    } catch {
        // Off, then.
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

/**
 * `my_debates_v1`: where the reader is the asker or an owner, newest first
 * (with `captureId`, only those that card of theirs was in). Null when it
 * cannot be read.
 */
export async function readMyDebates(supabase: Supabase, captureId: string | null = null): Promise<Debate[] | null> {
    const {data, error} = await supabase.rpc("my_debates_v1", captureId ? {p_capture_id: captureId} : {});
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
 * Whether the reader's animals may join public debates. On by default since
 * the owner's change of 2026-10-31: no `debate_roster_settings` row counts as
 * opted in, and only `opted_in = false` (the Settings switch turned off) is
 * out. Read through `debate_roster_v1`, else their own row; null when neither
 * can be read.
 */
export async function readRosterOptIn(supabase: Supabase): Promise<boolean | null> {
    try {
        const viaRpc = await supabase.rpc("debate_roster_v1");
        if (!viaRpc.error) {
            if (typeof viaRpc.data === "boolean") return viaRpc.data;
            const data = Array.isArray(viaRpc.data) ? viaRpc.data[0] : viaRpc.data;
            const row = data && typeof data === "object" ? data as Record<string, unknown> : null;
            if (row && "opted_in" in row) return row.opted_in !== false;
        }
    } catch {
        // The row below.
    }
    try {
        const {data: {user}} = await supabase.auth.getUser();
        if (!user) return null;
        const {data, error} = await supabase.from("debate_roster_settings").select("opted_in").eq("user_id", user.id).maybeSingle();
        if (error) return null;
        return data ? data.opted_in !== false : true;
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

/**
 * Someone's public debates, for their profile's Diary tab
 * (`public_debates_v1`, owner 2026-11-03): only those they asked in public,
 * in public words. Private debates are never listed. Readable signed out.
 */
export async function getPublicDebates(userId: string): Promise<Debate[]> {
    if (!(await loadDebatesEnabled())) return [];
    const supabase = createSupabaseServerClient() ?? createSupabaseServiceClient();
    if (!supabase) return [];
    try {
        const {data, error} = await supabase.rpc("public_debates_v1", {p_user_id: userId, p_limit: 50});
        if (error) return [];
        return withDebateSlugs(decodeDebates(data));
    } catch {
        return [];
    }
}

export async function getDebateForViewer(debateId: string): Promise<Debate | null> {
    const supabase = createSupabaseServerClient();
    if (!supabase) return null;
    const {debate} = await readDebate(supabase, debateId);
    return debate;
}

/**
 * Public debates for the Discover feed: the boosted ones pinned for this
 * viewer (`discover_debate_pinned_v1`: still short of votes, theirs to vote
 * on, at most two, fewest votes first), then the rest of the debate posts
 * (`discover_debate_timeline_v1`), newest first. Each row carries the
 * viewer's vote and whether they can vote. Private debates never appear.
 */
export async function getDiscoverDebates(limit = 12): Promise<Debate[]> {
    if (!(await loadDebatesEnabled())) return [];
    const supabase = createSupabaseServerClient();
    if (!supabase) return [];
    try {
        const [pinned, timeline] = await Promise.all([
            supabase.from("discover_debate_pinned_v1").select("*"),
            supabase.from("discover_debate_timeline_v1").select("*").order("created_at", {ascending: false}).limit(limit)
        ]);
        if (timeline.error) {
            console.warn("[debates] discover_debate_timeline_v1 failed", timeline.error.message.slice(0, 200));
            return [];
        }
        // The views hold public debates only (they carry no visibility column).
        const asPost = (debate: Debate): Debate => ({...debate, visibility: "public"});
        const pins = pinned.error ? [] : decodeDebates(pinned.data).map((debate) => ({...asPost(debate), boosted: true}));
        const pinIds = new Set(pins.map((debate) => debate.id));
        const rest = decodeDebates(timeline.data).filter((debate) => !pinIds.has(debate.id)).map(asPost);
        return withDebateSlugs([...pins, ...rest]);
    } catch {
        return [];
    }
}
