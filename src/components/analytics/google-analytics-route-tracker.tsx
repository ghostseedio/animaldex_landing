"use client";

import {usePathname} from "next/navigation";
import {useEffect} from "react";
import {isGoogleAnalyticsEnabled, trackPageView} from "@/lib/analytics";

export default function GoogleAnalyticsRouteTracker() {
    const pathname = usePathname();

    useEffect(() => {
        if (!isGoogleAnalyticsEnabled()) {
            return;
        }

        const query = window.location.search.replace(/^\?/, "");
        const url = query ? `${pathname}?${query}` : pathname;
        trackPageView(url);
    }, [pathname]);

    return null;
}
