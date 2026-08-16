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

/** Keys that mean "we could not tell", which can never be evidence of a match. */
const UNIDENTIFIED_KEYS = new Set(["unknown_animal", "unknown", "unidentified_animal", "unidentified_capture", "unrecognized_animal"]);

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
    /** Entry the parent resolved through; burst children are pointed at it first. */
    parentSpeciesProfileId?: string | null;
};

async function collectCaptures(sinceDays: number) {
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

    if (!captures.length) {
        return {
            captures,
            analyses: new Map<string, Row>(),
            groups: new Map<string, {userId: string; number: number; entries: Array<{id: string; at: string; name: string | null}>}>(),
            numbers: new Map<string, number | null>()
        };
    }

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

        // Resolved for every capture, not just eligible ones: the burst pass
        // needs to know an ineligible capture's index too, or it would read a
        // capture that has one as though it had none.
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
        if (!eligibility.get(eligibilityKey) || number == null) continue;

        const groupKey = `${capture.user_id}|${number}`;
        const group = groups.get(groupKey) ?? {userId: String(capture.user_id), number, entries: []};
        group.entries.push({
            id: String(capture.id),
            at: String(capture.captured_at ?? capture.created_at),
            name: text(analysis.animal_name)
        });
        groups.set(groupKey, group);
    }

    return {captures, analyses, groups, numbers};
}

/**
 * A burst is one animal.
 *
 * Several photos taken seconds apart come back with the same animal named at
 * different depths — "Asota plana" on one and "Tiger Moth" on the next, with no
 * scientific name at all. Only the specific one earns a number, so the coarse
 * ones resolve to nothing, are ineligible for merging, and stay beside it
 * forever. No index-based rule can catch that, because the whole problem is that
 * they have no index.
 *
 * The window is necessary but nowhere near sufficient. Run on time alone it
 * proposed folding a capture named "Anura" — a frog — into a House Fly, and
 * eight "Unidentified animal" captures into a goat, because all of them happened
 * within a couple of minutes. A burst is one animal often enough to be a useful
 * hint and not nearly often enough to be a rule.
 *
 * So the name has to agree as well: a child joins only if it was given the same
 * animal name as the capture that resolved. That is what actually made the tiger
 * moths mergeable — both were called "Tiger Moth", one reaching Asota plana and
 * one stopping short — and it is what a frog beside a fly fails. Unidentified
 * captures never qualify: not knowing what something is, is not evidence that it
 * is the thing next to it.
 *
 * And the shared name has to mean something. A Canada Goose and a gull, thirty
 * seconds apart, were both shown as "Bird" — agreeing on a word that broad is no
 * agreement at all, so a name the catalog already treats as too coarse to index
 * disqualifies the burst outright.
 */
