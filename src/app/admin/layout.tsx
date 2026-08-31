import "@/app/[locale]/_assets/globals.css";
import React, {ReactNode} from "react";
import {Metadata} from "next";
import {fontClassName, fontCssVariables} from "@/app/fonts";
import {getSiteUrl} from "@/lib/site";

export const metadata: Metadata = {
    metadataBase: new URL(getSiteUrl()),
    title: "AnimalDex Admin",
    robots: {
        index: false,
        follow: false
    }
};

export default function AdminLayout({children}: {children: ReactNode}) {
    return (
        <html lang="en" className="scroll-smooth selection:bg-primary-200 selection:text-canvas-950">
        <body className={`${fontClassName} font-sans font-medium bg-canvas-950 text-ink-100`} style={fontCssVariables}>
            {children}
        </body>
        </html>
    );
}
