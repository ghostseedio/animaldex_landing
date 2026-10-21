import "server-only";

import {createSignedStorageUrl} from "@/lib/capture-storage-image";
import {createSupabaseServerClient} from "@/lib/supabase/server";

type QueryRow = Record<string, unknown>;

export type DirectMessageProfile = {
    userId: string;
    displayName: string;
    username: string | null;
    avatarUrl: string | null;
    href: string | null;
    isSystem?: boolean;
};

/** A photo or animal card sent from the app, with URLs signed for this page view. */
export type DirectMessageAttachment =
    | {
        kind: "image";
        bubbleUrl: string | null;
        fullUrl: string | null;
        width: number | null;
        height: number | null;
    }
    | {
        kind: "capture";
        captureId: string;
        title: string;
        animalName: string | null;
        grade: number | null;
        imageUrl: string | null;
    };

export type DirectMessage = {
    id: string;
    senderId: string;
    recipientId: string;
    /** The plain-text stand-in older clients show ("📷 Photo", "🐾 Red Fox"). */
    body: string;
    /** What the sender typed: a photo or card's caption, else the body. */
    text: string;
    createdAt: string;
    readAt: string | null;
    deletedAt: string | null;
    /** Photos only: "pending" until screening decides, then "approved" or "removed". */
    photoReview: "pending" | "approved" | "removed" | null;
    attachment: DirectMessageAttachment | null;
    sender: DirectMessageProfile | null;
    recipient: DirectMessageProfile | null;
};

export type DirectMessageConversationSummary = {
    otherUser: DirectMessageProfile;
    lastMessage: DirectMessage;
    unreadCount: number;
};

const MESSAGE_SELECT = [
    "id",
    "sender_id",
    "recipient_id",
    "body",
    "created_at",
    "read_at",
    "sender:profiles!direct_messages_sender_id_fkey(id,display_name,username,avatar_url,is_system)",
    "recipient:profiles!direct_messages_recipient_id_fkey(id,display_name,username,avatar_url,is_system)"
].join(",");

function readString(row: QueryRow | null | undefined, key: string) {
    const value = row?.[key];
    return typeof value === "string" && value.trim() ? value.trim() : null;
}

