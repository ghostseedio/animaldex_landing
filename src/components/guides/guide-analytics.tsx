"use client";

import {useEffect} from "react";
import {trackEvent} from "@/lib/analytics";

export function GuidePageView({event, dimensions}: {event: string; dimensions: Record<string, string>}) {
    useEffect(() => { trackEvent(event, dimensions); }, [event, dimensions]);
    return null;
}

export function GuideAppLink({href, children, listingId, category}: {href: string; children: React.ReactNode; listingId: string; category: string}) {
    return <a href={href} target="_blank" rel="noopener noreferrer" onClick={() => trackEvent("guide_web_open_app_clicked", {listing_id: listingId, service_category: category})}
              className="inline-flex rounded-full bg-primary-400 px-6 py-3 font-bold text-canvas-950 transition hover:bg-primary-300">{children}</a>;
}
