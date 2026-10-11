"use client";

import {useCallback, useEffect, useRef, useState} from "react";
import {type SpeciesTraining, decodeSpeciesTraining} from "@/lib/species-training";

/**
 * This viewer's Training for one animal. A signed-out visitor gets a preview
 * that locks the Trials as it will once they sign in. Null until the read
 * lands, for an animal with no quiz, and when the read fails — all of which
 * gate nothing, so
 * a slow or broken read never locks the Trials. The server still refuses a
 * Trial start with `training_required` when Training is owed.
 */
export function useSpeciesTraining(speciesProfileId: string | null | undefined) {
    const [training, setTraining] = useState<SpeciesTraining | null>(null);
    const [didLoad, setDidLoad] = useState(false);
    /** Null until known. A signed-out read is a preview: it locks, but cannot be started here. */
    const [isSignedIn, setIsSignedIn] = useState<boolean | null>(null);
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
            setIsSignedIn(typeof payload?.isSignedIn === "boolean" ? payload.isSignedIn : null);
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

    return {training, didLoad, isSignedIn, reload, setTraining};
}

export type SpeciesTrainingState = ReturnType<typeof useSpeciesTraining>;

/**
 * The route already decoded it; this re-validates it, questions included, so a
 * question with no prompt or choices can never reach the quiz.
 */
function decodeSpeciesTrainingPayload(value: unknown): SpeciesTraining | null {
    if (!value || typeof value !== "object") return null;
    const training = value as SpeciesTraining;
    if (typeof training.available !== "boolean" || !Array.isArray(training.questions)) return decodeSpeciesTraining(value);
    // Client shape (camelCase): back to the RPC's shape for the one decoder.
    return decodeSpeciesTraining({
        species_profile_id: training.speciesProfileId,
        available: training.available,
        completed: training.completed,
        unlocked: training.unlocked,
        reward_xp: training.rewardXP,
        reward_credits: training.rewardCredits,
        content_version: training.contentVersion,
        questions: training.questions
    });
}
