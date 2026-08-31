import "server-only";
import {createSupabaseServerClient} from "@/lib/supabase/server";
import {getSupabasePublicKey, getSupabaseUrl} from "@/lib/supabase-http";

export async function invokeAuthenticatedSupabaseFunctionResponse(functionName: string, body: unknown) {
    const supabase = createSupabaseServerClient();
    const url = getSupabaseUrl();
    const apiKey = getSupabasePublicKey();
    if (!supabase || !url || !apiKey) throw new Error("Supabase is not configured.");
    const {data: {session}} = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error("Authentication required.");
    const response = await fetch(`${url}/functions/v1/${functionName}`, {
        method: "POST",
        headers: {"Content-Type": "application/json", Authorization: `Bearer ${session.access_token}`, apikey: apiKey},
        body: JSON.stringify(body),
        cache: "no-store"
    });
    const text = await response.text();
    let payload: any = null;
    try { payload = text ? JSON.parse(text) : {}; } catch { payload = {error: text}; }
    return {ok: response.ok, status: response.status, payload};
}

export async function invokeAuthenticatedSupabaseFunction(functionName: string, body: unknown) {
    const invoked = await invokeAuthenticatedSupabaseFunctionResponse(functionName, body);
    if (!invoked.ok) throw new Error(invoked.payload?.message || invoked.payload?.error || "The request failed.");
    return invoked.payload;
}
