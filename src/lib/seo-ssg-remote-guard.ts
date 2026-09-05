export function isSeoSsgRemoteForbidden() {
    return process.env.ADEX_SEO_SSG_NO_REMOTE === "1"
        || process.env.NEXT_PHASE === "phase-production-build";
}

export function assertNoRemoteDuringSeoSsg(operation: string) {
    if (!isSeoSsgRemoteForbidden()) {
        return;
    }

    throw new Error(
        `[seo-ssg] remote work is forbidden during static generation: ${operation}. ` +
        "Stable SEO pages must render from local/snapshot data only."
    );
}
