"use client";

import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {
    FUSED_POLL_INTERVAL_MS,
    FUSED_POLL_LIMIT_MS,
    type FusedPower,
    decodeFusedPowers,
    needsPrepare
} from "@/lib/fused-powers";

/**
 * This card's fused Powers, for its owner. Empty for anyone else, and while
 * the read is in flight or has failed — none of which shows anything.
 *
 * A row still being written drives the content in: `prepare` once per visit
 * for a row nobody is writing, then a re-read every 5 s for up to 2 minutes
 * while any row stays 'preparing'.
 */
export function useFusedPowers(captureId: string | null | undefined) {
    const [items, setItems] = useState<FusedPower[]>([]);
    const [didLoad, setDidLoad] = useState(false);
    const requestRef = useRef(0);
    /** Rows `prepare` has been sent for on this visit. */
    const preparedRef = useRef(new Set<string>());
    /** When polling began; null while nothing is preparing. */
    const pollStartRef = useRef<number | null>(null);

    const reload = useCallback(async () => {
        const request = ++requestRef.current;
        if (!captureId) {
            setItems([]);
            setDidLoad(true);
            return [];
        }
        try {
            const response = await fetch(`/api/app/fused-powers?captureId=${encodeURIComponent(captureId)}`, {
                headers: {Accept: "application/json"},
                cache: "no-store"
            });
            const payload = response.ok ? await response.json() : null;
            if (requestRef.current !== request) return null;
            // A failed re-read keeps what is on screen rather than blanking it.
            if (payload) setItems(decodeFusedPowers(payload.items));
            setDidLoad(true);
            return payload ? decodeFusedPowers(payload.items) : null;
        } catch {
            if (requestRef.current === request) setDidLoad(true);
            return null;
        }
    }, [captureId]);

    useEffect(() => {
        preparedRef.current = new Set();
        pollStartRef.current = null;
        setItems([]);
        setDidLoad(false);
        void reload();
    }, [reload]);

    // Ask for the content of any row nobody is writing. The request can take
    // a minute; polling below shows it the moment it lands either way.
    useEffect(() => {
        for (const item of items) {
            if (!needsPrepare(item) || preparedRef.current.has(item.id)) continue;
            preparedRef.current.add(item.id);
            void fetch("/api/app/fused-powers", {
                method: "POST",
                headers: {"Content-Type": "application/json", Accept: "application/json"},
                body: JSON.stringify({action: "prepare", learnedId: item.id})
            })
                .catch(() => null)
                // 'ready', 'unavailable' (granted, comes back earned) or 'earned': re-read.
                .then(() => reload());
        }
    }, [items, reload]);

    useEffect(() => {
        const preparing = items.some((item) => item.stage === "preparing");
        if (!preparing) {
            pollStartRef.current = null;
            return undefined;
        }
        const startedAt = pollStartRef.current ?? Date.now();
        pollStartRef.current = startedAt;
        if (Date.now() - startedAt >= FUSED_POLL_LIMIT_MS) return undefined;
        const timer = window.setTimeout(() => void reload(), FUSED_POLL_INTERVAL_MS);
        return () => window.clearTimeout(timer);
    }, [items, reload]);

    return useMemo(() => ({items, didLoad, reload}), [didLoad, items, reload]);
}

export type FusedPowersState = ReturnType<typeof useFusedPowers>;
