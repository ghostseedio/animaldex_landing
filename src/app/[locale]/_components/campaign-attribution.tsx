"use client";

import {useEffect} from "react";
import {trackEvent} from "@/lib/analytics";

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

export default function CampaignAttribution() {
    useEffect(() => {
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
