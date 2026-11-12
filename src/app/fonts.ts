import type {CSSProperties} from "react";
import localFont from "next/font/local";

/** Self-hosted so production builds do not download webfonts over the network. */
export const inter = localFont({
    src: [
        {
            path: "./font-files/inter-latin-wght-normal.woff2",
            weight: "500 700",
            style: "normal"
        }
    ],
    variable: "--font-inter",
    display: "swap"
});

/**
 * Only the faces the site actually sets. Every `src` entry here is preloaded on
 * every page, so this list is kept to what renders above the fold:
 * - 500 normal: `font-display` elements with no weight class inherit the body's
 *   `font-medium`.
 * - 600 normal: the home hero "WILD" word (`font-semibold`).
 * - 700 normal: the default heading weight (`font-bold`, editorial-prose).
 * - 800 normal: `font-extrabold` and `font-black` headings (900 resolves to 800).
 * No 400 face or any italic is preloaded. The 700 italic face went in the
 * 2026-11-01 performance pass (WEB-17/LCP): the home tagline that used it is
 * gone, and the one remaining italic display mark (the side-by-side generating
 * screen) renders as a synthesized oblique, as the 800 italic "VS" marks did.
 * Adding a face back means one more preload on every page.
 */
export const barlowCondensed = localFont({
    src: [
        {path: "./font-files/barlow-condensed-latin-500-normal.woff2", weight: "500", style: "normal"},
        {path: "./font-files/barlow-condensed-latin-600-normal.woff2", weight: "600", style: "normal"},
        {path: "./font-files/barlow-condensed-latin-700-normal.woff2", weight: "700", style: "normal"},
        {path: "./font-files/barlow-condensed-latin-800-normal.woff2", weight: "800", style: "normal"}
    ],
    variable: "--font-barlow-condensed",
    display: "swap"
});

/**
 * The display face's italic, the second voice (decision 245, S1's audit: the
 * old home page's italic line). One face, 600, never preloaded: only the home
 * hero's second line sets it, and next/font's size-adjusted fallback keeps
 * that line from shifting when it arrives. `font-display-italic` in Tailwind.
 */
export const barlowCondensedItalic = localFont({
    src: [{path: "./font-files/barlow-condensed-latin-600-italic.woff2", weight: "600", style: "italic"}],
    variable: "--font-barlow-condensed-italic",
    display: "swap",
    preload: false
});

/**
 * The chat's diagram panel (docs/rich-chat/SPEC.md, section 1.4): JetBrains
 * Mono (OFL, licence beside it), because a text diagram only lines up when
 * the box-drawing characters and arrows have the letters' advance, and
 * Android's monospace (Droid Sans Mono) has none of them. Never preloaded:
 * the browser fetches it only once a panel is drawn (the chat measures its
 * columns from the font's fixed 0.6 em advance, never by drawing it). No
 * size-adjusted Arial fallback either, which would misalign the diagram while
 * it loads. A 16 KB woff2 subset of the 267 KB TTF beside it (WEB-16): Latin,
 * punctuation, arrows, maths, box drawing, blocks and shapes, unhinted, no
 * layout features (a diagram wants no ligatures).
 */
export const diagramMono = localFont({
    src: [{path: "./font-files/jetbrains-mono-diagram-400-normal.woff2", weight: "400", style: "normal"}],
    variable: "--font-diagram-mono",
    display: "swap",
    preload: false,
    adjustFontFallback: false,
    fallback: ["ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"]
});

export const fontClassName = `${inter.variable} ${barlowCondensed.variable} ${barlowCondensedItalic.variable} ${diagramMono.variable}`;

export const fontCssVariables = {
    "--font-sans": "var(--font-inter)",
    "--font-display": "var(--font-barlow-condensed)"
} as CSSProperties;
