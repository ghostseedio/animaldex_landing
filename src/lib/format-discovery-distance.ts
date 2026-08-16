/** Mirrors the iOS `formattedDiscoveryDistance`. */
export function formatDiscoveryDistance(meters: number) {
    const clamped = Math.max(0, Math.round(meters));
    if (clamped < 1_000) return `${clamped} m`;

    const kilometers = clamped / 1_000;
    if (kilometers >= 100) return `${Math.round(kilometers).toLocaleString("en-US")} km`;
    return `${kilometers.toFixed(1)} km`;
}
