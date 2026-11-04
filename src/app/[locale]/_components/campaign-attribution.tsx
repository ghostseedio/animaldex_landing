"use client";

import {useEffect} from "react";
import {trackEvent} from "@/lib/analytics";
import {FIRST_TOUCH_COOKIE, FIRST_TOUCH_MAX_AGE_SECONDS, firstTouchFromLocation, serializeFirstTouch} from "@/lib/first-touch";
import {listenForStoreClicks} from "@/lib/web-funnel-client";

const STORAGE_KEY = "animaldex.campaign";

function readCampaign() {
    if (typeof window === "undefined") return {};
    try {
        return JSON.parse(window.sessionStorage.getItem(STORAGE_KEY) || "{}") as Record<string, string>;
    } catch {
        return {};
    }
}

export function captureCampaignFromLocation(search: string) {
    const params = new URLSearchParams(search);
    const next: Record<string, string> = readCampaign();
    for (const key of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "intent"]) {
        const value = params.get(key);
        if (value) next[key] = value.slice(0, 80);
    }
    if (Object.keys(next).length) {
        window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    }
    return next;
}

export function campaignParameters() {
    const stored = readCampaign();
    const safe: Record<string, string> = {};
    for (const key of ["utm_source", "utm_medium", "utm_campaign", "intent"]) {
        if (stored[key]) safe[key] = stored[key];
    }
    return safe;
}

/** Keeps the first page and referrer this browser arrived on, for a signup later (see lib/first-touch). */
function rememberFirstTouch() {
    if (document.cookie.split("; ").some((part) => part.startsWith(`${FIRST_TOUCH_COOKIE}=`))) return;
    const touch = firstTouchFromLocation(window.location.href, document.referrer);
    if (!touch) return;
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${FIRST_TOUCH_COOKIE}=${serializeFirstTouch(touch)}; Max-Age=${FIRST_TOUCH_MAX_AGE_SECONDS}; Path=/; SameSite=Lax${secure}`;
}

export default function CampaignAttribution() {
    // The front-door funnel's store_click, from any store link on any page (a no-op outside the hero test).
    useEffect(() => listenForStoreClicks(), []);

    useEffect(() => {
        rememberFirstTouch();
        const captured = captureCampaignFromLocation(window.location.search);
        if (captured.utm_campaign || captured.intent) {
            trackEvent("archive_landing_view", {
                ...campaignParameters(),
                path: window.location.pathname
            });
        }
    }, []);
    return null;
}
