"use client";

import {useEffect, useState} from "react";

/**
 * Has this viewer caught this species? The species page's Play tab gives a
 * reader who holds it "Talk to it" (3.2).
 *
 * `canAttempt` is `true` until proven otherwise: while the read is in flight,
 * for a signed-out reader, and for the owner of the capture on screen.
 * `unlocked` is true only once the server has said so — the same rule the
 * phone applies in `AnimalTrialUnlock.canAttempt`.
 */
export function useSpeciesUnlock(
    speciesProfileIds: Array<string | null | undefined>,
    options: {ownsThisCapture?: boolean} = {}
) {
    const key = speciesProfileIds.filter(Boolean).map((id) => String(id).toLowerCase()).sort().join(",");
    const [unlocked, setUnlocked] = useState<boolean | null>(null);
    /** Null until the read lands (and for the owner of the capture on screen, who is signed in). */
    const [signedIn, setSignedIn] = useState<boolean | null>(null);
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
            .then((payload: {signedIn?: boolean; unlocked?: boolean | null} | null) => {
                if (cancelled) return;
                setSignedIn(typeof payload?.signedIn === "boolean" ? payload.signedIn : null);
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
        signedIn: options.ownsThisCapture ? true : signedIn,
        didLoad
    };
}
