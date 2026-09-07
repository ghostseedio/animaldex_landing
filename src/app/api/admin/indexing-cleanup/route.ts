import {NextRequest, NextResponse} from "next/server";
import {getCaptureImageRoute} from "@/lib/capture-storage-image";
import {getSupabaseHeaders, getSupabaseServiceKey, getSupabaseUrl} from "@/lib/supabase-http";
import {isSupportAdminRequestAuthorized} from "@/lib/support-admin-auth";

/**
 * Progress for the daily unindexed-captures cron.
 *
 * The job itself lives in AnimalDex: pg_cron `index_unindexed_captures_daily`
 * POSTs to `index-unindexed-captures`, which re-runs `analyze-capture` on ready
 * captures whose species profile still has no number. This route only reads the
 * residue that job writes — run log, retry ledger, and the remaining pool —
 * so an operator can see whether it is moving without opening SQL.
 */

const RUN_LIMIT = 40;
const POOL_LIMIT = 800;
/** Matches the edge function per-invocation cap (`WORK_PER_INVOCATION`). */
const INVOCATION_BUDGET = 2;
/** Hourly cron × per-run cap. */
const DAILY_BUDGET = INVOCATION_BUDGET * 24;
const CRON_MINUTE_UTC = 15;

type Row = Record<string, unknown>;

type RunResult = {
    capture_id: string;
    animal_name: string;
    action: string;
    error: string | null;
    status: number | null;
};

type RetryState = "untouched" | "waiting" | "skipped";

type QueueCapture = {
    captureId: string;
    animalName: string;
    scientificName: string | null;
    identityKind: string | null;
    identityKey: string | null;
    completedAt: string | null;
    captureMode: string | null;
    imageUrl: string;
    attempts: number;
    lastAttemptedAt: string | null;
    skippedAt: string | null;
    retryState: RetryState;
    lastError: string | null;
    attemptHistory: Array<{
        action: string;
        error: string | null;
        status: number | null;
        at: string | null;
    }>;
};

type Bucket = {key: string; label: string; count: number};

function config() {
    const url = getSupabaseUrl();
    const key = getSupabaseServiceKey();
    if (!url || !key) throw new Error("Supabase access is not configured");
    return {url, key};
}

function missingTableMessage(status: number, body: string) {
    if (status === 404 || /does not exist|PGRST205|schema cache/i.test(body)) {
        return "Indexing cleanup tables are not on this database yet. Apply the 20260904 cron and 20260905 run-log migrations.";
    }
    return null;
}

async function rows(path: string): Promise<Row[]> {
    const {url, key} = config();
    const response = await fetch(`${url}/rest/v1/${path}`, {
        headers: getSupabaseHeaders(key, {Accept: "application/json"}),
        cache: "no-store"
    });
    if (!response.ok) {
        const body = await response.text();
        throw new Error(missingTableMessage(response.status, body) ?? `${path.split("?")[0]} query failed (${response.status})`);
    }
    return await response.json() as Row[];
}

async function count(table: string, params: string) {
    const {url, key} = config();
    const response = await fetch(`${url}/rest/v1/${table}?${params}`, {
        method: "HEAD",
        headers: getSupabaseHeaders(key, {Prefer: "count=exact", Range: "0-0"}),
        cache: "no-store"
    });
    if (!response.ok && response.status !== 416) {
        const body = await response.text();
        throw new Error(missingTableMessage(response.status, body) ?? `${table} count failed (${response.status})`);
    }
    const total = Number(response.headers.get("content-range")?.split("/")[1]);
    return Number.isFinite(total) ? total : 0;
}

const READY_CAPTURE_WHERE = [
    "completed_at=not.is.null",
    "error_message=is.null",
    "captures.status=eq.ready",
    "captures.is_discoverable=eq.true",
    "captures.merged_into_capture_id=is.null"
].join("&");

function asInt(value: unknown) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

function asText(value: unknown) {
    return typeof value === "string" && value.trim() ? value : null;
}

