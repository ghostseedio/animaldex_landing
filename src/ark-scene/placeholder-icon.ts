/**
 * The placeholder species' slug and icon (owner decision A13): the light half of `placeholder.ts`, with no three.js,
 * so the page's panel, the tap card and the event decoders can use it without pulling the scene into the page's
 * first JavaScript (decision 246). `placeholder.ts` re-exports all of it.
 */

import {getSpeciesArtworkUrl} from "@/lib/species-artwork";

export const ARK_PLACEHOLDER_PREFIX = "placeholder--";

/** The slug a placeholder species is drawn under when the server sends none. */
export function arkPlaceholderSlug(speciesProfileId: string, fallbackId: string): string {
    const key = (speciesProfileId || fallbackId).toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 80) || "unknown";
    return `${ARK_PLACEHOLDER_PREFIX}${key}`;
}

/** A slug made up for a species the server sent with no model (no page, no icon art). */
export function isArkPlaceholderSlug(slug: string | null | undefined): boolean {
    return typeof slug === "string" && slug.startsWith(ARK_PLACEHOLDER_PREFIX);
}

/** The generic figure as a small icon, for the population panel, the tap card and the far icons. */
export const ARK_PLACEHOLDER_ICON = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><g fill="#b9a789"><ellipse cx="46" cy="52" rx="27" ry="17"/><circle cx="72" cy="35" r="11"/><path d="M64 44l8-6 4 9-9 5z"/><rect x="25" y="60" width="7" height="20" rx="3.5"/><rect x="36" y="62" width="7" height="19" rx="3.5"/><rect x="52" y="62" width="7" height="19" rx="3.5"/><rect x="62" y="60" width="7" height="20" rx="3.5"/><path d="M20 47c-6-1-9 3-10 8" stroke="#b9a789" stroke-width="5" stroke-linecap="round" fill="none"/></g><ellipse cx="44" cy="45" rx="17" ry="7" fill="#d6c8ad" opacity=".7"/></svg>`
)}`;

/** An icon image that failed to load (a species with no art yet) shows the generic figure instead. */
export function arkIconFallback(event: {currentTarget: {src: string}}) {
    if (event.currentTarget.src !== ARK_PLACEHOLDER_ICON) event.currentTarget.src = ARK_PLACEHOLDER_ICON;
}

/** A species' icon art, or the generic figure for a placeholder. */
export function arkIconUrl(slug: string): string {
    return isArkPlaceholderSlug(slug) ? ARK_PLACEHOLDER_ICON : getSpeciesArtworkUrl(slug);
}
