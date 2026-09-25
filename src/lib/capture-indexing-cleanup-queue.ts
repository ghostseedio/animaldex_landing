/**
 * The candidate contract for the unindexed-capture cleanup cron, restated for
 * the admin page.
 *
 * The worker lives in the AnimalDex repo
 * (`supabase/functions/index-unindexed-captures/candidate-discovery.ts`) and the
 * two cannot share code across repos, so they have to agree by construction
 * instead: same filters, same eligibility predicate, same two sources.
 *
 * They were allowed to drift before. Both sides used to read a fixed head window
 * of `analysis_results` ordered by `completed_at` and drop already-indexed rows
 * afterwards — the worker's window was 250 rows, the page's 800. When the oldest
 * 250 all became indexed (2026-09-07) the worker reported `candidates: 0` every
 * hour while the page still listed a backlog from its wider window, so the page
 * showed a queue that provably never moved and nothing flagged the contradiction.
 * Pushing "species profile has no animaldex_number" into the query on both sides
 * removes the window from the equation.
 */

/** A capture is indexed once its species profile holds a real catalog number. */
export function isIndexedNumber(value: unknown) {
    return typeof value === "number" && Number.isFinite(value) && value >= 1;
}

/**
 * Capture/analysis eligibility, as PostgREST query params. Mirrors the worker's
 * `.eq`/`.is`/`.not` chain.
 */
export const READY_CAPTURE_FILTERS = [
    "completed_at=not.is.null",
    "error_message=is.null",
    "captures.status=eq.ready",
    "captures.is_discoverable=eq.true",
    "captures.merged_into_capture_id=is.null"
] as const;

/**
 * Pushes "the species profile has no catalog number" into Postgres via the inner
 * embed, so indexed rows never occupy the window.
 */
export const UNINDEXED_PROFILE_FILTER =
    "species_profiles.or=(animaldex_number.is.null,animaldex_number.lt.1)";

/** Analyses with no species profile row at all are eligible too. */
export const MISSING_PROFILE_FILTER = "species_profile_id=is.null";

export type EligibleSource = "unindexed_profile" | "missing_profile";

export const ELIGIBLE_SOURCES: readonly EligibleSource[] = [
    "unindexed_profile",
    "missing_profile"
];

const POOL_SELECT_COLUMNS =
    "capture_id,animal_name,scientific_name,identity_kind,normalized_identity_key,completed_at";

/**
 * The `analysis_results` query for one eligibility source.
 *
 * `order` is total — `completed_at` alone is not unique, so a `capture_id`
 * tiebreak is what keeps a limited page stable between requests.
 */
export function eligiblePoolPath(source: EligibleSource, limit: number) {
    const select = source === "unindexed_profile"
        ? `${POOL_SELECT_COLUMNS},captures!inner(id,capture_mode),species_profiles!inner(display_name,animaldex_number,normalized_identity_key,identity_kind)`
        : `${POOL_SELECT_COLUMNS},captures!inner(id,capture_mode)`;
    const sourceFilter = source === "unindexed_profile"
        ? UNINDEXED_PROFILE_FILTER
        : MISSING_PROFILE_FILTER;
    return [
        `analysis_results?select=${select}`,
        ...READY_CAPTURE_FILTERS,
        sourceFilter,
        "order=completed_at.asc,capture_id.asc",
        `limit=${limit}`
    ].join("&");
}

/** HEAD-count path for one source, so the backlog total is not a window sample. */
export function eligibleCountPath(source: EligibleSource) {
    const select = source === "unindexed_profile"
        ? "capture_id,captures!inner(id),species_profiles!inner(id)"
        : "capture_id,captures!inner(id)";
    const sourceFilter = source === "unindexed_profile"
        ? UNINDEXED_PROFILE_FILTER
        : MISSING_PROFILE_FILTER;
    return [`select=${select}`, ...READY_CAPTURE_FILTERS, sourceFilter].join("&");
}

type PoolRow = Record<string, unknown> & {capture_id?: unknown; completed_at?: unknown};

/**
 * Merges the two sources into one deterministic, de-duplicated list, ordered the
 * way the worker orders its pool: oldest analysis first, `capture_id` breaking
 * ties.
 */
export function mergeEligiblePoolRows<T extends PoolRow>(sources: T[][]): T[] {
    const seen = new Set<string>();
    const merged: T[] = [];
    for (const rows of sources) {
        for (const row of rows) {
            const captureId = typeof row.capture_id === "string" ? row.capture_id : "";
            if (!captureId || seen.has(captureId)) continue;
            seen.add(captureId);
            merged.push(row);
        }
    }
    return merged.sort((left, right) => {
        const leftDone = typeof left.completed_at === "string" ? left.completed_at : "";
        const rightDone = typeof right.completed_at === "string" ? right.completed_at : "";
        if (leftDone !== rightDone) return leftDone < rightDone ? -1 : 1;
        const leftId = String(left.capture_id ?? "");
        const rightId = String(right.capture_id ?? "");
        return leftId < rightId ? -1 : leftId > rightId ? 1 : 0;
    });
}
