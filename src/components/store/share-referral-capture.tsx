"use client";

import {useEffect} from "react";
import {rememberShareReferral} from "@/lib/store-links";

/**
 * On a page people arrive at from a shared link (a post, a profile): keeps the
 * link's `?ref=` for this tab, so the store buttons carry it even after the
 * URL changes. Renders nothing, and does nothing without a `ref`.
 */
export default function ShareReferralCapture() {
    useEffect(() => {
        rememberShareReferral(window.location.search);
    }, []);

    return null;
}
