import "server-only";

import {mapAppNotificationRows, type AppNotification} from "@/data/authenticated-app";
import {createSupabaseServerClient} from "@/lib/supabase/server";
import {isListedNotification, NOTIFICATION_PAGE_SIZE, type NotificationFilter} from "@/lib/notification-presentation";

/**
 * One page of the reader's notifications, read as iOS reads them: the
 * server-side filter (`list_user_notifications`, AnimalDex 20260830120000),
 * offset paging, and what the rows need besides: the faces of the people in
 * them, whom the reader already follows (Follow back), and the names of the
 * reader's own animals they are about. Every read is the reader's own (RLS).
 */

type QueryRow = Record<string, any>;

export type NotificationActor = {userId: string; displayName: string | null; username: string | null; avatarUrl: string | null};

export type NotificationPage = {
    items: AppNotification[];
    hasMore: boolean;
    actors: Record<string, NotificationActor>;
    followingIds: string[];
    /** The reader's own capture id → its animal, for like, endorsement, Gift and rating rows. */
    animalNames: Record<string, string>;
};

const OWN_CAPTURE_EVENTS = new Set([
    "first_like_on_capture", "like_milestone_5", "like_milestone_10", "like_milestone_25",
    "capture_endorsed", "capture_gift_received", "capture_community_rating"
]);

export async function getNotificationsPage(
    filter: NotificationFilter,
    offset = 0,
    limit = NOTIFICATION_PAGE_SIZE
): Promise<{ok: true; value: NotificationPage} | {ok: false; status: number}> {
    const supabase = createSupabaseServerClient();
    if (!supabase) return {ok: false, status: 503};
    const {data: {user}} = await supabase.auth.getUser();
    if (!user) return {ok: false, status: 401};

    const {data, error} = await supabase.rpc("list_user_notifications", {
        p_limit: Math.max(1, Math.min(limit, 100)),
        p_offset: Math.max(0, Math.min(offset, 5000)),
        p_filter: filter
    });
    if (error) {
        console.warn("[notifications] list", error.message.slice(0, 200));
        return {ok: false, status: 400};
    }

    const rows = (Array.isArray(data) ? data : []) as QueryRow[];
    // A short page is the end, whether or not each of its rows is listed.
    const hasMore = rows.length >= limit;
    const items = mapAppNotificationRows(rows).filter(isListedNotification);

    const actorIds = Array.from(new Set(items.map((item) => item.actorUserId).filter((id): id is string => Boolean(id))));
    const captureIds = Array.from(new Set(items
        .filter((item) => item.captureId && OWN_CAPTURE_EVENTS.has(item.eventType))
        .map((item) => item.captureId as string)));

    const [profiles, follows, captures] = await Promise.all([
        actorIds.length
            ? supabase.from("profiles").select("id,display_name,username,avatar_url").in("id", actorIds)
            : Promise.resolve({data: [] as QueryRow[]}),
        actorIds.length
            ? supabase.from("user_follows").select("followed_id").eq("follower_id", user.id).in("followed_id", actorIds)
            : Promise.resolve({data: [] as QueryRow[]}),
        captureIds.length
            ? supabase.from("captures").select("id,analysis_results(animal_name)").eq("user_id", user.id).in("id", captureIds)
            : Promise.resolve({data: [] as QueryRow[]})
    ]);

    const actors: Record<string, NotificationActor> = {};
    for (const row of (profiles.data ?? []) as QueryRow[]) {
        if (typeof row.id !== "string") continue;
        actors[row.id] = {
            userId: row.id,
            displayName: typeof row.display_name === "string" && row.display_name.trim() ? row.display_name.trim() : null,
            username: typeof row.username === "string" && row.username.trim() ? row.username.trim() : null,
            avatarUrl: typeof row.avatar_url === "string" && row.avatar_url.trim() ? row.avatar_url.trim() : null
        };
    }

    const animalNames: Record<string, string> = {};
    for (const row of (captures.data ?? []) as QueryRow[]) {
        const analysis = Array.isArray(row.analysis_results) ? row.analysis_results[0] : row.analysis_results;
        const name = typeof analysis?.animal_name === "string" ? analysis.animal_name.trim() : "";
        if (typeof row.id === "string" && name) animalNames[row.id] = name;
    }

    return {
        ok: true,
        value: {
            items,
            hasMore,
            actors,
            followingIds: ((follows.data ?? []) as QueryRow[]).map((row) => row.followed_id).filter((id): id is string => typeof id === "string"),
            animalNames
        }
    };
}

/** One row read or unread (iOS `setReadState`): unread is a real place to park something. */
export async function setNotificationReadState(id: string, isRead: boolean): Promise<boolean> {
    const supabase = createSupabaseServerClient();
    if (!supabase) return false;
    const {data: {user}} = await supabase.auth.getUser();
    if (!user || !/^[0-9a-f-]{36}$/i.test(id)) return false;
    const {error} = await supabase
        .from("user_notifications")
        .update({read_at: isRead ? new Date().toISOString() : null})
        .eq("id", id)
        .eq("user_id", user.id);
    return !error;
}
