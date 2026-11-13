/**
 * /ark's poster (decision 246) and the loading screen's first frame (`lib/ark-loading.ts`): shared by the page
 * (`ark-world-tools.tsx` ArkPoster) and the apps' panel (`public/ark/embed.html`: the placeholders only, blurred).
 */

/**
 * The poster frames (decision 246): real renders of the Ark's opening view (the wild island, as a first visit opens on
 * it) at the page's full-screen size, a wide one and a phone's tall one. Re-render them with
 * `docs/ark/live-hud.md`'s recipe when the island changes a lot (and their placeholders below with them).
 */
export const ARK_POSTER = {wide: "/ark/poster/wild-wide.webp", tall: "/ark/poster/wild-tall.webp"} as const;

/**
 * The same two frames as a few hundred bytes each (32×18 and 20×40 WebP, quality 55: `sharp(poster).resize(w, h)
 * .webp({quality: 55, effort: 6})`), in the page's HTML and in `public/ark/embed.html` (the same strings, a test says):
 * painted blurred at the very first paint, before the poster itself is in, so the first thing on screen is already
 * the Ark, never a flat colour.
 */
export const ARK_POSTER_PLACEHOLDER = {
    wide: "data:image/webp;base64,UklGRswAAABXRUJQVlA4IMAAAABwBQCdASogABIAPsFOo0yno6MiMBgIAPAYCWwAnTKEfgBBEkZgYg9Eh3wsnXHUmSyTbvwAAMs+Qbsxyx85dp2j0MzKU6SY4xmBrESZ9UgHGoaTTiTzmEsK+8cU1y/3x2qihUB79rK0vAy7evaT1thczFlSnUC2ecnm3oCwsQoeXMXWFYefeVrfTfh+tlXm+t9Qqhn5UnsaBkwYZjzZlvFg/4bHyvd+n/pqI7vZS3w7UpLaX8QmpebAnwD11ZyQAAA=",
    tall: "data:image/webp;base64,UklGRiwBAABXRUJQVlA4ICABAAAQBwCdASoUACgAPsFapU8npKMiJWmY8BgJbACdMoSBtIEpituW/+LY8McrDuJESAZlzruZ0wBaR5PixmVqO9HUwADyURxnvEH+KS3VwiEDMvzuWvm/+CM4mswNuDpNaCTDcA8EeVp/kEGqXJ5xNhibqTpSo3Uuvtp5fjYYaVaPvGtV3oM23BngXZbUIwaZTbAZGlYBPixLUtS6Tva34HZw2ZPkSQxBodeDacqkmgHBxjYRYanv7F1+dMxft4HT9DEe3BMLeEWfBF2FMl248O5mbUs+UBrdgdb1b5JJrhpekOwgHOnLoVtBrVw0Ve4fdZ8nyAEABFsB3Ar4aJpUsha6F3KT6OmsVKufHA5Tx0c/VxqYi8VPQAPhvY2BciiAAAA="
} as const;

/**
 * A placeholder as an SVG that blurs it itself (`feGaussianBlur`, edges kept opaque): the browser rasterises it once into
 * a still picture. A CSS `filter: blur()` on the full-screen layer was redone on every frame the loading card animated
 * (measured: 0.5 s later to the embed's first frame on the phone profile).
 */
export function arkBlurredPlaceholder(src: string, width: number, height: number): string {
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${width} ${height}' preserveAspectRatio='xMidYMid slice'><filter id='b' x='0' y='0' width='1' height='1' color-interpolation-filters='sRGB'><feGaussianBlur stdDeviation='${(Math.min(width, height) / 18).toFixed(2)}' edgeMode='duplicate'/></filter><image width='${width}' height='${height}' preserveAspectRatio='none' filter='url(%23b)' href='${src}'/></svg>`;
    return `data:image/svg+xml;charset=utf-8,${svg.replace(/</g, "%3C").replace(/>/g, "%3E").replace(/"/g, "%22")}`;
}

/** The two placeholders, blurred (the sizes are the placeholders' own: 32×18 and 20×40). */
export const ARK_POSTER_BLURRED = {
    wide: arkBlurredPlaceholder(ARK_POSTER_PLACEHOLDER.wide, 32, 18),
    tall: arkBlurredPlaceholder(ARK_POSTER_PLACEHOLDER.tall, 20, 40)
} as const;
