/**
 * Measuring the Ark (AnimalDex docs/ark-next.md, Part 1): does the shared Ark
 * get more steps completed?
 *
 * Two halves, both pure so they are tested:
 *
 * 1. The events. Named as the owner named them, the same on iOS, Android and
 *    the web; the browser sends each to GA4 and to /api/ark-events, which
 *    keeps it in `web_ark_events` (landing migration 20261110130000). No
 *    property ever carries a name, a problem, a step, chat or an account:
 *    only a source, a duration, a catalog species, flags and counts.
 *
 * 2. The admin's weekly view (/admin/metrics, the Ark tab). Server tables are
 *    the source of truth where they exist: steps offered
 *    (`animal_companion_trials.set_at`), completed (`done_at`, by `outcome`),
 *    arrivals (`voyage_events` kind arrival, else `voyage_animals.arrived_at`
 *    before life v2) and arrivals seen by their owner (`ark_seen_events`).
 *    The website's events add opens by source and time in the Ark.
 */

import {buildBuckets, dayKeyOf, type Bucket} from "@/lib/product-analytics";

// MARK: - The events

export const ARK_MEASURE_EVENTS = [
    "ark_open",
    "ark_session_seconds",
    "ark_animal_tap",
    "ark_follow_animal",
    "ark_replay_viewed",
    "step_offered",
    "step_completed",
    "ark_arrival_seen",
    "ark_share"
] as const;
export type ArkMeasureEvent = (typeof ARK_MEASURE_EVENTS)[number];

/** Where the Ark was opened: the chat's panel, /ark itself, a capture card's band, or a shared link. */
export const ARK_SOURCES = ["chat_panel", "ark_page", "capture_band", "share_link"] as const;
export type ArkSource = (typeof ARK_SOURCES)[number];

export const ARK_SHARE_TARGETS = ["tap_card", "population"] as const;
export type ArkShareTarget = (typeof ARK_SHARE_TARGETS)[number];

export const ARK_STEP_OUTCOMES = ["worked", "partly", "didnt_work"] as const;
export type ArkStepOutcome = (typeof ARK_STEP_OUTCOMES)[number];

/** A session longer than this is a tab left open: it is capped, not dropped. */
export const ARK_SESSION_MAX_SECONDS = 6 * 60 * 60;

export type ArkMeasureProps = {
    source?: ArkSource;
    seconds?: number;
    species_profile_id?: string;
    is_mine?: boolean;
    events_count?: number;
    skipped?: boolean;
    outcome?: ArkStepOutcome;
    target?: ArkShareTarget;
};