function mapProfile(row: QueryRow | null | undefined): DirectMessageProfile | null {
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

function mapMessage(row: QueryRow, currentUserId?: string | null): DirectMessage | null {
    const id = readString(row, "id");
    const senderId = readString(row, "sender_id");
    const recipientId = readString(row, "recipient_id");
    const body = readString(row, "body");

    if (!id || !senderId || !recipientId || !body) return null;

    const sender = mapProfile(Array.isArray(row.sender) ? row.sender[0] as QueryRow : row.sender as QueryRow | undefined);
    const recipient = mapProfile(Array.isArray(row.recipient) ? row.recipient[0] as QueryRow : row.recipient as QueryRow | undefined);

    return {
        id,
        senderId,
        recipientId,
        body,
        text: body,
        createdAt: readString(row, "created_at") ?? new Date(0).toISOString(),
        readAt: readString(row, "read_at"),
        deletedAt: null,
        photoReview: null,
        attachment: null,
        sender: sender ?? (senderId === currentUserId ? null : {userId: senderId, displayName: "Collector", username: null, avatarUrl: null, href: null}),
        recipient: recipient ?? (recipientId === currentUserId ? null : {userId: recipientId, displayName: "Collector", username: null, avatarUrl: null, href: null})
    };
}

function readNumber(row: QueryRow | null | undefined, key: string) {
    const value = row?.[key];
    const number = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
    return Number.isFinite(number) ? number : null;
}

function readPhotoReview(row: QueryRow): DirectMessage["photoReview"] {
    const value = readString(row, "photo_review");
    return value === "pending" || value === "approved" || value === "removed" ? value : null;
}

/** `direct_messages.attachment`; unknown kinds are ignored, as in the apps. */
async function resolveAttachment(raw: unknown): Promise<{attachment: DirectMessageAttachment; caption: string | null} | null> {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const row = raw as QueryRow;
    const caption = readString(row, "caption");

    if (readString(row, "kind") === "image") {
        const bucket = readString(row, "bucket") ?? "direct-message-media";
        const path = readString(row, "path");
        if (!path) return null;
        const cardPath = readString(row, "card_path");
        const [bubbleUrl, fullUrl] = await Promise.all([
            createSignedStorageUrl(bucket, cardPath ?? path),
            cardPath ? createSignedStorageUrl(bucket, path) : Promise.resolve(null)
        ]);
        return {
            attachment: {
                kind: "image",
                bubbleUrl,
                fullUrl: fullUrl ?? bubbleUrl,
                width: readNumber(row, "width"),
                height: readNumber(row, "height")
            },
            caption
        };
    }

    if (readString(row, "kind") === "capture") {
        const captureId = readString(row, "capture_id");
        if (!captureId) return null;
        const image = (row.image && typeof row.image === "object" ? row.image : null) as QueryRow | null;
        // A still for the card: its 640 px card, the photo, or a video's poster.
        const moving = readString(image, "media_kind") !== null && readString(image, "media_kind") !== "photo";
        const bucket = (moving ? readString(image, "poster_bucket") : null)
            ?? readString(image, "card_bucket") ?? readString(image, "bucket");
        const path = (moving ? readString(image, "poster_path") : null)
            ?? readString(image, "card_path") ?? readString(image, "path");
        const grade = readNumber(row, "grade");
        return {
            attachment: {
                kind: "capture",
                captureId,
                title: readString(row, "title") ?? readString(row, "animal_name") ?? "Animal card",
                animalName: readString(row, "animal_name"),
                grade: grade === null ? null : Math.round(grade),
                imageUrl: bucket && path ? await createSignedStorageUrl(bucket, path) : null
            },
            caption
        };
    }

    return null;
}

/** A message as `direct_message_client_json` writes it (20261020230000). */
async function mapThreadMessage(row: QueryRow): Promise<DirectMessage | null> {
    const id = readString(row, "id");
    const senderId = readString(row, "sender_id");
    const recipientId = readString(row, "recipient_id");
    if (!id || !senderId || !recipientId) return null;

    const body = readString(row, "body") ?? "";
    const deletedAt = readString(row, "deleted_at");
    const photoReview = readPhotoReview(row);
    const resolved = deletedAt || photoReview === "removed" ? null : await resolveAttachment(row.attachment);

    return {
        id,
        senderId,
        recipientId,
        body,
        text: deletedAt || photoReview === "removed" ? "" : resolved ? resolved.caption ?? "" : body,
        createdAt: readString(row, "created_at") ?? new Date(0).toISOString(),
        readAt: readString(row, "read_at"),
        deletedAt,
        photoReview,
        attachment: resolved?.attachment ?? null,
        sender: null,
        recipient: null
    };
}

function otherUserForMessage(message: DirectMessage, currentUserId: string): DirectMessageProfile | null {
    if (message.senderId === currentUserId) return message.recipient;
    if (message.recipientId === currentUserId) return message.sender;
    return null;
}

function isUnreadIncoming(message: DirectMessage, currentUserId: string) {
    return message.recipientId === currentUserId && message.senderId !== currentUserId && !message.readAt;
}

export async function getCurrentUserId() {
    const supabase = createSupabaseServerClient();
    if (!supabase) return null;
    const {data: {user}} = await supabase.auth.getUser();
    return user?.id ?? null;
}

export async function getDirectMessagePartner(userId: string): Promise<DirectMessageProfile | null> {
    const supabase = createSupabaseServerClient();
    if (!supabase) return null;

    const {data} = await supabase
        .from("profiles")
        .select("id,display_name,username,avatar_url,is_system")
        .eq("id", userId)
        .maybeSingle();

    return mapProfile((data ?? null) as QueryRow | null);
}

export async function getDirectMessageInbox(limit = 40): Promise<DirectMessageConversationSummary[]> {
    const supabase = createSupabaseServerClient();
    if (!supabase) return [];

    const {data: {user}} = await supabase.auth.getUser();
    if (!user) return [];

    const {data} = await supabase
        .from("direct_messages")
        .select(MESSAGE_SELECT)
        .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
        .order("created_at", {ascending: false})
        .limit(Math.max(limit * 20, 200));

    const rows = (data ?? []) as unknown as QueryRow[];
    const orderedPartnerIds: string[] = [];
    const summaries = new Map<string, DirectMessageConversationSummary>();

    for (const row of rows) {
        const message = mapMessage(row, user.id);
        if (!message) continue;

        const otherUser = otherUserForMessage(message, user.id);
        if (!otherUser) continue;

        const existing = summaries.get(otherUser.userId);
        if (!existing) {
            orderedPartnerIds.push(otherUser.userId);
            summaries.set(otherUser.userId, {
                otherUser,
                lastMessage: message,
                unreadCount: isUnreadIncoming(message, user.id) ? 1 : 0
            });
        } else if (isUnreadIncoming(message, user.id)) {
            existing.unreadCount += 1;
        }
    }

    return orderedPartnerIds
        .map((partnerId) => summaries.get(partnerId))
        .filter((item): item is DirectMessageConversationSummary => Boolean(item))
        .sort((left, right) => Number(Boolean(right.otherUser.isSystem)) - Number(Boolean(left.otherUser.isSystem)))
        .slice(0, limit);
}

export async function getDirectMessageConversation(otherUserId: string, limit = 120): Promise<DirectMessage[]> {
    const supabase = createSupabaseServerClient();
    if (!supabase) return [];

    const {data: {user}} = await supabase.auth.getUser();
    if (!user) return [];

    // The newest page, with photos and cards, through the thread function.
    const {data: page, error} = await supabase.rpc("direct_message_thread_page", {
        p_other_user_id: otherUserId,
        p_limit: limit,
        p_mark_read: false
    });
    if (!error && page && typeof page === "object" && Array.isArray((page as QueryRow).messages)) {
        const rows = (page as QueryRow).messages as QueryRow[];
        const messages = await Promise.all(rows.map((row) => mapThreadMessage(row)));
        return messages.filter((message): message is DirectMessage => Boolean(message));
    }

    // Servers without 20261020230000: the table, newest first, then put in
    // order. Reading oldest first returned the first messages ever sent, so a
    // long conversation stopped showing new ones.
    const filter = [
        `and(sender_id.eq.${user.id},recipient_id.eq.${otherUserId})`,
        `and(sender_id.eq.${otherUserId},recipient_id.eq.${user.id})`
    ].join(",");

    const {data} = await supabase
        .from("direct_messages")
        .select(MESSAGE_SELECT)
        .or(filter)
        .order("created_at", {ascending: false})
        .limit(limit);

    return ((data ?? []) as unknown as QueryRow[])
        .map((row) => mapMessage(row, user.id))
        .filter((message): message is DirectMessage => Boolean(message))
        .reverse();
}

export async function getDirectMessageUnreadCountForUser(
    supabase: NonNullable<ReturnType<typeof createSupabaseServerClient>>,
    userId: string
) {
    const {count} = await supabase
        .from("direct_messages")
        .select("id", {count: "exact", head: true})
        .eq("recipient_id", userId)
        .neq("sender_id", userId)
        .is("read_at", null);

    return count ?? 0;
}

export async function getDirectMessageUnreadCount() {
    const supabase = createSupabaseServerClient();
    if (!supabase) return 0;

    const {data: {user}} = await supabase.auth.getUser();
    if (!user) return 0;

    return getDirectMessageUnreadCountForUser(supabase, user.id);
}

export async function markDirectConversationRead(otherUserId: string) {
    const supabase = createSupabaseServerClient();
    if (!supabase) return {ok: false as const, error: "Not configured"};

    const {data: {user}} = await supabase.auth.getUser();
    if (!user) return {ok: false as const, error: "Unauthorized"};

    const {error} = await supabase.rpc("mark_direct_conversation_read", {p_other_user_id: otherUserId});
    return error ? {ok: false as const, error: error.message} : {ok: true as const};
}

export async function sendDirectMessage(recipientId: string, body: string) {
    const supabase = createSupabaseServerClient();
    if (!supabase) return {ok: false as const, error: "Not configured"};

    const {data: {user}} = await supabase.auth.getUser();
    if (!user) return {ok: false as const, error: "Unauthorized"};

    const trimmed = body.trim();
    if (!trimmed) return {ok: false as const, error: "Type a message first."};
    if (trimmed.length > 1000) return {ok: false as const, error: "Message is too long."};
    if (recipientId === user.id) return {ok: false as const, error: "You cannot message yourself."};

    const {data, error} = await supabase
        .from("direct_messages")
        .insert({sender_id: user.id, recipient_id: recipientId, body: trimmed})
        .select(MESSAGE_SELECT)
        .single();

    if (error) return {ok: false as const, error: error.message};

    const message = mapMessage(data as unknown as QueryRow, user.id);
    return message ? {ok: true as const, message} : {ok: false as const, error: "Message could not be sent."};
}
