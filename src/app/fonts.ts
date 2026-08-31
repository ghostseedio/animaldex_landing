import type {CSSProperties} from "react";
import {Barlow_Condensed, Inter} from "next/font/google";

export const inter = Inter({
    subsets: ["latin", "latin-ext"],
    weight: ["500", "600", "700"],
    variable: "--font-inter",
    display: "swap"
});

export const barlowCondensed = Barlow_Condensed({
    subsets: ["latin", "latin-ext"],
    weight: ["400", "500", "600", "700", "800"],
    style: ["normal", "italic"],
    variable: "--font-barlow-condensed",
    display: "swap"
});

export const fontClassName = `${inter.variable} ${barlowCondensed.variable}`;

export const fontCssVariables = {
    "--font-sans": "var(--font-inter)",
    "--font-display": "var(--font-barlow-condensed)"
} as CSSProperties;
