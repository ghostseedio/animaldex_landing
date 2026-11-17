/**
 * Each species' population over time (owner, 2026-11-17: "a population line graph per species, just a line might do
 * it and a time period or something then we can see what populations have thrived in the simulation").
 *
 * The numbers are the server's record, never the scene's: `voyage_population_history_v1` (AnimalDex migration
 * 20261127180000) sums the event log (arrival, birth, back from recovery +1; died of old age, eaten, starved −1) per
 * kind and island into hour or day steps, read through `/api/ark/population?span=week|all`. A species' count at a
 * moment is its count when the answer starts plus every step up to then: exact, from the record's first row. Before
 * the record starts nothing is drawn; between steps nothing is invented (a step with no rows is the same count).
 *
 * Pure: no fetch, no DOM. /ark's population overlay and the apps' embed bars both draw from it.
 */

/** Which island a count is on (as the HUD's scope: one island, or both). */
export type ArkHistoryScope = "wild" | "town" | "both";

/** What the route answers, decoded. Times in ms. */
export type ArkHistory = {
    bucket: "hour" | "day";
    bucketMs: number;
    /** The start of the first step. */
    t0: number;
    asOf: number;
    /** The record's first row: no line before it. */
    firstAt: number;
    /** The voyage's start, for Ark days. */
    startedAt: number | null;
    /** Steps in the answer: step i covers [t0 + i·bucket, t0 + (i+1)·bucket). */
    steps: number;
    /** Per kind: its count at t0 and its rows per step, on each island. */
    kinds: Map<string, ArkKindRecord>;
    /** Kinds in the answer with none aboard now: their names (the living are named by the snapshot). */
    gone: Map<string, {name: string; slug: string | null}>;
};

/** Per island ([wild, town]): count at t0, and per step: [arrived, born, revived, died, eaten]. */
export type ArkKindRecord = {base: [number, number]; rows: Array<{step: number; island: 0 | 1; arrived: number; born: number; revived: number; died: number; eaten: number}>};

/** One species' line: `counts[i]` is the count at `times[i]` (the last is now). */
export type ArkSeries = {times: number[]; counts: number[]; arrived: number[]; born: number[]; revived: number[]; died: number[]; eaten: number[]};

export type ArkPeriod = "24h" | "7d" | "30d" | "all";
export const ARK_PERIODS: ArkPeriod[] = ["24h", "7d", "30d", "all"];
const PERIOD_MS: Record<ArkPeriod, number | null> = {"24h": 86_400_000, "7d": 7 * 86_400_000, "30d": 30 * 86_400_000, all: null};
/** Which of the route's two answers a period is drawn from. */
export function arkPeriodSpan(period: ArkPeriod): "week" | "all" {
    return period === "24h" || period === "7d" ? "week" : "all";
}

/** 1 Ark year = 14 real days (AnimalDex `voyage_ark_day`). */
export const ARK_DAY_MS = (14 * 86_400_000) / 365;
export function arkDayAt(at: number, startedAt: number | null): number | null {
    return startedAt === null || !Number.isFinite(at) ? null : Math.floor((at - startedAt) / ARK_DAY_MS);
}

type Row = Record<string, unknown>;
const num = (value: unknown): number | null => (typeof value === "number" && Number.isFinite(value) ? value : null);
const int = (value: unknown): number => {
    const n = num(value);
    return n === null ? 0 : Math.max(0, Math.round(n));
};
const time = (value: unknown): number | null => {
    const at = typeof value === "string" ? Date.parse(value) : NaN;
    return Number.isFinite(at) ? at : null;
};

/**
 * The route's answer (`{available, bucket, bucket_seconds, t0, as_of, first_at, started_at, kinds, base, steps,
 * gone}`, kinds by index) as an `ArkHistory`; null when it is not there (the server change not applied yet, a failed
 * read) or not well formed.
 */
