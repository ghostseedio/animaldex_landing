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

export const barlowCondensed = localFont({
    src: [
        {path: "./font-files/barlow-condensed-latin-400-normal.woff2", weight: "400", style: "normal"},
        {path: "./font-files/barlow-condensed-latin-400-italic.woff2", weight: "400", style: "italic"},
        {path: "./font-files/barlow-condensed-latin-500-normal.woff2", weight: "500", style: "normal"},
        {path: "./font-files/barlow-condensed-latin-500-italic.woff2", weight: "500", style: "italic"},
        {path: "./font-files/barlow-condensed-latin-600-normal.woff2", weight: "600", style: "normal"},
        {path: "./font-files/barlow-condensed-latin-600-italic.woff2", weight: "600", style: "italic"},
        {path: "./font-files/barlow-condensed-latin-700-normal.woff2", weight: "700", style: "normal"},
        {path: "./font-files/barlow-condensed-latin-700-italic.woff2", weight: "700", style: "italic"},
        {path: "./font-files/barlow-condensed-latin-800-normal.woff2", weight: "800", style: "normal"},
        {path: "./font-files/barlow-condensed-latin-800-italic.woff2", weight: "800", style: "italic"}
    ],
    variable: "--font-barlow-condensed",
    display: "swap"
});

export const fontClassName = `${inter.variable} ${barlowCondensed.variable}`;

export const fontCssVariables = {
    "--font-sans": "var(--font-inter)",
    "--font-display": "var(--font-barlow-condensed)"
} as CSSProperties;
