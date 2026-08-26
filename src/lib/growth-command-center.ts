export const growthTimezone = "Asia/Jakarta";

export type GrowthMetricKey = "users" | "captures" | "socialViews" | "searchClicks" | "activePro" | "adSpend";
export type GrowthTargets = Record<GrowthMetricKey, number>;
export type GrowthMetricStatus = "on_target" | "close" | "behind" | "future" | "no_target";

export type GrowthWeeklyTarget = {
    label: string;
    startDay: number;
    endDay: number;
    targets: GrowthTargets;
};

export type GrowthActionPlan = {
    label: string;
    startDay: number;
    endDay: number;
    items: string[];
};

export type GrowthDailyMarketing = {
    date: string;
    socialViews: number;
    searchClicks: number;
    adSpend: number;
    paidUsers: number;
    notes: string;
};

export const emptyGrowthTargets: GrowthTargets = {
    users: 0,
    captures: 0,
    socialViews: 0,
    searchClicks: 0,
    activePro: 0,
    adSpend: 0
};

function pad(value: number) {
    return String(value).padStart(2, "0");
}

export function monthKey(date: Date) {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: growthTimezone,
        year: "numeric",
        month: "2-digit"
    }).formatToParts(date);
    const year = parts.find((part) => part.type === "year")?.value ?? "1970";
    const month = parts.find((part) => part.type === "month")?.value ?? "01";
    return `${year}-${month}`;
}

export function todayKey(date = new Date()) {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: growthTimezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    }).formatToParts(date);
    return `${parts.find((part) => part.type === "year")?.value}-${parts.find((part) => part.type === "month")?.value}-${parts.find((part) => part.type === "day")?.value}`;
}

export function monthStart(month: string) {
    return `${month}-01`;
}

export function daysInMonth(month: string) {
    const [year, monthNumber] = month.split("-").map(Number);
    return new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
}

export function dateKeyForDay(month: string, day: number) {
    return `${month}-${pad(day)}`;
}

export function monthDateKeys(month: string) {
    return Array.from({length: daysInMonth(month)}, (_, index) => dateKeyForDay(month, index + 1));
}

export function jakartaDayBounds(dateKey: string) {
    return {
        startIso: `${dateKey}T00:00:00+07:00`,
        endIso: `${dateKey}T23:59:59.999+07:00`
    };
}

export function expectedByDay(target: number, day: number, totalDays: number) {
    if (target <= 0) return 0;
    return Math.round((target * Math.min(Math.max(day, 0), totalDays)) / totalDays);
}

export function cumulativeTargetByDay(target: number, totalDays: number) {
    return Array.from({length: totalDays}, (_, index) => expectedByDay(target, index + 1, totalDays));
}

export function statusForMetric(actual: number, expected: number, options?: {future?: boolean; lowerIsBudget?: boolean}) {
    if (options?.future) return "future" as const;
    if (expected <= 0) return "no_target" as const;
    if (options?.lowerIsBudget) {
        if (actual <= expected) return "on_target" as const;
        if (actual <= expected * 1.15) return "close" as const;
        return "behind" as const;
    }
    if (actual >= expected) return "on_target" as const;
    if (actual >= expected * 0.85) return "close" as const;
    return "behind" as const;
}

export function aheadBehind(actual: number, expected: number) {
    return actual - expected;
}

export function requiredPerDay(actual: number, target: number, currentDay: number, totalDays: number) {
    const remaining = Math.max(0, target - actual);
    const daysRemaining = Math.max(0, totalDays - currentDay + 1);
    return daysRemaining === 0 ? remaining : Math.ceil(remaining / daysRemaining);
}

export function weekDateRange(month: string, week: Pick<GrowthWeeklyTarget, "startDay" | "endDay">) {
    return {start: dateKeyForDay(month, week.startDay), end: dateKeyForDay(month, week.endDay)};
}

export function calendarWeeksForMonth(month: string) {
    const totalDays = daysInMonth(month);
    const weeks: Array<{label: string; startDay: number; endDay: number}> = [];
    let startDay = 1;
    while (startDay <= totalDays) {
        const endDay = Math.min(totalDays, startDay === 1 ? 6 : startDay + 6);
        weeks.push({label: `Week ${weeks.length + 1}`, startDay, endDay});
        startDay = endDay + 1;
    }
    return weeks;
}

export function splitMonthlyTargetsByCalendarWeeks(month: string, targets: GrowthTargets): GrowthWeeklyTarget[] {
    const totalDays = daysInMonth(month);
    return calendarWeeksForMonth(month).map((week) => {
        const weekDays = week.endDay - week.startDay + 1;
        const prorated = (target: number) => target > 0 ? Math.round((target * weekDays) / totalDays) : 0;
        return {
            ...week,
            targets: {
                users: prorated(targets.users),
                captures: prorated(targets.captures),
                socialViews: prorated(targets.socialViews),
                searchClicks: prorated(targets.searchClicks),
                activePro: expectedByDay(targets.activePro, week.endDay, totalDays),
                adSpend: prorated(targets.adSpend)
            }
        };
    });
}

export function normalizeTargets(input: Partial<Record<GrowthMetricKey, unknown>> | null | undefined): GrowthTargets {
    return (Object.keys(emptyGrowthTargets) as GrowthMetricKey[]).reduce((targets, key) => {
        const value = Number(input?.[key]);
        targets[key] = Number.isFinite(value) && value >= 0 ? value : 0;
        return targets;
    }, {...emptyGrowthTargets});
}

export function normalizeWeeklyTargets(input: unknown): GrowthWeeklyTarget[] {
    return Array.isArray(input) ? input.map((item, index) => {
        const row = item as Partial<GrowthWeeklyTarget>;
        return {
            label: String(row.label || `Week ${index + 1}`),
            startDay: Math.max(1, Number(row.startDay) || 1),
            endDay: Math.max(1, Number(row.endDay) || 1),
            targets: normalizeTargets(row.targets)
        };
    }) : [];
}

export function normalizeActionPlans(input: unknown): GrowthActionPlan[] {
    return Array.isArray(input) ? input.map((item, index) => {
        const row = item as Partial<GrowthActionPlan>;
        return {
            label: String(row.label || `Week ${index + 1}`),
            startDay: Math.max(1, Number(row.startDay) || 1),
            endDay: Math.max(1, Number(row.endDay) || 1),
            items: Array.isArray(row.items) ? row.items.map(String).filter(Boolean) : []
        };
    }) : [];
}