export function decodeArkHistory(raw: unknown): ArkHistory | null {
    const body = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Row) : null;
    if (!body || body.available !== true) return null;
    const bucket = body.bucket === "day" ? "day" : body.bucket === "hour" ? "hour" : null;
    const seconds = num(body.bucket_seconds);
    const t0 = time(body.t0);
    const asOf = time(body.as_of);
    const firstAt = time(body.first_at);
    if (!bucket || !seconds || seconds <= 0 || t0 === null || asOf === null || firstAt === null || asOf < t0) return null;
    const ids = Array.isArray(body.kinds) ? body.kinds.map((id) => (typeof id === "string" ? id : "")) : null;
    if (!ids || !Array.isArray(body.base) || !Array.isArray(body.steps)) return null;
    const bucketMs = seconds * 1000;
    const steps = Math.max(1, Math.ceil((asOf - t0) / bucketMs) || 1);
    const kinds = new Map<string, ArkKindRecord>();
    const kindOf = (index: unknown): ArkKindRecord | null => {
        const id = typeof index === "number" ? ids[index] : null;
        if (!id) return null;
        let record = kinds.get(id);
        if (!record) kinds.set(id, (record = {base: [0, 0], rows: []}));
        return record;
    };
    for (const item of body.base) {
        if (!Array.isArray(item)) continue;
        const record = kindOf(item[0]);
        if (record) record.base[item[1] === 1 ? 1 : 0] += num(item[2]) ?? 0;
    }
    for (const item of body.steps) {
        if (!Array.isArray(item)) continue;
        const step = num(item[2]);
        const record = kindOf(item[0]);
        if (!record || step === null || step < 0 || step >= steps) continue;
        record.rows.push({step, island: item[1] === 1 ? 1 : 0, arrived: int(item[3]), born: int(item[4]), revived: int(item[5]), died: int(item[6]), eaten: int(item[7])});
    }
    const gone = new Map<string, {name: string; slug: string | null}>();
    const goneRaw = body.gone && typeof body.gone === "object" && !Array.isArray(body.gone) ? (body.gone as Row) : {};
    for (const [id, value] of Object.entries(goneRaw)) {
        const one = value && typeof value === "object" ? (value as Row) : null;
        const name = typeof one?.name === "string" && one.name.trim() ? one.name.trim() : null;
        if (name) gone.set(id, {name, slug: typeof one?.model_slug === "string" && one.model_slug ? one.model_slug : null});
    }
    return {bucket, bucketMs, t0, asOf, firstAt, startedAt: time(body.started_at), steps, kinds, gone};
}

/** The moments a series is drawn at: t0, the end of every step, the last one now. */
export function arkHistoryTimes(history: ArkHistory): number[] {
    const times: number[] = [];
    for (let i = 0; i <= history.steps; i++) times.push(Math.min(history.t0 + i * history.bucketMs, history.asOf));
    return times;
}

function inScope(island: 0 | 1, scope: ArkHistoryScope): boolean {
    return scope === "both" || (scope === "town") === (island === 1);
}

/**
 * One kind's line over the whole answer: point 0 is its count at t0, point i+1 its count after step i. Its rows per
 * step ride along (`arrived[i+1]` came in step i; index 0 is always 0). A kind the answer does not name had none.
 */
export function arkKindSeries(history: ArkHistory, key: string, scope: ArkHistoryScope): ArkSeries {
    const length = history.steps + 1;
    const zeros = () => new Array<number>(length).fill(0);
    const out: ArkSeries = {times: arkHistoryTimes(history), counts: zeros(), arrived: zeros(), born: zeros(), revived: zeros(), died: zeros(), eaten: zeros()};
    const record = history.kinds.get(key);
    if (!record) return out;
    const delta = zeros();
    for (const row of record.rows) {
        if (!inScope(row.island, scope)) continue;
        const at = row.step + 1;
        out.arrived[at] += row.arrived;
        out.born[at] += row.born;
        out.revived[at] += row.revived;
        out.died[at] += row.died;
        out.eaten[at] += row.eaten;
        delta[at] += row.arrived + row.born + row.revived - row.died - row.eaten;
    }
    let count = scope === "both" ? record.base[0] + record.base[1] : record.base[scope === "town" ? 1 : 0];
    for (let i = 0; i < length; i++) {
        count += delta[i];
        // Never below none (a row the read cut at its edge); the record itself never goes below.
        out.counts[i] = Math.max(0, count);
    }
    return out;
}

/** Where a period starts in a series: the point at or just before `asOf − period`, never before the record. */
export function arkPeriodStart(history: ArkHistory, period: ArkPeriod): number {
    const ms = PERIOD_MS[period];
    const from = Math.max(ms === null ? -Infinity : history.asOf - ms, history.firstAt, history.t0);
    return Math.max(0, Math.min(history.steps, Math.floor((from - history.t0) / history.bucketMs)));
}

