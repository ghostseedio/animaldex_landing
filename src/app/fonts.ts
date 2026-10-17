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
 * - 700 italic: the home hero tagline wraps `italic` spans inside a `font-bold`
 *   display paragraph.
 * - 800 normal: `font-extrabold` and `font-black` headings (900 resolves to 800).
 * No 400 face or 500/600 italic is used anywhere in src. The 800 italic face
 * was dropped too: its only use is two decorative, aria-hidden "VS" marks on
 * comparison pages, which the browser now renders as a synthesized oblique of
 * the 800 face. Adding a face back means one more preload on every page.
 */
export const barlowCondensed = localFont({
    src: [
        {path: "./font-files/barlow-condensed-latin-500-normal.woff2", weight: "500", style: "normal"},
        {path: "./font-files/barlow-condensed-latin-600-normal.woff2", weight: "600", style: "normal"},
        {path: "./font-files/barlow-condensed-latin-700-normal.woff2", weight: "700", style: "normal"},
        {path: "./font-files/barlow-condensed-latin-700-italic.woff2", weight: "700", style: "italic"},
        {path: "./font-files/barlow-condensed-latin-800-normal.woff2", weight: "800", style: "normal"}
    ],
    variable: "--font-barlow-condensed",
    display: "swap"
});

export const fontClassName = `${inter.variable} ${barlowCondensed.variable}`;

export const fontCssVariables = {
    "--font-sans": "var(--font-inter)",
    "--font-display": "var(--font-barlow-condensed)"
} as CSSProperties;
