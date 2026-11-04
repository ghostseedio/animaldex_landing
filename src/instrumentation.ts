// Runs once when the Node server starts (experimental.instrumentationHook in
// next.config.js): logs every paid AI call into ai_usage_events
// (src/lib/ai-usage.ts, read by /admin/ai-spend).
export async function register() {
    if (process.env.NEXT_RUNTIME !== "nodejs") return;
    const {installAiUsageLogging} = await import("@/lib/ai-usage");
    installAiUsageLogging();
}