/** The properties each event may carry; anything else is dropped before it leaves the browser or reaches the table. */
const ALLOWED: Record<ArkMeasureEvent, {required: Array<keyof ArkMeasureProps>; optional: Array<keyof ArkMeasureProps>}> = {
    ark_open: {required: ["source"], optional: []},
    ark_session_seconds: {required: ["source", "seconds"], optional: []},
    ark_animal_tap: {required: [], optional: ["source", "species_profile_id", "is_mine"]},
    ark_follow_animal: {required: [], optional: ["source", "species_profile_id"]},
    ark_replay_viewed: {required: ["events_count", "skipped"], optional: []},
    step_offered: {required: [], optional: ["species_profile_id"]},
    step_completed: {required: ["outcome"], optional: []},
    ark_arrival_seen: {required: [], optional: ["source", "species_profile_id"]},
    ark_share: {required: ["target"], optional: []}
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isArkMeasureEvent(value: unknown): value is ArkMeasureEvent {
    return typeof value === "string" && (ARK_MEASURE_EVENTS as readonly string[]).includes(value);
}

export function isArkSource(value: unknown): value is ArkSource {
    return typeof value === "string" && (ARK_SOURCES as readonly string[]).includes(value);
}

function wholeNumber(value: unknown, max: number): number | undefined {
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return undefined;
    return Math.min(Math.round(value), max);
}

/** One property, checked against its own vocabulary: undefined when it is off. */
function cleanProp(key: keyof ArkMeasureProps, value: unknown): ArkMeasureProps[keyof ArkMeasureProps] {
    switch (key) {
        case "source":
            return isArkSource(value) ? value : undefined;
        case "seconds":
            return wholeNumber(value, ARK_SESSION_MAX_SECONDS);
        case "species_profile_id":
            return typeof value === "string" && UUID.test(value) ? value.toLowerCase() : undefined;
        case "is_mine":
        case "skipped":
            return typeof value === "boolean" ? value : undefined;
        case "events_count":
            return wholeNumber(value, 10000);
        case "outcome":
            return typeof value === "string" && (ARK_STEP_OUTCOMES as readonly string[]).includes(value) ? value as ArkStepOutcome : undefined;
        case "target":
            return typeof value === "string" && (ARK_SHARE_TARGETS as readonly string[]).includes(value) ? value as ArkShareTarget : undefined;
    }
}

/** An event's properties with only what it may carry, or null when a required one is missing or off. */
export function arkMeasureProps(event: ArkMeasureEvent, raw: Record<string, unknown>): ArkMeasureProps | null {
    const allowed = ALLOWED[event];
    const props: Record<string, unknown> = {};
    for (const key of allowed.required) {
        const value = cleanProp(key, raw[key]);
        if (value === undefined) return null;
        props[key] = value;
    }
    for (const key of allowed.optional) {
        const value = cleanProp(key, raw[key]);
        if (value !== undefined) props[key] = value;
    }
    return props as ArkMeasureProps;
}

export type ArkMeasureReport = {event: ArkMeasureEvent; props: ArkMeasureProps; signedIn: boolean};

/** One event as the browser sent it to /api/ark-events, or null when anything about it is off. */
export function normalizeArkMeasureReport(raw: unknown): ArkMeasureReport | null {
    const body = raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, unknown> : null;
    if (!body || !isArkMeasureEvent(body.event)) return null;
    const given = body.props && typeof body.props === "object" && !Array.isArray(body.props) ? body.props as Record<string, unknown> : {};
    const props = arkMeasureProps(body.event, given);
    if (!props) return null;
    return {event: body.event, props, signedIn: body.signed_in === true};
}

/** The row /api/ark-events writes. */
export function arkMeasureRow(report: ArkMeasureReport) {
    const {props} = report;
    return {
        event: report.event,
        source: props.source ?? null,
        seconds: props.seconds ?? null,
        species_profile_id: props.species_profile_id ?? null,
        is_mine: props.is_mine ?? null,
        events_count: props.events_count ?? null,
        skipped: props.skipped ?? null,
        outcome: props.outcome ?? null,
        target: props.target ?? null,
        signed_in: report.signedIn
    };
}

/** How a step's outcome comes back from the chat ("worked", "partly", "didnt_work"), or null for none. */
export function arkStepOutcome(value: unknown): ArkStepOutcome | null {
    return typeof value === "string" && (ARK_STEP_OUTCOMES as readonly string[]).includes(value) ? value as ArkStepOutcome : null;
}

/** /ark's `?from=`: how the reader got there. A capture card's band says `capture`, a shared link `share`. */
export function arkPageSource(from: string | null | undefined): ArkSource {
    if (from === "capture") return "capture_band";
    if (from === "share") return "share_link";
    return "ark_page";
}

// MARK: - The admin's weekly view

/** The shared Ark opened to everyone on this day (Asia/Jakarta): earlier weeks are the baseline. */
export const ARK_LAUNCH_DAY = "2026-11-10";
/** The first week with steps (3.2's "Your step" went out on 2026-10-30): the baseline starts here. */
export const ARK_BASELINE_FROM = "2026-10-26";

export type ArkTrialRow = {user_id: string; set_at: string; done_at: string | null; status: string | null; outcome: string | null};
export type ArkArrivalRow = {animal_id: string; owner_user_id: string | null; arrived_at: string};
export type ArkSeenRow = {user_id: string; animal_id: string; seen_at: string; surface: string | null};
export type ArkWebEventRow = {event: string; source: string | null; seconds: number | null; created_at: string};

export type ArkMeasureInput = {
    from: string;
    to: string;
    trials: ArkTrialRow[];
    arrivals: ArkArrivalRow[];
    /** null: `ark_seen_events` is not there yet. */
    seen: ArkSeenRow[] | null;
    /** null: `web_ark_events` is not there yet. */
    events: ArkWebEventRow[] | null;
    /** Dev testers (`profiles.is_dev_tester`): left out of every person count unless asked. */
    testers: Set<string>;
    includeTesters: boolean;
};

export type ArkWeek = {
    key: string;
    label: string;
    from: string;
    to: string;
    partial: boolean;
    /** Wholly before ARK_LAUNCH_DAY. */
    baseline: boolean;
    opens: Record<ArkSource, number>;
    opensTotal: number;
    sessions: number;
    /** Mean seconds of the sessions that ended this week; null with none. */
    avgSeconds: number | null;
    taps: number;
    follows: number;
    replays: number;
    shares: number;
    offered: number;
    completed: number;
    worked: number;
    partly: number;
    didntWork: number;
    arrivals: number;
    arrivalsSeen: number;
};

export type ArkPeriod = {
    days: number;
    offered: number;
    completed: number;
    worked: number;
    arrivals: number;
    /** Per 7 days, so a short period compares with a long one; null under ARK_MIN_DAYS_FOR_RATE days. */
    completedPerWeek: number | null;
    workedPerWeek: number | null;
    /** Completed of offered, in percent, counted in the same period. */
    completionRate: number | null;
    workedRate: number | null;
};

export type ArkMeasureSummary = {
    weeks: ArkWeek[];
    baseline: ArkPeriod;
    sinceLaunch: ArkPeriod;
    /** Arrivals in the range whose owner has seen them (any time), of all arrivals with an owner. */
    arrivalsWithOwner: number;
    arrivalsSeenByOwner: number;
    testersExcluded: boolean;
};

function percent(part: number, whole: number): number | null {
    return whole > 0 ? Math.round((part / whole) * 1000) / 10 : null;
}

/** Under a week of data, a weekly rate is a guess from a day or two: none is given. */
export const ARK_MIN_DAYS_FOR_RATE = 7;

function perWeek(count: number, days: number): number | null {
    return days >= ARK_MIN_DAYS_FOR_RATE ? Math.round((count / days) * 7 * 10) / 10 : null;
}

function daySpan(from: string, to: string): number {
    if (to < from) return 0;
    return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;
}

function emptyWeek(bucket: Bucket): ArkWeek {
    return {
        key: bucket.key,
        label: bucket.label,
        from: bucket.from,
        to: bucket.to,
        partial: bucket.partial,
        baseline: bucket.to < ARK_LAUNCH_DAY,
        opens: {chat_panel: 0, ark_page: 0, capture_band: 0, share_link: 0},
        opensTotal: 0,
        sessions: 0,
        avgSeconds: null,
        taps: 0,
        follows: 0,
        replays: 0,
        shares: 0,
        offered: 0,
        completed: 0,
        worked: 0,
        partly: 0,
        didntWork: 0,
        arrivals: 0,
        arrivalsSeen: 0
    };
}

/**
 * Weekly Ark numbers from `from` to `to` (Jakarta days). Each stage is
 * counted in the week it happened: a step offered one week and done the next
 * counts as offered in the first and completed in the second. Steps "solved
 * in a debate" are recorded done with no outcome: completed, never worked.
 */
export function summarizeArkMeasure(input: ArkMeasureInput): ArkMeasureSummary {
    const {from, to, testers, includeTesters} = input;
    const counted = (userId: string | null) => includeTesters || !userId || !testers.has(userId);
    const weeks = buildBuckets(from, to, "week").map(emptyWeek);
    const weekOf = (at: string | null | undefined): ArkWeek | null => {
        if (!at) return null;
        const time = Date.parse(at);
        if (!Number.isFinite(time)) return null;
        const day = dayKeyOf(time);
        if (day < from || day > to) return null;
        return weeks.find((week) => day >= week.from && day <= week.to) ?? null;
    };

    const seconds = new Map<string, number[]>();
    for (const row of input.events ?? []) {
        const week = weekOf(row.created_at);
        if (!week) continue;
        switch (row.event) {
            case "ark_open":
                if (isArkSource(row.source)) week.opens[row.source] += 1;
                week.opensTotal += 1;
                break;
            case "ark_session_seconds":
                if (typeof row.seconds === "number" && row.seconds >= 0) seconds.set(week.key, [...(seconds.get(week.key) ?? []), Math.min(row.seconds, ARK_SESSION_MAX_SECONDS)]);
                break;
            case "ark_animal_tap":
                week.taps += 1;
                break;
            case "ark_follow_animal":
                week.follows += 1;
                break;
            case "ark_replay_viewed":
                week.replays += 1;
                break;
            case "ark_share":
                week.shares += 1;
                break;
        }
    }
    for (const week of weeks) {
        const list = seconds.get(week.key) ?? [];
        week.sessions = list.length;
        week.avgSeconds = list.length ? Math.round(list.reduce((sum, value) => sum + value, 0) / list.length) : null;
    }

    const trials = input.trials.filter((row) => counted(row.user_id));
    for (const row of trials) {
        const offered = weekOf(row.set_at);
        if (offered) offered.offered += 1;
        // `done_at` with the status done: a dropped or replaced step is not a completed one.
        if (row.done_at && (row.status === null || row.status === "done")) {
            const done = weekOf(row.done_at);
            if (!done) continue;
            done.completed += 1;
            if (row.outcome === "worked") done.worked += 1;
            else if (row.outcome === "partly") done.partly += 1;
            else if (row.outcome === "didnt_work") done.didntWork += 1;
        }
    }

    const arrivals = input.arrivals.filter((row) => counted(row.owner_user_id));
    for (const row of arrivals) {
        const week = weekOf(row.arrived_at);
        if (week) week.arrivals += 1;
    }
    const owners = new Map(arrivals.map((row) => [row.animal_id, row.owner_user_id]));
    const seenByOwner = new Set<string>();
    for (const row of input.seen ?? []) {
        // Only the owner's own sighting of an arrival counts (the RPC never records anything else).
        if (!owners.has(row.animal_id) || owners.get(row.animal_id) !== row.user_id) continue;
        seenByOwner.add(row.animal_id);
        const week = weekOf(row.seen_at);
        if (week) week.arrivalsSeen += 1;
    }

    const period = (first: string, last: string): ArkPeriod => {
        const inside = (at: string | null | undefined) => {
            if (!at) return false;
            const day = dayKeyOf(Date.parse(at));
            return day >= first && day <= last;
        };
        const offered = trials.filter((row) => inside(row.set_at)).length;
        const done = trials.filter((row) => row.done_at && (row.status === null || row.status === "done") && inside(row.done_at));
        const worked = done.filter((row) => row.outcome === "worked").length;
        const days = daySpan(first, last);
        return {
            days,
            offered,
            completed: done.length,
            worked,
            arrivals: arrivals.filter((row) => inside(row.arrived_at)).length,
            completedPerWeek: perWeek(done.length, days),
            workedPerWeek: perWeek(worked, days),
            completionRate: percent(done.length, offered),
            workedRate: percent(worked, offered)
        };
    };
    const dayBefore = dayKeyOf(Date.parse(`${ARK_LAUNCH_DAY}T12:00:00+07:00`) - 86_400_000);
    const baseline = period(from < ARK_BASELINE_FROM ? ARK_BASELINE_FROM : from, to < dayBefore ? to : dayBefore);
    const sinceLaunch = period(from > ARK_LAUNCH_DAY ? from : ARK_LAUNCH_DAY, to);
    const ranged = arrivals.filter((row) => row.owner_user_id && weekOf(row.arrived_at));

    return {
        weeks,
        baseline,
        sinceLaunch,
        arrivalsWithOwner: ranged.length,
        arrivalsSeenByOwner: ranged.filter((row) => seenByOwner.has(row.animal_id)).length,
        testersExcluded: !includeTesters
    };
}
