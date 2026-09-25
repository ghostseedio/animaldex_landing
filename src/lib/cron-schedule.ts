/**
 * Reading a pg_cron schedule well enough to say whether a job is late.
 *
 * This is not a cron implementation and does not try to be one: it answers the
 * single question /admin/jobs asks, which is "roughly how often should this
 * have run?". Every schedule AnimalDex actually uses is covered — pg_cron's
 * interval syntax (`5 seconds`), every-N-minutes, hourly at a fixed minute,
 * and daily at a fixed time. Anything else returns null, and the page then
 * shows the last run without claiming to know whether one is overdue, which is
 * the honest answer rather than a guess dressed up as a red dot.
 */

export type JobStatus = "healthy" | "failing" | "late" | "never-run" | "paused" | "unknown";

const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 60 * SECONDS_PER_MINUTE;
const SECONDS_PER_DAY = 24 * SECONDS_PER_HOUR;

/**
 * How many seconds are meant to pass between two runs, or null when the
 * schedule is richer than the cases below.
 */
export function expectedIntervalSeconds(schedule: string | null | undefined): number | null {
    if (!schedule) return null;
    const value = schedule.trim().toLowerCase();
    if (!value) return null;

    // pg_cron's sub-minute syntax, e.g. "5 seconds".
    const interval = /^(\d+)\s+(second|seconds|minute|minutes|hour|hours)$/.exec(value);
    if (interval) {
        const amount = Number(interval[1]);
        if (amount <= 0) return null;
        if (interval[2].startsWith("second")) return amount;
        if (interval[2].startsWith("minute")) return amount * SECONDS_PER_MINUTE;
        return amount * SECONDS_PER_HOUR;
    }

    const fields = value.split(/\s+/);
    if (fields.length !== 5) return null;
    const [minute, hour, dayOfMonth, month, dayOfWeek] = fields;

    // Anything narrowing the day is outside what this page needs to judge.
    if (dayOfMonth !== "*" || month !== "*" || dayOfWeek !== "*") return null;

    if (hour === "*") {
        if (minute === "*") return SECONDS_PER_MINUTE;
        const everyNMinutes = /^\*\/(\d+)$/.exec(minute);
        if (everyNMinutes) {
            const step = Number(everyNMinutes[1]);
            return step > 0 ? step * SECONDS_PER_MINUTE : null;
        }
        // A fixed minute of every hour, e.g. "15 * * * *".
        if (/^\d+$/.test(minute)) return SECONDS_PER_HOUR;
        return null;
    }

    const everyNHours = /^\*\/(\d+)$/.exec(hour);
    if (everyNHours && /^\d+$/.test(minute)) {
        const step = Number(everyNHours[1]);
        return step > 0 ? step * SECONDS_PER_HOUR : null;
    }

    // A fixed time each day, e.g. "47 3 * * *".
    if (/^\d+$/.test(hour) && /^\d+$/.test(minute)) return SECONDS_PER_DAY;

    return null;
}

/** The schedule as an operator would say it, for the table's second column. */
export function describeSchedule(schedule: string | null | undefined): string {
    if (!schedule) return "Unknown";
    const value = schedule.trim();
    const seconds = expectedIntervalSeconds(value);

    const fields = value.toLowerCase().split(/\s+/);
    if (fields.length === 5) {
        const [minute, hour, dayOfMonth, month, dayOfWeek] = fields;
        if (dayOfMonth === "*" && month === "*" && dayOfWeek === "*") {
            if (/^\d+$/.test(hour) && /^\d+$/.test(minute)) {
                return `Daily at ${hour.padStart(2, "0")}:${minute.padStart(2, "0")} UTC`;
            }
            if (hour === "*" && /^\d+$/.test(minute)) return `Hourly at :${minute.padStart(2, "0")}`;
        }
    }

    if (seconds == null) return value;
    if (seconds < SECONDS_PER_MINUTE) return `Every ${seconds}s`;
    if (seconds < SECONDS_PER_HOUR) return `Every ${Math.round(seconds / SECONDS_PER_MINUTE)}m`;
    if (seconds < SECONDS_PER_DAY) return `Every ${Math.round(seconds / SECONDS_PER_HOUR)}h`;
    return "Daily";
}

/**
 * How long past its interval a job may go before it is called late.
 *
 * A fixed multiple is wrong at both ends of this fleet: a 5-second drainer that
 * is 15 seconds late is normal jitter, while a daily prune 15 seconds late is
 * not worth a colour. The grace is generous for fast jobs, where one slow tick
 * means nothing, and tight for slow ones, where a missed run is the whole
 * signal. The floor keeps a 5-second job from alerting on a single hiccup.
 */
export function lateAfterSeconds(intervalSeconds: number): number {
    if (intervalSeconds <= SECONDS_PER_MINUTE) return Math.max(intervalSeconds * 6, 60);
    if (intervalSeconds <= SECONDS_PER_HOUR) return intervalSeconds * 3;
    return intervalSeconds * 1.5;
}

export type JobHealthInput = {
    active: boolean;
    schedule: string | null;
    lastStatus: string | null;
    lastStartTime: string | null;
    failuresInWindow: number;
};

/**
 * One job's state, decided in the order an operator would care about it: a
 * paused job is not failing, a job that has never run is not late, and a job
 * whose last tick failed is reported as failing even if it is running on time.
 */
export function jobStatus(input: JobHealthInput, now: Date = new Date()): {status: JobStatus; secondsSinceLastRun: number | null; lateBySeconds: number | null} {
    const lastStart = input.lastStartTime ? new Date(input.lastStartTime) : null;
    const secondsSinceLastRun =
        lastStart && !Number.isNaN(lastStart.getTime()) ? Math.max(0, Math.round((now.getTime() - lastStart.getTime()) / 1000)) : null;

    if (!input.active) return {status: "paused", secondsSinceLastRun, lateBySeconds: null};
    if (secondsSinceLastRun == null) return {status: "never-run", secondsSinceLastRun: null, lateBySeconds: null};

    const interval = expectedIntervalSeconds(input.schedule);
    const threshold = interval == null ? null : lateAfterSeconds(interval);
    const lateBySeconds = threshold != null && secondsSinceLastRun > threshold ? Math.round(secondsSinceLastRun - threshold) : null;

    // A failing last run outranks lateness: it is the more specific fact, and
    // a job that errors fast is usually also on time.
    if (input.lastStatus && input.lastStatus !== "succeeded" && input.lastStatus !== "running") {
        return {status: "failing", secondsSinceLastRun, lateBySeconds};
    }
    if (lateBySeconds != null) return {status: "late", secondsSinceLastRun, lateBySeconds};
    if (interval == null && !input.lastStatus) return {status: "unknown", secondsSinceLastRun, lateBySeconds: null};
    return {status: "healthy", secondsSinceLastRun, lateBySeconds: null};
}

/** "4m ago", "2h ago" — short enough for a dense table. */
export function shortAgo(seconds: number | null): string {
    if (seconds == null) return "Never";
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < SECONDS_PER_HOUR) return `${Math.round(seconds / 60)}m ago`;
    if (seconds < SECONDS_PER_DAY) return `${Math.round(seconds / SECONDS_PER_HOUR)}h ago`;
    return `${Math.round(seconds / SECONDS_PER_DAY)}d ago`;
}
