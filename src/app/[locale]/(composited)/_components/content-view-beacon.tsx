"use client";

import {useEffect, useRef} from "react";
import {usePathname} from "next/navigation";

/**
 * Reports a view of the blog post or page currently on screen.
 *
 * Mounted once in the composited layout rather than on each route, so both
 * shapes are covered from one place: `/blog/<slug>` and the single-segment
 * page routes. Anything else — nested app routes, account, auth — is ignored,
 * which is what keeps the table to rows the admin list can actually show.
 */

const LOCALES = new Set(["en", "id"]);
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function resolveContent(pathname: string, pageSlugs: Set<string>) {
    const segments = pathname.split("/").filter(Boolean);

    // The default locale is unprefixed, so a leading locale is optional.
    if (segments.length && LOCALES.has(segments[0])) segments.shift();

    if (segments.length === 2 && segments[0] === "blog" && SLUG.test(segments[1])) {
        return {type: "blog" as const, slug: segments[1]};
    }

    if (segments.length === 1 && pageSlugs.has(segments[0])) {
        return {type: "page" as const, slug: segments[0]};
    }

    return null;
}

export default function ContentViewBeacon({pageSlugs}: {pageSlugs: string[]}) {
    const pathname = usePathname();
    // React runs effects twice in development; without this the count would
    // double on every local page load.
    const reported = useRef<string | null>(null);

    useEffect(() => {
        const content = resolveContent(pathname ?? "", new Set(pageSlugs));
        if (!content) return;

        const key = `${content.type}:${content.slug}`;
        if (reported.current === key) return;
        reported.current = key;

        void fetch("/api/content-views", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify(content),
            keepalive: true
        }).catch(() => {
            // A view that cannot be recorded is not worth telling a reader about.
        });
    }, [pageSlugs, pathname]);

    return null;
}
