"use client";

/**
 * One of the apps' remote switches in the browser (lib/app-feature-flags),
 * for a page cached for everyone (/talk): the server's answer when the page
 * was drawn is `initial`, then the live one from `/api/feature-flags`, read
 * once per tab. A failed read keeps `initial`. A key never heard of is off.
 */

import {useEffect, useState} from "react";
import {decodeAppFeatureFlags, isAppFeatureOn, type AppFeatureFlags, type WebFeatureFlag} from "@/lib/app-feature-flags";

let flagsCache: Promise<AppFeatureFlags | null> | null = null;

function loadFlags(): Promise<AppFeatureFlags | null> {
    flagsCache ??= fetch("/api/feature-flags", {headers: {Accept: "application/json"}})
        .then((response) => (response.ok ? response.json() as Promise<{flags?: unknown}> : null))
        .then((payload) => (payload ? decodeAppFeatureFlags(payload.flags) : null))
        .catch(() => {
            flagsCache = null;
            return null;
        });
    return flagsCache;
}

export function useAppFeatureFlag(key: WebFeatureFlag, initial = false): boolean {
    const [on, setOn] = useState(initial);
    useEffect(() => {
        let cancelled = false;
        void loadFlags().then((flags) => {
            if (!cancelled && flags) setOn(isAppFeatureOn(flags, key));
        });
        return () => {
            cancelled = true;
        };
    }, [key]);
    return on;
}
