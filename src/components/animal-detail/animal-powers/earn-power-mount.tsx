"use client";

import EarnPowerSection from "@/components/animal-detail/animal-powers/earn-power-section";
import {useAnimalPower} from "@/components/animal-detail/animal-powers/use-animal-power";

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
    isViewersOwnAnimal = true
}: {
    speciesProfileId: string | null | undefined;
    isViewersOwnAnimal?: boolean;
}) {
    const {power, didLoad, reload} = useAnimalPower(speciesProfileId);

    return (
        <EarnPowerSection
            speciesProfileId={speciesProfileId}
            power={power}
            didLoad={didLoad}
            onReload={reload}
            isViewersOwnAnimal={isViewersOwnAnimal}
        />
    );
}
