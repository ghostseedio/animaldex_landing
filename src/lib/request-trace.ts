/**
 * Opt-in request-amplification tracing for local debugging.
 *
 * Enable with ANIMALDEX_TRACE_REQUESTS=1. Never logs in production — Vercel
 * Observability billing is one of the costs this work is trying to reduce.
 */
export function traceRequestAmplification(event: string, details?: Record<string, unknown>) {
    if (process.env.NODE_ENV === "production") return;
    if (process.env.ANIMALDEX_TRACE_REQUESTS !== "1") return;

    console.info(`[animaldex-request] ${event}`, details ?? {});
}