function asObject(value: unknown): Row {
    return value && typeof value === "object" && !Array.isArray(value) ? value as Row : {};
}

function parseResults(value: unknown): RunResult[] {
    if (!Array.isArray(value)) return [];
    return value.flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const row = item as Record<string, unknown>;
        const captureId = asText(row.capture_id);
        if (!captureId) return [];
        return [{
            capture_id: captureId,
            animal_name: asText(row.animal_name) ?? "",
            action: asText(row.action) ?? "unknown",
            error: asText(row.error),
            status: Number.isFinite(Number(row.status)) ? Number(row.status) : null
        }];
    });
}

function nextCronAt(now = new Date()) {
    const next = new Date(Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        now.getUTCHours(),
        CRON_MINUTE_UTC,
        0
    ));
    if (next <= now) next.setUTCHours(next.getUTCHours() + 1);
    return next.toISOString();
}

function isIndexedNumber(value: unknown) {
    return typeof value === "number" && Number.isFinite(value) && value >= 1;
}

function bucketize(values: string[], limit = 12): Bucket[] {
    const counts = new Map<string, number>();
    for (const value of values) {
        const key = value || "unknown";
        counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return Array.from(counts.entries())
        .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
        .slice(0, limit)
        .map(([key, count]) => ({key, label: key, count}));
}

export async function GET(request: NextRequest) {
    if (!(await isSupportAdminRequestAuthorized(request))) {
        return NextResponse.json({ok: false, error: "Unauthorized"}, {status: 401});
    }

    try {
        const [
            runRows,
            totalRuns,
            poolRows,
            attemptRows,
            unindexedProfiles,
            hiddenUnindexedProfiles
        ] = await Promise.all([
            rows(`capture_indexing_cleanup_runs?select=id,started_at,finished_at,candidates,queued,indexed,merged,skipped_forever,results,error&order=started_at.desc&limit=${RUN_LIMIT}`),
            count("capture_indexing_cleanup_runs", "select=id"),
            rows(
                `analysis_results?select=capture_id,animal_name,scientific_name,identity_kind,normalized_identity_key,completed_at,captures!inner(id,capture_mode),species_profiles(display_name,animaldex_number,normalized_identity_key,identity_kind)&${READY_CAPTURE_WHERE}&order=completed_at.asc&limit=${POOL_LIMIT}`
            ),
            rows("capture_indexing_cleanup_attempts?select=capture_id,attempts,last_attempted_at,skipped_at,permanently_skipped&limit=2000"),
            count("species_profiles", "select=id&or=(animaldex_number.is.null,animaldex_number.lt.1)"),
            count("species_profiles", "select=id&or=(animaldex_number.is.null,animaldex_number.lt.1)&catalog_status=eq.hidden").catch(() => 0)
        ]);

        const attemptsByCapture = new Map<string, {
            attempts: number;
            lastAttemptedAt: string | null;
            skippedAt: string | null;
            permanentlySkipped: boolean;
        }>();
        for (const row of attemptRows) {
            const captureId = asText(row.capture_id);
            if (!captureId) continue;
            attemptsByCapture.set(captureId, {
                attempts: asInt(row.attempts),
                lastAttemptedAt: asText(row.last_attempted_at),
                skippedAt: asText(row.skipped_at),
                permanentlySkipped: row.permanently_skipped === true
            });
        }

        const captures: QueueCapture[] = [];
        for (const row of poolRows) {
            const captureId = asText(row.capture_id);
            if (!captureId) continue;
            const profile = asObject(row.species_profiles);
            if (isIndexedNumber(profile.animaldex_number)) continue;
            const attempt = attemptsByCapture.get(captureId);
            const retryState: RetryState = attempt?.permanentlySkipped
                ? "skipped"
                : (attempt?.attempts ?? 0) > 0
                    ? "waiting"
                    : "untouched";
            const capture = asObject(row.captures);
            captures.push({
                captureId,
                animalName: asText(row.animal_name) ?? asText(profile.display_name) ?? "Unnamed",
                scientificName: asText(row.scientific_name),
                identityKind: asText(row.identity_kind) ?? asText(profile.identity_kind),
                identityKey: asText(row.normalized_identity_key) ?? asText(profile.normalized_identity_key),
                completedAt: asText(row.completed_at),
                captureMode: asText(capture.capture_mode),
                imageUrl: getCaptureImageRoute(captureId, {proxy: true}),
                attempts: attempt?.attempts ?? 0,
                lastAttemptedAt: attempt?.lastAttemptedAt ?? null,
                skippedAt: attempt?.skippedAt ?? null,
                retryState,
                lastError: null,
                attemptHistory: []
            });
        }

        const eligible = captures.filter((row) => row.retryState !== "skipped");
        const untouched = eligible.filter((row) => row.retryState === "untouched").length;
        const waiting = eligible.filter((row) => row.retryState === "waiting").length;
        const skipped = captures.filter((row) => row.retryState === "skipped").length;
        const eligibleNames = eligible.map((row) => row.animalName);
        const eligibleKinds = eligible.map((row) => row.identityKind ?? "unspecified");

        const runs = runRows.map((row) => {
            const startedAt = asText(row.started_at);
            const finishedAt = asText(row.finished_at);
            const startedMs = startedAt ? Date.parse(startedAt) : NaN;
            const finishedMs = finishedAt ? Date.parse(finishedAt) : NaN;
            const results = parseResults(row.results);
            return {
                id: asText(row.id),
                startedAt,
                finishedAt,
                durationSeconds: Number.isFinite(startedMs) && Number.isFinite(finishedMs)
                    ? Math.max(0, Math.round((finishedMs - startedMs) / 1000))
                    : null,
                candidates: asInt(row.candidates),
                queued: asInt(row.queued),
                indexed: asInt(row.indexed),
                merged: asInt(row.merged),
                skippedForever: asInt(row.skipped_forever),
                notIndexed: results.filter((result) =>
                    result.action === "not_indexed" ||
                    result.action === "failed" ||
                    result.action === "skipped_forever"
                ).length,
                running: !finishedAt,
                current: results.find((result) => result.action === "running") ?? null,
                error: asText(row.error),
                results
            };
        });

        const historyByCapture = new Map<string, QueueCapture["attemptHistory"]>();
        for (const run of [...runs].reverse()) {
            for (const result of run.results) {
                if (result.action === "running") continue;
                const list = historyByCapture.get(result.capture_id) ?? [];
                list.push({
                    action: result.action,
                    error: result.error,
                    status: result.status,
                    at: run.finishedAt ?? run.startedAt
                });
                historyByCapture.set(result.capture_id, list);
            }
        }
        for (const capture of captures) {
            const history = historyByCapture.get(capture.captureId) ?? [];
            capture.attemptHistory = history;
            capture.lastError = [...history].reverse().find((item) => item.error)?.error ?? null;
        }

        const totals = runs.reduce((acc, run) => ({
            candidates: acc.candidates + run.candidates,
            queued: acc.queued + run.queued,
            indexed: acc.indexed + run.indexed,
            merged: acc.merged + run.merged,
            skippedForever: acc.skippedForever + run.skippedForever
        }), {candidates: 0, queued: 0, indexed: 0, merged: 0, skippedForever: 0});

        const fixedSeen = new Set<string>();
        const fixedDraft = runs.flatMap((run) =>
            run.results
                .filter((result) =>
                    result.action === "indexed" ||
                    result.action === "merged" ||
                    result.action === "healed_indexed" ||
                    result.action === "healed_merged"
                )
                .map((result) => ({
                    captureId: result.capture_id,
                    animalName: result.animal_name || "Unnamed",
                    action: result.action.includes("merged") ? "merged" as const : "indexed" as const,
                    fixedAt: run.finishedAt ?? run.startedAt,
                    imageUrl: getCaptureImageRoute(result.capture_id, {proxy: true})
                }))
        ).filter((row) => {
            if (fixedSeen.has(row.captureId)) return false;
            fixedSeen.add(row.captureId);
            return true;
        });

        const fixedIds = fixedDraft.map((row) => row.captureId);
        const fixedProfiles = fixedIds.length
            ? await rows(
                `analysis_results?select=capture_id,animal_name,species_profiles(animaldex_number,display_name)&capture_id=in.(${fixedIds.join(",")})`
            )
            : [];
        const numberByCapture = new Map<string, {number: number | null; name: string | null}>();
        for (const row of fixedProfiles) {
            const captureId = asText(row.capture_id);
            if (!captureId) continue;
            const profile = asObject(row.species_profiles);
            numberByCapture.set(captureId, {
                number: isIndexedNumber(profile.animaldex_number) ? asInt(profile.animaldex_number) : null,
                name: asText(profile.display_name) ?? asText(row.animal_name)
            });
        }
        const fixed = fixedDraft.map((row) => {
            const extra = numberByCapture.get(row.captureId);
            return {
                ...row,
                animalName: extra?.name || row.animalName,
                animalDexNumber: extra?.number ?? null
            };
        });

        return NextResponse.json({
            ok: true,
            schedule: {
                cron: "15 * * * *",
                timezone: "UTC",
                dailyBudget: INVOCATION_BUDGET,
                nextRunAt: nextCronAt(),
                estimatedDaysRemaining: eligible.length > 0 ? Math.ceil(eligible.length / DAILY_BUDGET) : 0
            },
            queue: {
                eligibleCaptures: eligible.length,
                untouched,
                waiting,
                permanentlySkipped: skipped,
                unindexedCaptures: captures.length,
                unindexedProfiles,
                hiddenUnindexedProfiles,
                poolCapped: poolRows.length >= POOL_LIMIT
            },
            breakdown: {
                byRetryState: [
                    {key: "untouched", label: "Never tried", count: untouched},
                    {key: "waiting", label: "Waiting to retry", count: waiting},
                    {key: "skipped", label: "Skipped forever", count: skipped}
                ],
                byKind: bucketize(eligibleKinds),
                byName: bucketize(eligibleNames)
            },
            captures,
            fixed,
            latest: runs[0] ?? null,
            totals,
            totalRuns,
            runs,
            generatedAt: new Date().toISOString()
        });
    } catch (error) {
        console.error("[admin-indexing-cleanup]", error);
        return NextResponse.json({
            ok: false,
            error: error instanceof Error ? error.message : "Unable to read indexing cleanup progress"
        }, {status: 500});
    }
}

export async function POST(request: NextRequest) {
    if (!(await isSupportAdminRequestAuthorized(request))) {
        return NextResponse.json({ok: false, error: "Unauthorized"}, {status: 401});
    }

    try {
        const {url, key} = config();
        // Same entry point as pg_cron: queue the HTTP POST and return. Waiting
        // on index-unindexed-captures here would time out the admin route while
        // it re-analyses up to 20 captures.
        const response = await fetch(`${url}/rest/v1/rpc/dispatch_index_unindexed_captures`, {
            method: "POST",
            headers: getSupabaseHeaders(key, {
                "Content-Type": "application/json",
                Accept: "application/json"
            }),
            cache: "no-store",
            body: "{}"
        });
        if (!response.ok) {
            throw new Error(`dispatch_index_unindexed_captures failed (${response.status}): ${await response.text()}`);
        }
        return NextResponse.json({
            ok: true,
            dispatched: true,
            dailyBudget: INVOCATION_BUDGET,
            message: `Queued the same job as the daily cron (up to ${DAILY_BUDGET} captures). A new run row appears when it finishes.`
        });
    } catch (error) {
        console.error("[admin-indexing-cleanup-dispatch]", error);
        return NextResponse.json({
            ok: false,
            error: error instanceof Error ? error.message : "Unable to dispatch a manual run"
        }, {status: 500});
    }
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
