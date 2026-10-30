"use client";

import Link from "@/app/[locale]/_components/link";
import {useAnimalPower} from "@/components/animal-detail/animal-powers/use-animal-power";
import {useSpeciesUnlock} from "@/components/animal-detail/animal-trials/use-species-unlock";
import {chatCaptureIdFor, useCompanionCards, useCompanions} from "@/components/companions/use-companions";
import {askAboutAnimal} from "@/lib/ask-animaldex/events";
import {bondPowerLine, companionRowHref, fillWords, type CompanionWords} from "@/lib/companion-bond";

const NEON = "#A7F432";

/**
 * Under the species page's one "Its Power" block (newcomer UX vet,
 * 2026-10-30, P0-3): what makes this Power yours, for whoever is reading,
 * and "Talk to it".
 *
 * - Someone without the animal: "Capture a {animal}, and it's yours when you
 *   finish one step it gives you." Talk to it opens the animal's chat here,
 *   which anyone can use.
 * - Its owner, before the Power: "Yours when you finish one step it gives
 *   you." Talk to it opens their own chat with it, where the steps are.
 * - Its owner, after: how it was earned, in neon.
 *
 * The page is static, so it renders the first case and who is reading
 * arrives in the browser.
 */
export default function SpeciesPowerOwnership({
    speciesProfileId,
    animalName,
    words,
    labels
}: {
    speciesProfileId: string | null | undefined;
    animalName: string;
    words: CompanionWords;
    labels: {
        /** "Capture a {animal}, and it's yours when you finish one step it gives you." */
        visitor: string;
        /** "Yours when you finish one step it gives you." */
        owner: string;
    };
}) {
    const unlock = useSpeciesUnlock([speciesProfileId]);
    const owns = unlock.unlocked === true;
    const {power} = useAnimalPower(owns ? speciesProfileId : null);
    // Their chat with it, on the card they last talked through, else its newest.
    const {rows} = useCompanions(owns);
    const {cards} = useCompanionCards(owns);
    const row = owns && speciesProfileId
        ? rows.find((entry) => entry.speciesProfileId.toLowerCase() === speciesProfileId.toLowerCase()) ?? null
        : null;
    const ownChatHref = row
        ? companionRowHref({captureId: chatCaptureIdFor(cards, row.speciesProfileId, row.captureId), referralWaiting: false, referralId: null})
        : null;

    const earned = owns && power?.isEarned === true;
    const line = !owns
        ? fillWords(labels.visitor, {animal: animalName})
        : earned && power
            ? bondPowerLine({power: {name: power.principleName, earned: true, via: power.earnedVia, at: power.earnedAt}}, animalName, words)
            : labels.owner;

    const buttonClass = "inline-flex min-h-11 w-fit items-center gap-2 rounded-full bg-primary-400 px-5 text-sm font-black text-canvas-950 transition-colors hover:bg-primary-300";

    return (
        <div className="mt-5 flex flex-col gap-3" data-testid="species-power-ownership">
            <p className="max-w-2xl text-base font-semibold leading-7" style={earned ? {color: NEON} : undefined}>
                <span className={earned ? undefined : "text-white"}>{line}</span>
            </p>
            {ownChatHref ? (
                <Link href={ownChatHref} className={buttonClass}>{words.bond.talkToIt}</Link>
            ) : (
                <button type="button" onClick={() => askAboutAnimal()} className={buttonClass}>
                    {words.bond.talkToIt}
                </button>
            )}
        </div>
    );
}
