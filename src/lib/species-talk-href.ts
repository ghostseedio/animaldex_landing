/**
 * The chat for the species page at `path` (already without its locale), or
 * null when `path` is not a species page. `/animals/red-fox` → `/talk/red-fox`.
 */
export function speciesTalkHref(path: string): string | null {
    const match = /^\/animals\/([a-z0-9]+(?:-[a-z0-9]+)*)\/?$/.exec(path.split(/[?#]/)[0] ?? "");
    return match ? `/talk/${match[1]}` : null;
}
