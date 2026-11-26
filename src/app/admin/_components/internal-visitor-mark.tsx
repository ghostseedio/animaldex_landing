"use client";

import {useEffect} from "react";
import {INTERNAL_VISITOR_COOKIE, internalVisitorCookie} from "@/lib/internal-visitor";

/** Rendered for signed-in operators only: marks this browser so its Ark visits stay out of the metrics. */
export default function InternalVisitorMark() {
    useEffect(() => {
        try {
            if (document.cookie.split("; ").includes(`${INTERNAL_VISITOR_COOKIE}=1`)) return;
            document.cookie = internalVisitorCookie(window.location.protocol === "https:");
        } catch {
            // A blocked cookie only means this browser is counted.
        }
    }, []);
    return null;
}
