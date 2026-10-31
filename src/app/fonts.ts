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

/**
 * The chat's diagram panel (docs/rich-chat/SPEC.md, section 1.4): JetBrains
 * Mono (OFL, licence beside it), because a text diagram only lines up when
 * the box-drawing characters and arrows have the letters' advance, and
 * Android's monospace (Droid Sans Mono) has none of them. Never preloaded:
 * the browser fetches it only once a panel is drawn. No size-adjusted Arial
 * fallback either, which would misalign the diagram while it loads.
 */
export const diagramMono = localFont({
    src: [{path: "./font-files/jetbrains-mono-latin-400-normal.ttf", weight: "400", style: "normal"}],
    variable: "--font-diagram-mono",
    display: "swap",
    preload: false,
    adjustFontFallback: false,
    fallback: ["ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"]
});

export const fontClassName = `${inter.variable} ${barlowCondensed.variable} ${diagramMono.variable}`;

export const fontCssVariables = {
    "--font-sans": "var(--font-inter)",
    "--font-display": "var(--font-barlow-condensed)"
} as CSSProperties;
