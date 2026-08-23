import {getSupabaseHeaders, getSupabaseServiceKey, getSupabaseUrl} from "@/lib/supabase-http";
import {createSupabaseServerClient} from "@/lib/supabase/server";

export type SystemSupportProfile = {
    id: string;
    displayName: string;
    username: string | null;
    avatarUrl: string | null;
    bio: string | null;
    isSystem: boolean;
};

export type InAppSupportThreadSummary = {
    id: string;
    displayName: string;
    username: string | null;
    avatarUrl: string | null;
    lastBody: string;
    lastCreatedAt: string;
    lastDirection: "inbound" | "outbound";
    unreadCount: number;
};

export type InAppSupportMessage = {
    id: string;
    senderId: string;
    recipientId: string;
    body: string;
    createdAt: string;
    readAt: string | null;
    direction: "inbound" | "outbound";
};

type RpcProfileRow = {
    id?: string;
    display_name?: string | null;
    username?: string | null;
    avatar_url?: string | null;
    bio?: string | null;
    is_system?: boolean | null;
};

type RpcInboxRow = {
    other_user_id?: string;
    display_name?: string | null;
    username?: string | null;
    avatar_url?: string | null;
    last_message_id?: string;
    last_body?: string | null;
    last_created_at?: string;
    last_direction?: string;
    unread_count?: number;
};

type RpcMessageRow = {
    id?: string;
    sender_id?: string;
    recipient_id?: string;
    body?: string | null;
    created_at?: string;
    read_at?: string | null;
    direction?: string;
};

function getWriteConfig() {
    const supabaseUrl = getSupabaseUrl();
    const serviceRoleKey = getSupabaseServiceKey();
    if (!supabaseUrl || !serviceRoleKey) {
        throw new Error("Supabase write env vars are not configured");
    }
    return {supabaseUrl, serviceRoleKey};
}

async function serviceRpc<T>(name: string, body: Record<string, unknown> = {}): Promise<T> {
    const {supabaseUrl, serviceRoleKey} = getWriteConfig();
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/${name}`, {
        method: "POST",
        headers: getSupabaseHeaders(serviceRoleKey, {
            Accept: "application/json",
            "Content-Type": "application/json"
        }),
        body: JSON.stringify(body),
        cache: "no-store"
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Supabase RPC ${name} failed (${response.status}): ${errorText.slice(0, 300)}`);
    }

    if (response.status === 204) {
        return null as T;
    }

    return await response.json() as T;
}

function mapProfile(row: RpcProfileRow | null | undefined): SystemSupportProfile | null {
    const id = row?.id?.trim();
    if (!id) return null;
    return {
        id,
        displayName: row?.display_name?.trim() || "AnimalDex",
        username: row?.username?.trim() || null,
        avatarUrl: row?.avatar_url?.trim() || null,
        bio: row?.bio?.trim() || null,
        isSystem: row?.is_system === true
    };
}

export async function getSystemSupportProfile(): Promise<SystemSupportProfile | null> {
    const supabase = createSupabaseServerClient();
    if (supabase) {
        const {data} = await supabase.rpc("get_system_support_profile");
        const rows = Array.isArray(data) ? data as RpcProfileRow[] : data ? [data as RpcProfileRow] : [];
        const mapped = mapProfile(rows[0]);
        if (mapped) return mapped;
    }

    try {
        const rows = await serviceRpc<RpcProfileRow[]>("get_system_support_profile");
        return mapProfile(Array.isArray(rows) ? rows[0] : rows);
    } catch {
        return null;
    }
}

export async function listInAppSupportInbox(limit = 40, offset = 0): Promise<InAppSupportThreadSummary[]> {
    const rows = await serviceRpc<RpcInboxRow[]>("admin_list_support_dm_inbox", {
        p_limit: limit,
        p_offset: offset
    });

    return (Array.isArray(rows) ? rows : []).flatMap((row) => {
        const id = row.other_user_id?.trim();
        if (!id) return [];
        return [{
            id,
            displayName: row.display_name?.trim() || "Collector",
            username: row.username?.trim() || null,
            avatarUrl: row.avatar_url?.trim() || null,
            lastBody: row.last_body?.trim() || "Message",
            lastCreatedAt: row.last_created_at ?? new Date(0).toISOString(),
            lastDirection: row.last_direction === "outbound" ? "outbound" : "inbound",
            unreadCount: Number(row.unread_count ?? 0)
        }];
    });
}

export async function listInAppSupportMessages(userId: string, limit = 200): Promise<InAppSupportMessage[]> {
    const rows = await serviceRpc<RpcMessageRow[]>("admin_list_support_dm_messages", {
        p_other_user_id: userId,
        p_limit: limit
    });

    return (Array.isArray(rows) ? rows : []).flatMap((row) => {
        const id = row.id?.trim();
        const senderId = row.sender_id?.trim();
        const recipientId = row.recipient_id?.trim();
        const body = row.body?.trim();
        if (!id || !senderId || !recipientId || !body) return [];
        return [{
            id,
            senderId,
            recipientId,
            body,
            createdAt: row.created_at ?? new Date(0).toISOString(),
            readAt: row.read_at ?? null,
            direction: row.direction === "outbound" ? "outbound" : "inbound"
        }];
    });
}

export async function markInAppSupportRead(userId: string) {
    await serviceRpc<number>("admin_mark_support_dm_read", {p_other_user_id: userId});
}

export async function sendInAppSupportReply(userId: string, body: string) {
    return await serviceRpc<RpcMessageRow>("admin_send_support_direct_message", {
        p_recipient_id: userId,
        p_body: body
    });
}