function slugifyName(name: string) {
    return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function findBursts(
    captures: Row[],
    analyses: Map<string, Row>,
    resolvedNumbers: Map<string, number | null>,
    windowSeconds: number,
    broadNames: Set<string>
) {
    const byUser = new Map<string, Row[]>();

    for (const capture of captures) {
        const userId = String(capture.user_id);
        byUser.set(userId, [...(byUser.get(userId) ?? []), capture]);
    }

    const bursts: Array<Pair & {unindexed: string[]}> = [];

    for (const [userId, owned] of Array.from(byUser)) {
        const ordered = owned
            .map((capture) => ({
                capture,
                at: new Date(String(capture.captured_at ?? capture.created_at)).getTime()
            }))
            .sort((left, right) => left.at - right.at);

        let run: typeof ordered = [];

        const flush = () => {
            if (run.length < 2) return;

            const withIndex: Array<{id: string; at: number; number: number; name: string | null; speciesProfileId: string | null}> = [];
            const candidates: Array<{id: string; name: string}> = [];

            for (const entry of run) {
                const analysis = analyses.get(String(entry.capture.id));
                if (!analysis || !analysis.completed_at || text(analysis.error_message)) continue;

                const numberKey = [analysis.species_profile_id, analysis.normalized_identity_key, analysis.scientific_name].join("|");
                const number = resolvedNumbers.get(numberKey) ?? null;
                const name = text(analysis.animal_name);
                const identityKey = text(analysis.normalized_identity_key)?.toLowerCase() ?? "";

                if (number != null) {
                    withIndex.push({
                        id: String(entry.capture.id), at: entry.at, number, name,
                        speciesProfileId: text(analysis.species_profile_id)
                    });
                    continue;
                }

                if (!name || UNIDENTIFIED_KEYS.has(identityKey)) continue;
                candidates.push({id: String(entry.capture.id), name: name.toLowerCase()});
            }

            // Exactly one index in the run: with two the burst is ambiguous and
            // the unindexed captures could belong to either.
            const distinct = new Set(withIndex.map((entry) => entry.number));
            if (distinct.size !== 1) return;

            const parent = withIndex.sort((left, right) => left.at - right.at)[0];
            const parentName = parent.name?.toLowerCase() ?? "";
            if (!parentName || broadNames.has(slugifyName(parentName))) return;

            const without = candidates.filter((candidate) => candidate.name === parentName).map((candidate) => candidate.id);
            if (!without.length) return;

            bursts.push({
                userId,
                number: parent.number,
                parentCaptureId: parent.id,
                children: [...without, ...withIndex.slice(1).map((entry) => entry.id)],
                animalName: parent.name,
                parentSpeciesProfileId: parent.speciesProfileId,
                unindexed: without
            });
        };

        for (const entry of ordered) {
            if (!run.length || entry.at - run[run.length - 1].at <= windowSeconds * 1000) run.push(entry);
            else { flush(); run = [entry]; }
        }
        flush();
    }

    return bursts.sort((left, right) => right.children.length - left.children.length);
}

async function findDuplicates(sinceDays: number) {
    const {captures, analyses, groups} = await collectCaptures(sinceDays);
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

async function findBurstDuplicates(sinceDays: number, windowSeconds: number) {
    const {captures, analyses, numbers} = await collectCaptures(sinceDays);

    // Asked of the database rather than restated here, so "too coarse to index"
    // means exactly one thing across the whole system.
    const names = Array.from(new Set(
        Array.from(analyses.values())
            .map((analysis) => text(analysis.animal_name))
            .filter(Boolean)
            .map((name) => slugifyName(name as string))
    ));
    const broadNames = new Set<string>();

    for (const name of names) {
        if (await rpc("species_profile_identity_key_is_broad", {p_key: name})) broadNames.add(name);
    }

    return {scanned: captures.length, bursts: findBursts(captures, analyses, numbers, windowSeconds, broadNames)};
}

export async function GET(request: NextRequest) {
    if (!(await isSupportAdminRequestAuthorized(request))) {
        return NextResponse.json({ok: false, error: "Unauthorized"}, {status: 401});
    }

    const days = Math.min(365, Math.max(1, Number(request.nextUrl.searchParams.get("days")) || 30));
    const windowSeconds = Math.min(600, Math.max(5, Number(request.nextUrl.searchParams.get("window")) || 120));

    try {
        if (request.nextUrl.searchParams.get("mode") === "burst") {
            const {scanned, bursts} = await findBurstDuplicates(days, windowSeconds);
            return NextResponse.json({
                ok: true,
                mode: "burst",
                days,
                windowSeconds,
                scanned,
                groups: bursts.length,
                captures: bursts.reduce((total, burst) => total + burst.children.length, 0),
                unindexed: bursts.reduce((total, burst) => total + burst.unindexed.length, 0),
                members: new Set(bursts.map((burst) => burst.userId)).size,
                bursts: bursts.slice(0, 100)
            });
        }

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

    const body = await request.json().catch(() => ({})) as {
        confirm?: boolean; days?: number; userId?: string; mode?: string; windowSeconds?: number;
    };
    if (!body.confirm) {
        return NextResponse.json({ok: false, error: "Confirm the sweep before it runs"}, {status: 400});
    }

    const days = Math.min(365, Math.max(1, Number(body.days) || 30));

    try {
        const pairs = body.mode === "burst"
            // Burst merges also need the coarse captures pointed at the entry
            // the specific one resolved to, or they would fold in still
            // holding no index of their own.
            ? (await findBurstDuplicates(days, Math.min(600, Math.max(5, Number(body.windowSeconds) || 120)))).bursts
            : (await findDuplicates(days)).pairs;
        const targets = body.userId ? pairs.filter((pair) => pair.userId === body.userId) : pairs;
        const merged: string[] = [];
        const failed: Array<{captureId: string; error: string}> = [];

        for (const pair of targets) {
            for (const child of pair.children) {
                try {
                    // complete_duplicate_capture_merge folds only captures that
                    // resolve to the same number, and a burst child resolves to
                    // none — so it is pointed at the parent's entry first. This
                    // is the Set index step, done for it.
                    if (pair.parentSpeciesProfileId) {
                        await rows(`analysis_results?capture_id=eq.${child}&species_profile_id=is.null`, {
                            method: "PATCH",
                            headers: {"Content-Type": "application/json", Prefer: "return=minimal"},
                            body: JSON.stringify({species_profile_id: pair.parentSpeciesProfileId})
                        });
                    }

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
