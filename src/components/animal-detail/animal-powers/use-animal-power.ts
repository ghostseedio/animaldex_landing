"use client";

import {useCallback, useEffect, useRef, useState} from "react";
import type {AnimalPower, CapturePlayEligibilityMap} from "@/lib/animal-powers";

/**
 * This viewer's earned state for one species' Animal Power.
 *
 * `power` is null until the read lands, and stays null when the species has no
 * Power at all — the surfaces built on it are simply absent in both cases
 * rather than claiming "not yet earned" about something that does not exist.
 */
export function useAnimalPower(speciesProfileId: string | null | undefined) {
    const [power, setPower] = useState<AnimalPower | null>(null);
    const [didLoad, setDidLoad] = useState(false);
    const requestRef = useRef(0);

    const reload = useCallback(async () => {
        const request = requestRef.current + 1;
        requestRef.current = request;

        if (!speciesProfileId) {
            setPower(null);
            setDidLoad(true);
            return null;
        }

        try {
            const response = await fetch(
                `/api/app/animal-powers?speciesProfileId=${encodeURIComponent(speciesProfileId)}`,
                {headers: {Accept: "application/json"}, cache: "no-store"}
            );
            const payload = response.ok ? await response.json() : null;
            if (requestRef.current !== request) return null;
            const loaded: AnimalPower | null = payload?.power ?? null;
            setPower(loaded);
            return loaded;
        } catch {
            // A failed read leaves the Power surfaces blank rather than asserting
            // that this species has none.
            return null;
        } finally {
            if (requestRef.current === request) setDidLoad(true);
        }
    }, [speciesProfileId]);

    useEffect(() => {
        setPower(null);
        setDidLoad(false);
        void reload();
    }, [reload]);

    return {power, didLoad, reload, setPower};
}

/**
 * Bulk Power eligibility for the viewer's own captures, fetched once.
 *
 * Null until it lands and null if the read fails, which reads as "no Power
 * lock" — the permissive default, so a slow request never hides a capture that
 * is actually usable. The server remains the authority.
 */
export function usePlayEligibility(enabled: boolean) {
    const [eligibility, setEligibility] = useState<CapturePlayEligibilityMap | null>(null);
    const [didAttempt, setDidAttempt] = useState(false);

    const reload = useCallback(async () => {
        if (!enabled) {
            setDidAttempt(true);
            return;
        }
        try {
            const response = await fetch("/api/app/animal-powers/eligibility", {
                headers: {Accept: "application/json"},
                cache: "no-store"
            });
            if (response.ok) {
                const payload = await response.json();
                setEligibility(payload.eligibility ?? null);
            }
        } catch {
            // Keep whatever was last known.
        } finally {
            setDidAttempt(true);
        }
    }, [enabled]);

    useEffect(() => {
        void reload();
    }, [reload]);

    return {eligibility, didAttempt, reload};
}
