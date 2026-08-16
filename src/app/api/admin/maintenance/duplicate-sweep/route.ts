import {NextRequest, NextResponse} from "next/server";
import {getSupabaseHeaders, getSupabaseServiceKey, getSupabaseUrl} from "@/lib/supabase-http";
import {isSupportAdminRequestAuthorized} from "@/lib/support-admin-auth";

/**
 * Merge duplicates that were never offered the chance.
 *
 * Auto-merge runs once, at analysis time, against
 * capture_duplicate_analysis_merge_eligible. A capture that was ineligible in
 * that moment — most often because its analysis carried no species_profile_id —
 * is never reconsidered, so it sits beside its twin forever even after the thing
 * that disqualified it is fixed. Repairing eligibility does not merge anything;
 * only this does.
 *
 * The pairing rule is the database's own: same owner, same effective AnimalDex
 * number, oldest capture is the parent. Nothing is merged that the pipeline
 * would not have merged itself had it been asked at the right moment.
 */

type Row = Record<string, unknown>;

const PAGE = 1000;

function config() {
    const url = getSupabaseUrl();
    const key = getSupabaseServiceKey();
    if (!url || !key) throw new Error("Supabase access is not configured");
    return {url, key};
}

async function rows(path: string, init?: RequestInit) {
    const {url, key} = config();
    const response = await fetch(`${url}/rest/v1/${path}`, {
        ...init,
        headers: getSupabaseHeaders(key, {Accept: "application/json", ...(init?.headers as Record<string, string>)}),
        cache: "no-store"
    });
    if (!response.ok) throw new Error(`${path.split("?")[0]} failed (${response.status}): ${await response.text()}`);
    const body = await response.text();
    return (body ? JSON.parse(body) : []) as Row[];
}

async function rpc(name: string, args: Record<string, unknown>) {
    const {url, key} = config();
    const response = await fetch(`${url}/rest/v1/rpc/${name}`, {
        method: "POST",
        headers: getSupabaseHeaders(key, {"Content-Type": "application/json"}),
        cache: "no-store",
        body: JSON.stringify(args)
    });
    if (!response.ok) throw new Error(`${name} failed (${response.status}): ${await response.text()}`);
    const body = await response.text();
    return body ? JSON.parse(body) : null;
}

function text(value: unknown) {
    return typeof value === "string" && value.trim() ? value.trim() : null;
}

type Pair = {
    userId: string;
    number: number;
    parentCaptureId: string;
    children: string[];
    animalName: string | null;
};

