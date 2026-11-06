import "server-only";

import {createSignedStorageUrl} from "@/lib/capture-storage-image";
import {createSupabaseServerClient} from "@/lib/supabase/server";
import {
    NO_DIRECT_MESSAGE_SETTINGS,
    sortedInbox,
    type DirectMessage,
    type DirectMessageAttachment,
    type DirectMessageConversationSummary,
    type DirectMessageProfile,
    type DirectMessageSettings
} from "@/lib/direct-message-presentation";

export type {
    DirectMessage,
    DirectMessageAttachment,
    DirectMessageConversationSummary,
    DirectMessageProfile,
    DirectMessageSettings
} from "@/lib/direct-message-presentation";

/**
 * Messages v2 for the web, read and written exactly as iOS does
 * (`SupabaseDirectMessagesService`, AnimalDex 20261020230000), always as the
 * signed-in reader: the RPCs check `auth.uid()`, the tables answer through
 * RLS. Refusals come back as the SQL's own code ("pin_limit_reached"), which
 * the screens put into words (`directMessageKnownErrors`).
 */

type QueryRow = Record<string, unknown>;
type ServerClient = NonNullable<ReturnType<typeof createSupabaseServerClient>>;

export type DirectMessageResult<T> = {ok: true; value: T} | {ok: false; error: string; status: number};

export type DirectMessageThreadPage = {
    messages: DirectMessage[];
    hasMore: boolean;
    serverNow: string;
    partnerTyping: boolean;
    settings: DirectMessageSettings;
    /** The newest page only: where the unread run began before this read, and how long it was. */
    firstUnreadId: string | null;
    unreadCount: number;
};

