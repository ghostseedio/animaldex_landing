import {NextRequest, NextResponse} from "next/server";
import {getSupabaseHeaders, getSupabaseServiceKey, getSupabaseUrl} from "@/lib/supabase-http";
import {isSupportAdminRequestAuthorized} from "@/lib/support-admin-auth";

type Row = Record<string, unknown>;

const SAMPLE_SIZE = 8;
const SEGMENT_SEND_CAP = 500;

const SEGMENT_DEFS = [
    {
        id: "new_no_captures",
        label: "New, no captures",
        description: "Account age ≤ 14 days with zero captures."
    },
    {
        id: "zero_captures",
        label: "Zero captures",
        description: "Any age, still zero captures."
    },
    {
        id: "burst_active",
        label: "Burst active",
        description: "≥ 8 captures in the last 3 days."
    },
    {
        id: "cooling_off",
        label: "Cooling off",
        description: "≥ 20 lifetime captures, ≤ 2 in the last 14 days."
    },
    {
        id: "no_wild_profile",
        label: "No Wild Profile",
        description: "Never completed a Wild Profile (no user_identity_profiles row)."
    },
    {
        id: "zero_credits_active",
        label: "Zero credits, active",
        description: "Wallet balance is 0 and they have at least one capture."
    },
    {
        id: "never_bought",
        label: "Never bought",
        description: "creditsPurchased = 0 but wallet balance is still above 0."
    },
    {
        id: "likely_bots",
        label: "Likely bots",
        description:
            "Heuristic, not a classifier: (≥ 5 captures within 2 hours of signup) OR (≥ 3 analyses with non-live authenticity in the last 7 days)."
    }
] as const;

type SegmentId = (typeof SEGMENT_DEFS)[number]["id"];

function config() {
    const url = getSupabaseUrl();
    const key = getSupabaseServiceKey();
    if (!url || !key) throw new Error("Supabase service access is not configured");
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
        // Segments remain useful without Auth admin emails.
    }
    return emailById;
}

function string(row: Row, key: string) {
    const value = row[key];
    return typeof value === "string" ? value : null;
}

function number(row: Row, key: string) {
    const value = row[key];
    return typeof value === "number" && Number.isFinite(value) ? value : Number(value ?? 0) || 0;
}

function ms(iso: string | null) {
    if (!iso) return NaN;
    return new Date(iso).getTime();
}

