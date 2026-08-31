type DevPerfStep = {
    name: string;
    ms: number;
    at: string;
    meta?: Record<string, unknown>;
};

export type DevRequestTimer = {
    scope: string;
    requestId: string;
    startedAt: number;
    steps: DevPerfStep[];
};

const SLOW_STEP_MS = 250;
const SLOW_TOTAL_MS = 1000;

function perfNow() {
    return typeof performance !== "undefined" ? performance.now() : Date.now();
}

function isoTimestamp() {
    return new Date().toISOString();
}

function formatMs(ms: number) {
    return `${ms.toFixed(1)}ms`;
}

export function isDevPerfVerbose() {
    return process.env.NODE_ENV !== "production"
        && (process.env.ANIMALDEX_DEBUG_PERF === "1" || process.env.ANIMALDEX_TRACE_REQUESTS === "1");
}

export function shouldTraceDevPerf() {
    return process.env.NODE_ENV !== "production";
}

function createRequestId() {
    return Math.random().toString(36).slice(2, 10);
}

export function createDevRequestTimer(scope: string, meta?: Record<string, unknown>): DevRequestTimer | null {
    if (!shouldTraceDevPerf()) return null;

    const timer: DevRequestTimer = {
        scope,
        requestId: createRequestId(),
        startedAt: perfNow(),
        steps: []
    };

    if (isDevPerfVerbose()) {
        console.info(`[adex-perf] ${isoTimestamp()} START ${scope}#${timer.requestId}`, meta ?? {});
    }

    return timer;
}

export function logDevPerfEvent(scope: string, event: string, meta?: Record<string, unknown>) {
    if (!shouldTraceDevPerf()) return;
    console.info(`[adex-perf] ${isoTimestamp()} ${scope} ${event}`, meta ?? {});
}

export async function timeDevStep<T>(
    timer: DevRequestTimer | null,
    name: string,
    fn: () => Promise<T> | T,
    meta?: Record<string, unknown>
): Promise<T> {
    if (!timer) return fn();

    const startedAt = perfNow();
    try {
        return await fn();
    } finally {
        const ms = perfNow() - startedAt;
        const step: DevPerfStep = {name, ms, at: isoTimestamp(), meta};
        timer.steps.push(step);

        if (isDevPerfVerbose() || ms >= SLOW_STEP_MS) {
            const label = `[adex-perf] ${step.at} STEP ${timer.scope}#${timer.requestId}.${name} ${formatMs(ms)}`;
            if (ms >= SLOW_STEP_MS) console.warn(label, meta ?? {});
            else console.info(label, meta ?? {});
        }
    }
}

export async function timeDevAsync<T>(
    scope: string,
    name: string,
    fn: () => Promise<T> | T,
    meta?: Record<string, unknown>
): Promise<T> {
    const timer = createDevRequestTimer(scope, meta);
    try {
        return await timeDevStep(timer, name, fn);
    } finally {
        finishDevRequestTimer(timer);
    }
}

export function finishDevRequestTimer(timer: DevRequestTimer | null, meta?: Record<string, unknown>) {
    if (!timer || !shouldTraceDevPerf()) return;

    const totalMs = perfNow() - timer.startedAt;
    const summary = {
        requestId: timer.requestId,
        totalMs: Math.round(totalMs),
        steps: timer.steps.map((step) => ({
            name: step.name,
            ms: Math.round(step.ms),
            ...(step.meta ?? {})
        })),
        ...(meta ?? {})
    };

    const label = `[adex-perf] ${isoTimestamp()} END ${timer.scope}#${timer.requestId} ${formatMs(totalMs)}`;
    if (totalMs >= SLOW_TOTAL_MS || isDevPerfVerbose()) {
        if (totalMs >= SLOW_TOTAL_MS) console.warn(label, summary);
        else console.info(label, summary);
    }
}

export function logDevModuleReady(moduleName: string, loadedAtMs: number) {
    if (!shouldTraceDevPerf()) return;
    const gapMs = perfNow() - loadedAtMs;
    if (gapMs >= SLOW_STEP_MS || isDevPerfVerbose()) {
        console.info(`[adex-perf] ${isoTimestamp()} MODULE ${moduleName} ready after ${formatMs(gapMs)} since import`);
    }
}