/** A series cut to a period (its first point the count when the period began). */
export function arkSeriesSlice(series: ArkSeries, start: number): ArkSeries {
    const cut = (values: number[]) => values.slice(start);
    const out = {times: cut(series.times), counts: cut(series.counts), arrived: cut(series.arrived), born: cut(series.born), revived: cut(series.revived), died: cut(series.died), eaten: cut(series.eaten)};
    // What happened before the first point is not in the period.
    out.arrived[0] = out.born[0] = out.revived[0] = out.died[0] = out.eaten[0] = 0;
    return out;
}

export type ArkSeriesStats = {
    now: number;
    start: number;
    delta: number;
    /** Change against the start (0.25 = +25%); null from none (a kind new in the period). */
    ratio: number | null;
    peak: number;
    peakAt: number;
    low: number;
    lowAt: number;
    arrived: number;
    born: number;
    revived: number;
    died: number;
    eaten: number;
    /** It had animals in the period and has none now. */
    goneNow: boolean;
};

export function arkSeriesStats(series: ArkSeries): ArkSeriesStats {
    const counts = series.counts.length ? series.counts : [0];
    const start = counts[0];
    const now = counts[counts.length - 1];
    let peak = -Infinity;
    let low = Infinity;
    let peakAt = series.times[0] ?? 0;
    let lowAt = peakAt;
    counts.forEach((count, i) => {
        if (count > peak) {
            peak = count;
            peakAt = series.times[i] ?? peakAt;
        }
        if (count < low) {
            low = count;
            lowAt = series.times[i] ?? lowAt;
        }
    });
    const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
    return {
        now,
        start,
        delta: now - start,
        ratio: start > 0 ? (now - start) / start : null,
        peak,
        peakAt,
        low,
        lowAt,
        arrived: sum(series.arrived),
        born: sum(series.born),
        revived: sum(series.revived),
        died: sum(series.died),
        eaten: sum(series.eaten),
        goneNow: now === 0 && peak > 0
    };
}

export type ArkRanked = {key: string; stats: ArkSeriesStats; series: ArkSeries};

/**
 * Thriving (biggest growth first) or declining (biggest fall first) over a period: by the change in animals, then by
 * the change against the start, then by name order of key. Only kinds that changed; `keys` limits it to those listed
 * (the panel's rows) plus, when declining, the kinds that died out in the period.
 */
export function arkRankByChange(history: ArkHistory, scope: ArkHistoryScope, period: ArkPeriod, way: "up" | "down", keys?: Iterable<string>): ArkRanked[] {
    const start = arkPeriodStart(history, period);
    const wanted = keys ? new Set(keys) : null;
    const out: ArkRanked[] = [];
    history.kinds.forEach((_, key) => {
        if (wanted && !wanted.has(key) && !(way === "down" && history.gone.has(key))) return;
        const series = arkSeriesSlice(arkKindSeries(history, key, scope), start);
        const stats = arkSeriesStats(series);
        if (way === "up" ? stats.delta > 0 : stats.delta < 0) out.push({key, stats, series});
    });
    const sign = way === "up" ? 1 : -1;
    return out.sort((a, b) => sign * (b.stats.delta - a.stats.delta) || sign * ((b.stats.ratio ?? Infinity) - (a.stats.ratio ?? Infinity)) || a.key.localeCompare(b.key));
}

/** "+12" / "−3" / "0", and "+25%" / "−8%" / "new" (from none), as the panel says a change. */
export function arkStatsChangeText(stats: Pick<ArkSeriesStats, "delta" | "ratio">, locale?: string): {count: string; percent: string | null; up: boolean | null} {
    const count = stats.delta > 0 ? `+${stats.delta.toLocaleString(locale)}` : stats.delta < 0 ? `−${Math.abs(stats.delta).toLocaleString(locale)}` : "0";
    const up = stats.delta > 0 ? true : stats.delta < 0 ? false : null;
    if (stats.ratio === null) return {count, percent: null, up};
    const ratio = Math.abs(stats.ratio);
    const shown = new Intl.NumberFormat(locale, {style: "percent", maximumFractionDigits: ratio < 0.1 && ratio > 0 ? 1 : 0}).format(ratio);
    return {count, percent: stats.delta === 0 ? shown : `${stats.delta > 0 ? "+" : "−"}${shown}`, up};
}

