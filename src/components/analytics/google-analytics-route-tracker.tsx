"use client";

import {usePathname, useSearchParams} from "next/navigation";
import {useEffect} from "react";
import {isGoogleAnalyticsEnabled, trackPageView} from "@/lib/analytics";

export default function GoogleAnalyticsRouteTracker() {
    const pathname = usePathname();
    const searchParams = useSearchParams();

    useEffect(() => {
        if (!isGoogleAnalyticsEnabled()) {
            return;
        }

        const query = searchParams.toString();
        const url = query ? `${pathname}?${query}` : pathname;
        trackPageView(url);
    }, [pathname, searchParams]);

    return null;
}
