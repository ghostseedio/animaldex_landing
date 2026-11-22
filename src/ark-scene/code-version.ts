/**
 * The Ark's code version: the `?v=` every Ark script URL carries (the scene's `/ark/ark-scene.js`, the prebuild and town
 * workers).
 *
 * Why (2026-11-17): the scripts were asked for by bare URLs, and the CDN gave them `max-age=14400`, so for up to four
 * hours after a deploy a browser kept the old worker beside the new scene (the town without the dome, a place the new
 * scene did not expect) and even a hard refresh did not reach it (a worker's script is not a page subresource). A URL
 * with its build's version is a new URL after every change to the code, so `next.config.js` can let it be cached for good
 * (`immutable`) and ask again, every time, for a bare one.
 *
 * Where the version comes from:
 *  - the site (/ark and every page that mounts the scene): `NEXT_PUBLIC_ARK_CODE_V`, a content hash of the packed scene and
 *    workers, which `scripts/build-ark-bundle.mjs` computes, writes to `public/ark/ark-version.txt` and defines in the
 *    bundles, and `next.config.js` inlines in the pages (so a page and its workers are one build's);
 *  - the apps' panel (`public/ark/embed.html`, a static file): `window.ARK_CODE_V`, `?v=` and the same version, which the
 *    image's build stamps into the page (`ARK_BUILT_V`, scripts/ark-embed-stamp.mjs), which that page puts on every script
 *    it asks for and which the scene then keeps on the ones it asks for itself. (Unstamped, a local build: the page's own
 *    Last-Modified. It used to be that in the image too, until a cached `COPY public` layer kept an old file time.)
 * With neither (a test, a harness, `next dev` before the first bundle build) the URL stays bare, as it always was.
 */

/** The page's own suffix, when the page sets one (`public/ark/embed.html`). */
function pageSuffix(): string {
    const page = (globalThis as {ARK_CODE_V?: unknown}).ARK_CODE_V;
    return typeof page === "string" && page.startsWith("?v=") && page.length > 3 ? page : "";
}

/** `?v=<version>` for this page or build, or "" when there is none. */
export function arkCodeSuffix(): string {
    const page = pageSuffix();
    if (page) return page;
    // (Written out in full: Next and esbuild both replace this exact expression at build time. In a browser bundle built
    // without the define there is no `process` at all, hence the try: that is the bare URL.)
    let built = "";
    try {
        built = process.env.NEXT_PUBLIC_ARK_CODE_V ?? "";
    } catch {
        built = "";
    }
    return built ? `?v=${encodeURIComponent(built)}` : "";
}

/** An Ark script's URL with the version, unless it already carries a `v` (an address the caller versioned itself). */
export function arkCodeUrl(url: string): string {
    const suffix = arkCodeSuffix();
    if (!suffix || /[?&]v=/.test(url)) return url;
    return `${url}${url.includes("?") ? "&" : "?"}${suffix.slice(1)}`;
}