/** The server's rows with each kind's id replaced by its index in `kinds`. */
export function arkCompactHistory(answer: Record<string, unknown>) {
    const kinds: string[] = [];
    const index = new Map<string, number>();
    const at = (id: unknown) => {
        const key = typeof id === "string" ? id : "";
        let i = index.get(key);
        if (i === undefined) {
            i = kinds.length;
            kinds.push(key);
            index.set(key, i);
        }
        return i;
    };
    const rows = (value: unknown) => (Array.isArray(value) ? value.filter(Array.isArray).map((row: unknown[]) => [at(row[0]), ...row.slice(1)]) : []);
    const {base, steps, ...rest} = answer;
    const compactBase = rows(base);
    const compactSteps = rows(steps);
    return {...rest, kinds, base: compactBase, steps: compactSteps};
}

export type ArkLine = {series: ArkSeries; stats: ArkSeriesStats};

/**
 * What the HUD draws for a period: each listed kind's line (and the kinds that died out), and, for Thriving or
 * Declining, the kinds in that order (null for Biggest: the panel's own order).
 */
export function arkHistoryLines(history: ArkHistory, period: ArkPeriod, keys: string[], scope: ArkHistoryScope, mode: "biggest" | "thriving" | "declining"): {lines: Map<string, ArkLine>; ranked: string[] | null} {
    const lines = new Map<string, ArkLine>();
    const start = arkPeriodStart(history, period);
    const add = (key: string) => {
        const series = arkSeriesSlice(arkKindSeries(history, key, scope), start);
        lines.set(key, {series, stats: arkSeriesStats(series)});
    };
    keys.forEach(add);
    history.gone.forEach((_, key) => add(key));
    const ranked = mode === "biggest" ? null : arkRankByChange(history, scope, period, mode === "thriving" ? "up" : "down", keys).map((one) => one.key);
    return {lines, ranked};
}

// MARK: Drawing

export type ArkLineGeometry = {d: string; area: string; points: Array<[number, number]>; min: number; max: number};

/**
 * A line through the counts in a `width` × `height` box (y down), inset by `pad`: a step line (a count holds until
 * it changes, as the record does), scaled from the lowest to the highest count (from 0 when `fromZero`). One point
 * draws flat across; a flat series sits in the middle.
 */
export function arkLinePath(counts: number[], width: number, height: number, options: {pad?: number; fromZero?: boolean} = {}): ArkLineGeometry {
    const pad = options.pad ?? 1.5;
    const values = counts.length ? counts : [0];
    let min = options.fromZero ? 0 : Math.min(...values);
    let max = Math.max(...values);
    const flat = max === min;
    if (flat) {
        min -= 1;
        max += 1;
    }
    const w = Math.max(1, width - pad * 2);
    const h = Math.max(1, height - pad * 2);
    const x = (i: number) => pad + (values.length === 1 ? (i === 0 ? 0 : w) : (w * i) / (values.length - 1));
    const y = (v: number) => pad + h - ((v - min) / (max - min)) * h;
    const points: Array<[number, number]> = values.length === 1 ? [[x(0), y(values[0])], [pad + w, y(values[0])]] : values.map((v, i) => [x(i), y(v)]);
    const r = (n: number) => Math.round(n * 10) / 10;
    let d = `M${r(points[0][0])} ${r(points[0][1])}`;
    for (let i = 1; i < points.length; i++) {
        // Hold the last count, then step: a count changes at a step, it does not drift between.
        if (points[i][1] !== points[i - 1][1]) d += `H${r(points[i][0])}V${r(points[i][1])}`;
        else if (i === points.length - 1) d += `H${r(points[i][0])}`;
    }
    const bottom = r(pad + h);
    const area = `${d}V${bottom}H${r(points[0][0])}Z`;
    return {d, area, points, min: flat ? min + 1 : min, max: flat ? max - 1 : max};
}

// MARK: Reading

const READ_KEEP_MS = 5 * 60_000;
const reads = new Map<string, {at: number; answer: Promise<ArkHistory | null>}>();

/**
 * The route's answer for a span, kept for five minutes per page (both the HUD and its graph ask). Null when the
 * route is missing, says `available: false` (the server change not applied), or fails: the caller draws no graphs.
 */
export function readArkHistory(url: string, span: "week" | "all", fetcher: (url: string) => Promise<{ok: boolean; json: () => Promise<unknown>}>, now = Date.now()): Promise<ArkHistory | null> {
    const key = `${url}|${span}`;
    const kept = reads.get(key);
    if (kept && now - kept.at < READ_KEEP_MS) return kept.answer;
    const answer = fetcher(`${url}?span=${span}`)
        .then((response) => (response.ok ? response.json() : null))
        .then(decodeArkHistory)
        .catch(() => null);
    reads.set(key, {at: now, answer});
    return answer;
}
