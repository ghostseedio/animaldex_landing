"use client";

import {useEffect} from "react";
import {trackEvent} from "@/lib/analytics";

/** Fires one analytics event when a guide page or list is viewed. */
export function GuidePageView({event, dimensions}: {event: string; dimensions: Record<string, string>}) {
    const serialized = JSON.stringify(dimensions);
    useEffect(() => {
        trackEvent(event, JSON.parse(serialized) as Record<string, string>);
    }, [event, serialized]);
    return null;
}
