import {getSupabaseHeaders, getSupabaseServiceKey, getSupabaseUrl} from "@/lib/supabase-http";

/**
 * What people use the animal chat for: one label per conversation, written
 * hourly by the apps' label-animal-chat-uses function (AnimalDex migration
 * 20261107140000). Aggregates only; no message text exists in the table.
 */

export type ChatUseLabel = {
    label: string;
    conversations: number;
    people: number;
    avg_messages: number;
    wants_follow_through: number;
    app: number;
    web: number;
    front_door: number;
    referral: number;
};

export type ChatUseSummary = {
    days: number;
    conversations: number;
    people: number;
    wants_follow_through: number;
    wants_follow_through_people: number;
    newest_labelled_at: string | null;
    by_label: ChatUseLabel[];
    by_day: Array<{day: string; labels: Record<string, number>}>;
};

export async function fetchChatUseSummary(days: number): Promise<ChatUseSummary> {
    const url = getSupabaseUrl();
    const key = getSupabaseServiceKey();
    if (!url || !key) throw new Error("Supabase service role is not configured");
    const response = await fetch(`${url}/rest/v1/rpc/admin_animal_chat_use_summary_v1`, {
        method: "POST",
        headers: getSupabaseHeaders(key, {"Content-Type": "application/json"}),
        body: JSON.stringify({p_days: days}),
        cache: "no-store",
        signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) {
        const text = (await response.text()).slice(0, 200);
        if (response.status === 404) throw new Error("The chat use labels are not live yet (AnimalDex migration 20261107140000).");
        throw new Error(`admin_animal_chat_use_summary_v1 ${response.status}: ${text}`);
    }
    return await response.json() as ChatUseSummary;
}
