"use client";

import EarnPowerSection from "@/components/animal-detail/animal-powers/earn-power-section";
import {useAnimalPower} from "@/components/animal-detail/animal-powers/use-animal-power";
import {useSpeciesUnlock} from "@/components/animal-detail/animal-trials/use-species-unlock";
import {useSpeciesTraining} from "@/components/animal-detail/species-training/use-species-training";

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
     * The animal page's Play tab: the sections in loop order, Training first.
     */
    showsPowerLoop?: boolean;
}) {
    const {power, didLoad, didFail, reload} = useAnimalPower(speciesProfileId);
    // A Trial is per person per species: on a species page, or someone else's
    // capture, the viewer has to have caught the animal themselves.
    const unlock = useSpeciesUnlock([speciesProfileId], {ownsThisCapture});
    const speciesTraining = useSpeciesTraining(showsPowerLoop ? speciesProfileId : null);

    return (
        <EarnPowerSection
            speciesProfileId={speciesProfileId}
            power={power}
            didLoad={didLoad}
            powerReadFailed={didFail}
            onReload={reload}
            isViewersOwnAnimal={isViewersOwnAnimal || unlock.unlocked === true}
            canAttemptTrials={unlock.canAttempt}
            speciesTraining={showsPowerLoop ? speciesTraining : undefined}
            showsLoopSteps={showsPowerLoop}
        />
    );
}
