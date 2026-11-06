import "server-only";
import {createSupabaseServerClient} from "@/lib/supabase/server";
import {decodeCreditTransactions, type CreditTransaction} from "@/lib/credit-history";

/**
 * iOS `SupabaseCreditsService.fetchTransactions`: the account's newest
 * `credit_transactions`, read as the signed-in user. Null when the read
 * failed, so the page can say so instead of showing an empty history.
 */
export async function getCreditHistory(limit = 60): Promise<CreditTransaction[] | null> {
    const supabase = createSupabaseServerClient();
    if (!supabase) return null;
    const {data: {user}} = await supabase.auth.getUser();
    if (!user) return null;
    const {data, error} = await supabase
        .from("credit_transactions")
        .select("id,delta,reason,capture_id,created_at,metadata")
        .eq("user_id", user.id)
        .order("created_at", {ascending: false})
        .limit(limit);
    if (error) return null;
    return decodeCreditTransactions(data);
}
