import {isDevPerfVerbose, logDevPerfEvent, shouldTraceDevPerf} from "@/lib/dev-request-timing";

/**
 * Opt-in request-amplification tracing for local debugging.
 *
 * Enable verbose tracing with ANIMALDEX_DEBUG_PERF=1 or ANIMALDEX_TRACE_REQUESTS=1.
 * Slow middleware events still log through dev-request-timing when verbose mode is on.
 */
export function traceRequestAmplification(event: string, details?: Record<string, unknown>) {
    if (process.env.NODE_ENV === "production") return;
    if (!shouldTraceDevPerf()) return;
    if (!isDevPerfVerbose() && process.env.ANIMALDEX_TRACE_REQUESTS !== "1") return;

    logDevPerfEvent("middleware", event, details);
}
