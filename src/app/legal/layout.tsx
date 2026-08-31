import "@/app/[locale]/_assets/globals.css";
import React, {ReactNode} from "react";
import {Metadata} from "next";
import {fontClassName, fontCssVariables} from "@/app/fonts";
import GoogleAnalytics from "@/components/analytics/google-analytics";
import {getSiteUrl} from "@/lib/site";

export const metadata: Metadata = {
    metadataBase: new URL(getSiteUrl()),
    applicationName: "AnimalDex",
    generator: "Next.js",
    other: {
        "apple-itunes-app": "app-id=6761607780"
    },
    colorScheme: "dark",
    themeColor: "#21C05E",
    icons: {
        icon: [
            {url: "/favicon.ico"},
            {url: "/favicon-32x32.png", sizes: "32x32", type: "image/png"},
            {url: "/favicon-16x16.png", sizes: "16x16", type: "image/png"}
        ],
        shortcut: "/favicon.ico",
        apple: "/apple-touch-icon.png"
    },
    manifest: "/site.webmanifest"
};

export default function PublicLegalLayout({children}: { children: ReactNode }) {
    return (
        <html lang="en" className="scroll-smooth selection:bg-primary-200 selection:text-canvas-950">
        <body className={`${fontClassName} font-sans font-medium bg-canvas-950`} style={fontCssVariables}>
            <GoogleAnalytics />
            {children}
        </body>
        </html>
    );
}
