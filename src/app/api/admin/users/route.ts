import {NextRequest, NextResponse} from "next/server";
import {getSupabaseHeaders, getSupabaseServiceKey, getSupabaseUrl} from "@/lib/supabase-http";
import {isSupportAdminRequestAuthorized} from "@/lib/support-admin-auth";

type Row = Record<string, unknown>;

const estimatedUsd: Record<string, number> = {
    purchase_25: 2.99,
    purchase_100: 7.99,
    pro_upgrade: 9.99
};

function config() {
    const url = getSupabaseUrl();
    const key = getSupabaseServiceKey();
    if (!url || !key) throw new Error("Supabase customer intelligence access is not configured");
    return {url, key};
}

async function rows(table: string, query: string): Promise<Row[]> {
    const {url, key} = config();
    const result: Row[] = [];
    for (let offset = 0; offset < 100000; offset += 1000) {
        const response = await fetch(`${url}/rest/v1/${table}?${query}&limit=1000&offset=${offset}`, {
            headers: getSupabaseHeaders(key, {Accept: "application/json"}),
            cache: "no-store"
        });
        if (!response.ok) throw new Error(`${table} query failed (${response.status}): ${await response.text()}`);
        const page = await response.json() as Row[];
        result.push(...page);
        if (page.length < 1000) break;
    }
    return result;
}

async function authEmails() {
    const {url, key} = config();
    const emailById = new Map<string, string>();
    try {
        for (let page = 1; page <= 20; page += 1) {
            const response = await fetch(`${url}/auth/v1/admin/users?page=${page}&per_page=1000`, {
                headers: getSupabaseHeaders(key, {Accept: "application/json"}),
                cache: "no-store"
            });
            if (!response.ok) break;
            const body = await response.json() as {users?: Array<{id?: string; email?: string}>};
            const users = body.users ?? [];
            users.forEach((user) => {
                if (user.id && user.email) emailById.set(user.id, user.email);
            });
            if (users.length < 1000) break;
        }
    } catch {
        // Customer activity remains useful if Auth admin listing is unavailable.
    }
    return emailById;
}

function string(row: Row, key: string) {
    const value = row[key];
    return typeof value === "string" ? value : null;
}

