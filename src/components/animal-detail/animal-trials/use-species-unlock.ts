"use client";

import {useEffect, useState} from "react";

/**
 * May this viewer take a Trial for this species?
 *
 * `true` until proven otherwise: while the read is in flight, for a signed-out
 * reader (whose first tap goes to sign-in, after which the server decides),
 * and for the owner of the capture on screen. Only a signed-in reader whom the
 * server says has NOT unlocked the animal sees the lock — the same rule the
 * phone applies in `AnimalTrialUnlock.canAttempt`.
 */
export function useSpeciesUnlock(
    speciesProfileIds: Array<string | null | undefined>,
    options: {ownsThisCapture?: boolean} = {}
) {
    const key = speciesProfileIds.filter(Boolean).map((id) => String(id).toLowerCase()).sort().join(",");
    const [unlocked, setUnlocked] = useState<boolean | null>(null);
    const [didLoad, setDidLoad] = useState(false);

    useEffect(() => {
        if (options.ownsThisCapture || !key) {
            setUnlocked(null);
            setDidLoad(true);
            return;
        }
        let cancelled = false;
        setDidLoad(false);
        void fetch(`/api/app/species-unlock?speciesProfileId=${encodeURIComponent(key)}`, {cache: "no-store"})
            .then((response) => (response.ok ? response.json() : null))
            .then((payload: {unlocked?: boolean | null} | null) => {
                if (cancelled) return;
                setUnlocked(typeof payload?.unlocked === "boolean" ? payload.unlocked : null);
            })
            .catch(() => {
                if (!cancelled) setUnlocked(null);
            })
            .finally(() => {
                if (!cancelled) setDidLoad(true);
            });
        return () => {
            cancelled = true;
        };
    }, [key, options.ownsThisCapture]);

    return {
        canAttempt: options.ownsThisCapture ? true : unlocked !== false,
        unlocked,
        didLoad
    };
}
