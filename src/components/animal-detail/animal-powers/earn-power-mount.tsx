"use client";

import EarnPowerSection from "@/components/animal-detail/animal-powers/earn-power-section";
import {useAnimalPower} from "@/components/animal-detail/animal-powers/use-animal-power";
import {useSpeciesUnlock} from "@/components/animal-detail/animal-trials/use-species-unlock";

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
    ownsThisCapture = false
}: {
    speciesProfileId: string | null | undefined;
    isViewersOwnAnimal?: boolean;
    /** The viewer's own capture is on screen, which is itself the unlock. */
    ownsThisCapture?: boolean;
}) {
    const {power, didLoad, reload} = useAnimalPower(speciesProfileId);
    // A Trial is per person per species: on a species page, or someone else's
    // capture, the viewer has to have caught the animal themselves.
    const unlock = useSpeciesUnlock([speciesProfileId], {ownsThisCapture});

    return (
        <EarnPowerSection
            speciesProfileId={speciesProfileId}
            power={power}
            didLoad={didLoad}
            onReload={reload}
            isViewersOwnAnimal={isViewersOwnAnimal}
            canAttemptTrials={unlock.canAttempt}
        />
    );
}
