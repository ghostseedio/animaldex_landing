import "@/app/[locale]/_assets/globals.css";
import React, {ReactNode} from "react";
import {Metadata} from "next";
import {fontClassName, fontCssVariables} from "@/app/fonts";
import {cookies} from "next/headers";
import {getSiteUrl} from "@/lib/site";
import AdminShell from "@/app/admin/_components/admin-shell";
import {isSupportAdminCookieAuthorized} from "@/lib/support-admin-auth";

export const metadata: Metadata = {
    metadataBase: new URL(getSiteUrl()),
    title: "AnimalDex Admin",
    robots: {
        index: false,
        follow: false
    }
};

/**
 * The admin chrome goes on here, for operators only, so it persists across
 * navigations and the route's loading skeleton renders inside it. Everyone
 * else gets the page bare: the password prompt from withAdminGate, or the
 * support magic-link reply flow, which carries its own token check.
 */
export default async function AdminLayout({children}: {children: ReactNode}) {
    const authorized = await isSupportAdminCookieAuthorized(cookies());
    // Read back on the server so the first paint matches the sidebar the
    // operator left open, instead of flashing wide and snapping shut.
    const collapsed = cookies().get("admin_sidebar")?.value === "collapsed";
    return (
        <html lang="en" className="scroll-smooth selection:bg-primary-200 selection:text-canvas-950">
        <body className={`${fontClassName} font-sans font-medium bg-canvas-950 text-ink-100`} style={fontCssVariables}>
            {authorized ? <AdminShell defaultCollapsed={collapsed}>{children}</AdminShell> : children}
        </body>
        </html>
    );
}