function modalCountry(codes: string[]): string {
    if (codes.length === 0) return "unknown";
    const counts = new Map<string, number>();
    for (const code of codes) {
        const key = code || "unknown";
        counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    let best = "unknown";
    let bestCount = -1;
    for (const [code, count] of Array.from(counts.entries())) {
        if (count > bestCount || (count === bestCount && code < best)) {
            best = code;
            bestCount = count;
        }
    }
    return best;
}

type UserAgg = {
    id: string;
    name: string | null;
    email: string | null;
    createdAt: string;
    captures: number;
    capturesLast3d: number;
    capturesLast14d: number;
    capturesWithin2hOfSignup: number;
    countryCodes: string[];
    balance: number;
    creditsPurchased: number;
    hasWildProfile: boolean;
    nonLiveAnalysesLast7d: number;
    devices: number;
};

function buildSegmentPayload(
    id: SegmentId | string,
    label: string,
    description: string,
    members: UserAgg[],
) {
    const sorted = [...members].sort((a, b) => b.captures - a.captures || a.id.localeCompare(b.id));
    const userIds = sorted.map((user) => user.id);
    return {
        id,
        label,
        description,
        count: userIds.length,
        reachableDevices: members.reduce((sum, user) => sum + user.devices, 0),
        sendCap: SEGMENT_SEND_CAP,
        truncatedForSend: userIds.length > SEGMENT_SEND_CAP,
        userIds: userIds.slice(0, SEGMENT_SEND_CAP),
        sampleUsers: sorted.slice(0, SAMPLE_SIZE).map((user) => ({
            id: user.id,
            name: user.name,
            email: user.email,
            captures: user.captures
        }))
    };
}

export async function GET(request: NextRequest) {
    if (!(await isSupportAdminRequestAuthorized(request))) {
        return NextResponse.json({ok: false, error: "Unauthorized"}, {status: 401});
    }

    try {
        const now = Date.now();
        const day14AgoMs = now - 14 * 86400000;
        const day3AgoMs = now - 3 * 86400000;
        const day7Ago = new Date(now - 7 * 86400000).toISOString();

        const [profiles, captures, balances, purchases, identityProfiles, tokens, nonLiveAnalyses, emails] =
            await Promise.all([
                rows("profiles", "select=id,display_name,username,created_at&order=created_at.desc"),
                rows("captures", "select=user_id,created_at,location_country_code"),
                rows("credit_balances", "select=user_id,balance"),
                rows("credit_transactions", "select=user_id,delta,reason&reason=eq.purchase&delta=gt.0"),
                rows("user_identity_profiles", "select=user_id"),
                rows("user_push_tokens", "select=user_id"),
                rows(
                    "analysis_results",
                    "select=completed_at,captures!inner(user_id)"
                        + `&completed_at=gte.${encodeURIComponent(day7Ago)}`
                        + `&${encodeURIComponent("raw_json->model->>authenticity_status")}=eq.likely_non_live_source`
                ),
                authEmails()
            ]);

        const byUser = new Map<string, UserAgg>();
        for (const row of profiles) {
            const id = string(row, "id");
            if (!id) continue;
            const displayName = string(row, "display_name");
            const username = string(row, "username");
            byUser.set(id, {
                id,
                name: displayName || username,
                email: emails.get(id) ?? null,
                createdAt: string(row, "created_at") ?? "",
                captures: 0,
                capturesLast3d: 0,
                capturesLast14d: 0,
                capturesWithin2hOfSignup: 0,
                countryCodes: [],
                balance: 0,
                creditsPurchased: 0,
                hasWildProfile: false,
                nonLiveAnalysesLast7d: 0,
                devices: 0
            });
        }

        for (const row of captures) {
            const id = string(row, "user_id");
            if (!id) continue;
            const user = byUser.get(id);
            if (!user) continue;
            const createdAt = string(row, "created_at");
            const createdMs = ms(createdAt);
            user.captures += 1;
            if (Number.isFinite(createdMs)) {
                if (createdMs >= day3AgoMs) user.capturesLast3d += 1;
                if (createdMs >= day14AgoMs) user.capturesLast14d += 1;
                const signupMs = ms(user.createdAt);
                if (Number.isFinite(signupMs) && createdMs - signupMs <= 2 * 3600000 && createdMs >= signupMs) {
                    user.capturesWithin2hOfSignup += 1;
                }
            }
            const country = string(row, "location_country_code");
            user.countryCodes.push(country ? country.toUpperCase() : "unknown");
        }

        for (const row of balances) {
            const id = string(row, "user_id");
            const user = id ? byUser.get(id) : undefined;
            if (user) user.balance = number(row, "balance");
        }

        for (const row of purchases) {
            const id = string(row, "user_id");
            const user = id ? byUser.get(id) : undefined;
            if (user) user.creditsPurchased += number(row, "delta");
        }

        for (const row of identityProfiles) {
            const id = string(row, "user_id");
            const user = id ? byUser.get(id) : undefined;
            if (user) user.hasWildProfile = true;
        }

        for (const row of tokens) {
            const id = string(row, "user_id");
            const user = id ? byUser.get(id) : undefined;
            if (user) user.devices += 1;
        }

        for (const row of nonLiveAnalyses) {
            const capture = row.captures as Row | Row[] | null | undefined;
            const captureRow = Array.isArray(capture) ? capture[0] : capture;
            const id = captureRow ? string(captureRow, "user_id") : null;
            const user = id ? byUser.get(id) : undefined;
            if (user) user.nonLiveAnalysesLast7d += 1;
        }

        const allUsers = Array.from(byUser.values());
        const membersOf: Record<SegmentId, UserAgg[]> = {
            new_no_captures: [],
            zero_captures: [],
            burst_active: [],
            cooling_off: [],
            no_wild_profile: [],
            zero_credits_active: [],
            never_bought: [],
            likely_bots: []
        };

        const activityBuckets = {zero: 0, oneToFive: 0, sixToTwenty: 0, twentyOnePlus: 0};
        const countryMembers = new Map<string, UserAgg[]>();

        for (const user of allUsers) {
            const ageMs = now - ms(user.createdAt);
            if (user.captures === 0) {
                membersOf.zero_captures.push(user);
                if (Number.isFinite(ageMs) && ageMs <= 14 * 86400000) membersOf.new_no_captures.push(user);
            }
            if (user.capturesLast3d >= 8) membersOf.burst_active.push(user);
            if (user.captures >= 20 && user.capturesLast14d <= 2) membersOf.cooling_off.push(user);
            if (!user.hasWildProfile) membersOf.no_wild_profile.push(user);
            if (user.balance === 0 && user.captures >= 1) membersOf.zero_credits_active.push(user);
            if (user.creditsPurchased === 0 && user.balance > 0) membersOf.never_bought.push(user);
            if (user.capturesWithin2hOfSignup >= 5 || user.nonLiveAnalysesLast7d >= 3) {
                membersOf.likely_bots.push(user);
            }

            if (user.captures === 0) activityBuckets.zero += 1;
            else if (user.captures <= 5) activityBuckets.oneToFive += 1;
            else if (user.captures <= 20) activityBuckets.sixToTwenty += 1;
            else activityBuckets.twentyOnePlus += 1;

            const country = modalCountry(user.countryCodes);
            if (!countryMembers.has(country)) countryMembers.set(country, []);
            countryMembers.get(country)!.push(user);
        }

        const segments = SEGMENT_DEFS.map((def) =>
            buildSegmentPayload(def.id, def.label, def.description, membersOf[def.id])
        );

        const countries = Array.from(countryMembers.entries())
            .map(([code, members]) => buildSegmentPayload(
                `country:${code}`,
                code === "unknown" ? "Unknown country" : code,
                code === "unknown"
                    ? "Users whose captures have no modal location_country_code."
                    : `Users whose most common capture country is ${code}.`,
                members
            ))
            .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

        const maxSegment = Math.max(1, ...segments.map((segment) => segment.count));
        const maxCountry = Math.max(1, ...countries.slice(0, 12).map((country) => country.count));

        return NextResponse.json({
            ok: true,
            generatedAt: new Date().toISOString(),
            summary: {
                totalUsers: allUsers.length,
                totalCaptures: captures.length,
                sendCap: SEGMENT_SEND_CAP
            },
            overview: {
                segmentBars: segments.map((segment) => ({
                    id: segment.id,
                    label: segment.label,
                    count: segment.count,
                    pct: Math.round((segment.count / maxSegment) * 100)
                })),
                countryBars: countries.slice(0, 12).map((country) => ({
                    id: country.id,
                    label: country.label,
                    count: country.count,
                    pct: Math.round((country.count / maxCountry) * 100)
                })),
                activityBuckets: [
                    {id: "0", label: "0 captures", count: activityBuckets.zero},
                    {id: "1-5", label: "1–5 captures", count: activityBuckets.oneToFive},
                    {id: "6-20", label: "6–20 captures", count: activityBuckets.sixToTwenty},
                    {id: "21+", label: "21+ captures", count: activityBuckets.twentyOnePlus}
                ]
            },
            segments,
            countries
        });
    } catch (caught) {
        return NextResponse.json({
            ok: false,
            error: caught instanceof Error ? caught.message : "Unable to load segments"
        }, {status: 500});
    }
}

export const dynamic = "force-dynamic";
