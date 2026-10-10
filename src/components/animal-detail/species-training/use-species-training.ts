"use client";

import {useCallback, useEffect, useRef, useState} from "react";
import {type SpeciesTraining, decodeSpeciesTraining} from "@/lib/species-training";

/**
 * This viewer's Training for one animal. Null until the read lands, for a
 * signed-out visitor, and when the read fails — all of which gate nothing, so
 * a slow or broken read never locks the Trials. The server still refuses a
 * Trial start with `training_required` when Training is owed.
 */
export function useSpeciesTraining(speciesProfileId: string | null | undefined) {
    const [training, setTraining] = useState<SpeciesTraining | null>(null);
    const [didLoad, setDidLoad] = useState(false);
    const requestRef = useRef(0);

    const reload = useCallback(async () => {
        const request = requestRef.current + 1;
        requestRef.current = request;

        if (!speciesProfileId) {
            setTraining(null);
            setDidLoad(true);
            return null;
        }

        try {
            const response = await fetch(
                `/api/app/species-training?speciesProfileId=${encodeURIComponent(speciesProfileId)}`,
                {headers: {Accept: "application/json"}, cache: "no-store"}
            );
            const payload = response.ok ? await response.json() : null;
            if (requestRef.current !== request) return null;
            const loaded = decodeSpeciesTrainingPayload(payload?.training);
            setTraining(loaded);
            return loaded;
        } catch {
            return null;
        } finally {
            if (requestRef.current === request) setDidLoad(true);
        }
    }, [speciesProfileId]);

    useEffect(() => {
        setTraining(null);
        setDidLoad(false);
        void reload();
    }, [reload]);

    return {training, didLoad, reload, setTraining};
}

/** The route already decoded it; this only re-validates the shape it was sent in. */
function decodeSpeciesTrainingPayload(value: unknown): SpeciesTraining | null {
    if (!value || typeof value !== "object") return null;
    const training = value as SpeciesTraining;
    // Already in client shape (camelCase) — the route decodes the RPC payload.
    if (typeof training.available === "boolean" && Array.isArray(training.questions)) return training;
    return decodeSpeciesTraining(value);
}
