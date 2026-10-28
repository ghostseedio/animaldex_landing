"use client";

import {usePathname} from "next/navigation";
import {useEffect} from "react";
import {isGoogleAnalyticsEnabled, storeForHref, trackEvent, trackPageView} from "@/lib/analytics";

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

    // Every App Store / Google Play link on the site, whichever component drew it.
    useEffect(() => {
        if (!isGoogleAnalyticsEnabled()) return;
        const onClick = (event: MouseEvent) => {
            const anchor = (event.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
            const store = storeForHref(anchor?.href);
            if (!anchor || !store) return;
            trackEvent("store_click", {store, page_path: window.location.pathname, link_text: anchor.textContent?.trim().slice(0, 60) || undefined});
        };
        document.addEventListener("click", onClick, true);
        return () => document.removeEventListener("click", onClick, true);
    }, []);

    return null;
}
