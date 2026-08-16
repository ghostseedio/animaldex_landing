import {NextRequest, NextResponse} from "next/server";
import {getSupabaseHeaders, getSupabaseServiceKey, getSupabaseUrl} from "@/lib/supabase-http";
import {isSupportAdminRequestAuthorized} from "@/lib/support-admin-auth";

type Row = Record<string, unknown>;

const USER_PAGE_SIZE = 100;

function config() {
    const url = getSupabaseUrl();
    const key = getSupabaseServiceKey();
    if (!url || !key) throw new Error("Supabase access is not configured");
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

/**
 * Who a message reaches.
 *
 * Delivery is the in-app notification row, which every recipient gets, so the
 * picker lists every account. A device token only buys a push banner on top of
 * that: a user with notifications switched off has no row in user_push_tokens
 * and can still be messaged, they just will not see a banner. Device count
 * therefore rides along as a per-user attribute, and zero is a normal state.
 *
 * Both totals are returned because they answer different questions: how many
 * people will find this in their list, and how many will be interrupted by it.
 */
export async function GET(request: NextRequest) {
    if (!await isSupportAdminRequestAuthorized(request)) {
        return NextResponse.json({ok: false, error: "Unauthorized"}, {status: 401});
    }

    try {
        const search = request.nextUrl.searchParams.get("q")?.trim().toLowerCase() ?? "";

        const [tokens, profiles, recent] = await Promise.all([
            rows("user_push_tokens", "select=user_id,device_token,environment"),
            rows("profiles", "select=id,username,display_name"),
            rows("admin_notification_log", "select=id,mode,target_user_id,title,body,devices_targeted,devices_delivered,users_reached,created_at&order=created_at.desc")
        ]);

        const devicesByUser = new Map<string, number>();
        tokens.forEach((token) => {
            const id = String(token.user_id ?? "");
            if (!id) return;
            devicesByUser.set(id, (devicesByUser.get(id) ?? 0) + 1);
        });

        const matched = profiles
            .map((profile) => {
                const id = String(profile.id ?? "");
                return {
                    id,
                    devices: devicesByUser.get(id) ?? 0,
                    username: (profile.username as string | null) ?? null,
                    displayName: (profile.display_name as string | null) ?? null
                };
            })
            .filter((user) => Boolean(user.id))
            .filter((user) => !search
                || [user.id, user.username, user.displayName]
                    .some((value) => String(value ?? "").toLowerCase().includes(search)))
            .sort((a, b) => (a.displayName ?? a.username ?? a.id).localeCompare(b.displayName ?? b.username ?? b.id));

        return NextResponse.json({
            ok: true,
            summary: {
                totalProfiles: profiles.length,
                reachableUsers: devicesByUser.size,
                totalDevices: tokens.length,
                sandboxDevices: tokens.filter((token) => token.environment === "sandbox").length,
                productionDevices: tokens.filter((token) => token.environment === "production").length
            },
            // The page is a picker, not a directory: it returns the first slice and
            // reports the full match count so the operator knows to narrow the search
            // rather than scroll for someone who was never sent.
            users: matched.slice(0, USER_PAGE_SIZE),
            matches: matched.length,
            history: recent.slice(0, 25)
        }, {headers: {"Cache-Control": "private, no-store"}});
    } catch (caught) {
        return NextResponse.json({
            ok: false,
            error: caught instanceof Error ? caught.message : "Unable to load recipients"
        }, {status: 500});
    }
}

export const dynamic = "force-dynamic";