export type DirectMessageThreadSync = {
    messages: DirectMessage[];
    serverNow: string;
    partnerTyping: boolean;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MESSAGE_COLUMNS = "id,sender_id,recipient_id,body,created_at,updated_at,delivered_at,read_at,deleted_at,attachment,photo_review";
const PROFILE_COLUMNS = "id,display_name,username,avatar_url,is_system";

/** The SQL refusals a screen can say in words; anything else is "our side". */
const KNOWN_CODES = new Set([
    "pin_limit_reached",
    "unsend_window_passed",
    "cannot_hide_system_conversation",
    "attachment_not_uploaded",
    "capture_not_shareable",
    "capture_not_found",
    "caption_too_long",
    "invalid_conversation",
    "message_not_found"
]);

export function isDirectMessageUserId(value: unknown): value is string {
    return typeof value === "string" && UUID.test(value.trim());
}

function readString(row: QueryRow | null | undefined, key: string) {
    const value = row?.[key];
    return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readNumber(row: QueryRow | null | undefined, key: string) {
    const value = row?.[key];
    const number = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
    return Number.isFinite(number) ? number : null;
}

function asRow(value: unknown): QueryRow | null {
    if (Array.isArray(value)) return (value[0] ?? null) as QueryRow | null;
    return value && typeof value === "object" ? value as QueryRow : null;
}

function failure(error: {message?: string; code?: string} | null | undefined, fallback = "send_failed"): {ok: false; error: string; status: number} {
    const message = error?.message?.trim() ?? "";
    if (KNOWN_CODES.has(message)) return {ok: false, error: message, status: 400};
    if (error?.code === "PGRST202" || /could not find the function/i.test(message)) return {ok: false, error: "settings_unavailable", status: 400};
    if (message === "invalid_token") return {ok: false, error: "unauthorized", status: 401};
    if (message) console.warn("[direct-messages]", fallback, message.slice(0, 200));
    return {ok: false, error: fallback, status: 400};
}

async function signedInClient(): Promise<{supabase: ServerClient; userId: string} | null> {
    const supabase = createSupabaseServerClient();
    if (!supabase) return null;
    const {data: {user}} = await supabase.auth.getUser();
    return user ? {supabase, userId: user.id} : null;
}

const NOT_SIGNED_IN = {ok: false as const, error: "unauthorized", status: 401};

export function mapDirectMessageProfile(row: QueryRow | null | undefined): DirectMessageProfile | null {
    const userId = readString(row, "id");
    if (!userId) return null;
    const username = readString(row, "username");
    const displayName = readString(row, "display_name");
    const isSystem = row?.is_system === true;
    return {
        userId,
        displayName: displayName || (username ? `@${username}` : "Collector"),
        username,
        avatarUrl: readString(row, "avatar_url"),
        href: isSystem ? null : (username ? `/u/${encodeURIComponent(username)}` : null),
        isSystem
    };
}

function mapSettings(raw: unknown): DirectMessageSettings {
    const row = asRow(raw);
    if (!row) return NO_DIRECT_MESSAGE_SETTINGS;
    return {
        pinnedAt: readString(row, "pinned_at"),
        mutedUntil: readString(row, "muted_until"),
        markedUnreadAt: readString(row, "marked_unread_at")
    };
}

function readPhotoReview(row: QueryRow): DirectMessage["photoReview"] {
    const value = readString(row, "photo_review");
    return value === "pending" || value === "approved" || value === "removed" ? value : null;
}

/**
 * `direct_messages.attachment`, written by the server's insert trigger (never
 * by a client), so its paths are the conversation's own. Unknown kinds are
 * ignored, as in the apps. `sign` is off for inbox previews, which show text only.
 */
async function resolveAttachment(raw: unknown, sign: boolean): Promise<DirectMessageAttachment | null> {
    const row = asRow(raw);
    if (!row) return null;
    const caption = readString(row, "caption");

    if (readString(row, "kind") === "image") {
        const bucket = readString(row, "bucket") ?? "direct-message-media";
        const path = readString(row, "path");
        if (!path) return null;
        const cardPath = readString(row, "card_path");
        const [bubbleUrl, fullUrl] = sign
            ? await Promise.all([
                createSignedStorageUrl(bucket, cardPath ?? path),
                cardPath ? createSignedStorageUrl(bucket, path) : Promise.resolve(null)
            ])
            : [null, null];
        return {
            kind: "image",
            bubbleUrl,
            fullUrl: fullUrl ?? bubbleUrl,
            width: readNumber(row, "width"),
            height: readNumber(row, "height"),
            caption
        };
    }

    if (readString(row, "kind") === "capture") {
        const captureId = readString(row, "capture_id");
        if (!captureId) return null;
        const image = asRow(row.image);
        // A still for the card: its 640 px card, the photo, or a video's poster.
        const moving = readString(image, "media_kind") !== null && readString(image, "media_kind") !== "photo";
        const bucket = (moving ? readString(image, "poster_bucket") : null)
            ?? readString(image, "card_bucket") ?? readString(image, "bucket");
        const path = (moving ? readString(image, "poster_path") : null)
            ?? readString(image, "card_path") ?? readString(image, "path");
        const grade = readNumber(row, "grade");
        const ownerHandle = readString(row, "owner_username");
        return {
            kind: "capture",
            captureId,
            title: readString(row, "title") ?? readString(row, "animal_name") ?? "Animal card",
            animalName: readString(row, "animal_name"),
            ownerName: ownerHandle ? (ownerHandle.startsWith("@") ? ownerHandle : `@${ownerHandle}`) : readString(row, "owner_display_name"),
            grade: grade === null ? null : Math.round(grade),
            imageUrl: sign && bucket && path ? await createSignedStorageUrl(bucket, path) : null,
            caption
        };
    }

    return null;
}

/** A message as `direct_message_client_json` (or a v2 insert's select) writes it. */
async function mapMessage(row: QueryRow, sign = true): Promise<DirectMessage | null> {
    const id = readString(row, "id");
    const senderId = readString(row, "sender_id");
    const recipientId = readString(row, "recipient_id");
    if (!id || !senderId || !recipientId) return null;

    const body = readString(row, "body") ?? "";
    const deletedAt = readString(row, "deleted_at");
    const photoReview = readPhotoReview(row);
    const hidden = Boolean(deletedAt) || photoReview === "removed";
    const attachment = hidden ? null : await resolveAttachment(row.attachment, sign);

    return {
        id,
        senderId,
        recipientId,
        body,
        text: hidden ? "" : attachment ? attachment.caption ?? "" : body,
        createdAt: readString(row, "created_at") ?? new Date(0).toISOString(),
        readAt: readString(row, "read_at"),
        deliveredAt: readString(row, "delivered_at"),
        deletedAt,
        photoReview,
        attachment,
        sender: null,
        recipient: null
    };
}

async function mapMessages(raw: unknown, sign = true): Promise<DirectMessage[]> {
    const rows = Array.isArray(raw) ? raw as QueryRow[] : [];
    const messages = await Promise.all(rows.map((row) => mapMessage(row, sign)));
    return messages.filter((message): message is DirectMessage => Boolean(message));
}

export async function getCurrentUserId() {
    const supabase = createSupabaseServerClient();
    if (!supabase) return null;
    const {data: {user}} = await supabase.auth.getUser();
    return user?.id ?? null;
}

export async function getDirectMessagePartner(userId: string): Promise<DirectMessageProfile | null> {
    const supabase = createSupabaseServerClient();
    if (!supabase || !isDirectMessageUserId(userId)) return null;

    const {data} = await supabase
        .from("profiles")
        .select(PROFILE_COLUMNS)
        .eq("id", userId)
        .maybeSingle();

    return mapDirectMessageProfile((data ?? null) as QueryRow | null);
}

/** Whether the reader has blocked this person (their own `user_blocks` rows). */
export async function isDirectMessagePartnerBlocked(partnerId: string): Promise<boolean> {
    const session = await signedInClient();
    if (!session || !isDirectMessageUserId(partnerId)) return false;
    const {data} = await session.supabase
        .from("user_blocks")
        .select("blocked_user_id")
        .eq("blocker_id", session.userId)
        .eq("blocked_user_id", partnerId)
        .maybeSingle();
    return Boolean(data);
}

/** One row per conversation in one call (`direct_message_inbox`), in iOS's order. */
export async function getDirectMessageInbox(limit = 40): Promise<DirectMessageResult<DirectMessageConversationSummary[]>> {
    const session = await signedInClient();
    if (!session) return NOT_SIGNED_IN;

    const {data, error} = await session.supabase.rpc("direct_message_inbox", {p_limit: limit});
    if (error) return failure(error, "inbox_unavailable");

    const rows = Array.isArray(data) ? data as QueryRow[] : [];
    const summaries = await Promise.all(rows.map(async (row): Promise<DirectMessageConversationSummary | null> => {
        const otherUser = mapDirectMessageProfile(asRow(row.other_user));
        const lastRow = asRow(row.last_message);
        const lastMessage = lastRow ? await mapMessage(lastRow, false) : null;
        if (!otherUser || !lastMessage) return null;
        return {
            otherUser,
            lastMessage,
            unreadCount: Math.max(0, Math.round(readNumber(row, "unread_count") ?? 0)),
            settings: mapSettings(row)
        };
    }));
    return {ok: true, value: sortedInbox(summaries.filter((summary): summary is DirectMessageConversationSummary => Boolean(summary)))};
}

/**
 * The newest page (no `beforeId`), or the page before a message. Only the
 * newest page marks, and only when asked; an older page is history.
 */
export async function getDirectMessageThreadPage(
    otherUserId: string,
    options: {beforeId?: string | null; limit?: number; markRead?: boolean} = {}
): Promise<DirectMessageResult<DirectMessageThreadPage>> {
    const session = await signedInClient();
    if (!session) return NOT_SIGNED_IN;
    if (!isDirectMessageUserId(otherUserId) || otherUserId === session.userId) return {ok: false, error: "invalid_conversation", status: 400};

    // Explicit nulls: PostgREST matches an RPC by the argument names sent.
    const {data, error} = await session.supabase.rpc("direct_message_thread_page", {
        p_other_user_id: otherUserId,
        p_before_created_at: null,
        p_before_id: options.beforeId && isDirectMessageUserId(options.beforeId) ? options.beforeId : null,
        p_limit: Math.max(1, Math.min(options.limit ?? 50, 200)),
        p_mark_read: options.markRead === true
    });
    const page = asRow(data);
    if (error || !page) return failure(error, "thread_unavailable");

    return {
        ok: true,
        value: {
            messages: await mapMessages(page.messages),
            hasMore: page.has_more === true,
            serverNow: readString(page, "server_now") ?? new Date().toISOString(),
            partnerTyping: page.partner_typing === true,
            settings: mapSettings(page.settings),
            firstUnreadId: readString(page, "first_unread_id"),
            unreadCount: Math.max(0, Math.round(readNumber(page, "unread_count") ?? 0))
        }
    };
}

/** Rows whose `updated_at` moved past the cursor: new messages, receipts, unsends. */
export async function syncDirectMessageThread(
    otherUserId: string,
    since: string | null,
    markRead: boolean
): Promise<DirectMessageResult<DirectMessageThreadSync>> {
    const session = await signedInClient();
    if (!session) return NOT_SIGNED_IN;
    if (!isDirectMessageUserId(otherUserId) || otherUserId === session.userId) return {ok: false, error: "invalid_conversation", status: 400};
    const cursor = since && Number.isFinite(Date.parse(since)) ? new Date(since).toISOString() : null;

    const {data, error} = await session.supabase.rpc("direct_message_thread_sync", {
        p_other_user_id: otherUserId,
        p_since: cursor,
        p_mark_read: markRead
    });
    const result = asRow(data);
    if (error || !result) return failure(error, "thread_unavailable");

    return {
        ok: true,
        value: {
            messages: await mapMessages(result.messages),
            serverNow: readString(result, "server_now") ?? new Date().toISOString(),
            partnerTyping: result.partner_typing === true
        }
    };
}

export type DirectConversationAction =
    | {kind: "pin"; pinned: boolean}
    | {kind: "mute"; until: string | null}
    | {kind: "unread"; unread: boolean};

/** Pin (five at most), mute (push only; null unmutes) or mark read/unread. */
export async function setDirectConversationSetting(otherUserId: string, action: DirectConversationAction): Promise<DirectMessageResult<DirectMessageSettings>> {
    const session = await signedInClient();
    if (!session) return NOT_SIGNED_IN;
    if (!isDirectMessageUserId(otherUserId) || otherUserId === session.userId) return {ok: false, error: "invalid_conversation", status: 400};

    const call = action.kind === "pin"
        ? session.supabase.rpc("set_direct_conversation_pinned", {p_other_user_id: otherUserId, p_pinned: action.pinned})
        : action.kind === "mute"
            ? session.supabase.rpc("set_direct_conversation_muted", {
                p_other_user_id: otherUserId,
                p_muted_until: action.until && Number.isFinite(Date.parse(action.until)) ? new Date(action.until).toISOString() : null
            })
            : session.supabase.rpc("set_direct_conversation_unread", {p_other_user_id: otherUserId, p_unread: action.unread});
    const {data, error} = await call;
    if (error) return failure(error, "settings_failed");
    return {ok: true, value: mapSettings(data)};
}

/** Removes the conversation from the reader's inbox until they write again. Support stays. */
export async function hideDirectConversation(otherUserId: string): Promise<DirectMessageResult<null>> {
    const session = await signedInClient();
    if (!session) return NOT_SIGNED_IN;
    if (!isDirectMessageUserId(otherUserId)) return {ok: false, error: "invalid_conversation", status: 400};
    const {error} = await session.supabase.rpc("hide_direct_conversation", {p_other_user_id: otherUserId});
    return error ? failure(error, "delete_failed") : {ok: true, value: null};
}

/** iOS `blockUser(_, reason: "Blocked from messages")`: the reader's own `user_blocks` row. */
export async function blockDirectMessagePartner(otherUserId: string): Promise<DirectMessageResult<null>> {
    const session = await signedInClient();
    if (!session) return NOT_SIGNED_IN;
    if (!isDirectMessageUserId(otherUserId)) return {ok: false, error: "invalid_conversation", status: 400};
    if (otherUserId === session.userId) return {ok: false, error: "self_message", status: 400};
    const {error} = await session.supabase
        .from("user_blocks")
        .upsert({blocker_id: session.userId, blocked_user_id: otherUserId, reason: "Blocked from messages"}, {onConflict: "blocker_id,blocked_user_id"});
    return error ? failure(error, "block_failed") : {ok: true, value: null};
}

/** A `direct_message` moderation report, worded as iOS files it. */
export async function reportDirectMessage(
    otherUserId: string,
    contentId: string | null,
    snapshot: string
): Promise<DirectMessageResult<null>> {
    const session = await signedInClient();
    if (!session) return NOT_SIGNED_IN;
    if (!isDirectMessageUserId(otherUserId)) return {ok: false, error: "invalid_conversation", status: 400};
    const {error} = await session.supabase.from("moderation_reports").insert({
        reporter_id: session.userId,
        reported_user_id: otherUserId,
        content_type: "direct_message",
        content_id: contentId && isDirectMessageUserId(contentId) ? contentId : null,
        reason: "Objectionable direct message or abusive behavior",
        snapshot: snapshot.trim().slice(0, 1000) || null
    });
    return error ? failure(error, "report_failed") : {ok: true, value: null};
}

/**
 * Takes a message back from both sides within 48 hours. A photo's files go
 * too, from the sender's own folder (the bucket lets only its owner delete).
 */
export async function unsendDirectMessage(messageId: string, wasPhoto: boolean): Promise<DirectMessageResult<DirectMessage>> {
    const session = await signedInClient();
    if (!session) return NOT_SIGNED_IN;
    if (!isDirectMessageUserId(messageId)) return {ok: false, error: "message_not_found", status: 400};

    const {data, error} = await session.supabase.rpc("unsend_direct_message", {p_message_id: messageId});
    const row = asRow(data);
    if (error || !row) return failure(error, "unsend_failed");
    const message = await mapMessage(row);
    if (!message) return {ok: false, error: "unsend_failed", status: 400};

    if (wasPhoto) {
        const folder = `${session.userId.toLowerCase()}/${messageId.toLowerCase()}`;
        await session.supabase.storage.from("direct-message-media").remove([`${folder}/full.jpg`, `${folder}/card.jpg`]).catch(() => undefined);
    }
    return {ok: true, value: message};
}

export async function getDirectMessageUnreadCountForUser(supabase: ServerClient, userId: string) {
    const {count} = await supabase
        .from("direct_messages")
        .select("id", {count: "exact", head: true})
        .eq("recipient_id", userId)
        .neq("sender_id", userId)
        .is("read_at", null);

    return count ?? 0;
}

export async function getDirectMessageUnreadCount() {
    const session = await signedInClient();
    if (!session) return 0;
    return getDirectMessageUnreadCountForUser(session.supabase, session.userId);
}

/** Opening a thread on the web clears its unread messages and its "marked unread". */
export async function markDirectConversationRead(otherUserId: string) {
    const session = await signedInClient();
    if (!session) return {ok: false as const, error: "Unauthorized"};
    if (!isDirectMessageUserId(otherUserId)) return {ok: false as const, error: "invalid_conversation"};

    const {error} = await session.supabase.rpc("mark_direct_conversation_read", {p_other_user_id: otherUserId});
    return error ? {ok: false as const, error: error.message} : {ok: true as const};
}

/** A text message, as iOS sends one: the server stamps its time and receipts. */
export async function sendDirectMessage(recipientId: string, body: string): Promise<DirectMessageResult<DirectMessage>> {
    const session = await signedInClient();
    if (!session) return NOT_SIGNED_IN;

    const trimmed = body.trim();
    if (!trimmed) return {ok: false, error: "empty_message", status: 400};
    if (trimmed.length > 1000) return {ok: false, error: "send_failed", status: 400};
    if (!isDirectMessageUserId(recipientId)) return {ok: false, error: "invalid_conversation", status: 400};
    if (recipientId === session.userId) return {ok: false, error: "self_message", status: 400};

    const {data: blocked} = await session.supabase
        .from("user_blocks")
        .select("blocked_user_id")
        .eq("blocker_id", session.userId)
        .eq("blocked_user_id", recipientId)
        .maybeSingle();
    if (blocked) return {ok: false, error: "blocked_user", status: 400};

    const {data, error} = await session.supabase
        .from("direct_messages")
        .insert({sender_id: session.userId, recipient_id: recipientId, body: trimmed})
        .select(MESSAGE_COLUMNS)
        .single();
    if (error || !data) return failure(error, "send_failed");

    const message = await mapMessage(data as unknown as QueryRow);
    return message ? {ok: true, value: message} : {ok: false, error: "send_failed", status: 400};
}

/**
 * People to message (the New Message picker): everyone the reader follows,
 * or a search by name or @username (two letters at least, as iOS), without
 * system accounts, the reader, or anyone they blocked.
 */
export async function findDirectMessagePeople(query: string): Promise<DirectMessageResult<{following: DirectMessageProfile[]; results: DirectMessageProfile[]}>> {
    const session = await signedInClient();
    if (!session) return NOT_SIGNED_IN;
    const {supabase, userId} = session;

    const {data: blockRows} = await supabase.from("user_blocks").select("blocked_user_id").eq("blocker_id", userId);
    const blocked = new Set(((blockRows ?? []) as QueryRow[]).map((row) => readString(row, "blocked_user_id")).filter(Boolean) as string[]);
    const eligible = (profile: DirectMessageProfile | null): profile is DirectMessageProfile =>
        Boolean(profile) && profile!.userId !== userId && !profile!.isSystem && !blocked.has(profile!.userId);

    const needle = query.trim().replace(/[@%,()*\\]/g, "").trim();
    if (needle.length >= 2) {
        const pattern = `%${needle}%`;
        const [byName, byHandle] = await Promise.all([
            supabase.from("profiles").select(PROFILE_COLUMNS).eq("is_system", false).ilike("display_name", pattern).limit(30),
            supabase.from("profiles").select(PROFILE_COLUMNS).eq("is_system", false).ilike("username", pattern).limit(30)
        ]);
        if (byName.error && byHandle.error) return failure(byName.error, "search_failed");
        const seen = new Set<string>();
        const results = [...((byName.data ?? []) as QueryRow[]), ...((byHandle.data ?? []) as QueryRow[])]
            .map(mapDirectMessageProfile)
            .filter(eligible)
            .filter((profile) => !seen.has(profile.userId) && Boolean(seen.add(profile.userId)))
            .slice(0, 30);
        return {ok: true, value: {following: [], results}};
    }

    const {data: follows, error} = await supabase
        .from("user_follows")
        .select("followed_id")
        .eq("follower_id", userId)
        .limit(500);
    if (error) return failure(error, "search_failed");
    const ids = ((follows ?? []) as QueryRow[]).map((row) => readString(row, "followed_id")).filter((id): id is string => Boolean(id));
    if (!ids.length) return {ok: true, value: {following: [], results: []}};

    const {data: profiles} = await supabase.from("profiles").select(PROFILE_COLUMNS).in("id", ids.slice(0, 500));
    const following = ((profiles ?? []) as QueryRow[]).map(mapDirectMessageProfile).filter(eligible);
    return {ok: true, value: {following, results: []}};
}
