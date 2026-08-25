import "server-only";

import {getSupabaseHeaders, getSupabaseServerReadKey, getSupabaseUrl} from "@/lib/supabase-http";

export type ComparisonVoteSide = "animalA" | "animalB";

export type ComparisonVoteTally = {
    animalAVotes: number;
    animalBVotes: number;
    totalVotes: number;
};

export type ComparisonComment = {
    id: string;
    body: string;
    createdAt: string;
    authorName: string;
    authorUsername: string | null;
    authorAvatarUrl: string | null;
    isOwn: boolean;
};

export const EMPTY_VOTE_TALLY: ComparisonVoteTally = {
    animalAVotes: 0,
    animalBVotes: 0,
    totalVotes: 0
};

export const COMMENT_MAX_LENGTH = 2000;
export const COMMENT_MIN_LENGTH = 2;
const COMMENT_PAGE_SIZE = 50;

type VoteTallyRow = {
    comparison_slug: string;
    animal_a_votes: number;
    animal_b_votes: number;
    total_votes: number;
};

type CommentRow = {
    id: string;
    user_id: string;
    body: string;
    created_at: string;
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
};

function getReadConfig() {
    const supabaseUrl = getSupabaseUrl();
    const key = getSupabaseServerReadKey();
    if (!supabaseUrl || !key) return null;
    return {supabaseUrl, key};
}

/**
 * Comment bodies are rendered into public HTML, so strip anything link-shaped
 * before it is stored. Spam value drops sharply without a clickable payload.
 */
export function sanitizeCommentBody(raw: string) {
    return raw
        .replace(/https?:\/\/\S+/gi, "")
        .replace(/\bwww\.\S+/gi, "")
        .replace(/<[^>]*>/g, "")
        .replace(/[ \t]+/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .trim()
        .slice(0, COMMENT_MAX_LENGTH);
}

export function isVoteSide(value: unknown): value is ComparisonVoteSide {
    return value === "animalA" || value === "animalB";
}

export async function fetchVoteTally(slug: string): Promise<ComparisonVoteTally> {
    const config = getReadConfig();
    if (!config) return EMPTY_VOTE_TALLY;

    const url = new URL(`${config.supabaseUrl}/rest/v1/comparison_vote_tallies_v1`);
    url.searchParams.set("select", "*");
    url.searchParams.set("comparison_slug", `eq.${slug}`);
    url.searchParams.set("limit", "1");

    const response = await fetch(url, {headers: getSupabaseHeaders(config.key), next: {revalidate: 60}});
    if (!response.ok) return EMPTY_VOTE_TALLY;

    const rows = (await response.json()) as VoteTallyRow[];
    const row = rows[0];
    if (!row) return EMPTY_VOTE_TALLY;

    return {
        animalAVotes: Number(row.animal_a_votes) || 0,
        animalBVotes: Number(row.animal_b_votes) || 0,
        totalVotes: Number(row.total_votes) || 0
    };
}

export async function fetchViewerVote(
    slug: string,
    viewer: {userId?: string | null; guestKey?: string | null}
): Promise<ComparisonVoteSide | null> {
    const config = getReadConfig();
    if (!config) return null;
    if (!viewer.userId && !viewer.guestKey) return null;

    const url = new URL(`${config.supabaseUrl}/rest/v1/comparison_votes`);
    url.searchParams.set("select", "side");
    url.searchParams.set("comparison_slug", `eq.${slug}`);
    url.searchParams.set("limit", "1");

    if (viewer.userId) {
        url.searchParams.set("user_id", `eq.${viewer.userId}`);
    } else {
        url.searchParams.set("guest_key", `eq.${viewer.guestKey}`);
        url.searchParams.set("user_id", "is.null");
    }

    const response = await fetch(url, {headers: getSupabaseHeaders(config.key), cache: "no-store"});
    if (!response.ok) return null;

    const rows = (await response.json()) as Array<{side: string}>;
    return isVoteSide(rows[0]?.side) ? rows[0].side : null;
}

export async function fetchComparisonComments(
    slug: string,
    viewerUserId?: string | null,
    limit = COMMENT_PAGE_SIZE
): Promise<ComparisonComment[]> {
    const config = getReadConfig();
    if (!config) return [];

    const url = new URL(`${config.supabaseUrl}/rest/v1/comparison_comments_public_v1`);
    url.searchParams.set("select", "id,user_id,body,created_at,username,display_name,avatar_url");
    url.searchParams.set("comparison_slug", `eq.${slug}`);
    url.searchParams.set("order", "created_at.desc");
    url.searchParams.set("limit", String(Math.max(1, Math.min(COMMENT_PAGE_SIZE, limit))));

    const response = await fetch(url, {headers: getSupabaseHeaders(config.key), next: {revalidate: 60}});
    if (!response.ok) return [];

    const rows = (await response.json()) as CommentRow[];
    return rows.map((row) => ({
        id: row.id,
        body: row.body,
        createdAt: row.created_at,
        authorName: row.display_name?.trim() || row.username?.trim() || "AnimalDex reader",
        authorUsername: row.username?.trim() || null,
        authorAvatarUrl: row.avatar_url?.trim() || null,
        isOwn: Boolean(viewerUserId && row.user_id === viewerUserId)
    }));
}

export function voteSharePercentages(tally: ComparisonVoteTally) {
    if (tally.totalVotes <= 0) return {animalA: 0, animalB: 0};
    const animalA = Math.round((tally.animalAVotes / tally.totalVotes) * 100);
    return {animalA, animalB: 100 - animalA};
}