export async function GET(request: NextRequest) {
    if (!(await isSupportAdminRequestAuthorized(request))) {
        return NextResponse.json({ok: false, error: "Unauthorized"}, {status: 401});
    }

    try {
        const [profiles, captures, purchases, creditTransactions, balances, alignments, fusions, challenges, trades, emails] = await Promise.all([
            rows("profiles", "select=id,display_name,username,avatar_url,is_pro,created_at,updated_at&order=created_at.desc"),
            rows("captures", "select=user_id,created_at"),
            rows("app_store_purchases", "select=transaction_id,user_id,product_id,product_code,environment,purchase_date,created_at&order=created_at.desc"),
            rows("credit_transactions", "select=user_id,delta,reason,created_at"),
            rows("credit_balances", "select=user_id,balance,updated_at"),
            rows("discover_alignment_timeline_v1", "select=user_id,completed_at"),
            rows("discover_principle_fusion_timeline_v1", "select=user_id,created_at"),
            rows("capture_challenges", "select=attacker_user_id,defender_user_id,created_at"),
            rows("capture_trade_offers", "select=offerer_user_id,receiver_user_id,status,resolved_at,created_at&status=eq.accepted"),
            authEmails()
        ]);

        const byUser = new Map<string, {
            captures: number;
            alignments: number;
            fusions: number;
            challenges: number;
            trades: number;
            creditsPurchased: number;
            creditsSpent: number;
            purchaseCount: number;
            productionPurchaseCount: number;
            sandboxPurchaseCount: number;
            estimatedLtvUsd: number;
            products: Record<string, number>;
            firstPurchaseAt: string | null;
            lastPurchaseAt: string | null;
            lastActiveAt: string | null;
        }>();
        const activity = (id: string) => {
            if (!byUser.has(id)) byUser.set(id, {
                captures: 0, alignments: 0, fusions: 0, challenges: 0, trades: 0,
                creditsPurchased: 0, creditsSpent: 0, purchaseCount: 0,
                productionPurchaseCount: 0, sandboxPurchaseCount: 0, estimatedLtvUsd: 0,
                products: {}, firstPurchaseAt: null, lastPurchaseAt: null, lastActiveAt: null
            });
            return byUser.get(id)!;
        };
        const touch = (id: string | null, date: string | null) => {
            if (!id || !date) return;
            const item = activity(id);
            if (!item.lastActiveAt || date > item.lastActiveAt) item.lastActiveAt = date;
        };

        captures.forEach((row) => { const id = string(row, "user_id"); if (id) { activity(id).captures += 1; touch(id, string(row, "created_at")); } });
        alignments.forEach((row) => { const id = string(row, "user_id"); if (id) { activity(id).alignments += 1; touch(id, string(row, "completed_at")); } });
        fusions.forEach((row) => { const id = string(row, "user_id"); if (id) { activity(id).fusions += 1; touch(id, string(row, "created_at")); } });
        challenges.forEach((row) => {
            const date = string(row, "created_at");
            [string(row, "attacker_user_id"), string(row, "defender_user_id")].forEach((id) => { if (id) { activity(id).challenges += 1; touch(id, date); } });
        });
        trades.forEach((row) => {
            const date = string(row, "resolved_at") ?? string(row, "created_at");
            [string(row, "offerer_user_id"), string(row, "receiver_user_id")].forEach((id) => { if (id) { activity(id).trades += 1; touch(id, date); } });
        });
        creditTransactions.forEach((row) => {
            const id = string(row, "user_id");
            if (!id) return;
            const delta = Number(row.delta ?? 0);
            const item = activity(id);
            if (row.reason === "purchase" && delta > 0) item.creditsPurchased += delta;
            if (delta < 0) item.creditsSpent += Math.abs(delta);
            touch(id, string(row, "created_at"));
        });
        purchases.forEach((row) => {
            const id = string(row, "user_id");
            if (!id) return;
            const item = activity(id);
            const product = string(row, "product_code") ?? string(row, "product_id") ?? "unknown";
            const date = string(row, "purchase_date") ?? string(row, "created_at");
            const production = (string(row, "environment") ?? "").toLowerCase() === "production";
            item.purchaseCount += 1;
            item.products[product] = (item.products[product] ?? 0) + 1;
            if (production) {
                item.productionPurchaseCount += 1;
                item.estimatedLtvUsd += estimatedUsd[product] ?? 0;
            } else {
                item.sandboxPurchaseCount += 1;
            }
            if (date && (!item.firstPurchaseAt || date < item.firstPurchaseAt)) item.firstPurchaseAt = date;
            if (date && (!item.lastPurchaseAt || date > item.lastPurchaseAt)) item.lastPurchaseAt = date;
            touch(id, date);
        });
        const balanceByUser = new Map(balances.map((row) => [string(row, "user_id"), Number(row.balance ?? 0)]));

        const users = profiles.map((profile) => {
            const id = String(profile.id);
            const item = activity(id);
            const sharedActivity = item.alignments + item.fusions + item.challenges + item.trades;
            return {
                id,
                email: emails.get(id) ?? null,
                displayName: profile.display_name,
                username: profile.username,
                avatarUrl: profile.avatar_url,
                isPro: profile.is_pro === true,
                joinedAt: profile.created_at,
                creditBalance: balanceByUser.get(id) ?? 0,
                ...item,
                lastActiveAt: item.lastActiveAt ?? profile.updated_at ?? profile.created_at,
                estimatedLtvUsd: Math.round(item.estimatedLtvUsd * 100) / 100,
                sharedActivity,
                activityScore: item.captures + sharedActivity + item.creditsSpent
            };
        });
        const productionBuyers = users.filter((user) => user.productionPurchaseCount > 0);

        return NextResponse.json({
            ok: true,
            users,
            summary: {
                totalUsers: users.length,
                productionBuyers: productionBuyers.length,
                payingConversion: users.length ? Math.round(productionBuyers.length / users.length * 1000) / 10 : 0,
                estimatedRevenueUsd: Math.round(productionBuyers.reduce((sum, user) => sum + user.estimatedLtvUsd, 0) * 100) / 100,
                averageEstimatedLtvUsd: productionBuyers.length ? Math.round(productionBuyers.reduce((sum, user) => sum + user.estimatedLtvUsd, 0) / productionBuyers.length * 100) / 100 : 0
            },
            pricingNote: "Estimated USD LTV uses current fallback catalog prices: 25 credits $2.99, 100 credits $7.99, and Pro $9.99 per verified production transaction. StoreKit localized proceeds, refunds, taxes, and Apple fees are not stored."
        });
    } catch (error) {
        console.error("[admin-users]", error);
        return NextResponse.json({ok: false, error: error instanceof Error ? error.message : "Unable to load users"}, {status: 500});
    }
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
