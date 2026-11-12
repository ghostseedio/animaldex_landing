/**
 * The AnimalDex lockup (DECISIONS §5, 2026-11-01): the spiral-paw mark, then
 * "AnimalDex" set in Barlow Condensed ExtraBold, "Animal" in the page's ink
 * and "Dex" in neon. Flat: no outline, bevel, chrome or shadow.
 *
 * Geometry follows the brand rule: the mark is the cap height × 1.35 and
 * sits 0.35 × the cap height from the word (globals.css `.brand-lockup`).
 * The word is live text, so it is crisp at any size and costs no image.
 * The mark is a CSS background: only the theme's own file downloads (the
 * transparent mark on dark, the app-icon tile on light, where the art's dark
 * shading would otherwise wash out).
 *
 * `chrome`: the word as the chrome italic wordmark instead (decision 245,
 * 2026-11-12: S1's audit found the flat lockup the biggest loss of
 * distinctiveness; the site header wears it again). A 7 KB rendition of
 * `animaldex-logo-text.webp` at the header's size (`/images/brand/wordmark-chrome-*`),
 * its own dark edge reading on both themes.
 */
export default function BrandLockup({
    size = 28,
    large = false,
    className = "",
    wordClassName = "",
    chrome = false
}: {
    /**
     * The word's font size in px; everything else is derived from it. Null
     * leaves it to a responsive `[--brand-size:…]` class on `className`.
     */
    size?: number | null;
    /** Use the high-resolution mark (above ~48 px). */
    large?: boolean;
    className?: string;
    /** Extra classes on the word, e.g. to hide it on narrow screens. */
    wordClassName?: string;
    /** The chrome italic wordmark in place of the flat word. */
    chrome?: boolean;
}) {
    return (
        <span
            className={`brand-lockup${large ? " brand-lockup--lg" : ""} ${className}`}
            style={size === null ? undefined : {"--brand-size": `${size}px`} as React.CSSProperties}
        >
            <span aria-hidden="true" className="brand-mark" />
            {chrome ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                    src="/images/brand/wordmark-chrome-56.webp"
                    srcSet="/images/brand/wordmark-chrome-56.webp 2x, /images/brand/wordmark-chrome-84.webp 3x"
                    alt="AnimalDex"
                    width={128}
                    height={28}
                    className={`block h-[1.04em] w-auto ${wordClassName}`}
                />
            ) : (
                <span className={`brand-word ${wordClassName}`}>
                    <span className="brand-word-animal">Animal</span>
                    <span className="brand-word-dex">Dex</span>
                </span>
            )}
        </span>
    );
}