async function findDuplicates(sinceDays: number) {
    const since = new Date(Date.now() - sinceDays * 86_400_000).toISOString();
    const captures: Row[] = [];

    for (let offset = 0; offset < 50_000; offset += PAGE) {
        const batch = await rows(`captures?${new URLSearchParams({
            select: "id,user_id,created_at,captured_at",
            status: "eq.ready",
            merged_into_capture_id: "is.null",
            observation_domain_role: "eq.card",
            created_at: `gte.${since}`,
            order: "created_at.asc",
            limit: String(PAGE),
            offset: String(offset)
        })}`);
        captures.push(...batch);
        if (batch.length < PAGE) break;
    }

    if (!captures.length) return {scanned: 0, pairs: [] as Pair[]};

    const analyses = new Map<string, Row>();
    const ids = captures.map((capture) => String(capture.id));

    for (let index = 0; index < ids.length; index += 100) {
        const batch = await rows(`analysis_results?${new URLSearchParams({
            select: "capture_id,animal_name,species_profile_id,normalized_identity_key,scientific_name,identity_kind,identity_resolution_mode,confidence,completed_at,error_message",
            capture_id: `in.(${ids.slice(index, index + 100).join(",")})`
        })}`);
        for (const analysis of batch) analyses.set(String(analysis.capture_id), analysis);
    }

    // Both lookups repeat heavily across captures; the arguments are the only
    // thing that varies and both functions are stable, so cache on them.
    const eligibility = new Map<string, boolean>();
    const numbers = new Map<string, number | null>();
    const groups = new Map<string, {userId: string; number: number; entries: Array<{id: string; at: string; name: string | null}>}>();

    for (const capture of captures) {
        const analysis = analyses.get(String(capture.id));
        if (!analysis || !analysis.completed_at || text(analysis.error_message)) continue;

        const eligibilityKey = [
            analysis.identity_resolution_mode, analysis.identity_kind, analysis.confidence,
            analysis.species_profile_id, analysis.normalized_identity_key
        ].join("|");

        if (!eligibility.has(eligibilityKey)) {
            eligibility.set(eligibilityKey, Boolean(await rpc("capture_duplicate_analysis_merge_eligible", {
                p_identity_resolution_mode: analysis.identity_resolution_mode,
                p_identity_kind: analysis.identity_kind,
                p_confidence: analysis.confidence,
                p_species_profile_id: analysis.species_profile_id,
                p_normalized_identity_key: analysis.normalized_identity_key
            })));
        }

        if (!eligibility.get(eligibilityKey)) continue;

        const numberKey = [analysis.species_profile_id, analysis.normalized_identity_key, analysis.scientific_name].join("|");
        if (!numbers.has(numberKey)) {
            const value = await rpc("capture_effective_animaldex_number", {
                p_species_profile_id: analysis.species_profile_id,
                p_normalized_identity_key: analysis.normalized_identity_key,
                p_scientific_name: analysis.scientific_name
            }) as number | null;
            numbers.set(numberKey, typeof value === "number" && value >= 1 ? value : null);
        }

        const number = numbers.get(numberKey);
        if (number == null) continue;

        const groupKey = `${capture.user_id}|${number}`;
        const group = groups.get(groupKey) ?? {userId: String(capture.user_id), number, entries: []};
        group.entries.push({
            id: String(capture.id),
            at: String(capture.captured_at ?? capture.created_at),
            name: text(analysis.animal_name)
        });
        groups.set(groupKey, group);
    }

    const pairs: Pair[] = [];

    for (const group of Array.from(groups.values())) {
        if (group.entries.length < 2) continue;
        // Oldest is the parent, matching resolve_duplicate_capture_parent: it
        // holds the collection history the newer photos should fold into.
        const ordered = group.entries.sort((left, right) => left.at.localeCompare(right.at));
        pairs.push({
            userId: group.userId,
            number: group.number,
            parentCaptureId: ordered[0].id,
            children: ordered.slice(1).map((entry) => entry.id),
            animalName: ordered[0].name
        });
    }

    return {
        scanned: captures.length,
        pairs: pairs.sort((left, right) => right.children.length - left.children.length)
    };
}

export async function GET(request: NextRequest) {
    if (!(await isSupportAdminRequestAuthorized(request))) {
        return NextResponse.json({ok: false, error: "Unauthorized"}, {status: 401});
    }

    const days = Math.min(365, Math.max(1, Number(request.nextUrl.searchParams.get("days")) || 30));

    try {
        const {scanned, pairs} = await findDuplicates(days);
        return NextResponse.json({
            ok: true,
            days,
            scanned,
            groups: pairs.length,
            captures: pairs.reduce((total, pair) => total + pair.children.length, 0),
            members: new Set(pairs.map((pair) => pair.userId)).size,
            pairs: pairs.slice(0, 100)
        });
    } catch (error) {
        console.error("[admin-duplicate-sweep]", error);
        return NextResponse.json({
            ok: false,
            error: error instanceof Error ? error.message : "Unable to scan for duplicates"
        }, {status: 500});
    }
}

export async function POST(request: NextRequest) {
    if (!(await isSupportAdminRequestAuthorized(request))) {
        return NextResponse.json({ok: false, error: "Unauthorized"}, {status: 401});
    }

    const body = await request.json().catch(() => ({})) as {confirm?: boolean; days?: number; userId?: string};
    if (!body.confirm) {
        return NextResponse.json({ok: false, error: "Confirm the sweep before it runs"}, {status: 400});
    }

    const days = Math.min(365, Math.max(1, Number(body.days) || 30));

    try {
        const {pairs} = await findDuplicates(days);
        const targets = body.userId ? pairs.filter((pair) => pair.userId === body.userId) : pairs;
        const merged: string[] = [];
        const failed: Array<{captureId: string; error: string}> = [];

        for (const pair of targets) {
            for (const child of pair.children) {
                try {
                    await rpc("complete_duplicate_capture_merge", {
                        p_child_capture_id: child,
                        p_parent_capture_id: pair.parentCaptureId
                    });
                    merged.push(child);
                } catch (error) {
                    failed.push({
                        captureId: child,
                        error: error instanceof Error ? error.message.slice(0, 200) : "failed"
                    });
                }
            }
        }

        return NextResponse.json({
            ok: true,
            merged: merged.length,
            failed: failed.length,
            failures: failed.slice(0, 20)
        });
    } catch (error) {
        console.error("[admin-duplicate-sweep]", error);
        return NextResponse.json({
            ok: false,
            error: error instanceof Error ? error.message : "Unable to merge duplicates"
        }, {status: 500});
    }
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
