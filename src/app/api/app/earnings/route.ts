import {NextResponse} from "next/server";
import {createSupabaseServerClient} from "@/lib/supabase/server";
import {
    mapCreatorRewardReceiptSummary,
    mapEarningEntryRow,
    mapEarningsSummaryRow,
} from "@/lib/earnings";

export async function GET() {
    const supabase = createSupabaseServerClient();
    if (!supabase) return NextResponse.json({error: "Supabase is not configured."}, {status: 503});

    const {data: {user}} = await supabase.auth.getUser();
    if (!user) return NextResponse.json({error: "Authentication required."}, {status: 401});

    const [summaryRes, entriesRes, receiptsRes] = await Promise.all([
        supabase.rpc("get_my_earnings_summary"),
        supabase.rpc("list_my_earning_entries", {p_limit: 50}),
        supabase.rpc("list_my_creator_reward_receipts"),
    ]);

    if (summaryRes.error) return NextResponse.json({error: summaryRes.error.message}, {status: 400});
    if (entriesRes.error) return NextResponse.json({error: entriesRes.error.message}, {status: 400});
    if (receiptsRes.error) return NextResponse.json({error: receiptsRes.error.message}, {status: 400});

    const summaryRows = Array.isArray(summaryRes.data) ? summaryRes.data : [];
    const entryRows = Array.isArray(entriesRes.data) ? entriesRes.data : [];
    const receiptRows = Array.isArray(receiptsRes.data) ? receiptsRes.data : [];

    return NextResponse.json({
        balances: summaryRows.map((row) => mapEarningsSummaryRow(row as Record<string, unknown>)),
        entries: entryRows.map((row) => mapEarningEntryRow(row as Record<string, unknown>)),
        creatorRewardReceipts: receiptRows.map((row) => mapCreatorRewardReceiptSummary(row as Record<string, unknown>)),
    });
}
