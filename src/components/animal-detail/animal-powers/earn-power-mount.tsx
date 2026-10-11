"use client";

import {useMemo, useState} from "react";
import EarnPowerSection from "@/components/animal-detail/animal-powers/earn-power-section";
import {useAnimalPower} from "@/components/animal-detail/animal-powers/use-animal-power";
import {useSpeciesUnlock} from "@/components/animal-detail/animal-trials/use-species-unlock";
import PowerLoopBar from "@/components/animal-detail/power-loop/power-loop-bar";
import {useSpeciesTraining} from "@/components/animal-detail/species-training/use-species-training";
import type {AnimalTrial} from "@/lib/animal-trials";
import {type PowerLoopViewer, loopTraining, powerLoop} from "@/lib/power-loop";

/**
 * `EarnPowerSection` with its own read of the earned state, for a surface that
 * has nothing else on it that needs the Power.
 *
 * The public species page is fully static and must not read the viewer on the
 * server, so the earned state arrives here, in the browser, exactly as the
 * Trials and System Dynamics already do.
 */
export default function EarnPowerMount({
    speciesProfileId,
    isViewersOwnAnimal = true,
    ownsThisCapture = false,
    showsPowerLoop = false
}: {
    speciesProfileId: string | null | undefined;
    /**
     * False on a species page. Once the signed-in reader is known to have
     * caught the animal it is theirs, as on the iOS catalog species detail
     * (`isViewersOwnAnimal: true`), so the unlock rows speak to it directly.
     */
    isViewersOwnAnimal?: boolean;
    /** The viewer's own capture is on screen, which is itself the unlock. */
    ownsThisCapture?: boolean;
    /**
     * The animal page's Play tab: the Power Loop bar on top and the sections
     * under it in loop order. The bar is built from the reads this mount makes
     * anyway (Training, the Power, the Trials, the unlock), so it costs nothing
     * extra. There is no card here, so it shows no level chips.
     */
    showsPowerLoop?: boolean;
}) {
    const {power, didLoad, reload} = useAnimalPower(speciesProfileId);
    // A Trial is per person per species: on a species page, or someone else's
    // capture, the viewer has to have caught the animal themselves.
    const unlock = useSpeciesUnlock([speciesProfileId], {ownsThisCapture});
    const speciesTraining = useSpeciesTraining(showsPowerLoop ? speciesProfileId : null);
    const [loopTrials, setLoopTrials] = useState<AnimalTrial[] | null>(null);
    const [trialsRouteRequest, setTrialsRouteRequest] = useState(0);

    const loop = useMemo(() => {
        if (!showsPowerLoop || !speciesTraining.didLoad || !didLoad || !unlock.didLoad) return null;
        // A failed read cannot say who is looking: no bar rather than a wrong one.
        if (unlock.signedIn == null) return null;
        // A Power with no Trial shows only Apply It Your Way, which mounts no
        // Trials list to wait for.
        const trialsMounted = !power || power.isEarned || power.hasTrial;
        if (trialsMounted && loopTrials === null) return null;
        // Unknown unlock while signed in is treated as caught, as the Trials
        // treat it (`canAttempt`): the server refuses what it must.
        const viewer: PowerLoopViewer = !unlock.signedIn
            ? "signedOut"
            : unlock.unlocked === false ? "animalPageNotCaught" : "animalPageCaught";
        return powerLoop({
            viewer,
            xp: null,
            training: loopTraining(speciesTraining.training),
            trials: loopTrials ?? [],
            powerEarned: Boolean(power?.isEarned),
            hasPowerToEarn: Boolean(power),
            stake: null
        });
    }, [didLoad, loopTrials, power, showsPowerLoop, speciesTraining.didLoad, speciesTraining.training, unlock.didLoad, unlock.signedIn, unlock.unlocked]);

    return (
        <>
            {loop ? (
                <PowerLoopBar
                    loop={loop}
                    onProveIt={() => setTrialsRouteRequest((value) => value + 1)}
                    // No card on this page: Battle goes to the Arena, Fuse
                    // Powers to the viewer's animals, where Fusion lives on a card.
                    battleHref="/app/matchups"
                    canBattle
                    onFuse={null}
                    fuseHref="/app/collection"
                />
            ) : null}
            <EarnPowerSection
                speciesProfileId={speciesProfileId}
                power={power}
                didLoad={didLoad}
                onReload={reload}
                isViewersOwnAnimal={isViewersOwnAnimal || unlock.unlocked === true}
                canAttemptTrials={unlock.canAttempt}
                speciesTraining={showsPowerLoop ? speciesTraining : undefined}
                trialsRouteRequest={trialsRouteRequest}
                onTrialsChange={showsPowerLoop ? setLoopTrials : undefined}
                // The steps don't wait for the bar: it needs every read to
                // land, and the sections must read in loop order before then.
                showsLoopSteps={showsPowerLoop}
            />
        </>
    );
}
