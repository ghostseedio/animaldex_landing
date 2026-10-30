"use client";

import {useEffect, useState} from "react";
import {TrialRows} from "@/components/companions/step-views";
import {useTrialMotionCaptionLanguage} from "@/components/trial-motion/use-trial-motion-storyboard";
import type {AnimalTrial} from "@/lib/animal-trials";
import type {CompanionWords} from "@/lib/companion-bond";

/**
 * The species page's Play tab (3.2, docs/your-step/SPEC.md section 5):
 * "{name}'s Trials", each with its loop. A page about the species earns
 * nothing and starts nothing; a Trial becomes someone's step in the chat on
 * their own card.
 *
 * The Power itself, what makes it yours and "Talk to it" are said once, in
 * the page's "Its Power" block above the tabs (newcomer UX vet, 2026-10-30,
 * P0-3): this tab no longer repeats them.
 */
export default function SpeciesPlayPower({
    speciesProfileId,
    animalName,
    words
}: {
    speciesProfileId: string | null | undefined;
    animalName: string;
    words: CompanionWords;
}) {
    const [trials, setTrials] = useState<AnimalTrial[]>([]);
    const captionLanguage = useTrialMotionCaptionLanguage();
    useEffect(() => {
        if (!speciesProfileId) return;
        const controller = new AbortController();
        void fetch(`/api/app/animal-trials?speciesProfileId=${encodeURIComponent(speciesProfileId)}${captionLanguage ? `&lang=${captionLanguage}` : ""}`, {
            headers: {Accept: "application/json"},
            signal: controller.signal
        })
            .then((response) => (response.ok ? response.json() : null))
            .then((payload: {trials?: AnimalTrial[]} | null) => setTrials(payload?.trials && Array.isArray(payload.trials) ? payload.trials : []))
            .catch(() => undefined);
        return () => controller.abort();
    }, [captionLanguage, speciesProfileId]);

    return (
        <div className="flex flex-col" data-testid="species-play-power">
            <TrialRows trials={trials} name={animalName} words={words} />
        </div>
    );
}
