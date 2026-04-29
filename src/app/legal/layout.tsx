import "@/app/[locale]/_assets/globals.css";
import React, {ReactNode} from "react";
import localFont from "next/font/local";
import {Metadata} from "next";
import {getSiteUrl} from "@/lib/site";

const calSans = localFont({
    src: "../[locale]/_assets/fonts/CalSans-SemiBold.woff2",
    variable: "--font-cal-sans",
    display: "swap"
});
const onest = localFont({
    src: [
        {
            path: "../[locale]/_assets/fonts/Onest-Regular.woff",
            weight: "400"
        },
        {
            path: "../[locale]/_assets/fonts/Onest-Medium.woff",
            weight: "500"
        },
        {
            path: "../[locale]/_assets/fonts/Onest-Bold.woff",
            weight: "700"
        }
    ],
    variable: "--font-onest",
    display: "swap"
});

export const metadata: Metadata = {
    metadataBase: new URL(getSiteUrl()),
    applicationName: "AnimalDex",
    generator: "Next.js",
    colorScheme: "dark",
    themeColor: "#1BC451",
    icons: {
        icon: "/favicon.svg",
        shortcut: "/favicon.ico"
    }
};

export default function PublicLegalLayout({children}: { children: ReactNode }) {
    return (
        <html lang="en" className="scroll-smooth selection:bg-primary-200 selection:text-canvas-950">
        <body className={`${onest.variable} ${calSans.variable} font-sans bg-canvas-950`} style={{
            "--font-sans": "var(--font-onest)",
            "--font-display": "var(--font-cal-sans)"
        } as React.CSSProperties}>
            {children}
        </body>
        </html>
    );
}
